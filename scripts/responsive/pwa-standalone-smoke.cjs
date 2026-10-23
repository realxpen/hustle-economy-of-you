#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true
    });
    const page = await context.newPage();
    const root = "http://127.0.0.1:3001";
    const manifestResponse = await page.request.get(root + "/manifest.webmanifest");
    assert.equal(manifestResponse.status(), 200, "PWA manifest must load");
    const manifest = await manifestResponse.json();
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, "/home");
    assert.equal((await page.request.get(root + "/icon.svg")).status(), 200, "SVG icon must load");
    const appleIcon = await page.request.get(root + "/apple-icon");
    assert.equal(appleIcon.status(), 200, "iPhone touch icon must load");
    assert.match(appleIcon.headers()["content-type"] || "", /image\/png/);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      media: "screen", features: [{ name: "display-mode", value: "standalone" }]
    });
    await page.goto(root + "/search", { waitUntil: "domcontentloaded" });
    const runningStandalone = await page.evaluate(() => matchMedia("(display-mode: standalone)").matches);
    assert.equal(runningStandalone, true, "browser must emulate installed standalone display");
    const nav = page.getByRole("navigation", { name: "Hustle mobile application" });
    assert.equal(await nav.isVisible(), true, "installed app must display native five-tab dock");
    for (const name of ["Home", "Explore", "Create", "Inbox", "You"]) {
      assert.equal(await nav.getByRole("link", { name }).count(), 1, "missing " + name);
    }
    assert.equal(await nav.getByRole("link").count(), 5);
    assert.equal(await page.getByRole("navigation", { name: "Hustle main navigation" }).isVisible(), false);
    assert.equal(await page.getByRole("heading", { name: "Explore", exact: true }).isVisible(), true);
    const cream = await page.locator("main").evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(cream, "rgb(247, 246, 242)", "Explore must use cream utility background");
    await page.goto(root + "/home", { waitUntil: "domcontentloaded" });
    const wordmark = page.locator('[class*="appWordmark"]');
    assert.equal(await wordmark.isVisible(), true, "installed feed must show the Figma wordmark");
    const dark = await page.locator("main").evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(dark, "rgb(18, 23, 20)", "Home must use dark immersive native background");
    console.log("PASS: live Next.js manifest/icons, standalone five-tab iPhone shell, cream Explore and dark Figma feed.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
