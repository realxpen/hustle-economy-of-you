// Cloud-only, credential-free regression gate for Hustle preview builds.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { config: _ignored } = {};
const mobileRoot = path.resolve(__dirname, "..");
const base = require("../app.json").expo;
const build = require("../eas.json").build;
const makeConfig = require("../app.config.js");
const oldVariant = process.env.APP_VARIANT;
const oldProject = process.env.EXPO_PROJECT_ID;
try {
  process.env.APP_VARIANT = "preview";
  process.env.EXPO_PROJECT_ID = "eb9df9ee-5f3b-4e90-b9dc-36a770d00c25"; // test fixture only
  const preview = makeConfig({ config: base });
  assert.equal(preview.name, "Hustle Preview");
  assert.equal(preview.android.package, "com.hustle.economyofyou.preview");
  assert.equal(preview.ios.bundleIdentifier, "com.hustle.economyofyou.preview");
  assert.equal(preview.extra.eas.projectId, process.env.EXPO_PROJECT_ID);
  assert.equal(build.preview.distribution, "internal");
  assert.equal(build.preview.environment, "preview");
  assert.equal(build.preview.android.buildType, "apk");
  assert.equal(build.preview.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS, "false");
  assert.equal(build["ios-simulator"].ios.simulator, true);
  process.env.APP_VARIANT = "production";
  delete process.env.EXPO_PROJECT_ID;
  const standard = makeConfig({ config: base });
  assert.equal(standard.name, base.name);
  assert.equal(standard.android.package, base.android.package);
  assert.equal(standard.ios.bundleIdentifier, base.ios.bundleIdentifier);
  const workflow = fs.readFileSync(path.resolve(mobileRoot, "../../.github/workflows/hustle-mobile-eas-preview.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /approved_nonproduction_build/);
  assert.match(workflow, /secrets.EXPO_TOKEN/);
  assert.doesNotMatch(workflow, /--auto-submit/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  console.log("Hustle cloud preview configuration gate: PASS");
} finally {
  if (oldVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = oldVariant;
  if (oldProject === undefined) delete process.env.EXPO_PROJECT_ID;
  else process.env.EXPO_PROJECT_ID = oldProject;
}
