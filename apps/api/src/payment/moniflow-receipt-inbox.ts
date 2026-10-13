import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { type PrismaClient } from "@prisma/client";

import {
  preparePersistedSandboxFinancialCommand,
  toMoniflowSandboxCollection,
  type MoniflowSandboxCommandKind
} from "./moniflow-sandbox-partner.client";

/**
 * Strict, TEST-ONLY, receipt observation. Not registered as a payment gateway
 * and cannot emit financial success, return spendable balance or release escrow.
 * The HMAC covers EXACT raw JSON bytes, not a reserialized object.
 */
export async function verifyAndStoreSandboxPartnerReceipt(
  prisma: PrismaClient,
  raw: Buffer,
  signature: string,
  secret: string
) {
  if (process.env.NODE_ENV !== "test" || secret.length < 32) {
    throw new Error("MONIFLOW_SANDBOX_TEST_ONLY");
  }
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > 4096) {
    throw new Error("MONIFLOW_RECEIPT_BODY_LIMIT");
  }
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) {
    throw new Error("MONIFLOW_RECEIPT_SIGNATURE_INVALID");
  }
  const expected="sha256="+createHmac("sha256",secret)
    .update("MONIFLOW_SANDBOX_RECEIPT_V1\n").update(raw).digest("hex");
  const a=Buffer.from(expected),b=Buffer.from(signature);
  if (a.length!==b.length || !timingSafeEqual(a,b)) {
    throw new Error("MONIFLOW_RECEIPT_SIGNATURE_INVALID");
  }

  let input:unknown;
  try { input=JSON.parse(raw.toString("utf8")) as unknown; }
  catch { throw new Error("MONIFLOW_RECEIPT_INVALID_JSON"); }
  if (!input || typeof input!=="object" || Array.isArray(input)) {
    throw new Error("MONIFLOW_RECEIPT_INVALID_JSON");
  }
  const e=input as Record<string,unknown>;
  const fields=[
    "version","source","partner","environment","eventType","eventId",
    "operationId","kind","amountMinor","currency","commandDigest","status",
    "simulated","executionStarted","realFundsMoved","providerEvidenceReference","occurredAt"
  ];
  const id=e.operationId;
  const kind=e.kind;
  if (Object.keys(e).length!==fields.length ||
      !fields.every(k=>Object.hasOwn(e,k)) ||
      typeof id!=="string" ||
      !/^(?:c[a-z0-9]{20,34}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(id) ||
      !(kind==="COLLECTION" || kind==="PAYOUT" || kind==="REFUND") ||
      e.version!=="1" || e.source!=="MONIFLOW" || e.partner!=="HUSTLE" ||
      e.environment!=="sandbox" || e.eventType!=="operation.received" ||
      e.eventId!==`moniflow.received:${id}` ||
      e.status!=="RECEIVED" || e.simulated!==true ||
      e.executionStarted!==false || e.realFundsMoved!==false ||
      e.providerEvidenceReference!==null || e.currency!=="NGN" ||
      typeof e.occurredAt!=="string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(e.occurredAt) ||
      !Number.isFinite(Date.parse(e.occurredAt)) ||
      typeof e.commandDigest!=="string" ||
      !/^[a-f0-9]{64}$/.test(e.commandDigest)) {
    throw new Error("MONIFLOW_RECEIPT_UNTRUSTED_TERMS");
  }

  // No client-chosen price/status/destination is trusted. The local stored
  // command is independently reconstructed from an authoritative Hustle record.
  const command=kind==="COLLECTION"
    ? toMoniflowSandboxCollection(await prisma.paymentAttempt.findUniqueOrThrow({
        where:{id}
      }))
    : await preparePersistedSandboxFinancialCommand(prisma,kind,id);
  const expectedCommandDigest=createHash("sha256")
    .update(JSON.stringify(command)).digest("hex");
  if (e.amountMinor!==command.amountMinor || e.commandDigest!==expectedCommandDigest) {
    throw new Error("MONIFLOW_RECEIPT_MISMATCH");
  }

  const receiptDigest=createHash("sha256").update(raw).digest("hex");
  const occurredAt=new Date(e.occurredAt);
  const eventId=e.eventId as string;
  const insert=await prisma.moniflowSandboxReceiptObservation.createMany({
    data:[{eventId,operationId:id,kind,amountMinor:command.amountMinor,
      currency:"NGN",commandDigest:expectedCommandDigest,receiptDigest,occurredAt}],
    skipDuplicates:true
  });
  const stored=await prisma.moniflowSandboxReceiptObservation.findUniqueOrThrow({
    where:{operationId:id}
  });
  if (stored.eventId!==eventId || stored.kind!==kind ||
      stored.commandDigest!==expectedCommandDigest ||
      stored.amountMinor!==command.amountMinor ||
      stored.currency!=="NGN" || stored.receiptDigest!==receiptDigest ||
      stored.occurredAt.getTime()!==occurredAt.getTime()) {
    throw new Error("MONIFLOW_RECEIPT_REPLAY_CONFLICT");
  }
  return {eventId,operationId:id,kind:kind as MoniflowSandboxCommandKind,
    status:"RECEIVED" as const,duplicate:insert.count===0,
    simulated:true as const,realFundsMoved:false as const,
    financialStateUnchanged:true as const};
}
