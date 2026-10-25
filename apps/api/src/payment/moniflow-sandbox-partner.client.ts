import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  EscrowStatus,
  FinancialAccountType,
  FinancialDispatchKind,
  FinancialDispatchState,
  FinancialOperationStatus,
  FinancialSubjectType,
  LedgerTransactionType,
  LedgerPostingDirection,
  OrderStatus,
  PaymentAttemptStatus,
  type PaymentAttempt,
  type PrismaClient
} from "@prisma/client";

/**
 * TEST-ONLY bridge from a REAL persisted Hustle PaymentAttempt to the
 * MONIFlow authenticated RECEIVED-only partner command inbox.
 *
 * Not a payment gateway. Not registered in PaymentModule. Does not accept
 * provider success events or authorize a financial domain mutation.
 */
export type HustleSandboxCollection = Pick<PaymentAttempt,
  "id" | "subjectType" | "subjectId" | "payerUserId" | "beneficiaryUserId" |
  "amountMinor" | "currency" | "provider" | "status"
>;

export type MoniflowSandboxCommandKind = "COLLECTION" | "PAYOUT" | "REFUND";
export type MoniflowSandboxCollectionReceipt = {
  operationId: string;
  partner: "HUSTLE";
  kind: MoniflowSandboxCommandKind;
  status: "RECEIVED";
  environment: "sandbox";
  duplicate: boolean;
  simulated: true;
  executionStarted: false;
  realFundsMoved: false;
  providerEvidenceReference: null;
};

export function requireLocalMoniflowSandbox(url: string, secret: string): URL {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("MONIFLOW_SANDBOX_TEST_ONLY");
  }
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("MONIFLOW_SANDBOX_SECRET_REQUIRED");
  }
  const parsed = new URL(url);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    !parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error("MONIFLOW_SANDBOX_LOOPBACK_ONLY");
  }
  return parsed;
}

export function signMoniflowSandboxRequest(
  secret: string,
  method: "POST" | "GET",
  path: string,
  timestamp: string,
  nonce: string,
  rawBody: Buffer
) {
  const digest = createHash("sha256").update(rawBody).digest("hex");
  const canonical = [method, path, timestamp, nonce, digest].join("\n");
  return "sha256=" + createHmac("sha256", secret).update(canonical).digest("hex");
}

export function toMoniflowSandboxCollection(attempt: HustleSandboxCollection) {
  if (attempt.provider !== "HUSTLE_SANDBOX" ||
      attempt.status !== PaymentAttemptStatus.PENDING ||
      (attempt.subjectType !== FinancialSubjectType.ORDER && attempt.subjectType !== FinancialSubjectType.BOOKING) ||
      attempt.currency !== "NGN" ||
      !Number.isSafeInteger(attempt.amountMinor) || attempt.amountMinor <= 0) {
    throw new Error("HUSTLE_AUTHORITATIVE_SANDBOX_ATTEMPT_REQUIRED");
  }
  return {
    version: "1" as const,
    partner: "HUSTLE" as const,
    environment: "sandbox" as const,
    operationId: attempt.id,
    idempotencyKey: `hustle:collection:${attempt.id}`,
    kind: "COLLECTION" as const,
    subjectType: attempt.subjectType,
    subjectId: attempt.subjectId,
    payerReference: attempt.payerUserId,
    beneficiaryReference: attempt.beneficiaryUserId,
    amountMinor: attempt.amountMinor,
    currency: "NGN" as const
  };
}

export async function signedMoniflowSandboxRequest(
  baseUrl: URL,
  secret: string,
  method: "POST" | "GET",
  path: string,
  body?: unknown,
  overrides?: { signSecret?: string; nonce?: string; timestamp?: string }
) {
  requireLocalMoniflowSandbox(baseUrl.toString(), secret);
  if (!path.startsWith("/internal/v1/") || path.includes("?") || path.includes("#")) {
    throw new Error("MONIFLOW_SANDBOX_PATH_REQUIRED");
  }
  const raw = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const timestamp = overrides?.timestamp ?? String(Date.now());
  const nonce = overrides?.nonce ?? randomUUID();
  const signature = signMoniflowSandboxRequest(
    overrides?.signSecret ?? secret, method, path, timestamp, nonce, raw
  );
  const response = await fetch(new URL(path, baseUrl), {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      "x-moniflow-partner": "HUSTLE",
      "x-moniflow-timestamp": timestamp,
      "x-moniflow-nonce": nonce,
      "x-moniflow-signature": signature,
      ...(method === "POST"
        ? { "content-type": "application/vnd.moniflow.partner+json" }
        : {})
    },
    ...(method === "POST" ? { body: raw } : {})
  });
  const payload: unknown = await response.json();
  return { status: response.status, payload };
}

