/**
 * A post-auth destination is an explicit Hustle opportunity URL, not an
 * arbitrary redirect supplied by another site.
 *
 * Used on both the browser and the Next.js server (including auth callback).
 * Never forward a URL to a third-party origin or into a nested auth loop.
 */
const AUTH_DESTINATION_BASE = "https://hustle.invalid";
const allowedExact = new Set([
  "/account", "/home", "/marketplace", "/search", "/bookings",
  "/messages", "/orders", "/wallet"
]);

function isAllowedPath(pathname: string): boolean {
  if (allowedExact.has(pathname)) return true;
  return [
    /^\/bookings\/new\/[A-Za-z0-9_-]{1,128}$/,
    /^\/bookings\/[A-Za-z0-9_-]{1,128}$/,
    /^\/orders\/[A-Za-z0-9_-]{1,128}$/,
    /^\/services\/[A-Za-z0-9_-]{1,128}$/,
    /^\/products\/[A-Za-z0-9_-]{1,128}$/,
    /^\/messages\/start$/,
    /^\/messages\/[A-Za-z0-9_-]{1,128}$/,
    /^\/u\/[A-Za-z0-9_-]{1,128}$/
  ].some((pattern) => pattern.test(pathname));
}

export function safeAuthNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001F\u007F]/.test(raw)) return null;

  try {
    const parsed = new URL(raw, AUTH_DESTINATION_BASE);
    if (parsed.origin !== AUTH_DESTINATION_BASE || parsed.username || parsed.password) return null;
    // Prevent browser/proxy interpretation differences for encoded separators
    // and dot segments inside a supposedly local destination.
    if (/%(?:2f|5c|2e)/i.test(parsed.pathname) || !isAllowedPath(parsed.pathname)) return null;
    return parsed.pathname + parsed.search;
  } catch {
    return null;
  }
}

export function authUrlFor(next: string | null | undefined): string {
  const safe = safeAuthNext(next);
  return safe ? `/auth?next=${encodeURIComponent(safe)}` : "/auth";
}

export function onboardingUrlFor(next: string | null | undefined): string {
  const safe = safeAuthNext(next);
  return safe ? `/onboarding?next=${encodeURIComponent(safe)}` : "/onboarding";
}
