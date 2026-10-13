import { createHash, createHmac, randomUUID } from "node:crypto";

import {
  EscrowStatus,
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
  const { status, payload } = await signedMoniflowSandboxRequest(
    base, config.secret, "POST", "/internal/v1/collections", command
  );
  if (status !== 202 && status !== 200) throw new Error(`MONIFLOW_SANDBOX_COMMAND_REJECTED_${status}`);
  assertReceipt(payload, attempt.id, status === 200, "COLLECTION");
  return payload;
}
