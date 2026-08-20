/**
 * Options Provider Tests
 *
 * Tests for lib/options-provider.js (Phase 6 STEP 2 shared foundation).
 * Run with: node scripts/test-options-provider.mjs
 *
 * These tests are fully local — they mock global.fetch so no network or
 * dev server is required. They verify:
 *   - symbol validation
 *   - contract normalization (real values preserved, missing -> null)
 *   - fetch + normalize success / empty / error / invalid-symbol states
 *   - provider status shape
 */

import {
  cleanSymbol,
  normalizeOptionContract,
  fetchOptionsChain,
  getOptionsProviderStatus,
  clearOptionsCache,
} from '../lib/options-provider.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected true but got false');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

function assertNull(value, message = '') {
  if (value !== null) throw new Error(`${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`);
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) throw new Error(message || 'Expected non-null value but got null/undefined');
}

// ---------------------------------------------------------------------------
// Mock fetch helper
// ---------------------------------------------------------------------------
function mockFetchOnce(handler) {
  globalThis.fetch = handler;
}

function buildYahooJson({ calls = [], puts = [], underlying = 150, expiry = 1700000000 } = {}) {
  return {
    optionChain: {
      result: [
        {
          quote: { regularMarketPrice: underlying },
          expirationDates: [expiry],
          options: [{ calls, puts }],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Options Provider Tests');
console.log('========================================\n');

// 1. Symbol validation
test('cleanSymbol: valid ticker passes', () => {
  assertEqual(cleanSymbol('aapl'), 'AAPL', 'lowercase should uppercase');
  assertEqual(cleanSymbol('BRK.B'), 'BRK.B', 'dot allowed');
  assertEqual(cleanSymbol(' BTC '), 'BTC', 'whitespace trimmed');
});

test('cleanSymbol: invalid ticker rejected', () => {
  assertNull(cleanSymbol(''), 'empty rejected');
  assertNull(cleanSymbol('123'), 'leading digit rejected');
  assertNull(cleanSymbol('TOOLONGSYM'), 'too long rejected');
  assertNull(cleanSymbol('AAPL@'), 'invalid char rejected');
});

// 2. Contract normalization — full data
test('normalizeOptionContract: full data preserved', () => {
  const raw = {
    contractSymbol: 'AAPL231201C00150000',
    bid: 2.5,
    ask: 2.7,
    lastPrice: 2.6,
    volume: 1000,
    openInterest: 5000,
    impliedVolatility: 0.35,
    strike: 150,
  };
  const side = 'CALL';
  const underlying = 150;
  const expiry = 1700000000;
  const c = normalizeOptionContract(raw, side, underlying, expiry);

  assertEqual(c.optionType, 'CALL', 'side preserved');
  assertEqual(c.strike, 150, 'strike preserved');
  assertEqual(c.bid, 2.5, 'bid preserved');
  assertEqual(c.ask, 2.7, 'ask preserved');
  assertEqual(c.lastPrice, 2.6, 'lastPrice preserved');
  assertEqual(c.volume, 1000, 'volume preserved');
  assertEqual(c.openInterest, 5000, 'openInterest preserved');
  assertEqual(c.impliedVolatility, 0.35, 'IV preserved');
  assertEqual(c.premium, 2.6, 'premium = mid of bid/ask');
  assertEqual(c.contractCost, 260, 'contractCost = premium * 100');
  assertEqual(c.underlying, 150, 'underlying preserved');
  assertEqual(c.expiry, new Date(expiry * 1000).toISOString().slice(0, 10), 'expiry formatted');
  assertEqual(c.source, 'Yahoo Finance options chain', 'source label');
  assertTrue(c.score >= 0 && c.score <= 100, 'score within 0-100');
});

// 3. Contract normalization — missing data -> null (no fabrication)
test('normalizeOptionContract: missing IV/OI/volume -> null, not fabricated', () => {
  const raw = {
    contractSymbol: 'AAPL231201P00150000',
    bid: 1.0,
    ask: 1.2,
    // lastPrice, volume, openInterest, impliedVolatility all absent
    strike: 150,
  };
  const c = normalizeOptionContract(raw, 'PUT', 150, 1700000000);

  assertEqual(c.optionType, 'PUT', 'side preserved');
  assertNull(c.impliedVolatility, 'missing IV -> null (never 0)');
  assertEqual(c.volume, null, 'missing volume -> null (never fabricated as 0)');
  assertEqual(c.openInterest, null, 'missing OI -> null (never fabricated as 0)');
  assertEqual(c.premium, 1.1, 'premium = mid when bid/ask present');
  assertNotNull(c.score, 'score still computed');
});

test('normalizeOptionContract: no bid/ask/last -> premium null', () => {
  const raw = { contractSymbol: 'X', strike: 100 };
  const c = normalizeOptionContract(raw, 'CALL', 100, 1700000000);
  assertNull(c.premium, 'premium null when no price data');
  assertNull(c.contractCost, 'contractCost null when premium null');
  assertNull(c.spreadPct, 'spreadPct null when no bid/ask');
});

// 4. fetchOptionsChain — invalid symbol
test('fetchOptionsChain: invalid symbol returns unavailable', async () => {
  clearOptionsCache();
  const res = await fetchOptionsChain('123');
  assertFalse(res.available, 'available false for invalid symbol');
  assertEqual(res.reason, 'invalid-symbol', 'reason set');
  assertEqual(res.count, 0, 'no contracts');
  assertEqual(res.contracts.length, 0, 'empty contracts array');
  assertEqual(res.source, 'Yahoo Finance options chain', 'source label');
});

// 5. fetchOptionsChain — successful fetch
test('fetchOptionsChain: successful Yahoo response normalized', async () => {
  clearOptionsCache();
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [{ contractSymbol: 'AAPLP', bid: 1, ask: 1.1, strike: 150, impliedVolatility: 0.4, volume: 300, openInterest: 1000 }],
    underlying: 150,
  });
  mockFetchOnce(async () => ({
    ok: true,
    text: async () => JSON.stringify(json),
  }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertTrue(res.available, 'available true on success');
  assertEqual(res.count, 2, 'two contracts (1 call + 1 put)');
  assertEqual(res.contracts[0].optionType, 'CALL', 'first is call');
  assertEqual(res.contracts[1].optionType, 'PUT', 'second is put');
  assertEqual(res.underlyingPrice, 150, 'underlying preserved');
  assertEqual(res.provider, 'yahoo', 'provider tag');
  assertNull(res.reason, 'no error reason on success');
});

// 6. fetchOptionsChain — HTTP error
test('fetchOptionsChain: HTTP 404 returns unavailable', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => ({ ok: false, status: 404, text: async () => '' }));
  const res = await fetchOptionsChain('FAKE', { skipCache: true });
  assertFalse(res.available, 'unavailable on HTTP error');
  assertEqual(res.reason, 'yahoo-options-404', 'status reason captured');
  assertEqual(res.count, 0, 'no contracts');
});

// 7. fetchOptionsChain — empty body
test('fetchOptionsChain: empty response returns unavailable', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => '   ' }));
  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable on empty body');
  assertEqual(res.reason, 'yahoo-options-empty-response', 'empty reason');
});

