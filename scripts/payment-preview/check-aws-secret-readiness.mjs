// UX049 — no secrets ever sent to ChatGPT, PR comments or workflow logs.
// Validate the protected, private AWS secret in the GitHub Actions runner
// BEFORE any ECR build or public Lambda/Cloudflare resource is created.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const ROLE = "hustle_payment_preview_api";
const DATABASE = "/hustle_payment_preview";
const SECRET = "hustle-payment-preview-credentials";
const ACCOUNT = "707859598737";
const EXPECTED_KEYS = [
  "BETTER_AUTH_SECRET", "DATABASE_URL", "HUSTLE_STAGING_TEST_EMAILS",
  "PAYSTACK_TEST_SECRET_KEY", "STAGING_AUTH_DATABASE_URL"
];

function reject(code) { throw new Error("REFUSED: payment-preview preflight " + code); }
function readDatabaseUrl(raw, schema) {
  if (typeof raw !== "string" || raw === "NOT_CONFIGURED") reject(schema + " DB URL not configured");
  let url;
  try { url = new URL(raw); } catch { reject(schema + " DB URL invalid"); }
  const pairs = [...url.searchParams.keys()];
  if (url.protocol !== "postgresql:" || url.hostname !== HOST ||
      url.pathname !== DATABASE || url.username !== ROLE ||
      !url.password || url.password.length < 16 ||
      url.port || url.hash || url.searchParams.get("sslmode") !== "require" ||
      url.searchParams.get("schema") !== schema ||
      pairs.length !== 2 || new Set(pairs).size !== 2 ||
      pairs.some(k => !["sslmode","schema"].includes(k))) {
    reject(schema + " DB URL must use the exact isolated Neon direct host, runtime role and TLS schema");
  }
  return url;
}
export function validatePreviewSecret(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(EXPECTED_KEYS.slice().sort())) {
    reject("unexpected AWS secret keys");
  }
  const app = readDatabaseUrl(value.DATABASE_URL, "public");
  const auth = readDatabaseUrl(value.STAGING_AUTH_DATABASE_URL, "payment_auth");
  if (app.password !== auth.password || app.username !== auth.username ||
      app.hostname !== auth.hostname) reject("database role credentials differ between schemas");
  if (typeof value.BETTER_AUTH_SECRET !== "string" ||
      value.BETTER_AUTH_SECRET === "NOT_CONFIGURED" ||
      value.BETTER_AUTH_SECRET.length < 32) reject("dedicated Better Auth secret missing or too short");
  if (typeof value.PAYSTACK_TEST_SECRET_KEY !== "string" ||
      !/^sk_test_[A-Za-z0-9]{12,}$/.test(value.PAYSTACK_TEST_SECRET_KEY)) {
    reject("Paystack TEST-only key missing or invalid; never use Live");
  }
  if (typeof value.HUSTLE_STAGING_TEST_EMAILS !== "string") reject("invited test account list missing");
  const emails = value.HUSTLE_STAGING_TEST_EMAILS.split(",").map(s=>s.trim().toLowerCase());
  if (!emails.length || emails.length > 10 || new Set(emails).size !== emails.length ||
      !emails.every(s=>/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(s))) {
    reject("expected 1–10 unique invited test email addresses");
  }
  return {database:"hustle_payment_preview",runtimeRole:ROLE,
    authSchema:"payment_auth",invitedTestAccountCount:emails.length,
    gateway:"paystack-test",noLiveProviders:true};
}

function aws(args) {
  try {
    // stdout contains sensitive data: never log it or include it in errors.
    return execFileSync("aws", [...args,"--region","eu-west-2","--output","json"],
      {encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:1024*1024,timeout:30000});
  } catch { reject("AWS preview secret metadata/read unavailable"); }
}
export function validateProtectedAwsSecret() {
  if (process.env.GITHUB_REPOSITORY !== "realxpen/hustle-economy-of-you" ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      process.env.HUSTLE_PREVIEW_SECRET_CHECK !== "I_AUTHORIZE_READ_ONLY_TEST_SECRET_CHECK") {
    reject("requires protected manually authorized main-branch check");
  }
  let identity,metadata,record;
  try {
    identity = JSON.parse(aws(["sts","get-caller-identity"]));
    if (identity.Account !== ACCOUNT) reject("wrong AWS account");
    metadata = JSON.parse(aws(["secretsmanager","describe-secret","--secret-id",SECRET]));
    if (metadata.Name !== SECRET ||
        !metadata.ARN.startsWith("arn:aws:secretsmanager:eu-west-2:"+ACCOUNT+":secret:"+SECRET+"-")) {
      reject("wrong secret ARN");
    }
    record = JSON.parse(aws(["secretsmanager","get-secret-value","--secret-id",metadata.ARN]));
  } catch (e) {
    if (e.message?.startsWith("REFUSED:")) throw e;
    reject("metadata or secret JSON cannot be safely read");
  }
  let values;
  try { values=JSON.parse(record.SecretString); }
  catch { reject("secret JSON malformed"); }
  const summary=validatePreviewSecret(values);
  const status=metadata.Tags?.find(t=>t.Key==="status")?.Value;
  if (!["not-configured","configured-test-only"].includes(status)) reject("unexpected secret activation tag");
  console.log("PASS: private AWS test-only secret has correct Neon runtime/auth schemas, valid test-only payment config, invited users and no Live keys.");
  console.log("Secret activation tag: " + status + ". No resources deployed or updated.");
  console.log("Invited TEST accounts: " + summary.invitedTestAccountCount + " (emails redacted)");
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {validateProtectedAwsSecret();}
  catch(e){console.error(e.message?.startsWith("REFUSED:") ? e.message : "REFUSED: secret check failed");process.exitCode=1;}
}
