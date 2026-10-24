import { NextRequest, NextResponse } from "next/server";

/**
 * Non-production ONLY. Requests go exclusively to the verified disposable
 * child staging API. This is a same-origin cookie/Bearer bridge for an installed
 * iOS web app, not an arbitrary URL proxy or a production auth fallback.
 */
const STAGING_API_ORIGIN = "https://hustle-isolated-staging-api.vercel.app";
const prefix = "/api/isolated/";
const allowedAuthReads = new Set(["get-session", "ok"]);
const allowedAuthWrites = new Set(["sign-in/email", "sign-up/email", "sign-out"]);
const apiRead = /^api\/v1\/(?:(?:feed\/(?:for-you|nearby|connections))|(?:search(?:\/(?:top|people|posts|services|products))?)|(?:auth\/me)|(?:health)|(?:hustler-application)|(?:hustler-reviews(?:\/[A-Za-z0-9_-]+)?)|(?:professional-profile)|(?:profiles\/[A-Za-z0-9_-]+)|(?:storefronts\/[A-Za-z0-9_-]+)|(?:posts(?:\/mine(?:\/[A-Za-z0-9_-]+)?|\/[A-Za-z0-9_-]+(?:\/interactions(?:\/me)?)?)?)|(?:services(?:\/mine(?:\/[A-Za-z0-9_-]+)?|\/[A-Za-z0-9_-]+)?)|(?:marketplace(?:\/[A-Za-z0-9_-]+)?)|(?:products(?:\/[A-Za-z0-9_-]+)?))$/;
const apiWrite = new Set(["api/v1/auth/sync", "api/v1/hustler-application/submit",
  "api/v1/professional-profile/publish", "api/v1/professional-profile/unpublish", "api/v1/services"]);
const guestSlots = /^api\/v1\/guest\/bookings\/(?:availability|slots)$/;
const bookingRead = /^api\/v1\/bookings\/(?:client|hustler|availability|slots|duration-insights|[A-Za-z0-9_-]+)$/;
const bookingDecision = /^api\/v1\/bookings\/[A-Za-z0-9_-]+\/(?:accept|decline|cancel)$/;
const guestRead = /^api\/v1\/guest\/(?:feed\/(?:for-you|nearby|connections)|search(?:\/(?:top|people|posts|services|products))?|marketplace(?:\/(?:all|services|products))?)$/;
const apiPut = /^api\/v1\/(?:hustler-application|professional-profile|services\/[A-Za-z0-9_-]+|posts\/[A-Za-z0-9_-]+)$/;
const postAction = /^api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media|publish|archive|like|save|share|comments|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
const postDelete = /^api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media\/[A-Za-z0-9_-]+|like|save|comments\/[A-Za-z0-9_-]+|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
const followAction = /^api\/v1\/users\/[A-Za-z0-9_-]+\/follow$/;
// Consultation and messaging are authenticated, participant-scoped routes only.
const messagingRead = /^api\/v1\/messaging\/conversations(?:\/[A-Za-z0-9_-]+(?:\/(?:messages|typing))?)?$/;
// Account-owned block and report operations; no administrator or transaction tools.
const safetyRead = /^api\/v1\/trust-safety\/blocks\/status\/[A-Za-z0-9_-]+$/;
const safetyBlock = /^api\/v1\/trust-safety\/blocks\/[A-Za-z0-9_-]+$/;
const messagingWrite = /^api\/v1\/messaging\/conversations\/(?:direct|[A-Za-z0-9_-]+\/(?:messages|read|typing|messages\/[A-Za-z0-9_-]+\/context-opened))$/;
const reviewPost = /^api\/v1\/hustler-reviews\/[A-Za-z0-9_-]+\/(?:start|verification|approve|reject)$/;
const servicePost = /^api\/v1\/services\/[A-Za-z0-9_-]+\/(?:publish|pause)$/;

export function isIsolatedWebPreviewEnabled() {
  return process.env.HUSTLE_ISOLATED_PWA_GATE === "isolated-staging"
    && process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH === "true";
}

