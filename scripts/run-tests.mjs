#!/usr/bin/env node

/**
 * Unified Test Runner for Trading Bot Pro
 *
 * Runs all deterministic test suites sequentially.
 * Exit code 1 if any test fails.
 *
 * Usage: node scripts/run-tests.mjs
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();

const TEST_SUITES = [
  // Core Intelligence
  { name: 'Structure Intelligence', file: 'test-structure-intelligence.mjs' },
  { name: 'MTF Evidence', file: 'test-mtf-evidence.mjs' },
  { name: 'Technical Evidence', file: 'test-technical-evidence.mjs' },
  { name: 'Live Market Data', file: 'test-live-market-data.mjs' },
  { name: 'Live Market Pulse', file: 'test-live-market-pulse.mjs' },
  { name: 'Live Opportunity Stream', file: 'test-live-opportunity-stream.mjs' },

  // Decision Pipeline
  { name: 'C7 Technical Evidence Gate', file: 'test-c7-technical-evidence-gate.mjs' },
  { name: 'C8 Technical Evidence Integration', file: 'test-c8-technical-evidence-integration.mjs' },
  { name: 'C8 Trade Plan Engine', file: 'test-trade-plan-engine.mjs' },
  { name: 'C9 Technical Evidence Explanation', file: 'test-c9-technical-evidence-explanation.mjs' },
  { name: 'C9 AI Explanation', file: 'test-ai-explanation.mjs' },
  { name: 'C10 Market Regime', file: 'test-market-regime.mjs' },

  // Other Tests
  { name: 'Opportunity Ranking', file: 'test-opportunity-ranking.mjs' },
  { name: 'Swing Intelligence', file: 'test-swing-intelligence.mjs' },
  { name: 'Penny Intelligence', file: 'test-penny-intelligence.mjs' },
  { name: 'Options Intelligence', file: 'test-options-intelligence.mjs' },
  { name: 'Institutional Intelligence', file: 'test-institutional-intelligence.mjs' },
  { name: 'Circuit Breaker', file: 'test-circuit-breaker.mjs' },
  { name: 'Circuit Breaker Manager', file: 'test-circuit-breaker-manager.mjs' },
  { name: 'Alert Center', file: 'test-alert-center.mjs' },
  { name: 'Connectivity Health', file: 'test-connectivity-health.mjs' },
  { name: 'D12 Consistency', file: 'test-d12-consistency.mjs' },
];

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

console.log('========================================');
console.log('Trading Bot Pro — Test Suite');
console.log('========================================\n');

for (const suite of TEST_SUITES) {
  process.stdout.write(`[${suite.name}] `);
  try {
    const { stdout, stderr } = await execFileAsync('node', [`scripts/${suite.file}`], {
      cwd: ROOT,
      timeout: 60000,
      encoding: 'utf8',
    });
    const output = stdout + stderr;
    const failedMatch = output.match(/Failed:\s*(\d+)/i) || output.match(/(\d+)\s*failed/i);
    const failCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    if (failCount > 0) {
      console.log(`FAIL (${failCount} failed)`);
      failed++;
      failures.push({ name: suite.name, file: suite.file, output });
    } else {
      const passMatch = output.match(/Passed:\s*(\d+)/i) || output.match(/(\d+)\s*passed/i);
      const passCount = passMatch ? parseInt(passMatch[1], 10) : '?';
      console.log(`PASS (${passCount} tests)`);
      passed++;
    }
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    failed++;
    failures.push({ name: suite.name, file: suite.file, output: err.message });
  }
}

console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log('========================================');

if (failures.length > 0) {
  console.log('\nFailed suites:');
  for (const f of failures) {
    console.log(`\n--- ${f.name} (${f.file}) ---`);
    console.log(f.output.slice(-500));
  }
}

process.exit(failed > 0 ? 1 : 0);