/**
 * Pre-dispatch safety handshake against pinned MONIFlow's partner capabilities.
 * This is intentionally the OPPOSITE of a live-provider activation check:
 * simulation commands are refused unless MONIFlow proves its execution rails
 * are all disabled. It never creates collection, refund or payout authority.
 */
export function assertMoniflowReceiptOnlyCapabilities(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("MONIFLOW_PROVIDER_CAPABILITIES_UNTRUSTED");
  }
  const data = input as Record<string, unknown>;
  const commandTypes = data.acceptedCommandTypes;
  const expected = ["COLLECTION", "PAYOUT", "REFUND"];
  if (data.version !== "1" || data.partner !== "HUSTLE" ||
      data.environment !== "sandbox" || data.simulated !== true ||
      data.operationStorage !== "DURABLE" ||
      !Array.isArray(commandTypes) || commandTypes.length !== expected.length ||
      !expected.every(kind => commandTypes.includes(kind)) ||
      data.providerExecutionEnabled !== false ||
      data.merchantCollectionsEnabled !== false ||
      data.payoutsEnabled !== false ||
      data.refundsEnabled !== false ||
      data.custodyEnabled !== false) {
    throw new Error("MONIFLOW_PROVIDER_CAPABILITIES_UNTRUSTED");
  }
  return {
    partner: "HUSTLE" as const,
    simulationOnly: true as const,
    providerExecutionAuthorized: false as const,
    financialStateMutationAuthorized: false as const,
    providerEvidenceStatus: "NOT_VERIFIED" as const
  };
}

export async function verifyMoniflowSandboxReceiptOnlyCapabilities(
  config: { baseUrl: string; secret: string }
) {
  const base = requireLocalMoniflowSandbox(config.baseUrl, config.secret);
  const {status, payload} = await signedMoniflowSandboxRequest(
    base, config.secret, "GET", "/internal/v1/provider-capabilities"
  );
  if (status !== 200) throw new Error("MONIFLOW_PROVIDER_CAPABILITIES_UNAVAILABLE");
  return assertMoniflowReceiptOnlyCapabilities(payload);
}

function assertReceipt(payload: unknown, operationId: string, duplicate: boolean, kind: MoniflowSandboxCommandKind):
  asserts payload is MoniflowSandboxCollectionReceipt {
  if (!payload || typeof payload !== "object") throw new Error("UNTRUSTED_MONIFLOW_RECEIPT");
  const r = payload as Record<string, unknown>;
  if (
    r.operationId !== operationId ||
    r.partner !== "HUSTLE" ||
    r.kind !== kind ||
    r.status !== "RECEIVED" ||
    r.environment !== "sandbox" ||
    r.duplicate !== duplicate ||
    r.simulated !== true ||
    r.executionStarted !== false ||
    r.realFundsMoved !== false ||
    r.providerEvidenceReference !== null
  ) {
    throw new Error("UNTRUSTED_MONIFLOW_RECEIPT");
  }
}

export async function sendSandboxCollectionToMoniflow(
  attempt: HustleSandboxCollection,
  config: { baseUrl: string; secret: string }
): Promise<MoniflowSandboxCollectionReceipt> {
  const base = requireLocalMoniflowSandbox(config.baseUrl, config.secret);
  const command = toMoniflowSandboxCollection(attempt);
  await verifyMoniflowSandboxReceiptOnlyCapabilities(config);
  const { status, payload } = await signedMoniflowSandboxRequest(
    base, config.secret, "POST", "/internal/v1/collections", command
  );
  if (status !== 202 && status !== 200) throw new Error(`MONIFLOW_SANDBOX_COMMAND_REJECTED_${status}`);
  assertReceipt(payload, attempt.id, status === 200, "COLLECTION");
  return payload;
}

