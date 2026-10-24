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
    // Chromium's CDP Emulation.setEmulatedMedia does not reliably emulate
    // display-mode: standalone. Verify real DOM/routes here, and verify
    // installed-only CSS at source level (with iPhone Safari as final gate).
    await page.goto(root + "/search", { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Hustle mobile application", includeHidden: true });
    assert.equal(await nav.count(), 1, "five-tab native dock must be in the render tree");
    assert.equal(await nav.isVisible(), false, "regular Safari/browser navigation must not be replaced");
    for (const name of ["Home", "Explore", "Create", "Inbox", "You"]) {
      assert.equal(await nav.getByRole("link", { name, includeHidden: true }).count(), 1, "missing " + name);
    }
    assert.equal(await nav.getByRole("link", { includeHidden: true }).count(), 5);
    assert.equal(await page.getByRole("navigation", { name: "Hustle main navigation" }).isVisible(), true);
    assert.equal(await page.locator('[class*="pwaExploreTitle"]').count(), 1);
    await page.goto(root + "/home", { waitUntil: "domcontentloaded" });
    const wordmark = page.locator('[class*="appWordmark"]');
    assert.equal(await wordmark.count(), 1, "Figma wordmark must be available in installed mode");
    console.log("PASS: live Next.js manifest/icons, native five-tab DOM and Figma home/search structure (installed iPhone CSS validated by source contract, NOT Chromium emulation).");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
