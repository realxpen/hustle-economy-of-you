import type { NextRequest } from "next/server";

// Same-origin Hustle API transport: browser -> Hustle web -> Hustle API.
// This avoids mobile-browser CORS failures while keeping API authentication
// server-authoritative through the caller's bearer token.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function readApiBase() {
  const configured = process.env.HUSTLE_API_URL?.trim()
    || process.env.NEXT_PUBLIC_API_URL?.trim()
    || (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000/api/v1");

  if (!configured) {
    throw new Error("Hustle API proxy is not configured");
  }

  const parsed = new URL(configured);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Hustle API production URL must use HTTPS");
  }

  return parsed.toString().replace(/\/$/, "");
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const apiBase = readApiBase();
    const { path } = await context.params;
    const cleanPath = (path ?? []).map(encodeURIComponent).join("/");
    const upstreamUrl = new URL(`${apiBase}/${cleanPath}`);
    upstreamUrl.search = request.nextUrl.search;

    const upstreamHeaders = new Headers();
    for (const name of [
      "accept",
      "authorization",
      "content-type",
      "idempotency-key",
      "x-idempotency-key",
      "x-request-id"
    ]) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store"
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const header of HOP_BY_HOP_HEADERS) responseHeaders.delete(header);
    responseHeaders.set("cache-control", "no-store");

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("[hustle-api-proxy]", error);
    return Response.json(
      { error: { message: "Hustle API is temporarily unavailable" } },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
