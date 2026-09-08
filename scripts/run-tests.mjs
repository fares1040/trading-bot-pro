import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const suites = [
  { name: 'Options Flow Schema', file: 'test-options-flow-schema.mjs' },
  { name: 'Options Flow Evidence', file: 'test-options-flow.mjs' },
  { name: 'Options Smart Money', file: 'test-options-smart-money.mjs' },
  { name: 'Options Smart Money Freshness', file: 'test-options-smart-money-freshness.mjs' },
  { name: 'Live Opportunity Service', file: 'test-live-opportunity-service.mjs' },
  { name: 'Live Market Pulse', file: 'test-live-market-pulse.mjs' },
  { name: 'Live Opportunity Stream', file: 'test-live-opportunity-stream.mjs' },
  { name: 'Acceleration Radar', file: 'test-acceleration-radar.mjs' },
  { name: 'Live Flow Schema', file: 'test-live-flow-schema.mjs' },
  { name: 'Live Flow Normalizer', file: 'test-live-flow-normalizer.mjs' },
  { name: 'Live Flow Aggregator', file: 'test-live-flow-aggregator.mjs' },
  { name: 'Smart Money Evidence', file: 'test-smart-money-evidence.mjs' },
  { name: 'Live Market Data', file: 'test-live-market-data.mjs' },
];

let failed = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite.name} ===`);
  const result = spawnSync(process.execPath, [path.join(root, suite.file)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

console.log(`\nTest suites: ${suites.length - failed}/${suites.length} passed`);
if (failed) process.exit(1);
