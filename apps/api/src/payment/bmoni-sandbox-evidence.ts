import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * BMONI partner-scoped employee.* event FORMAT preflight in a disposable
 * sandbox. Do NOT register as a payment gateway or webhook controller.
 * Verified signature != independently reconciled merchant collection.
 *
 * Contract: https://embedded-docs.bmoni.com/api-reference/webhooks/
 * X-Webhook-Signature is lowercase SHA256 HMAC of EXACT raw bytes, keyed by
 * the 64-character hex secret as a UTF-8 STRING (not hex-decoded).
 */
const events = new Set([
  "employee.deposit.completed", "employee.deposit.failed",
  "employee.deposit.refunded", "employee.withdrawal.processing",
  "employee.withdrawal.completed", "employee.withdrawal.failed"
]);

export function verifyBmoniSandboxEvidenceFixture(
  raw: Buffer,
  signature: string | undefined,
  webhookId: string | undefined,
  secret: string,
  sourceEventId?: string
) {
  // No provider webhook will ever be accepted by this helper in live runtime.
  if (process.env.NODE_ENV !== "test") throw new Error("BMONI_EVIDENCE_TEST_ONLY");
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error("BMONI_TEST_SECRET_REQUIRED");
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > 64 * 1024) {
    throw new Error("BMONI_EVIDENCE_BODY_REJECTED");
  }
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new Error("BMONI_EVIDENCE_SIGNATURE_REJECTED");
  }
  const calculated = createHmac("sha256", secret).update(raw).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature, "ascii"), Buffer.from(calculated, "ascii"))) {
    throw new Error("BMONI_EVIDENCE_SIGNATURE_REJECTED");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.toString("utf8")) as unknown; }
  catch { throw new Error("BMONI_EVIDENCE_ENVELOPE_REJECTED"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("BMONI_EVIDENCE_ENVELOPE_REJECTED");
  }
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).length !== 4 ||
      !["id", "eventType", "payload", "timestamp"].every(k => Object.hasOwn(value, k)) ||
      typeof value.id !== "string" || !value.id.trim() || value.id.length > 200 ||
      value.id !== webhookId ||
      typeof value.eventType !== "string" || !events.has(value.eventType) ||
      !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload) ||
      typeof value.timestamp !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value.timestamp) ||
      !Number.isFinite(Date.parse(value.timestamp)) ||
      (sourceEventId !== undefined && (sourceEventId.length > 200 || /[\x00-\x1f]/.test(sourceEventId)))) {
    throw new Error("BMONI_EVIDENCE_ENVELOPE_REJECTED");
  }
  return {
    source: "BMONI_SANDBOX_FIXTURE" as const,
    eventId: value.id,
    eventType: value.eventType,
    sourceEventId: sourceEventId || null,
    payloadDigest: createHash("sha256").update(raw).digest("hex"),
    evidenceStatus: "TEST_OBSERVATION_ONLY" as const,
    boundToHustleOperation: false as const,
    providerSettlementConfirmed: false as const,
    paymentAuthorized: false as const,
    escrowReleaseAuthorized: false as const,
    moneyMoved: false as const
  };
}
