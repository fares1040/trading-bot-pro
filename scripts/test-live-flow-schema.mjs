#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeLiveFlowObservation, validateLiveFlowObservation, LIVE_FLOW_MODE, LIVE_FLOW_VERSION } from '../lib/live-flow-schema.js';

let passed = 0;
let failed = 0;
function test(name, fn) { try { fn(); console.log(`PASS: ${name}`); passed++; } catch (error) { console.error(`FAIL: ${name} — ${error.message}`); failed++; } }

test('exports stable schema metadata', () => { assert.equal(LIVE_FLOW_VERSION, '1.0'); assert.equal(LIVE_FLOW_MODE, 'SCHEMA'); });
test('normalizes numeric fields without null-to-zero fabrication', () => { const v = normalizeLiveFlowObservation({ symbol: 'nvda', price: null, size: '', notional: '12500', type: 'trade', direction: 'buy' }); assert.equal(v.symbol, 'NVDA'); assert.equal(v.price, null); assert.equal(v.size, null); assert.equal(v.notional, 12500); });
test('rejects unknown enums instead of guessing', () => { const v = normalizeLiveFlowObservation({ symbol: 'AMD', type: 'whale', direction: 'institutional' }); assert.equal(v.type, 'UNKNOWN'); assert.equal(v.direction, 'UNKNOWN'); });
test('preserves supplied freshness and source', () => { const freshness = { status: 'FRESH', isFresh: true }; const v = normalizeLiveFlowObservation({ symbol: 'TSLA', freshness, source: 'TEST' }); assert.deepEqual(v.freshness, freshness); assert.equal(v.source, 'TEST'); });
test('does not infer whale or institutional attribution', () => { const v = normalizeLiveFlowObservation({ symbol: 'AAPL', evidence: ['large trade'] }); assert.match(v.disclaimer, /No institutional or whale attribution/); });
test('validates normalized observation', () => { const valid = normalizeLiveFlowObservation({ symbol: 'AAPL', type: 'TRADE', direction: 'BUY' }); assert.equal(validateLiveFlowObservation(valid).valid, true); const invalid = normalizeLiveFlowObservation({ type: 'TRADE', direction: 'BUY' }); assert.equal(validateLiveFlowObservation(invalid).valid, false); });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
