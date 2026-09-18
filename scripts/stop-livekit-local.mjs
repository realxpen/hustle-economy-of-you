import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pidPath = resolve(root, ".hustle-tools", "livekit", "livekit.pid");

function commandExists(command) {
  return spawnSync("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`]).status === 0;
}

if (commandExists("docker")) {
  spawnSync("docker", ["compose", "--profile", "live", "stop", "livekit"], {
    cwd: root,
    stdio: "inherit"
  });
}

if (existsSync(pidPath)) {
  const pid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped local LiveKit binary (PID ${pid}).`);
    } catch (reason) {
      if (reason?.code !== "ESRCH") throw reason;
    }
  }
  rmSync(pidPath, { force: true });
}
