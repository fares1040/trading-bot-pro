/**
 * Hunter + Options Intelligence Integration Tests
 *
 * Phase 6 STEP 3 — wire shared options provider into Hunter as a
 * NON-SCORING intelligence layer only.
 *
 * Run with: node scripts/test-hunter-options.mjs
 *
 * Fully local — mocks global.fetch so no network or dev server is required.
 *
 * Verifies:
 *   1. summarizeOptionsIntelligence maps every explicit state
 *      (available / unavailable / error / timeout) correctly.
 *   2. attachOptionsIntelligence adds optionsIntelligence WITHOUT mutating
 *      any scoring field (hunterScore, hic, conviction, institutional...).
 *   3. Hunter scoring is IDENTICAL with options available vs unavailable.
 *   4. Options data is informational only — never changes the score.
 *   5. Defensive handling: timeout, empty chain, Yahoo error, malformed,
 *      network failure all resolve to explicit non-scoring states.
 *   6. No duplicate Yahoo fetch for the same symbol within one request
 *      (provider cache reuse).
 */

import {
  calculateHunterScore,
  evaluateHICCandidate,
  deriveConviction,
  classifyMarketRegime,
  summarizeOptionsIntelligence,
  attachOptionsIntelligence,
} from '../lib/hunter-intelligence.js';
import {
  fetchOptionsChain,
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
// Build a deterministic Hunter opportunity (no options involved)
// ---------------------------------------------------------------------------
function buildHunterOpportunity(symbol = 'AAPL', overrides = {}) {
  const item = {
    symbol,
    technicalReady: true,
    setupScore: 80,
    price: 150,
    averageVolume20: 5_000_000,
    relativeVolume: 2.0,
    riskReward: 2.5,
    rsi: 55,
    resistanceDistancePercent: 5,
    momentumPercent: 3,
    ...overrides,
  };
  const regime = classifyMarketRegime([]); // balanced, score 50
  const hic = evaluateHICCandidate(item, regime);
  const conviction = deriveConviction(item, regime);
  const hunter = calculateHunterScore({
    setupScore: item.setupScore,
    convictionScore: conviction.score,
    regimeScore: regime.score,
    hicEligible: hic.eligible,
    institutionalAvailable: false,
    institutionalScore: null,
  });
  return {
    ...item,
    hic,
    conviction,
    hunterScore: hunter.score,
    hunterTier: hunter.tier,
    hunterEligible: hunter.eligible,
    institutionalIntelligence: { available: false },
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Hunter + Options Intelligence Tests');
console.log('========================================\n');

// 1. summarizeOptionsIntelligence — null input
test('summarizeOptionsIntelligence: null -> unavailable (no request)', () => {
  const s = summarizeOptionsIntelligence(null);
  assertFalse(s.available, 'not available');
  assertEqual(s.state, 'unavailable', 'state unavailable');
  assertNull(s.source, 'source null when unavailable');
  assertNull(s.summary, 'summary null');
  assertEqual(s.reason, 'no-options-request', 'reason set');
});

// 2. summarizeOptionsIntelligence — available
test('summarizeOptionsIntelligence: available -> normalized summary', () => {
  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 2,
    contracts: [
      { optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 500, openInterest: 2000, liquidityScore: 80 },
      { optionType: 'PUT', contractSymbol: 'P1', strike: 150, expiry: '2023-11-15', premium: 1.1, impliedVolatility: 0.4, volume: 300, openInterest: 1000, liquidityScore: 60 },
    ],
  };
  const s = summarizeOptionsIntelligence(raw);
  assertTrue(s.available, 'available true');
  assertEqual(s.state, 'available', 'state available');
  assertEqual(s.source, 'Yahoo Finance options chain', 'source preserved');
  assertNull(s.reason, 'no reason on success');
  assertNotNull(s.summary, 'summary present');
  assertEqual(s.summary.underlyingPrice, 150, 'underlying in summary');
  assertEqual(s.summary.count, 2, 'count in summary');
  assertEqual(s.summary.calls, 1, 'calls counted');
  assertEqual(s.summary.puts, 1, 'puts counted');
  assertEqual(s.summary.topLiquid.length, 2, 'topLiquid has both');
  assertEqual(s.summary.topLiquid[0].contractSymbol, 'C1', 'most liquid first');
});

// 3. summarizeOptionsIntelligence — unavailable (no chain)
test('summarizeOptionsIntelligence: unavailable reason preserved', () => {
  const raw = {
    available: false,
    source: 'Yahoo Finance options chain',
    reason: 'yahoo-options-no-chain',
    errors: ['Yahoo returned no optionChain result or expiration'],
    underlyingPrice: null,
    expiry: null,
    count: 0,
    contracts: [],
  };
  const s = summarizeOptionsIntelligence(raw);
  assertFalse(s.available, 'not available');
  assertEqual(s.state, 'unavailable', 'state unavailable (not error)');
  assertNull(s.source, 'source null when unavailable');
  assertNull(s.summary, 'summary null');
  assertEqual(s.reason, 'yahoo-options-no-chain', 'reason preserved');
});

// 4. summarizeOptionsIntelligence — error (malformed)
test('summarizeOptionsIntelligence: malformed response -> error state', () => {
  const raw = {
    available: false,
    source: 'Yahoo Finance options chain',
    reason: 'yahoo-options-invalid-json',
    errors: ['yahoo-options-invalid-json'],
    underlyingPrice: null,
    expiry: null,
    count: 0,
    contracts: [],
  };
  const s = summarizeOptionsIntelligence(raw);
  assertEqual(s.state, 'error', 'malformed -> error state');
});

// 5. summarizeOptionsIntelligence — timeout
test('summarizeOptionsIntelligence: timeout -> timeout state', () => {
  const raw = {
    available: false,
    source: 'Yahoo Finance options chain',
    reason: 'yahoo-options-request-failed:timeout',
    errors: ['yahoo-options-request-failed:timeout'],
    underlyingPrice: null,
    expiry: null,
    count: 0,
    contracts: [],
  };
  const s = summarizeOptionsIntelligence(raw);
  assertEqual(s.state, 'timeout', 'timeout reason -> timeout state');
});

// 6. attachOptionsIntelligence — does NOT mutate scoring
test('attachOptionsIntelligence: scoring fields preserved exactly', () => {
  const opp = buildHunterOpportunity('AAPL');
  const before = JSON.stringify({
    hunterScore: opp.hunterScore,
    hunterTier: opp.hunterTier,
    hic: opp.hic,
    conviction: opp.conviction,
    institutionalIntelligence: opp.institutionalIntelligence,
  });

  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 1,
    contracts: [{ optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 500, openInterest: 2000, liquidityScore: 80 }],
  };
  const attached = attachOptionsIntelligence(opp, raw);

  const after = JSON.stringify({
    hunterScore: attached.hunterScore,
    hunterTier: attached.hunterTier,
    hic: attached.hic,
    conviction: attached.conviction,
    institutionalIntelligence: attached.institutionalIntelligence,
  });

  assertEqual(after, before, 'scoring fields unchanged after attach');
  assertNotNull(attached.optionsIntelligence, 'optionsIntelligence added');
  assertTrue(attached.optionsIntelligence.available, 'options available in attached');
});

// 7. Hunter scoring identical with options available vs unavailable
test('Hunter scoring identical: options available vs unavailable', () => {
  const opp = buildHunterOpportunity('AAPL');

  const rawAvailable = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 2,
    contracts: [
      { optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 500, openInterest: 2000, liquidityScore: 80 },
      { optionType: 'PUT', contractSymbol: 'P1', strike: 150, expiry: '2023-11-15', premium: 1.1, impliedVolatility: 0.4, volume: 300, openInterest: 1000, liquidityScore: 60 },
    ],
  };
  const rawUnavailable = {
    available: false,
    source: 'Yahoo Finance options chain',
    reason: 'yahoo-options-no-chain',
    errors: ['no chain'],
    underlyingPrice: null,
    expiry: null,
    count: 0,
    contracts: [],
  };

  const withOptions = attachOptionsIntelligence(opp, rawAvailable);
  const withoutOptions = attachOptionsIntelligence(opp, rawUnavailable);

  assertEqual(withOptions.hunterScore, withoutOptions.hunterScore, 'hunterScore identical');
  assertEqual(withOptions.hunterTier, withoutOptions.hunterTier, 'hunterTier identical');
  assertEqual(withOptions.hic.eligible, withoutOptions.hic.eligible, 'HIC eligible identical');
  assertEqual(withOptions.conviction.score, withoutOptions.conviction.score, 'conviction identical');
});

