import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PAYSTACK_IPS = new Set(["52.31.139.75", "52.49.173.169", "52.214.14.220"]);
const MAX_BYTES = 64 * 1024;

/**
 * Dedicated temporary receiver. ONLY this HTTP handler is publicly exposed
 * through the temporary Cloudflare tunnel. Nest's application routes, Prisma,
 * auth, provider keys, and localhost database remain inaccessible externally.
 *
 * Cloudflare sets CF-Connecting-IP for requests reaching a tunnel. We validate
 * the documented Paystack source IP AND the exact raw-body HMAC, then delegate
 * to the same production payment service which privately verifies Paystack's
 * transaction reference/amount/currency/test domain again.
 */
export function createTestWebhookReceiver({
  secretKey, path, expectedReferences, onVerified, onEvent = () => {}
}) {
  if (!/^sk_test_[A-Za-z0-9]{12,}$/.test(secretKey ?? "") ||
      !/^\/paystack\/test\/[a-f0-9]{32}$/.test(path ?? "") ||
      !(expectedReferences instanceof Map) ||
      expectedReferences.size < 1 || expectedReferences.size > 2 ||
      typeof onVerified !== "function") {
    throw new Error("REFUSED: invalid isolated Paystack webhook receiver configuration");
  }
  for (const [reference, amount] of expectedReferences) {
    if (!/^hustle-[a-f0-9-]{36}$/.test(reference) ||
        !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("REFUSED: bad disposable Paystack reference or amount");
    }
  }
  const receipts = new Set();
  const server = createServer(async (request, response) => {
    const respond = (status, label) => {
      if (!response.writableEnded) {
        response.writeHead(status, { "content-type": "text/plain", "cache-control": "no-store" });
        response.end(label);
      }
    };
    if (request.url !== path || request.method !== "POST") return respond(404, "not found");
    if (request.socket.remoteAddress !== "127.0.0.1" &&
        request.socket.remoteAddress !== "::ffff:127.0.0.1") return respond(403, "forbidden");
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
      return respond(415, "unsupported");
    }
    // This forwarded IP is injected by Cloudflare at its edge. Other local
    // clients cannot create financial evidence without the secret-key HMAC.
    const forwardedIp = request.headers["cf-connecting-ip"];
    if (typeof forwardedIp !== "string" || !PAYSTACK_IPS.has(forwardedIp)) {
      return respond(403, "forbidden");
    }
    const signature = request.headers["x-paystack-signature"];
    if (typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature)) {
      return respond(401, "unauthorized");
    }
    let raw;
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BYTES) return respond(413, "payload too large");
        chunks.push(chunk);
      }
      raw = Buffer.concat(chunks);
      if (!raw.length) return respond(400, "empty body");
    } catch {
      return respond(400, "invalid body");
    }
    const expected = createHmac("sha512", secretKey).update(raw).digest();
    const actual = Buffer.from(signature, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) {
      return respond(401, "unauthorized");
    }

    let payload;
    try { payload = JSON.parse(raw.toString("utf8")); }
    catch { return respond(400, "invalid JSON"); }
    if (payload?.event !== "charge.success") {
      onEvent({ type: "ignored-event" });
      return respond(200, "ok");
    }
    const data = payload.data;
    if (!data || typeof data !== "object" ||
        typeof data.reference !== "string" ||
        !expectedReferences.has(data.reference)) {
      onEvent({ type: "ignored-reference" });
      return respond(200, "ok");
    }
    if (data.domain !== "test" || data.status !== "success" ||
        data.currency !== "NGN" ||
        data.amount !== expectedReferences.get(data.reference)) {
      onEvent({ type: "mismatched-evidence" });
      return respond(403, "forbidden");
    }
    try {
      // The underlying PaystackTestGateway rechecks the signed raw bytes and
      // calls Paystack's private /transaction/verify/:reference endpoint.
      await onVerified(payload, signature, raw);
      receipts.add(data.reference);
      onEvent({ type: "verified", reference: data.reference, receipts: receipts.size });
      respond(200, "ok");
    } catch {
      // No secret, PII, provider JSON or raw signed payload in logs.
      onEvent({ type: "verification-error" });
      respond(503, "not verified");
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 10;
  return { server, receipts };
}
