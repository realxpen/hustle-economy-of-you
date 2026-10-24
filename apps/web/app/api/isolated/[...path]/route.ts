import type { NextRequest } from "next/server";
import { proxyIsolatedRequest } from "../../../../lib/api/isolated-web-proxy";

type Context = { params: Promise<{ path: string[] }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyIsolatedRequest(req, path);
}
export async function POST(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyIsolatedRequest(req, path);
}

// Explicit handlers are required by Next's route method dispatcher. The proxy
// and isolated API separately enforce the route/method allowlists and identity.
export async function PUT(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyIsolatedRequest(req, path);
}
export async function PATCH(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyIsolatedRequest(req, path);
}

// Only the explicit post-media/reference and social undo paths pass the proxy policy.
export async function DELETE(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyIsolatedRequest(req, path);
}