// 8. fetchOptionsChain — successful fetch integrates into summary
test('fetchOptionsChain success -> summarizeOptionsIntelligence available', async () => {
  clearOptionsCache();
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [{ contractSymbol: 'AAPLP', bid: 1, ask: 1.1, strike: 150, impliedVolatility: 0.4, volume: 300, openInterest: 1000 }],
    underlying: 150,
  });
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const raw = await fetchOptionsChain('AAPL', { skipCache: true });
  const s = summarizeOptionsIntelligence(raw);
  assertTrue(s.available, 'available');
  assertEqual(s.state, 'available', 'state available');
  assertEqual(s.summary.count, 2, 'two contracts summarized');
});

// 9. fetchOptionsChain — timeout/network failure -> timeout state
test('fetchOptionsChain network failure -> timeout state (defensive)', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => { throw new Error('timeout'); });
  const raw = await fetchOptionsChain('AAPL', { skipCache: true });
  const s = summarizeOptionsIntelligence(raw);
  assertFalse(s.available, 'unavailable on network failure');
  assertEqual(s.state, 'timeout', 'network failure -> timeout state');
  assertNull(s.summary, 'no summary on failure');
});

// 10. fetchOptionsChain — HTTP error -> unavailable/error state
test('fetchOptionsChain HTTP 500 -> error state (defensive)', async () => {
  clearOptionsCache();
  mockFetchOnce(async () => ({ ok: false, status: 500, text: async () => '' }));
  const raw = await fetchOptionsChain('AAPL', { skipCache: true });
  const s = summarizeOptionsIntelligence(raw);
  assertFalse(s.available, 'unavailable on HTTP error');
  assertEqual(s.state, 'unavailable', 'HTTP error -> unavailable state');
});

