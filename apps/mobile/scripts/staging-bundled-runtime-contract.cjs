// Execute the real Expo/Babel-transformed guard with all build env vars removed,
// matching installed Android/iOS runtime semantics rather than a Node-only test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const stage = require('../eas.json').build['isolated-staging'].env;
const original = Object.fromEntries(Object.keys(stage).map(k => [k, process.env[k]]));
const sourcePath = path.join(root, 'src/lib/staging-auth.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const makeConfig = require('../app.config.js');
const baseConfig = require('../app.json').expo;
let passed = 0;
function test(label, fn) { fn(); passed++; console.log('PASS ' + label); }
function compile(os, overrides = {}) {
  Object.assign(process.env, stage, overrides);
  const manifest = makeConfig({ config: baseConfig });
  const code = babel.transformSync(source, {
    filename: sourcePath, configFile: false, babelrc: false,
    presets: [require.resolve('babel-preset-expo')],
    caller: { name: 'metro', bundler: 'metro', platform: os, isDev: false, isServer: false, supportsStaticESM: true }
  }).code;
  assert.doesNotMatch(code, /process\.env\.EXPO_PUBLIC_/, 'Public variables must actually be inlined');
  assert.doesNotMatch(code, /process\.env\.APP_VARIANT/, 'Installed runtime must not read Node build-only variant');
  for (const key of Object.keys(stage)) delete process.env[key];
  return { manifest, code: ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText };
}
function execute(bundle, os, manifest = bundle.manifest) {
  const created = [];
  const mocks = {
    'better-auth/react': { createAuthClient: config => { created.push(config); return { configuration: config }; } },
    '@better-auth/expo/client': { expoClient: config => config },
    'expo-secure-store': {},
    'expo-constants': { __esModule: true, default: { expoConfig: manifest } },
    'react-native': { Platform: { OS: os } }
  };
  const mod = new Module(sourcePath, module); mod.filename = sourcePath;
  mod.require = name => { assert.ok(Object.hasOwn(mocks, name), 'Unexpected runtime dependency ' + name); return mocks[name]; };
  mod._compile(bundle.code, sourcePath);
  return { auth: mod.exports, created };
}
try {
  for (const os of ['android', 'ios']) {
    const bundle = compile(os);
    test(os + ': production-transformed preview initializes without build environment', () => {
      assert.equal(process.env.APP_VARIANT, undefined);
      const { auth, created } = execute(bundle, os);
      assert.equal(auth.isExpoStagingSelected(), true);
      assert.doesNotThrow(() => auth.validateExpoStagingConfiguration());
      auth.getStagingAuth(); auth.getStagingAuth();
      assert.equal(created.length, 1);
      assert.equal(created[0].baseURL, stage.EXPO_PUBLIC_HUSTLE_AUTH_URL);
      assert.equal(created[0].plugins[0].scheme, 'hustle-preview');
    });
    test(os + ': missing/wrong embedded application identity refuses client initialization', () => {
      for (const manifest of [null, {}, { android: { package: 'com.hustle.economyofyou' }, ios: { bundleIdentifier: 'com.hustle.economyofyou' } }]) {
        const { auth, created } = execute(bundle, os, manifest);
        assert.throws(() => auth.getStagingAuth(), /isolated/i); assert.equal(created.length, 0);
      }
    });
    for (const [key, value] of [
      ['APP_VARIANT', 'production'], ['EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE', 'production'],
      ['EXPO_PUBLIC_HUSTLE_DEMO', 'true'], ['EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER', 'supabase'],
      ['EXPO_PUBLIC_API_URL', 'https://untrusted.invalid/api/v1'],
      ['EXPO_PUBLIC_HUSTLE_AUTH_URL', 'https://untrusted.invalid/api/auth'],
      ['EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS', 'true'],
      ['EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES', 'false']
    ]) test(os + ': compiled ' + key + ' mismatch fails closed', () => {
      const { auth, created } = execute(compile(os, { [key]: value }), os);
      assert.throws(() => auth.getStagingAuth(), /isolated|configured/i); assert.equal(created.length, 0);
    });
  }
  console.log('PASS ' + passed + ' bundled-runtime checks; no network or device execution claimed.');
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
