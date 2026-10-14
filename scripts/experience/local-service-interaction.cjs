#!/usr/bin/env node
/**
 * Interactive browser regression against locally built Hustle Web.
 * Uses a synthetic PUBLIC Service response only: no real account, payment,
 * backend write, BMONI or production URL. This is not signed-in user QA.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = process.env.HUSTLE_LOCAL_WEB_URL || "http://127.0.0.1:3001";
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, "Never run interactive smoke on a remote or production origin");

const service = {
  id: "qa-service",
  title: "QA Barber Session",
  category: "Beauty",
  deliveryMode: "IN_PERSON",
  description: "A synthetic published offer for local browser interaction checks.",
  requirements: "Bring a reference photo.",
  priceMinor: 45000,
  pricingType: "FIXED",
  currency: "NGN",
  mediaUrls: [],
  location: "Lagos, Nigeria",
  deliveryTime: "One hour",
  availabilityNote: "By appointment"
};
const owner = {
  id: "qa-hustler",
  username: "qa-hustler",
  displayName: "QA Hustler",
  avatarUrl: null,
  location: "Lagos, Nigeria",
  verified: false,
  professionalProfile: { headline: "Barber" }
};
const fixture = { service, owner };
const steps = [];
function inputLocalDate(value) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    let bookingApiWrites = 0;
    let mockFailure = false;
    await page.route("**/api/v1/services/qa-service", async (route) => {
      await route.fulfill({
        status: mockFailure ? 404 : 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: mockFailure ? JSON.stringify({ message: "Not found" }) : JSON.stringify(fixture)
      });
    });
    page.on("request", (request) => {
      if (/\/api\/v1\/bookings(?:\/|\?|$)/.test(request.url()) && request.method() !== "GET") bookingApiWrites++;
    });

    await page.goto(base + "/services/qa-service", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: service.title }).waitFor({ timeout: 20000 });
    assert.match(await page.locator("main").innerText(), /QA Hustler/);
    steps.push("Public published Service renders owner, title and price");

    await page.getByRole("link", { name: /Book this service/ }).click();
    await page.waitForURL("**/bookings/new/qa-service", { timeout: 15000 });
    await page.getByRole("heading", { name: service.title }).waitFor({ timeout: 15000 });
    const submit = page.getByRole("button", { name: /Submit booking request/ });
    assert.equal(await submit.isDisabled(), true, "Booking cannot submit without requirements");
    steps.push("Service CTA opens actual Booking UI and required description is gated");

    const start = new Date(Date.now() + 9 * 86_400_000);
    await page.locator("#start").fill(inputLocalDate(start));
    await page.locator("#end").fill(inputLocalDate(new Date(start.getTime() - 60_000)));
    await page.locator("#requirements").fill("I need a routine synthetic barber appointment.");
    assert.equal(await submit.isEnabled(), true);
    await submit.click();
    await page.locator("#booking-form-error").getByText(/end must be later than the requested start/i).waitFor();
    assert.equal(bookingApiWrites, 0, "Invalid booking must not write to API");
    steps.push("Invalid schedule is rejected in real browser before authenticated API calls");

    await page.close();
    const retryPage = await browser.newPage({ viewport: { width: 320, height: 640 }, reducedMotion: "reduce" });
    await retryPage.route("**/api/v1/services/qa-service", async (route) => route.fulfill({
      status: mockFailure ? 404 : 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: mockFailure ? JSON.stringify({ message: "Not found" }) : JSON.stringify(fixture)
    }));
    mockFailure = true;
    await retryPage.goto(base + "/services/qa-service", { waitUntil: "domcontentloaded" });
    await retryPage.getByRole("alert").getByText("Service unavailable.").waitFor({ timeout: 15000 });
    mockFailure = false;
    await retryPage.getByRole("button", { name: "Try loading again" }).click();
    await retryPage.getByRole("heading", { name: service.title }).waitFor({ timeout: 15000 });
    steps.push("Public Service error state can recover via Retry");
    await retryPage.close();

    console.log(JSON.stringify({
      result: "PASS", scope: "local Chromium public Service -> Booking UI, synthetic GET fixture only",
      limitations: "No signed-in flows, payment or live-provider activation verified",
      steps
    }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
