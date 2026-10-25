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
const { AnalyticsModule } = require("../../apps/api/dist/analytics/analytics.module.js");
const { FeedModule } = require("../../apps/api/dist/feed/feed.module.js");
const { SearchModule } = require("../../apps/api/dist/search/search.module.js");
const { BookingModule } = require("../../apps/api/dist/booking/booking.module.js");
const { MessagingModule } = require("../../apps/api/dist/messaging/messaging.module.js");
const { MessagingService } = require("../../apps/api/dist/messaging/messaging.service.js");
const { SearchService } = require("../../apps/api/dist/search/search.service.js");
const { TrustModule } = require("../../apps/api/dist/trust/trust.module.js");
const { PrismaService } = require("../../apps/api/dist/database/prisma.service.js");
const { CommerceService } = require("../../apps/api/dist/commerce/commerce.service.js");
const { FulfillmentService } = require("../../apps/api/dist/commerce/fulfillment.service.js");
const { PaymentService } = require("../../apps/api/dist/payment/payment.service.js");
const { IsolatedSandboxFinanceController } = require("../../apps/api/dist/payment/isolated-sandbox-finance.controller.js");
const { assertIsolatedSandboxFinance } = require("../../apps/api/dist/payment/isolated-sandbox-finance.guard.js");
const { sendSandboxCollectionToMoniflow, sendPersistedSandboxFinancialCommandToMoniflow, observeSignedMoniflowSandboxReceipt, toMoniflowSandboxCollection, signedMoniflowSandboxRequest, requireLocalMoniflowSandbox } = require("../../apps/api/dist/payment/moniflow-sandbox-partner.client.js");
const { FinancialOperationsService } = require("../../apps/api/dist/payment/financial-operations.service.js");
const { describeFinancialDispatch } = require("../../apps/api/dist/payment/financial-dispatch-reconciliation.js");
const { classifyProviderEvidenceReadiness } = require("../../apps/api/dist/payment/provider-evidence-readiness.js");
const { WalletService } = require("../../apps/api/dist/payment/wallet.service.js");
const { SandboxFinancialOperationGateway } = require("../../apps/api/dist/payment/sandbox-financial-operation.gateway.js");
const { NotificationsService } = require("../../apps/api/dist/notifications/notifications.service.js");
const { LiveService } = require("../../apps/api/dist/live/live.service.js");
const { ReviewService } = require("../../apps/api/dist/trust/review.service.js");
const { AnalyticsService } = require("../../apps/api/dist/analytics/analytics.service.js");
const { AttributionConsentService } = require("../../apps/api/dist/analytics/attribution-consent.service.js");
const { FeedService } = require("../../apps/api/dist/feed/feed.service.js");
const { SearchObservationService } = require("../../apps/api/dist/search/search-observation.service.js");
const { BookingService } = require("../../apps/api/dist/booking/booking.service.js");

class SandboxTestModule {}
Module({ imports: [DatabaseModule, PaymentModule, LiveModule, TrustModule, AnalyticsModule, FeedModule, SearchModule, BookingModule, MessagingModule] })(SandboxTestModule);

function identity(subject) {
  return { subject, emailVerified: false, phoneVerified: false };
}

async function expectRejected(fn, label) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  assert.ok(rejected, label);
}

