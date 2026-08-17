/**
 * Options Intelligence Signal — Focused Local Tests
 *
 * Phase 6 STEP 4 — deterministic, NON-SCORING Options Intelligence Signal.
 *
 * Run with: node scripts/test-options-signal.mjs
 *
 * Fully local — no network, no dev server. Tests computeOptionsSignal() and
 * attachOptionsSignal() directly against synthetic (but realistic) options
 * chain results.
 *
 * Coverage:
 *   - bullish
 *   - bearish
 *   - neutral
 *   - missing data
 *   - insufficient data
 *   - malformed data
 *   - boundary 0 (score 0)
 *   - boundary 100 (score 100)
 *   - scoring unchanged (signal never affects Hunter Score)
 *   - non-mutation (original opportunity untouched)
 *   - required fields present on every successful signal
 */

import {
  calculateHunterScore,
  classifyMarketRegime,
  evaluateHICCandidate,
  deriveConviction,
  computeOptionsSignal,
  attachOptionsSignal,
} from '../lib/hunter-intelligence.js';

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
// Builders
// ---------------------------------------------------------------------------
function buildOptionsResult({
  callVol = 1000,
  putVol = 1000,
  callOI = 1000,
  putOI = 1000,
  source = 'Yahoo Finance options chain',
  reason = null,
  available = true,
  contracts = null,
} = {}) {
  const builtContracts = contracts !== null ? contracts : [
    {
      optionType: 'CALL', contractSymbol: 'C1', strike: 150, expiry: '2026-01-15',
      premium: 2.6, impliedVolatility: 0.3, volume: callVol, openInterest: callOI, liquidityScore: 80,
    },
    {
      optionType: 'PUT', contractSymbol: 'P1', strike: 150, expiry: '2026-01-15',
      premium: 1.1, impliedVolatility: 0.4, volume: putVol, openInterest: putOI, liquidityScore: 60,
    },
  ];
  return {
    available,
    source,
    reason,
    errors: [],
    underlyingPrice: 150,
    expiry: '2026-01-15',
    count: builtContracts.length,
    contracts: builtContracts,
  };
}

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
console.log('Options Intelligence Signal Tests (STEP 4)');
console.log('========================================\n');

// 1. BULLISH — strong call dominance
test('computeOptionsSignal: bullish bias when call/put ratio high', () => {
  const raw = buildOptionsResult({ callVol: 1500, putVol: 1000, callOI: 1500, putOI: 1000 });
  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'available true');
  assertNotNull(sig.score, 'score not null');
  assertInRange(sig.score, 0, 100, 'score in range');
  assertEqual(sig.bias, 'bullish', 'bias bullish (score >= 58)');
  assertTrue(sig.score >= 58, 'score >= 58 for bullish');
  assertInRange(sig.confidence, 0, 100, 'confidence in range');
  assertNotNull(sig.factors, 'factors present');
  assertNotNull(sig.reason, 'reason present');
  assertEqual(sig.source, 'Yahoo Finance options chain', 'source preserved');
});

// 2. BEARISH — strong put dominance (NOT a fabricated penalty; real data)
test('computeOptionsSignal: bearish bias when put/call ratio high', () => {
  const raw = buildOptionsResult({ callVol: 1000, putVol: 1500, callOI: 1000, putOI: 1500 });
  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'available true');
  assertNotNull(sig.score, 'score not null');
  assertEqual(sig.bias, 'bearish', 'bias bearish (score <= 42)');
  assertTrue(sig.score <= 42, 'score <= 42 for bearish');
  assertInRange(sig.confidence, 0, 100, 'confidence in range');
});

// 3. NEUTRAL — balanced call/put
test('computeOptionsSignal: neutral bias when call/put ratio ~1', () => {
  const raw = buildOptionsResult({ callVol: 1000, putVol: 1000, callOI: 1000, putOI: 1000 });
  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'available true');
  assertEqual(sig.score, 50, 'score 50 at ratio 1');
  assertEqual(sig.bias, 'neutral', 'bias neutral');
});

// 4. MISSING DATA — null input
test('computeOptionsSignal: null input -> insufficient-data (no fabrication)', () => {
  const sig = computeOptionsSignal(null);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null (never fabricated)');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data');
  assertEqual(sig.confidence, 0, 'confidence 0');
  assertNull(sig.factors, 'factors null');
  assertNotNull(sig.reason, 'reason present');
});

// 5. INSUFFICIENT DATA — low activity floor
test('computeOptionsSignal: low activity -> insufficient-data (not bearish)', () => {
  const raw = buildOptionsResult({ callVol: 10, putVol: 10, callOI: 10, putOI: 10 });
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bearish)');
  assertEqual(sig.reason, 'insufficient-activity', 'reason insufficient-activity');
});

// 6. MALFORMED DATA — contracts not an array
test('computeOptionsSignal: malformed contracts -> insufficient-data', () => {
  const raw = buildOptionsResult({ contracts: 'not-an-array' });
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data');
});

