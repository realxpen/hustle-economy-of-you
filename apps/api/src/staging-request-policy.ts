/** Isolated, disposable staging only. AuthGuard, AdminGuard and CapabilityGuard still decide who can act. */
export function stagingRequestAllowed(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  const authRead = /^\/api\/auth\/(get-session|ok)$/;
  const authWrite = /^\/api\/auth\/(sign-up\/email|sign-in\/email|sign-out)$/;
  const ordinaryRead = /^\/api\/v1(?:\/(?:health|foundation|auth\/me))?$/;
  const discoveryRead = /^\/api\/v1\/(?:feed|search|marketplace|services|posts|products|messaging|notifications)(?:\/[A-Za-z0-9_-]+)*$/;
  const postAction = /^\/api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media|publish|archive|like|save|share|comments|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
  const postDelete = /^\/api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media\/[A-Za-z0-9_-]+|like|save|comments\/[A-Za-z0-9_-]+|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
  const followAction = /^\/api\/v1\/users\/[A-Za-z0-9_-]+\/follow$/;
  const ownerRead = /^\/api\/v1\/(?:hustler-application|professional-profile|services\/mine(?:\/[A-Za-z0-9_-]+)?|hustler-reviews(?:\/[A-Za-z0-9_-]+)?|profiles\/[A-Za-z0-9_-]+|storefronts\/[A-Za-z0-9_-]+)$/;
  if (method === "GET" || method === "HEAD")
    return authRead.test(path) || ordinaryRead.test(path) || discoveryRead.test(path) || ownerRead.test(path);
  if (method === "PATCH") return path === "/api/v1/auth/profile";
  if (method === "PUT")
    return path === "/api/v1/hustler-application" || path === "/api/v1/professional-profile" ||
      /^\/api\/v1\/(?:services|posts)\/[A-Za-z0-9_-]+$/.test(path);
  if (method === "POST") return authWrite.test(path) ||
    new Set([
      "/api/v1/auth/sync",
      "/api/v1/hustler-application/submit",
      "/api/v1/professional-profile/publish",
      "/api/v1/professional-profile/unpublish",
      "/api/v1/services",
      "/api/v1/posts",
      "/api/v1/feed/events",
      "/api/v1/search/events",
      "/api/v1/marketplace/events"
    ]).has(path) ||
    postAction.test(path) || followAction.test(path) ||
    /^\/api\/v1\/services\/[A-Za-z0-9_-]+\/(?:publish|pause)$/.test(path) ||
    /^\/api\/v1\/hustler-reviews\/[A-Za-z0-9_-]+\/(?:start|verification|approve|reject)$/.test(path) ||
    path === "/api/v1/messaging/conversations/direct" ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/(?:messages|read|typing)$/.test(path) ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/messages\/[A-Za-z0-9_-]+\/context-opened$/.test(path);
  if (method === "DELETE") return postDelete.test(path) || followAction.test(path);
  // Never expose proof uploads, account impersonation, commerce writes, orders,
  // bookings, payments, escrow, wallet, admin changes or deletion in staging.
  return false;
}

export function stagingRequestGate(request: any, response: any, next: () => void) {
  if (!stagingRequestAllowed(request.method, request.url.split("?")[0])) {
    return response.status(403).json({ error: {
      code: "STAGING_ROUTE_DISABLED", message: "This action is unavailable in isolated staging."
    } });
  }
  next();
}
