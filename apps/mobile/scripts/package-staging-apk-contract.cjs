// Generated SDK-tool harness exercises packaging refusal; actual SDK verification runs in native CI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hustle-package-test-'));
try {
  const tools = path.join(temp, 'sdk', 'build-tools', '36.0.0'); fs.mkdirSync(tools, { recursive: true });
  const apk = path.join(temp, 'fixture.apk'); fs.writeFileSync(apk, 'generated-not-an-apk');
  const signer = path.join(tools, 'apksigner'), aapt = path.join(tools, 'aapt');
  fs.writeFileSync(signer, '#!/bin/sh\nexit "${FIXTURE_SIGN_EXIT:-0}"\n', { mode: 0o700 });
  fs.writeFileSync(aapt, '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_MANIFEST"\n', { mode: 0o700 });
  const config = require('../eas.json').build['isolated-staging'].env;
  function run(label, manifest, valid, extra = {}) {
    const output = path.join(temp, label);
    const result = spawnSync(process.execPath, [path.join(__dirname, 'package-staging-apk.cjs'), apk, output], {
      encoding: 'utf8', env: { ...process.env, ...config, ANDROID_HOME: path.join(temp, 'sdk'),
        SOURCE_SHA: 'a'.repeat(40), FIXTURE_MANIFEST: manifest, ...extra }
    });
    assert.equal(result.status === 0, valid, label + ': ' + result.stderr);
    assert.equal(fs.existsSync(path.join(output, 'Hustle-Staging.apk')), valid, 'Failed gate must publish nothing');
    if (valid) {
      const info = JSON.parse(fs.readFileSync(path.join(output, 'build-info.json')));
      assert.deepEqual(info.architectures, ['arm64-v8a', 'x86_64']); assert.equal(info.physicalDeviceTested, false);
    }
    console.log('PASS ' + label);
  }
  const manifest = "package: name='com.hustle.economyofyou.preview.staging'\nnative-code: 'arm64-v8a' 'x86_64'";
  run('dual-ABI receipt', manifest, true);
  run('ARM-only refused for Waydroid', manifest.replace(" 'x86_64'", ''), false);
  run('wrong package refused', manifest.replace('.staging', '.other'), false);
  run('bad signature refused', manifest, false, { FIXTURE_SIGN_EXIT: '1' });
  run('wrong environment refused', manifest, false, { EXPO_PUBLIC_HUSTLE_DEMO: 'true' });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
