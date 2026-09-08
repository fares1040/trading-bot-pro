import { ACCELERATION_RADAR_DEFAULTS, detectAcceleration } from '../lib/acceleration-radar.js';

let passCount = 0;
let failCount = 0;
function test(name, fn) { try { fn(); console.log('PASS: ' + name); passCount++; } catch (error) { console.error('FAIL: ' + name); console.error('   Error: ' + error.message); failCount++; } }
function assertEqual(actual, expected) { if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
function assertTrue(value) { if (!value) throw new Error('Expected truthy value'); }
function assertFalse(value) { if (value) throw new Error('Expected falsy value'); }
function assertNull(value) { if (value != null) throw new Error(`Expected null, got ${JSON.stringify(value)}`); }

const fresh = { status: 'FRESH', isFresh: true, ageMs: 10_000, thresholdMs: 90_000, asOf: '2026-09-08T18:00:00.000Z', fetchedAt: '2026-09-08T18:00:10.000Z' };
const base = { symbol: 'AAPL', direction: 'UP', timestamp: fresh.asOf, fetchedAt: fresh.fetchedAt, freshness: fresh, accelerationState: 'ACCELERATING', priceAccelerationPercent: 0.3, volumeAccelerationPercent: 8, pressureScore: 75, spreadPercent: 0.4 };

test('defaults are deterministic', () => { assertEqual(ACCELERATION_RADAR_DEFAULTS.minPressureScore, 65); assertEqual(ACCELERATION_RADAR_DEFAULTS.maxAgeMs, 90_000); });
test('strong acceleration is detected', () => { const r = detectAcceleration(base); assertTrue(r.eligible); assertEqual(r.reason, 'ACCELERATION_DETECTED'); assertEqual(r.direction, 'UP'); assertTrue(r.evidence.length >= 2); });
test('stale data is rejected', () => { const r = detectAcceleration({ ...base, freshness: { ...fresh, status: 'STALE', isFresh: false } }); assertFalse(r.eligible); assertEqual(r.reason, 'STALE_OR_UNVERIFIED_DATA'); });
test('age limit is enforced', () => { const r = detectAcceleration({ ...base, freshness: { ...fresh, ageMs: 90_001 } }); assertFalse(r.eligible); assertEqual(r.reason, 'STALE_OR_UNVERIFIED_DATA'); });
test('flat direction is rejected', () => { const r = detectAcceleration({ ...base, direction: 'FLAT' }); assertFalse(r.eligible); assertEqual(r.reason, 'NO_DIRECTION'); });
test('wide spread blocks detection', () => { const r = detectAcceleration({ ...base, spreadPercent: 2 }); assertFalse(r.eligible); assertEqual(r.reason, 'SPREAD_TOO_WIDE'); });
test('two of three acceleration factors are enough', () => { const r = detectAcceleration({ ...base, pressureScore: 40, volumeAccelerationPercent: 8 }); assertTrue(r.eligible); });
test('missing inputs are not fabricated', () => { const r = detectAcceleration({ ...base, priceAccelerationPercent: null, volumeAccelerationPercent: null, pressureScore: null }); assertFalse(r.eligible); assertNull(r.priceAccelerationPercent); assertNull(r.volumeAccelerationPercent); assertNull(r.pressureScore); });
test('down direction uses directional acceleration', () => { const r = detectAcceleration({ ...base, direction: 'DOWN', priceAccelerationPercent: -0.3 }); assertTrue(r.eligible); assertEqual(r.direction, 'DOWN'); });
test('output is explicitly derived', () => { const r = detectAcceleration(base); assertEqual(r.mode, 'DERIVED'); assertEqual(r.source, 'LIVE_MARKET_PULSE'); assertTrue(r.disclaimer.includes('not independent real-time order-flow')); });
test('detector does not mutate input', () => { const input = structuredClone(base); const before = JSON.stringify(input); detectAcceleration(input); assertEqual(JSON.stringify(input), before); });

console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
