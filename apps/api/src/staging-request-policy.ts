/** Isolated, disposable staging only. AuthGuard, AdminGuard and CapabilityGuard still decide who can act. */
export function stagingRequestAllowed(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  const authRead = /^\/api\/auth\/(get-session|ok)$/;
  const authWrite = /^\/api\/auth\/(sign-up\/email|sign-in\/email|sign-out)$/;
  const ordinaryRead = /^\/api\/v1(?:\/(?:health|foundation|auth\/me|creator-activation))?$/;
  const discoveryRead = /^\/api\/v1\/(?:feed|search|marketplace|services|posts|messaging)(?:\/[A-Za-z0-9_-]+)*$/;
  const productRead = /^\/api\/v1\/products(?:\/mine(?:\/[A-Za-z0-9_-]+)?|\/[A-Za-z0-9_-]+)?$/;
  const notificationRead = /^\/api\/v1\/notifications(?:\/unread-count)?$/;
  // Public, read-only Live discovery. No host creation, publishing credentials,
  // media session issuance, viewer presence or event writes in AWS test.
  const livePublicRead = /^\/api\/v1\/live(?:\/(?!mine(?:\/|$))[A-Za-z0-9_-]+(?:\/comments)?)?$/;
  const notificationReceiptWrite = /^\/api\/v1\/notifications\/(?:read-all|[A-Za-z0-9_-]+\/read)$/;
  const isolatedMediaRead = /^\/api\/v1\/media\/(?:p|o)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;
  const postMediaUploadAction = /^\/api\/v1\/posts\/[A-Za-z0-9_-]+\/media\/uploads\/(?:authorize|confirm)$/;
  // Isolated product-draft writes only. Real product guards enforce the ACTIVE
  // HUSTLER capability, ownership, professional-profile publish state and moderation.
  // Never enable orders, checkout funding, payment mutations or generic file uploads.
  const productOwned = /^\/api\/v1\/products\/[A-Za-z0-9_-]+$/;
  const productAction = /^\/api\/v1\/products\/[A-Za-z0-9_-]+\/(?:publish|pause|variants)$/;
  const productVariantOwned = /^\/api\/v1\/products\/[A-Za-z0-9_-]+\/variants\/[A-Za-z0-9_-]+$/;
  const postAction = /^\/api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media|publish|archive|like|save|share|comments|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
  const postDelete = /^\/api\/v1\/posts\/[A-Za-z0-9_-]+\/(?:media\/[A-Za-z0-9_-]+|like|save|comments\/[A-Za-z0-9_-]+|services\/[A-Za-z0-9_-]+|products\/[A-Za-z0-9_-]+)$/;
  const followAction = /^\/api\/v1\/users\/[A-Za-z0-9_-]+\/follow$/;
  // Isolated scheduling only: no booking funding, work, escrow or financial mutation.
  const guestSlots = /^\/api\/v1\/guest\/bookings\/(?:availability|slots)$/;
  const sandboxWrite = /^\/api\/v1\/sandbox\/(?:bookings\/[A-Za-z0-9_-]+\/(?:fund|start|complete|release)|wallet\/withdrawals)$/;
  const walletRead = /^\/api\/v1\/wallet(?:\/(?:transactions|reconciliation|withdrawals|refunds|release-state\/(?:BOOKING|ORDER)\/[A-Za-z0-9_-]+))?$/;
  const paymentRead = /^\/api\/v1\/payments\/(?:[A-Za-z0-9_-]+|subjects\/(?:BOOKING|ORDER)\/[A-Za-z0-9_-]+\/latest)$/;
  // UX006: post-escrow verified booking reviews. All reads enforce the existing
  // Review AuthGuard/eligibility checks. The public summary exposes published
  // reviews of ACTIVE, published Hustlers only.
  const reviewRead = /^\/api\/v1\/reviews\/(?:eligibility\/BOOKING\/[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)$/;
  const publicTrustRead = /^\/api\/v1\/trust\/users\/[A-Za-z0-9_-]+\/summary$/;
  const bookingRead = /^\/api\/v1\/bookings\/(?:client|hustler|availability|slots|duration-insights|[A-Za-z0-9_-]+)$/;
  const bookingDecision = /^\/api\/v1\/bookings\/[A-Za-z0-9_-]+\/(?:accept|decline|cancel|propose-time|respond-time)$/;
  const safetyRead = /^\/api\/v1\/trust-safety\/blocks\/status\/[A-Za-z0-9_-]+$/;
  const safetyBlock = /^\/api\/v1\/trust-safety\/blocks\/[A-Za-z0-9_-]+$/;
  const guestRead = /^\/api\/v1\/guest\/(?:feed\/(?:for-you|nearby|connections)|search(?:\/(?:top|people|posts|services|products))?|marketplace(?:\/(?:all|services|products))?)$/;
  const ownerRead = /^\/api\/v1\/(?:hustler-application|professional-profile|services\/mine(?:\/[A-Za-z0-9_-]+)?|hustler-reviews(?:\/[A-Za-z0-9_-]+)?|profiles\/[A-Za-z0-9_-]+|storefronts\/[A-Za-z0-9_-]+)$/;
  if (method === "GET" || method === "HEAD")
    return isolatedMediaRead.test(path) || authRead.test(path) || ordinaryRead.test(path) || discoveryRead.test(path) || productRead.test(path) || livePublicRead.test(path) || guestRead.test(path) || ownerRead.test(path) || safetyRead.test(path) || bookingRead.test(path) || guestSlots.test(path) || walletRead.test(path) || paymentRead.test(path) || reviewRead.test(path) || publicTrustRead.test(path) || notificationRead.test(path);
  if (method === "PATCH") return path === "/api/v1/auth/profile";
  if (method === "PUT")
    return path === "/api/v1/hustler-application" || path === "/api/v1/professional-profile" ||
      /^\/api\/v1\/(?:services|posts)\/[A-Za-z0-9_-]+$/.test(path) ||
      productOwned.test(path) || productVariantOwned.test(path);
  if (method === "POST") return authWrite.test(path) ||
    new Set([
      "/api/v1/auth/sync",
      "/api/v1/hustler-application/submit",
      "/api/v1/professional-profile/publish",
      "/api/v1/professional-profile/unpublish",
      "/api/v1/services",
      "/api/v1/products",
      "/api/v1/bookings",
      "/api/v1/posts",
      "/api/v1/feed/events",
      "/api/v1/search/events",
      "/api/v1/marketplace/events"
    ]).has(path) ||
    postMediaUploadAction.test(path) || postAction.test(path) || productAction.test(path) || followAction.test(path) || bookingDecision.test(path) || notificationReceiptWrite.test(path) || path === "/api/v1/reviews" || sandboxWrite.test(path) || safetyBlock.test(path) || path === "/api/v1/trust-safety/reports" ||
    /^\/api\/v1\/services\/[A-Za-z0-9_-]+\/(?:publish|pause)$/.test(path) ||
    /^\/api\/v1\/hustler-reviews\/[A-Za-z0-9_-]+\/(?:start|verification|approve|reject)$/.test(path) ||
    path === "/api/v1/messaging/conversations/direct" ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/(?:messages|read|typing)$/.test(path) ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/messages\/[A-Za-z0-9_-]+\/context-opened$/.test(path);
  if (method === "DELETE") return postDelete.test(path) || followAction.test(path) || safetyBlock.test(path) || productOwned.test(path) || productVariantOwned.test(path);
  // Never expose booking start/complete/extend, proof uploads, impersonation,
  // money movement, orders, payment attempts, escrow, wallet or admin writes.
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
