/**
 * Institutional Decision Tests (A3 Final)
 *
 * Tests for lib/institutional-decision.js
 * Run with: node scripts/test-institutional-decision.mjs
 */

import {
  buildInstitutionalIntelligence,
} from '../lib/institutional-intelligence.js';
import {
  buildInstitutionalSignal,
  defaultInstitutionalSignal,
} from '../lib/institutional-signal.js';
import {
  rankInstitutionalSignal,
  defaultInstitutionalRank,
} from '../lib/institutional-ranking.js';
import {
  calculateExecutionQuality,
  calculateInstitutionalDecisionScore,
  classifyInstitutionalStatus,
  buildInstitutionalDecision,
  rankInstitutionalDecisions,
  defaultInstitutionalDecision,
} from '../lib/institutional-decision.js';

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

function makeCompleteStack() {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  return { intel, signal, rank };
}

function makeSecOnlyStack() {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), null, null);
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  return { intel, signal, rank };
}

function makeNoneStack() {
  const intel = buildInstitutionalIntelligence('AAPL', null, null, null);
  const signal = buildInstitutionalSignal(intel);
  const rank = rankInstitutionalSignal(signal, 'AAPL');
  return { intel, signal, rank };
}

// ============================================================================
// TESTS
// ============================================================================

console.log('\n========================================');
console.log('Institutional Decision Tests (A3 Final)');
console.log('========================================\n');

// --- Section 1: Execution Quality ---

test('Execution quality: null when signal is null', () => {
  assertNull(calculateExecutionQuality(null));
});

test('Execution quality: 0 when both dq and freshness are 0', () => {
  const signal = { dataQuality: 0, freshness: 0 };
  assertEqual(calculateExecutionQuality(signal), 0);
});

test('Execution quality: average of dq and freshness', () => {
  const signal = { dataQuality: 60, freshness: 80 };
  assertEqual(calculateExecutionQuality(signal), 70);
});

test('Execution quality: capped at 100', () => {
  const signal = { dataQuality: 100, freshness: 100 };
  assertEqual(calculateExecutionQuality(signal), 100);
});

test('Execution quality: partial data quality', () => {
  const signal = { dataQuality: 60, freshness: 100 };
  assertEqual(calculateExecutionQuality(signal), 80);
});

// --- Section 2: Decision Score ---

test('Decision score: null when all inputs are null', () => {
  assertNull(calculateInstitutionalDecisionScore(null, null, null));
});

test('Decision score: null when no score data exists', () => {
  const { intel, signal, rank } = makeNoneStack();
  assertNull(calculateInstitutionalDecisionScore(intel, signal, rank));
});

test('Decision score: uses rank score when signal is null', () => {
  const rank = { institutionalRankScore: 80 };
  const signal = null;
  const intel = null;
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  assertEqual(score, 40); // 80 * 0.5 = 40
});

test('Decision score: uses signal score when rank is null', () => {
  const signal = { institutionalSignalScore: 60, dataQuality: 60, freshness: 60 };
  const rank = null;
  const intel = null;
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  // rankScore falls back to signalScore=60, execQuality=60
  // decisionScore = 60*0.5 + 60*0.3 + 60*0.2 = 60
  assertEqual(score, 60);
});

test('Decision score: complete stack', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  assertInRange(score, 0, 100, 'Decision score should be 0-100');
  assertNoNaN(score);
});

test('Decision score: no NaN with complete stack', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  assertTrue(!Number.isNaN(score), 'Score should not be NaN');
});

test('Decision score: no Infinity', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  assertTrue(Number.isFinite(score), 'Score should be finite');
});

test('Decision score: clamped to 0-100', () => {
  const rank = { institutionalRankScore: 100 };
  const signal = { institutionalSignalScore: 100, dataQuality: 100, freshness: 100 };
  const intel = { dataStatus: 'complete' };
  const score = calculateInstitutionalDecisionScore(intel, signal, rank);
  assertInRange(score, 0, 100);
});

// --- Section 3: Status Classification ---

test('Status: UNAVAILABLE for null score', () => {
  assertEqual(classifyInstitutionalStatus(null), 'UNAVAILABLE');
});

test('Status: UNAVAILABLE for NaN', () => {
  assertEqual(classifyInstitutionalStatus(NaN), 'UNAVAILABLE');
});

test('Status: TOP for >= 80', () => {
  assertEqual(classifyInstitutionalStatus(80), 'DECISION_TOP');
  assertEqual(classifyInstitutionalStatus(100), 'DECISION_TOP');
});

