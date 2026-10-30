import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const uri = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
    uri.hostname !== "127.0.0.1" || uri.port !== "55439" ||
    uri.pathname !== "/hustle_payment_sandbox" || uri.username !== "postgres" ||
    process.env.HUSTLE_PAYMENT_GATEWAY !== "paystack-test") {
  throw new Error("REFUSED: Paystack DB acceptance requires disposable local sandbox and test gateway");
}

// Fake provider credentials and HTTP responses, actual Nest services and PostgreSQL.
// No live Paystack account, real-money transaction, remote database, or outbound API is used.
process.env.PAYSTACK_TEST_SECRET_KEY = "sk_test_DISPOSABLECIONLY";
process.env.PAYSTACK_TEST_RETURN_ORIGIN = "https://hustle.example";

const realFetch = globalThis.fetch;
let reference = "";
let verifiedAmount = 250000;
let verifyStatus = "success";
let transactionId = 37829872;
let initializeCount = 0;
let verifyCount = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url === "https://api.paystack.co/transaction/initialize") {
    initializeCount++;
    const request = JSON.parse(init.body);
    assert.equal(request.email, "buyer@example.test");
    assert.equal(request.amount, 250000);
    assert.equal(request.currency, "NGN");
    assert.match(request.reference, /^hustle-/);
    assert.match(request.callback_url, /^https:\/\/hustle\.example\/(orders|bookings)\//);
    reference = request.reference;
    return new Response(JSON.stringify({ status: true, data: {
      authorization_url: "https://checkout.paystack.com/disposable-only",
      reference, access_code: "disposable-only"
    }}), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.startsWith("https://api.paystack.co/transaction/verify/")) {
    verifyCount++;
    assert.equal(decodeURIComponent(url.split("/").at(-1)), reference);
    return new Response(JSON.stringify({ status: true, data: {
      id: transactionId, reference, domain: "test", status: verifyStatus,
      amount: verifiedAmount, currency: "NGN"
    }}), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.startsWith("http://127.0.0.1:")) return realFetch(input, init);
  throw new Error("REFUSED: unexpected external HTTP access from offline payment acceptance");
};

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
class TestModule {}
Module({ imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule, AnalyticsModule,
  FeedModule, SearchModule, BookingModule, MessagingModule] })(TestModule);

let app;
try {
  app = await NestFactory.create(TestModule, { logger: ["error"], rawBody: true });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const port = app.getHttpServer().address().port;
  const url = `http://127.0.0.1:${port}/api/v1/payments/webhooks/paystack`;
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const payments = app.get(PaymentService);
  const bookings = app.get(BookingService);
  const wallet = app.get(WalletService);
  assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
  assert.equal(app.get(PAYMENT_GATEWAY).constructor.name, "PaystackTestGateway");

  const testId = randomUUID();
  const buyerSubject = "paystack-buyer-" + testId;
  const sellerSubject = "paystack-seller-" + testId;
  const buyerIdentity = { subject: buyerSubject, emailVerified: true, phoneVerified: false };
  const sellerIdentity = { subject: sellerSubject, emailVerified: false, phoneVerified: false };
  const buyer = await prisma.user.create({
    data: { authSubject: buyerSubject, email: "buyer@example.test",
      emailVerified: true, displayName: "Disposable Paystack Buyer" }
  });
  const seller = await prisma.user.create({
    data: { authSubject: sellerSubject, displayName: "Disposable Paystack Seller",
      capabilities: { create: [{ capability: "HUSTLER", status: "ACTIVE" }] } }
  });
  const profile = await prisma.professionalProfile.create({
    data: { userId: seller.id, status: "PUBLISHED", headline: "Disposable test vendor" }
  });
  const product = await prisma.product.create({ data: {
    professionalProfileId: profile.id, title: "Disposable Paystack Product",
    status: "PUBLISHED", type: "PHYSICAL", priceMinor: 250000,
    currency: "NGN", trackInventory: true, inventoryQuantity: 3
  } });

  await commerce.addCartItem(buyerIdentity, { productId: product.id, quantity: 1 });
  const checkout = await commerce.checkout(buyerIdentity, {
    deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
    deliveryAddress: "Local sandbox only", deliveryCity: "Test City", deliveryCountry: "Nigeria"
  });
  assert.equal(checkout.orders.length, 1);
  const orderId = checkout.orders[0].id;
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");
  const attempt = await payments.initialize(buyerIdentity, { subjectType: "ORDER", subjectId: orderId }, "paystack-test-" + testId);
  assert.equal(attempt.provider, "PAYSTACK_TEST");
  assert.equal(attempt.status, "PENDING");
  assert.equal(attempt.amountMinor, 250000);
  assert.equal(attempt.checkoutUrl, "https://checkout.paystack.com/disposable-only");
  assert.equal((await payments.initialize(buyerIdentity, { subjectType: "ORDER", subjectId: orderId }, "paystack-test-" + testId)).id, attempt.id);
  assert.equal(initializeCount, 1, "Idempotency must not create another Paystack charge");

  const event = { event: "charge.success", data: {
    id: 37829872, reference, domain: "test", status: "success",
    amount: 250000, currency: "NGN"
  } };
  const raw = JSON.stringify(event);
  const signature = createHmac("sha512", process.env.PAYSTACK_TEST_SECRET_KEY).update(raw).digest("hex");
  async function notify(body, sig) {
    return globalThis.fetch(url, { method: "POST", headers: {
      "content-type": "application/json", "x-paystack-signature": sig
    }, body });
  }
  const badSignature = await notify(raw, "0".repeat(128));
  assert.equal(badSignature.status, 401);
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: attempt.id } }), 0);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");

  verifiedAmount = 250001;
  const alteredVerification = await notify(raw, signature);
  assert.equal(alteredVerification.status, 401, "A signed callback with different provider amount must fail");
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: attempt.id } }), 0);
  verifiedAmount = 250000;
  const unrelatedRaw = JSON.stringify({ event: "transfer.success", data: event.data });
  const unrelatedSignature = createHmac("sha512", process.env.PAYSTACK_TEST_SECRET_KEY).update(unrelatedRaw).digest("hex");
  const unrelated = await notify(unrelatedRaw, unrelatedSignature);
  assert.equal(unrelated.status, 201);
  assert.equal((await unrelated.json()).ignored, true);

  const succeeded = await notify(raw, signature);
  assert.equal(succeeded.status, 201, "Signed and independently verified Paystack test payment must apply");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PAID");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 2);
  assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status, "SUCCEEDED");
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: attempt.id } }), 1);

  const replay = await notify(raw, signature);
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).duplicate, true);
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: attempt.id } }), 1);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 2);
  assert.equal(initializeCount, 1);
  assert.ok(verifyCount >= 3, "All signed payment evidence must be independently verified");

  // Second checkout: a Paystack return can be reconciled without a webhook,
  // but never from query parameters, an unrelated account or non-success status.
  await commerce.addCartItem(buyerIdentity, { productId: product.id, quantity: 1 });
  const checkoutTwo = await commerce.checkout(buyerIdentity, {
    deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
    deliveryAddress: "Local sandbox only", deliveryCity: "Test City", deliveryCountry: "Nigeria"
  });
  const secondOrderId = checkoutTwo.orders[0].id;
  const secondAttempt = await payments.initialize(
    buyerIdentity, { subjectType: "ORDER", subjectId: secondOrderId }, "paystack-verify-" + testId
  );
  assert.equal(initializeCount, 2);
  assert.equal(secondAttempt.status, "PENDING");
  const secondReference = reference;
  const ledgerBefore = await prisma.ledgerTransaction.count({ where: { paymentAttemptId: secondAttempt.id } });

  await assert.rejects(
    () => payments.confirmPendingFromProvider({ subject: sellerSubject, emailVerified: false }, secondAttempt.id),
    /Payment attempt not found/i, "Only the payer can request verification"
  );
  verifyStatus = "pending";
  const pending = await payments.confirmPendingFromProvider(buyerIdentity, secondAttempt.id);
  assert.equal(pending.status, "PENDING");
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: secondOrderId } })).status, "PENDING");
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: secondAttempt.id } }), ledgerBefore);

  verifyStatus = "success";
  transactionId = 37829873;
  verifiedAmount = 250001;
  await assert.rejects(
    () => payments.confirmPendingFromProvider(buyerIdentity, secondAttempt.id),
    /Webhook amount does not match/i, "Provider-confirmed amount must match the persisted Order"
  );
  assert.equal(await prisma.webhookEvent.count({ where: { provider: "PAYSTACK_TEST", eventId: "verify.success:37829873" } }), 0,
    "Mismatched evidence must not poison the durable inbox");

  verifiedAmount = 250000;
  const confirmed = await payments.confirmPendingFromProvider(buyerIdentity, secondAttempt.id);
  assert.equal(confirmed.status, "SUCCEEDED");
  assert.equal(confirmed.appliedToSubject, true);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: secondOrderId } })).status, "PAID");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 1);
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: secondAttempt.id } }), 1);
  const verificationCallsAfterPaid = verifyCount;
  const confirmedAgain = await payments.confirmPendingFromProvider(buyerIdentity, secondAttempt.id);
  assert.equal(confirmedAgain.status, "SUCCEEDED");
  assert.equal(verifyCount, verificationCallsAfterPaid, "Applied payment must not cause repeat external checks");

  const lateEvent = JSON.stringify({ event: "charge.success", data: {
    id: transactionId, reference: secondReference, domain: "test",
    status: "success", amount: 250000, currency: "NGN"
  } });
  const lateSignature = createHmac("sha512", process.env.PAYSTACK_TEST_SECRET_KEY).update(lateEvent).digest("hex");
  const lateWebhook = await notify(lateEvent, lateSignature);
  assert.equal(lateWebhook.status, 201, "A later signed webhook must be safely accepted");
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: secondAttempt.id } }), 1,
    "Callback verification plus webhook may not double-post");
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 1);


  // Service journey: original Booking terms -> provider verified funding -> work
  // -> released test-ledger escrow. This uses the SAME real module/ledger,
  // not another finance mock or a separate UI route.
  const service = await prisma.service.create({
    data: {
      professionalProfileId: profile.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
      title: "Disposable Paid Service",
      priceMinor: 250000,
      currency: "NGN",
      pricingType: "FIXED",
      bookingMode: "WORK_QUEUE"
    }
  });
  const booking = await bookings.create(buyerIdentity, {
    serviceId: service.id,
    requirements: "Disposable paid service integration acceptance",
    requestedStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString()
  });
  assert.equal(booking.status, "REQUESTED");
  await assert.rejects(
    () => payments.initialize(buyerIdentity, { subjectType: "BOOKING", subjectId: booking.id }, "preaccept-" + testId),
    /Booking payment cannot start from REQUESTED/,
    "Buyer cannot fund a Booking before Hustler accepts"
  );
  const accepted = await bookings.accept(sellerIdentity, booking.id, {});
  assert.equal(accepted.status, "PAYMENT_PENDING");
  assert.equal(accepted.agreedPriceMinor, 250000);
  await assert.rejects(
    () => bookings.start(sellerIdentity, booking.id),
    /Payment is still pending/,
    "No paid work before provider-confirmed funding"
  );
  assert.equal(await prisma.escrowRecord.count({ where: { subjectType: "BOOKING", subjectId: booking.id } }), 0);

  const bookingAttempt = await payments.initialize(
    buyerIdentity, { subjectType: "BOOKING", subjectId: booking.id }, "booking-paystack-" + testId
  );
  assert.equal(bookingAttempt.provider, "PAYSTACK_TEST");
  assert.equal(bookingAttempt.status, "PENDING");
  assert.equal(bookingAttempt.amountMinor, 250000);
  assert.equal(initializeCount, 3);
  const bookingReference = reference;
  assert.equal(bookingAttempt.providerReference, bookingReference);
  await assert.rejects(
    () => payments.confirmPendingFromProvider(sellerIdentity, bookingAttempt.id),
    /Payment attempt not found/,
    "Hustler cannot impersonate the buyer during provider verification"
  );
  transactionId = 37829874;
  verifyStatus = "pending";
  const stillWaiting = await payments.confirmPendingFromProvider(buyerIdentity, bookingAttempt.id);
  assert.equal(stillWaiting.status, "PENDING");
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "PAYMENT_PENDING");
  assert.equal(await prisma.escrowRecord.count({ where: { subjectType: "BOOKING", subjectId: booking.id } }), 0);

  verifyStatus = "success";
  verifiedAmount = 250001;
  await assert.rejects(
    () => payments.confirmPendingFromProvider(buyerIdentity, bookingAttempt.id),
    /Webhook amount does not match/,
    "Altered provider amount may not fund a Booking"
  );
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: bookingAttempt.id } }), 0);
  assert.equal(await prisma.escrowRecord.count({ where: { subjectType: "BOOKING", subjectId: booking.id } }), 0);

  verifiedAmount = 250000;
  const bookingFunded = await payments.confirmPendingFromProvider(buyerIdentity, bookingAttempt.id);
  assert.equal(bookingFunded.status, "SUCCEEDED");
  assert.equal(bookingFunded.appliedToSubject, true);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "FUNDED");
  const heldEscrow = await prisma.escrowRecord.findUniqueOrThrow({
    where: { subjectType_subjectId: { subjectType: "BOOKING", subjectId: booking.id } }
  });
  assert.equal(heldEscrow.status, "HELD");
  assert.equal(heldEscrow.amountMinor, 250000);
  assert.equal(heldEscrow.currency, "NGN");
  assert.equal(heldEscrow.paymentAttemptId, bookingAttempt.id);
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: bookingAttempt.id } }), 1);
  const fundingLedger = await prisma.ledgerTransaction.findFirstOrThrow({
    where: { paymentAttemptId: bookingAttempt.id },
    include: { postings: { include: { account: true } } }
  });
  assert.equal(fundingLedger.type, "PAYMENT_CONFIRMED");
  assert.equal(fundingLedger.postings.length, 2);
  assert.equal(fundingLedger.postings.filter(p => p.direction === "CREDIT" && p.account.type === "ESCROW").length, 1);
  assert.equal(fundingLedger.postings.filter(p => p.direction === "DEBIT" && p.account.type === "PROVIDER_CLEARING").length, 1);
  await assert.rejects(
    () => wallet.releaseBookingEscrow(buyerIdentity, booking.id),
    /Booking escrow cannot be released from FUNDED/,
    "Buyer must not release escrow before work completion"
  );
  const workStarted = await bookings.start(sellerIdentity, booking.id);
  assert.equal(workStarted.status, "IN_PROGRESS");
  const workCompleted = await bookings.complete(sellerIdentity, booking.id);
  assert.equal(workCompleted.status, "COMPLETED");
  await assert.rejects(
    () => wallet.releaseBookingEscrow(sellerIdentity, booking.id),
    /Only the Booking client can confirm completion/,
    "Hustler cannot release their own escrow"
  );
  const released = await wallet.releaseBookingEscrow(buyerIdentity, booking.id);
  assert.equal(released.released, true);
  assert.equal(released.duplicate, false);
  const replayRelease = await wallet.releaseBookingEscrow(buyerIdentity, booking.id);
  assert.equal(replayRelease.duplicate, true);
  const escrowAfter = await prisma.escrowRecord.findUniqueOrThrow({
    where: { subjectType_subjectId: { subjectType: "BOOKING", subjectId: booking.id } }
  });
  assert.equal(escrowAfter.status, "RELEASED");
  assert.equal(await prisma.ledgerTransaction.count({
    where: { subjectType: "BOOKING", subjectId: booking.id, type: "ESCROW_RELEASED" }
  }), 1, "Escrow release posts once even when retried");

  // A delayed signed Paystack test webhook after return verification and test
  // ledger release cannot post another capture or re-create HELD escrow.
  const lateBookingEvent = JSON.stringify({ event: "charge.success", data: {
    id: transactionId, reference: bookingReference,
    domain: "test", status: "success", amount: 250000, currency: "NGN"
  } });
  const lateBookingSignature = createHmac("sha512", process.env.PAYSTACK_TEST_SECRET_KEY)
    .update(lateBookingEvent).digest("hex");
  const lateBookingCallback = await notify(lateBookingEvent, lateBookingSignature);
  assert.equal(lateBookingCallback.status, 201);
  assert.equal(await prisma.ledgerTransaction.count({ where: { paymentAttemptId: bookingAttempt.id } }), 1);
  assert.equal((await prisma.escrowRecord.findUniqueOrThrow({
    where: { subjectType_subjectId: { subjectType: "BOOKING", subjectId: booking.id } }
  })).status, "RELEASED");
  assert.equal(await prisma.escrowRecord.count({ where: { subjectType: "BOOKING", subjectId: booking.id } }), 1);
  console.log("PASS: real Nest/Postgres Booking REQUESTED -> PAYMENT_PENDING -> verified test funds -> FUNDED -> completed work -> once-only escrow release; negative and delayed webhook guards.");

  console.log("PASS: webhook-first and buyer-verified return each create one paid Order; pending/mismatched/cross-account/replay safe.");
} finally {
  await app?.close();
  globalThis.fetch = realFetch;
  delete process.env.PAYSTACK_TEST_SECRET_KEY;
  delete process.env.PAYSTACK_TEST_RETURN_ORIGIN;
}
