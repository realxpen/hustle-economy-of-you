import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Abort before loading the Prisma client or opening any network connection if
// the connection target is not the dedicated disposable local database.
function requireIsolatedDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Sandbox DATABASE_URL must be explicitly set");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.port !== "55439" ||
      url.pathname !== "/hustle_payment_sandbox" ||
      url.username !== "postgres") {
    throw new Error("REFUSED: sandbox tests can only access postgres@127.0.0.1:55439/hustle_payment_sandbox");
  }
  if (!process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET || process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET.length < 32) {
    throw new Error("Set an ephemeral HUSTLE_SANDBOX_WEBHOOK_SECRET (32+ characters)");
  }
}
requireIsolatedDatabase();

const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { DatabaseModule } = require("../../apps/api/dist/database/database.module.js");
const { PaymentModule } = require("../../apps/api/dist/payment/payment.module.js");
const { LiveModule } = require("../../apps/api/dist/live/live.module.js");
const { TrustModule } = require("../../apps/api/dist/trust/trust.module.js");
const { PrismaService } = require("../../apps/api/dist/database/prisma.service.js");
const { CommerceService } = require("../../apps/api/dist/commerce/commerce.service.js");
const { FulfillmentService } = require("../../apps/api/dist/commerce/fulfillment.service.js");
const { PaymentService } = require("../../apps/api/dist/payment/payment.service.js");
const { NotificationsService } = require("../../apps/api/dist/notifications/notifications.service.js");
const { LiveService } = require("../../apps/api/dist/live/live.service.js");
const { ReviewService } = require("../../apps/api/dist/trust/review.service.js");

class SandboxTestModule {}
Module({ imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule] })(SandboxTestModule);

function identity(subject) {
  return { subject, emailVerified: false, phoneVerified: false };
}

async function expectRejected(fn, label) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert.ok(rejected, label);
}

