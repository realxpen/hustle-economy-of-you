import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createTestWebhookReceiver } from "./real-paystack-webhook-receiver.mjs";

const reference = "hustle-" + randomUUID();
const path = "/paystack/test/" + randomUUID().replace(/-/g, "");
const secret = "sk_test_FAKEOFFLINEONLY1234567";
let verified = 0;
const { server, receipts } = createTestWebhookReceiver({
  secretKey: secret,
  path,
  expectedReferences: new Map([[reference, 10000]]),
  onVerified: async () => { verified++; }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}${path}`;
const payload = JSON.stringify({
  event: "charge.success",
  data: { id: 123456789, reference, domain: "test", status: "success", amount: 10000, currency: "NGN" }
});
const hmac = raw => createHmac("sha512", secret).update(raw).digest("hex");
const send = (raw, overrides={}) => fetch(url, {
  method: "POST",
  body: raw,
  headers: {
    "content-type": "application/json",
    "cf-connecting-ip": "52.31.139.75",
    "x-paystack-signature": hmac(raw),
    ...overrides
  }
});
try {
  assert.equal((await send(payload)).status, 200);
  assert.equal(receipts.size, 1);
  assert.equal(verified, 1);
  assert.equal((await send(payload)).status, 200, "legitimate replay accepted, financial gateway handles idempotency");
  assert.equal(receipts.size, 1);
  assert.equal(verified, 2);
  assert.equal((await send(payload, { "x-paystack-signature": "0".repeat(128) })).status, 401);
  assert.equal((await send(payload, { "cf-connecting-ip": "8.8.8.8" })).status, 403);
  assert.equal((await send(payload, { "cf-connecting-ip": "" })).status, 403);
  assert.equal((await send(payload, { "content-type": "text/plain" })).status, 415);
  assert.equal((await send(JSON.stringify({ event: "charge.success", data: {
    id: 123, reference: "hustle-" + randomUUID(), domain: "test", amount: 10000,
    currency: "NGN", status: "success"
  }}))).status, 200, "foreign refs ignored and never forwarded");
  assert.equal((await send(JSON.stringify({ event: "transfer.success", data: { reference } }))).status, 200);
  for (const change of [
    { domain: "live" }, { status: "pending" }, { currency: "USD" }, { amount: 100000 }
  ]) {
    assert.equal((await send(JSON.stringify({
      event: "charge.success",
      data: { ...JSON.parse(payload).data, ...change }
    }))).status, 403);
  }
  assert.equal((await send("not json")).status, 400);
  assert.equal((await send("x".repeat(65*1024))).status, 413);
  assert.equal((await fetch(url, { method: "GET" })).status, 404);
  assert.equal((await fetch(url + "other", { method: "POST" })).status, 404);
  assert.equal(receipts.size, 1, "failed/foreign/spoofed requests must never be receipts");
  assert.equal(verified, 2, "only properly signed known successful test payment forwarded");
  assert.throws(
    () => createTestWebhookReceiver({
      secretKey: "sk_live_1234567890123", path,
      expectedReferences: new Map([[reference, 10000]]), onVerified() {}
    }), /REFUSED/
  );
  console.log("PASS: temporary webhook receiver enforces route, loopback, Paystack source IP, exact raw SHA512, test-domain/ref/amount, size and duplicate bounds; no provider network.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
