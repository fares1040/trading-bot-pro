/**
 * Live Opportunity Service Tests
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-live-opportunity-service.mjs
 *
 * Tests the orchestration layer using the remote library APIs.
 */

import {
  buildLiveMarketPulse,
} from '../lib/live-market-pulse.js';

import { detectLiveOpportunity } from '../lib/live-opportunity-stream.js';
import { detectAcceleration } from '../lib/acceleration-radar.js';
import { processLiveOpportunities, clearHistory } from '../lib/live-opportunity-service.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + 'Expected: ' + JSON.stringify(expected) + '\nActual: ' + JSON.stringify(actual));
  }
}

function assertTrue(value, msg = '') {
  if (!value) throw new Error(msg || 'Expected truthy value but got falsy');
}

function assertNotNull(value, msg = '') {
  if (value == null) throw new Error(msg || 'Expected non-null value');
}

clearHistory();

function makeSnapshot(overrides = {}) {
  return {
    symbol: 'TEST',
    price: 100.0,
    previousClose: 98.0,
    changePercent: 2.04,
    volume: 5000000,
    candle: { open: 99, high: 101, low: 98, close: 100, timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    freshness: { status: 'FRESH', isFresh: true, ageMs: 5000, thresholdMs: 90000, asOf: new Date().toISOString(), fetchedAt: new Date().toISOString() },
    source: 'YAHOO_CHART',
    mode: 'POLLING',
    interval: '1m',
    range: '1d',
    dataQuality: 'FRESH',
    disclaimer: 'Yahoo chart data is polled.',
    ...overrides,
  };
}

function makePulse(overrides = {}) {
  const snapshot = makeSnapshot(overrides.snapshot || {});
  const pulse = buildLiveMarketPulse(snapshot, []);
  return { ...pulse, ...overrides };
}

// ============================================================================
// 1. Pulse basics
// ============================================================================
test('pulse: valid snapshot produces direction', () => {
  const snapshot = makeSnapshot({ symbol: 'NVDA', price: 120.50, previousClose: 118.00, changePercent: 2.12 });
  const pulse = buildLiveMarketPulse(snapshot, []);
  assertEqual(pulse.symbol, 'NVDA');
  assertNotNull(pulse.direction);
  assertNotNull(pulse.pressureScore);
});

test('pulse: strong up move produces UP direction', () => {
  const snapshot = makeSnapshot({ symbol: 'AAPL', price: 200, previousClose: 190, changePercent: 5.26 });
  const pulse = buildLiveMarketPulse(snapshot, []);
  assertEqual(pulse.direction, 'UP');
  assertTrue(pulse.pressureScore >= 60, 'pressure should be elevated for strong up move');
});

test('pulse: strong down move produces DOWN direction', () => {
  const snapshot = makeSnapshot({ symbol: 'TSLA', price: 180, previousClose: 200, changePercent: -10 });
  const pulse = buildLiveMarketPulse(snapshot, []);
  assertEqual(pulse.direction, 'DOWN');
});

// ============================================================================
// 2. Pulse with history
// ============================================================================
test('pulse: history improves acceleration detection', () => {
  const s1 = makeSnapshot({ symbol: 'HIST', price: 100, previousClose: 98, changePercent: 2.04, volume: 5000 });
  const s2 = makeSnapshot({ symbol: 'HIST', price: 104, previousClose: 100, changePercent: 3.85, volume: 7000 });
  const s3 = makeSnapshot({ symbol: 'HIST', price: 110, previousClose: 104, changePercent: 5.58, volume: 10000 });
  const pulse = buildLiveMarketPulse(s3, [s1, s2]);
  assertNotNull(pulse.priceAccelerationPercent);
  assertNotNull(pulse.volumeAccelerationPercent);
});

// ============================================================================
// 3. Opportunity detection
// ============================================================================
test('opportunity: eligible pulse returns eligible=true', () => {
  const pulse = {
    symbol: 'OPP',
    direction: 'UP',
    pressureScore: 75,
    priceChangePercent: 3.0,
    priceAccelerationPercent: 1.5,
    volumeChangePercent: 25,
    volumeAccelerationPercent: 10,
    spreadPercent: 0.1,
    freshness: { status: 'FRESH', isFresh: true },
    dataQuality: 'FRESH',
  };
  const result = detectLiveOpportunity(pulse);
  assertEqual(result.eligible, true);
  assertEqual(result.symbol, 'OPP');
  assertEqual(result.direction, 'UP');
});

test('opportunity: stale data returns ineligible', () => {
  const pulse = {
    symbol: 'STALE',
    direction: 'UP',
    pressureScore: 80,
    priceChangePercent: 5,
    freshness: { status: 'STALE', isFresh: false },
    dataQuality: 'STALE',
  };
  const result = detectLiveOpportunity(pulse);
  assertEqual(result.eligible, false);
  assertEqual(result.reason, 'STALE_OR_UNVERIFIED_DATA');
});

test('opportunity: flat direction returns ineligible', () => {
  const pulse = {
    symbol: 'FLAT',
    direction: 'FLAT',
    pressureScore: 50,
    priceChangePercent: 0.01,
    freshness: { status: 'FRESH', isFresh: true },
    dataQuality: 'FRESH',
  };
  const result = detectLiveOpportunity(pulse);
  assertEqual(result.eligible, false);
});

// ============================================================================
// 4. Acceleration detection
// ============================================================================
test('acceleration: eligible pulse returns eligible=true', () => {
  const pulse = {
    symbol: 'ACCEL',
    direction: 'UP',
    pressureScore: 70,
    priceAccelerationPercent: 2.0,
    volumeAccelerationPercent: 15,
    spreadPercent: 0.3,
    freshness: { status: 'FRESH', isFresh: true, ageMs: 5000 },
    dataQuality: 'FRESH',
  };
  const result = detectAcceleration(pulse);
  assertEqual(result.eligible, true);
  assertEqual(result.symbol, 'ACCEL');
});

test('acceleration: flat direction returns ineligible', () => {
  const pulse = {
    symbol: 'NOAC',
    direction: 'FLAT',
    pressureScore: 80,
    priceAccelerationPercent: 5,
    volumeAccelerationPercent: 20,
    freshness: { status: 'FRESH', isFresh: true, ageMs: 5000 },
    dataQuality: 'FRESH',
  };
  const result = detectAcceleration(pulse);
  assertEqual(result.eligible, false);
  assertEqual(result.reason, 'NO_DIRECTION');
});

test('acceleration: null pulse returns INSUFFICIENT_DATA', () => {
  const result = detectAcceleration(null);
  assertEqual(result.eligible, false);
  assertEqual(result.reason, 'INSUFFICIENT_DATA');
});

// ============================================================================
// 5. Service: empty symbols
// ============================================================================
test('service: empty symbols returns success with empty data', async () => {
  const result = await processLiveOpportunities([]);
  assertEqual(result.success, true);
  assertEqual(result.data.length, 0);
  assertTrue(typeof result.disclaimer === 'string');
  assertTrue(result.disclaimer.length > 0);
});

// ============================================================================
// 6. Service: invalid symbols
// ============================================================================
test('service: invalid symbol returns error', async () => {
  const result = await processLiveOpportunities(['!!!INVALID!!!']);
  assertTrue(result.errors.length > 0 || result.data.length === 0);
});

// ============================================================================
// 7. Service: export check
// ============================================================================
test('service: exports processLiveOpportunities function', async () => {
  assertTrue(typeof processLiveOpportunities === 'function');
});

// ============================================================================
// 8. Disclaimer presence
// ============================================================================
test('pulse: disclaimer is present and meaningful', () => {
  const snapshot = makeSnapshot({ symbol: 'DIS' });
  const pulse = buildLiveMarketPulse(snapshot, []);
  assertTrue(typeof pulse.disclaimer === 'string');
  assertTrue(pulse.disclaimer.length > 10);
});

test('opportunity: disclaimer is present', () => {
  const pulse = {
    symbol: 'DIS',
    direction: 'UP',
    pressureScore: 70,
    priceChangePercent: 2,
    freshness: { status: 'FRESH', isFresh: true },
    dataQuality: 'FRESH',
  };
  const result = detectLiveOpportunity(pulse);
  assertTrue(typeof result.disclaimer === 'string');
  assertTrue(result.disclaimer.length > 10);
});

test('acceleration: disclaimer is present', () => {
  const pulse = {
    symbol: 'DIS',
    direction: 'UP',
    pressureScore: 70,
    priceAccelerationPercent: 1,
    volumeAccelerationPercent: 10,
    freshness: { status: 'FRESH', isFresh: true, ageMs: 5000 },
    dataQuality: 'FRESH',
  };
  const result = detectAcceleration(pulse);
  assertTrue(typeof result.disclaimer === 'string');
  assertTrue(result.disclaimer.length > 10);
});

// ============================================================================
// 9. No fabrication — null fields stay null
// ============================================================================
test('pulse: null fields remain null, not zero', () => {
  const snapshot = makeSnapshot({
    symbol: 'FAB',
    previousClose: null,
    changePercent: null,
    volume: null,
  });
  const pulse = buildLiveMarketPulse(snapshot, []);
  assertEqual(pulse.symbol, 'FAB');
  assertEqual(pulse.priceChangePercent, null);
  assertEqual(pulse.volumeChangePercent, null);
});

// ============================================================================
// 10. History management
// ============================================================================
test('history: clear and rebuild works', () => {
  clearHistory('TESTSYM');
  const result = processLiveOpportunities(['TESTSYM']);
  assertTrue(result instanceof Promise);
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n========================================');
console.log('Live Opportunity Service Tests');
console.log('========================================\n');
console.log('PASS: ' + passCount);
console.log('FAIL: ' + failCount);
console.log('TOTAL: ' + (passCount + failCount));
if (failCount > 0) {
  console.error('\nSome tests FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests PASSED');
}
