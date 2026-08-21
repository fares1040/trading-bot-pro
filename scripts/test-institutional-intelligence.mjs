/**
 * Institutional Intelligence Core Tests (A3.1)
 *
 * Tests for lib/institutional-intelligence.js
 * Run with: node scripts/test-institutional-intelligence.mjs
 */

import {
  calculateInstitutionalActivityScore,
  classifyOwnershipStrength,
  classifyInstitutionalActivity,
  classifyInstitutionalRisk,
  buildFilingSignals,
  buildInstitutionalReasons,
  buildInstitutionalWarnings,
  buildInstitutionalFlags,
  buildInstitutionalIntelligence,
  defaultInstitutionalIntelligence,
} from '../lib/institutional-intelligence.js';

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

// ============================================================================
// FIXTURES
// ============================================================================

function makeSecData(overrides = {}) {
  return {
    symbol: 'TEST',
    secRiskScore: 25,
    secRiskLevel: 'low',
    secRiskFlags: [],
    dilutionRisk: 'none',
    dilutionReason: 'No dilution-related filings detected',
    offeringRisk: 'low',
    offeringType: null,
    offeringDate: null,
    offeringReason: null,
    warrantRisk: 'none',
    convertibleRisk: 'none',
    warrantReasons: [],
    reverseSplitRisk: 'none',
    reverseSplitDetected: false,
    reverseSplitDate: null,
    reverseSplitRatio: null,
    latestRelevantFilings: [
      { form: '10-Q', filingDate: '2024-01-15', accessionNumber: '0001-1', primaryDocument: '10q.htm' },
      { form: '8-K', filingDate: '2024-01-10', accessionNumber: '0001-2', primaryDocument: '8k.htm' },
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
    dataTimestamp: '2024-01-15',
    weekStartDate: '2024-01-08',
    issueName: 'TEST CORP',
    atsShareQuantity: 5000000,
    atsTradeCount: 150,
    summaryType: 'ATS_W_SMBL',
    tier: 'T1',
    verified: true,
    disclaimers: {
      delayed: true,
      aggregated: true,
      notRealtime: true,
      notDarkPoolFlow: true,
      notOptionsFlow: true,
    },
    ...overrides,
  };
}

function makeFinraScore(overrides = {}) {
  return {
    score: 65,
    confidence: 'moderate',
    type: 'ats-activity',
    source: 'FINRA ATS/OTC',
    interpretation: 'Institutional activity proxy based on ATS volume. Does NOT indicate direction.',
    components: { shareScore: 35, tradeScore: 22, freshnessScore: 8 },
    disclaimers: {
      delayedData: true,
      aggregatedWeekly: true,
      noDirection: true,
      notRealtime: true,
    },
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

console.log('\n========================================');
console.log('Institutional Intelligence Core Tests (A3.1)');
console.log('========================================\n');

// --- Section 1: No Data (null/null) ---

test('No data at all: activity score is null', () => {
  const score = calculateInstitutionalActivityScore(null, null);
  assertNull(score, 'Expected null when no data');
});

test('No data at all: ownership strength is UNAVAILABLE', () => {
  const strength = classifyOwnershipStrength(null, null);
  assertEqual(strength, 'UNAVAILABLE');
});

test('No data at all: activity is UNAVAILABLE', () => {
  const activity = classifyInstitutionalActivity(null);
  assertEqual(activity, 'UNAVAILABLE');
});

test('No data at all: risk is UNAVAILABLE', () => {
  const risk = classifyInstitutionalRisk(null);
  assertEqual(risk, 'UNAVAILABLE');
});

test('No data at all: filing signals empty', () => {
  const signals = buildFilingSignals(null);
  assertEqual(signals, []);
});

test('No data at all: default intelligence is unavailable', () => {
  const intel = buildInstitutionalIntelligence('AAPL', null, null, null);
  assertEqual(intel.institutionalActivityScore, null);
  assertEqual(intel.ownershipStrength, 'UNAVAILABLE');
  assertEqual(intel.institutionalActivity, 'UNAVAILABLE');
  assertEqual(intel.institutionalRisk, 'UNAVAILABLE');
  assertEqual(intel.dataStatus, 'unavailable');
  assertEqual(intel.flags, []);
  assertEqual(intel.warnings, []);
});

test('No data at all: reasons include SEC unavailable', () => {
  const intel = buildInstitutionalIntelligence('AAPL', null, null, null);
  assertTrue(intel.reasons.some((r) => r === 'SEC data unavailable'));
});

// --- Section 2: SEC Only (normal case) ---

test('SEC only: activity score calculated', () => {
  const sec = makeSecData();
  const score = calculateInstitutionalActivityScore(sec, null);
  assertTrue(score != null, 'Expected non-null score');
  assertInRange(score, 0, 100, 'Score must be 0-100');
});

test('SEC only: ownership WEAK with 2 filings', () => {
  const sec = makeSecData();
  const strength = classifyOwnershipStrength(sec, null);
  assertEqual(strength, 'WEAK');
});

test('SEC only: dataStatus is partial', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), null, null);
  assertEqual(intel.dataStatus, 'partial');
});

