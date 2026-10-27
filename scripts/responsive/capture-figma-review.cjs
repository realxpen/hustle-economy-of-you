#!/usr/bin/env node
"use strict";
/**
 * UX012: evidence capture, NOT automated Figma pixel approval.
 * Read-only, unauthenticated public shell screenshots against LOCAL web only.
 * This is intentionally distinct from native Android/iPhone Safari capture.
 *
 * All non-local network is blocked in the Chromium page context. No credentials,
 * sign-in, test users, real purchases, or backend-changing actions are used.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = process.env.HUSTLE_LOCAL_WEB_URL || "http://127.0.0.1:3001";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(root)) {
  throw Error("Visual capture is ONLY allowed against a loopback-hosted build");
}
const output = process.env.HUSTLE_VISUAL_REVIEW_DIR ||
  path.join(os.tmpdir(), "hustle-ux012-visual-review");
if (!path.isAbsolute(output)) throw Error("Screenshot evidence directory must be absolute");
const scenarios = [
  { route: "/", key: "welcome", figma: "2:2", expectation: "Public welcome shell" },
  { route: "/auth", key: "auth", figma: "2:2", expectation: "Public sign-in shell; not the signed-in journey" },
  { route: "/home", key: "feed", figma: "2:18", expectation: "Unauthenticated feed shell; creator media not validated" },
  { route: "/search", key: "explore", figma: "6:2", expectation: "Public Explore/search shell" },
  { route: "/marketplace", key: "marketplace", figma: "8:226", expectation: "Public offers listing; detailed product/service states not exercised" },
];
const devices = [
  { width: 320, height: 640, label: "phone-320" },
  { width: 360, height: 780, label: "phone-360" },
  { width: 390, height: 844, label: "figma-phone-390" },
  { width: 768, height: 1024, label: "tablet-768" },
  { width: 1440, height: 900, label: "desktop-1440" },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const captures = [];
  const issues = [];
  try {
    for (const device of devices) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        reducedMotion: "reduce", colorScheme: "light", serviceWorkers: "block",
      });
      // The review archive is designed to be safe in GitHub Actions: it MUST
      // never load third-party content or private signed-in screens.
      await context.route("**/*", route => {
        let url;
        try { url = new URL(route.request().url()); }
        catch { return route.abort(); }
        const local = url.protocol === "data:" || url.protocol === "blob:" ||
          (url.protocol === "http:" && url.hostname === "127.0.0.1" &&
            url.port === new URL(root).port);
        return local ? route.continue() : route.abort();
      });
      for (const scene of scenarios) {
        const page = await context.newPage();
        const file = device.label + "__" + scene.key + ".png";
        try {
          const res = await page.goto(root + scene.route, {
            waitUntil: "domcontentloaded", timeout: 25000,
          });
          await page.waitForTimeout(260);
          const metrics = await page.evaluate(() => {
            const html = document.documentElement;
            const body = document.body;
            const main = document.querySelector("main");
            const style = getComputedStyle(html);
            const navs = [...document.querySelectorAll('nav[aria-label]')].map(nav => {
              const r = nav.getBoundingClientRect(), css = getComputedStyle(nav);
              return {
                label: nav.getAttribute("aria-label"),
                visible: css.display !== "none" && css.visibility !== "hidden" &&
                  r.height > 0,
                box: { x: Math.round(r.x), y: Math.round(r.y),
                  width: Math.round(r.width), height: Math.round(r.height) },
              };
            });
            return {
              title: document.title,
              pathname: location.pathname,
              hasMain: !!main,
              bodyChars: body.innerText.trim().length,
              overflowPx: Math.max(html.scrollWidth, body.scrollWidth) - innerWidth,
              tokens: Object.fromEntries(["paper", "accent", "dark", "ink"].map(
                token => [token, style.getPropertyValue("--hf-" + token).trim()]
              )),
              navigation: navs,
              interactiveCount: [...document.querySelectorAll("a,button,input,select,textarea")]
                .filter(el => {
                  const r = el.getBoundingClientRect(), st = getComputedStyle(el);
                  return r.width > 0 && r.height > 0 && st.display !== "none" &&
                    st.visibility !== "hidden";
                }).length,
            };
          });
          const status = res?.status() ?? null;
          await page.screenshot({
            path: path.join(output, file),
            fullPage: false, animations: "disabled",
            caret: "hide",
          });
          captures.push({ screen: scene.key, designNode: scene.figma,
            expectation: scene.expectation, viewport: device.label, status,
            file, ...metrics });
          if (!status || status >= 400 || !metrics.hasMain ||
              metrics.overflowPx > 3 || metrics.bodyChars < 10) {
            issues.push({ scene: scene.key, viewport: device.label, status,
              overflowPx: metrics.overflowPx, hasMain: metrics.hasMain });
          }
        } catch (error) {
          issues.push({ scene: scene.key, viewport: device.label,
            error: String(error?.message || error).slice(0, 260) });
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const report = {
    summary: "Local-only public shell screenshot review (NOT Figma pixel parity)",
    visualFigmaComparison: "PENDING — authenticated + Figma reference screenshots required",
    realIOSAndAndroidScreens: "NOT TESTED by Chromium screenshot capture",
    source: "psxnn95X8nPqEEp7IvEw5s",
    networkIsolation: "Loopback only. Nonlocal browser requests blocked.",
    captures: captures.length, expected: devices.length * scenarios.length,
    issues, screens: captures,
  };
  fs.writeFileSync(path.join(output, "review-manifest.json"),
    JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ count: captures.length, issues, directory: output,
    status: issues.length ? "FAIL" : "CAPTURED" }, null, 2));
  if (issues.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
