import assert from 'node:assert/strict';
import { extractRows, fetchUnusualWhalesFlow, isUnusualWhalesConfigured, normalizeObservation } from '../lib/unusual-whales-flow-provider.js';

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test('exports provider helpers', () => {
  assert.equal(typeof fetchUnusualWhalesFlow, 'function');
  assert.equal(typeof isUnusualWhalesConfigured, 'function');
});

test('missing key stays unavailable without network access', async () => {
  const result = await fetchUnusualWhalesFlow('NVDA', { env: {} });
  assert.equal(result.configured, false);
  assert.deepEqual(result.observations, []);
  assert.equal(result.dataQuality, 'UNAVAILABLE');
});

test('normalizes provider flow alert without fabricating fields', () => {
  const result = normalizeObservation({
    id: 'alert-1',
    ticker: 'NVDA',
    side: 'call',
    total_premium: 2400000,
    total_size: 120,
    executed_at: 1760000000,
    has_sweep: true,
    all_opening_trades: false,
  }, 'NVDA');

  assert.equal(result.direction, 'BUY');
  assert.equal(result.notional, 2400000);
  assert.equal(result.size, 120);
  assert.equal(result.timestamp, 1760000000000);
  assert.equal(result.providerEvidence.hasSweep, true);
  assert.equal(result.providerEvidence.allOpeningTrades, false);
  assert.equal(result.providerEvidence.openInterest, null);
});

test('extracts common provider payload shapes', () => {
  assert.equal(extractRows([{ id: 1 }]).length, 1);
  assert.equal(extractRows({ data: [{ id: 1 }] }).length, 1);
  assert.equal(extractRows({ results: [{ id: 1 }] }).length, 1);
  assert.equal(extractRows({ flow_alerts: [{ id: 1 }] }).length, 1);
  assert.deepEqual(extractRows({}), []);
});

test('invalid symbols are rejected', async () => {
  await assert.rejects(() => fetchUnusualWhalesFlow('bad symbol', { env: {} }), /Invalid symbol format/);
});

test('provider status errors never fabricate evidence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const result = await fetchUnusualWhalesFlow('NVDA', {
      env: { UNUSUAL_WHALES_API_KEY: 'test' },
      baseUrl: 'https://example.invalid',
    });
    assert.equal(result.dataQuality, 'UNAUTHORIZED');
    assert.deepEqual(result.observations, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`Unusual Whales Flow Provider: ${passed}/6 passed`);
