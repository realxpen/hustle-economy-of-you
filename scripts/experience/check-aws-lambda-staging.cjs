#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),YAML=require("yaml");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const docker=get("infra/aws/lambda/Dockerfile");
const ignore=get("infra/aws/lambda/Dockerfile.dockerignore");
const cf=get("infra/aws/lambda/staging-template.yaml");
const workflow=get(".github/workflows/hustle-aws-lambda-staging-deploy.yml");
const auth=get("apps/api/src/auth/staging-auth-selection.ts");
const frontend=get("apps/web/lib/api/isolated-web-proxy.ts");
const main=get("apps/api/src/main.ts");
const stagePolicy=get("apps/api/src/staging-request-policy.ts");
for(const [name,value] of [["CFN",cf],["AWS workflow",workflow]]){
  const parsed=YAML.parseDocument(value,{uniqueKeys:true});
  assert.equal(parsed.errors.length,0,name+" YAML syntax");
}
assert.match(docker,/FROM node:22-bookworm-slim AS builder/);
assert.match(docker,/npm ci --include=dev/);
assert.match(docker,/npm run build --workspace=@hustle\/api/);
assert.match(docker,/npm prune --omit=dev --ignore-scripts/);
assert.match(docker,/aws-lambda-adapter:1\.1\.0/);
assert.match(docker,/\/opt\/extensions\/lambda-adapter/);
assert.match(docker,/USER node/);
assert.match(docker,/AWS_LWA_PORT=8080/);
assert.match(docker,/AWS_LWA_READINESS_CHECK_PATH=\/api\/v1\/health/);
assert.match(ignore,/\*\*\/\.env\.\*/);
assert.match(ignore,/\.git/);
assert.ok(cf.includes("707859598737[.]dkr[.]ecr[.]eu-west-2"));
assert.match(cf,/Code:\s*\n\s*ImageUri: !Ref ImageUri/);
// The configured AWS account is limited to 10 concurrent executions.
 // AWS requires at least ten remain unreserved. Don't recreate the
 // failing CloudFormation stack by reserving two on a quota-ten account.
assert.doesNotMatch(cf,/ReservedConcurrentExecutions:/);
assert.match(cf,/Timeout: 28/);
assert.match(cf,/RetentionInDays: 7/);
assert.match(cf,/StagingSecretArn:/);
for(const name of ["DATABASE_URL","STAGING_AUTH_DATABASE_URL","BETTER_AUTH_SECRET","HUSTLE_SANDBOX_WEBHOOK_SECRET","HUSTLE_STAGING_TEST_EMAILS"]){
  assert.ok(cf.includes(name+": !Sub '{{resolve:secretsmanager:"),name+" must resolve secure AWS secret");
}
assert.match(cf,/HUSTLE_RUNTIME_SCOPE: isolated-staging/);
assert.match(cf,/HUSTLE_STAGING_BRANCH_ID: br-dark-sunset-zay33p1s/);
assert.match(cf,/HUSTLE_FINANCIAL_PROVIDERS_ENABLED: 'false'/);
assert.match(cf,/EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS: 'false'/);
assert.match(cf,/Action: lambda:InvokeFunctionUrl/);
assert.match(cf,/InvokedViaFunctionUrl: true/);
assert.doesNotMatch(cf,/AWS::RDS::DBInstance|AWS::EC2::NatGateway|PAYSTACK_SECRET_KEY:/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/\n\s*push:\s*\n/);
assert.match(workflow,/I_AUTHORIZE_AWS_ISOLATED_STAGING_ONLY/);
assert.match(workflow,/environment: hustle-aws-lambda-staging/);
assert.match(workflow,/id-token: write/);
assert.match(workflow,/configure-aws-credentials@v4/);
assert.match(workflow,/hustle-github-isolated-staging-deployer/);
assert.match(workflow,/docker build --platform linux\/amd64/);
assert.match(workflow,/--image-ids "imageTag=\$IMAGE_TAG"/);
assert.match(workflow,/--no-fail-on-empty-changeset/);
assert.match(workflow,/AccountLimit.ConcurrentExecutions/);
assert.match(workflow,/expected 10/);
assert.match(workflow,/AuthBaseUrl=/);
assert.match(workflow,/payments\/initialize/);
assert.match(workflow,/test "\$BLOCKED_STATUS" = '403'/);
assert.match(auth,/isPinnedAwsLambdaStagingAuthUrl/);
assert.match(auth,/env\.HUSTLE_AWS_ACCOUNT_ID === "707859598737"/);
assert.match(auth,/env\.AWS_REGION === "eu-west-2"/);
assert.match(auth,/lambda-url/);
assert.match(auth,/EXPO_STAGING_AUTH_URL = "https:\/\/hustle-isolated-staging-api\.vercel\.app\/api\/auth"/);
assert.match(main,/validateApiRuntimeEnvironment\(process\.env\)/);
assert.match(stagePolicy,/function stagingRequestAllowed/);
// Frontend cutover must be a distinct reviewed change after signed-in QA.
assert.match(frontend,/const STAGING_API_ORIGIN = "https:\/\/hustle-isolated-staging-api\.vercel\.app"/);
console.log("PASS: isolated AWS Lambda package, secret-only DB/auth inputs, manual OIDC deployment, cost caps and unchanged PWA backend");
