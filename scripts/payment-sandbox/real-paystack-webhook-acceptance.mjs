import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createTestWebhookReceiver } from "./real-paystack-webhook-receiver.mjs";
import { assertRealPaystackWebhookEnvironment } from "./real-paystack-webhook-guard.mjs";

// Must fail before importing Nest, opening DB, contacting Paystack or publishing.
assertRealPaystackWebhookEnvironment(process.env);
if (!process.env.GITHUB_STEP_SUMMARY) throw new Error("REFUSED: GitHub summary unavailable");
const require = createRequire(import.meta.url);
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { DatabaseModule } = require("../../apps/api/dist/database/database.module.js");
const { PaymentModule } = require("../../apps/api/dist/payment/payment.module.js");
const { LiveModule } = require("../../apps/api/dist/live/live.module.js");
const { AnalyticsModule } = require("../../apps/api/dist/analytics/analytics.module.js");
const { FeedModule } = require("../../apps/api/dist/feed/feed.module.js");
const { SearchModule } = require("../../apps/api/dist/search/search.module.js");
const { BookingModule } = require("../../apps/api/dist/booking/booking.module.js");
const { MessagingModule } = require("../../apps/api/dist/messaging/messaging.module.js");
const { TrustModule } = require("../../apps/api/dist/trust/trust.module.js");
const { PrismaService } = require("../../apps/api/dist/database/prisma.service.js");
const { CommerceService } = require("../../apps/api/dist/commerce/commerce.service.js");
const { PaymentService } = require("../../apps/api/dist/payment/payment.service.js");
const { BookingService } = require("../../apps/api/dist/booking/booking.service.js");
const { WalletService } = require("../../apps/api/dist/payment/wallet.service.js");
const { PAYMENT_GATEWAY } = require("../../apps/api/dist/payment/payment-gateway.port.js");

class IsolatedWebhookTestModule {}
Module({ imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule,
  AnalyticsModule, FeedModule, SearchModule, BookingModule, MessagingModule] })(IsolatedWebhookTestModule);

