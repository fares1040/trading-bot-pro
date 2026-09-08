#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeLiveFlowBatch, buildLiveFlowEvidence } from '../lib/live-flow-normalizer.js';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`PASS: ${name}`); passed++; } catch (error) { console.error(`FAIL: ${name} — ${error.message}`); failed++; } }

test('normalizes a valid flow batch', () => { const r = normalizeLiveFlowBatch([{ symbol: 'NVDA', type: 'TRADE', direction: 'BUY', notional: 10000 }]); assert.equal(r.observations.length, 1); assert.equal(r.errors.length, 0); });
test('rejects invalid observations without guessing', () => { const r = normalizeLiveFlowBatch([{ symbol: '', type: 'TRADE', direction: 'BUY' }]); assert.equal(r.observations.length, 0); assert.equal(r.errors.length, 1); });
test('prefers notional over size for evidence', () => { const r = buildLiveFlowEvidence({ symbol: 'AMD', type: 'TRADE', direction: 'SELL', notional: 50000, size: 1000 }); assert.equal(r.valid, true); assert.equal(r.evidence.find(e => e.type === 'FLOW_NOTIONAL').value, 50000); assert.equal(r.evidence.some(e => e.type === 'FLOW_SIZE'), false); });
test('uses size when notional is absent', () => { const r = buildLiveFlowEvidence({ symbol: 'TSLA', type: 'TRADE', direction: 'BUY', size: 250 }); assert.equal(r.evidence.find(e => e.type === 'FLOW_SIZE').value, 250); });
test('preserves freshness evidence', () => { const r = buildLiveFlowEvidence({ symbol: 'AAPL', type: 'QUOTE', direction: 'NEUTRAL', freshness: { status: 'FRESH' } }); assert.equal(r.evidence.find(e => e.type === 'FLOW_FRESHNESS').value, 'FRESH'); });
test('does not infer institutional attribution', () => { const r = buildLiveFlowEvidence({ symbol: 'META', type: 'TRADE', direction: 'BUY', notional: 1000000 }); assert.match(r.disclaimer, /No institutional or whale attribution/); });
test('caps batch processing at 100 observations', () => { const items = Array.from({ length: 101 }, () => ({ symbol: 'AAPL', type: 'TRADE', direction: 'BUY' })); const r = normalizeLiveFlowBatch(items); assert.equal(r.observations.length, 100); assert.equal(r.truncated, true); });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
