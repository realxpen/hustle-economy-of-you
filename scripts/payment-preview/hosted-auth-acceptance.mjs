// UX052: Production-hosted but TEST-ONLY read-only integration and invited identity acceptance.
// Public mode needs no secrets. Invited mode reads protected TEST-only account credentials
// from GitHub environment secrets and creates/revokes only its own Better Auth session.
// No purchases, checkout, Paystack, financial or marketplace mutations.
const WEB = "https://hustle-payment-preview.realxpens.workers.dev";
const API = "https://hustle-payment-preview-api.realxpens.workers.dev";
const mode = process.argv[2];
const acceptedModes = new Set(["public", "invited"]);
if (!acceptedModes.has(mode)) throw Error("REFUSED: choose public or invited mode");
if (process.env.HUSTLE_RUNTIME_SCOPE === "production" || process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY || process.env.DATABASE_URL ||
    process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error("REFUSED: provider/database/production environment");
if (mode === "invited" && (process.env.HUSTLE_AUTH_TEST_APPROVAL !== "I_AUTHORIZE_TEST_ONLY_INVITED_AUTH_ACCEPTANCE" ||
  process.env.GITHUB_REPOSITORY !== "realxpen/hustle-economy-of-you" ||
  process.env.GITHUB_REF !== "refs/heads/main")) {
  throw Error("REFUSED: protected main-only TEST acceptance approval missing");
}
const testEmail = mode === "invited" ? process.env.HUSTLE_PREVIEW_TEST_AUTH_EMAIL?.trim() : null;
const testPassword = mode === "invited" ? process.env.HUSTLE_PREVIEW_TEST_AUTH_PASSWORD : null;
if (mode === "invited" &&
  (!/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(testEmail ?? "") ||
   (testPassword?.length ?? 0) < 12 || (testPassword?.length ?? 0) > 128)) {
  throw Error("REFUSED: separate invited TEST account email and 12-128 character password are required");
}
const safeFetch = async (url, init = {}) => {
  if (!url.startsWith(WEB + "/") && !url.startsWith(API + "/"))
    throw Error("REFUSED: unreviewed remote origin");
  return fetch(url, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(16000),
    ...init
  });
};
const statusOnly = (label, actual, expected) => {
  console.log(label + ": HTTP " + actual + ", expected " + expected);
  if (actual !== expected) throw Error("Acceptance failed: " + label);
};
const withoutCredentials = async (name, path, expected) => {
  const response = await safeFetch(WEB + path, {
    headers: { accept: "application/json" }
  });
  statusOnly(name, response.status, expected);
  return response;
};
async function publicAcceptance() {
  const auth = await safeFetch(WEB + "/auth", {headers:{accept:"text/html"}});
  statusOnly("TEST sign-in page", auth.status, 200);
  if (!(await auth.text()).includes("PRIVATE TEST"))
    throw Error("Expected private-test sign-in marker missing");

  const health = await withoutCredentials("Web → separate API health", "/api/isolated/api/v1/health", 200);
  await health.body?.cancel();
  await withoutCredentials("Anonymous financial read denied", "/api/isolated/api/v1/payments/unrelated-preview-probe", 401);
  await withoutCredentials("Anonymous application identity denied", "/api/isolated/api/v1/auth/me", 401);

  // The signed-out Better Auth session must not silently use an old staging account.
  const session = await safeFetch(WEB + "/api/isolated/auth/get-session", {
    headers: {accept:"application/json"}
  });
  const anonymousBody = await session.json().catch(() => null);
  statusOnly("Signed-out Better Auth session endpoint", session.status, 200);
  if (anonymousBody && (anonymousBody.session?.token || anonymousBody.user?.id))
    throw Error("REFUSED: anonymous session unexpectedly contains a signed-in identity");
  console.log("Signed-out session: no identity");
  for (const [label, path] of [
    ["Guest For You discovery", "/api/isolated/api/v1/guest/feed/for-you"],
    ["Guest marketplace discovery", "/api/isolated/api/v1/guest/marketplace/all"],
    ["Guest search discovery", "/api/isolated/api/v1/guest/search/top"]
  ]) {
    await withoutCredentials(label, path, 200);
  }
  console.log("PASS: hosted TEST Web sign-in, signed-out auth, protected API reads and guest discovery. No credentials or financial activity.");
}
async function invitedAcceptance() {
  let stage = "sign-in";
  let cookie = "";
  let sessionId = "";
  try {
    const login = await safeFetch(WEB + "/api/isolated/auth/sign-in/email", {
      method: "POST",
      headers: {origin:WEB,"content-type":"application/json",accept:"application/json"},
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    statusOnly("Invited TEST account sign-in", login.status, 200);
    const cookies = login.headers.getSetCookie().map(x => x.split(";")[0])
      .filter(x => /^(?:__Secure-|__Host-)?hustle-staging\.[A-Za-z0-9_.-]+=/.test(x));
    if (!cookies.length) throw Error("No rehosted secure session cookie");
    cookie = cookies.join("; ");
    await login.body?.cancel();
    const sessionRead = async () => {
      const response = await safeFetch(WEB + "/api/isolated/auth/get-session", {
        headers: {cookie,accept:"application/json"}
      });
      statusOnly("Invited session restoration", response.status, 200);
      const result = await response.json();
      if (!result?.session?.token || !result?.user?.id ||
          result.user.email?.toLowerCase() !== testEmail.toLowerCase())
        throw Error("Session identity or account mismatch");
      return result;
    };
    stage = "session restore";
    const first = await sessionRead();
    sessionId = first.user.id;
    const again = await sessionRead();
    if (again.user.id !== sessionId) throw Error("Session changed identity");
    console.log("PASS: same invited identity persists across session reads");

    stage = "account read";
    const account = await safeFetch(WEB + "/api/isolated/api/v1/auth/me", {
      headers: {authorization:"Bearer " + first.session.token,cookie,accept:"application/json"}
    });
    statusOnly("Authenticated Hustle account read", account.status, 200);
    await account.body?.cancel();

    stage = "protected financial read";
    const finance = await safeFetch(WEB + "/api/isolated/api/v1/payments/unrelated-preview-probe", {
      headers: {authorization:"Bearer invalid-test-session-only",accept:"application/json"}
    });
    statusOnly("Invalid session cannot read financial data", finance.status, 401);
    await finance.body?.cancel();
    console.log("PASS: invited TEST sign-in, session persistence, own-account read and invalid-session denial");
  } catch (_) {
    throw Error("Invited TEST acceptance failed at " + stage + "; no credentials or session values logged");
  } finally {
    if (cookie) {
      // Revokes only the session created by this acceptance run.
      try {
        const out = await safeFetch(WEB + "/api/isolated/auth/sign-out", {
          method:"POST",
          headers:{origin:WEB,"content-type":"application/json",accept:"application/json",cookie},
          body:"{}"
        });
        console.log("Current test session sign-out: HTTP " + out.status);
        await out.body?.cancel();
      } catch {
        console.error("Test sign-out did not complete; user can sign out in the TEST app.");
      }
    }
  }
}
try {
  if (mode === "public") await publicAcceptance();
  else await invitedAcceptance();
} catch (error) {
  console.error(error instanceof Error ? error.message : "TEST acceptance failed");
  process.exitCode = 1;
}
