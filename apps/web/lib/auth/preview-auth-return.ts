import { onboardingUrlFor, safeAuthNext } from "./safe-auth-next";

/** Shared, testable first-login decision for the isolated V1 preview. */
export function previewAuthDestination(onboardingCompleted: boolean, requestedNext: string | null): string {
  const next = safeAuthNext(requestedNext);
  return onboardingCompleted ? next ?? "/home" : onboardingUrlFor(next);
}
