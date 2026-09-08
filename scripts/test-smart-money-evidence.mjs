#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { classifySmartMoneyEvidence } from '../lib/smart-money-evidence.js';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`PASS: ${name}`); passed++; } catch (error) { console.error(`FAIL: ${name} — ${error.message}`); failed++; } }
const fresh = { status: 'FRESH', isFresh: true };
const obs = (direction = 'BUY', notional = 100) => ({ symbol:'NVDA', type:'TRADE', direction, notional, freshness:fresh });
test('defaults to unattributed', () => { const r = classifySmartMoneyEvidence({ observations:[obs()] }); assert.equal(r.classification, 'UNATTRIBUTED'); });
test('stale observations cannot confirm attribution', () => { const r = classifySmartMoneyEvidence({ observations:[{...obs(), freshness:{status:'STALE',isFresh:false}}], attributionEvidence:['provider-attribution'] }); assert.equal(r.classification, 'UNATTRIBUTED'); });
test('multiple fresh observations can reach possible', () => { const r = classifySmartMoneyEvidence({ observations:[obs(),obs(),obs()] }); assert.equal(r.classification, 'POSSIBLE'); });
test('explicit provider attribution enables confirmed', () => { const r = classifySmartMoneyEvidence({ observations:[obs()], attributionEvidence:[{ source:'provider', type:'institutional_attribution' }] }); assert.equal(r.classification, 'CONFIRMED'); assert.equal(r.attributionEvidenceCount, 1); });
test('missing notional cannot create smart-money proof', () => { const r = classifySmartMoneyEvidence({ observations:[{...obs(), notional:null},{...obs(), notional:null},{...obs(), notional:null}] }); assert.equal(r.notionalObserved, 0); assert.equal(r.classification, 'UNATTRIBUTED'); });
test('score remains bounded', () => { const r = classifySmartMoneyEvidence({ observations:Array.from({length:20},()=>obs()), attributionEvidence:Array.from({length:20},()=>({source:'provider'})) }); assert.ok(r.evidenceScore <= 100); assert.ok(r.evidenceScore >= 0); });
test('disclaimer rejects unsupported whale claims', () => { const r = classifySmartMoneyEvidence({ observations:[obs()] }); assert.match(r.disclaimer, /does not prove smart-money/); });
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
