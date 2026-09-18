import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, openSync, closeSync } from "node:fs";
import { arch, platform } from "node:os";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = process.cwd();
const version = "1.13.7";
const toolsDir = resolve(root, ".hustle-tools", "livekit");
const binaryPath = resolve(toolsDir, "livekit-server");
const archivePath = resolve(toolsDir, `livekit_${version}.tar.gz`);
const pidPath = resolve(toolsDir, "livekit.pid");
const logPath = resolve(toolsDir, "livekit.log");

function commandExists(command) {
  return spawnSync("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`]).status === 0;
}

function parseEnv(path) {
  if (!existsSync(path)) return new Map();
  const map = new Map();
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = rawLine.indexOf("=");
    if (index < 0) continue;
    map.set(rawLine.slice(0, index).trim(), rawLine.slice(index + 1).trim());
  }
  return map;
}

function value(key, ...maps) {
  for (const map of maps) {
    const candidate = map.get(key);
    if (candidate) return candidate;
  }
  return "";
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function downloadBinary() {
  if (platform() !== "linux") {
    throw new Error("The zero-Docker LiveKit fallback currently supports Linux. Install Docker or use a configured LiveKit endpoint on this OS.");
  }

  const machineArch = arch();
  const releaseArch = machineArch === "x64" ? "amd64" : machineArch === "arm64" ? "arm64" : null;
  if (!releaseArch) throw new Error(`Unsupported Linux architecture for local LiveKit: ${machineArch}`);

  mkdirSync(toolsDir, { recursive: true });
  const url = `https://github.com/livekit/livekit/releases/download/v${version}/livekit_${version}_linux_${releaseArch}.tar.gz`;
  console.log(`Docker is unavailable. Downloading LiveKit Server v${version} for linux/${releaseArch}…`);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`LiveKit download failed: HTTP ${response.status}`);
  }

  const out = createWriteStream(archivePath);
  await pipeline(Readable.fromWeb(response.body), out);

  const extracted = spawnSync("tar", ["-xzf", archivePath, "-C", toolsDir], { stdio: "inherit" });
  if (extracted.status !== 0) throw new Error("Could not extract the LiveKit server archive");
  if (!existsSync(binaryPath)) throw new Error("LiveKit archive did not contain livekit-server");

  chmodSync(binaryPath, 0o755);
}

const rootEnv = parseEnv(resolve(root, ".env"));
const apiEnv = parseEnv(resolve(root, "apps/api/.env"));
const livekitUrl = value("LIVEKIT_URL", apiEnv, rootEnv);
const apiKey = value("LIVEKIT_API_KEY", apiEnv, rootEnv);
const apiSecret = value("LIVEKIT_API_SECRET", apiEnv, rootEnv);

if (!livekitUrl || !apiKey || !apiSecret) {
  throw new Error("Run npm run live:setup first so LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET exist locally.");
}

if (livekitUrl !== "ws://localhost:7880" && livekitUrl !== "ws://127.0.0.1:7880") {
  console.log(`LIVEKIT_URL is already configured as ${livekitUrl}.`);
  console.log("No local server was started; use that configured LiveKit endpoint.");
  process.exit(0);
}

if (commandExists("docker")) {
  const docker = spawnSync("docker", ["compose", "--profile", "live", "up", "-d", "livekit"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret }
  });
  if (docker.status === 0) {
    console.log("Local LiveKit is running through Docker on ws://localhost:7880.");
    process.exit(0);
  }
  console.warn("Docker was found but could not start LiveKit. Falling back to the local Linux binary.");
}

if (existsSync(pidPath)) {
  const previousPid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
  if (processAlive(previousPid)) {
    console.log(`Local LiveKit is already running (PID ${previousPid}) on ws://localhost:7880.`);
    process.exit(0);
  }
}

if (!existsSync(binaryPath)) await downloadBinary();

mkdirSync(toolsDir, { recursive: true });
const logFd = openSync(logPath, "a");
const child = spawn(binaryPath, [
  "--dev",
  "--bind", "127.0.0.1",
  "--node-ip", "127.0.0.1",
  "--udp-port", "7882"
], {
  cwd: root,
  detached: true,
  stdio: ["ignore", logFd, logFd],
  env: {
    ...process.env,
    LIVEKIT_KEYS: `${apiKey}: ${apiSecret}`
  }
});
child.unref();
closeSync(logFd);
writeFileSync(pidPath, String(child.pid));

await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
if (!processAlive(child.pid)) {
  throw new Error(`LiveKit exited during startup. Inspect ${logPath}`);
}

console.log(`Local LiveKit Server v${version} started without Docker (PID ${child.pid}).`);
console.log("Signal: ws://localhost:7880");
console.log("RTC: TCP 7881 / UDP 7882");
console.log(`Log: ${logPath}`);
