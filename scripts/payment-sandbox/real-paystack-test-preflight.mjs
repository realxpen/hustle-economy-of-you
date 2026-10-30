import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { assertRealPaystackTestPreflight } from "./real-paystack-preflight-guard.mjs";

// IMPORTANT: refuse non-isolated execution before loading Nest, Prisma, or
// making any network request. Never print the test secret or checkout URL.
assertRealPaystackTestPreflight(process.env);

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
const { PAYMENT_GATEWAY } = require("../../apps/api/dist/payment/payment-gateway.port.js");

class RealTestProviderModule {}
Module({
  imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule,
    AnalyticsModule, FeedModule, SearchModule, BookingModule, MessagingModule]
})(RealTestProviderModule);

let app;
try {
  app = await NestFactory.create(RealTestProviderModule, { logger: ["error"], rawBody: true });
  await app.init();

  const db = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const payments = app.get(PaymentService);
  assert.equal((await db.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
  assert.equal(app.get(PAYMENT_GATEWAY).constructor.name, "PaystackTestGateway");

  const id = randomUUID();
  const buyerSubject = "real-test-paystack-buyer-" + id;
  const sellerSubject = "real-test-paystack-seller-" + id;
  const identity = { subject: buyerSubject, emailVerified: true, phoneVerified: false };
  // Synthetic mailbox; not linked to a real user. No invitations or actual mail.
  const email = `hustle-test-${id.slice(0, 12)}@example.com`;
  const buyer = await db.user.create({
    data: { authSubject: buyerSubject, displayName: "Disposable Test Checkout Buyer",
      email, emailVerified: true }
  });
  const seller = await db.user.create({
    data: { authSubject: sellerSubject, displayName: "Disposable Test Checkout Seller",
      capabilities: { create: [{ capability: "HUSTLER", status: "ACTIVE" }] } }
  });
  const profile = await db.professionalProfile.create({
    data: { userId: seller.id, status: "PUBLISHED", headline: "Disposable provider smoke" }
  });
  const product = await db.product.create({
    data: { professionalProfileId: profile.id, title: "Provider initialization smoke",
      status: "PUBLISHED", priceMinor: 10000, currency: "NGN", type: "DIGITAL" }
  });

  await commerce.addCartItem(identity, { productId: product.id, quantity: 1 });
  const checkout = await commerce.checkout(identity, {});
  assert.equal(checkout.orders.length, 1);
  const orderId = checkout.orders[0].id;
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");

  // Actual Paystack TEST HTTPS call, not a mocked response. No payment method
  // submitted; we do not follow the returned checkout link or charge anyone.
  const initialized = await payments.initialize(
    identity, { subjectType: "ORDER", subjectId: orderId }, "provider-smoke-" + id
  );
  assert.equal(initialized.provider, "PAYSTACK_TEST");
  assert.equal(initialized.status, "PENDING");
  assert.equal(initialized.amountMinor, 10000);
  assert.equal(initialized.currency, "NGN");
  assert.ok(initialized.checkoutUrl);
  const url = new URL(initialized.checkoutUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "checkout.paystack.com");
  assert.equal(initialized.providerReference, "hustle-" + initialized.id);
  assert.equal((await payments.initialize(identity, { subjectType: "ORDER", subjectId: orderId },
    "provider-smoke-" + id)).id, initialized.id);

  // The provider verification is a separate real HTTPS request. Since no
  // checkout is completed, even a syntactically valid callback cannot mark
  // this Order paid. If Paystack reports success unexpectedly, FAIL CLOSED.
  const checked = await payments.confirmPendingFromProvider(identity, initialized.id);
  assert.equal(checked.status, "PENDING", "A non-completed real test checkout must remain unpaid");
  assert.equal(checked.appliedToSubject, false);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");
  assert.equal(await db.ledgerTransaction.count({ where: { paymentAttemptId: initialized.id } }), 0);
  assert.equal(await db.escrowRecord.count(), 0);
  console.log("PASS: Paystack test API accepted real initialization and server-side reference check.");
  console.log("PASS: disposable local Order remains PENDING with zero captured funds; no checkout was completed.");
  console.log("No callback URL, account key or checkout URL has been published.");
} finally {
  await app?.close();
}
