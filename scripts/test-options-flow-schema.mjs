#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeOptionsFlowObservation, validateOptionsFlowObservation } from '../lib/options-flow-schema.js';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`PASS: ${name}`); passed++; } catch (e) { console.error(`FAIL: ${name} — ${e.message}`); failed++; } }

test('normalizes call observation', () => { const r = normalizeOptionsFlowObservation({symbol:'nvda', type:'call', direction:'buy', strike:'180', premium:'12500', volume:'100', openInterest:'50'}); assert.equal(r.symbol,'NVDA'); assert.equal(r.type,'CALL'); assert.equal(r.strike,180); assert.equal(r.premium,12500); });
test('preserves missing numeric values as null', () => { const r = normalizeOptionsFlowObservation({symbol:'AAPL', type:'PUT', direction:'SELL', premium:null, volume:undefined}); assert.equal(r.premium,null); assert.equal(r.volume,null); });
test('unknown type is safe', () => { const r = normalizeOptionsFlowObservation({symbol:'TSLA', type:'straddle'}); assert.equal(r.type,'UNKNOWN'); });
test('validation accepts normalized observation', () => { const r = validateOptionsFlowObservation(normalizeOptionsFlowObservation({symbol:'AMD',type:'CALL',direction:'BUY'})); assert.equal(r.valid,true); });
test('validation rejects missing symbol', () => { const r = validateOptionsFlowObservation({type:'CALL',direction:'BUY'}); assert.equal(r.valid,false); });
test('does not infer whale attribution', () => { const r = normalizeOptionsFlowObservation({symbol:'NVDA',type:'CALL',direction:'BUY',premium:99999999}); assert.match(r.disclaimer,/whale attribution/); });
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