async function main() {
  const app = await NestFactory.create(SandboxTestModule, { logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  const webhookUrl = `http://127.0.0.1:${address.port}/api/v1/payments/webhooks/sandbox`;
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const fulfillment = app.get(FulfillmentService);
  const payments = app.get(PaymentService);
  const notifications = app.get(NotificationsService);
  const live = app.get(LiveService);
  const reviews = app.get(ReviewService);

  try {
    assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
    const testId = randomUUID();
    const buyerSubject = `sandbox-buyer-${testId}`;
    const sellerSubject = `sandbox-seller-${testId}`;
    const by = identity(buyerSubject);
    const se = identity(sellerSubject);

    const buyer = await prisma.user.create({
      data: { authSubject: buyerSubject, displayName: "Disposable Sandbox Buyer" }
    });
    const seller = await prisma.user.create({
      data: {
        authSubject: sellerSubject,
        displayName: "Disposable Sandbox Seller",
        capabilities: { create: [{ capability: "HUSTLER", status: "ACTIVE" }] }
      }
    });
    const profile = await prisma.professionalProfile.create({
      data: { userId: seller.id, status: "PUBLISHED", headline: "Test-only seller" }
    });
    const product = await prisma.product.create({
      data: {
        professionalProfileId: profile.id, title: "Disposable Test Parcel",
        status: "PUBLISHED", type: "PHYSICAL",
        priceMinor: 250000, currency: "NGN", trackInventory: true,
        inventoryQuantity: 3
      }
    });

    await commerce.addCartItem(by, { productId: product.id, quantity: 1 });
    const checkout = await commerce.checkout(by, {
      deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
      deliveryAddress: "Sandbox testing only", deliveryCity: "Local Test",
      deliveryCountry: "Nigeria"
    });
    assert.equal(checkout.orders.length, 1);
    const orderId = checkout.orders[0].id;
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(orderBefore.status, "PENDING");
    assert.equal(orderBefore.totalMinor, 250000);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 3);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: seller.id, eventKey: `order:${orderId}:PENDING` } }), 1);

    const attempt = await payments.initialize(by, { subjectType: "ORDER", subjectId: orderId }, `sandbox-order-${testId}`);
    assert.equal(attempt.provider, "HUSTLE_SANDBOX");
    assert.equal(attempt.status, "PENDING");
    assert.equal(attempt.amountMinor, 250000);
    assert.equal(await prisma.notification.count({ where: { eventKey: `order:${orderId}:PAID` } }), 0);

    await expectRejected(
      () => payments.initialize(se, { subjectType: "ORDER", subjectId: orderId }, `sandbox-not-buyer-${testId}`),
      "Non-buyer payment initialization must be denied"
    );

    const eventId = `sandbox-paid-${testId}`;
    const payload = {
      eventId, type: "payment.succeeded", reference: attempt.providerReference,
      amountMinor: attempt.amountMinor, currency: attempt.currency
    };
    const signature = createHmac("sha256", process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET)
      .update([eventId, payload.type, payload.reference, String(payload.amountMinor),
        payload.currency.toUpperCase(), "", ""].join("|"))
      .digest("hex");
    async function postPayment(headers = {}) {
      return fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload)
      });
    }
    const unsigned = await postPayment();
    assert.equal(unsigned.status, 401, "Unsigned sandbox webhook must be blocked");
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PENDING");

    const paidResponse = await postPayment({ "x-hustle-sandbox-signature": signature });
    assert.equal(paidResponse.status, 201, `Signed webhook rejected: ${await paidResponse.text()}`);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PAID");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 2);
    assert.equal(await prisma.notification.count({ where: { recipientUserId: seller.id, eventKey: `order:${orderId}:PAID` } }), 1);

    // Provider redelivery must not duplicate payment state, notifications, inventory or ledger postings.
    const retryResponse = await postPayment({ "x-hustle-sandbox-signature": signature });
    assert.equal(retryResponse.status, 201);
    const retryBody = await retryResponse.json();
    assert.equal(retryBody.duplicate, true);
    const repeatedInit = await payments.initialize(by, { subjectType: "ORDER", subjectId: orderId }, `sandbox-order-${testId}`);
    assert.equal(repeatedInit.id, attempt.id);
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).inventoryQuantity, 2);
    const ledgerCount = await prisma.ledgerTransaction.count({ where: { paymentAttemptId: attempt.id } });
    assert.equal(ledgerCount, 1, "Payment capture should have one ledger transaction");
    const ledger = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { paymentAttemptId: attempt.id },
      include: { postings: true }
    });
    assert.equal(ledger.postings.length, 2, "Payment must post balanced double-entry ledger");
    const totalDebits = ledger.postings.filter(p => p.direction === "DEBIT").reduce((v,p) => v+p.amountMinor,0);
    const totalCredits = ledger.postings.filter(p => p.direction === "CREDIT").reduce((v,p) => v+p.amountMinor,0);
    assert.equal(totalDebits, totalCredits);

    await expectRejected(() => fulfillment.cancel(by, orderId), "Paid Order cannot be cancelled");
    await expectRejected(() => fulfillment.process(by, orderId), "Buyer cannot process seller's Order");
    await fulfillment.process(se, orderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "PROCESSING");
    await expectRejected(() => fulfillment.process(se, orderId), "Duplicate PROCESSING must be denied");

    await fulfillment.ship(se, orderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "SHIPPED");
    await expectRejected(() => fulfillment.deliver(by, orderId), "Buyer cannot mark Order delivered");

    await fulfillment.deliver(se, orderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "DELIVERED");
    await fulfillment.complete(by, orderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "COMPLETED");
    await expectRejected(() => fulfillment.complete(by, orderId), "Duplicate completion must be denied");

    const expectedSeller = ["PENDING", "PAID", "COMPLETED"];
    const expectedBuyer = ["PROCESSING", "SHIPPED", "DELIVERED"];
    for (const status of expectedSeller) {
      assert.equal(await prisma.notification.count({
        where: { recipientUserId: seller.id, eventKey: `order:${orderId}:${status}` }
      }), 1, `Seller notification ${status} must be exactly once`);
    }
    for (const status of expectedBuyer) {
      assert.equal(await prisma.notification.count({
        where: { recipientUserId: buyer.id, eventKey: `order:${orderId}:${status}` }
      }), 1, `Buyer notification ${status} must be exactly once`);
    }
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: buyer.id, eventKey: { in: expectedSeller.map(s => `order:${orderId}:${s}`) } }
    }), 0, "Buyer must not receive seller-only alerts");
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: seller.id, eventKey: { in: expectedBuyer.map(s => `order:${orderId}:${s}`) } }
    }), 0, "Seller must not receive buyer-only alerts");

    const sellerInbox = await notifications.list(se, { limit: 20 });
    const buyerInbox = await notifications.list(by, { limit: 20 });
    assert.equal(sellerInbox.items.filter(n => n.href === `/orders/${orderId}`).length, 3);
    assert.equal(buyerInbox.items.filter(n => n.href === `/orders/${orderId}`).length, 3);
    assert.equal((await notifications.unreadCount(by)).count, 3);
    const firstBuyerAlert = buyerInbox.items.find(n => n.eventKey === `order:${orderId}:PROCESSING`) ?? buyerInbox.items[0];
    await expectRejected(() => notifications.markRead(se, firstBuyerAlert.id), "Other recipient cannot mark notification read");
    await notifications.markRead(by, firstBuyerAlert.id);
    assert.equal((await notifications.unreadCount(by)).count, 2);

    // A verified review may only be created by the completed, paid Order buyer.
    await expectRejected(
      () => reviews.create(se, { subjectType: "ORDER", subjectId: orderId, rating: 5, body: "Invalid seller self-review" }),
      "Seller cannot author their own provider review"
    );
    const reviewResult = await reviews.create(by, {
      subjectType: "ORDER", subjectId: orderId, rating: 5,
      body: "Excellent service provided and delivered on time"
    });
    assert.ok(reviewResult.review.id);
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: seller.id, eventKey: `review:verified:${reviewResult.review.id}`, kind: "REVIEW" }
    }), 1);
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: buyer.id, eventKey: `review:verified:${reviewResult.review.id}` }
    }), 0);
    await expectRejected(
      () => reviews.create(by, { subjectType: "ORDER", subjectId: orderId, rating: 5, body: "Duplicate" }),
      "Buyer cannot publish a duplicate verified review"
    );
    assert.equal(await prisma.notification.count({ where: { kind: "REVIEW" } }), 1);

    // Followed-host Live alerts are emitted only on first valid DRAFT→LIVE.
    // Existing bilateral UserBlock edges prevent one party from getting alerted.
    const blocked = await prisma.user.create({
      data: { authSubject: `sandbox-blocked-${testId}`, displayName: "Blocked Sandbox Follower" }
    });
    await prisma.userFollow.createMany({
      data: [
        { followerId: buyer.id, followingId: seller.id },
        { followerId: blocked.id, followingId: seller.id }
      ]
    });
    await prisma.userBlock.create({
      data: { blockerUserId: blocked.id, blockedUserId: seller.id }
    });
    const plannedLive = await live.create(se, { title: "Disposable Seller Live" });
    await expectRejected(() => live.start(by, plannedLive.id), "Buyer cannot start seller Live");
    assert.equal(await prisma.notification.count({ where: { kind: "LIVE" } }), 0);
    await live.start(se, plannedLive.id);
    await expectRejected(() => live.start(se, plannedLive.id), "Live cannot start twice");
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: buyer.id, kind: "LIVE", eventKey: `live:started:${plannedLive.id}` }
    }), 1);
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: blocked.id, kind: "LIVE", eventKey: `live:started:${plannedLive.id}` }
    }), 0);
    assert.equal(await prisma.notification.count({
      where: { recipientUserId: seller.id, kind: "LIVE" }
    }), 0);

    console.log("PASS: verified review alerts only after paid completion, no self-review or duplicate");
    console.log("PASS: Live started alert fans out once to eligible followers; blocked follower excluded");

    console.log("PASS: isolated paid Order PENDING→PAID→PROCESSING→SHIPPED→DELIVERED→COMPLETED");
    console.log("PASS: HMAC authorization, buyer/seller guards, unique notifications, retries, ledger and inventory");
    console.log("PASS: test database is localhost-only and fixture identities are disposable");
  } finally {
    await app.close();
  }
}

main().catch(error => {
  console.error("FAILED: isolated payment sandbox assertions:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
