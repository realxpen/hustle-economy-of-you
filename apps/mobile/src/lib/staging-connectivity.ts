/**
 * Credential-free readiness probe for the isolated, internal mobile preview.
 * Never sends Better Auth cookies, bearer tokens, passwords or account data.
 * It answers API reachability only — not whether a device session is valid.
 */
const STAGING_HEALTH_URL = "https://hustle-isolated-staging-api.vercel.app/api/v1/health";

export type StagingApiStatus = "checking" | "reachable" | "unavailable";

export async function checkStagingApiReady(
  request: typeof fetch = fetch,
  timeoutMs = 8000
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(STAGING_HEALTH_URL, {
      method: "GET",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (response.status !== 200 || !/application\/json/i.test(response.headers.get("content-type") ?? "")) {
      return false;
    }
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return false;
    const health = payload as {
      service?: unknown;
      scope?: unknown;
      status?: unknown;
      dependencies?: { database?: unknown; auth?: unknown };
    };
    return health.service === "hustle-api" &&
      health.scope === "isolated-staging" &&
      health.status === "ok" &&
      health.dependencies?.database === "connected" &&
      health.dependencies?.auth === "connected";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
