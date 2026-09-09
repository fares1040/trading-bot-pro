import assert from 'node:assert/strict';
import { buildLiveIntelligenceSummary } from '../lib/live-intelligence-summary.js';

const sample = [
  { symbol: 'NVDA', status: 'OPPORTUNITY', freshness: 'FRESH', earlyExplosion: { state: 'IGNITION' }, flow: { observationCount: 4 }, smartMoney: { classification: 'POSSIBLE' } },
  { symbol: 'AMD', status: 'WATCH', freshness: 'FRESH', earlyExplosion: { state: 'PREPARING' }, flow: { observationCount: 0 }, smartMoney: { classification: 'UNATTRIBUTED' } },
  { symbol: 'TSLA', status: 'STALE_DATA', freshness: 'STALE', earlyExplosion: { state: 'QUIET' } },
  { symbol: 'PLTR', status: 'ERROR', freshness: 'UNKNOWN', dataQuality: 'ERROR' },
  { symbol: 'AAPL', status: 'NO_OPPORTUNITY', freshness: 'FRESH', earlyExplosion: { state: 'QUIET' }, smartMoney: { classification: 'CONFIRMED' } },
];

const summary = buildLiveIntelligenceSummary(sample);
assert.equal(summary.total, 5);
assert.equal(summary.fresh, 3);
assert.equal(summary.stale, 1);
assert.equal(summary.errors, 1);
assert.equal(summary.freshRatio, 60);
assert.equal(summary.opportunities, 1);
assert.equal(summary.watches, 1);
assert.equal(summary.ignition, 1);
assert.equal(summary.preparing, 1);
assert.equal(summary.flowObserved, 1);
assert.equal(summary.smartMoneyPossible, 1);
assert.equal(summary.smartMoneyConfirmed, 1);
assert.equal(summary.version, '1.0');

const empty = buildLiveIntelligenceSummary();
assert.equal(empty.total, 0);
assert.equal(empty.freshRatio, 0);

console.log('Live Intelligence Summary tests: 2 passed');
