/** Sandbox-only policy for pre-committed financial dispatch.
 * DO NOT enable an external gateway until provider reference reservation,
 * ownership, reconciliation and custody gates are accepted.
 */
export function assertPreparedReference(
  prepared: { provider: string; reference: string },
  confirmed: { provider: string; reference: string }
) {
  if (
    prepared.provider !== confirmed.provider ||
    prepared.reference !== confirmed.reference
  ) {
    throw new Error("PROVIDER_REFERENCE_MISMATCH_RECONCILE");
  }
}
