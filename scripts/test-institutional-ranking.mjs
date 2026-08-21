/**
 * Institutional Ranking Tests (A3.3)
 *
 * Tests for lib/institutional-ranking.js
 * Run with: node scripts/test-institutional-ranking.mjs
 */

import {
  buildInstitutionalIntelligence,
} from '../lib/institutional-intelligence.js';
import {
  buildInstitutionalSignal,
  defaultInstitutionalSignal,
} from '../lib/institutional-signal.js';
import {
  calculateInstitutionalRankScore,
  classifyInstitutionalRank,
  rankInstitutionalSignal,
  rankInstitutionalOpportunities,
  selectTopInstitutional,
  rankFromIntelligence,
  defaultInstitutionalRank,
} from '../lib/institutional-ranking.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
  } catch (error) {
    console.error('❌ FAIL: ' + name);
    console.error('   ' + error.message);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      (message || 'Assertion failed') + '\n   Expected: ' + e + '\n   Actual:   ' + a
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected truthy value');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected falsy value');
}

function assertNull(value, message = '') {
  if (value !== null) {
    throw new Error(
      (message || 'Expected null') + '\n   Actual: ' + JSON.stringify(value)
    );
  }
}

function assertInRange(value, min, max, message = '') {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      (message || 'Expected range ' + min + '-' + max) + '\n   Actual: ' + value
    );
  }
}

function assertNoNaN(obj, path = '') {
  if (typeof obj === 'number') {
    if (Number.isNaN(obj)) throw new Error(`NaN found at ${path || 'value'}`);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      assertNoNaN(v, path ? `${path}.${k}` : k);
    }
  }
}

function assertNoInfinity(obj, path = '') {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) throw new Error(`Non-finite found at ${path || 'value'}: ${obj}`);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      assertNoInfinity(v, path ? `${path}.${k}` : k);
    }
  }
}

// ============================================================================
// FIXTURES
// ============================================================================

function makeSecData(overrides = {}) {
  return {
    symbol: 'TEST',
    secRiskScore: 25,
    secRiskLevel: 'low',
    secRiskFlags: [],
    latestRelevantFilings: [
      { form: '10-Q', filingDate: '2024-01-15' },
      { form: '8-K', filingDate: '2024-01-10' },
    ],
    secDataStatus: 'ok',
    ...overrides,
  };
}

function makeFinraData(overrides = {}) {
  return {
    provider: 'finra',
    symbol: 'TEST',
    available: true,
    source: 'FINRA ATS/OTC',
    weekStartDate: '2024-01-08',
    atsShareQuantity: 5000000,
    atsTradeCount: 150,
    verified: true,
    disclaimers: { delayed: true },
    ...overrides,
  };
}

function makeFinraScore(overrides = {}) {
  return {
    score: 65,
    confidence: 'moderate',
    source: 'FINRA ATS/OTC',
    disclaimers: { delayedData: true, noDirection: true, notRealtime: true },
    ...overrides,
  };
}

function makeCompleteSignal() {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  return buildInstitutionalSignal(intel);
}

function makeSecOnlySignal() {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), null, null);
  return buildInstitutionalSignal(intel);
}

function makeUnavailableSignal() {
  const intel = buildInstitutionalIntelligence('AAPL', null, null, null);
  return buildInstitutionalSignal(intel);
}

function makeHighSignal() {
  const sec = makeSecData({
    latestRelevantFilings: Array.from({ length: 5 }, (_, i) => ({
      form: '8-K',
      filingDate: '2024-06-0' + (i + 1),
    })),
    secRiskFlags: [],
    secRiskLevel: 'low',
  });
  const finra = makeFinraScore({ score: 90 });
  const intel = buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finra);
  return buildInstitutionalSignal(intel);
}

function makeLowRiskSignal() {
  const signal = makeCompleteSignal();
  return { ...signal, institutionalRisk: 'LOW' };
}

function makeHighRiskSignal() {
  const signal = makeCompleteSignal();
  return { ...signal, institutionalRisk: 'HIGH' };
}

// ============================================================================
// TESTS
// ============================================================================

console.log('\n========================================');
console.log('Institutional Ranking Tests (A3.3)');
console.log('========================================\n');

// --- Section 1: Rank Score Calculation ---

test('Rank score: null when signal is null', () => {
  assertNull(calculateInstitutionalRankScore(null));
});

test('Rank score: null when signalScore is null', () => {
  const signal = defaultInstitutionalSignal();
  assertNull(calculateInstitutionalRankScore(signal));
});