/**
 * TEST-ONLY financial operation handshake. Uses actual persisted Hustle
 * Payout/Refund/PaymentAttempt and dispatch rows. No arbitrary caller amount,
 * beneficiary, currency or successful provider response can be supplied.
 *
 * MONIFlow's partner endpoint ONLY stores RECEIVED intent. It has no verified
 * bank destination, reservation issuer check, or provider execution. The
 * `sandbox:UNVERIFIED:*` marker intentionally documents that NO real
 * destination verification or payment authorization has happened.
 */
export async function preparePersistedSandboxFinancialCommand(
  prisma: PrismaClient,
  kind: "PAYOUT" | "REFUND",
  operationId: string
) {
  const dispatch = await prisma.financialDispatchCommand.findUnique({ where: { operationId } });
  if (!dispatch ||
      dispatch.kind !== (kind === "PAYOUT" ? FinancialDispatchKind.PAYOUT : FinancialDispatchKind.REFUND) ||
      !(dispatch.state === FinancialDispatchState.SUBMITTED || dispatch.state === FinancialDispatchState.OUTCOME_UNKNOWN)) {
    throw new Error("HUSTLE_COMMITTED_FINANCIAL_DISPATCH_REQUIRED");
  }

  let command:
    | ReturnType<typeof makePayoutCommand>
    | ReturnType<typeof makeRefundCommand>;
  if (kind === "PAYOUT") {
    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: operationId } });
    if (payout.provider !== "HUSTLE_SANDBOX" ||
        payout.providerReference !== `hsbx_payout_${payout.id}` ||
        !(payout.status === FinancialOperationStatus.REQUESTED || payout.status === FinancialOperationStatus.PROCESSING) ||
        payout.currency !== "NGN" ||
        !Number.isSafeInteger(payout.amountMinor) || payout.amountMinor <= 0) {
      throw new Error("HUSTLE_NONTERMINAL_SANDBOX_PAYOUT_REQUIRED");
    }
    const reservation = await prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: `payout:${payout.id}:reserved` },
      include: { postings: { include: { account: true } } }
    });
    if (!reservation ||
        reservation.subjectType !== FinancialSubjectType.PAYOUT ||
        reservation.subjectId !== payout.id ||
        reservation.reference !== payout.providerReference ||
        reservation.type !== LedgerTransactionType.PAYOUT_RESERVED ||
        reservation.postings.length !== 2 ||
        !reservation.postings.some((post) =>
          post.direction === LedgerPostingDirection.DEBIT &&
          post.account.type === FinancialAccountType.AVAILABLE &&
          post.account.userId === payout.userId &&
          post.account.currency === payout.currency &&
          post.amountMinor === payout.amountMinor
        ) ||
        !reservation.postings.some((post) =>
          post.direction === LedgerPostingDirection.CREDIT &&
          post.account.type === FinancialAccountType.PAYOUT_RESERVED &&
          post.account.userId === payout.userId &&
          post.account.currency === payout.currency &&
          post.amountMinor === payout.amountMinor
        )) {
      throw new Error("HUSTLE_COMMITTED_PAYOUT_RESERVATION_REQUIRED");
    }
    command = makePayoutCommand(payout, reservation.id);
  } else {
    const refund = await prisma.refund.findUniqueOrThrow({
      where: { id: operationId }, include: { paymentAttempt: true }
    });
    const attempt = refund.paymentAttempt;
    if (refund.providerReference !== `hsbx_refund_${refund.id}` ||
        attempt.provider !== "HUSTLE_SANDBOX" ||
        attempt.status !== PaymentAttemptStatus.SUCCEEDED ||
        !attempt.domainAppliedAt ||
        !(refund.status === FinancialOperationStatus.REQUESTED || refund.status === FinancialOperationStatus.PROCESSING) ||
        refund.subjectId !== attempt.subjectId ||
        refund.subjectType !== attempt.subjectType ||
        refund.currency !== "NGN" || attempt.currency !== "NGN" ||
        refund.amountMinor !== attempt.amountMinor ||
        !Number.isSafeInteger(refund.amountMinor) || refund.amountMinor <= 0) {
      throw new Error("HUSTLE_NONTERMINAL_REFUND_WITH_APPLIED_PAYMENT_REQUIRED");
    }
    if (refund.subjectType === FinancialSubjectType.BOOKING) {
      const escrow = await prisma.escrowRecord.findUnique({
        where: { paymentAttemptId: attempt.id }
      });
      if (!escrow || escrow.status !== EscrowStatus.REFUND_PENDING ||
          escrow.subjectId !== refund.subjectId ||
          escrow.amountMinor !== refund.amountMinor) {
        throw new Error("HUSTLE_BOOKING_REFUND_HOLD_REQUIRED");
      }
    } else if (refund.subjectType === FinancialSubjectType.ORDER) {
      const order = await prisma.order.findUnique({ where: { id: refund.subjectId } });
      if (!order || order.status !== OrderStatus.PAID ||
          order.totalMinor !== refund.amountMinor) {
        throw new Error("HUSTLE_ORDER_REFUND_ELIGIBILITY_HOLD_REQUIRED");
      }
    } else {
      throw new Error("HUSTLE_REFUND_SUBJECT_UNSUPPORTED");
    }
    command = makeRefundCommand(refund, attempt.providerReference);
  }

  return command;
}

