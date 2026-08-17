/**
 * Options Intelligence Freshness / Data-Safety Tests
 *
 * Phase 6 STEP 5 — deterministic local tests for data freshness and safety.
 *
 * Run with: node scripts/test-options-freshness.mjs
 *
 * Fully local — no network, no dev server. Tests the CURRENT implementation
 * against synthetic (but realistic) options chain results.
 *
 * Coverage:
 *   - valid expiry
 *   - missing expiry
 *   - multiple expiries (provider only returns first)
 *   - empty contracts
 *   - missing IV
 *   - missing volume
 *   - missing open interest
 *   - missing premium
 *   - malformed contracts
 *   - stale/invalid metadata if represented by the current provider
 *   - unavailable provider result
 *   - timeout result
 *   - HTTP error result
 *   - one-sided call/put data
 *   - insufficient activity
 *   - null/missing input
 *
 * Rules:
 * - Missing data remains null/unavailable.
 * - No fabricated values.
 * - Unavailable data must not become bearish.
 * - Options signal must remain non-scoring.
 * - Hunter score must remain byte-identical before and after options signal attachment.
 */

import {
  calculateHunterScore,
  classifyMarketRegime,
  evaluateHICCandidate,
  deriveConviction,
  computeOptionsSignal,
  attachOptionsSignal,
  summarizeOptionsIntelligence,
  attachOptionsIntelligence,
} from '../lib/hunter-intelligence.js';
import {
  fetchOptionsChain,
  normalizeOptionContract,
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

function assertInRange(value, min, max, message = '') {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${message}\n   Expected value in [${min}, ${max}] but got: ${JSON.stringify(value)}`);
  }
}

// ---------------------------------------------------------------------------
// Mock fetch helper
// ---------------------------------------------------------------------------
function mockFetchOnce(handler) {
  globalThis.fetch = handler;
}

function buildYahooJson({ calls = [], puts = [], underlying = 150, expiry = 1700000000, expirationDates = [expiry] } = {}) {
  return {
    optionChain: {
      result: [
        {
          quote: { regularMarketPrice: underlying },
          expirationDates,
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
console.log('Options Intelligence Freshness / Data-Safety Tests (STEP 5)');
console.log('========================================\n');

// ============================================================================
// PROVIDER-LEVEL FRESHNESS / DATA-SAFETY TESTS
// ============================================================================

// 1. Valid expiry — provider returns first expiry date
test('fetchOptionsChain: valid expiry returned from first expiration date', async () => {
  clearOptionsCache();
  const expiry = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [{ contractSymbol: 'AAPLP', bid: 1, ask: 1.1, strike: 150, impliedVolatility: 0.4, volume: 300, openInterest: 1000 }],
    underlying: 150,
    expiry,
  });
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertTrue(res.available, 'available true');
  assertNotNull(res.expiry, 'expiry present');
  assertEqual(res.expiry, new Date(expiry * 1000).toISOString().slice(0, 10), 'expiry matches first expiration date');
});

// 2. Missing expiry — Yahoo returns no expirationDates
test('fetchOptionsChain: missing expiry -> unavailable (not fabricated)', async () => {
  clearOptionsCache();
  const json = { optionChain: { result: [{ quote: { regularMarketPrice: 150 }, expirationDates: [], options: [{}] }] } };
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable when no expiry');
  assertNull(res.expiry, 'expiry null (not fabricated)');
  assertEqual(res.reason, 'yahoo-options-no-chain', 'reason no-chain');
});

// 3. Multiple expiries — provider only uses the first one
test('fetchOptionsChain: multiple expiries -> uses first expiry only', async () => {
  clearOptionsCache();
  const expiry1 = Math.floor(Date.now() / 1000) + 86400 * 7;
  const expiry2 = Math.floor(Date.now() / 1000) + 86400 * 14;
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [],
    underlying: 150,
    expirationDates: [expiry1, expiry2],
  });
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertTrue(res.available, 'available');
  assertEqual(res.expiry, new Date(expiry1 * 1000).toISOString().slice(0, 10), 'uses first expiry only');
});

// 4. Empty contracts — chain exists but no calls/puts
test('fetchOptionsChain: empty contracts -> unavailable (not negative)', async () => {
  clearOptionsCache();
  const json = { optionChain: { result: [{ quote: { regularMarketPrice: 100 }, expirationDates: [1700000000], options: [{}] }] } };
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertFalse(res.available, 'unavailable when empty chain');
  assertEqual(res.reason, 'yahoo-options-empty-chain', 'empty-chain reason');
  assertEqual(res.contracts.length, 0, 'no contracts');
});

// 5. Missing IV — normalizeOptionContract preserves null
test('normalizeOptionContract: missing IV -> null (never fabricated)', () => {
  const raw = { contractSymbol: 'AAPL231201C00150000', bid: 2, ask: 2.2, strike: 150, volume: 500, openInterest: 2000 };
  const c = normalizeOptionContract(raw, 'CALL', 150, 1700000000);
  assertNull(c.impliedVolatility, 'missing IV -> null (never 0 or estimated)');
  assertNotNull(c.score, 'score still computed without IV');
});

// 6. Missing volume — defaults to 0 (Yahoo default), not fabricated
test('normalizeOptionContract: missing volume -> 0 (Yahoo default)', () => {
  const raw = { contractSymbol: 'AAPL231201C00150000', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, openInterest: 2000 };
  const c = normalizeOptionContract(raw, 'CALL', 150, 1700000000);
  assertEqual(c.volume, 0, 'missing volume -> 0 (Yahoo default)');
});

// 7. Missing open interest — defaults to 0 (Yahoo default), not fabricated
test('normalizeOptionContract: missing openInterest -> 0 (Yahoo default)', () => {
  const raw = { contractSymbol: 'AAPL231201C00150000', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500 };
  const c = normalizeOptionContract(raw, 'CALL', 150, 1700000000);
  assertEqual(c.openInterest, 0, 'missing OI -> 0 (Yahoo default)');
});

// 8. Missing premium — no bid/ask/last -> premium null
test('normalizeOptionContract: missing premium -> null (not fabricated)', () => {
  const raw = { contractSymbol: 'AAPL231201C00150000', strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 };
  const c = normalizeOptionContract(raw, 'CALL', 150, 1700000000);
  assertNull(c.premium, 'premium null when no price data');
  assertNull(c.contractCost, 'contractCost null when premium null');
  assertNull(c.spreadPct, 'spreadPct null when no bid/ask');
});

// 9. Malformed contracts — non-array contracts handled gracefully
test('computeOptionsSignal: malformed contracts (not array) -> insufficient-data', () => {
  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 0,
    contracts: 'not-an-array',
  };
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bearish)');
});

// 10. Stale/invalid metadata — provider returns dataTimestamp, contracts have expiry
test('fetchOptionsChain: dataTimestamp present and contracts have expiry', async () => {
  clearOptionsCache();
  const expiry = Math.floor(Date.now() / 1000) + 86400 * 7;
  const json = buildYahooJson({
    calls: [{ contractSymbol: 'AAPLC', bid: 2, ask: 2.2, strike: 150, impliedVolatility: 0.3, volume: 500, openInterest: 2000 }],
    puts: [],
    underlying: 150,
    expiry,
  });
  mockFetchOnce(async () => ({ ok: true, text: async () => JSON.stringify(json) }));

  const res = await fetchOptionsChain('AAPL', { skipCache: true });
  assertNotNull(res.dataTimestamp, 'dataTimestamp present');
  assertTrue(res.contracts.length > 0, 'has contracts');
  assertNotNull(res.contracts[0].expiry, 'contract has expiry');
});

// 11. Unavailable provider result — summarizeOptionsIntelligence returns unavailable state
test('summarizeOptionsIntelligence: unavailable provider result -> unavailable state', () => {
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
  assertNull(s.summary, 'summary null');
  assertEqual(s.reason, 'yahoo-options-no-chain', 'reason preserved');
});

// 12. Timeout result — summarizeOptionsIntelligence returns timeout state
test('summarizeOptionsIntelligence: timeout result -> timeout state', () => {
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
  assertFalse(s.available, 'not available');
  assertEqual(s.state, 'timeout', 'timeout reason -> timeout state');
  assertNull(s.summary, 'summary null');
});

// 13. HTTP error result — summarizeOptionsIntelligence returns error/unavailable state
test('summarizeOptionsIntelligence: HTTP error result -> error state', () => {
  const raw = {
    available: false,
    source: 'Yahoo Finance options chain',
    reason: 'yahoo-options-500',
    errors: ['yahoo-options-500'],
    underlyingPrice: null,
    expiry: null,
    count: 0,
    contracts: [],
  };
  const s = summarizeOptionsIntelligence(raw);
  assertFalse(s.available, 'not available');
  assertEqual(s.state, 'unavailable', 'HTTP error -> unavailable state (not treated as negative)');
  assertNull(s.summary, 'summary null');
});

// 14. One-sided call/put data — computeOptionsSignal returns insufficient-data (NOT bullish/bearish)
test('computeOptionsSignal: one-sided call data -> insufficient-data (NOT bullish)', () => {
  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 2,
    contracts: [
      { optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 5000, openInterest: 2000, liquidityScore: 80 },
      { optionType: 'CALL', contractSymbol: 'C2', strike: 155, expiry: '2023-11-15', premium: 1.8, impliedVolatility: 0.35, volume: 3000, openInterest: 1500, liquidityScore: 70 },
    ],
  };
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated as bullish)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bullish fabrication)');
  assertEqual(sig.reason, 'one-sided-options-data', 'reason one-sided-options-data');
});

test('computeOptionsSignal: one-sided put data -> insufficient-data (NOT bearish)', () => {
  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 2,
    contracts: [
      { optionType: 'PUT', contractSymbol: 'P1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 5000, openInterest: 2000, liquidityScore: 80 },
      { optionType: 'PUT', contractSymbol: 'P2', strike: 145, expiry: '2023-11-15', premium: 1.8, impliedVolatility: 0.35, volume: 3000, openInterest: 1500, liquidityScore: 70 },
    ],
  };
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated as bearish)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bearish fabrication)');
  assertEqual(sig.reason, 'one-sided-options-data', 'reason one-sided-options-data');
});

// 15. Insufficient activity — low volume/OI -> insufficient-data (NOT bearish)
test('computeOptionsSignal: insufficient activity -> insufficient-data (NOT bearish)', () => {
  const raw = {
    available: true,
    source: 'Yahoo Finance options chain',
    reason: null,
    errors: [],
    underlyingPrice: 150,
    expiry: '2023-11-15',
    count: 2,
    contracts: [
      { optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2023-11-15', premium: 2.6, impliedVolatility: 0.3, volume: 10, openInterest: 10, liquidityScore: 10 },
      { optionType: 'PUT', contractSymbol: 'P1', strike: 150, expiry: '2023-11-15', premium: 1.1, impliedVolatility: 0.4, volume: 10, openInterest: 10, liquidityScore: 10 },
    ],
  };
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bearish)');
  assertEqual(sig.reason, 'insufficient-activity', 'reason insufficient-activity');
});

// 16. Null/missing input — computeOptionsSignal returns insufficient-data
test('computeOptionsSignal: null input -> insufficient-data (no fabrication)', () => {
  const sig = computeOptionsSignal(null);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data');
  assertEqual(sig.confidence, 0, 'confidence 0');
  assertNull(sig.factors, 'factors null');
  assertNotNull(sig.reason, 'reason present');
});

// 17. Missing input object — computeOptionsSignal returns insufficient-data
test('computeOptionsSignal: undefined input -> insufficient-data', () => {
  const sig = computeOptionsSignal(undefined);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data');
});

// ============================================================================
// NON-SCORING PROOF TESTS
// ============================================================================

// 18. Hunter score byte-identical before and after options signal attachment
test('attachOptionsSignal: Hunter score byte-identical before/after', () => {
  const opp = buildHunterOpportunity('AAPL');
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

  const beforeScore = opp.hunterScore;
  const beforeTier = opp.hunterTier;
  const beforeHic = JSON.stringify(opp.hic);
  const beforeConviction = JSON.stringify(opp.conviction);
  const beforeInstitutional = JSON.stringify(opp.institutionalIntelligence);

  const attached = attachOptionsSignal(opp, raw);

  assertEqual(attached.hunterScore, beforeScore, 'hunterScore byte-identical');
  assertEqual(attached.hunterTier, beforeTier, 'hunterTier byte-identical');
  assertEqual(JSON.stringify(attached.hic), beforeHic, 'hic byte-identical');
  assertEqual(JSON.stringify(attached.conviction), beforeConviction, 'conviction byte-identical');
  assertEqual(JSON.stringify(attached.institutionalIntelligence), beforeInstitutional, 'institutionalIntelligence byte-identical');
  assertNotNull(attached.optionsSignal, 'optionsSignal added');
  assertFalse('optionsSignal' in opp, 'original opportunity not mutated');
});

// 19. attachOptionsIntelligence also preserves scoring exactly
test('attachOptionsIntelligence: scoring fields preserved exactly', () => {
  const opp = buildHunterOpportunity('AAPL');
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

  const before = JSON.stringify({
    hunterScore: opp.hunterScore,
    hunterTier: opp.hunterTier,
    hic: opp.hic,
    conviction: opp.conviction,
    institutionalIntelligence: opp.institutionalIntelligence,
  });

  const attached = attachOptionsIntelligence(opp, raw);

  const after = JSON.stringify({
    hunterScore: attached.hunterScore,
    hunterTier: attached.hunterTier,
    hic: attached.hic,
    conviction: attached.conviction,
    institutionalIntelligence: attached.institutionalIntelligence,
  });

  assertEqual(after, before, 'scoring fields unchanged after attachOptionsIntelligence');
  assertNotNull(attached.optionsIntelligence, 'optionsIntelligence added');
});

// 20. Hunter scoring identical with options available vs unavailable (both layers)
test('Hunter scoring identical: options available vs unavailable (both layers)', () => {
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

  const withOptions = attachOptionsSignal(attachOptionsIntelligence(opp, rawAvailable), rawAvailable);
  const withoutOptions = attachOptionsSignal(attachOptionsIntelligence(opp, rawUnavailable), rawUnavailable);

  assertEqual(withOptions.hunterScore, withoutOptions.hunterScore, 'hunterScore identical');
  assertEqual(withOptions.hunterTier, withoutOptions.hunterTier, 'hunterTier identical');
  assertEqual(withOptions.hic.eligible, withoutOptions.hic.eligible, 'HIC eligible identical');
  assertEqual(withOptions.conviction.score, withoutOptions.conviction.score, 'conviction identical');
});

// 21. computeOptionsSignal never calls calculateHunterScore (independent)
test('computeOptionsSignal: independent of Hunter scoring functions', () => {
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

  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'signal available');
  assertNotNull(sig.score, 'signal has score');
  assertInRange(sig.score, 0, 100, 'signal score in range');
  assertTrue(['bullish', 'bearish', 'neutral'].includes(sig.bias), 'valid bias');
  assertInRange(sig.confidence, 0, 100, 'confidence in range');
  assertNotNull(sig.factors, 'factors present');
  // No hunterScore, hic, conviction, institutionalScore in signal
  assertEqual('hunterScore' in sig, false, 'signal has no hunterScore');
  assertEqual('hic' in sig, false, 'signal has no hic');
  assertEqual('conviction' in sig, false, 'signal has no conviction');
  assertEqual('institutionalScore' in sig, false, 'signal has no institutionalScore');
});

// ============================================================================
// SUMMARY
// ============================================================================
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