test('SEC only: filing signals built from SEC data', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '8-K', filingDate: '2024-02-01', accessionNumber: '1', primaryDocument: 'doc' },
    ],
  });
  const signals = buildFilingSignals(sec);
  assertEqual(signals.length, 1);
  assertEqual(signals[0].form, '8-K');
  assertEqual(signals[0].filingDate, '2024-02-01');
});

test('SEC only: activity HIGH when many filings and high risk', () => {
  const sec = makeSecData({
    secRiskScore: 80,
    secRiskLevel: 'high',
    secRiskFlags: ['DILUTION_RISK', 'OFFERING_RISK'],
    latestRelevantFilings: [
      { form: '8-K', filingDate: '2024-01-01' },
      { form: '8-K', filingDate: '2024-01-02' },
      { form: '8-K', filingDate: '2024-01-03' },
      { form: '8-K', filingDate: '2024-01-04' },
    ],
  });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertEqual(score, 70);
  const activity = classifyInstitutionalActivity(score);
  assertEqual(activity, 'HIGH');
});

test('SEC only: activity MODERATE when single filing, low risk', () => {
  const sec = makeSecData({
    secRiskScore: 10,
    secRiskLevel: 'low',
    secRiskFlags: [],
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2024-01-01' },
    ],
  });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertEqual(score, 45);
  const activity = classifyInstitutionalActivity(score);
  assertEqual(activity, 'MODERATE');
});

test('SEC only: ownership WEAK with single filing', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2024-01-01' },
    ],
  });
  const strength = classifyOwnershipStrength(sec, null);
  assertEqual(strength, 'WEAK');
});

test('SEC only: ownership MODERATE with 3+ filings', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2024-01-01' },
      { form: '10-Q', filingDate: '2024-01-02' },
      { form: '8-K', filingDate: '2024-01-03' },
    ],
  });
  const strength = classifyOwnershipStrength(sec, null);
  assertEqual(strength, 'MODERATE');
});

// --- Section 3: SEC + FINRA (complete case) ---

test('SEC + FINRA: activity score combines both sources', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const score = calculateInstitutionalActivityScore(sec, finraScore);
  // SEC: 40 + 10 (2 filings) = 50; FINRA: 65
  // Combined: 50% * 50 + 50% * 65 = 57.5 -> 58
  assertEqual(score, 58);
});

test('SEC + FINRA: dataStatus is complete', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  assertEqual(intel.dataStatus, 'complete');
});

test('SEC + FINRA: ownership STRONG with high ATS volume', () => {
  const sec = makeSecData({ latestRelevantFilings: [
    { form: '10-K', filingDate: '2024-01-01' },
  ]});
  const finra = makeFinraData({ atsShareQuantity: 2000000 });
  const strength = classifyOwnershipStrength(sec, finra);
  assertEqual(strength, 'STRONG');
});

test('SEC + FINRA: ownership STRONG with many filings', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2024-01-01' },
      { form: '10-Q', filingDate: '2024-01-02' },
      { form: '10-Q', filingDate: '2024-01-03' },
    ],
  });
  const finra = makeFinraData({ atsShareQuantity: 50000 });
  const strength = classifyOwnershipStrength(sec, finra);
  assertEqual(strength, 'STRONG');
});

