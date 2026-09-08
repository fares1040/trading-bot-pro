#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { aggregateLiveFlow } from '../lib/live-flow-aggregator.js';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`PASS: ${name}`); passed++; } catch (error) { console.error(`FAIL: ${name} — ${error.message}`); failed++; } }
const fresh = { status: 'FRESH', isFresh: true };

test('aggregates buy and sell notional', () => { const r = aggregateLiveFlow([{ symbol:'NVDA', type:'TRADE', direction:'BUY', notional:900, freshness:fresh }, { symbol:'NVDA', type:'TRADE', direction:'SELL', notional:100, freshness:fresh }]); assert.equal(r.direction, 'BUY'); assert.equal(r.buyNotional, 900); assert.equal(r.sellNotional, 100); assert.equal(r.buyShare, 90); });
test('freshness gate excludes stale observations by default', () => { const r = aggregateLiveFlow([{ symbol:'AAPL', type:'TRADE', direction:'BUY', notional:1000, freshness:{status:'STALE',isFresh:false} }]); assert.equal(r.observationCount, 0); assert.equal(r.dataQuality, 'INSUFFICIENT_DATA'); });
test('supports explicit inclusion of non-fresh observations', () => { const r = aggregateLiveFlow([{ symbol:'AAPL', type:'TRADE', direction:'BUY', size:10, freshness:{status:'STALE',isFresh:false} }], { freshOnly:false }); assert.equal(r.observationCount, 1); assert.equal(r.direction, 'BUY'); });
test('uses size when notional is unavailable', () => { const r = aggregateLiveFlow([{ symbol:'TSLA', type:'TRADE', direction:'SELL', size:20, freshness:fresh }]); assert.equal(r.sellNotional, 20); });
test('does not invent direction from unknown observations', () => { const r = aggregateLiveFlow([{ symbol:'AMD', type:'TRADE', direction:'UNKNOWN', freshness:fresh }]); assert.equal(r.direction, 'UNKNOWN'); assert.equal(r.pressureScore, null); });
test('confidence increases with directional confluence', () => { const one = aggregateLiveFlow([{symbol:'META',type:'TRADE',direction:'BUY',notional:100,freshness:fresh}]); const many = aggregateLiveFlow(Array.from({length:5},()=>({symbol:'META',type:'TRADE',direction:'BUY',notional:100,freshness:fresh}))); assert.ok(many.confidence > one.confidence); });
test('never labels pressure as smart money', () => { const r = aggregateLiveFlow([{symbol:'MSFT',type:'TRADE',direction:'BUY',notional:1000,freshness:fresh}]); assert.match(r.disclaimer, /not proof of institutional/); });

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
