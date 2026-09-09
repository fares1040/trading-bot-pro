import { strict as assert } from 'node:assert';
import { detectEarlyExplosion } from '../lib/early-explosion-radar.js';

const fresh = { status: 'FRESH', isFresh: true, ageMs: 5_000 };
const serviceShape = {
  symbol: 'NVDA',
  freshness: fresh,
  pulse: {
    direction: 'UP',
    pressureScore: 72,
    priceAccelerationPercent: 0.25,
    volumeAccelerationPercent: 7,
    spreadPercent: 0.4,
  },
  opportunity: { direction: 'UP', eligible: false },
  acceleration: { eligible: true },
  flow: { pressureScore: 65 },
  smartMoney: { classification: 'UNATTRIBUTED' },
};

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS: ${name}`); passed++; }
  catch (error) { console.error(`FAIL: ${name} — ${error.message}`); failed++; }
}

test('service-shaped entry reaches ignition', () => {
  const result = detectEarlyExplosion(serviceShape);
  assert.equal(result.eligible, true);
  assert.equal(result.state, 'IGNITION');
  assert.equal(result.direction, 'UP');
  assert.ok(result.signalCount >= 3);
});

test('service-shaped stale entry is rejected', () => {
  const result = detectEarlyExplosion({ ...serviceShape, freshness: { ...fresh, status: 'STALE', isFresh: false } });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'STALE_OR_UNVERIFIED_DATA');
});

test('service-shaped flow evidence contributes without whale attribution', () => {
  const result = detectEarlyExplosion({
    ...serviceShape,
    pulse: { ...serviceShape.pulse, priceAccelerationPercent: null, volumeAccelerationPercent: null },
    acceleration: { eligible: false },
    flow: { pressureScore: 75 },
  });
  assert.equal(result.state, 'PREPARING');
  assert.ok(result.signals.some((signal) => signal.type === 'FLOW_PRESSURE'));
  assert.match(result.disclaimer, /does not.*prove institutional\/whale activity/);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