export async function sendPersistedSandboxFinancialCommandToMoniflow(
  prisma: PrismaClient,
  kind: "PAYOUT" | "REFUND",
  operationId: string,
  config: { baseUrl: string; secret: string }
): Promise<MoniflowSandboxCollectionReceipt> {
  const base = requireLocalMoniflowSandbox(config.baseUrl, config.secret);
  const command = await preparePersistedSandboxFinancialCommand(prisma, kind, operationId);
  await verifyMoniflowSandboxReceiptOnlyCapabilities(config);

  const route = kind === "PAYOUT" ? "/internal/v1/payouts" : "/internal/v1/refunds";
  const { status, payload } = await signedMoniflowSandboxRequest(
    base, config.secret, "POST", route, command
  );
  if (status !== 200 && status !== 202) {
    throw new Error(`MONIFLOW_SANDBOX_COMMAND_REJECTED_${status}`);
  }
  assertReceipt(payload, operationId, status === 200, kind);
  return payload;
}

function makePayoutCommand(
  payout: { id: string; userId: string; amountMinor: number },
  reservationId: string
) {
  return {
    version: "1" as const,
    partner: "HUSTLE" as const,
    environment: "sandbox" as const,
    operationId: payout.id,
    idempotencyKey: `hustle:payout:${payout.id}`,
    kind: "PAYOUT" as const,
    payoutId: payout.id,
    beneficiaryReference: payout.userId,
    destinationReference: `sandbox:UNVERIFIED:no-bank-transfer:${payout.id}`,
    amountMinor: payout.amountMinor,
    currency: "NGN" as const,
    hustleReservationReference: reservationId
  };
}

function makeRefundCommand(
  refund: { id: string; subjectType: FinancialSubjectType; subjectId: string; amountMinor: number },
  paymentReference: string
) {
  return {
    version: "1" as const,
    partner: "HUSTLE" as const,
    environment: "sandbox" as const,
    operationId: refund.id,
    idempotencyKey: `hustle:refund:${refund.id}`,
    kind: "REFUND" as const,
    refundId: refund.id,
    originalPaymentReference: paymentReference,
    subjectType: refund.subjectType as "BOOKING" | "ORDER",
    subjectId: refund.subjectId,
    amountMinor: refund.amountMinor,
    currency: "NGN" as const,
    hustleRefundAuthorizationReference: `sandbox:UNVERIFIED:held-refund:${refund.id}`
  };
}

/**
 * Read-only, signed return-receipt reconciliation in isolated tests.
 * A MONIFlow operation.received acknowledgement is NEVER provider settlement.
 * Stable receipt event ID + SHA-256 body digest are stored idempotently only
 * after HMAC and authoritative Hustle command terms are independently checked.
 */
