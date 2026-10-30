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
  // YAML validity is not enough: GitHub rejects runner.* during job-level
  // environment expression evaluation, before any job is allocated.
  // runner.* becomes available only inside steps (e.g. steps.run/steps.env).
  if (!document.errors.length) {
    const workflow = document.toJS();
    const scopes = [['workflow', workflow.env]];
    for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
      scopes.push([`jobs.${jobId}`, job?.env]);
    }
    for (const [scope, vars] of scopes) {
      if (!vars || typeof vars !== 'object') continue;
      for (const [key, value] of Object.entries(vars)) {
        if (typeof value === 'string' && /\$\{\{\s*runner\./.test(value)) {
          failed = true;
          console.error(`${name}: ${scope}.env.${key}: runner context is unavailable before a job's steps run`);
        }
      }
    }
  }
}
if (failed) process.exit(1);
console.log(`Workflow YAML syntax passed: ${files.length} files.`);