test('SEC + FINRA: ownership MODERATE when ATS volume <1M and <3 filings', () => {
  const sec = makeSecData({ latestRelevantFilings: [
    { form: '10-K', filingDate: '2024-01-01' },
  ]});
  const finra = makeFinraData({ atsShareQuantity: 150000 });
  const strength = classifyOwnershipStrength(sec, finra);
  assertEqual(strength, 'MODERATE');
});

test('SEC + FINRA: warnings include FINRA_DATA_DELAYED', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  assertTrue(intel.warnings.includes('FINRA_DATA_DELAYED'));
});

test('SEC + FINRA: flags include both data availability', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  assertTrue(intel.flags.includes('SEC_DATA_AVAILABLE'));
  assertTrue(intel.flags.includes('FINRA_DATA_AVAILABLE'));
});

// --- Section 4: FINRA only ---

test('FINRA only: activity score from FINRA', () => {
  const finraScore = makeFinraScore({ score: 80 });
  const score = calculateInstitutionalActivityScore(null, finraScore);
  assertEqual(score, 80);
});

test('FINRA only: dataStatus is partial', () => {
  const intel = buildInstitutionalIntelligence('AAPL', null, makeFinraData(), makeFinraScore());
  assertEqual(intel.dataStatus, 'partial');
});

test('FINRA only: ownership MODERATE with high ATS volume', () => {
  const finra = makeFinraData({ atsShareQuantity: 2000000 });
  const strength = classifyOwnershipStrength(null, finra);
  assertEqual(strength, 'MODERATE');
});

test('FINRA only: ownership WEAK with low ATS volume', () => {
  const finra = makeFinraData({ atsShareQuantity: 50000 });
  const strength = classifyOwnershipStrength(null, finra);
  assertEqual(strength, 'WEAK');
});

test('FINRA only: ownership UNAVAILABLE with very low volume', () => {
  const finra = makeFinraData({ atsShareQuantity: 5000 });
  const strength = classifyOwnershipStrength(null, finra);
  assertEqual(strength, 'UNAVAILABLE');
});

// --- Section 5: Malformed data ---

test('Malformed SEC: empty filings array', () => {
  const sec = makeSecData({ latestRelevantFilings: [] });
  const signals = buildFilingSignals(sec);
  assertEqual(signals, []);
});

test('Malformed SEC: no latestRelevantFilings field', () => {
  const sec = { secDataStatus: 'ok', secRiskScore: 10, secRiskLevel: 'low', secRiskFlags: [] };
  const signals = buildFilingSignals(sec);
  assertEqual(signals, []);
});

test('Malformed SEC: latestRelevantFilings is null', () => {
  const sec = makeSecData({ latestRelevantFilings: null });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertTrue(score != null, 'Should still compute score');
  assertEqual(score, 40);
});

test('Malformed FINRA: null score value inside finraScore object', () => {
  const finra = { score: null, source: 'FINRA' };
  const score = calculateInstitutionalActivityScore(null, finra);
  assertNull(score, 'Should ignore finraScore with null score');
});

test('Malformed SEC: secDataStatus is not "ok"', () => {
  const sec = makeSecData({ secDataStatus: 'no_filings', latestRelevantFilings: [] });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertNull(score, 'Should return null when secDataStatus is not ok');
});

test('Malformed SEC: secDataStatus is "unavailable"', () => {
  const sec = makeSecData({ secDataStatus: 'unavailable' });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertNull(score, 'Should return null when secDataStatus is unavailable');
});

test('Malformed FINRA: missing score property entirely', () => {
  const finra = { source: 'FINRA' };
  const score = calculateInstitutionalActivityScore(null, finra);
  assertNull(score, 'Should return null when finraScore has no score property');
});

// --- Section 6: Risk classification ---

test('Risk: LOW from SEC low', () => {
  const sec = makeSecData({ secRiskLevel: 'low' });
  assertEqual(classifyInstitutionalRisk(sec), 'LOW');
});

test('Risk: MODERATE from SEC moderate', () => {
  const sec = makeSecData({ secRiskLevel: 'moderate' });
  assertEqual(classifyInstitutionalRisk(sec), 'MODERATE');
});

test('Risk: HIGH from SEC high', () => {
  const sec = makeSecData({ secRiskLevel: 'high' });
  assertEqual(classifyInstitutionalRisk(sec), 'HIGH');
});

