#!/usr/bin/env node
"use strict";
/** Execute actual staging AuthPort TS source with LOCAL generated Ed25519 keys. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const oldTs = Module._extensions[".ts"];
Module._extensions[".ts"] = (m,filename) => {
  const compiled = ts.transpileModule(readFileSync(filename,"utf8"), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,strict:true,
      experimentalDecorators:true,emitDecoratorMetadata:true},reportDiagnostics:true
  });
  assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,filename);
  m._compile(compiled.outputText,filename);
};
const { NeonStagingAuthService } = require(path.join(root,"apps/api/src/auth/neon-staging-auth.service.ts"));
const { ExpoStagingAuthService } = require(path.join(root,"apps/api/src/auth/expo-staging-auth.service.ts"));
const { NEON_STAGING, NEON_EXPO_CHILD, EXPO_STAGING_AUTH_URL, validateApiRuntimeEnvironment, chooseHustleAuthPort } =
  require(path.join(root,"apps/api/src/auth/staging-auth-selection.ts"));
const production = readFileSync(path.join(root,"apps/api/src/auth/supabase-auth.service.ts"),"utf8");
const authModule = readFileSync(path.join(root,"apps/api/src/auth/auth.module.ts"),"utf8");
const main = readFileSync(path.join(root,"apps/api/src/main.ts"),"utf8");
const isolatedSource = readFileSync(path.join(root,"infra/neon/staging/stagingConfig.mjs"),"utf8");
const now = Math.floor(Date.now()/1000);
const { publicKey,privateKey } = crypto.generateKeyPairSync("ed25519");
const jwk = publicKey.export({format:"jwk"});
const key = { ...jwk, kid:"staging-testing-kid", alg:"EdDSA", use:"sig" };
const { privateKey:wrongPrivateKey } = crypto.generateKeyPairSync("ed25519");
const header = { alg:"EdDSA",typ:"JWT",kid:key.kid };
const claims = { iss:NEON_STAGING.authBaseUrl,aud:NEON_STAGING.authBaseUrl,
  sub:"disposable-test-user",email:"test@example.invalid",iat:now,exp:now+600 };
const b64 = item => Buffer.from(JSON.stringify(item)).toString("base64url");
const sign = (payload=claims, head=header, signer=privateKey) => {
  const input=b64(head)+"."+b64(payload);
  return input+"."+crypto.sign(null,Buffer.from(input),signer).toString("base64url");
};
let jwksRequests=0;
let configuredJwks={keys:[key]};
const fetcher=async (url,opts) => {
  jwksRequests++;
  assert.equal(url,NEON_STAGING.jwksUrl);
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"error");
  return new Response(JSON.stringify(configuredJwks),{status:200});
};
const service = new NeonStagingAuthService(fetcher);
function check(name,fn) {
  return Promise.resolve().then(fn).then(()=>console.log("PASS: "+name));
}
(async()=>{
  await check("One valid short-lived staging JWT maps only verified identity claims",async()=>{
    const identity=await service.verifyAccessToken(sign());
    assert.deepEqual(identity,{
      subject:"disposable-test-user",email:"test@example.invalid",phone:undefined,
      emailVerified:false,phoneVerified:false
    });
    const verified=await service.verifyAccessToken(sign({...claims,email_verified:true}));
    assert.equal(verified.emailVerified,true);
    assert.equal(jwksRequests,1,"JWKS response cached, no unexpected second request");
  });

  await check("Reject untrusted issuer, audience, subject, expiry, nbf and excessive lifetime",async()=>{
    for (const payload of [
      {...claims,iss:"https://another-tenant.neonauth.example/auth"},
      {...claims,iss:"https://example.supabase.co/auth/v1"},
      {...claims,aud:"https://another-tenant.neonauth.example/auth"},
      {...claims,aud:["https://other.example"]},
      {...claims,sub:""},
      {...claims,sub:42},
      {...claims,iat:now+150},
      {...claims,iat:"just now"},
      {...claims,exp:now-120},
      {...claims,exp:now+6000},
      {...claims,exp:"tomorrow"},
      {...claims,nbf:now+100}
    ]) await assert.rejects(()=>service.verifyAccessToken(sign(payload)),/Invalid or expired staging access token/);
  });
  await check("Reject unsigned, HS256, tampered, unknown-kid and wrong-private-key tokens",async()=>{
    for (const token of [
      "not.a.token", "bearer token", "",sign(claims,{alg:"none",kid:key.kid}),
      sign(claims,{alg:"HS256",kid:key.kid}),
      sign(claims,{...header,kid:"no-such-key"}),
      sign(claims,{...header,crit:["unexpected"]}),
      sign(claims,header,wrongPrivateKey),
      sign().slice(0,-2)+"abc"
    ]) await assert.rejects(()=>service.verifyAccessToken(token),/Invalid or expired staging access token/);
  });

  await check("Reject attacker-controlled JWKS keys or failed fetch, never accept alternate URL",async()=>{
    const attacker = new NeonStagingAuthService(async url=>{
      assert.equal(url,NEON_STAGING.jwksUrl);
      return new Response(JSON.stringify({keys:[{...key,d:"secret"}]}),{status:200});
    });
    await assert.rejects(()=>attacker.verifyAccessToken(sign()),/Invalid or expired staging access token/);
    const offline = new NeonStagingAuthService(async()=>{throw Error("offline");});
    await assert.rejects(()=>offline.verifyAccessToken(sign()),/Invalid or expired staging access token/);
    const duplicate = new NeonStagingAuthService(async()=>
      new Response(JSON.stringify({keys:[key,key]}),{status:200}));
    await assert.rejects(()=>duplicate.verifyAccessToken(sign()),/Invalid or expired staging access token/);
  });

  const env = {
    HUSTLE_RUNTIME_SCOPE:"isolated-staging",HUSTLE_AUTH_PROVIDER:"expo-better-auth",
    HUSTLE_STAGING_PROJECT_ID:NEON_STAGING.projectId,
    HUSTLE_STAGING_BRANCH_ID:NEON_EXPO_CHILD.branchId,
    BETTER_AUTH_URL:EXPO_STAGING_AUTH_URL,
    BETTER_AUTH_SECRET:"generated-contract-only-secret-32-characters",
    HUSTLE_STAGING_TEST_EMAILS:"test@example.invalid",
    STAGING_AUTH_DATABASE_URL:"postgresql://hustle_child_api:placeholder@"+NEON_EXPO_CHILD.host+"/hustle_staging?sslmode=require&schema=hustle_auth",
    EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS:"false",
    HUSTLE_FINANCIAL_PROVIDERS_ENABLED:"false",
    DATABASE_URL:"postgresql://hustle_child_api:placeholder@"+NEON_EXPO_CHILD.host+
      "/hustle_staging?sslmode=require"
  };
  await check("Runtime identity enforces exact Neon project, PostgreSQL TLS and disabled commerce",()=>{
    assert.equal(validateApiRuntimeEnvironment(env),"isolated-staging");
    for(const [k,v] of [
      ["HUSTLE_RUNTIME_SCOPE","production"],
      ["HUSTLE_RUNTIME_SCOPE","wrong"],
      ["HUSTLE_AUTH_PROVIDER","supabase"],
      ["HUSTLE_AUTH_PROVIDER","neon-managed"],
      ["BETTER_AUTH_URL","https://foreign.example/api/auth"],
      ["BETTER_AUTH_SECRET","short"],
      ["HUSTLE_STAGING_TEST_EMAILS",""],
      ["STAGING_AUTH_DATABASE_URL",env.DATABASE_URL],
      ["HUSTLE_STAGING_PROJECT_ID","another-project"],
      ["HUSTLE_STAGING_BRANCH_ID","br-wrong-branch"],
      ["DATABASE_URL","postgresql://hustle_child_api:placeholder@"+NEON_STAGING.hosts[0]+"/hustle_staging?sslmode=require"],
      ["DATABASE_URL","postgresql://hustle_staging_owner:placeholder@"+NEON_EXPO_CHILD.host+"/hustle_staging?sslmode=require"],
      ["NEON_AUTH_BASE_URL","https://evil.example"],
      ["NEON_AUTH_JWKS_URL","https://evil.example/jwks"],
      ["SUPABASE_URL","https://production.supabase.co"],
      ["SUPABASE_PUBLISHABLE_KEY","public"],
      ["SUPABASE_SERVICE_ROLE_KEY","secret"],
      ["PAYSTACK_SECRET_KEY","secret"],
      ["MONIFLOW_PARTNER_HMAC_SECRET","secret"],
      ["EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS","true"],
      ["HUSTLE_FINANCIAL_PROVIDERS_ENABLED","true"],
      ["DATABASE_URL","postgresql://bad:bad@localhost/prod?sslmode=require"],
      ["DATABASE_URL","postgresql://bad:bad@"+NEON_STAGING.hosts[0]+"/other?sslmode=require"],
      ["DATABASE_URL","postgresql://bad:bad@"+NEON_STAGING.hosts[0]+"/hustle_staging"]
    ]) assert.throws(()=>validateApiRuntimeEnvironment({...env,[k]:v}));
    assert.equal(validateApiRuntimeEnvironment({}),"production");
    assert.equal(validateApiRuntimeEnvironment({HUSTLE_RUNTIME_SCOPE:"production"}),"production");
    assert.throws(()=>validateApiRuntimeEnvironment({HUSTLE_AUTH_PROVIDER:"neon-managed"}));
    assert.throws(()=>validateApiRuntimeEnvironment({NEON_AUTH_BASE_URL:NEON_STAGING.authBaseUrl}));
  });
  await check("Production Supabase port retained; staging uses Expo Better Auth without fallback",()=>{
    const supabase={verifyAccessToken:async()=>({subject:"supabase"})};
    assert.equal(chooseHustleAuthPort(supabase,{}),supabase);
    assert.equal(chooseHustleAuthPort(supabase,{HUSTLE_RUNTIME_SCOPE:"production"}),supabase);
    assert.ok(chooseHustleAuthPort(supabase,env) instanceof ExpoStagingAuthService);
    assert.throws(()=>chooseHustleAuthPort(supabase,{...env,NEON_AUTH_JWKS_URL:"https://evil"}));
    assert.match(authModule,/chooseHustleAuthPort\(supabase\)/);
    assert.doesNotMatch(authModule,/useExisting: SupabaseAuthService/);
    assert.match(main,/validateApiRuntimeEnvironment\(process\.env\)/);
    assert.ok(main.indexOf("validateApiRuntimeEnvironment(process.env)") <
      main.indexOf("NestFactory.create(AppModule"));
    assert.match(production,/this\.client\.auth\.getUser\(token\)/);
  });
  await check("TypeScript and existing source-only guard pin the same separate tenant",()=>{
    for (const literal of [
      NEON_STAGING.projectId,NEON_STAGING.authBaseUrl,
      NEON_STAGING.jwksUrl,NEON_STAGING.hosts[0],NEON_STAGING.database
    ]) assert.ok(isolatedSource.includes(literal),literal);
  });
  console.log("PASS: Staging auth strict verification; no live account or deployment was used.");
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{
  if(oldTs) Module._extensions[".ts"]=oldTs;
  else delete Module._extensions[".ts"];
});