async function main() {
  const app = await NestFactory.create(SandboxTestModule, { logger: ["error"], rawBody: true });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  const webhookUrl = `http://127.0.0.1:${address.port}/api/v1/payments/webhooks/sandbox`;
  const prisma = app.get(PrismaService);
  const commerce = app.get(CommerceService);
  const fulfillment = app.get(FulfillmentService);
  const payments = app.get(PaymentService);
  const operations = app.get(FinancialOperationsService);
  const wallet = app.get(WalletService);
  const operationGateway = app.get(SandboxFinancialOperationGateway);
  const notifications = app.get(NotificationsService);
  const live = app.get(LiveService);
  const reviews = app.get(ReviewService);
  const analytics = app.get(AnalyticsService);
  const consent = app.get(AttributionConsentService);
  const feed = app.get(FeedService);
  const searchObservation = app.get(SearchObservationService);
  const bookingService = app.get(BookingService);
  const messagingService = app.get(MessagingService);
  const searchService = app.get(SearchService);

  try {
    assert.equal((await prisma.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, "hustle_payment_sandbox");
    // A restored sandbox can already contain real activity. Assert exact fixture
    // deltas against the starting read model instead of assuming an empty DB.
    const baseline7 = await analytics.overview("7");
    const baseline30 = await analytics.overview("30");
    const initialReviewAlerts = await prisma.notification.count({ where: { kind: "REVIEW" } });
    const initialLiveAlerts = await prisma.notification.count({ where: { kind: "LIVE" } });
    const plusCounts = (base, delta) => Object.fromEntries(Object.entries(delta).map(([key, value]) =>
      [key, typeof value === "number" ? (base?.[key] ?? 0) + value : plusCounts(base?.[key], value)]));
    const testId = randomUUID();
    const buyerSubject = `sandbox-buyer-${testId}`;
    const sellerSubject = `sandbox-seller-${testId}`;
    const by = identity(buyerSubject);
    const se = identity(sellerSubject);

    const absentEvidence=classifyProviderEvidenceReadiness("PAYOUT",5000,"NGN",null);
    assert.equal(absentEvidence.providerEvidenceStatus,"NOT_VERIFIED");
    assert.equal(absentEvidence.providerSettlementConfirmed,false);
    assert.equal(absentEvidence.moneyMovementAllowedByThisEvidence,false);
    const mismatchedEvidence=classifyProviderEvidenceReadiness("REFUND",5000,"NGN",{
      kind:"COLLECTION",amountMinor:5000,currency:"NGN",
      commandDigest:"a".repeat(64),observedAt:new Date()
    });
    assert.equal(mismatchedEvidence.partnerReceiptStatus,"OBSERVATION_CONFLICT");
    assert.equal(mismatchedEvidence.reconciliationAction,"INVESTIGATE_RECEIPT_INTEGRITY");
    assert.equal(mismatchedEvidence.moneyMovementAllowedByThisEvidence,false);
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


    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      const config={
        baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,
        secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET
      };
      const base=requireLocalMoniflowSandbox(config.baseUrl,config.secret);
      await expectRejected(
        () => Promise.resolve(requireLocalMoniflowSandbox("https://example.com",config.secret)),
        "Sandbox bridge must refuse any non-loopback provider URL"
      );
      const recorded=await prisma.paymentAttempt.findUniqueOrThrow({where:{id:attempt.id}});
      const initialLedger=await prisma.ledgerTransaction.count({where:{paymentAttemptId:attempt.id}});
      const initializedReceipt=await sendSandboxCollectionToMoniflow(recorded,config);
      assert.equal(initializedReceipt.status,"RECEIVED");
      assert.equal(initializedReceipt.duplicate,false);
      assert.equal(initializedReceipt.realFundsMoved,false);
      assert.equal(initializedReceipt.executionStarted,false);
      if (process.env.MONIFLOW_SANDBOX_INBOX_ENABLED==="true") {
        const {deliverOneSandboxReceipt}=await import(
          "../../_moniflow/apps/api/dist/services/partner/receipt-delivery.js"
        );
        const targetUrl=`http://127.0.0.1:${address.port}/api/v1/payments/partner-sandbox/received`;
        const dbUrl=process.env.MONIFLOW_SANDBOX_DATABASE_URL;
        assert.ok(dbUrl?.startsWith("file:"));
        const before=await prisma.ledgerTransaction.count();
        // First attempt has a valid MONIFlow command but wrong signing key.
        // The Hustle server must reject it and the queue must persist retry.
        const rejected=await deliverOneSandboxReceipt({
          databaseUrl:dbUrl,targetUrl,
          secret:"wrong-sandbox-secret-with-sufficient-length"
        });
        assert.equal(rejected.state,"RETRY_PENDING");
        assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
          where:{operationId:recorded.id}
        }),0,"Unauthenticated pushed receipt never reaches the inbox");
        const delivered=await deliverOneSandboxReceipt({
          databaseUrl:dbUrl,targetUrl,secret:config.secret,now:Date.now()+2500
        });
        assert.deepEqual(delivered,{
          state:"DELIVERED",operationId:recorded.id
        });
        assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
          where:{operationId:recorded.id}
        }),1,"Signed inbox persists exactly one collection observation");
        assert.equal(await prisma.ledgerTransaction.count(),before,
          "Pushed receipt must never write a financial ledger");
        const noMore=await deliverOneSandboxReceipt({
          databaseUrl:dbUrl,targetUrl,secret:config.secret,now:Date.now()+4000
        });
        assert.equal(noMore.state,"EMPTY",
          "Delivered event must not resend automatically");
        const forged=await fetch(targetUrl,{
          method:"POST",headers:{
            "content-type":"application/json",
            "x-moniflow-receipt-signature":"sha256="+ "a".repeat(64)
          },body:JSON.stringify({operationId:recorded.id,status:"SUCCEEDED",realFundsMoved:true})
        });
        assert.equal(forged.status,403);
        assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
          where:{operationId:recorded.id}
        }),1);
        console.log("PASS: persisted MONIFlow outbox -> signed Hustle inbox; wrong-key retry, dedup and unchanged ledger");
      }
      const noLedgerBeforeReceipt=await prisma.ledgerTransaction.count();
      const observedCollection=await observeSignedMoniflowSandboxReceipt(
        prisma,"COLLECTION",recorded.id,config
      );
      assert.equal(observedCollection.status,"RECEIVED");
      assert.equal(observedCollection.duplicate,process.env.MONIFLOW_SANDBOX_INBOX_ENABLED==="true");
      const collectionRepeat=await observeSignedMoniflowSandboxReceipt(
        prisma,"COLLECTION",recorded.id,config
      );
      assert.equal(collectionRepeat.duplicate,true);
      assert.equal(collectionRepeat.receiptDigest,observedCollection.receiptDigest);
      assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
        where:{operationId:recorded.id}
      }),1,"Only one durable signed collection observation");
      assert.equal(await prisma.ledgerTransaction.count(),noLedgerBeforeReceipt);
      const beforeEvidenceRead=await prisma.ledgerTransaction.count();
      const collectionRead=await operations.reconciliation(by);
      const collectionIssue=collectionRead.issues.find(
        issue=>issue.code==="PARTNER_COLLECTION_RECEIPT_AWAITING_PROVIDER_PROOF"&&issue.id===recorded.id
      );
      assert.equal(collectionIssue?.partnerReceiptStatus,"COMMAND_RECEIVED_ONLY");
      assert.equal(collectionIssue?.providerEvidenceStatus,"NOT_VERIFIED");
      assert.equal(collectionIssue?.providerSettlementConfirmed,false);
      assert.equal(collectionIssue?.moneyMovementAllowedByThisEvidence,false);
      assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:recorded.id}})).status,"PENDING");
      assert.equal(await prisma.ledgerTransaction.count(),beforeEvidenceRead,"Evidence report is read only");
      const duplicateReceipt=await sendSandboxCollectionToMoniflow(recorded,config);
      assert.equal(duplicateReceipt.duplicate,true);

      // Replays, changed terms and invalid HMAC must not alter the accepted command.
      const command=toMoniflowSandboxCollection(recorded);
      const wrongMoney=await signedMoniflowSandboxRequest(base,config.secret,
        "POST","/internal/v1/collections",{...command,amountMinor:recorded.amountMinor+100});
      assert.equal(wrongMoney.status,409,"Same operation with a new amount must conflict");
      const forbiddenCurrency=await signedMoniflowSandboxRequest(base,config.secret,
        "POST","/internal/v1/collections",{...command,currency:"USD"});
      assert.equal(forbiddenCurrency.status,400,"Unsupported currency must fail closed");
      const forged=await signedMoniflowSandboxRequest(base,config.secret,
        "POST","/internal/v1/collections",command,{signSecret:"incorrect-key-with-32-characters-minimum"});
      assert.equal(forged.status,401,"Forged signature must fail authentication");
      const stale=await signedMoniflowSandboxRequest(base,config.secret,
        "POST","/internal/v1/collections",command,{timestamp:String(Date.now()-600000)});
      assert.equal(stale.status,401,"Stale signed request must be refused");
      const nonce=randomUUID();
      const signedOnce=await signedMoniflowSandboxRequest(base,config.secret,
        "GET","/internal/v1/operations/"+recorded.id,undefined,{nonce});
      assert.equal(signedOnce.status,200);
      const replay=await signedMoniflowSandboxRequest(base,config.secret,
        "GET","/internal/v1/operations/"+recorded.id,undefined,{nonce});
      assert.equal(replay.status,409,"Repeated signed nonce must not be processed");
      assert.equal(signedOnce.payload.status,"RECEIVED");
      assert.equal(signedOnce.payload.realFundsMoved,false);
      const caps=await signedMoniflowSandboxRequest(base,config.secret,
        "GET","/internal/v1/provider-capabilities");
      assert.equal(caps.status,200);
      assert.equal(caps.payload.providerExecutionEnabled,false);
      assert.equal(caps.payload.merchantCollectionsEnabled,false);
      assert.equal(caps.payload.payoutsEnabled,false);
      assert.equal(caps.payload.refundsEnabled,false);
      assert.equal(caps.payload.custodyEnabled,false);

      assert.equal((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:attempt.id}})).status,"PENDING");
      assert.equal((await prisma.order.findUniqueOrThrow({where:{id:orderId}})).status,"PENDING");
      assert.equal(await prisma.ledgerTransaction.count({where:{paymentAttemptId:attempt.id}}),initialLedger,
        "MONIFlow receipt must not generate a Hustle paid ledger posting");
      assert.equal((await prisma.product.findUniqueOrThrow({where:{id:product.id}})).inventoryQuantity,3,
        "MONIFlow receipt must not reserve or deduct inventory");
      console.log("PASS: genuine Hustle PENDING Order/PaymentAttempt -> signed MONIFlow RECEIVED-only sandbox; duplicate/tampering/replay denied; no financial change");
    }

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
    const storedEvidence = await prisma.webhookEvent.findUniqueOrThrow({
      where:{provider_eventId:{provider:"HUSTLE_SANDBOX",eventId}}
    });
    // An attacker with the test key still cannot reuse a consumed provider
    // event id with altered amount, reference or type.
    for(const changed of [
      {...payload,amountMinor:payload.amountMinor+1},
      {...payload,reference:"hsbx_not_the_original"},
      {...payload,type:"payment.failed"}
    ]){
      const sig=createHmac("sha256",process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET)
        .update([changed.eventId,changed.type,changed.reference,String(changed.amountMinor),
          changed.currency.toUpperCase(),"",""].join("|")).digest("hex");
      const attemptReplay=await fetch(webhookUrl,{
        method:"POST",headers:{"content-type":"application/json","x-hustle-sandbox-signature":sig},
        body:JSON.stringify(changed)
      });
      assert.equal(attemptReplay.status,409,"Changed signed webhook event must be rejected");
    }
    const afterEvidence=await prisma.webhookEvent.findUniqueOrThrow({
      where:{provider_eventId:{provider:"HUSTLE_SANDBOX",eventId}}
    });
    assert.equal(afterEvidence.payloadDigest,storedEvidence.payloadDigest);
    assert.equal((await prisma.order.findUniqueOrThrow({where:{id:orderId}})).status,"PAID");
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
    assert.equal(await prisma.notification.count({ where: { kind: "REVIEW" } }), initialReviewAlerts + 1);

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
    assert.equal(await prisma.notification.count({ where: { kind: "LIVE" } }), initialLiveAlerts);
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

    // Analytics must reflect canonical record timestamps rather than
    // accepting inferred funnel conversions from untrusted click telemetry.
    const rawEventsBefore = await prisma.systemEvent.count();
    const unauthorizedAnalytics = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/events/overview?days=7`
    );
    assert.equal(unauthorizedAnalytics.status, 401, "Admin Analytics must reject unauthenticated callers");

    const analyticsSnapshot = await analytics.overview("7");
    assert.equal(analyticsSnapshot.authoritative.placedOrders, baseline7.authoritative.placedOrders + 1);
    assert.equal(analyticsSnapshot.authoritative.paidOrders, baseline7.authoritative.paidOrders + 1);
    assert.equal(analyticsSnapshot.authoritative.completedOrders, baseline7.authoritative.completedOrders + 1);
    assert.equal(analyticsSnapshot.authoritative.appliedPayments, baseline7.authoritative.appliedPayments + 1);
    assert.equal(analyticsSnapshot.authoritative.verifiedReviews, baseline7.authoritative.verifiedReviews + 1);
    assert.equal(analyticsSnapshot.authoritative.sentMessages, baseline7.authoritative.sentMessages);
    assert.equal(analyticsSnapshot.timeline.length, 7);
    assert.equal(analyticsSnapshot.timeline.reduce((sum, row) => sum + row.ordersPaid, 0),
      baseline7.timeline.reduce((sum, row) => sum + row.ordersPaid, 0) + 1);
    assert.equal(analyticsSnapshot.timeline.reduce((sum, row) => sum + row.verifiedReviews, 0),
      baseline7.timeline.reduce((sum, row) => sum + row.verifiedReviews, 0) + 1);
    assert.equal(analyticsSnapshot.observation.trustLevel, "CLIENT_REPORTED");
    assert.equal(analyticsSnapshot.authoritative.trustLevel, "CANONICAL_RECORDS");
    await expectRejected(() => analytics.overview("2"), "Unsupported analytics window must be rejected");
    assert.equal(await prisma.systemEvent.count(), rawEventsBefore, "Admin Analytics must be read-only");

    // Observational activity is deliberately separate from verified outcomes.
    await prisma.systemEvent.create({
      data: { name: "feed.view", source: "web", payload: { postId: "disposable-post" } }
    });
    const withView = await analytics.overview("30");
    assert.equal(withView.observation.events["feed.view"], (baseline30.observation.events["feed.view"] ?? 0) + 1);
    assert.equal(withView.authoritative.placedOrders, baseline30.authoritative.placedOrders + 1);
    assert.equal(withView.authoritative.verifiedReviews, baseline30.authoritative.verifiedReviews + 1);
    // Phase21B: authenticated, optional attribution. Existing platform
    // observation should continue normally, but without consent there must
    // never be an attributionEligible marker or linked report.
    const signedOutPreference = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/events/attribution-consent`
    );
    assert.equal(signedOutPreference.status, 401);
    assert.equal((await consent.status(by)).enabled, false, "Attribution off by default");
    await expectRejected(
      () => analytics.capture({
        name: "feed.product_clicked", source: "web",
        payload: { viewerUserId: buyer.id, productId: product.id, attributionEligible: true }
      }),
      "Generic capture endpoint must not forge authenticated attribution events"
    );
    await expectRejected(
      () => consent.set(by, { enabled: "true" }),
      "Consent requires an explicit boolean"
    );

    const proofPost = await prisma.post.create({
      data: {
        professionalProfileId: profile.id, status: "PUBLISHED",
        caption: "Isolated proof of real work", publishedAt: new Date()
      }
    });
    const sandboxService = await prisma.service.create({
      data: {
        professionalProfileId: profile.id, status: "PUBLISHED",
        title: "Disposable Consented Service", priceMinor: 0,
        pricingType: "FIXED", publishedAt: new Date()
      }
    });
    await prisma.postProductAttachment.create({ data: { postId: proofPost.id, productId: product.id } });
    await prisma.postServiceAttachment.create({ data: { postId: proofPost.id, serviceId: sandboxService.id } });

    const priorClick = await feed.capture(by, {
      name: "feed.product_clicked", postId: proofPost.id,
      productId: product.id, source: "web"
    });
    const priorRow = await prisma.systemEvent.findUniqueOrThrow({ where: { id: priorClick.id } });
    assert.equal(priorRow.payload.attributionEligible, undefined);

    await consent.set(by, { enabled: true });
    assert.equal((await consent.status(by)).enabled, true);
    const optedInTap = await feed.capture(by, {
      name: "feed.service_clicked", postId: proofPost.id,
      serviceId: sandboxService.id, source: "web"
    });
    const clickRecord = await prisma.systemEvent.findUniqueOrThrow({ where: { id: optedInTap.id } });
    assert.equal(clickRecord.payload.attributionEligible, true, "Server must stamp opt-in click");

    const bookingResult = await bookingService.create(by, {
      serviceId: sandboxService.id, requirements: "Disposable, consented Booking test",
      requestedStartAt: new Date(Date.now() + 86_400_000).toISOString()
    });
    assert.ok(bookingResult.id, "Real Booking must be created after consented tap");

    await searchObservation.recordMarketplace(by, {
      name: "marketplace.result_clicked", resultType: "product",
      resultId: product.id, source: "web"
    });
    await commerce.addCartItem(by, { productId: product.id, quantity: 1 });
    const linkedCheckout = await commerce.checkout(by, {
      deliveryName: "Disposable Test Buyer", deliveryPhone: "00000000000",
      deliveryAddress: "Sandbox testing only", deliveryCity: "Local Test",
      deliveryCountry: "Nigeria"
    });
    assert.equal(linkedCheckout.orders.length, 1);

    const linkedOverview = await analytics.overview("7");
    assert.deepEqual(linkedOverview.attribution.bookings, plusCounts(baseline7.attribution.bookings, {
      consentingOutcomes: 1,
      linkedOutcomes: 1,
      byLastEligibleClick: { feed: 1, search: 0, marketplace: 0 }
    }));
    assert.deepEqual(linkedOverview.attribution.orders, plusCounts(baseline7.attribution.orders, {
      consentingOutcomes: 1,
      linkedOutcomes: 1,
      byLastEligibleClick: { feed: 0, search: 0, marketplace: 1 }
    }));

    // A fresh opt-out excludes all account-level associations. A later opt-in
    // starts a new timeline and must NEVER backfill old clicked offers.
    await consent.set(by, { enabled: false });
    assert.equal((await consent.status(by)).enabled, false);
    assert.equal((await consent.clickMetadata(buyer.id, "feed.service_clicked")).attributionEligible, undefined);
    const optedOutOverview = await analytics.overview("7");
    assert.equal(optedOutOverview.attribution.bookings.consentingOutcomes, baseline7.attribution.bookings.consentingOutcomes);
    assert.equal(optedOutOverview.attribution.orders.linkedOutcomes, baseline7.attribution.orders.linkedOutcomes);
    await consent.set(by, { enabled: true });
    const restartedOverview = await analytics.overview("7");
    assert.equal(restartedOverview.attribution.bookings.consentingOutcomes, baseline7.attribution.bookings.consentingOutcomes);
    assert.equal(restartedOverview.attribution.orders.linkedOutcomes, baseline7.attribution.orders.linkedOutcomes);

    // A genuinely new offer tap and new Booking after re-enabling are eligible.
    await feed.capture(by, {
      name: "feed.service_clicked", postId: proofPost.id,
      serviceId: sandboxService.id, source: "web"
    });
    await bookingService.create(by, {
      serviceId: sandboxService.id,
      requirements: "Second independent opt-in period",
      requestedStartAt: new Date(Date.now() + 172_800_000).toISOString()
    });
    const currentOverview = await analytics.overview("7");
    assert.equal(currentOverview.attribution.bookings.consentingOutcomes, baseline7.attribution.bookings.consentingOutcomes + 1);
    assert.equal(currentOverview.attribution.bookings.linkedOutcomes, baseline7.attribution.bookings.linkedOutcomes + 1);
    assert.equal(currentOverview.attribution.orders.linkedOutcomes, baseline7.attribution.orders.linkedOutcomes);


    // P0 reserve-before-dispatch. Dedicated disposable localhost PostgreSQL,
    // deterministic HUSTLE_SANDBOX provider; zero external money operations.
    await wallet.releaseOrderSettlement(by,orderId);
    assert.equal((await wallet.getWallet(se)).balances.find(x=>x.currency==="NGN").availableMinor,250000);
    function operationSignature(event) {
      return createHmac("sha256",process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET)
        .update([event.eventId,event.type,event.reference,String(event.amountMinor),
          event.currency.toUpperCase(),event.failureCode??"",event.failureReason??""].join("|"))
        .digest("hex");
    }
    const originalPayout=operationGateway.createPayout.bind(operationGateway);
    let calledPayout=0;
    operationGateway.createPayout=async(command)=>{
      calledPayout++;
      assert.equal((await prisma.payout.findUniqueOrThrow({where:{id:command.operationId}})).status,"REQUESTED");
      assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({where:{operationId:command.operationId}})).state,"DISPATCHING");
      assert.equal(await prisma.ledgerTransaction.count({
        where:{subjectType:"PAYOUT",subjectId:command.operationId,type:"PAYOUT_RESERVED"}
      }),1,"Provider call must follow committed reservation");
      throw Error("Simulated lost payout response");
    };
    for (const [state, expected] of [
      ["QUEUED","CONTROLLED_QUEUED_REVIEW"],
      ["DISPATCHING","VERIFY_PROVIDER_STATUS_NO_RETRY"],
      ["SUBMITTED","AWAIT_VERIFIED_PROVIDER_SETTLEMENT"],
      ["OUTCOME_UNKNOWN","VERIFY_PROVIDER_STATUS_NO_RETRY"],
      [null,"INVESTIGATE_MISSING_DISPATCH_COMMAND"]
    ]) {
      const described=describeFinancialDispatch(state);
      assert.equal(described.recoveryAction,expected);
      assert.equal(described.automaticRetryAllowed,false);
    }
    const ambiguousPayout=await operations.requestPayout(
      se,{amountMinor:120000,currency:"NGN"},"sandbox-payout-unknown-"+testId
    );
    assert.equal(ambiguousPayout.status,"REQUESTED");
    assert.equal(calledPayout,1);
    assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({
      where:{operationId:ambiguousPayout.id}
    })).state,"OUTCOME_UNKNOWN");
    const reservedBalance=(await wallet.getWallet(se)).balances.find(x=>x.currency==="NGN");
    assert.equal(reservedBalance.availableMinor,130000);
    assert.equal(reservedBalance.payoutReservedMinor,120000);
    const ledgerBeforeRead=await prisma.ledgerTransaction.count();
    const unknownPayoutReport=await operations.reconciliation(se);
    const unknownPayoutIssue=unknownPayoutReport.issues.find(
      item=>item.code==="PAYOUT_AWAITING_PROVIDER"&&item.id===ambiguousPayout.id
    );
    assert.equal(unknownPayoutIssue?.dispatchState,"OUTCOME_UNKNOWN");
    assert.equal(unknownPayoutIssue?.recoveryAction,"VERIFY_PROVIDER_STATUS_NO_RETRY");
    assert.equal(unknownPayoutIssue?.automaticRetryAllowed,false);
    assert.ok(unknownPayoutIssue?.dispatchAttemptedAt);
    assert.equal(await prisma.ledgerTransaction.count(),ledgerBeforeRead,"Reconciliation must be read only");
    const otherUsersReport=await operations.reconciliation(by);
    assert.ok(!otherUsersReport.issues.some(issue=>issue.id===ambiguousPayout.id),
      "Read-only reconciliation cannot expose another user's payout dispatch");
    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      const config={
        baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,
        secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET
      };
      const before=await prisma.ledgerTransaction.count();
      const first=await sendPersistedSandboxFinancialCommandToMoniflow(
        prisma,"PAYOUT",ambiguousPayout.id,config
      );
      assert.equal(first.kind,"PAYOUT");
      assert.equal(first.status,"RECEIVED");
      assert.equal(first.duplicate,false);
      assert.equal(first.realFundsMoved,false);
      assert.equal(first.executionStarted,false);
      assert.equal(first.providerEvidenceReference,null);
      const observed=await observeSignedMoniflowSandboxReceipt(
        prisma,"PAYOUT",ambiguousPayout.id,config
      );
      assert.equal(observed.duplicate,false);
      assert.equal(observed.kind,"PAYOUT");
      assert.equal((await observeSignedMoniflowSandboxReceipt(
        prisma,"PAYOUT",ambiguousPayout.id,config
      )).duplicate,true);
      assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
        where:{operationId:ambiguousPayout.id}
      }),1);
      const evidenceReport=await operations.reconciliation(se);
      const evidenceIssue=evidenceReport.issues.find(
        issue=>issue.code==="PAYOUT_AWAITING_PROVIDER"&&issue.id===ambiguousPayout.id
      );
      assert.equal(evidenceIssue?.partnerReceiptStatus,"COMMAND_RECEIVED_ONLY");
      assert.equal(evidenceIssue?.providerEvidenceStatus,"NOT_VERIFIED");
      assert.equal(evidenceIssue?.providerSettlementConfirmed,false);
      assert.equal(evidenceIssue?.moneyMovementAllowedByThisEvidence,false);
      assert.equal(evidenceIssue?.dispatchState,"OUTCOME_UNKNOWN");
      assert.ok(!(await operations.reconciliation(by)).issues.some(
        issue=>issue.id===ambiguousPayout.id
      ),"Buyer cannot inspect seller payout evidence");
      const second=await sendPersistedSandboxFinancialCommandToMoniflow(
        prisma,"PAYOUT",ambiguousPayout.id,config
      );
      assert.equal(second.duplicate,true,"Repeated authorized payout is only an idempotent receipt");
      assert.equal(await prisma.ledgerTransaction.count(),before,
        "MONIFlow payout receipt must not change Hustle's ledger");
      assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({
        where:{operationId:ambiguousPayout.id}
      })).state,"OUTCOME_UNKNOWN","A receipt must not clear uncertain provider status");
      assert.equal(calledPayout,1,"Partner intake must not retry original sandbox provider payout");
      await expectRejected(
        ()=>sendPersistedSandboxFinancialCommandToMoniflow(prisma,"REFUND",ambiguousPayout.id,config),
        "Payout record cannot impersonate a refund command"
      );
      console.log("PASS: committed ambiguous payout -> signed MONIFlow RECEIVED-only command; no retry, funds movement or ledger posting");
    }
    const repeatedUnknown=await operations.requestPayout(
      se,{amountMinor:120000,currency:"NGN"},"sandbox-payout-unknown-"+testId
    );
    assert.equal(repeatedUnknown.id,ambiguousPayout.id);
    assert.equal(calledPayout,1,"Ambiguous payout must not retry");
    operationGateway.createPayout=originalPayout;
    await expectRejected(
      ()=>operations.requestPayout(by,{amountMinor:50000,currency:"NGN"},"sandbox-wrong-wallet-"+testId),
      "Buyer cannot spend seller balance"
    );
    const acceptedPayout=await operations.requestPayout(
      se,{amountMinor:130000,currency:"NGN"},"sandbox-payout-accepted-"+testId
    );
    assert.equal(acceptedPayout.status,"PROCESSING");
    assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({where:{operationId:acceptedPayout.id}})).state,"SUBMITTED");
    assert.equal((await wallet.getWallet(se)).balances.find(x=>x.currency==="NGN").availableMinor,0);
    const submittedReport=await operations.reconciliation(se);
    const submittedIssue=submittedReport.issues.find(
      issue=>issue.code==="PAYOUT_AWAITING_PROVIDER"&&issue.id===acceptedPayout.id
    );
    assert.equal(submittedIssue?.dispatchState,"SUBMITTED");
    assert.equal(submittedIssue?.recoveryAction,"AWAIT_VERIFIED_PROVIDER_SETTLEMENT");
    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      const config={baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET};
      const first=await sendPersistedSandboxFinancialCommandToMoniflow(
        prisma,"PAYOUT",acceptedPayout.id,config
      );
      assert.equal(first.status,"RECEIVED");
      assert.equal(first.kind,"PAYOUT");
      assert.equal(first.realFundsMoved,false);
      const observed=await observeSignedMoniflowSandboxReceipt(
        prisma,"PAYOUT",acceptedPayout.id,config
      );
      assert.equal(observed.status,"RECEIVED");
      assert.equal(observed.duplicate,false);
      assert.equal((await prisma.payout.findUniqueOrThrow({where:{id:acceptedPayout.id}})).status,"PROCESSING");
    }
    const overspends=await Promise.allSettled([
      operations.requestPayout(se,{amountMinor:10000,currency:"NGN"},"sandbox-overspend-one-"+testId),
      operations.requestPayout(se,{amountMinor:10000,currency:"NGN"},"sandbox-overspend-two-"+testId)
    ]);
    assert.ok(overspends.every(x=>x.status==="rejected"),"Must deny overspending");
    const failedPayout={
      eventId:"sandbox-payout-failed-"+testId,type:"payout.failed",
      reference:acceptedPayout.providerReference,amountMinor:acceptedPayout.amountMinor,currency:"NGN"
    };
    await operations.handleWebhook(failedPayout,operationSignature(failedPayout));
    await operations.handleWebhook(failedPayout,operationSignature(failedPayout));
    for(const changed of [
      {...failedPayout,amountMinor:failedPayout.amountMinor+1},
      {...failedPayout,reference:"hsbx_other_payout"},
      {...failedPayout,type:"payout.succeeded"}
    ]){
      await expectRejected(
        ()=>operations.handleWebhook(changed,operationSignature(changed)),
        "Changed signed payout event id must be rejected"
      );
    }
    assert.equal((await wallet.getWallet(se)).balances.find(x=>x.currency==="NGN").availableMinor,130000);
    assert.equal(await prisma.ledgerTransaction.count({
      where:{subjectType:"PAYOUT",subjectId:acceptedPayout.id,type:"PAYOUT_REVERSED"}
    }),1,"Failure must restore reserved funds once");
    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      await expectRejected(
        ()=>sendPersistedSandboxFinancialCommandToMoniflow(prisma,"PAYOUT",acceptedPayout.id,{
          baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET
        }),
        "Failed terminal payout cannot emit a new partner command"
      );
    }
    const recoveredPayout={
      eventId:"sandbox-payout-recovered-"+testId,type:"payout.succeeded",
      reference:ambiguousPayout.providerReference,amountMinor:ambiguousPayout.amountMinor,currency:"NGN"
    };
    await operations.handleWebhook(recoveredPayout,operationSignature(recoveredPayout));
    await operations.handleWebhook(recoveredPayout,operationSignature(recoveredPayout));
    assert.equal((await prisma.payout.findUniqueOrThrow({where:{id:ambiguousPayout.id}})).status,"SUCCEEDED");
    assert.equal(await prisma.ledgerTransaction.count({
      where:{subjectType:"PAYOUT",subjectId:ambiguousPayout.id,type:"PAYOUT_SENT"}
    }),1,"Late success must settle once");

    // Refund provider cannot run until the PAID Order has a committed refund
    // record/command; active refund blocks the seller's fulfillment transition.
    await commerce.addCartItem(by,{productId:product.id,quantity:1});
    const refundCheckout=await commerce.checkout(by,{
      deliveryName:"Disposable Refund Buyer",deliveryPhone:"00000000000",
      deliveryAddress:"Sandbox refund only",deliveryCity:"Local",deliveryCountry:"Nigeria"
    });
    const refundOrderId=refundCheckout.orders[0].id;
    const refundPayment=await payments.initialize(
      by,{subjectType:"ORDER",subjectId:refundOrderId},"sandbox-refund-payment-"+testId
    );
    const paidForRefund={
      eventId:"sandbox-refund-paid-"+testId,type:"payment.succeeded",
      reference:refundPayment.providerReference,amountMinor:refundPayment.amountMinor,currency:"NGN"
    };
    await payments.handleVerifiedWebhook(paidForRefund,operationSignature(paidForRefund));
    assert.equal((await prisma.order.findUniqueOrThrow({where:{id:refundOrderId}})).status,"PAID");
    const originalRefund=operationGateway.createRefund.bind(operationGateway);
    let calledRefund=0;
    operationGateway.createRefund=async(command)=>{
      calledRefund++;
      assert.equal((await prisma.refund.findUniqueOrThrow({where:{id:command.operationId}})).status,"REQUESTED");
      assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({where:{operationId:command.operationId}})).state,"DISPATCHING");
      throw Error("Simulated lost refund response");
    };
    const uncertainRefund=await operations.requestRefund(
      by,{subjectType:"ORDER",subjectId:refundOrderId},"sandbox-refund-unknown-"+testId
    );
    assert.equal(uncertainRefund.status,"REQUESTED");
    assert.equal(calledRefund,1);
    await expectRejected(()=>fulfillment.process(se,refundOrderId),"Refund hold must pause fulfillment");
    const refundReport=await operations.reconciliation(by);
    const refundIssue=refundReport.issues.find(
      issue=>issue.code==="REFUND_AWAITING_PROVIDER"&&issue.id===uncertainRefund.id
    );
    assert.equal(refundIssue?.dispatchState,"OUTCOME_UNKNOWN");
    assert.equal(refundIssue?.recoveryAction,"VERIFY_PROVIDER_STATUS_NO_RETRY");
    assert.equal(refundIssue?.automaticRetryAllowed,false);
    assert.ok(!(await operations.reconciliation(identity("sandbox-blocked-"+testId))).issues.some(
      issue=>issue.id===uncertainRefund.id
    ),"Unrelated user cannot inspect refund dispatch metadata");
    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      const config={baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET};
      const before=await prisma.ledgerTransaction.count();
      const first=await sendPersistedSandboxFinancialCommandToMoniflow(
        prisma,"REFUND",uncertainRefund.id,config
      );
      assert.equal(first.kind,"REFUND");
      assert.equal(first.status,"RECEIVED");
      assert.equal(first.duplicate,false);
      assert.equal(first.realFundsMoved,false);
      assert.equal(first.providerEvidenceReference,null);
      const observed=await observeSignedMoniflowSandboxReceipt(
        prisma,"REFUND",uncertainRefund.id,config
      );
      assert.equal(observed.status,"RECEIVED");
      assert.equal(observed.duplicate,false);
      assert.equal((await observeSignedMoniflowSandboxReceipt(
        prisma,"REFUND",uncertainRefund.id,config
      )).duplicate,true);
      const evidenceReport=await operations.reconciliation(by);
      const evidenceIssue=evidenceReport.issues.find(
        issue=>issue.code==="REFUND_AWAITING_PROVIDER"&&issue.id===uncertainRefund.id
      );
      assert.equal(evidenceIssue?.partnerReceiptStatus,"COMMAND_RECEIVED_ONLY");
      assert.equal(evidenceIssue?.providerEvidenceStatus,"NOT_VERIFIED");
      assert.equal(evidenceIssue?.moneyMovementAllowedByThisEvidence,false);
      assert.equal(evidenceIssue?.dispatchState,"OUTCOME_UNKNOWN");
      const second=await sendPersistedSandboxFinancialCommandToMoniflow(
        prisma,"REFUND",uncertainRefund.id,config
      );
      assert.equal(second.duplicate,true);
      assert.equal(await prisma.ledgerTransaction.count(),before,
        "MONIFlow refund receipt must not perform a refund posting");
      assert.equal((await prisma.order.findUniqueOrThrow({where:{id:refundOrderId}})).status,"PAID",
        "MONIFlow command receipt must not prematurely mark Order refunded");
      assert.equal((await prisma.financialDispatchCommand.findUniqueOrThrow({
        where:{operationId:uncertainRefund.id}
      })).state,"OUTCOME_UNKNOWN");
      assert.equal(calledRefund,1,"Partner receipt must not reissue original refund");
      assert.equal(await prisma.moniflowSandboxReceiptObservation.count({
        where:{operationId:uncertainRefund.id}
      }),1,"A signed refund receipt must have one durable inbox observation");
      console.log("PASS: provider-evidence readiness reports command receipts without marking collection, payout or refund settled");
      console.log("PASS: signed MONIFlow collection/payout/refund receipt evidence verified against Hustle records; immutable inbox dedup, zero finance mutations");
      console.log("PASS: applied paid Order + persisted refund hold -> signed MONIFlow RECEIVED-only command; no double refund");
    }
    const repeatedRefund=await operations.requestRefund(
      by,{subjectType:"ORDER",subjectId:refundOrderId},"sandbox-refund-unknown-"+testId
    );
    assert.equal(repeatedRefund.id,uncertainRefund.id);
    assert.equal(calledRefund,1,"Unknown refund must not retry");
    operationGateway.createRefund=originalRefund;
    const confirmedRefund={
      eventId:"sandbox-refund-confirmed-"+testId,type:"refund.succeeded",
      reference:uncertainRefund.providerReference,amountMinor:uncertainRefund.amountMinor,currency:"NGN"
    };
    await operations.handleWebhook(confirmedRefund,operationSignature(confirmedRefund));
    await operations.handleWebhook(confirmedRefund,operationSignature(confirmedRefund));
    for(const changed of [
      {...confirmedRefund,amountMinor:confirmedRefund.amountMinor+1},
      {...confirmedRefund,reference:"hsbx_other_refund"},
      {...confirmedRefund,type:"refund.failed"}
    ]){
      await expectRejected(
        ()=>operations.handleWebhook(changed,operationSignature(changed)),
        "Changed signed refund event id must be rejected"
      );
    }
    assert.equal((await prisma.order.findUniqueOrThrow({where:{id:refundOrderId}})).status,"REFUNDED");
    assert.equal(await prisma.ledgerTransaction.count({
      where:{subjectType:"ORDER",subjectId:refundOrderId,type:"REFUND"}
    }),1,"No double refund ledger posting");
    if (process.env.MONIFLOW_SANDBOX_TEST_URL) {
      await expectRejected(
        ()=>sendPersistedSandboxFinancialCommandToMoniflow(prisma,"REFUND",uncertainRefund.id,{
          baseUrl:process.env.MONIFLOW_SANDBOX_TEST_URL,secret:process.env.MONIFLOW_PARTNER_HMAC_SECRET
        }),
        "Terminal refunded Order must never resubmit a financial command"
      );
    }
    assert.ok(!(await operations.reconciliation(by)).issues.some(
      issue=>issue.id===uncertainRefund.id
    ),"Finalized refund no longer requires pending-provider reconciliation");
    assert.ok(!(await operations.reconciliation(se)).issues.some(
      issue=>issue.id===ambiguousPayout.id
    ),"Confirmed payout no longer appears unresolved");

    // Full SERVICE opportunity lifecycle. This exercises existing customer
    // features together, NOT separate new product implementations.
    // Every record and payment event stays in the disposable localhost DB.
    const serviceJourney = await prisma.service.create({
      data:{
        professionalProfileId:profile.id,status:"PUBLISHED",
        title:"Journey Barber Service "+testId,
        priceMinor:45000,currency:"NGN",pricingType:"FIXED",
        publishedAt:new Date()
      }
    });
    const journeyProofPost=await prisma.post.create({
      data:{
        professionalProfileId:profile.id,status:"PUBLISHED",
        caption:"See this Hustler's proof, then book their service",
        publishedAt:new Date(),
        serviceAttachments:{create:[{serviceId:serviceJourney.id}]}
      }
    });
    const feedJourney=await feed.list(by,"for-you",undefined,"30");
    const foundPost=feedJourney.items.find(x=>x.post.id===journeyProofPost.id);
    assert.ok(foundPost,"Published Hustler proof must reach the actual Discover feed");
    assert.equal(foundPost.creator.id,seller.id);
    assert.ok(foundPost.services.some(x=>x.id===serviceJourney.id),
      "Discover must expose canonical attached Service ID, not a fabricated link");
    const marketplaceJourney=await searchService.marketplace(by,"services",{
      q:"Journey Barber",limit:"30"
    });
    assert.ok(marketplaceJourney.items.some(x=>x.kind==="service"&&x.id===serviceJourney.id),
      "Published Service must be reachable in real Marketplace search");

    // Existing direct consultation: only its participants may see it.
    const directJourney=await messagingService.openDirect(by,{recipientUserId:seller.id});
    const chatJourney=await messagingService.sendMessage(
      by,directJourney.conversation.id,{
        text:"Is the Journey Barber Service available next week?",
        contextType:"SERVICE",contextId:serviceJourney.id
      }
    );
    assert.equal(chatJourney.context?.id,serviceJourney.id);
    await expectRejected(
      ()=>messagingService.sendMessage(identity("not-a-customer-"+testId),
        directJourney.conversation.id,{text:"Cross-account read/write attempt"}),
      "Unrelated account cannot send into another customer's consultation"
    );

    const requestedStartAt=new Date(Date.now()+7*86_400_000).toISOString();
    const fullBooking=await bookingService.create(by,{
      serviceId:serviceJourney.id,
      requestedStartAt,
      requirements:"A normal test haircut in the disposable sandbox",
      conversationId:directJourney.conversation.id
    });
    assert.equal(fullBooking.status,"REQUESTED");
    assert.equal(fullBooking.agreedPriceMinor,45000);
    assert.equal(fullBooking.serviceId,serviceJourney.id);
    assert.equal(fullBooking.conversationId,directJourney.conversation.id);
    await expectRejected(()=>bookingService.get(
      identity("not-a-customer-"+testId),fullBooking.id
    ),"Unrelated account must never access booking details");
    await expectRejected(()=>bookingService.accept(by,fullBooking.id,{}),
      "Client cannot impersonate Hustler acceptance");
    const acceptedJourney=await bookingService.accept(se,fullBooking.id,{});
    assert.equal(acceptedJourney.status,"PAYMENT_PENDING");
    assert.equal(acceptedJourney.paymentBoundary.funded,false);
    await expectRejected(()=>bookingService.start(se,fullBooking.id),
      "Paid service cannot start while payment is unconfirmed");

    const sellerWalletBeforeJourney=(await wallet.getWallet(se)).balances
      .find(x=>x.currency==="NGN")?.availableMinor??0;
    const journeyAttempt=await payments.initialize(
      by,{subjectType:"BOOKING",subjectId:fullBooking.id},
      "full-service-journey-"+testId
    );
    assert.equal(journeyAttempt.provider,"HUSTLE_SANDBOX");
    assert.equal(journeyAttempt.status,"PENDING");
    assert.equal(journeyAttempt.amountMinor,45000);
    assert.equal((await bookingService.get(by,fullBooking.id)).status,"PAYMENT_PENDING");
    assert.equal(await prisma.escrowRecord.count({
      where:{subjectType:"BOOKING",subjectId:fullBooking.id}
    }),0,"Starting sandbox checkout must not create a funded escrow");
    await expectRejected(()=>payments.initialize(
      se,{subjectType:"BOOKING",subjectId:fullBooking.id},
      "other-payer-journey-"+testId
    ),"Hustler cannot initialize a Client's booking payment");

    const journeyEvent={
      eventId:"full-journey-funded-"+testId,type:"payment.succeeded",
      reference:journeyAttempt.providerReference,
      amountMinor:journeyAttempt.amountMinor,currency:journeyAttempt.currency
    };
    const journeySign=createHmac("sha256",process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET)
      .update([journeyEvent.eventId,journeyEvent.type,journeyEvent.reference,
        String(journeyEvent.amountMinor),journeyEvent.currency.toUpperCase(),"",""].join("|"))
      .digest("hex");
    const unsignedJourney=await fetch(webhookUrl,{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify(journeyEvent)
    });
    assert.equal(unsignedJourney.status,401);
    assert.equal((await bookingService.get(by,fullBooking.id)).status,"PAYMENT_PENDING");
    const signedJourney=()=>fetch(webhookUrl,{
      method:"POST",headers:{"content-type":"application/json",
        "x-hustle-sandbox-signature":journeySign},
      body:JSON.stringify(journeyEvent)
    });
    const authorizedFunding=await signedJourney();
    assert.equal(authorizedFunding.status,201,
      "Only locally signed, sandbox-authorized provider webhook may fund a paid Booking");
    assert.equal((await signedJourney()).status,201);
    const fundedJourney=await bookingService.get(by,fullBooking.id);
    assert.equal(fundedJourney.status,"FUNDED");
    assert.equal(fundedJourney.paymentBoundary.funded,true);
    const heldJourney=await prisma.escrowRecord.findUniqueOrThrow({
      where:{subjectType_subjectId:{subjectType:"BOOKING",subjectId:fullBooking.id}}
    });
    assert.equal(heldJourney.status,"HELD");
    assert.equal(heldJourney.amountMinor,45000);
    assert.equal((await wallet.getWallet(se)).balances
      .find(x=>x.currency==="NGN")?.availableMinor??0,sellerWalletBeforeJourney,
      "Funding moves into escrow, never directly into Hustler withdrawable balance");
    assert.equal(await prisma.ledgerTransaction.count({
      where:{subjectType:"BOOKING",subjectId:fullBooking.id,type:"PAYMENT_CONFIRMED"}
    }),1,"Idempotent signed webhook must not duplicate the collection ledger");
    await expectRejected(()=>wallet.releaseBookingEscrow(by,fullBooking.id),
      "Client cannot release escrow before the Hustler completes work");

    const workingJourney=await bookingService.start(se,fullBooking.id);
    assert.equal(workingJourney.status,"IN_PROGRESS");
    const completedJourney=await bookingService.complete(se,fullBooking.id);
    assert.equal(completedJourney.status,"COMPLETED");
    await expectRejected(()=>wallet.releaseBookingEscrow(se,fullBooking.id),
      "Hustler cannot release Client-controlled Booking escrow");
    const releasedJourney=await wallet.releaseBookingEscrow(by,fullBooking.id);
    assert.equal(releasedJourney.released,true);
    assert.equal((await wallet.releaseBookingEscrow(by,fullBooking.id)).duplicate,true);
    assert.equal(await prisma.ledgerTransaction.count({
      where:{subjectType:"BOOKING",subjectId:fullBooking.id,type:"ESCROW_RELEASED"}
    }),1,"Repeat Client release must not duplicate escrow ledger postings");
    assert.equal((await wallet.getWallet(se)).balances
      .find(x=>x.currency==="NGN")?.availableMinor??0,
      sellerWalletBeforeJourney+45000,
      "Only completed, Client-authorized sandbox escrow release credits the Hustler");
    console.log("PASS: proof Discover → Marketplace Service → consulted Message → paid Booking → signed sandbox funding → completed work → one escrow release; ownership/ledger safeguards verified");

    // UX005: execute the same narrowly scoped isolated sandbox routes used by
    // the iPhone client. The existing Services/Payment/Wallet state machines are
    // authoritative; no provider or synthetic test money leaves this process.
    const flagNames=["HUSTLE_RUNTIME_SCOPE","HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED",
      "HUSTLE_FINANCIAL_PROVIDERS_ENABLED"];
    const originalFlags=Object.fromEntries(flagNames.map(k=>[k,process.env[k]]));
    try {
      await expectRejected(()=>Promise.resolve(assertIsolatedSandboxFinance()),
        "Unconfigured staging sandbox must fail closed");
      process.env.HUSTLE_RUNTIME_SCOPE="isolated-staging";
      process.env.HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED="true";
      process.env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED="false";
      assert.ok(assertIsolatedSandboxFinance().length>=32);
      const sandboxController=app.get(IsolatedSandboxFinanceController);
      const nextStart=new Date(Date.now()+12*86_400_000).toISOString();
      const demoBooking=await bookingService.create(by,{
        serviceId:serviceJourney.id,
        requestedStartAt:nextStart,
        requirements:"Dedicated test-only sandbox wallet and escrow flow",
        conversationId:directJourney.conversation.id
      });
      await bookingService.accept(se,demoBooking.id,{confirmedStartAt:nextStart});
      await expectRejected(
        ()=>sandboxController.fundBooking(se,demoBooking.id,{confirmation:"SIMULATE_TEST_FUNDS"}),
        "Hustler cannot simulate the Client's deposit"
      );
      await expectRejected(
        ()=>sandboxController.fundBooking(by,demoBooking.id,{confirmation:"false"}),
        "Sandbox deposit requires explicit confirmation"
      );
      assert.equal((await bookingService.get(by,demoBooking.id)).status,"PAYMENT_PENDING");
      const funding=await sandboxController.fundBooking(by,demoBooking.id,{confirmation:"SIMULATE_TEST_FUNDS"});
      assert.equal(funding.status,"FUNDED");
      assert.equal(funding.realFundsMoved,false);
      const firstAttemptId=funding.paymentAttemptId;
      const replayFunding=await sandboxController.fundBooking(by,demoBooking.id,{confirmation:"SIMULATE_TEST_FUNDS"});
      assert.equal(replayFunding.status,"FUNDED");
      assert.equal(await prisma.paymentAttempt.count({
        where:{subjectType:"BOOKING",subjectId:demoBooking.id}
      }),1,"No duplicate payment attempts when test deposit button is tapped twice");
      assert.equal(await prisma.ledgerTransaction.count({
        where:{paymentAttemptId:firstAttemptId,type:"PAYMENT_CONFIRMED"}
      }),1,"One sandbox deposit creates exactly one capture posting");
      await expectRejected(
        ()=>sandboxController.start(by,demoBooking.id,{confirmation:"SIMULATE_TEST_WORK"}),
        "Only Hustler starts work"
      );
      await sandboxController.start(se,demoBooking.id,{confirmation:"SIMULATE_TEST_WORK"});
      await sandboxController.complete(se,demoBooking.id,{confirmation:"SIMULATE_TEST_WORK"});
      await expectRejected(
        ()=>sandboxController.release(se,demoBooking.id,{confirmation:"SIMULATE_TEST_RELEASE"}),
        "Only the Client can release sandbox escrow"
      );
      const released=await sandboxController.release(by,demoBooking.id,{confirmation:"SIMULATE_TEST_RELEASE"});
      assert.equal(released.released,true);
      const secondRelease=await sandboxController.release(by,demoBooking.id,{confirmation:"SIMULATE_TEST_RELEASE"});
      assert.equal(secondRelease.duplicate,true);
      assert.equal(await prisma.ledgerTransaction.count({
        where:{subjectType:"BOOKING",subjectId:demoBooking.id,type:"ESCROW_RELEASED"}
      }),1);
      const simulatedWithdrawal=await sandboxController.withdraw(se,{
        confirmation:"SIMULATE_TEST_WITHDRAWAL",amountMinor:1000,currency:"NGN"
      },"ux005-test-only-"+testId);
      assert.equal(simulatedWithdrawal.provider,"HUSTLE_SANDBOX");
      assert.ok(["REQUESTED","PROCESSING"].includes(simulatedWithdrawal.status));
      assert.equal(await prisma.ledgerTransaction.count({
        where:{subjectType:"PAYOUT",subjectId:simulatedWithdrawal.id,type:"PAYOUT_RESERVED"}
      }),1);
      await expectRejected(
        ()=>sandboxController.withdraw(by,{
          confirmation:"SIMULATE_TEST_WITHDRAWAL",amountMinor:100000000,currency:"NGN"
        },"ux005-too-big-"+testId),
        "Sandbox withdrawal maximum is capped"
      );
      console.log("PASS: UX005 real sandbox controller -> paid booking escrow -> work -> client-only release -> test withdrawal reservation; no bank movement");
    } finally {
      for(const key of flagNames){
        if(originalFlags[key]===undefined) delete process.env[key];
        else process.env[key]=originalFlags[key];
      }
    }

    console.log("PASS: scoped, read-only financial reconciliation and no-automatic-retry recovery labels");
    console.log("PASS: P0 durable reserve-before-provider, unknown-outcome, payout reversal, refund hold and signed webhook replay");

    console.log("PASS: Phase21B off-by-default consent, authentic offer-click stamping, matching Service/Product associations, opt-out exclusion and fresh opt-in");

    console.log("PASS: Phase21 Analytics admin guard, canonical milestone counts, daily series and observational isolation");

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
  // Public source location only. The private restore runner may expose this
  // classification while suppressing assertion values and all raw errors.
  const location = error instanceof Error ? error.stack?.match(/run\.mjs:(\d{1,4}):\d+/) : null;
  if (location) console.error(`SANDBOX_FAILURE_LINE:${location[1]}`);
  console.error("FAILED: isolated payment sandbox assertions:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
