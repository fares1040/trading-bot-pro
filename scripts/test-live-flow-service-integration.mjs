import { enrichLiveOpportunityWithFlow } from '../lib/live-opportunity-service.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (error) {
    console.error('FAIL: ' + name + ' — ' + error.message);
    failed++;
  }
}

const fresh = (overrides = {}) => ({
  symbol: 'NVDA',
  type: 'TRADE',
  direction: 'BUY',
  notional: 100000,
  size: 1000,
  timestamp: new Date().toISOString(),
  freshness: { status: 'FRESH', isFresh: true, ageMs: 1000, thresholdMs: 90000 },
  ...overrides,
});

const baseEntry = { symbol: 'NVDA', status: 'WATCH', pulse: { direction: 'UP' } };

test('no supplied flow stays unattributed', () => {
  const result = enrichLiveOpportunityWithFlow(baseEntry, []);
  if (result.flow.direction !== 'UNKNOWN') throw new Error('expected UNKNOWN flow');
  if (result.flow.dataQuality !== 'INSUFFICIENT_DATA') throw new Error('expected insufficient flow');
  if (result.smartMoney.classification !== 'UNATTRIBUTED') throw new Error('expected UNATTRIBUTED');
});

test('fresh supplied flow is aggregated into the same entry', () => {
  const result = enrichLiveOpportunityWithFlow(baseEntry, [
    fresh({ direction: 'BUY' }),
    fresh({ direction: 'BUY', notional: 50000 }),
    fresh({ direction: 'SELL', notional: 10000 }),
  ]);
  if (result.flow.direction !== 'BUY') throw new Error('expected BUY flow');
  if (result.flow.observationCount !== 3) throw new Error('expected 3 observations');
  if (result.flow.pressureScore == null) throw new Error('expected flow pressure');
  if (result.smartMoney.classification !== 'POSSIBLE') throw new Error('expected POSSIBLE smart money');
});

test('explicit provider attribution can confirm smart money', () => {
  const result = enrichLiveOpportunityWithFlow(
    baseEntry,
    [fresh(), fresh({ notional: 80000 }), fresh({ notional: 60000 })],
    [{ source: 'provider', type: 'institutional-attribution', confidence: 0.9 }],
  );
  if (result.smartMoney.classification !== 'CONFIRMED') throw new Error('expected CONFIRMED');
  if (result.smartMoney.attributionEvidenceCount !== 1) throw new Error('expected attribution evidence');
});

test('price/volume entry alone never becomes smart money', () => {
  const result = enrichLiveOpportunityWithFlow(baseEntry, []);
  if (result.smartMoney.classification === 'POSSIBLE' || result.smartMoney.classification === 'CONFIRMED') {
    throw new Error('unsupported smart-money attribution');
  }
});

console.log('\nLive Flow Service Integration Tests');
console.log('PASS: ' + passed);
console.log('FAIL: ' + failed);
console.log('TOTAL: ' + (passed + failed));
if (failed) process.exit(1);
