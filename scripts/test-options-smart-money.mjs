import assert from 'node:assert/strict';
import { classifyOptionsSmartMoney } from '../lib/options-smart-money.js';

const fresh = { status: 'FRESH', isFresh: true };
const obs = (overrides = {}) => ({ symbol: 'NVDA', type: 'CALL', direction: 'BUY', contracts: 10, notional: 5000, freshness: fresh, ...overrides });
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };

test('defaults to unattributed', () => assert.equal(classifyOptionsSmartMoney([obs()]).classification, 'UNATTRIBUTED'));
test('three strong fresh observations can reach possible', () => {
  const r = classifyOptionsSmartMoney([obs(), obs(), obs()]);
  assert.equal(r.classification, 'POSSIBLE'); assert.ok(r.pressureScore >= 65);
});
test('explicit provider evidence enables confirmed', () => {
  const r = classifyOptionsSmartMoney([obs()], { attributionEvidence: [{ source: 'provider', type: 'institutional_attribution' }] });
  assert.equal(r.classification, 'CONFIRMED'); assert.equal(r.attributionEvidenceCount, 1);
});
test('stale flow cannot confirm', () => {
  const r = classifyOptionsSmartMoney([obs({ freshness: { status: 'STALE', isFresh: false } })], { attributionEvidence: ['provider'] });
  assert.equal(r.classification, 'UNATTRIBUTED');
});
test('missing quantitative flow cannot create possible', () => {
  const r = classifyOptionsSmartMoney([obs({ notional: null, contracts: null }), obs({ notional: null, contracts: null }), obs({ notional: null, contracts: null })]);
  assert.equal(r.classification, 'UNATTRIBUTED'); assert.equal(r.quantitativeFlow, false);
  assert.match(r.disclaimer, /does not prove institutional or whale/i);
});
test('score stays bounded', () => {
  const r = classifyOptionsSmartMoney(Array.from({ length: 30 }, () => obs()), { attributionEvidence: Array.from({ length: 5 }, () => ({ source: 'provider' })) });
  assert.ok(r.evidenceScore >= 0 && r.evidenceScore <= 100);
});

console.log(`Options Smart Money tests passed: ${passed}`);
