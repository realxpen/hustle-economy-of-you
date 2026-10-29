/** A direct conversation is optional for ordinary bookings but required for
 * isolated consultation proof. Never skip 401/403, 404, 409, 429, generic
 * network failures or other unexpected messaging errors. Booking API retains
 * all authority for participants, schedules, prices and consultation proof.
 */
export function shouldContinueBookingWithoutConversation(
  mode: string | null | undefined,
  error: unknown
): boolean {
  if (mode === "CONSULTATION" || !error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && [502, 503, 504].includes(status);
}