export function stagingProxyAllowed(method: string, segments: string[]) {
  if (!segments.length || segments.some(s=> !/^[A-Za-z0-9_-]+$/.test(s))) return false;
  const route = segments.join("/");
  if (route.startsWith("auth/")) {
    const endpoint = route.slice(5);
    return method === "GET" && allowedAuthReads.has(endpoint)
      || method === "POST" && allowedAuthWrites.has(endpoint);
  }
  return method === "GET" && (apiRead.test(route) || guestRead.test(route) || messagingRead.test(route) || bookingRead.test(route) || guestSlots.test(route) || safetyRead.test(route)) ||
    method === "POST" && (apiWrite.has(route) || reviewPost.test(route) || servicePost.test(route) ||
      route === "api/v1/bookings" || bookingDecision.test(route) ||
      route === "api/v1/posts" || postAction.test(route) || followAction.test(route) || messagingWrite.test(route) || safetyBlock.test(route) || route === "api/v1/trust-safety/reports" ||
      ["api/v1/feed/events", "api/v1/search/events", "api/v1/marketplace/events"].includes(route)) ||
    method === "PUT" && apiPut.test(route) ||
    method === "DELETE" && (postDelete.test(route) || followAction.test(route) || safetyBlock.test(route)) ||
    method === "PATCH" && route === "api/v1/auth/profile";
}
const privateHeaders = ["authorization", "cookie"];
function copyCookies(source: Headers, target: Headers) {
  // A host-only cookie issued via this same-origin proxy is stored on the PWA
  // origin; never let upstream explicitly bind its own domain or rewrite Path.
  const cookies = source.getSetCookie();
  for (const cookie of cookies) {
    if (!/^(?:__Secure-|__Host-)?hustle-staging\./.test(cookie)) continue;
    const safe = cookie.replace(/;\s*domain=[^;]*/ig, "").replace(/;\s*path=[^;]*/ig, "; Path=/");
    target.append("set-cookie", safe);
  }
}
export async function proxyIsolatedRequest(req: NextRequest, segments: string[]) {
  if (!isIsolatedWebPreviewEnabled()) return NextResponse.json({message:"Not found"}, {status:404});
  if (!stagingProxyAllowed(req.method, segments)) return NextResponse.json({message:"Staging route disabled"}, {status:403});

  // CSRF boundary for credential-bearing writes: only same-origin JSON fetch.
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (origin !== req.nextUrl.origin || !req.headers.get("content-type")?.startsWith("application/json")) {
      return NextResponse.json({message:"Invalid staging request origin"}, {status:403});
    }
  }
  const route = segments[0] === "auth" ? "/api/" + segments.join("/") : "/" + segments.join("/");
  const url = new URL(route, STAGING_API_ORIGIN);
  // Keep search/feed pagination parameters only, not arbitrary authorization URLs.
  if (req.method === "GET" && segments[0] !== "auth") {
    for (const [key, value] of req.nextUrl.searchParams) {
      if (["q", "cursor", "limit", "location", "category", "skill", "verified", "nearby",
        "minPrice", "maxPrice", "deliveryMode", "productType", "date", "tab",
        "afterCreatedAt", "afterId", "serviceId", "startAt", "endAt"].includes(key)
        && value.length <= 256) url.searchParams.append(key, value);
    }
  }
  const headers = new Headers({accept:"application/json"});
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 10_000) return NextResponse.json({message:"Payload too large"}, {status:413});
    headers.set("content-type", "application/json");
    headers.set("origin", STAGING_API_ORIGIN);
  }
  for (const key of privateHeaders) {
    const value = req.headers.get(key);
    if (!value) continue;
    if (key === "cookie") {
      const stagingOnly = value.split(";").map(v => v.trim())
        .filter(v => /^(?:__Secure-|__Host-)?hustle-staging\./.test(v))
        .join("; ");
      if (stagingOnly) headers.set("cookie", stagingOnly);
    } else headers.set(key, value);
  }
  const body = req.method !== "GET" ? await req.text() : undefined;
  if (body && body.length > 10_000) return NextResponse.json({message:"Payload too large"}, {status:413});
  try {
    const upstream = await fetch(url, {
      method:req.method, headers, body,
      redirect:"manual", cache:"no-store", signal:AbortSignal.timeout(12_000)
    });
    // No open redirects or arbitrary HTML/JS through this endpoint.
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({message:"Unexpected staging redirect"}, {status:502});
    }
    const responseHeaders = new Headers({
      "cache-control":"private, no-store, max-age=0", "x-content-type-options":"nosniff"
    });
    const type = upstream.headers.get("content-type") || "";
    if (!type.includes("application/json")) {
      return NextResponse.json({message:"Unexpected staging API response"}, {status:502, headers:responseHeaders});
    }
    responseHeaders.set("content-type","application/json; charset=utf-8");
    copyCookies(upstream.headers, responseHeaders);
    return new NextResponse(await upstream.text(), {status:upstream.status, headers:responseHeaders});
  } catch {
    return NextResponse.json({message:"Isolated test server unreachable"}, {status:503,
      headers:{"cache-control":"no-store"}});
  }
}
export const stagingProxyPrefix = prefix;
