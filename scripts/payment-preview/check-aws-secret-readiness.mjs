// UX049: read-only, credential-redacting validation of the NEW payment-preview
// AWS Secrets Manager JSON. This never prints, stores, or forwards secret values.
// Entrypoint reads SecretString from standard input, after AWS OIDC auth.
// This is structural validation, NOT authorization to deploy or move money.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HOST = "ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const DB = "hustle_payment_preview";
const ROLE = "hustle_payment_preview_api";
const FIELDS = [
  "DATABASE_URL", "STAGING_AUTH_DATABASE_URL", "BETTER_AUTH_SECRET",
  "HUSTLE_STAGING_TEST_EMAILS", "PAYSTACK_TEST_SECRET_KEY"
];
const EMAIL = /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/;
function failure(field,reason) {
  // IMPORTANT: field and reason are internally fixed strings.
  throw new Error("REFUSED: "+field+": "+reason);
}
function checkUrl(value,field,schema) {
  if (typeof value !== "string" || !value.startsWith("postgresql://"))
    failure(field,"must be a real PostgreSQL connection URI beginning postgresql://");
  let u;
  try { u = new URL(value); }
  catch { failure(field,"malformed PostgreSQL connection URI"); }
  if(u.protocol !== "postgresql:" || u.username !== ROLE)
    failure(field,"requires the dedicated Neon API runtime role");
  if(u.hostname !== HOST || u.pathname !== "/"+DB || u.port ||
     u.hash || u.username.includes("%"))
    failure(field,"wrong Neon direct host, database, port or fragment");
  if(!u.password || decodeURIComponent(u.password).length < 16)
    failure(field,"dedicated Neon runtime password missing or too short");
  const keys=[...u.searchParams.keys()];
  if(keys.length!==new Set(keys).size ||
     keys.length!==2 || keys.some(k=>!["sslmode","schema"].includes(k)) ||
     u.searchParams.get("sslmode")!=="require" ||
     u.searchParams.get("schema")!==schema)
    failure(field,"requires only sslmode=require and schema="+schema);
  if(value !== value.trim())
    failure(field,"unexpected whitespace around connection URI");
  return u;
}
export function validateSecret(d) {
  if(!d || typeof d!=="object" || Array.isArray(d))
    failure("SecretString","must be a JSON object");
  const keys=Object.keys(d).sort();
  if(JSON.stringify(keys)!==JSON.stringify([...FIELDS].sort()))
    failure("SecretString","exactly five dedicated preview secret fields required");
  const app=checkUrl(d.DATABASE_URL,"DATABASE_URL","public");
  const auth=checkUrl(d.STAGING_AUTH_DATABASE_URL,"STAGING_AUTH_DATABASE_URL","payment_auth");
  if(app.password!==auth.password || app.username!==auth.username ||
     app.hostname!==auth.hostname || app.pathname!==auth.pathname)
    failure("STAGING_AUTH_DATABASE_URL","must share the same dedicated Neon runtime login as DATABASE_URL");
  if(typeof d.BETTER_AUTH_SECRET!=="string" || d.BETTER_AUTH_SECRET.length<32 ||
     d.BETTER_AUTH_SECRET==="NOT_CONFIGURED")
    failure("BETTER_AUTH_SECRET","must be a separate random secret of at least 32 characters");
  if(typeof d.HUSTLE_STAGING_TEST_EMAILS!=="string" ||
     d.HUSTLE_STAGING_TEST_EMAILS.length>1500)
    failure("HUSTLE_STAGING_TEST_EMAILS","must be a comma-separated invited test account list");
  const emails=d.HUSTLE_STAGING_TEST_EMAILS.split(",").map(x=>x.trim().toLowerCase());
  if(emails.length<1 || emails.length>10 ||
     emails.some(x=>!EMAIL.test(x)) ||
     new Set(emails).size!==emails.length)
    failure("HUSTLE_STAGING_TEST_EMAILS","requires 1-10 distinct valid test emails");
  if(typeof d.PAYSTACK_TEST_SECRET_KEY!=="string" ||
     !/^sk_test_[A-Za-z0-9]{12,}$/.test(d.PAYSTACK_TEST_SECRET_KEY))
    failure("PAYSTACK_TEST_SECRET_KEY","must be a Paystack sk_test_ key only, never sk_live_");
  return {ready:true};
}
function main() {
  let data;
  try {data=JSON.parse(readFileSync(0,"utf8"));}
  catch {failure("SecretString","cannot parse AWS secret as JSON");}
  validateSecret(data);
  console.log("PASS: dedicated TEST-only secret fields structurally valid; no credentials printed, no provider calls, no deployment.");
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {main();}
  catch(e) {console.error(e.message);process.exitCode=1;}
}
