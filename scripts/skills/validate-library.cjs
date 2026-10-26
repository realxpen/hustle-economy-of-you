#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const library = path.join(root, '.agents', 'skills');
const expected = [
  'accessibility-compliance', 'api-design-principles', 'auth-implementation-patterns',
  'design-system-patterns', 'frontend-design', 'modern-javascript-patterns',
  'nextjs-app-router-patterns', 'openapi-spec-generation', 'react-native-architecture',
  'react-state-management', 'responsive-design', 'tailwind-design-system'
].sort();
const errors = [];
const bad = [
  { name: 'piped shell downloader', re: /(?:curl|wget)[^\n]{0,150}\|\s*(?:bash|sh)\b/i },
  { name: 'instruction hierarchy bypass', re: /(?:ignore|disregard)\s+(?:(?:all|your)\s+)?(?:previous|prior|system|developer)\s+instructions/i },
  { name: 'destructive root/home deletion', re: /rm\s+-rf\s+(?:\/(?:\s|$)|~\/|\$HOME\/)/i },
  { name: 'automatic shell permission grant', re: /^allowed-tools:\s*(?:bash|shell|\*)\s*$/im }
];
function fail(m) { errors.push(m); }
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(ent => {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) { fail('symlink not allowed: ' + path.relative(root,p)); return []; }
    if (ent.isDirectory()) return walk(p);
    return [p];
  });
}
if (!fs.existsSync(library)) fail('missing skill directory');
else {
  const actual = fs.readdirSync(library, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('installed inventory differs from audited allowlist: ' + actual.join(', '));
  for (const name of actual) {
    const folder = path.join(library, name), skill = path.join(folder, 'SKILL.md');
    if (!fs.existsSync(skill)) { fail('missing SKILL.md: ' + name); continue; }
    if (!fs.existsSync(path.join(folder,'LICENSE')) && !fs.existsSync(path.join(folder,'LICENSE.txt'))) fail('missing license: ' + name);
    const body = fs.readFileSync(skill, 'utf8');
    const header = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!header) fail('missing YAML frontmatter: ' + name);
    else {
      const id = (header[1].match(/^name:\s*['"]?([a-z0-9-]+)['"]?\s*$/m)||[])[1];
      if (id !== name) fail('skill name does not match folder: ' + name + ' (' + id + ')');
      if (!/^description:\s*\S/m.test(header[1])) fail('missing description: ' + name);
    }
    for (const file of walk(folder)) {
      if (!/\.(?:md|txt|py|js|json|yaml|yml)$/.test(file)) fail('unreviewed file type: ' + path.relative(root,file));
      if (!/\.(?:md|txt|py|js|json|yaml|yml)$/.test(file)) continue;
      const content = fs.readFileSync(file,'utf8');
      if (!file.endsWith('LICENSE') && !file.endsWith('LICENSE.txt')) {
        for (const rule of bad) if (rule.re.test(content)) fail(rule.name + ': ' + path.relative(root,file));
      }
    }
    const refs = body.match(/(?:references|assets)\/[a-zA-Z0-9._/-]+\.(?:md|py|js|json|yaml|yml)/g) || [];
    for (const ref of refs) {
      if (ref.includes('..') || !fs.existsSync(path.join(folder, ref))) fail('missing/unsafe local reference: ' + name + '/' + ref);
    }
  }
}
if (errors.length) { console.error('Skill library validation FAILED:\n' + errors.map(x=>' - '+x).join('\n')); process.exit(1); }
console.log('PASS: ' + expected.length + ' audited skill directories; metadata, licenses, references and basic unsafe patterns checked. This is not a full security assessment.');
