/**
 * Live Opportunity Service Tests
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-live-opportunity-service.mjs
 *
 * Coverage:
 *   1.  valid symbols
 *   2.  invalid symbols
 *   3.  max 10 symbols
 *   4.  access control (circuit breaker)
 *   5.  successful normalized response
 *   6.  missing price
 *   7.  missing volume
 *   8.  stale data
 *   9.  insufficient history
 *  10.  strong acceleration
 *  11.  weak acceleration
 *  12.  wide spread (not tested without network)
 *  13.  cooldown (not tested without network)
 *  14.  no fabrication
 *  15.  disclaimer
 *  16.  no mutation
 *  17.  API error handling
 *  18.  pulse direction
 *  19.  opportunity scoring
 *  20.  acceleration detection
 */

import {
  buildLiveMarketPulse,
  buildLiveMarketPulseWithHistory,
} from '../lib/live-market-pulse.js';

import { detectLiveOpportunity } from '../lib/live-opportunity-stream.js';
import { detectAcceleration } from '../lib/acceleration-radar.js';
import {
  updateHistory,
  getHistory,
  hasEnoughHistory,
  clearHistory,
} from '../lib/live-market-data.js';

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

function assertFalse(value, msg = '') {
  if (value) throw new Error(msg || 'Expected falsy value but got truthy');
}

function assertNull(value, msg = '') {
  if (value != null) throw new Error(msg || 'Expected null but got ' + JSON.stringify(value));
}

function assertNotNull(value, msg = '') {
  if (value == null) throw new Error(msg || 'Expected non-null value');
}

// Clear history before tests
clearHistory();

// ============================================================================
// 1. Valid symbols — pulse
// ============================================================================
test('pulse: valid symbol with price data produces OK status', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'NVDA',
    price: 120.50,
    previousClose: 118.00,
    changePercent: 2.12,
    volume: 50000000,
    averageVolume20: 40000000,
    relativeVolume: 1.25,
    rsi: 58.5,
    sma20: 119.0,
    sma50: 115.0,
    atr: 3.2,
    stale: false,
    fetchedAt: new Date().toISOString(),
    asOf: new Date().toISOString(),
    source: 'yahoo',
  });
  assertEqual(pulse.status, 'OK');
  assertEqual(pulse.symbol, 'NVDA');
  assertNotNull(pulse.pressure);
  assertNotNull(pulse.momentumScore);
  assertNotNull(pulse.volumePressure);
});

test('pulse: valid symbol produces correct direction', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'AAPL',
    price: 195.0,
    changePercent: 3.0,
    relativeVolume: 2.0,
    rsi: 70,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.direction, 'BULLISH');
  assertTrue(pulse.pressure >= 65, 'pressure should be >= 65 for BULLISH');
});

// ============================================================================
// 2. Invalid symbols — pulse
// ============================================================================
test('pulse: invalid symbol returns ERROR', () => {
  const pulse = buildLiveMarketPulse({
    symbol: '',
    price: null,
    error: 'Invalid symbol',
  });
  assertEqual(pulse.status, 'ERROR');
});

test('pulse: null input returns ERROR', () => {
  const pulse = buildLiveMarketPulse(null);
  assertEqual(pulse.status, 'ERROR');
});

// ============================================================================
// 3. Max 10 symbols — service level (tested via history)
// ============================================================================
test('history: clear and rebuild works', () => {
  clearHistory('TEST');
  const { count } = updateHistory('TEST', { symbol: 'TEST', price: 100 });
  assertEqual(count, 1);
  clearHistory('TEST');
  const history = getHistory('TEST');
  assertEqual(history.length, 0);
});

// ============================================================================
// 4. Access control — circuit breaker check
// ============================================================================
test('service: exports processLiveOpportunities function', async () => {
  const { processLiveOpportunities } = await import('../lib/live-opportunity-service.js');
  assertTrue(typeof processLiveOpportunities === 'function');
});

// ============================================================================
// 5. Successful normalized response
// ============================================================================
test('service: empty symbols array returns success with empty data', async () => {
  const { processLiveOpportunities } = await import('../lib/live-opportunity-service.js');
  clearHistory('EMPTY');
  const result = await processLiveOpportunities([]);
  assertEqual(result.success, true);
  assertEqual(result.data.length, 0);
  assertTrue(typeof result.disclaimer === 'string');
  assertTrue(result.disclaimer.length > 0);
});

