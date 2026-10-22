/** Reviewed nonpayment staging surface; unlisted routes fail closed. */
export function stagingRequestAllowed(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  if (method === "GET" || method === "HEAD") {
    return /^\/api\/auth\/(get-session|ok)$/.test(path) ||
      /^\/api\/v1(?:\/(?:health|foundation|auth\/me))?$/.test(path) ||
      /^\/api\/v1\/(?:feed|search|marketplace|services|posts|products|messaging|notifications)(?:\/[A-Za-z0-9_-]+)*$/.test(path);
  }
  if (method === "POST") return /^\/api\/auth\/(sign-up\/email|sign-in\/email|sign-out)$/.test(path) ||
    path === "/api/v1/auth/sync" || path === "/api/v1/messaging/conversations/direct" ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/(?:messages|read|typing)$/.test(path) ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/messages\/[A-Za-z0-9_-]+\/context-opened$/.test(path);
  return method === "PATCH" && path === "/api/v1/auth/profile";
}

export function stagingRequestGate(request: any, response: any, next: () => void) {
  if (!stagingRequestAllowed(request.method, request.url.split("?")[0])) {
    return response.status(403).json({ error: {
      code: "STAGING_ROUTE_DISABLED", message: "This action is unavailable in isolated staging."
    } });
  }
  next();
}
