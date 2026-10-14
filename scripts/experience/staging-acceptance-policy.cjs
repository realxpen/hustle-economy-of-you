"use strict";
/** Fail-closed, read-only stage verification. No secrets are ever printed. */
const fs = require("node:fs");
const path = require("node:path");

function nonProductionOrigin(raw, approved, trustedDomain) {
  if (!raw || !approved || raw !== approved) throw Error("Staging origin must exactly match explicitly approved origin");
  let parsed;
  try { parsed = new URL(raw); } catch { throw Error("Invalid staging URL"); }
  if (parsed.origin !== raw || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      parsed.username || parsed.password || parsed.port || parsed.protocol !== "https:") {
    throw Error("Staging origin must be a canonical HTTPS origin, without credentials, port, path or query");
  }
  const host = parsed.hostname.toLowerCase();
  const suffix = String(trustedDomain || "").toLowerCase().trim();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+){1,5}$/.test(suffix) ||
      !host.endsWith("." + suffix) || host === suffix) {
    throw Error("REFUSED: staging hostname is not a subdomain of the trusted project domain");
  }
  const parts = host.split(".");
  if (!parts.some((segment) => /^(staging|stage|qa|sandbox|preview)(?:-[a-z0-9-]+)?$/.test(segment))) {
    throw Error("REFUSED: host must explicitly identify a nonproduction staging/qa/preview environment");
  }
  if (parts.length < 3 || host.endsWith(".local") || host.endsWith(".localhost")) {
    throw Error("REFUSED: staging must use a concrete HTTPS hostname");
  }
  return parsed.origin;
}

function privateStateFile(raw, repositoryRoot = process.cwd()) {
  if (!raw || !path.isAbsolute(raw)) throw Error("Authentication state must use an absolute private file path");
  const real = fs.realpathSync(raw);
  const root = fs.realpathSync(repositoryRoot);
  if (real === root || real.startsWith(root + path.sep)) throw Error("REFUSED: do not store session state inside the Hustle repository");
  if (!fs.statSync(real).isFile()) throw Error("Authentication state is not a file");
  if (process.platform !== "win32" && (fs.statSync(real).mode & 0o077)) {
    throw Error("Session state file permissions must be private (chmod 600)");
  }
  const data = JSON.parse(fs.readFileSync(real, "utf8"));
  if (!data || !Array.isArray(data.cookies) || !Array.isArray(data.origins) ||
      (data.cookies.length === 0 && data.origins.length === 0)) {
    throw Error("Invalid or empty Playwright storageState file");
  }
  return real;
}

function prepare(env, root = process.cwd()) {
  if (env.HUSTLE_QA_CONFIRM !== "NONPRODUCTION_READ_ONLY") throw Error("Set HUSTLE_QA_CONFIRM=NONPRODUCTION_READ_ONLY");
  const origin = nonProductionOrigin(
    env.HUSTLE_QA_WEB_ORIGIN, env.HUSTLE_QA_APPROVED_ORIGIN,
    env.HUSTLE_QA_ALLOWED_DOMAIN
  );
  const serviceId = env.HUSTLE_QA_SERVICE_ID || "";
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(serviceId)) throw Error("Require a published staging Service ID");
  const clientHandle = env.HUSTLE_QA_CLIENT_HANDLE || "";
  const hustlerHandle = env.HUSTLE_QA_HUSTLER_HANDLE || "";
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(clientHandle) ||
      !/^[a-zA-Z0-9_-]{3,30}$/.test(hustlerHandle) ||
      clientHandle.toLowerCase() === hustlerHandle.toLowerCase()) {
    throw Error("Require two distinct nonproduction Client and Hustler usernames");
  }
  return {
    origin, serviceId, clientHandle, hustlerHandle,
    clientState: privateStateFile(env.HUSTLE_QA_CLIENT_STATE, root),
    hustlerState: privateStateFile(env.HUSTLE_QA_HUSTLER_STATE, root)
  };
}
module.exports = { nonProductionOrigin, privateStateFile, prepare };
