// Parse workflow YAML as data; never evaluate workflow expressions or commands.
// yaml is already pinned by package-lock.json and installed by npm ci.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const directory = path.resolve(__dirname, '../../.github/workflows');
const files = fs.readdirSync(directory).filter(name => /\.ya?ml$/.test(name)).sort();
let failed = false;
for (const name of files) {
  const document = YAML.parseDocument(fs.readFileSync(path.join(directory, name), 'utf8'), { uniqueKeys: true });
  if (document.errors.length) {
    failed = true;
    console.error(`${name}: ${document.errors.map(error => error.message).join('\n')}`);
  }
}
if (failed) process.exit(1);
console.log(`Workflow YAML syntax passed: ${files.length} files.`);
