#!/usr/bin/env node
// No API/credentials: tests that Metro forces the *same* React copy across the
// mobile app, Expo modules and the hoisted react-native renderer.
const assert = require("node:assert/strict");
const path = require("node:path");
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");
const mobilePackage = require("../package.json");
const lock = require("../../../package-lock.json");
const config = require("../metro.config.js");
const mobileReact = require.resolve("react", { paths: [mobileRoot] });
const rootReact = require.resolve("react", { paths: [repoRoot] });
const installedReactVersion = require(require.resolve("react/package.json", { paths: [mobileRoot] })).version;
assert.equal(installedReactVersion, mobilePackage.dependencies.react);
assert.equal(installedReactVersion, "19.1.0");
assert.equal(lock.packages["apps/mobile/node_modules/react"].version, "19.1.0");
assert.equal(lock.packages["node_modules/react"].version, "19.2.8");
assert.notEqual(mobileReact, rootReact, "Fixture needs the observed monorepo React split");

const resolve = config?.resolver?.resolveRequest;
assert.equal(typeof resolve, "function");
const importedFrom = [
  path.join(mobileRoot, "App.tsx"),
  path.join(repoRoot, "node_modules/react-native/index.js"),
  path.join(repoRoot, "node_modules/expo-modules-core/index.js")
];
for (const originModulePath of importedFrom) {
  for (const request of ["react", "react/jsx-runtime", "react/jsx-dev-runtime"]) {
    let resolvedSpecifier;
    const mockContext = {
      originModulePath,
      resolveRequest(_context, moduleName, _platform) {
        resolvedSpecifier = moduleName;
        return { type: "sourceFile", filePath: moduleName };
      }
    };
    resolve(mockContext, request, "android");
    assert.equal(resolvedSpecifier, require.resolve(request, { paths: [mobileRoot] }),
      "React must resolve from the mobile workspace for " + originModulePath + " / " + request);
  }
}
let ordinarySpecifier;
resolve({ originModulePath: importedFrom[1],
  resolveRequest(_context, name) { ordinarySpecifier = name; return { type: "sourceFile", filePath: name }; }
}, "react-native", "android");
assert.equal(ordinarySpecifier, "react-native", "Do not rewrite other native packages");
console.log("PASS: all React imports share mobile React 19.1.0; root React 19.2.8 remains available for web");
