"use client";

/** A conversation return link is an untrusted navigation hint, not access to
 * any Booking or payment. Backend authorization still governs transactions.
 * Keep legacy Booking/Order detail routes; additionally permit returning
 * to an unsubmitted draft for an explicitly bounded Service ID.
 */
const safeTransaction = /^\/(bookings|orders)\/[A-Za-z0-9_-]{6,128}$/;
const safePreparedBooking = /^\/bookings\/new\/[A-Za-z0-9_-]{1,128}$/;
const safePost = /^[A-Za-z0-9_-]{6,128}$/;

export function safeTransactionReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 512 || /[\\\u0000-\u001F\u007F#]/.test(value) ||
    !value.startsWith("/") || value.startsWith("//")) return null;
  if (safeTransaction.test(value)) return value;
  const [path, search, extra] = value.split("?");
  if (extra !== undefined || !safePreparedBooking.test(path)) return null;
  if (search === undefined) return path;
  // Keep post attribution if and only if it is the one allowed, valid field.
  const params = new URLSearchParams(search);
  const posts = params.getAll("sourcePost");
  if (params.size !== 1 || posts.length !== 1 || !safePost.test(posts[0])) return null;
  return path + "?sourcePost=" + encodeURIComponent(posts[0]);
}

export function withTransactionReturnTo(path: string, transactionPath: string): string {
  const safe = safeTransactionReturnTo(transactionPath);
  if (!safe) return path;
  const [withoutFragment, fragment] = path.split("#", 2);
  return withoutFragment + (withoutFragment.includes("?") ? "&" : "?") +
    "returnTo=" + encodeURIComponent(safe) + (fragment ? "#" + fragment : "");
}

export function transactionReturnLabel(path: string) {
  if (path.startsWith("/bookings/new/")) return "Continue booking request";
  return path.startsWith("/bookings/") ? "Back to booking" : "Back to order";
}
