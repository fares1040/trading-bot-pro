import assert from 'node:assert/strict';
import { normalizeOptionsFlowObservation, validateOptionsFlowObservation, buildOptionsFlowEvidence } from '../lib/options-flow-evidence.js';
import { aggregateOptionsFlow } from '../lib/options-flow-aggregator.js';

const fresh = { status: 'FRESH', isFresh: true };
const obs = (overrides = {}) => ({ symbol: 'NVDA', type: 'CALL', direction: 'BUY', contracts: 10, notional: 5000, freshness: fresh, ...overrides });

let tests = 0;
const test = (name, fn) => { fn(); tests += 1; console.log(`✓ ${name}`); };

test('normalizes numeric and enum fields', () => {
  const x = normalizeOptionsFlowObservation(obs({ strike: '180', contracts: '12' }));
  assert.equal(x.strike, 180); assert.equal(x.contracts, 12); assert.equal(x.type, 'CALL');
});
test('null inputs remain null', () => {
  const x = normalizeOptionsFlowObservation(obs({ notional: null, contracts: null }));
  assert.equal(x.notional, null); assert.equal(x.contracts, null);
});
test('validation accepts normalized observation', () => {
  assert.equal(validateOptionsFlowObservation(normalizeOptionsFlowObservation(obs())).valid, true);
});
test('evidence does not invent values', () => {
  const e = buildOptionsFlowEvidence(obs({ notional: null, contracts: null }));
  assert.equal(e.some((x) => x.type === 'OPTIONS_NOTIONAL'), false);
  assert.equal(e.some((x) => x.type === 'OPTIONS_CONTRACTS'), false);
});
test('aggregates fresh directional flow', () => {
  const x = aggregateOptionsFlow([obs(), obs({ direction: 'SELL', notional: 1000 })]);
  assert.equal(x.observationCount, 2); assert.equal(x.direction, 'BUY'); assert.ok(x.pressureScore > 0);
});
test('stale observations are excluded by default', () => {
  const x = aggregateOptionsFlow([obs({ freshness: { status: 'STALE', isFresh: false } })]);
  assert.equal(x.observationCount, 0); assert.equal(x.dataQuality, 'INSUFFICIENT_DATA');
});
test('missing flow cannot create a whale claim', () => {
  const x = aggregateOptionsFlow([]);
  assert.equal(x.pressureScore, 0); assert.equal(x.direction, 'UNKNOWN');
  assert.match(x.disclaimer, /not proof of institutional/i);
});

console.log(`Options Flow tests passed: ${tests}`);
