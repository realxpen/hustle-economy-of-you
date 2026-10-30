import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { assertHostedTestCheckoutEnvironment, assertHostedTestManifest } from "./hosted-test-checkout-guard.mjs";

// MUST execute before Nest, Prisma, HTTP or filesystem effects.
const phase = assertHostedTestCheckoutEnvironment(process.env);
const manifestPath = process.env.HUSTLE_TEST_MANIFEST_PATH;
if (!manifestPath || !manifestPath.startsWith(process.env.RUNNER_TEMP + "/") ||
    !/^\/[A-Za-z0-9/_-]+\.json$/.test(manifestPath)) {
  throw new Error("REFUSED: manifest path outside ephemeral runner directory");
}
if (phase === "PREPARE" && !process.env.GITHUB_STEP_SUMMARY) {
  throw new Error("REFUSED: checkout links may only be disclosed in a GitHub Actions job summary");
}

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

class HostedCheckoutTestModule {}
Module({ imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule,
  AnalyticsModule, FeedModule, SearchModule, BookingModule, MessagingModule]
})(HostedCheckoutTestModule);

let app;
try {
  app = await NestFactory.create(HostedCheckoutTestModule, { logger: ["error"], rawBody: true });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const payments = app.get(PaymentService);
  const bookings = app.get(BookingService);
  const wallet = app.get(WalletService);
  const gateway = app.get(PAYMENT_GATEWAY);
  assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
  assert.equal(gateway.constructor.name, "PaystackTestGateway");

  if (phase === "PREPARE") {
    const testId = randomUUID();
    const buyerSubject = "hosted-test-buyer-" + testId;
    const sellerSubject = "hosted-test-seller-" + testId;
    const identity = { subject: buyerSubject, emailVerified: true, phoneVerified: false };
    const sellerIdentity = { subject: sellerSubject, emailVerified: false, phoneVerified: false };
    const buyer = await prisma.user.create({
      data: { authSubject: buyerSubject, displayName: "Disposable Hosted Test Buyer",
        email: `hustle-test-${testId.slice(0, 12)}@example.com`, emailVerified: true }
    });
    const seller = await prisma.user.create({
      data: { authSubject: sellerSubject, displayName: "Disposable Hosted Test Seller",
        capabilities: { create: [{ capability: "HUSTLER", status: "ACTIVE" }] } }
    });
    const profile = await prisma.professionalProfile.create({
      data: { userId: seller.id, status: "PUBLISHED", headline: "Disposable hosted checkout fixture" }
    });
    const product = await prisma.product.create({ data: {
      professionalProfileId: profile.id, title: "Disposable Hosted Checkout Product",
      status: "PUBLISHED", type: "PHYSICAL", priceMinor: 10000,
      currency: "NGN", trackInventory: true, inventoryQuantity: 2
    } });
    const service = await prisma.service.create({ data: {
      professionalProfileId: profile.id, title: "Disposable Hosted Checkout Service",
      status: "PUBLISHED", pricingType: "FIXED", priceMinor: 10000,
      currency: "NGN", bookingMode: "WORK_QUEUE", publishedAt: new Date()
    } });
    await commerce.addCartItem(identity, { productId: product.id, quantity: 1 });
    const checkout = await commerce.checkout(identity, {
      deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
      deliveryAddress: "Disposable test only", deliveryCity: "Local", deliveryCountry: "Nigeria"
    });
    assert.equal(checkout.orders.length, 1);
    const orderId = checkout.orders[0].id;
    const booking = await bookings.create(identity, {
      serviceId: service.id, requirements: "Disposable test only; no actual service",
      requestedStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString()
    });
    assert.equal(booking.status, "REQUESTED");
    const accepted = await bookings.accept(sellerIdentity, booking.id, {});
    assert.equal(accepted.status, "PAYMENT_PENDING");
    const orderAttempt = await payments.initialize(identity,
      { subjectType: "ORDER", subjectId: orderId }, "hosted-order-" + testId);
    const bookingAttempt = await payments.initialize(identity,
      { subjectType: "BOOKING", subjectId: booking.id }, "hosted-booking-" + testId);
    for (const attempt of [orderAttempt, bookingAttempt]) {
      assert.equal(attempt.provider, "PAYSTACK_TEST");
      assert.equal(attempt.status, "PENDING");
      assert.equal(attempt.amountMinor, 10000);
      const checkoutUrl = new URL(attempt.checkoutUrl);
      assert.equal(checkoutUrl.protocol, "https:");
      assert.equal(checkoutUrl.hostname, "checkout.paystack.com");
    }
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");
    assert.equal(await prisma.escrowRecord.count(), 0);
    assert.equal(await prisma.ledgerTransaction.count(), 0);

    const manifest = assertHostedTestManifest({
      version: 1, testId, buyerSubject, sellerSubject, orderId,
      bookingId: booking.id, orderAttemptId: orderAttempt.id,
      bookingAttemptId: bookingAttempt.id, productId: product.id,
      amountMinor: 10000, currency: "NGN"
    });
    writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
    // Checkout links are test-only capabilities and WILL be readable to anyone
    // who can view the public repository's Actions run. Never display a real
    // person's information, an actual card, or a private key on this page.
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Hustle UX040 — Two disposable Paystack TEST checkouts\n\n` +
      `These are **test-only checkout links**; anyone who can view this Actions summary may be able to open them. Never use your real card or personal data.\n\n` +
      `- **Order test (₦100)**: [Open Paystack test checkout](${orderAttempt.checkoutUrl})\n` +
      `- **Booking test (₦100)**: [Open Paystack test checkout](${bookingAttempt.checkoutUrl})\n\n` +
      `Use only the official Paystack success test card. Then start a **new** run of this workflow with phase \`VERIFY\` and Source Run ID **${process.env.GITHUB_RUN_ID}**. The original disposable database is preserved as a one-day synthetic-fixture artifact. Neither link contains production data.\n\n` +
      `**Do not share these links or enter actual payment credentials.** This preparation is not evidence of completed payment or webhook delivery.\n`);
    console.log("PASS: actual test checkout links prepared for disposable Order + Booking.");
    console.log("Open links only from the GitHub Actions summary; never paste secrets or real cards.");
    console.log("Source run ID: " + process.env.GITHUB_RUN_ID);
  } else {
    const fixture = assertHostedTestManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
    const buyerIdentity = { subject: fixture.buyerSubject, emailVerified: true, phoneVerified: false };
    const sellerIdentity = { subject: fixture.sellerSubject, emailVerified: false, phoneVerified: false };
    const [orderAttempt, bookingAttempt] = await Promise.all([
      prisma.paymentAttempt.findUniqueOrThrow({ where: { id: fixture.orderAttemptId } }),
      prisma.paymentAttempt.findUniqueOrThrow({ where: { id: fixture.bookingAttemptId } })
    ]);
    for (const [attempt, subjectType, subjectId] of [
      [orderAttempt, "ORDER", fixture.orderId],
      [bookingAttempt, "BOOKING", fixture.bookingId]
    ]) {
      assert.equal(attempt.subjectType, subjectType);
      assert.equal(attempt.subjectId, subjectId);
      assert.equal(attempt.provider, "PAYSTACK_TEST");
      assert.equal(attempt.status, "PENDING");
      assert.equal(attempt.amountMinor, fixture.amountMinor);
      assert.equal(attempt.currency, fixture.currency);
      assert.equal(attempt.providerReference, "hustle-" + attempt.id);
      assert.equal(attempt.domainAppliedAt, null);
    }
    // Verify with the provider first. A cancelled/unfinished checkout is a
    // failed test, NOT a fallback to a fabricated paid status.
    const evidence = [];
    for (const attempt of [orderAttempt, bookingAttempt]) {
      const realEvidence = await gateway.verifyReference(attempt.providerReference);
      if (!realEvidence || realEvidence.type !== "payment.succeeded" ||
          realEvidence.providerReference !== attempt.providerReference ||
          realEvidence.amountMinor !== fixture.amountMinor ||
          realEvidence.currency !== "NGN") {
        throw new Error("TEST_CHECKOUT_NOT_SUCCESSFUL: complete both Paystack TEST checkouts, then rerun VERIFY; no money state changed");
      }
      evidence.push(realEvidence);
    }
    const orderVerified = await payments.confirmPendingFromProvider(buyerIdentity, orderAttempt.id);
    const bookingVerified = await payments.confirmPendingFromProvider(buyerIdentity, bookingAttempt.id);
    assert.equal(orderVerified.status, "SUCCEEDED");
    assert.equal(orderVerified.appliedToSubject, true);
    assert.equal(bookingVerified.status, "SUCCEEDED");
    assert.equal(bookingVerified.appliedToSubject, true);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } })).status, "PAID");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } })).inventoryQuantity, 1);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingId } })).status, "FUNDED");
    assert.equal(await prisma.ledgerTransaction.count({
      where: { paymentAttemptId: { in: [orderAttempt.id, bookingAttempt.id] }, type: "PAYMENT_CONFIRMED" }
    }), 2);
    const held = await prisma.escrowRecord.findUniqueOrThrow({
      where: { subjectType_subjectId: { subjectType: "BOOKING", subjectId: fixture.bookingId } }
    });
    assert.equal(held.status, "HELD");
    assert.equal(held.amountMinor, 10000);
    await assert.rejects(
      () => wallet.releaseBookingEscrow(buyerIdentity, fixture.bookingId),
      /cannot be released from FUNDED/
    );
    await bookings.start(sellerIdentity, fixture.bookingId);
    await bookings.complete(sellerIdentity, fixture.bookingId);
    const released = await wallet.releaseBookingEscrow(buyerIdentity, fixture.bookingId);
    assert.equal(released.released, true);
    const duplicateRelease = await wallet.releaseBookingEscrow(buyerIdentity, fixture.bookingId);
    assert.equal(duplicateRelease.duplicate, true);

    // Local synthetic signed-webhook replay, independently checked against
    // Paystack's REAL verify API. This is not a genuine provider delivery.
    const original = evidence[0];
    const transactionId = Number(original.eventId.slice("verify.success:".length));
    assert.ok(Number.isSafeInteger(transactionId));
    const eventRaw = JSON.stringify({ event: "charge.success", data: {
      id: transactionId, reference: orderAttempt.providerReference,
      domain: "test", status: "success", amount: 10000, currency: "NGN"
    } });
    const signature = createHmac("sha512", process.env.PAYSTACK_TEST_SECRET_KEY)
      .update(eventRaw).digest("hex");
    const port = app.getHttpServer().address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/payments/webhooks/paystack`, {
      method: "POST", headers: {
        "content-type": "application/json",
        "x-paystack-signature": signature
      }, body: eventRaw
    });
    assert.equal(response.status, 200, "locally signed retry of real provider transaction must be acknowledged");
    assert.equal(await prisma.ledgerTransaction.count({
      where: { paymentAttemptId: { in: [orderAttempt.id, bookingAttempt.id] }, type: "PAYMENT_CONFIRMED" }
    }), 2, "late webhook cannot double-capture");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } })).inventoryQuantity, 1);
    assert.equal((await prisma.escrowRecord.findUniqueOrThrow({
      where: { subjectType_subjectId: { subjectType: "BOOKING", subjectId: fixture.bookingId } }
    })).status, "RELEASED");
    assert.equal(await prisma.ledgerTransaction.count({
      where: { subjectType: "BOOKING", subjectId: fixture.bookingId, type: "ESCROW_RELEASED" }
    }), 1);

    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Hustle UX040 — TEST checkout verified\n\n` +
      `Both Paystack-hosted test checkouts were independently verified via Paystack's actual API. The disposable Order reached PAID, inventory decreased once, Booking reached FUNDED, escrow was held and released exactly once, and a **locally synthesized, signed webhook replay** did not double apply.\n\n` +
      `**Not yet demonstrated:** Paystack itself delivering a webhook to a publicly hosted Hustle API or any production payment.\n`);
    console.log("PASS: both real Paystack TEST hosted checkouts independently verified and applied to actual Order/Booking/ledger.");
    console.log("PASS: held/released Booking escrow and signed LOCAL webhook replay, with no duplicate capture or inventory change.");
    console.log("No production database, public webhook endpoint or real money.");
  }
} finally {
  await app?.close();
}
