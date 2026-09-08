#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { buildLiveIntelligence } from '../lib/live-intelligence-pipeline.js';

const fresh={status:'FRESH',isFresh:true};
const current={symbol:'NVDA',price:100,previousClose:99,volume:100000,changePercent:1,freshness:fresh};
const flow=[{symbol:'NVDA',type:'TRADE',direction:'BUY',notional:1000,freshness:fresh},{symbol:'NVDA',type:'TRADE',direction:'BUY',notional:900,freshness:fresh},{symbol:'NVDA',type:'TRADE',direction:'SELL',notional:100,freshness:fresh}];
let passed=0,failed=0;
function test(n,f){try{f();console.log(`PASS: ${n}`);passed++;}catch(e){console.error(`FAIL: ${n} — ${e.message}`);failed++;}}
test('assembles all intelligence layers',()=>{const r=buildLiveIntelligence({current,history:[{price:99,volume:90000}],flow});assert.equal(r.symbol,'NVDA');assert.ok(r.pulse);assert.ok(r.acceleration);assert.ok(r.flowPressure);assert.ok(r.smartMoney);assert.ok(r.options);});
test('missing options data remains unknown',()=>{const r=buildLiveIntelligence({current,flow});assert.equal(r.options.direction,'UNKNOWN');});
test('freshness is preserved',()=>{const r=buildLiveIntelligence({current});assert.deepEqual(r.freshness,fresh);});
test('pipeline does not claim whale activity',()=>{const r=buildLiveIntelligence({current,flow});assert.match(r.disclaimer,/not converted into certainty/);assert.match(r.smartMoney.disclaimer,/does not prove smart-money/);});
console.log(`\nResults: ${passed} passed, ${failed} failed`);process.exit(failed?1:0);
