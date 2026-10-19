#!/usr/bin/env node
// Cheap, local-to-CI guard. No Expo account, backend, API or paid build access needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = process.argv[2];
if (!file) throw Error('Provide path to Expo autolinking JSON');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.ok(Array.isArray(data.modules), 'Expo autolinking must produce a modules array');
const fonts = data.modules.filter(m => m.packageName === 'expo-font');
assert.equal(fonts.length, 1, 'Exactly one expo-font module must be autolinked');
assert.equal(fonts[0].packageVersion, '14.0.12', 'Expo SDK 54 must autolink expo-font 14.0.12, never 55+/58+');
const errors = [];
for (const [i, mod] of data.modules.entries()) {
  for (const project of mod.projects || []) {
    if (project.publication && !project.publication.version) {
      errors.push(`modules[${i}] ${mod.packageName}: missing native publication.version`);
    }
  }
}
assert.deepEqual(errors, [], 'Android Gradle metadata must be complete');
console.log('PASS: Expo SDK54 native autolinking uses expo-font@14.0.12, all publications valid');
