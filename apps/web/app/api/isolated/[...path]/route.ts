import type { NextRequest } from "next/server";
import { proxyIsolatedRequest } from "../../../lib/api/isolated-web-proxy";

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