test('Risk: EXTREME from SEC extreme', () => {
  const sec = makeSecData({ secRiskLevel: 'extreme' });
  assertEqual(classifyInstitutionalRisk(sec), 'EXTREME');
});

test('Risk: UNAVAILABLE when SEC risk level is unavailable', () => {
  const sec = makeSecData({ secRiskLevel: 'unavailable' });
  assertEqual(classifyInstitutionalRisk(sec), 'UNAVAILABLE');
});

test('Risk: UNAVAILABLE when no SEC data', () => {
  assertEqual(classifyInstitutionalRisk(null), 'UNAVAILABLE');
});

// --- Section 7: Warnings ---

test('Warnings: DILUTION_RISK when secRiskFlags has DILUTION_RISK', () => {
  const sec = makeSecData({ secRiskFlags: ['DILUTION_RISK'] });
  const warnings = buildInstitutionalWarnings(sec, null);
  assertTrue(warnings.includes('SEC_DILUTION_RISK'));
});

test('Warnings: OFFERING_RISK when secRiskFlags has OFFERING_RISK', () => {
  const sec = makeSecData({ secRiskFlags: ['OFFERING_RISK'] });
  const warnings = buildInstitutionalWarnings(sec, null);
  assertTrue(warnings.includes('SEC_OFFERING_RISK'));
});

test('Warnings: REVERSE_SPLIT when secRiskFlags has REVERSE_SPLIT_RISK', () => {
  const sec = makeSecData({ secRiskFlags: ['REVERSE_SPLIT_RISK'] });
  const warnings = buildInstitutionalWarnings(sec, null);
  assertTrue(warnings.includes('SEC_REVERSE_SPLIT'));
});

test('Warnings: no warnings with clean data', () => {
  const sec = makeSecData({ secRiskFlags: [] });
  const warnings = buildInstitutionalWarnings(sec, makeFinraScore({ disclaimers: { delayedData: false } }));
  assertEqual(warnings, []);
});

test('Warnings: empty when no data', () => {
  const warnings = buildInstitutionalWarnings(null, null);
  assertEqual(warnings, []);
});

// --- Section 8: Flags ---

test('Flags: HIGH_ACTIVITY when score >= 70', () => {
  const flags = buildInstitutionalFlags(null, null, 75);
  assertTrue(flags.includes('HIGH_ACTIVITY'));
});

test('Flags: MODERATE_ACTIVITY when score 40-69', () => {
  const flags = buildInstitutionalFlags(null, null, 50);
  assertTrue(flags.includes('MODERATE_ACTIVITY'));
  assertFalse(flags.includes('HIGH_ACTIVITY'));
});

test('Flags: no activity flags when score < 40', () => {
  const flags = buildInstitutionalFlags(null, null, 30);
  assertFalse(flags.includes('HIGH_ACTIVITY'));
  assertFalse(flags.includes('MODERATE_ACTIVITY'));
});

test('Flags: no flags when score is null', () => {
  const flags = buildInstitutionalFlags(null, null, null);
  assertEqual(flags, []);
});

// --- Section 9: Reasons ---

test('Reasons: mentions SEC filings when available', () => {
  const sec = makeSecData({ secDataStatus: 'ok', latestRelevantFilings: [
    { form: '10-Q', filingDate: '2024-01-01' },
  ] });
  const reasons = buildInstitutionalReasons(sec, null, 45);
  assertTrue(reasons.some((r) => r.includes('SEC filings available')));
});

test('Reasons: mentions SEC data unavailable', () => {
  const reasons = buildInstitutionalReasons(null, null, null);
  assertTrue(reasons.some((r) => r === 'SEC data unavailable'));
});

test('Reasons: mentions no filings when secDataStatus is no_filings', () => {
  const sec = makeSecData({ secDataStatus: 'no_filings' });
  const reasons = buildInstitutionalReasons(sec, null, null);
  assertTrue(reasons.some((r) => r === 'No recent SEC filings'));
});

test('Reasons: mentions SEC data unavailable when secDataStatus is unavailable', () => {
  const sec = makeSecData({ secDataStatus: 'unavailable' });
  const reasons = buildInstitutionalReasons(sec, null, null);
  assertTrue(reasons.some((r) => r === 'SEC data unavailable'));
});