// 11. fetchOptionsChain — empty chain -> unavailable (not negative)
test('fetchOptionsChain empty chain -> unavailable (not treated as negative)', async () => {
  clearOptionsCache();
  const json = { optionChain: { result: [{ quote: { regularMarketPrice: 100 }, expirationDates: [1700000000], options: [{}] }] } };
  mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(json) }));
  const raw = await fetchOptionsChain('AAPL', { skipCache: true });
  const s = summarizeOptionsIntelligence(raw);
  assertFalse(s.available, 'unavailable when empty chain');
  assertEqual(s.state, 'unavailable', 'empty chain -> unavailable (not error)');
  assertNull(s.summary, 'no summary');
});

// 12. No duplicate Yahoo fetch for same symbol (cache reuse)
test('fetchOptionsChain: same symbol not fetched twice (cache reuse)', async () => {
  clearOptionsCache();
  let fetchCount = 0;
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [],
    underlying: 150,
  });
  mockFetchOnce(async () => {
    fetchCount++;
    return { ok: true, text: async () => JSON.stringify(json) };
  });

  const r1 = await fetchOptionsChain('AAPL'); // populates cache
  const r2 = await fetchOptionsChain('AAPL'); // should hit cache

  assertEqual(fetchCount, 1, 'Yahoo fetched only once for same symbol');
  assertTrue(r1.available && r2.available, 'both available');
  assertTrue(r2.cached === true, 'second result served from cache');
});

// 13. Non-liquid symbol would skip fetch in route (simulate decision)
test('route logic: non-liquid symbol skips options fetch (no Yahoo request)', async () => {
  clearOptionsCache();
  let fetchCount = 0;
  mockFetchOnce(async () => { fetchCount++; return { ok: true, text: async () => JSON.stringify(buildYahooJson()) }; });

  const opp = buildHunterOpportunity('SMALL', { averageVolume20: 1000 }); // below 250000
  const OPTIONS_MIN_AVG_VOLUME = 250000;
  const avgVolume = Number(opp.averageVolume20);
  const isLiquid = Number.isFinite(avgVolume) && avgVolume >= OPTIONS_MIN_AVG_VOLUME;

  let optionsResult = null;
  if (isLiquid) {
    optionsResult = await fetchOptionsChain(opp.symbol);
  }
  const attached = attachOptionsIntelligence(opp, optionsResult);

  assertEqual(fetchCount, 0, 'no Yahoo request for non-liquid symbol');
  assertFalse(attached.optionsIntelligence.available, 'options unavailable for skipped symbol');
  assertEqual(attached.optionsIntelligence.reason, 'no-options-request', 'reason no-options-request');
  assertEqual(attached.hunterScore, opp.hunterScore, 'hunterScore unchanged');
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