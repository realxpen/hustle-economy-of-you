#!/usr/bin/env node
/**
 * Opt-in staging-only, READ-ONLY authenticated browser acceptance.
 * Uses owner-provisioned throwaway test sessions; NEVER generates fake login,
 * submits bookings, visits checkout, initiates payments or records session data.
 *
 * No signed-in PASS without two genuine staging account states and a published
 * service. This is a browser acceptance subset, not a production go-live gate.
 */
const fs = require("node:fs");
const { prepare } = require("./staging-acceptance-policy.cjs");

async function run() {
  const config = prepare(process.env);
  // Import AFTER environment and storageState checks, so misconfiguration
  // can never trigger browser/network access.
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const checked = [];
  let client, hustler;
  const viewport = { width: 390, height: 844 };
  async function visit(page, pathname) {
    const url = new URL(pathname, config.origin).toString();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response || response.status() >= 400) throw Error("Unexpected HTTP response for " + pathname);
    const current = new URL(page.url());
    if (current.origin !== config.origin || current.pathname !== pathname) {
      throw Error("Unexpected redirect or sign-in for " + pathname);
    }
    return response;
  }
  async function verifyAccount(context, label, handle, hustlerRequired) {
    const page = await context.newPage();
    try {
      await visit(page, "/account");
      await page.locator("#account-name").waitFor({ timeout: 20000 });
      const profile = page.locator('[aria-labelledby="account-name"]');
      await profile.getByText("@" + handle, { exact: true }).waitFor({ timeout: 8000 });
      await page.getByRole("region", { name: "Your Hustle capabilities" }).waitFor({ timeout: 10000 })
        .catch(async () => {
          // The page's <section aria-label> is a generic region in some renderers.
          await page.locator('[aria-label="Your Hustle capabilities"]').waitFor();
        });
      const capability = page.locator('[aria-label="Your Hustle capabilities"]');
      await capability.getByText("CLIENT", { exact: true }).waitFor();
      if (hustlerRequired) {
        await capability.getByText("HUSTLER", { exact: true }).waitFor();
        const pill = capability.getByText("HUSTLER", { exact: true }).locator("..");
        if (!(await pill.innerText()).includes("ACTIVE")) throw Error("Hustler capability is not ACTIVE");
        await page.getByRole("heading", { name: "Your Hustler studio" }).waitFor();
      }
      checked.push(label + ": authenticated account, expected username and capability displayed");
    } finally { await page.close(); }
  }
  try {
    client = await browser.newContext({ storageState: config.clientState, viewport, reducedMotion: "reduce" });
    hustler = await browser.newContext({ storageState: config.hustlerState, viewport, reducedMotion: "reduce" });
    await verifyAccount(client, "Client", config.clientHandle, false);
    await verifyAccount(hustler, "Hustler", config.hustlerHandle, true);

    // Existing published staging Service: real Web + real backend GET. Nothing mocked.
    const page = await client.newPage();
    try {
      await visit(page, "/services/" + config.serviceId);
      await page.locator("main h1").first().waitFor({ timeout: 20000 });
      await page.getByRole("link", { name: /Book this service/ }).waitFor();
      const consult = page.getByRole("link", { name: /Message first/ });
      const messageHref = await consult.getAttribute("href");
      const message = new URL(messageHref, config.origin);
      if (message.pathname !== "/messages/start" ||
          message.searchParams.get("contextType") !== "SERVICE" ||
          message.searchParams.get("contextId") !== config.serviceId ||
          !message.searchParams.get("userId")) {
        throw Error("Consultation does not retain this Service and recipient");
      }
      checked.push("Client: genuine published Service page and consultation context are reachable");

      await page.getByRole("link", { name: /Book this service/ }).click();
      await page.waitForURL("**/bookings/new/" + config.serviceId, { timeout: 20000 });
      await page.locator("#start").waitFor({ timeout: 20000 });
      await page.locator("#requirements").waitFor();
      const button = page.getByRole("button", { name: /Submit booking request/ });
      if (!(await button.isDisabled())) throw Error("Empty booking description must block submission");
      checked.push("Client: original Service opens validated Booking form without a write");

      const overflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      if (overflow > 3) throw Error("Booking form overflows mobile viewport");
      checked.push("Client: mobile viewport has no horizontal overflow");
    } finally { await page.close(); }

    // Verify existing booking management can be read by both contexts.
    for (const [role, context] of [["Client", client], ["Hustler", hustler]]) {
      const page = await context.newPage();
      try {
        await visit(page, "/bookings");
        await page.getByRole("heading", { name: "Work, clearly scheduled." }).waitFor({ timeout: 15000 });
        await page.getByRole("heading", { name: "Your bookings" }).waitFor();
        await page.getByRole("heading", { name: "Requests for your services" }).waitFor();
        checked.push(role + ": Booking Manager accessible without account switching");
      } finally { await page.close(); }
    }

    const report = {
      result: "PASS",
      scope: "Two genuine staging sessions, real published Service and read-only authenticated Web interactions",
      checks: checked,
      limitations: "No real signup confirmation, message send, Booking submission, payment, iOS Safari, Android or launch verification"
    };
    const json = JSON.stringify(report, null, 2);
    if (process.env.HUSTLE_QA_REPORT_PATH) {
      const target = require("node:path").resolve(process.env.HUSTLE_QA_REPORT_PATH);
      const root = fs.realpathSync(process.cwd());
      if (target.startsWith(root + require("node:path").sep) || target === root) {
        throw Error("REFUSED: QA report must remain outside source checkout");
      }
      // Exclusive creation avoids overwriting an old report with unsafe file mode.
      fs.writeFileSync(target, json + "\n", { mode: 0o600, flag: "wx" });
    }
    console.log(json);
  } finally {
    await client?.close();
    await hustler?.close();
    await browser.close();
  }
}

run().catch(() => {
  // No error stacks, selectors, usernames, IDs, session paths or provider
  // output may escape from the opted-in real-session QA process.
  console.error("INCOMPLETE staging authenticated acceptance; inspect the test accounts and staging environment locally.");
  process.exitCode = 2;
});