test('Reasons: includes FINRA score when available', () => {
  const sec = makeSecData();
  const finra = makeFinraScore({ score: 75 });
  const reasons = buildInstitutionalReasons(sec, finra, 60);
  assertTrue(reasons.some((r) => r.includes('75/100')));
});

// --- Section 10: Full intelligence object ---

test('Full: symbol is set correctly', () => {
  const intel = buildInstitutionalIntelligence('TSLA', makeSecData(), null, null);
  assertEqual(intel.symbol, 'TSLA');
});

test('Full: null symbol when symbol is null', () => {
  const intel = buildInstitutionalIntelligence(null, null, null, null);
  assertNull(intel.symbol);
});

test('Full: provider is "sec" when only SEC', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), null, null);
  assertEqual(intel.provider, 'sec');
});

test('Full: provider is "finra" when only FINRA', () => {
  const intel = buildInstitutionalIntelligence('AAPL', null, makeFinraData(), makeFinraScore());
  assertEqual(intel.provider, 'finra');
});

test('Full: provider is "finra" when both (FINRA takes precedence)', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  assertEqual(intel.provider, 'finra');
});

test('Full: finraAvailable is false when no FINRA', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), null, null);
  assertFalse(intel.finraAvailable);
});

test('Full: finraAvailable is true when FINRA score present', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  assertTrue(intel.finraAvailable);
});

test('Full: finraAvailable is false when FINRA score is null', () => {
  const intel = buildInstitutionalIntelligence('AAPL', makeSecData(), makeFinraData(), { score: null, source: 'FINRA' });
  assertFalse(intel.finraAvailable);
});

test('Full: secDataStatus reflected from SEC data', () => {
  const sec = makeSecData({ secDataStatus: 'no_filings' });
  const intel = buildInstitutionalIntelligence('AAPL', sec, null, null);
  assertEqual(intel.secDataStatus, 'no_filings');
});

test('Full: secDataStatus is "unavailable" when no SEC', () => {
  const intel = buildInstitutionalIntelligence('AAPL', null, null, null);
  assertEqual(intel.secDataStatus, 'unavailable');
});

// --- Section 11: Edge cases ---

test('Edge: score clamped to 0-100', () => {
  const sec = makeSecData({
    secRiskScore: 100,
    secRiskLevel: 'extreme',
    secRiskFlags: ['DILUTION_RISK', 'OFFERING_RISK', 'REVERSE_SPLIT_RISK'],
    latestRelevantFilings: Array.from({ length: 6 }, (_, i) => ({
      form: '8-K',
      filingDate: '2024-01-' + (i + 1).toString().padStart(2, '0'),
    })),
  });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertInRange(score, 0, 100);
  assertTrue(score <= 100, 'Score must not exceed 100');
});

test('Edge: many filings capped at +30', () => {
  const sec = makeSecData({
    latestRelevantFilings: Array.from({ length: 10 }, (_, i) => ({
      form: '8-K',
      filingDate: '2024-01-' + (i + 1).toString().padStart(2, '0'),
    })),
  });
  const score = calculateInstitutionalActivityScore(sec, null);
  assertEqual(score, 70);
});

test('Edge: empty string symbol preserved', () => {
  const intel = buildInstitutionalIntelligence('', makeSecData(), null, null);
  assertEqual(intel.symbol, '');
});

test('Edge: defaultInstitutionalIntelligence returns empty structure', () => {
  const def = defaultInstitutionalIntelligence();
  assertEqual(def.institutionalActivityScore, null);
  assertEqual(def.ownershipStrength, 'UNAVAILABLE');
  assertEqual(def.institutionalActivity, 'UNAVAILABLE');
  assertEqual(def.institutionalRisk, 'UNAVAILABLE');
  assertEqual(def.dataStatus, 'unavailable');
  assertEqual(def.filingSignals, []);
  assertEqual(def.secDataStatus, 'unavailable');
  assertEqual(def.finraAvailable, false);
  assertEqual(def.provider, null);
  assertEqual(def.reasons, []);
  assertEqual(def.warnings, []);
  assertEqual(def.flags, []);
});

