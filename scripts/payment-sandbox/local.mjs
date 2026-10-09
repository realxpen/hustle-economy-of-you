import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const compose = ["compose", "-f", "docker-compose.payment-sandbox.yml"];
const environment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public",
  HUSTLE_SANDBOX_WEBHOOK_SECRET: randomBytes(32).toString("hex")
};
function call(program, args, options={}) {
  const p = spawnSync(program,args,{
    cwd:process.cwd(),env:environment,stdio:"inherit",encoding:"utf8",...options
  });
  if(p.status !== 0) throw new Error(`Failed: ${program} ${args.join(" ")}`);
}
let started=false;
try {
  call("docker",[...compose,"up","-d","--wait"]);
  started=true;
  // Mimic the Supabase anon/authenticated roles used by the real RLS migrations.
  call("docker",[...compose,"exec","-T","sandbox-db",
    "psql","-v","ON_ERROR_STOP=1","-U","postgres","-d","hustle_payment_sandbox"],
    {input:readFileSync("scripts/payment-sandbox/supabase-compat.sql","utf8"),stdio:["pipe","inherit","inherit"]});
  call("npx",["prisma","migrate","deploy","--schema=apps/api/prisma/schema.prisma"]);
  call("npm",["run","build","--workspace=@hustle/api"]);
  call("node",["scripts/payment-sandbox/run.mjs"]);
  console.log("Isolated payment sandbox assertions passed.");
} catch(error) {
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
} finally {
  if(started){
    const stop=spawnSync("docker",[...compose,"down","-v"],{stdio:"inherit",encoding:"utf8"});
    if(stop.status!==0)process.exitCode=1;
  }
}
