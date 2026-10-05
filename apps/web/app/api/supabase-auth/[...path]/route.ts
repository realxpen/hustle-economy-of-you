import type { NextRequest } from "next/server";

// Same-origin Auth transport: browser -> Hustle web -> Supabase Auth.
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

function readSupabaseTarget() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!rawUrl || !publishableKey) {
    throw new Error("Supabase auth proxy is not configured");
  }

  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("Invalid Hustle Supabase project URL");
  }

  return { origin: parsed.origin, publishableKey };
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { origin, publishableKey } = readSupabaseTarget();
    const { path } = await context.params;
    const cleanPath = (path ?? []).map(encodeURIComponent).join("/");
    const upstreamUrl = new URL(`/auth/v1/${cleanPath}`, origin);
    upstreamUrl.search = request.nextUrl.search;

    const upstreamHeaders = new Headers();
    for (const name of [
      "accept",
      "authorization",
      "content-type",
      "x-client-info",
      "x-supabase-api-version"
    ]) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    upstreamHeaders.set("apikey", request.headers.get("apikey") || publishableKey);

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
    console.error("[supabase-auth-proxy]", error);
    return Response.json(
      { error: "Hustle authentication service is temporarily unavailable" },
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
