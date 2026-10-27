import { createHash, createHmac } from "node:crypto";
import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";

/**
 * Staging-only, minimal AWS SigV4 S3 adapter. Uses the IAM role's short-lived
 * Lambda credentials; no browser sees credentials or arbitrary bucket names.
 * Upload uses a signed S3 POST policy, not a binary proxy through Lambda.
 */
const region = "eu-west-2";
const bucketName = "hustle-ux011-isolated-media-707859598737-eu-west-2";
const origin = "https://hustle-ios-pwa-staging.realxpens.workers.dev";

export const stagingMediaOrigin = origin;

export function stagingMediaEnabled() {
  return process.env.HUSTLE_RUNTIME_SCOPE === "isolated-staging" &&
    process.env.HUSTLE_AWS_ACCOUNT_ID === "707859598737" &&
    process.env.HUSTLE_STAGING_MEDIA_BUCKET === bucketName &&
    process.env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED === "false";
}

function requireStorage() {
  if (!stagingMediaEnabled())
    throw new ServiceUnavailableException("Private media upload is unavailable outside isolated staging");
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  if (!key || !secret || !sessionToken)
    throw new ServiceUnavailableException("Isolated media storage credentials unavailable");
  return { key, secret, sessionToken };
}

function sha256(data: string) { return createHash("sha256").update(data).digest("hex"); }
function hmac(key: Buffer | string, data: string) { return createHmac("sha256", key).update(data).digest(); }
function awsDate(now: Date) { return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function signingKey(secret: string, date: string) {
  return hmac(hmac(hmac(hmac("AWS4" + secret, date), region), "s3"), "aws4_request");
}
function credential(accessKey: string, date: string) {
  return `${accessKey}/${date}/${region}/s3/aws4_request`;
}
function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, ch => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
}
function encodedKey(key: string) { return key.split("/").map(encode).join("/"); }
function host() { return `${bucketName}.s3.${region}.amazonaws.com`; }
function scope(date: string) { return `${date}/${region}/s3/aws4_request`; }
function signedString(method: string, path: string, query: string, headers: Array<[string, string]>, dateTime: string) {
  const ordered = [...headers].sort(([a], [b]) => a.localeCompare(b));
  const names = ordered.map(([name]) => name).join(";");
  const canonicalHeaders = ordered.map(([name, value]) => `${name}:${value.trim().replace(/\s+/g," ")}\n`).join("");
  const request = [method, path, query, canonicalHeaders, names, "UNSIGNED-PAYLOAD"].join("\n");
  return ["AWS4-HMAC-SHA256", dateTime, scope(dateTime.slice(0, 8)), sha256(request)].join("\n");
}

function normalizedQuery(pairs: Array<[string, string]>) {
  return pairs.map(([k,v]) => [encode(k), encode(v)] as const)
    .sort(([a,av], [b,bv]) => a.localeCompare(b) || av.localeCompare(bv))
    .map(([k,v]) => `${k}=${v}`).join("&");
}

export function signedUploadForm(key: string, contentType: string, maxBytes: number) {
  const auth = requireStorage();
  const dateTime = awsDate(new Date());
  const date = dateTime.slice(0, 8);
  const fields: Record<string, string> = {
    key,
    "Content-Type": contentType,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential(auth.key, date),
    "X-Amz-Date": dateTime,
    "X-Amz-Security-Token": auth.sessionToken,
    success_action_status: "204"
  };
  const policy = Buffer.from(JSON.stringify({
    expiration: new Date(Date.now() + 5 * 60_000).toISOString(),
    conditions: [
      { bucket: bucketName },
      ...Object.entries(fields).map(([k,v]) => ({ [k]: v })),
      ["content-length-range", 1, maxBytes + 8192]
    ]
  })).toString("base64");
  fields.Policy = policy;
  fields["X-Amz-Signature"] = createHmac("sha256", signingKey(auth.secret, date)).update(policy).digest("hex");
  return { uploadUrl: `https://${host()}/`, fields, expiresInSeconds: 300 };
}

function signedHeaders(method: "GET" | "HEAD" | "DELETE" | "PUT", key: string, extra: Record<string,string> = {}) {
  const auth = requireStorage();
  const at = awsDate(new Date());
  const headers: Record<string,string> = {
    host: host(),
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    "x-amz-date": at,
    "x-amz-security-token": auth.sessionToken,
    ...extra
  };
  const canonical = signedString(method, "/" + encodedKey(key), "", Object.entries(headers), at);
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${credential(auth.key, at.slice(0,8))}, SignedHeaders=${Object.keys(headers).sort().join(";")}, Signature=${createHmac("sha256", signingKey(auth.secret, at.slice(0,8))).update(canonical).digest("hex")}`;
  delete headers.host;
  return headers;
}

async function request(method: "HEAD" | "GET" | "PUT" | "DELETE", key: string, extra: Record<string,string> = {}) {
  const headers = signedHeaders(method, key, extra);
  const response = await fetch(`https://${host()}/${encodedKey(key)}`, { method, headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new BadGatewayException("Isolated storage object verification failed");
  return response;
}

export async function objectMetadata(key: string) {
  const response = await request("HEAD", key);
  return {
    length: Number(response.headers.get("content-length") ?? "-1"),
    type: response.headers.get("content-type")
  };
}

export async function firstBytes(key: string) {
  const response = await request("GET", key, { range: "bytes=0-31" });
  return Buffer.from(await response.arrayBuffer()).subarray(0, 32);
}

export async function promoteObject(pending: string, destination: string) {
  // Same private bucket. Copy keeps original Content-Type, then removes pending.
  await request("PUT", destination, {
    "x-amz-copy-source": `/${bucketName}/${encodedKey(pending)}`
  });
  await request("DELETE", pending);
}

export function temporaryObjectRead(key: string, ttl = 60) {
  const auth = requireStorage();
  const at = awsDate(new Date());
  const pairs: Array<[string,string]> = [
    ["X-Amz-Algorithm","AWS4-HMAC-SHA256"],
    ["X-Amz-Credential",credential(auth.key, at.slice(0,8))],
    ["X-Amz-Date",at],
    ["X-Amz-Expires",String(ttl)],
    ["X-Amz-Security-Token",auth.sessionToken],
    ["X-Amz-SignedHeaders","host"]
  ];
  const query = normalizedQuery(pairs);
  const canonical = signedString("GET", "/" + encodedKey(key), query, [["host",host()]], at);
  const signature = createHmac("sha256", signingKey(auth.secret, at.slice(0,8))).update(canonical).digest("hex");
  return `https://${host()}/${encodedKey(key)}?${query}&X-Amz-Signature=${signature}`;
}