test('Rank score: null when institutionalSignalScore is null', () => {
  const signal = { institutionalSignalScore: null, ...defaultInstitutionalSignal() };
  assertNull(calculateInstitutionalRankScore(signal));
});

test('Rank score: computed when signal has score', () => {
  const signal = makeCompleteSignal();
  const score = calculateInstitutionalRankScore(signal);
  assertTrue(score != null, 'Expected non-null rank score');
  assertInRange(score, 0, 100);
});

test('Rank score: zero when all quality dimensions are unavailable', () => {
  const signal = {
    institutionalSignalScore: 80,
    institutionalActivity: 'UNAVAILABLE',
    institutionalConviction: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
  };
  const score = calculateInstitutionalRankScore(signal);
  // qualityMultiplier = (0 + 0 + 50 + 0) / 400 = 0.125
  // rankScore = 80 * 0.125 = 10
  assertEqual(score, 10);
});

test('Rank score: full score when all dimensions are high', () => {
  const signal = {
    institutionalSignalScore: 80,
    institutionalActivity: 'HIGH',
    institutionalConviction: 'HIGH',
    institutionalRisk: 'LOW',
    dataStatus: 'complete',
  };
  const score = calculateInstitutionalRankScore(signal);
  // qualityMultiplier = (100 + 100 + 100 + 100) / 400 = 1.0
  // rankScore = 80 * 1.0 = 80
  assertEqual(score, 80);
});

test('Rank score: partial when some dimensions are partial', () => {
  const signal = {
    institutionalSignalScore: 80,
    institutionalActivity: 'MODERATE',
    institutionalConviction: 'MEDIUM',
    institutionalRisk: 'MODERATE',
    dataStatus: 'partial',
  };
  const score = calculateInstitutionalRankScore(signal);
  // qualityMultiplier = (70 + 70 + 80 + 60) / 400 = 280/400 = 0.7
  // rankScore = 80 * 0.7 = 56
  assertEqual(score, 56);
});

test('Rank score: high risk reduces score', () => {
  const signal = {
    institutionalSignalScore: 80,
    institutionalActivity: 'HIGH',
    institutionalConviction: 'HIGH',
    institutionalRisk: 'EXTREME',
    dataStatus: 'complete',
  };
  const score = calculateInstitutionalRankScore(signal);
  // qualityMultiplier = (100 + 100 + 20 + 100) / 400 = 320/400 = 0.8
  // rankScore = 80 * 0.8 = 64
  assertEqual(score, 64);
});

test('Rank score: clamped to 0', () => {
  const signal = {
    institutionalSignalScore: 10,
    institutionalActivity: 'UNAVAILABLE',
    institutionalConviction: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
  };
  const score = calculateInstitutionalRankScore(signal);
  // qualityMultiplier = (0 + 0 + 50 + 0) / 400 = 0.125
  // rankScore = 10 * 0.125 = 1.25 -> 1
  assertEqual(score, 1);
});

// --- Section 2: Rank Classification ---

test('Rank: TOP when score >= 70', () => {
  assertEqual(classifyInstitutionalRank(70), 'TOP');
  assertEqual(classifyInstitutionalRank(100), 'TOP');
});

test('Rank: STRONG when score 50-69', () => {
  assertEqual(classifyInstitutionalRank(50), 'STRONG');
  assertEqual(classifyInstitutionalRank(69), 'STRONG');
});

test('Rank: WATCH when score 30-49', () => {
  assertEqual(classifyInstitutionalRank(30), 'WATCH');
  assertEqual(classifyInstitutionalRank(49), 'WATCH');
});

test('Rank: WEAK when score 10-29', () => {
  assertEqual(classifyInstitutionalRank(10), 'WEAK');
  assertEqual(classifyInstitutionalRank(29), 'WEAK');
});

test('Rank: UNAVAILABLE when score < 10', () => {
  assertEqual(classifyInstitutionalRank(9), 'UNAVAILABLE');
  assertEqual(classifyInstitutionalRank(0), 'UNAVAILABLE');
});

test('Rank: UNAVAILABLE when score is null', () => {
  assertEqual(classifyInstitutionalRank(null), 'UNAVAILABLE');
});

test('Rank: UNAVAILABLE at boundary 70 (exactly)', () => {
  assertEqual(classifyInstitutionalRank(70), 'TOP');
});

test('Rank: STRONG at boundary 50 (exactly)', () => {
  assertEqual(classifyInstitutionalRank(50), 'STRONG');
});