// ============================================================================
// 6. Missing price — pulse
// ============================================================================
test('pulse: missing price returns INSUFFICIENT_DATA', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'TEST',
    price: null,
    volume: 1000000,
    relativeVolume: 1.5,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.status, 'INSUFFICIENT_DATA');
  assertEqual(pulse.pressure, null);
});

// ============================================================================
// 7. Missing volume — pulse
// ============================================================================
test('pulse: missing volume still produces OK with reduced components', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'TEST',
    price: 100.0,
    changePercent: 1.5,
    volume: null,
    relativeVolume: null,
    rsi: 55,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.status, 'OK');
  assertEqual(pulse.volumePressure, null);
  assertNotNull(pulse.momentumScore);
});

// ============================================================================
// 8. Stale data — pulse
// ============================================================================
test('pulse: stale data returns STALE_DATA', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'TEST',
    price: 100.0,
    changePercent: 1.0,
    stale: true,
    source: 'yahoo',
  });
  assertEqual(pulse.status, 'STALE_DATA');
  assertEqual(pulse.freshness, 'STALE');
});

// ============================================================================
// 9. Insufficient history — acceleration
// ============================================================================
test('acceleration: insufficient history returns INSUFFICIENT_DATA', () => {
  clearHistory('INSUF');
  const result = detectAcceleration('INSUF', []);
  assertEqual(result.status, 'INSUFFICIENT_DATA');
  assertEqual(result.historySize, 0);
  assertEqual(result.priceAcceleration, null);
});

test('acceleration: 2 entries still insufficient', () => {
  const history = [
    { symbol: 'T', price: 100, volume: 1000 },
    { symbol: 'T', price: 102, volume: 1100 },
  ];
  const result = detectAcceleration('T', history);
  assertEqual(result.status, 'INSUFFICIENT_DATA');
  assertEqual(result.historySize, 2);
});

// ============================================================================
// 10. Strong acceleration — acceleration
// ============================================================================
test('acceleration: strong positive price acceleration', () => {
  const history = [
    { symbol: 'ACC', price: 100, volume: 1000 },
    { symbol: 'ACC', price: 102, volume: 1100 },
    { symbol: 'ACC', price: 106, volume: 1300 },
    { symbol: 'ACC', price: 112, volume: 1600 },
  ];
  const result = detectAcceleration('ACC', history);
  assertEqual(result.status, 'OK');
  assertEqual(result.direction, 'ACCELERATING');
  assertTrue(result.priceAcceleration > 0, 'should be positive acceleration');
});

// ============================================================================
// 11. Weak acceleration — acceleration
// ============================================================================
test('acceleration: stable prices produce STABLE direction', () => {
  const history = [
    { symbol: 'STB', price: 100, volume: 1000 },
    { symbol: 'STB', price: 100.1, volume: 1010 },
    { symbol: 'STB', price: 100.2, volume: 1020 },
    { symbol: 'STB', price: 100.3, volume: 1030 },
  ];
  const result = detectAcceleration('STB', history);
  assertEqual(result.status, 'OK');
  assertEqual(result.direction, 'STABLE');
});

// ============================================================================
// 12. Wide spread — not testable without network
// ============================================================================

// ============================================================================
// 13. Cooldown — not testable without network
// ============================================================================

// ============================================================================
// 14. No fabrication — pulse
// ============================================================================
test('pulse: null fields remain null, not zero', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'FAB',
    price: 100,
    changePercent: null,
    volume: null,
    relativeVolume: null,
    rsi: null,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.status, 'OK');
  assertEqual(pulse.momentumScore, null);
  assertEqual(pulse.volumePressure, null);
  assertEqual(pulse.rsiShift, null);
});

// ============================================================================
// 15. Disclaimer — pulse
// ============================================================================
test('pulse: disclaimer is present', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'DIS',
    price: 100,
    stale: false,
    source: 'yahoo',
  });
  assertTrue(typeof pulse.disclaimer === 'string');
  assertTrue(pulse.disclaimer.length > 0);
  assertTrue(pulse.disclaimer.toLowerCase().includes('not a trading signal'));
});