let app, receiver, tunnel;
try {
  app = await NestFactory.create(IsolatedWebhookTestModule, { logger: ["error"], rawBody: true });
  await app.init();
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const payments = app.get(PaymentService);
  const bookings = app.get(BookingService);
  const wallet = app.get(WalletService);
  assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
  assert.equal(app.get(PAYMENT_GATEWAY).constructor.name, "PaystackTestGateway");

  const id = randomUUID();
  const buyerSubject = "webhook-test-buyer-" + id;
  const sellerSubject = "webhook-test-seller-" + id;
  const buyerIdentity = { subject: buyerSubject, emailVerified: true, phoneVerified: false };
  const sellerIdentity = { subject: sellerSubject, emailVerified: false, phoneVerified: false };
  const user = await prisma.user.create({ data: {
    authSubject: buyerSubject, displayName: "Disposable Webhook Test Buyer",
    email: `webhook-test-${id.slice(0, 12)}@example.com`, emailVerified: true
  } });
  const seller = await prisma.user.create({ data: {
    authSubject: sellerSubject, displayName: "Disposable Webhook Test Seller",
    capabilities: { create: [{ capability: "HUSTLER", status: "ACTIVE" }] }
  } });
  const profile = await prisma.professionalProfile.create({ data: {
    userId: seller.id, headline: "Disposable provider webhooks", status: "PUBLISHED"
  } });
  const product = await prisma.product.create({ data: {
    professionalProfileId: profile.id, title: "Webhook test product", type: "PHYSICAL",
    status: "PUBLISHED", priceMinor: 10000, currency: "NGN",
    trackInventory: true, inventoryQuantity: 2
  } });
  const service = await prisma.service.create({ data: {
    professionalProfileId: profile.id, title: "Webhook test service", status: "PUBLISHED",
    pricingType: "FIXED", priceMinor: 10000, currency: "NGN",
    bookingMode: "WORK_QUEUE", publishedAt: new Date()
  } });
  await commerce.addCartItem(buyerIdentity, { productId: product.id, quantity: 1 });
  const checkout = await commerce.checkout(buyerIdentity, {
    deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
    deliveryAddress: "Disposable local only", deliveryCity: "Test", deliveryCountry: "Nigeria"
  });
  assert.equal(checkout.orders.length, 1);
  const orderId = checkout.orders[0].id;
  const booking = await bookings.create(buyerIdentity, {
    serviceId: service.id, requirements: "Synthetic test; not a real service",
    requestedStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString()
  });
  assert.equal((await bookings.accept(sellerIdentity, booking.id, {})).status, "PAYMENT_PENDING");
  const orderAttempt = await payments.initialize(
    buyerIdentity, { subjectType: "ORDER", subjectId: orderId }, "actual-webhook-order-" + id
  );
  const bookingAttempt = await payments.initialize(
    buyerIdentity, { subjectType: "BOOKING", subjectId: booking.id }, "actual-webhook-booking-" + id
  );
  const expectedReferences = new Map([
    [orderAttempt.providerReference, 10000], [bookingAttempt.providerReference, 10000]
  ]);
  for (const attempt of [orderAttempt, bookingAttempt]) {
    assert.equal(attempt.provider, "PAYSTACK_TEST");
    assert.equal(attempt.amountMinor, 10000);
    assert.equal(attempt.status, "PENDING");
    assert.equal(new URL(attempt.checkoutUrl).hostname, "checkout.paystack.com");
  }
  assert.equal(await prisma.ledgerTransaction.count(), 0);
  assert.equal(await prisma.escrowRecord.count(), 0);

  const path = "/paystack/test/" + randomBytes(16).toString("hex");
  receiver = createTestWebhookReceiver({
    secretKey: process.env.PAYSTACK_TEST_SECRET_KEY,
    path,
    expectedReferences,
    onVerified: (payload, signature, rawBody) =>
      payments.handleVerifiedWebhook(payload, signature, rawBody),
    onEvent: event => {
      // Never print signed payload, keys, email, account/card or webhook body.
      if (event.type === "verified") console.log("Verified real signed Paystack webhook receipts: " + event.receipts + "/2");
      else console.log("Webhook safety gate: " + event.type);
    }
  });
  receiver.server.listen(44831, "127.0.0.1");
  await once(receiver.server, "listening");

  // A quick tunnel is intentionally temporary, unprivileged, and bound only
  // to the dedicated webhook handler. Entire Nest API is NOT exposed.
  const tunnelLogs = [];
  tunnel = spawn("docker", ["run", "--rm", "--network", "host",
    "cloudflare/cloudflared:2026.10.7", "tunnel", "--no-autoupdate",
    "--url", "http://127.0.0.1:44831"], { stdio: ["ignore", "pipe", "pipe"] });
  let tunnelExited = false;
  tunnel.on("exit", () => { tunnelExited = true; });
  const hostnamePattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/;
  let tunnelUrl;
  const capture = chunk => {
    const piece = String(chunk).slice(0, 4096);
    tunnelLogs.push(piece);
    if (tunnelLogs.length > 80) tunnelLogs.shift();
    const text = tunnelLogs.join("");
    const match = text.match(hostnamePattern);
    if (match) tunnelUrl = match[0];
  };
  tunnel.stdout.on("data", capture);
  tunnel.stderr.on("data", capture);
  const tunnelDeadline = Date.now() + 120_000;
  while (!tunnelUrl && !tunnelExited && Date.now() < tunnelDeadline) {
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  if (!tunnelUrl) throw new Error("Temporary public webhook tunnel failed to initialize");
  // Cloudflare tunnel URL + 32-byte opaque path. The path can be public; HMAC
  // and the allowlisted Paystack IP are the actual security boundaries.
  const webhookUrl = tunnelUrl + path;
  console.log("UX041 TEMPORARY TEST WEBHOOK URL: " + webhookUrl);
  console.log("ORDER TEST CHECKOUT: " + orderAttempt.checkoutUrl);
  console.log("BOOKING TEST CHECKOUT: " + bookingAttempt.checkoutUrl);
  console.log("ACTION REQUIRED DURING THIS RUN:");
  console.log("1. Set Paystack TEST dashboard webhook URL to the TEMPORARY TEST WEBHOOK URL printed above.");
  console.log("2. Complete both checkouts using ONLY Paystack's official test card.");
  console.log("3. Restore your previous TEST dashboard webhook URL afterwards. Live dashboard must never be edited.");
  console.log("This run ends automatically when BOTH genuine signed test webhook events arrive, or on timeout.");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## UX041 — Temporary Paystack TEST webhook receiver\n\n` +
    `The tunnel exposes **only a restricted, HMAC-protected webhook endpoint**; no Hustle app, auth, production data or database is public.\n\n` +
    `1. In Paystack **TEST** dashboard → Developers → Webhooks, set the **test** URL to: \`${webhookUrl}\`\n` +
    `2. [Order checkout, ₦100 TEST](${orderAttempt.checkoutUrl})\n` +
    `3. [Booking checkout, ₦100 TEST](${bookingAttempt.checkoutUrl})\n` +
    `4. **Restore your previous TEST webhook URL** after this run. No live card or personal data.\n\n` +
    `The URL is temporary, visible in run logs, and vanishes when this job ends. Open live step logs while the test is running; GitHub may not show the completed summary until the run finishes.\n\n`);

  const deadline = Date.now() + 30 * 60_000;
  while (receiver.receipts.size !== 2 && !tunnelExited && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (receiver.receipts.size !== 2) {
    throw new Error("REAL_TEST_WEBHOOK_NOT_DELIVERED: two provider-signed events not accepted before temporary tunnel ended");
  }

  // This is payment confirmation via actual incoming provider webhooks, not a
  // browser callback or manually invoked buyer verification.
  const [orderPaid, bookingFunded] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
    prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
  ]);
  assert.equal(orderPaid.status, "PAID");
  assert.equal(bookingFunded.status, "FUNDED");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 1);
  assert.equal(await prisma.ledgerTransaction.count({
    where: { paymentAttemptId: { in: [orderAttempt.id, bookingAttempt.id] }, type: "PAYMENT_CONFIRMED" }
  }), 2);
  assert.equal(await prisma.webhookEvent.count({ where: {
    provider: "PAYSTACK_TEST", eventType: "payment.succeeded", status: "PROCESSED",
    paymentAttemptId: { in: [orderAttempt.id, bookingAttempt.id] }
  } }), 2);
  const escrow = await prisma.escrowRecord.findUniqueOrThrow({ where: {
    subjectType_subjectId: { subjectType: "BOOKING", subjectId: booking.id }
  } });
  assert.equal(escrow.status, "HELD");
  assert.equal(escrow.amountMinor, 10000);
  await assert.rejects(() => wallet.releaseBookingEscrow(buyerIdentity, booking.id), /cannot be released from FUNDED/);
  await bookings.start(sellerIdentity, booking.id);
  await bookings.complete(sellerIdentity, booking.id);
  assert.equal((await wallet.releaseBookingEscrow(buyerIdentity, booking.id)).released, true);
  assert.equal((await wallet.releaseBookingEscrow(buyerIdentity, booking.id)).duplicate, true);
  assert.equal(await prisma.ledgerTransaction.count({
    where: { subjectType: "BOOKING", subjectId: booking.id, type: "ESCROW_RELEASED" }
  }), 1);
  console.log("PASS: TWO REAL PAYSTACK TEST webhooks delivered through temporary public HTTPS tunnel, signed and independently provider-verified.");
  console.log("PASS: Order PAID, Product inventory once, Booking FUNDED, escrow HELD and RELEASED once; exactly two initial ledger captures.");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Verified successfully\n\nBoth real Paystack **test-mode webhook deliveries** passed the signed raw-byte check, Paystack source IP check, actual Paystack private verification and the full disposable Order/Booking/ledger/escrow transitions. No production or live funds. Restore the previous Paystack TEST webhook URL if you have not already.\n`);
} finally {
  if (tunnel && !tunnel.killed) tunnel.kill("SIGTERM");
  if (receiver?.server.listening) await new Promise(resolve => receiver.server.close(resolve));
  await app?.close();
}