// 8. fetchOptionsChain — invalid JSON
test('fetchOptionsChain: invalid JSON returns unavailable', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => 'not json' }));
  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable on invalid JSON');
  assertEqual(res.reason, 'yahoo-options-invalid-json', 'json reason');
});

// 9. fetchOptionsChain — no chain / no expiration
test('fetchOptionsChain: no optionChain result returns unavailable', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ optionChain: { result: [] } }) }));
  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable when no chain');
  assertEqual(res.reason, 'yahoo-options-no-chain', 'no-chain reason');
});

// 10. fetchOptionsChain — chain with no calls/puts
test('fetchOptionsChain: empty calls/puts returns unavailable', async () => {
  clearOptionsCache();
  const json = { optionChain: { result: [{ quote: { regularMarketPrice: 100 }, expirationDates: [1700000000], options: [{}] }] } };
  mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(json) }));
  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable when no contracts');
  assertEqual(res.reason, 'yahoo-options-empty-chain', 'empty-chain reason');
});

// 11. fetchOptionsChain — network/timeout failure
test('fetchOptionsChain: network failure returns unavailable', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => { throw new Error('ECONNRESET'); });
  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable on network error');
  assertTrue(res.reason.startsWith('yahoo-options-request-failed'), 'request-failed reason');
});

// 12. Provider status shape
test('getOptionsProviderStatus: correct shape', () => {
  const status = getOptionsProviderStatus();
  assertEqual(status.provider, 'yahoo', 'provider tag');
  assertEqual(status.source, 'Yahoo Finance options chain', 'source label');
  assertTrue(status.configured, 'configured (public endpoint)');
  assertFalse(status.requiresAuth, 'no auth required');
  assertEqual(status.available, null, 'availability unknown until live fetch');
  assertTrue(status.capabilities.calls, 'calls capability');
  assertTrue(status.capabilities.puts, 'puts capability');
  assertTrue(status.capabilities.impliedVolatility, 'IV capability');
  assertTrue(status.capabilities.openInterest, 'OI capability');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Test Results');
console.log('========================================');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total: ${passCount + failCount}`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}