export async function observeSignedMoniflowSandboxReceipt(
  prisma: PrismaClient,
  kind: MoniflowSandboxCommandKind,
  operationId: string,
  config: { baseUrl: string; secret: string }
) {
  const base = requireLocalMoniflowSandbox(config.baseUrl, config.secret);
  if (!/^(?:c[a-z0-9]{20,34}|[a-f0-9-]{36})$/.test(operationId)) {
    throw new Error("INVALID_MONIFLOW_OPERATION_REFERENCE");
  }
  const command = kind === "COLLECTION"
    ? toMoniflowSandboxCollection(await prisma.paymentAttempt.findUniqueOrThrow({where:{id:operationId}}))
    : await preparePersistedSandboxFinancialCommand(prisma, kind, operationId);
  const expectedDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");

  const path = "/internal/v1/operations/" + encodeURIComponent(operationId) + "/receipt-evidence";
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const signature = signMoniflowSandboxRequest(config.secret, "GET", path,
    timestamp, nonce, Buffer.alloc(0));
  const result = await fetch(new URL(path,base),{
    method:"GET",
    redirect:"error",
    signal:AbortSignal.timeout(5000),
    headers:{
      "x-moniflow-partner":"HUSTLE",
      "x-moniflow-timestamp":timestamp,
      "x-moniflow-nonce":nonce,
      "x-moniflow-signature":signature
    }
  });
  if (result.status !== 200) throw new Error(`MONIFLOW_RECEIPT_UNAVAILABLE_${result.status}`);
  const raw=Buffer.from(await result.arrayBuffer());
  if (raw.length===0 || raw.length>4096) throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_SIZE");
  const remoteSignature=result.headers.get("x-moniflow-receipt-signature") ?? "";
  if (!/^sha256=[a-f0-9]{64}$/.test(remoteSignature)) throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_SIGNATURE");
  const expectedSignature="sha256="+createHmac("sha256",config.secret)
    .update("MONIFLOW_SANDBOX_RECEIPT_V1\n").update(raw).digest("hex");
  const given=Buffer.from(remoteSignature);
  const known=Buffer.from(expectedSignature);
  if (given.length!==known.length || !timingSafeEqual(given,known)) {
    throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_SIGNATURE");
  }

  let parsed:unknown;
  try {parsed=JSON.parse(raw.toString("utf8")) as unknown;}
  catch {throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_BODY");}
  if (!parsed || typeof parsed!=="object" || Array.isArray(parsed)) {
    throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_BODY");
  }
  const event=parsed as Record<string,unknown>;
  const requiredKeys=[
    "version","source","partner","environment","eventType","eventId",
    "operationId","kind","amountMinor","currency","commandDigest","status",
    "simulated","executionStarted","realFundsMoved","providerEvidenceReference","occurredAt"
  ];
  if (Object.keys(event).length!==requiredKeys.length ||
      !requiredKeys.every(key=>Object.hasOwn(event,key)) ||
      event.version!=="1" || event.source!=="MONIFLOW" || event.partner!=="HUSTLE" ||
      event.environment!=="sandbox" || event.eventType!=="operation.received" ||
      event.eventId!==`moniflow.received:${operationId}` ||
      event.operationId!==operationId || event.kind!==kind ||
      event.amountMinor!==command.amountMinor || event.currency!=="NGN" ||
      event.commandDigest!==expectedDigest || event.status!=="RECEIVED" ||
      event.simulated!==true || event.executionStarted!==false ||
      event.realFundsMoved!==false || event.providerEvidenceReference!==null ||
      typeof event.occurredAt!=="string" ||
      !Number.isFinite(Date.parse(event.occurredAt))) {
    throw new Error("UNTRUSTED_MONIFLOW_RECEIPT_TERMS");
  }
  const receiptDigest=createHash("sha256").update(raw).digest("hex");
  const eventId=event.eventId as string;
  const occurredAt=new Date(event.occurredAt);
  const write=await prisma.moniflowSandboxReceiptObservation.createMany({
    data:[{eventId,operationId,kind,amountMinor:command.amountMinor,
      currency:"NGN",commandDigest:expectedDigest,receiptDigest,occurredAt}],
    skipDuplicates:true
  });
  const saved=await prisma.moniflowSandboxReceiptObservation.findUniqueOrThrow({
    where:{operationId}
  });
  if (saved.eventId!==eventId || saved.kind!==kind ||
      saved.amountMinor!==command.amountMinor || saved.currency!=="NGN" ||
      saved.commandDigest!==expectedDigest || saved.receiptDigest!==receiptDigest ||
      saved.occurredAt.getTime()!==occurredAt.getTime()) {
    throw new Error("MONIFLOW_RECEIPT_DUPLICATE_CONFLICT");
  }
  return {eventId,operationId,kind,status:"RECEIVED" as const,
    simulated:true as const,financialStateUnchanged:true as const,
    duplicate:write.count===0,receiptDigest};
}
