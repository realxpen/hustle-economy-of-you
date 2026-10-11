"use client";

/** Only a known transaction detail route may appear as an optional conversation
 * return link. The backend must still authorize each destination independently. */
const safeTransaction = /^\/(bookings|orders)\/[A-Za-z0-9_-]{6,128}$/;

export function safeTransactionReturnTo(value: string | null | undefined): string | null {
  return value && safeTransaction.test(value) ? value : null;
}

export function withTransactionReturnTo(path: string, transactionPath: string): string {
  const safe = safeTransactionReturnTo(transactionPath);
  if (!safe) return path;
  const [withoutFragment, fragment] = path.split("#", 2);
  return withoutFragment + (withoutFragment.includes("?") ? "&" : "?") +
    "returnTo=" + encodeURIComponent(safe) + (fragment ? "#" + fragment : "");
}

export function transactionReturnLabel(path: string) {
  return path.startsWith("/bookings/") ? "Back to booking" : "Back to order";
}
