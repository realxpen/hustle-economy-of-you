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
const apiRead = /^api\/v1\/(?:(?:feed\/(?:for-you|nearby|connections))|(?:search(?:\/(?:top|people|posts|services|products))?)|(?:auth\/me)|(?:health)|(?:posts(?:\/[A-Za-z0-9_-]+(?:\/interactions)?)?)|(?:services(?:\/[A-Za-z0-9_-]+)?)|(?:marketplace(?:\/[A-Za-z0-9_-]+)?)|(?:products(?:\/[A-Za-z0-9_-]+)?))$/;
const apiWrite = new Set(["api/v1/auth/sync"]);

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
  return method === "GET" && apiRead.test(route) || method === "POST" && apiWrite.has(route);
}
const privateHeaders = ["authorization", "cookie"];
function copyCookies(source: Headers, target: Headers) {
  // A host-only cookie issued via this same-origin proxy is stored on the PWA
  // origin; never let upstream explicitly bind its own domain or rewrite Path.
  const cookies = source.getSetCookie();
  for (const cookie of cookies) {
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
        "minPrice", "maxPrice", "deliveryMode", "productType", "date", "tab"].includes(key)
        && value.length <= 256) url.searchParams.append(key, value);
    }
  }
  const headers = new Headers({accept:"application/json"});
  if (req.method === "POST") {
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 10_000) return NextResponse.json({message:"Payload too large"}, {status:413});
    headers.set("content-type", "application/json");
    headers.set("origin", STAGING_API_ORIGIN);
  }
  for (const key of privateHeaders) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const body = req.method === "POST" ? await req.text() : undefined;
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