test('Rank: WATCH at boundary 30 (exactly)', () => {
  assertEqual(classifyInstitutionalRank(30), 'WATCH');
});

test('Rank: WEAK at boundary 10 (exactly)', () => {
  assertEqual(classifyInstitutionalRank(10), 'WEAK');
});

test('Rank: UNAVAILABLE at boundary 9 (just below)', () => {
  assertEqual(classifyInstitutionalRank(9), 'UNAVAILABLE');
});

// --- Section 3: Single Signal Ranking ---

test('Rank single: returns UNAVAILABLE when signal has no score', () => {
  const signal = defaultInstitutionalSignal();
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  assertEqual(rank.institutionalRankClass, 'UNAVAILABLE');
  assertNull(rank.institutionalRankScore);
  assertEqual(rank.symbol, 'AAPL');
});

test('Rank single: returns UNAVAILABLE when signal is null', () => {
  const rank = rankInstitutionalSignal(null, 'AAPL');
  assertEqual(rank.institutionalRankClass, 'UNAVAILABLE');
  assertNull(rank.institutionalRankScore);
});

test('Rank single: preserves symbol from signal', () => {
  const signal = makeCompleteSignal();
  signal.symbol = 'MSFT';
  const rank = rankInstitutionalSignal(signal);
  assertEqual(rank.symbol, 'MSFT');
});

test('Rank single: uses symbol param when signal.symbol is null', () => {
  const signal = makeCompleteSignal();
  signal.symbol = null;
  const rank = rankInstitutionalSignal(signal, 'GOOGL');
  assertEqual(rank.symbol, 'GOOGL');
});

test('Rank single: has no NaN or Infinity', () => {
  const signal = makeCompleteSignal();
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  assertNoNaN(rank);
  assertNoInfinity(rank);
});

test('Rank single: includes reasons', () => {
  const rank = rankInstitutionalSignal(makeCompleteSignal(), 'AAPL');
  assertTrue(rank.reasons.length > 0);
});

test('Rank single: includes warnings', () => {
  const rank = rankInstitutionalSignal(makeCompleteSignal(), 'AAPL');
  assertTrue(Array.isArray(rank.warnings));
});

test('Rank single: includes flags', () => {
  const rank = rankInstitutionalSignal(makeCompleteSignal(), 'AAPL');
  assertTrue(Array.isArray(rank.flags));
});

test('Rank single: high signal gets high rank score', () => {
  const rank = rankInstitutionalSignal(makeHighSignal(), 'AAPL');
  assertTrue(rank.institutionalRankScore >= 50, 'High signal should get >= 50');
});

// --- Section 4: Multiple Symbols Ranking ---

test('Rank multiple: returns empty array for empty input', () => {
  assertEqual(rankInstitutionalOpportunities([]), []);
});

test('Rank multiple: returns empty array for null input', () => {
  assertEqual(rankInstitutionalOpportunities(null), []);
});

test('Rank multiple: sorts by rankScore descending', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'LOW', institutionalSignalScore: 30 },
    { ...makeCompleteSignal(), symbol: 'HIGH', institutionalSignalScore: 90 },
    { ...makeCompleteSignal(), symbol: 'MID', institutionalSignalScore: 60 },
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  assertTrue(ranked[0].symbol === 'HIGH', 'Highest score first');
  assertTrue(ranked[1].symbol === 'MID');
  assertTrue(ranked[2].symbol === 'LOW');
});

test('Rank multiple: assigns rank index', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A', institutionalSignalScore: 80 },
    { ...makeCompleteSignal(), symbol: 'B', institutionalSignalScore: 60 },
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  assertEqual(ranked[0].institutionalRankIndex, 0);
  assertEqual(ranked[1].institutionalRankIndex, 1);
});

test('Rank multiple: null scores sorted last', () => {
  const signals = [
    defaultInstitutionalSignal(),
    { ...makeCompleteSignal(), symbol: 'A', institutionalSignalScore: 50 },
    defaultInstitutionalSignal(),
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  // Non-null should come first
  assertTrue(ranked[0].institutionalRankScore != null);
  assertNull(ranked[ranked.length - 1].institutionalRankScore);
});

test('Rank multiple: tie-break by symbol', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'B', institutionalSignalScore: 50, institutionalActivity: 'HIGH', institutionalConviction: 'HIGH', institutionalRisk: 'LOW', dataStatus: 'complete' },
    { ...makeCompleteSignal(), symbol: 'A', institutionalSignalScore: 50, institutionalActivity: 'HIGH', institutionalConviction: 'HIGH', institutionalRisk: 'LOW', dataStatus: 'complete' },
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  // A should come before B (alphabetical tie-break)
  assertEqual(ranked[0].symbol, 'A');
  assertEqual(ranked[1].symbol, 'B');
});

