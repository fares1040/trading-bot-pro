import { createLiveOpportunityStream, detectLiveOpportunity, LIVE_OPPORTUNITY_DEFAULTS } from '../lib/live-opportunity-stream.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log('PASS: ' + name); passCount++; }
  catch (error) { console.error('FAIL: ' + name); console.error('   Error: ' + error.message); failCount++; }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertTrue(value, message = '') { if (!value) throw new Error(message || 'Expected truthy value'); }
function assertFalse(value, message = '') { if (value) throw new Error(message || 'Expected falsy value'); }
function assertNull(value, message = '') { if (value != null) throw new Error(`${message} Expected null, got ${JSON.stringify(value)}`); }

const fresh = { status: 'FRESH', isFresh: true, ageMs: 10_000, thresholdMs: 90_000, asOf: '2026-09-08T18:00:00.000Z', fetchedAt: '2026-09-08T18:00:10.000Z' };
const basePulse = {
  symbol: 'AAPL', price: 181, timestamp: fresh.asOf, fetchedAt: fresh.fetchedAt, freshness: fresh,
  direction: 'UP', priceChangePercent: 0.8, priceAccelerationPercent: 0.25,
  volume: 10_000_000, volumeChangePercent: 25, volumeAccelerationPercent: 8,
  pressureScore: 78, accelerationState: 'ACCELERATING', spreadPercent: 0.3,
  dataQuality: 'FRESH',
};

test('defaults expose deterministic thresholds', () => {
  assertEqual(LIVE_OPPORTUNITY_DEFAULTS.minPressureScore, 65);
  assertEqual(LIVE_OPPORTUNITY_DEFAULTS.cooldownMs, 60_000);
});

test('strong fresh confluence is eligible', () => {
  const r = detectLiveOpportunity(basePulse);
  assertTrue(r.eligible);
  assertEqual(r.reason, 'LIVE_OPPORTUNITY');
  assertEqual(r.direction, 'UP');
  assertTrue(r.evidence.length >= 3);
});

test('stale data is never eligible', () => {
  const r = detectLiveOpportunity({ ...basePulse, freshness: { ...fresh, status: 'STALE', isFresh: false } });
  assertFalse(r.eligible);
  assertEqual(r.reason, 'STALE_OR_UNVERIFIED_DATA');
});

test('missing freshness is never treated as fresh', () => {
  const r = detectLiveOpportunity({ ...basePulse, freshness: null });
  assertFalse(r.eligible);
  assertEqual(r.reason, 'STALE_OR_UNVERIFIED_DATA');
});

test('insufficient confluence does not trigger', () => {
  const r = detectLiveOpportunity({ ...basePulse, pressureScore: 40, priceChangePercent: 0.1, priceAccelerationPercent: 0.01, volumeChangePercent: 2, volumeAccelerationPercent: 1 });
  assertFalse(r.eligible);
  assertEqual(r.reason, 'INSUFFICIENT_CONFLUENCE');
});

test('wide spread blocks otherwise strong setup', () => {
  const r = detectLiveOpportunity({ ...basePulse, spreadPercent: 2 });
  assertFalse(r.eligible);
  assertEqual(r.reason, 'SPREAD_TOO_WIDE');
});

test('flat direction cannot trigger', () => {
  const r = detectLiveOpportunity({ ...basePulse, direction: 'FLAT' });
  assertFalse(r.eligible);
  assertEqual(r.reason, 'NO_DIRECTION');
});

test('downside detection preserves direction and directional thresholds', () => {
  const r = detectLiveOpportunity({ ...basePulse, direction: 'DOWN', priceChangePercent: -0.8, priceAccelerationPercent: -0.25 });
  assertTrue(r.eligible);
  assertEqual(r.direction, 'DOWN');
});

test('missing numeric inputs are not fabricated', () => {
  const r = detectLiveOpportunity({ ...basePulse, pressureScore: null, priceChangePercent: null, priceAccelerationPercent: null, volumeChangePercent: null, volumeAccelerationPercent: null });
  assertFalse(r.eligible);
  assertNull(r.pressureScore);
  assertEqual(r.reason, 'INSUFFICIENT_CONFLUENCE');
});

test('stream emits first eligible opportunity', () => {
  const stream = createLiveOpportunityStream();
  const r = stream.evaluate(basePulse, 1_000);
  assertTrue(r.eligible);
  assertTrue(r.emitted);
});

test('stream suppresses duplicate symbol during cooldown', () => {
  const stream = createLiveOpportunityStream({ cooldownMs: 60_000 });
  assertTrue(stream.evaluate(basePulse, 1_000).emitted);
  const r = stream.evaluate(basePulse, 30_000);
  assertFalse(r.emitted);
  assertEqual(r.reason, 'COOLDOWN');
});

test('stream re-emits after cooldown', () => {
  const stream = createLiveOpportunityStream({ cooldownMs: 60_000 });
  assertTrue(stream.evaluate(basePulse, 1_000).emitted);
  assertTrue(stream.evaluate(basePulse, 61_000).emitted);
});

test('cooldown is isolated per symbol', () => {
  const stream = createLiveOpportunityStream({ cooldownMs: 60_000 });
  assertTrue(stream.evaluate(basePulse, 1_000).emitted);
  assertTrue(stream.evaluate({ ...basePulse, symbol: 'MSFT' }, 30_000).emitted);
});

test('clear removes cooldown state', () => {
  const stream = createLiveOpportunityStream({ cooldownMs: 60_000 });
  assertTrue(stream.evaluate(basePulse, 1_000).emitted);
  stream.clear('AAPL');
  assertTrue(stream.evaluate(basePulse, 2_000).emitted);
});

test('output is explicitly derived and not whale/order-flow data', () => {
  const r = detectLiveOpportunity(basePulse);
  assertEqual(r.mode, 'DERIVED');
  assertEqual(r.source, 'LIVE_MARKET_PULSE');
  assertTrue(r.disclaimer.includes('not independent real-time order-flow'));
});

test('detector does not mutate input', () => {
  const input = structuredClone(basePulse);
  const before = JSON.stringify(input);
  detectLiveOpportunity(input);
  assertEqual(JSON.stringify(input), before);
});

console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
