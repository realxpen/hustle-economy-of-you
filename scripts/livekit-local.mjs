import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, chmodSync, openSync, closeSync } from "node:fs";
import { get as httpsGet } from "node:https";
import net from "node:net";
import { basename, join, resolve } from "node:path";

const VERSION = "1.13.7";
const ROOT = process.cwd();
const STATE_DIR = resolve(ROOT, ".hustle/livekit");
const VERSION_DIR = join(STATE_DIR, VERSION);
const PID_PATH = join(STATE_DIR, "livekit.pid");
const LOG_PATH = join(STATE_DIR, "livekit.log");
const CONFIG_PATH = join(STATE_DIR, "livekit.yaml");

const assets = {
  "linux-x64": {
    file: `livekit_${VERSION}_linux_amd64.tar.gz`,
    sha256: "6634aeeb2fb1366b6723708ae4320b9d5408106a4c63457c5e845ae3979c90e2"
  },
  "linux-arm64": {
    file: `livekit_${VERSION}_linux_arm64.tar.gz`,
    sha256: "5d167fdf52cf43c0c72972f25325364479f41f854bfef651056eab2504da5de9"
  }
};

function readEnv(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = rawLine.indexOf("=");
    if (index < 0) continue;
    values[rawLine.slice(0, index).trim()] = rawLine.slice(index + 1).trim();
  }
  return values;
}

function config() {
  const rootEnv = readEnv(resolve(ROOT, ".env"));
  const apiEnv = readEnv(resolve(ROOT, "apps/api/.env"));
  const value = (key) => apiEnv[key] || rootEnv[key] || process.env[key] || "";
  const url = value("LIVEKIT_URL");
  const apiKey = value("LIVEKIT_API_KEY");
  const apiSecret = value("LIVEKIT_API_SECRET");

  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit local credentials are missing. Run npm run live:setup first.");
  }
  return { url, apiKey, apiSecret };
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function portOpen(port = 7880) {
  return new Promise((resolveOpen) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveOpen(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await portOpen()) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  return false;
}

function download(url, destination) {
  return new Promise((resolveDownload, reject) => {
    const request = httpsGet(url, { headers: { "user-agent": "hustle-phase17b-local-setup" } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        download(response.headers.location, destination).then(resolveDownload, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`LiveKit download failed with HTTP ${response.statusCode}`));
        return;
      }
      const file = createWriteStream(destination);
      response.pipe(file);
      file.once("finish", () => file.close(resolveDownload));
      file.once("error", reject);
    });
    request.once("error", reject);
  });
}

function sha256(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function findBinary(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      const nested = findBinary(path);
      if (nested) return nested;
    } else if (name === "livekit-server") {
      return path;
    }
  }
  return null;
}

async function ensureBinary() {
  const key = `${process.platform}-${process.arch}`;
  const asset = assets[key];
  if (!asset) {
    throw new Error(
      `Docker is unavailable and automatic LiveKit binary fallback currently supports Linux x64/arm64 only (detected ${key}).`
    );
  }

  mkdirSync(VERSION_DIR, { recursive: true });
  const existing = findBinary(VERSION_DIR);
  if (existing) return existing;

  const archive = join(VERSION_DIR, asset.file);
  const temp = `${archive}.download`;
  const url = `https://github.com/livekit/livekit/releases/download/v${VERSION}/${asset.file}`;

  console.log(`Docker is unavailable. Downloading verified LiveKit Server v${VERSION} for ${key}…`);
  rmSync(temp, { force: true });
  await download(url, temp);

  const digest = sha256(temp);
  if (digest !== asset.sha256) {
    rmSync(temp, { force: true });
    throw new Error("Downloaded LiveKit archive checksum did not match the pinned release.");
  }

  renameSync(temp, archive);
  const extracted = spawnSync("tar", ["-xzf", archive, "-C", VERSION_DIR], { stdio: "inherit" });
  if (extracted.error || extracted.status !== 0) {
    throw new Error("Could not extract the LiveKit archive. Ensure the standard tar utility is installed.");
  }

  const binary = findBinary(VERSION_DIR);
  if (!binary) throw new Error("LiveKit archive extracted but livekit-server was not found.");
  chmodSync(binary, 0o755);
  return binary;
}

function yaml(configValues) {
  return `port: 7880
log_level: info
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: false
  node_ip: 127.0.0.1
  enable_loopback_candidate: true
keys:
  ${configValues.apiKey}: ${configValues.apiSecret}
room:
  empty_timeout: 300
  departure_timeout: 20
`;
}

async function upWithBinary() {
  if (await portOpen()) {
    console.log("LiveKit is already listening on ws://localhost:7880");
    return;
  }

  const values = config();
  const binary = await ensureBinary();
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, yaml(values), { mode: 0o600 });

  const logFd = openSync(LOG_PATH, "a");
  const child = spawn(binary, ["--config", CONFIG_PATH], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd]
  });
  child.unref();
  closeSync(logFd);
  writeFileSync(PID_PATH, String(child.pid), { mode: 0o600 });

  if (!(await waitForPort())) {
    throw new Error(`LiveKit did not become ready on port 7880. Inspect ${LOG_PATH}`);
  }

  console.log(`LiveKit Server v${VERSION} is running without Docker.`);
  console.log("Signal URL: ws://localhost:7880");
  console.log(`Logs: ${LOG_PATH}`);
}

function upWithDocker() {
  const result = spawnSync("docker", ["compose", "--profile", "live", "up", "-d", "livekit"], {
    cwd: ROOT,
    stdio: "inherit"
  });
  if (result.error || result.status !== 0) {
    throw new Error("Docker was detected but could not start the LiveKit service.");
  }
}

async function down() {
  let stopped = false;

  if (existsSync(PID_PATH)) {
    const pid = Number.parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
    if (Number.isFinite(pid)) {
      try {
        process.kill(-pid, "SIGTERM");
        stopped = true;
      } catch {
        try {
          process.kill(pid, "SIGTERM");
          stopped = true;
        } catch {
          // Process is already gone.
        }
      }
    }
    rmSync(PID_PATH, { force: true });
  }

  if (commandExists("docker")) {
    spawnSync("docker", ["compose", "--profile", "live", "stop", "livekit"], {
      cwd: ROOT,
      stdio: "ignore"
    });
  }

  console.log(stopped ? "Local LiveKit process stopped." : "No local LiveKit binary process was running.");
}

async function status() {
  const open = await portOpen();
  console.log(open ? "LiveKit is reachable at ws://localhost:7880" : "LiveKit is not listening on port 7880.");
  if (existsSync(PID_PATH)) {
    console.log(`Local binary PID: ${readFileSync(PID_PATH, "utf8").trim()}`);
  }
}

const action = process.argv[2] || "up";

try {
  if (action === "up") {
    if (commandExists("docker")) upWithDocker();
    else await upWithBinary();
  } else if (action === "down") {
    await down();
  } else if (action === "status") {
    await status();
  } else {
    throw new Error("Usage: node scripts/livekit-local.mjs <up|down|status>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