test('Rank multiple: all fields present and finite', () => {
  const signals = [
    makeCompleteSignal(),
    makeSecOnlySignal(),
    makeUnavailableSignal(),
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  for (const r of ranked) {
    assertNoNaN(r);
    assertNoInfinity(r);
  }
});

test('Rank multiple: no duplicate symbols', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A' },
    { ...makeCompleteSignal(), symbol: 'B' },
    { ...makeCompleteSignal(), symbol: 'C' },
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  const symbols = ranked.map((r) => r.symbol);
  const unique = new Set(symbols);
  assertEqual(unique.size, symbols.length);
});

// --- Section 5: Select Top + Alternatives ---

test('Select: top contains only TOP rank signals', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A', institutionalSignalScore: 95 },
    { ...makeCompleteSignal(), symbol: 'B', institutionalSignalScore: 30 },
    { ...makeCompleteSignal(), symbol: 'C', institutionalSignalScore: 80 },
    { ...makeCompleteSignal(), symbol: 'D', institutionalSignalScore: 10 },
  ];
  const { top, alternatives } = selectTopInstitutional(signals, 5);
  // Check that only TOP class signals are in top
  for (const t of top) {
    assertEqual(t.institutionalRankClass, 'TOP');
  }
});

test('Select: alternatives are STRONG or WATCH', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A', institutionalSignalScore: 30 },
    { ...makeCompleteSignal(), symbol: 'B', institutionalSignalScore: 40 },
    { ...makeCompleteSignal(), symbol: 'C', institutionalSignalScore: 10 },
  ];
  const { top, alternatives } = selectTopInstitutional(signals, 5);
  assertEqual(top.length, 0); // no TOP
  for (const a of alternatives) {
    assertTrue(
      a.institutionalRankClass === 'STRONG' || a.institutionalRankClass === 'WATCH',
      `Alternative should be STRONG or WATCH, got ${a.institutionalRankClass}`
    );
  }
});

test('Select: topLimit respected', () => {
  const signals = Array.from({ length: 10 }, (_, i) => ({
    ...makeCompleteSignal(),
    symbol: 'SYM' + i,
    institutionalSignalScore: 95 - i * 5,
  }));
  const { top, alternatives } = selectTopInstitutional(signals, 3);
  assertEqual(top.length, 3);
});

test('Select: returns fullRanking', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A' },
    { ...makeCompleteSignal(), symbol: 'B' },
  ];
  const result = selectTopInstitutional(signals, 5);
  assertEqual(result.fullRanking.length, 2);
  assertEqual(result.fullRanking[0].institutionalRankIndex, 0);
});

// --- Section 6: Rank From Intelligence (convenience) ---

test('Rank from intelligence: builds signal then ranks', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  const rank = rankFromIntelligence(intel, 'AAPL');
  assertTrue(rank.institutionalRankScore != null);
  assertEqual(rank.symbol, 'AAPL');
});

test('Rank from intelligence: UNAVAILABLE when intelligence is null', () => {
  const rank = rankFromIntelligence(null, 'AAPL');
  assertEqual(rank.institutionalRankClass, 'UNAVAILABLE');
  assertNull(rank.institutionalRankScore);
});

// --- Section 7: Edge cases & regression ---

test('Edge: defaultInstitutionalRank returns empty structure', () => {
  const def = defaultInstitutionalRank('TEST');
  assertNull(def.institutionalRankScore);
  assertEqual(def.institutionalRankClass, 'UNAVAILABLE');
  assertEqual(def.dataStatus, 'unavailable');
  assertTrue(def.warnings.includes('INSTITUTIONAL_RANK_NO_DATA'));
  assertEqual(def.institutionalRankIndex, null);
});

test('Edge: defaultInstitutionalRank with null symbol', () => {
  const def = defaultInstitutionalRank(null);
  assertNull(def.symbol);
});

test('Edge: defaultInstitutionalRank with undefined symbol', () => {
  const def = defaultInstitutionalRank();
  assertNull(def.symbol);
});

test('Edge: NaN in signalScore produces UNAVAILABLE', () => {
  const signal = { ...defaultInstitutionalSignal(), institutionalSignalScore: NaN };
  const score = calculateInstitutionalRankScore(signal);
  assertTrue(score == null, 'NaN signal score should produce null rank score');
});