test('Status: STRONG for >= 60', () => {
  assertEqual(classifyInstitutionalStatus(60), 'DECISION_STRONG');
  assertEqual(classifyInstitutionalStatus(79), 'DECISION_STRONG');
});

test('Status: WATCH for >= 40', () => {
  assertEqual(classifyInstitutionalStatus(40), 'DECISION_WATCH');
  assertEqual(classifyInstitutionalStatus(59), 'DECISION_WATCH');
});

test('Status: MONITOR for >= 20', () => {
  assertEqual(classifyInstitutionalStatus(20), 'DECISION_MONITOR');
  assertEqual(classifyInstitutionalStatus(39), 'DECISION_MONITOR');
});

test('Status: OBSERVE for >= 5', () => {
  assertEqual(classifyInstitutionalStatus(5), 'DECISION_OBSERVE');
  assertEqual(classifyInstitutionalStatus(19), 'DECISION_OBSERVE');
});

test('Status: UNAVAILABLE for < 5', () => {
  assertEqual(classifyInstitutionalStatus(4), 'UNAVAILABLE');
  assertEqual(classifyInstitutionalStatus(0), 'UNAVAILABLE');
});

test('Status: boundary at 80', () => {
  assertEqual(classifyInstitutionalStatus(79), 'DECISION_STRONG');
  assertEqual(classifyInstitutionalStatus(80), 'DECISION_TOP');
});

test('Status: boundary at 60', () => {
  assertEqual(classifyInstitutionalStatus(59), 'DECISION_WATCH');
  assertEqual(classifyInstitutionalStatus(60), 'DECISION_STRONG');
});

test('Status: boundary at 40', () => {
  assertEqual(classifyInstitutionalStatus(39), 'DECISION_MONITOR');
  assertEqual(classifyInstitutionalStatus(40), 'DECISION_WATCH');
});

// --- Section 4: Build Decision ---

test('Build decision: null-safe with all nulls', () => {
  const decision = buildInstitutionalDecision(null, null, null, 'TEST');
  assertEqual(decision.institutionalDecisionScore, null);
  assertEqual(decision.institutionalStatus, 'UNAVAILABLE');
  assertEqual(decision.symbol, 'TEST');
  assertTrue(decision.warnings.includes('INSTITUTIONAL_DECISION_NO_DATA'));
});

test('Build decision: complete stack has score', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertInRange(decision.institutionalDecisionScore, 0, 100);
  assertTrue(decision.institutionalStatus !== 'UNAVAILABLE');
  assertTrue(decision.reasons.length > 0);
  assertTrue(decision.symbol === 'AAPL');
});

test('Build decision: no NaN/Infinity in output', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertNoNaN(decision);
  assertNoInfinity(decision);
});

test('Build decision: carries executionQuality', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(decision.executionQuality != null);
  assertInRange(decision.executionQuality, 0, 100);
});

test('Build decision: carries component scores', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertEqual(decision.rankScore, rank.institutionalRankScore);
  assertEqual(decision.rankClass, rank.institutionalRankClass);
  assertEqual(decision.signalScore, signal.institutionalSignalScore);
  assertEqual(decision.conviction, signal.institutionalConviction);
});

test('Build decision: reasons include all layer reasons', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(decision.reasons.length >= 3, 'Should have reasons from at least 3 layers');
});

test('Build decision: warnings include inherited warnings', () => {
  const { intel, signal, rank } = makeNoneStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(decision.warnings.length > 0);
  assertTrue(decision.warnings.includes('INSTITUTIONAL_DECISION_NO_DATA'));
});

test('Build decision: flags include status flags', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(Array.isArray(decision.flags));
});

test('Build decision: FINRA availability in reasons', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(decision.reasons.some((r) => r.includes('FINRA') || r.includes('SEC')));
});

// --- Section 5: Default ---

test('Default decision: null score, UNAVAILABLE status', () => {
  const d = defaultInstitutionalDecision('TEST');
  assertEqual(d.institutionalDecisionScore, null);
  assertEqual(d.institutionalStatus, 'UNAVAILABLE');
  assertEqual(d.symbol, 'TEST');
  assertTrue(d.warnings.includes('INSTITUTIONAL_DECISION_NO_DATA'));
});

test('Default decision: null symbol', () => {
  const d = defaultInstitutionalDecision(null);
  assertNull(d.symbol);
});

