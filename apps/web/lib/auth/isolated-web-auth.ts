"use client";

/**
 * Same isolated Better Auth identity as Hustle's connected Android preview.
 * Session cookie is HttpOnly and first-party on the installed PWA origin;
 * bearer tokens are resolved on demand, never persisted in localStorage.
 */
export const isolatedWebMode = process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH === "true";
const endpoint = "/api/isolated/auth/";
type StagingSession = {
  session: { token: string; expiresAt: string } | null;
  user: { id: string; email: string } | null;
};
async function fromJSON(response: Response) {
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const obj = result && typeof result === "object" ? result as {
      message?: string; error?: { message?: string };
    } : null;
    throw new Error(obj?.error?.message || obj?.message ||
      (response.status === 403 ? "This email is not invited for the private test." : "Staging authentication unavailable"));
  }
  return result;
}
export async function stagingSession(): Promise<StagingSession> {
  if (!isolatedWebMode) throw new Error("The isolated web login is unavailable.");
  const response = await fetch(endpoint + "get-session", {
    cache:"no-store", credentials:"same-origin",
    headers:{accept:"application/json"}
  });
  const data = await fromJSON(response) as StagingSession;
  return { session:data?.session ?? null, user:data?.user ?? null };
}
export async function stageSignIn(email: string, password: string, create: boolean) {
  if (!isolatedWebMode) throw new Error("The isolated web login is unavailable.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new Error("Enter a valid invited test email.");
  if (!password || password.length < 12) throw new Error("Use a test password of at least 12 characters.");
  const response = await fetch(endpoint + (create ? "sign-up/email" : "sign-in/email"), {
    method:"POST", credentials:"same-origin", cache:"no-store",
    headers:{"content-type":"application/json", accept:"application/json"},
    body:JSON.stringify({ email:email.trim(),password,...create?{name:"Hustle PWA tester"}:{} })
  });
  await fromJSON(response);
  const confirmed = await stagingSession();
  if (!confirmed.session?.token || !confirmed.user?.id)
    throw new Error("Your test session could not be confirmed. If registered, choose Sign in.");
  return confirmed;
}
export async function stageSignOut() {
  const response = await fetch(endpoint + "sign-out", {
    method:"POST", credentials:"same-origin", cache:"no-store",
    headers:{"content-type":"application/json", accept:"application/json"},body:"{}"
  });
  await fromJSON(response);
}