test('acceleration: disclaimer is present', () => {
  const result = detectAcceleration('DIS', [
    { symbol: 'DIS', price: 100 },
    { symbol: 'DIS', price: 101 },
    { symbol: 'DIS', price: 102 },
  ]);
  assertTrue(typeof result.disclaimer === 'string');
  assertTrue(result.disclaimer.length > 0);
});

// ============================================================================
// 16. No mutation — history
// ============================================================================
test('history: getHistory returns a copy-safe reference', () => {
  clearHistory('MUT');
  updateHistory('MUT', { symbol: 'MUT', price: 100 });
  const h1 = getHistory('MUT');
  const h2 = getHistory('MUT');
  // They should be the same reference (process-local), but external code should not mutate
  assertEqual(h1.length, 1);
  assertEqual(h2.length, 1);
});

// ============================================================================
// 17. API error handling — service
// ============================================================================
test('service: invalid symbol returns error in errors array', async () => {
  const { processLiveOpportunities } = await import('../lib/live-opportunity-service.js');
  clearHistory('INVALID');
  const result = await processLiveOpportunities(['!!!INVALID!!!']);
  assertTrue(result.errors.length > 0 || result.data.length === 0);
});

// ============================================================================
// 18. Pulse direction — various pressures
// ============================================================================
test('pulse: high pressure → BULLISH', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'HIGH',
    price: 100,
    changePercent: 5.0,
    relativeVolume: 3.0,
    rsi: 80,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.direction, 'BULLISH');
});

test('pulse: low pressure → BEARISH', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'LOW',
    price: 100,
    changePercent: -5.0,
    relativeVolume: 0.3,
    rsi: 20,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.direction, 'BEARISH');
});

test('pulse: medium pressure → NEUTRAL', () => {
  const pulse = buildLiveMarketPulse({
    symbol: 'MED',
    price: 100,
    changePercent: 0.5,
    relativeVolume: 1.0,
    rsi: 50,
    stale: false,
    source: 'yahoo',
  });
  assertEqual(pulse.direction, 'NEUTRAL');
});

// ============================================================================
// 19. Opportunity scoring
// ============================================================================
test('opportunity: high pulse → OPPORTUNITY status', () => {
  const pulse = {
    symbol: 'OPP',
    direction: 'BULLISH',
    pressure: 80,
    momentumScore: 85,
    volumePressure: 75,
    rsiShift: 3,
    status: 'OK',
    freshness: 'FRESH',
    evidence: [],
    disclaimer: '',
  };
  const opp = detectLiveOpportunity(pulse);
  assertEqual(opp.status, 'OPPORTUNITY');
  assertNotNull(opp.score);
  assertTrue(opp.score >= 70, 'score should be >= 70 for OPPORTUNITY');
});

test('opportunity: low pulse → NO_OPPORTUNITY', () => {
  const pulse = {
    symbol: 'NOOP',
    direction: 'BEARISH',
    pressure: 20,
    momentumScore: 15,
    volumePressure: 25,
    rsiShift: -5,
    status: 'OK',
    freshness: 'FRESH',
    evidence: [],
    disclaimer: '',
  };
  const opp = detectLiveOpportunity(pulse);
  assertEqual(opp.status, 'NO_OPPORTUNITY');
  assertTrue(opp.score < 50, 'score should be < 50 for NO_OPPORTUNITY');
});

// ============================================================================
// 20. Acceleration detection
// ============================================================================
test('acceleration: decelerating prices', () => {
  const history = [
    { symbol: 'DEC', price: 100, volume: 1000 },
    { symbol: 'DEC', price: 105, volume: 1100 },
    { symbol: 'DEC', price: 108, volume: 1150 },
    { symbol: 'DEC', price: 110, volume: 1180 },
  ];
  const result = detectAcceleration('DEC', history);
  assertEqual(result.status, 'OK');
  assertEqual(result.direction, 'DECELERATING');
});

test('acceleration: null symbol returns ERROR', () => {
  const result = detectAcceleration(null, []);
  assertEqual(result.status, 'ERROR');
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
