import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const rootEnvPath = resolve(root, ".env");
const apiEnvPath = resolve(root, "apps/api/.env");

function parseEnv(path) {
  if (!existsSync(path)) return new Map();
  const map = new Map();
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = rawLine.indexOf("=");
    if (index < 0) continue;
    map.set(rawLine.slice(0, index).trim(), rawLine.slice(index + 1));
  }
  return map;
}

function currentValue(key, ...maps) {
  for (const map of maps) {
    const value = map.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function upsert(path, values) {
  const original = existsSync(path) ? readFileSync(path, "utf8") : "";
  let lines = original ? original.split(/\r?\n/) : [];
  const remaining = new Map(Object.entries(values));

  lines = lines.map((line) => {
    const index = line.indexOf("=");
    if (index < 0) return line;
    const key = line.slice(0, index).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key);
    remaining.delete(key);
    return `${key}=${value}`;
  });

  if (remaining.size > 0) {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push("# Phase 17B — local LiveKit media transport");
    for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  }

  writeFileSync(path, lines.join("\n").replace(/\n+$/, "") + "\n");
}

const rootEnv = parseEnv(rootEnvPath);
const apiEnv = parseEnv(apiEnvPath);
const force = process.argv.includes("--force");

const existingUrl = currentValue("LIVEKIT_URL", apiEnv, rootEnv);
const existingKey = currentValue("LIVEKIT_API_KEY", apiEnv, rootEnv);
const existingSecret = currentValue("LIVEKIT_API_SECRET", apiEnv, rootEnv);

const values = {
  LIVEKIT_URL: force ? "ws://localhost:7880" : existingUrl || "ws://localhost:7880",
  LIVEKIT_API_KEY: force ? `hustle_${randomBytes(8).toString("hex")}` : existingKey || `hustle_${randomBytes(8).toString("hex")}`,
  LIVEKIT_API_SECRET: force ? randomBytes(32).toString("base64url") : existingSecret || randomBytes(32).toString("base64url")
};

upsert(rootEnvPath, values);
upsert(apiEnvPath, values);

console.log("Phase 17B local LiveKit configuration is ready.");
console.log(`LIVEKIT_URL=${values.LIVEKIT_URL}`);
console.log(`LIVEKIT_API_KEY=${values.LIVEKIT_API_KEY}`);
console.log("LIVEKIT_API_SECRET was generated/preserved locally and was not printed.");
console.log("The same values were written to .env and apps/api/.env (both gitignored).");
