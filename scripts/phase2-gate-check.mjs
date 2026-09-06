const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "API_URL",
  "HUSTLE_TEST_EMAIL",
  "HUSTLE_TEST_PASSWORD",
  "HUSTLE_TEST_USERNAME"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
const apiUrl = process.env.API_URL.replace(/\/$/, "");
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.HUSTLE_TEST_EMAIL;
const password = process.env.HUSTLE_TEST_PASSWORD;
const username = process.env.HUSTLE_TEST_USERNAME;
const displayName = process.env.HUSTLE_TEST_DISPLAY_NAME ?? "Phase 2 Gate User";

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

const supabaseHeaders = {
  apikey: publishableKey,
  "Content-Type": "application/json"
};

async function attemptSignup() {
  const { response, body } = await jsonRequest(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: supabaseHeaders,
    body: JSON.stringify({ email, password })
  });

  if (!response.ok && response.status !== 422) {
    throw new Error(`Supabase signup failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

async function signIn() {
  const { response, body } = await jsonRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: supabaseHeaders,
    body: JSON.stringify({ email, password })
  });

  if (!response.ok || !body?.access_token) {
    const message = JSON.stringify(body);
    if (/confirm|verified|verification/i.test(message)) {
      console.error("Email verification is still required. Verify the test account, then run this gate check again.");
      process.exit(2);
    }
    throw new Error(`Supabase sign-in failed (${response.status}): ${message}`);
  }

  return body.access_token;
}

async function hustleRequest(path, token, init = {}) {
  const { response, body } = await jsonRequest(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Hustle API ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

function assertClient(account) {
  const client = account?.capabilities?.find(
    (item) => item.capability === "CLIENT" && item.status === "ACTIVE"
  );
  if (!client) throw new Error("CLIENT capability was not automatically enabled");
}

async function signOut(token) {
  const { response, body } = await jsonRequest(`${supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      ...supabaseHeaders,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase sign-out failed (${response.status}): ${JSON.stringify(body)}`);
  }
}

async function main() {
  console.log("Phase 2 gate: Register → Verify → Sync → CLIENT → Profile → Sign out → Sign in → Retain identity");

  await attemptSignup();
  const firstToken = await signIn();

  const synchronized = await hustleRequest("/auth/sync", firstToken, { method: "POST" });
  assertClient(synchronized);
  const originalId = synchronized.id;

  const completed = await hustleRequest("/auth/profile", firstToken, {
    method: "PATCH",
    body: JSON.stringify({ displayName, username })
  });
  if (!completed.onboardingCompleted) {
    throw new Error("Profile completion did not set onboardingCompleted=true");
  }

  await signOut(firstToken);
  const secondToken = await signIn();
  const retained = await hustleRequest("/auth/me", secondToken);
  assertClient(retained);

  if (retained.id !== originalId) {
    throw new Error(`Identity changed across sign-out/sign-in: ${originalId} → ${retained.id}`);
  }

  if (!retained.onboardingCompleted || retained.username !== username.toLowerCase()) {
    throw new Error("Profile/reputation identity state was not retained after sign-in");
  }

  console.log(`PASS — Hustle identity ${retained.id} retained with active CLIENT capability.`);
}

main().catch((error) => {
  console.error(`FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