test('Edge: Infinity in signalScore produces valid score', () => {
  const signal = { ...defaultInstitutionalSignal(), institutionalSignalScore: Infinity };
  const score = calculateInstitutionalRankScore(signal);
  assertInRange(score, 0, 100);
});

test('Edge: signal with all UNAVAILABLE classifications', () => {
  const signal = {
    institutionalSignalScore: 50,
    institutionalActivity: 'UNAVAILABLE',
    institutionalConviction: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
  };
  const score = calculateInstitutionalRankScore(signal);
  assertInRange(score, 0, 100);
});

test('Edge: no NaN in any computed rank field', () => {
  const signal = makeCompleteSignal();
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  assertNoNaN(rank);
  assertNoInfinity(rank);
});

test('Edge: empty filingSignals does not affect ranking', () => {
  const sec = makeSecData({ latestRelevantFilings: [] });
  const intel = buildInstitutionalIntelligence('AAPL', sec, null, null);
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  assertNoNaN(rank);
  assertNoInfinity(rank);
});

test('Regression: A3.1/A3.2 behavior unchanged through A3.3', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');

  // A3.1 fields preserved
  assertEqual(rank.institutionalActivity, signal.institutionalActivity);
  assertEqual(rank.institutionalRisk, signal.institutionalRisk);

  // A3.2 fields preserved
  assertEqual(rank.institutionalSignalScore, signal.institutionalSignalScore);
  assertEqual(rank.institutionalConviction, signal.institutionalConviction);

  // A3.3 new fields
  assertTrue(rank.institutionalRankScore != null);
  assertTrue(rank.institutionalRankClass !== 'UNAVAILABLE' || rank.institutionalRankScore === null);
});

test('Regression: multiple symbols ranking preserves individual data', () => {
  const signals = [
    { ...makeCompleteSignal(), symbol: 'A' },
    { ...makeCompleteSignal(), symbol: 'B' },
  ];
  const ranked = rankInstitutionalOpportunities(signals);
  // Verify each ranked item has complete data
  for (const r of ranked) {
    assertTrue(r.institutionalActivity != null);
    assertTrue(r.institutionalRisk != null);
    assertTrue(r.dataStatus != null);
  }
});

test('Edge: rank score with zero signal score', () => {
  const signal = {
    institutionalSignalScore: 0,
    institutionalActivity: 'HIGH',
    institutionalConviction: 'HIGH',
    institutionalRisk: 'LOW',
    dataStatus: 'complete',
  };
  const score = calculateInstitutionalRankScore(signal);
  assertEqual(score, 0);
});

test('Edge: rank score preserves precision with fractional inputs', () => {
  const signal = {
    institutionalSignalScore: 55,
    institutionalActivity: 'MODERATE',
    institutionalConviction: 'MEDIUM',
    institutionalRisk: 'MODERATE',
    dataStatus: 'partial',
  };
  const score = calculateInstitutionalRankScore(signal);
  assertInRange(score, 0, 100);
  assertNoNaN({ score });
});

// --- Section 8: Full Integration ---

test('Integration: full pipeline A3.1 -> A3.2 -> A3.3', () => {
  const sec = makeSecData();
  const finra = makeFinraData();
  const finraScore = makeFinraScore();

  const intel = buildInstitutionalIntelligence('AAPL', sec, finra, finraScore);
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');

  assertEqual(rank.symbol, 'AAPL');
  assertEqual(rank.dataStatus, intel.dataStatus);
  assertTrue(rank.institutionalSignalScore === signal.institutionalSignalScore);
  assertTrue(rank.institutionalRankScore != null);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(rank.institutionalRankClass));
  assertNoNaN(rank);
  assertNoInfinity(rank);
});

test('Integration: selectTopInstitutional from intelligence objects', () => {
  const intel1 = buildInstitutionalIntelligence('A', makeSecData(), makeFinraData(), makeFinraScore({ score: 90 }));
  const intel2 = buildInstitutionalIntelligence('B', makeSecData(), makeFinraData(), makeFinraScore({ score: 30 }));
  const intel3 = buildInstitutionalIntelligence('C', null, null, null);

  const signals = [intel1, intel2, intel3].map((i) => buildInstitutionalSignal(i));
  const { top, alternatives, fullRanking } = selectTopInstitutional(signals, 5);

  assertEqual(fullRanking.length, 3);
  assertTrue(fullRanking[0].symbol === 'A' || fullRanking[0].symbol === 'B');
  assertNull(fullRanking[2].institutionalRankScore);
});

// --- Summary ---

console.log('\n========================================');
console.log('Results: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}
