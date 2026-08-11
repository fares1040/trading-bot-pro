import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'app/api/health/route.js',
  'app/api/production/route.js',
  'app/api/access/route.js',
  'app/api/hunter/route.js',
  'app/api/stocks/route.js',
  'app/api/market-data/route.js',
  'app/api/analyze/route.js',
  'app/api/opportunities/route.js',
  'app/api/alerts/route.js',
  'app/api/options-radar/route.js',
  'lib/hunter-intelligence.js',
  'lib/market-engine.js',
  'vercel.json',
];
const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`);
}
const jsFiles = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (name.endsWith('.js')) jsFiles.push(full);
  }
}
walk(root);
for (const file of jsFiles) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { errors.push(`Syntax error: ${path.relative(root, file)}\n${error.stdout?.toString() || ''}${error.stderr?.toString() || ''}`); }
}
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (!Array.isArray(vercel.crons)) errors.push('vercel.json: crons must be an array');
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkgJson.scripts?.build) errors.push('package.json: missing build script');
console.log(`Validated ${required.length} critical files and ${jsFiles.length} JavaScript files.`);
if (errors.length) { console.error(`Validation failed with ${errors.length} issue(s):`); for (const e of errors) console.error(`\n- ${e}`); process.exit(1); }
console.log('Project validation: PASS');
