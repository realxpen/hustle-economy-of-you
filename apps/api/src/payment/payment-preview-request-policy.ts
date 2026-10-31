import { stagingRequestAllowed } from "../staging-request-policy";

/**
 * Separate paid-preview perimeter. NEVER widen the existing staging allowlist.
 * AuthGuard/ownership/capability checks still run after this early route gate.
 * Only Paystack TEST /transaction/verify and signed webhook are authoritative.
 */
export function paymentPreviewRequestAllowed(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb === "OPTIONS") return true;
  if (!path.startsWith("/api/v1/") && !path.startsWith("/api/auth/")) return false;
  if (path.includes("//") || path.includes("%") || path.includes("..")) return false;

  // No sandbox fund/release/withdraw route in real test-provider preview.
  if (path.startsWith("/api/v1/sandbox/")) return false;
  // Webhook is provider-only: NOT a general payment mutation endpoint.
  if (path === "/api/v1/payments/webhooks/paystack")
    return verb === "POST";

  const ref = "[A-Za-z0-9_-]+";
  const booking = new RegExp(`^/api/v1/bookings/${ref}/(?:start|complete)$`);
  const orderLifecycle = new RegExp(`^/api/v1/orders/${ref}/(?:process|ship|deliver|complete|cancel)$`);
  const paymentAttempt = new RegExp(`^/api/v1/payments/attempts/${ref}/verify$`);
  const escrowRelease = new RegExp(`^/api/v1/wallet/escrows/bookings/${ref}/release$`);
  const settlementRelease = new RegExp(`^/api/v1/wallet/settlements/orders/${ref}/release$`);
  const orderRead = new RegExp(`^/api/v1/orders/(?:buyer|seller|${ref})$`);
  const paymentRead = new RegExp(`^/api/v1/payments/(?:${ref}|subjects/(?:BOOKING|ORDER)/${ref}/latest)$`);

  if (verb === "GET" || verb === "HEAD") {
    return orderRead.test(path) || paymentRead.test(path) ||
      stagingRequestAllowed(verb, path);
  }

  if (verb === "POST") {
    if (path === "/api/v1/cart/checkout" ||
        path === "/api/v1/cart/checkout/preview" ||
        path === "/api/v1/payments/initialize" ||
        paymentAttempt.test(path) ||
        booking.test(path) || orderLifecycle.test(path) ||
        escrowRelease.test(path) || settlementRelease.test(path)) {
      return true;
    }
    // All other backend writes, including payouts/refunds, remain disabled
    // unless already allowed for nonfinancial isolated staging.
    return stagingRequestAllowed(verb, path);
  }
  return stagingRequestAllowed(verb, path);
}

export function paymentPreviewRequestGate(request: any, response: any, next: () => void) {
  if (!paymentPreviewRequestAllowed(request.method, request.url.split("?")[0])) {
    return response.status(403).json({
      error: { code: "PAYMENT_PREVIEW_ROUTE_DISABLED",
        message: "This action is unavailable in payment test preview." }
    });
  }
  next();
}