// --- Section 6: Rank Decisions ---

test('Rank decisions: empty array for null input', () => {
  assertEqual(rankInstitutionalDecisions(null, {}, {}), []);
});

test('Rank decisions: empty array for empty input', () => {
  assertEqual(rankInstitutionalDecisions([], {}, {}), []);
});

test('Rank decisions: sorts by decisionScore desc', () => {
  const opps = [
    { symbol: 'AAA', institutionalDecisionScore: 30, institutionalStatus: 'DECISION_MONITOR' },
    { symbol: 'BBB', institutionalDecisionScore: 80, institutionalStatus: 'DECISION_TOP' },
    { symbol: 'CCC', institutionalDecisionScore: 50, institutionalStatus: 'DECISION_STRONG' },
  ];
  const signalMap = {};
  const intelMap = {};
  const result = rankInstitutionalDecisions(opps, signalMap, intelMap);
  assertEqual(result[0].symbol, 'BBB');
  assertEqual(result[1].symbol, 'CCC');
  assertEqual(result[2].symbol, 'AAA');
});

test('Rank decisions: builds decisions for items without score', () => {
  const opps = [
    { symbol: 'AAA', institutionalRankScore: 50, institutionalRankClass: 'STRONG' },
  ];
  const signalMap = {
    AAA: { institutionalSignalScore: 70, institutionalConviction: 'HIGH', dataQuality: 60, freshness: 80, dataStatus: 'partial' },
  };
  const intelMap = {
    AAA: { dataStatus: 'partial' },
  };
  const result = rankInstitutionalDecisions(opps, signalMap, intelMap);
  assertTrue(result[0].institutionalDecisionScore != null);
  assertTrue(result[0].institutionalStatus !== 'UNAVAILABLE');
});

test('Rank decisions: respects limit', () => {
  const opps = Array.from({ length: 15 }, (_, i) => ({
    symbol: 'SYM' + i,
    institutionalDecisionScore: (i + 1) * 10,
    institutionalStatus: 'DECISION_TOP',
  }));
  const result = rankInstitutionalDecisions(opps, {}, {}, 5);
  assertEqual(result.length, 5);
  assertEqual(result[0].symbol, 'SYM14');
});

test('Rank decisions: null scores go last', () => {
  const opps = [
    { symbol: 'AAA', institutionalDecisionScore: 50, institutionalStatus: 'WEAK' },
    { symbol: 'BBB', institutionalDecisionScore: null, institutionalStatus: 'UNAVAILABLE' },
  ];
  const result = rankInstitutionalDecisions(opps, {}, {});
  assertEqual(result[0].symbol, 'AAA');
});

// --- Section 7: Integration / Regression ---

test('Decision reuses rank score without recalculation', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertEqual(decision.rankScore, rank.institutionalRankScore);
});

test('Decision does not duplicate rank warnings', () => {
  const { intel, signal, rank } = makeNoneStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  const uniqueWarnings = [...new Set(decision.warnings)];
  assertEqual(decision.warnings.length, uniqueWarnings.length);
});

test('Decision does not duplicate flags', () => {
  const { intel, signal, rank } = makeCompleteStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  const uniqueFlags = [...new Set(decision.flags)];
  assertEqual(decision.flags.length, uniqueFlags.length);
});

test('Decision: sec-only data (no FINRA)', () => {
  const { intel, signal, rank } = makeSecOnlyStack();
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertTrue(decision.institutionalDecisionScore != null);
  assertInRange(decision.institutionalDecisionScore, 0, 100);
  assertTrue(decision.reasons.some((r) => r.includes('SEC')));
  assertFalse(decision.flags.includes('FINRA_DATA_AVAILABLE'));
});

test('Decision: no NaN when stack has partial data', () => {
  const signal = {
    institutionalSignalScore: null,
    institutionalConviction: 'UNAVAILABLE',
    institutionalActivity: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
    activityScore: null,
    dataQuality: 0,
    freshness: 0,
  };
  const rank = defaultInstitutionalRank('AAPL');
  const intel = { dataStatus: 'unavailable', symbol: 'AAPL' };
  const decision = buildInstitutionalDecision(intel, signal, rank, 'AAPL');
  assertNull(decision.institutionalDecisionScore);
  assertEqual(decision.institutionalStatus, 'UNAVAILABLE');
  assertNoNaN(decision);
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n========================================');
console.log('Results: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
