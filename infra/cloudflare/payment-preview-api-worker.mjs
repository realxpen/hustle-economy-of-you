// UX044: this is NOT the app Worker and NOT the existing staging API.
// Only the reviewed, separate payment-preview AWS Lambda URL may be upstream.
// An upstream URL is a release parameter, NEVER controlled by browser requests.
const PREVIEW_WEB = "https://hustle-payment-preview.realxpens.workers.dev";
const PREVIEW_API = "https://hustle-payment-preview-api.realxpens.workers.dev";
const BLOCKED_STAGING_FUNCTION = "hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export function validatedPreviewUpstream(raw) {
  let value;
  try { value = new URL(raw); } catch { throw new Error("REFUSED: separate preview upstream missing"); }
  if (value.protocol !== "https:" || value.origin !== raw ||
      !/^[a-z0-9]{10,64}\.lambda-url\.eu-west-2\.on\.aws$/.test(value.hostname) ||
      value.hostname === BLOCKED_STAGING_FUNCTION ||
      value.username || value.password || value.port || value.search || value.hash) {
    throw new Error("REFUSED: non-preview or arbitrary API upstream");
  }
  return value.origin;
}

export function allowedPreviewApiPath(path, method) {
  if (!ALLOWED_METHODS.has(method) || path.includes("//") ||
      path.includes("%") || path.includes("\\") || path.includes("..") ||
      path.length > 2048) return false;
  if (path === "/api/v1/health" && ["GET", "HEAD"].includes(method)) return true;
  if (path === "/api/v1/payments/webhooks/paystack") return method === "POST";
  // All other public HTTP calls still pass the backend's payment-preview
  // request policy and Nest authentication/ownership checks.
  return /^\/api\/(?:auth\/[A-Za-z0-9/_-]+|v1\/[A-Za-z0-9/_-]+)$/.test(path);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin !== PREVIEW_API ||
        !allowedPreviewApiPath(url.pathname, request.method)) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method === "OPTIONS") return new Response(null, {status:204,headers:{
      "access-control-allow-origin":PREVIEW_WEB,
      "access-control-allow-methods":"GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers":"authorization, content-type, idempotency-key",
      "access-control-allow-credentials":"true",
      "vary":"Origin"
    }});
    let upstream;
    try { upstream = validatedPreviewUpstream(env.PREVIEW_UPSTREAM_ORIGIN); }
    catch { return new Response("Unavailable", { status: 503 }); }
    const target = upstream + url.pathname + url.search;
    const headers = new Headers(request.headers);
    for (const key of ["host", "forwarded", "x-forwarded-host",
      "x-forwarded-proto", "x-forwarded-for", "x-real-ip"]) {
      headers.delete(key);
    }
    headers.set("x-hustle-preview-edge", "payment-preview-test-only");
    // Paystack's signed raw POST body is forwarded as-is; the edge never
    // parses/re-serializes it. The backend independently validates HMAC,
    // private Paystack verification and exact domain/amount.
    const init = {
      method:request.method,
      headers,
      body: ["GET","HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
      cache: "no-store"
    };
    if (init.body) init.duplex = "half";
    let result;
    try { result = await fetch(target, init); }
    catch { return new Response("Upstream unavailable", {status:502}); }
    const response = new Response(result.body,{status:result.status,headers:result.headers});
    response.headers.delete("server");
    response.headers.delete("x-powered-by");
    response.headers.set("cache-control","no-store");
    // Browser traffic is allowed only from the isolated payment-preview app.
    if (request.headers.get("origin") === PREVIEW_WEB) {
      response.headers.set("access-control-allow-origin", PREVIEW_WEB);
      response.headers.set("access-control-allow-credentials", "true");
      response.headers.set("vary","Origin");
    } else {
      response.headers.delete("access-control-allow-origin");
      response.headers.delete("access-control-allow-credentials");
    }
    return response;
  }
};