test('Edge: SEC data with undefined fields', () => {
  const sec = { secDataStatus: 'ok' };
  const score = calculateInstitutionalActivityScore(sec, null);
  assertEqual(score, 40);
  const signals = buildFilingSignals(sec);
  assertEqual(signals, []);
});

test('Edge: activity classification boundaries', () => {
  assertEqual(classifyInstitutionalActivity(70), 'HIGH');
  assertEqual(classifyInstitutionalActivity(69), 'MODERATE');
  assertEqual(classifyInstitutionalActivity(40), 'MODERATE');
  assertEqual(classifyInstitutionalActivity(39), 'LOW');
  assertEqual(classifyInstitutionalActivity(20), 'LOW');
  assertEqual(classifyInstitutionalActivity(19), 'UNAVAILABLE');
  assertEqual(classifyInstitutionalActivity(null), 'UNAVAILABLE');
});

test('Edge: combined score with risk filings boost', () => {
  const sec = makeSecData({
    secRiskFlags: ['DILUTION_RISK'],
    latestRelevantFilings: [
      { form: '8-K', filingDate: '2024-01-01' },
      { form: '10-Q', filingDate: '2024-01-02' },
    ],
  });
  const finra = makeFinraScore({ score: 50 });
  // SEC: 40 + 10 (2 filings * 5) + 10 (dilution risk) = 60
  // FINRA: 50
  // Combined: 50% * 60 + 50% * 50 = 55
  const score = calculateInstitutionalActivityScore(sec, finra);
  assertEqual(score, 55);
});

test('Edge: combined score with no risky filings', () => {
  const sec = makeSecData({
    secRiskFlags: [],
    latestRelevantFilings: [
      { form: '10-Q', filingDate: '2024-01-01' },
      { form: '10-K', filingDate: '2024-01-02' },
    ],
  });
  const finra = makeFinraScore({ score: 50 });
  // SEC: 40 + 10 (2 filings * 5) = 50
  // FINRA: 50
  // Combined: 50% * 50 + 50% * 50 = 50
  const score = calculateInstitutionalActivityScore(sec, finra);
  assertEqual(score, 50);
});

test('Edge: reasons capped at 6', () => {
  const sec = makeSecData({
    secRiskLevel: 'extreme',
    secRiskScore: 100,
    secRiskFlags: ['DILUTION_RISK', 'OFFERING_RISK', 'REVERSE_SPLIT_RISK'],
    latestRelevantFilings: Array.from({ length: 10 }, (_, i) => ({
      form: '8-K',
      filingDate: '2024-01-' + (i + 1).toString().padStart(2, '0'),
    })),
  });
  const finra = makeFinraScore({ score: 90, confidence: 'high' });
  const reasons = buildInstitutionalReasons(sec, finra, 85);
  assertTrue(reasons.length <= 6, 'Reasons should be capped at 6');
});

test('Edge: flags include HIGH_INSTITUTIONAL_RISK', () => {
  const sec = makeSecData({ secRiskLevel: 'high' });
  const flags = buildInstitutionalFlags(sec, null, 50);
  assertTrue(flags.includes('HIGH_INSTITUTIONAL_RISK'));
});

test('Edge: flags do not include HIGH_INSTITUTIONAL_RISK for low risk', () => {
  const sec = makeSecData({ secRiskLevel: 'low' });
  const flags = buildInstitutionalFlags(sec, null, 50);
  assertFalse(flags.includes('HIGH_INSTITUTIONAL_RISK'));
});

test('Edge: full intelligence with both SEC + FINRA', () => {
  const sec = makeSecData();
  const finraData = makeFinraData();
  const finraScore = makeFinraScore();
  const intel = buildInstitutionalIntelligence('AAPL', sec, finraData, finraScore);

  assertEqual(intel.symbol, 'AAPL');
  assertEqual(intel.dataStatus, 'complete');
  assertEqual(intel.secDataStatus, 'ok');
  assertTrue(intel.finraAvailable);
  assertEqual(intel.provider, 'finra');
  assertInRange(intel.institutionalActivityScore, 0, 100);
  assertTrue(intel.filingSignals.length > 0);
  assertTrue(intel.reasons.length > 0);
  assertTrue(Array.isArray(intel.warnings));
  assertTrue(Array.isArray(intel.flags));
});

// --- Summary ---

console.log('\n========================================');
console.log('Results: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}
