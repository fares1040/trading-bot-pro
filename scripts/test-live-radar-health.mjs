#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { buildLiveRadarHealth } from '../lib/live-radar-health.js';
const fresh={status:'FRESH',isFresh:true};
let passed=0,failed=0;
function test(name,fn){try{fn();console.log(`PASS: ${name}`);passed++;}catch(e){console.error(`FAIL: ${name} — ${e.message}`);failed++;}}
test('empty radar is no data',()=>assert.equal(buildLiveRadarHealth([]).state,'NO_DATA'));
test('fresh entries are healthy',()=>{const r=buildLiveRadarHealth([{freshness:fresh},{freshness:fresh}]);assert.equal(r.state,'HEALTHY');assert.equal(r.freshRatio,1);});
test('stale-only entries are stale',()=>assert.equal(buildLiveRadarHealth([{freshness:{status:'STALE',isFresh:false}}]).state,'STALE'));
test('error-only entries are degraded',()=>assert.equal(buildLiveRadarHealth([{status:'ERROR',freshness:{status:'UNKNOWN',isFresh:false}}]).state,'DEGRADED'));
test('mixed fresh and stale remains healthy',()=>{const r=buildLiveRadarHealth([{freshness:fresh},{freshness:{status:'STALE',isFresh:false}}]);assert.equal(r.state,'HEALTHY');assert.equal(r.freshRatio,.5);});
test('health never claims exchange real-time',()=>assert.match(buildLiveRadarHealth([]).disclaimer,/does not guarantee exchange-level real-time/));
console.log(`\nResults: ${passed} passed, ${failed} failed`);process.exit(failed?1:0);
