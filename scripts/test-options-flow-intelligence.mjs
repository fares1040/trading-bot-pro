#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { normalizeOptionsFlowObservation, analyzeOptionsFlow } from '../lib/options-flow-intelligence.js';

let passed=0, failed=0;
const fresh={status:'FRESH',isFresh:true};
function test(name,fn){try{fn();console.log(`PASS: ${name}`);passed++;}catch(e){console.error(`FAIL: ${name} — ${e.message}`);failed++;}}
const row=(type, premium, volume, oi)=>({symbol:'NVDA',type,side:'BUY',premium,volume,openInterest:oi,freshness:fresh});

test('normalizes supported contract fields',()=>{const x=normalizeOptionsFlowObservation(row('CALL',1000,20,100));assert.equal(x.type,'CALL');assert.equal(x.premium,1000);});
test('unknown values are not fabricated',()=>{const x=normalizeOptionsFlowObservation({type:'foo',premium:null});assert.equal(x.type,'UNKNOWN');assert.equal(x.premium,null);});
test('fresh call premium creates call pressure',()=>{const x=analyzeOptionsFlow([row('CALL',1000,20,100),row('PUT',200,10,50)]);assert.equal(x.direction,'CALL');assert.ok(x.pressureScore>55);});
test('fresh put premium creates put pressure',()=>{const x=analyzeOptionsFlow([row('CALL',100,10,10),row('PUT',1000,30,100)]);assert.equal(x.direction,'PUT');assert.ok(x.pressureScore<45);});
test('stale contracts are excluded',()=>{const x=analyzeOptionsFlow([{...row('CALL',1000,20,100),freshness:{status:'STALE',isFresh:false}}]);assert.equal(x.observationCount,0);assert.equal(x.dataQuality,'INSUFFICIENT_DATA');});
test('volume fallback works without premium',()=>{const x=analyzeOptionsFlow([row('CALL',null,100,0),row('PUT',null,20,0)]);assert.equal(x.direction,'CALL');});
test('open interest is context only',()=>{const x=analyzeOptionsFlow([row('CALL',null,null,1000)]);assert.ok(x.evidence.includes('OPEN_INTEREST_CONTEXT'));});
test('whale attribution is not inferred',()=>{const x=analyzeOptionsFlow([row('CALL',1000000,10000,50000)]);assert.match(x.disclaimer,/does not identify institutional or whale/);});
test('no data stays unknown',()=>{const x=analyzeOptionsFlow([]);assert.equal(x.direction,'UNKNOWN');assert.equal(x.pressureScore,50);});
console.log(`\nResults: ${passed} passed, ${failed} failed`);process.exit(failed?1:0);