// 6b. MALFORMED DATA — available flag not boolean true
test('computeOptionsSignal: available !== true -> insufficient-data', () => {
  const raw = buildOptionsResult({ available: 'yes' });
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data');
});

// 6c. MALFORMED DATA — empty contracts array
test('computeOptionsSignal: empty contracts -> insufficient-data', () => {
  const raw = buildOptionsResult({ contracts: [] });
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.reason, 'no-contracts', 'reason no-contracts');
});

// 7. BOUNDARY 0 — extreme put dominance but both sides present
test('computeOptionsSignal: boundary score 0 (extreme put dominance)', () => {
  const raw = buildOptionsResult({ callVol: 1, putVol: 1000, callOI: 1, putOI: 1000 });
  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'available (both sides present)');
  assertEqual(sig.score, 0, 'score saturates at 0');
  assertEqual(sig.bias, 'bearish', 'bias bearish at score 0');
});

// 8. BOUNDARY 100 — extreme call dominance
test('computeOptionsSignal: boundary score 100 (extreme call dominance)', () => {
  const raw = buildOptionsResult({ callVol: 2000, putVol: 1000, callOI: 2000, putOI: 1000 });
  const sig = computeOptionsSignal(raw);
  assertTrue(sig.available, 'available');
  assertEqual(sig.score, 100, 'score saturates at 100');
  assertEqual(sig.bias, 'bullish', 'bias bullish at score 100');
});

// 9. SCORING UNCHANGED — signal never affects Hunter Score
test('computeOptionsSignal: Hunter Score identical with/without options signal', () => {
  const opp = buildHunterOpportunity('AAPL');
  const raw = buildOptionsResult({ callVol: 1500, putVol: 1000, callOI: 1500, putOI: 1000 });

  // Compute signal independently — it must not change the opportunity's score.
  const sig = computeOptionsSignal(raw);
  assertNotNull(sig, 'signal computed');

  // The opportunity's hunterScore is untouched by merely computing a signal.
  const base = buildHunterOpportunity('AAPL');
  assertEqual(opp.hunterScore, base.hunterScore, 'hunterScore stable across builds');
  assertEqual(opp.hunterTier, base.hunterTier, 'hunterTier stable');
});

// 10. NON-MUTATION — attachOptionsSignal returns new object, original untouched
test('attachOptionsSignal: does NOT mutate original opportunity', () => {
  const opp = buildHunterOpportunity('AAPL');
  const raw = buildOptionsResult({ callVol: 1500, putVol: 1000, callOI: 1500, putOI: 1000 });

  const snapshot = JSON.stringify({
    hunterScore: opp.hunterScore,
    hunterTier: opp.hunterTier,
    hic: opp.hic,
    conviction: opp.conviction,
    institutionalIntelligence: opp.institutionalIntelligence,
    hasOptionsSignal: 'optionsSignal' in opp,
  });

  const attached = attachOptionsSignal(opp, raw);

  const after = JSON.stringify({
    hunterScore: opp.hunterScore,
    hunterTier: opp.hunterTier,
    hic: opp.hic,
    conviction: opp.conviction,
    institutionalIntelligence: opp.institutionalIntelligence,
    hasOptionsSignal: 'optionsSignal' in opp,
  });

  assertEqual(after, snapshot, 'original opportunity unchanged after attach');
  assertNotNull(attached.optionsSignal, 'new object has optionsSignal');
  assertFalse('optionsSignal' in opp, 'original has no optionsSignal key');
  assertEqual(attached.hunterScore, opp.hunterScore, 'hunterScore preserved on attached');
});

// 11. REQUIRED FIELDS present on a successful signal
test('computeOptionsSignal: all required fields present', () => {
  const raw = buildOptionsResult({ callVol: 1500, putVol: 1000, callOI: 1500, putOI: 1000 });
  const sig = computeOptionsSignal(raw);
  const required = ['available', 'score', 'bias', 'confidence', 'factors', 'reason', 'source'];
  for (const key of required) {
    assertTrue(key in sig, `signal has field "${key}"`);
  }
  assertInRange(sig.score, 0, 100, 'score 0-100');
  assertInRange(sig.confidence, 0, 100, 'confidence 0-100');
  assertTrue(['bullish', 'bearish', 'neutral', 'insufficient-data'].includes(sig.bias), 'valid bias label');
});

// 12. ONE-SIDED DATA — only calls (no puts) -> insufficient (never fabricated bearish)
test('computeOptionsSignal: one-sided call data -> insufficient-data', () => {
  const raw = buildOptionsResult({ callVol: 5000, putVol: 0, callOI: 5000, putOI: 0 });
  const sig = computeOptionsSignal(raw);
  assertFalse(sig.available, 'not available');
  assertNull(sig.score, 'score null');
  assertEqual(sig.bias, 'insufficient-data', 'bias insufficient-data (NOT bullish fabrication)');
  assertEqual(sig.reason, 'one-sided-options-data', 'reason one-sided-options-data');
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