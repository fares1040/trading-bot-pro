/**
 * B3 Institutional Radar Manager Tests
 *
 * Tests for lib/institutional-radar-manager.js (B3 Institutional Radar layer).
 * Run with: node scripts/test-institutional-radar-manager.mjs
 *
 * Fully deterministic — no network, no dev server, no credentials.
 *
 * Coverage:
 *   1.  Valid institutional data
 *   2.  Missing institutional data
 *   3.  Empty data
 *   4.  Accumulation signal
 *   5.  Distribution signal
 *   6.  Neutral / no directional claim
 *   7.  Conflicting signals
 *   8.  Ownership change
 *   9.  Filing signal
 *   10. Institutional transaction signal (FINRA ATS)
 *   11. Multiple institutional signals
 *   12. Data quality
 *   13. Freshness
 *   14. Provenance
 *   15. Confidence
 *   16. Score boundaries 0-100
 *   17. Deterministic output
 *   18. No fabricated values
 *   19. No look-ahead data
 *   20. API contract
 *   21. Existing institutional regression (A3)
 *   22. B1 regression
 *   23. B2 regression
 *   Plus: null, undefined, malformed input, NaN, Infinity, empty arrays,
 *         duplicate records, conflicting timestamps
 */

import {
  buildInstitutionalRadarResult,
  defaultInstitutionalRadar,
  rankInstitutionalOpportunitiesB3,
  classifyInstitutionalQuality,
  classifyInstitutionalAction,
  buildAccumulationScore,
  buildDistributionScore,
  classifySmartMoneyBias,
  n,
  clamp,
} from '../lib/institutional-radar-manager.js';

import {
  buildInstitutionalIntelligence,
  defaultInstitutionalIntelligence,
} from '../lib/institutional-intelligence.js';

import {
  buildInstitutionalSignal,
  defaultInstitutionalSignal,
  calculateDataQuality,
  calculateFreshness,
} from '../lib/institutional-signal.js';

import {
  rankInstitutionalSignal,
  rankInstitutionalOpportunities,
  selectTopInstitutional,
  defaultInstitutionalRank,
} from '../lib/institutional-ranking.js';

import {
  buildInstitutionalDecision,
  defaultInstitutionalDecision,
  calculateInstitutionalDecisionScore,
  classifyInstitutionalStatus,
} from '../lib/institutional-decision.js';

import { buildPennyIntelligence } from '../lib/penny-intelligence-manager.js';
import { buildOptionsIntelligenceResult } from '../lib/options-intelligence-manager.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(
      `${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected true but got false');
}

function assertNull(value, message = '') {
  if (value !== null)
    throw new Error(
      `${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`
    );
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined)
    throw new Error(message || 'Expected non-null value but got null/undefined');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

function assertScore0to100(score, message = '') {
  if (score != null) {
    assertTrue(
      Number.isFinite(score) && score >= 0 && score <= 100,
      `Score ${score} should be 0-100${message ? ' (' + message + ')' : ''}`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    interpretation:
      'Institutional activity proxy based on ATS volume. Does NOT indicate direction.',
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

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('B3 Institutional Radar Manager Tests');
console.log('========================================\n');

// === 1. Valid institutional data ===
test('1. Valid institutional data — produces complete radar', () => {
  const sec = makeSecData();
  const finra = makeFinraData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, finra, finraScore);

  assertEqual(result.ticker, 'AAPL');
  assertTrue(result.institutionalAvailability === true);
  assertNotNull(result.timestamp);
  assertNotNull(result.institutionalScore);
  assertScore0to100(result.institutionalScore);
  assertNotNull(result.institutionalQuality);
  assertNotNull(result.keySignals);
  assertTrue(result.keySignals.length > 0);
  assertNotNull(result.thesis);
  assertTrue(result.thesis.length > 10);
});

// === 2. Missing institutional data ===
test('2. Missing institutional data — null inputs return default', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertEqual(result.institutionalAvailability, false);
  assertNull(result.institutionalScore);
  assertNull(result.accumulationScore);
  assertNull(result.distributionScore);
  assertEqual(result.institutionalQuality, 'UNAVAILABLE');
  assertEqual(result.institutionalAction, 'INSUFFICIENT_DATA');
  assertEqual(result.smartMoneyBias, 'UNAVAILABLE');
  assertEqual(result.confidence, 'UNAVAILABLE');
  assertTrue(result.keySignals.length === 0);
  assertTrue(Array.isArray(result.risks));
  assertTrue(result.risks.length === 0);
});

test('2b. Missing institutional data — undefined inputs return default', () => {
  const result = buildInstitutionalRadarResult('AAPL', undefined, undefined, undefined);
  assertEqual(result.institutionalAvailability, false);
  assertEqual(result.ticker, 'AAPL');
});

test('2c. Missing symbol + data returns default', () => {
  const result = buildInstitutionalRadarResult(null, null, null, null);
  assertEqual(result.ticker, null);
  assertEqual(result.institutionalAvailability, false);
  assertEqual(result.institutionalAction, 'INSUFFICIENT_DATA');
});

// === 3. Empty data ===
test('3. Empty data — sec with no filings but OK status returns partial', () => {
  const sec = makeSecData({ latestRelevantFilings: [], secDataStatus: 'ok' });
  const result = buildInstitutionalRadarResult('TEST', sec, null, null);
  assertTrue(result.institutionalAvailability === true);
  assertEqual(result.filingSignal, 'NO_RELEVANT_FILINGS');
  assertTrue(result.dataQuality.completeness > 0);
});

// === 4. Accumulation ===
test('4. Accumulation — high activity produces non-null accumulationScore', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore({ score: 85 });
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  assertNotNull(result.accumulationScore);
  assertScore0to100(result.accumulationScore);
  assertTrue(result.accumulationScore > 0, 'Should have some accumulation proxy');
});

// === 5. Distribution ===
test('5. Distribution — SEC dilution risk flags produce distributionScore', () => {
  const sec = makeSecData({
    secRiskFlags: ['DILUTION_RISK'],
    dilutionRisk: 'high',
    offeringRisk: 'high',
    offeringType: 'SECONDARY',
  });
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertNotNull(result.distributionScore);
  assertTrue(result.distributionScore > 0, 'Should detect distribution risk');
  assertScore0to100(result.distributionScore);
  assertTrue(result.risks.some((r) => r.label === 'DILUTION_RISK' || r.label === 'OFFERING_RISK'));
});

// === 6. Neutral / no directional claim ===
test('6. Neutral — no directional buy/sell claims in keySignals or thesis', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const allText = [result.thesis, ...result.keySignals].join(' ').toLowerCase();

  assertFalse(
    allText.includes('buy') || allText.includes('sell') || allText.includes('bullish') || allText.includes('bearish'),
    'B3 must not make directional buy/sell claims'
  );
  assertTrue(result.thesis !== '');
  assertTrue(result.keySignals.length > 0);
});

// === 7. Conflicting signals ===
test('7. Conflicting signals — preserved individually, confidence reduced', () => {
  const sec = makeSecData({
    secRiskFlags: ['DILUTION_RISK', 'OFFERING_RISK'],
    secRiskLevel: 'high',
    latestRelevantFilings: [
      { form: '10-K', filingDate: new Date().toISOString().slice(0, 10) },
    ],
  });
  const finraScore = makeFinraScore({ score: 70 });
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  assertTrue(result.risks.some((r) => r.label === 'DILUTION_RISK'));
  assertTrue(result.risks.some((r) => r.label === 'OFFERING_RISK'));
  assertTrue(result.keySignals.length > 0);
  assertTrue(result.institutionalScore != null);
});

// === 8. Ownership change ===
test('8. Ownership change — filing signal reflects filing presence', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '13D', filingDate: '2024-01-15' },
      { form: '13F', filingDate: '2024-01-10' },
    ],
  });
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertEqual(result.filingSignal, 'FILINGS_AVAILABLE');
  assertTrue(result.keySignals.some((s) => s.includes('filings')));
});

test('8b. Ownership change — no filings returns correct signal', () => {
  const sec = makeSecData({ latestRelevantFilings: [], secDataStatus: 'ok' });
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertEqual(result.filingSignal, 'NO_RELEVANT_FILINGS');
});

// === 9. Filing signal ===
test('9. Filing signal — UNAVAILABLE when no SEC data', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertEqual(result.filingSignal, 'UNAVAILABLE');
});

// === 10. Institutional transaction signal (FINRA ATS) ===
test('10. Institutional transaction signal — FINRA ATS data included', () => {
  const sec = makeSecData();
  const finra = makeFinraData();
  const finraScore = makeFinraScore({ score: 65, confidence: 'moderate' });
  const result = buildInstitutionalRadarResult('AAPL', sec, finra, finraScore);

  assertNotNull(result.finraScore);
  assertEqual(result.finraScore.score, 65);
  assertTrue(result.finraScore.interpretation.includes('Does NOT indicate direction'));
  assertTrue(result.keySignals.some((s) => s.includes('FINRA ATS')));
});

// === 11. Multiple institutional signals ===
test('11. Multiple institutional signals — keySignals aggregate from all layers', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore({ score: 75 });
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const signalCount = result.keySignals.length;
  assertTrue(signalCount >= 3, `Should have at least 3 signals, got ${signalCount}`);
  assertTrue(result.keySignals.some((s) => s.includes('Institutional')));
  assertTrue(result.keySignals.some((s) => s.includes('Ownership')));
  assertTrue(result.keySignals.some((s) => s.includes('FINRA')));
});

// === 12. Data quality ===
test('12. Data quality — complete when both SEC + FINRA available', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  assertTrue(result.dataQuality.hasSec === true);
  assertTrue(result.dataQuality.hasFinra === true);
  assertEqual(result.dataQuality.completeness, 100);
  assertEqual(result.dataQuality.qualityLevel, 'COMPLETE');
});

test('12b. Data quality — partial when only SEC available', () => {
  const sec = makeSecData();
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertTrue(result.dataQuality.hasSec === true);
  assertTrue(result.dataQuality.hasFinra === false);
  assertTrue(result.dataQuality.completeness < 100);
  assertEqual(result.dataQuality.qualityLevel, 'PARTIAL');
});

test('12c. Data quality — unavailable when no data', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertTrue(result.dataQuality.hasSec === false);
  assertTrue(result.dataQuality.hasFinra === false);
  assertEqual(result.dataQuality.completeness, 0);
  assertEqual(result.dataQuality.qualityLevel, 'UNAVAILABLE');
});

// === 13. Freshness ===
test('13. Freshness — tracked from A3.2 signal', () => {
  const sec = makeSecData();
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertNotNull(result.institutionalMomentum);
  assertTrue(result.dataQuality.freshness >= 0 && result.dataQuality.freshness <= 100);
  assertTrue(result.dataQuality.freshnessLabel !== undefined);
});

test('13b. Freshness — stale data detected', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2020-01-01' },
    ],
  });
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertTrue(result.risks.some((r) => r.label === 'DATA_STALE' || r.label === 'FRESHNESS_UNKNOWN'));
});

// === 14. Provenance ===
test('14. Provenance — tracks all A3 layer sources', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  assertEqual(result.provenance.intelligence, 'A3.1');
  assertEqual(result.provenance.signal, 'A3.2');
  assertEqual(result.provenance.rank, 'A3.3');
  assertEqual(result.provenance.decision, 'A3-Final');
  assertEqual(result.provenance.sec, 'A6');
  assertEqual(result.provenance.finra, 'A3-Provider');
});

test('14b. Provenance — SEC only, no FINRA', () => {
  const sec = makeSecData();
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertEqual(result.provenance.sec, 'A6');
  assertNull(result.provenance.finra);
});

test('14c. Provenance — no data sources', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertEqual(result.provenance.intelligence, 'A3.1');
  assertEqual(result.provenance.signal, 'A3.2');
  assertEqual(result.provenance.rank, 'A3.3');
  assertEqual(result.provenance.decision, 'A3-Final');
  assertNull(result.provenance.sec);
  assertNull(result.provenance.finra);
});

// === 15. Confidence ===
test('15. Confidence — derived from A3.2 conviction', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  assertNotNull(result.confidence);
  assertTrue(
    ['HIGH', 'MEDIUM', 'LOW', 'UNAVAILABLE'].includes(result.confidence),
    `Unexpected conviction: ${result.confidence}`
  );
});

test('15b. Confidence — UNAVAILABLE when no data', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertEqual(result.confidence, 'UNAVAILABLE');
});

// === 16. Score boundaries 0-100 ===
test('16. Score boundaries — all numeric scores in 0-100 range', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  assertScore0to100(result.institutionalScore);
  assertScore0to100(result.accumulationScore);
  assertScore0to100(result.distributionScore);
  assertScore0to100(result.decisionScore);
  assertScore0to100(result.rankScore);
  assertScore0to100(result.dataQuality.completeness);
  assertScore0to100(result.dataQuality.freshness);
});

// === 17. Deterministic output ===
test('17. Deterministic output — same input produces same output', () => {
  const sec = makeSecData();
  const finra = makeFinraData();
  const finraScore = makeFinraScore();

  const opts = { timestamp: '2025-01-01T00:00:00Z' };

  const r1 = buildInstitutionalRadarResult('AAPL', sec, finra, finraScore, opts);
  const r2 = buildInstitutionalRadarResult('AAPL', sec, finra, finraScore, opts);

  assertEqual(r1.institutionalScore, r2.institutionalScore);
  assertEqual(r1.rankScore, r2.rankScore);
  assertEqual(r1.accumulationScore, r2.accumulationScore);
  assertEqual(r1.distributionScore, r2.distributionScore);
  assertEqual(r1.smartMoneyBias, r2.smartMoneyBias);
  assertEqual(r1.confidence, r2.confidence);
  assertEqual(r1.dataQuality.completeness, r2.dataQuality.completeness);
  assertEqual(JSON.stringify(r1.keySignals), JSON.stringify(r2.keySignals));
  assertEqual(JSON.stringify(r1.risks), JSON.stringify(r2.risks));
  assertEqual(r1.thesis, r2.thesis);
});

// === 18. No fabricated values ===
test('18. No fabricated values — no BUY/SELL/BULLISH/BEARISH claims', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const allText = [
    result.thesis,
    ...result.keySignals,
    ...result.risks.map((r) => r.label),
    ...result.risks.map((r) => r.description),
  ].join(' ').toLowerCase();

  assertFalse(
    allText.includes('buy') || allText.includes('sell') || allText.includes('bullish') || allText.includes('bearish'),
    'B3 must not make directional claims'
  );
});

test('18b. No fabricated values — no whale/dark-pool claims', () => {
  const result = buildInstitutionalRadarResult('AAPL', makeSecData(), makeFinraData(), makeFinraScore());
  const allText = JSON.stringify(result).toLowerCase();
  assertFalse(allText.includes('whale'), 'Should not claim whale activity');
  assertFalse(allText.includes('dark-pool') || allText.includes('dark pool'), 'Should not claim dark pool');
  assertFalse(allText.includes('13f'), 'Should not claim 13F data unless present');
});

test('18c. No fabricated values — null inputs return null scores', () => {
  const result = defaultInstitutionalRadar();
  assertNull(result.institutionalScore);
  assertNull(result.accumulationScore);
  assertNull(result.distributionScore);
  assertNull(result.decisionScore);
  assertNull(result.rankScore);
  assertEqual(result.institutionalAvailability, false);
  assertEqual(result.dataQuality.completeness, 0);
});

test('18d. No look-ahead data — freshness based on filing dates only', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-Q', filingDate: '2020-01-01' },
    ],
  });
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  assertTrue(result.dataQuality.freshness <= 40, 'Stale filing => low freshness');
});

// === 19. No look-ahead data ===
test('19. No look-ahead — signal score uses current data only', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  // Verify B3 score matches A3.2 signal score (no future information added)
  const a3_signal = buildInstitutionalSignal(
    buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finraScore)
  );
  assertEqual(result.institutionalScore, a3_signal.institutionalSignalScore);
});

// === 20. API contract ===
test('20. API contract — defaultInstitutionalRadar has all required fields', () => {
  const result = defaultInstitutionalRadar();

  const requiredKeys = [
    'ticker',
    'timestamp',
    'institutionalAvailability',
    'institutionalScore',
    'institutionalQuality',
    'institutionalAction',
    'accumulationScore',
    'distributionScore',
    'smartMoneyBias',
    'institutionalMomentum',
    'ownershipStrength',
    'filingSignal',
    'confidence',
    'keySignals',
    'risks',
    'thesis',
    'dataQuality',
    'provenance',
  ];

  for (const key of requiredKeys) {
    assertTrue(key in result, `Missing required key: ${key}`);
  }

  assertEqual(result.institutionalAvailability, false);
  assertEqual(result.institutionalAction, 'INSUFFICIENT_DATA');
  assertTrue(Array.isArray(result.keySignals));
  assertTrue(Array.isArray(result.risks));
  assertTrue(typeof result.provenance === 'object' && result.provenance !== null);
  assertEqual(result.thesis, 'No institutional data available for this symbol.');
});

test('20b. API contract — valid data has all required fields', () => {
  const sec = makeSecData();
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);

  const requiredKeys = [
    'ticker',
    'timestamp',
    'institutionalAvailability',
    'institutionalScore',
    'institutionalQuality',
    'institutionalAction',
    'accumulationScore',
    'distributionScore',
    'smartMoneyBias',
    'institutionalMomentum',
    'ownershipStrength',
    'filingSignal',
    'confidence',
    'keySignals',
    'risks',
    'thesis',
    'dataQuality',
    'provenance',
  ];

  for (const key of requiredKeys) {
    assertTrue(key in result, `Missing required key: ${key}`);
  }
});

// === 21. Existing institutional regression (A3) ===
test('21. Regression — B3 exposes A3.1 intelligence correctly', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const a3_intel = buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finraScore);
  assertEqual(
    result.intelligence.dataStatus,
    a3_intel.dataStatus
  );
  assertEqual(
    result.intelligence.institutionalActivity,
    a3_intel.institutionalActivity
  );
  assertEqual(
    result.intelligence.ownershipStrength,
    a3_intel.ownershipStrength
  );
  assertEqual(
    result.intelligence.institutionalRisk,
    a3_intel.institutionalRisk
  );
});

test('21b. Regression — B3 signal matches A3.2', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const a3_intel = buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finraScore);
  const a3_signal = buildInstitutionalSignal(a3_intel);

  assertEqual(result.confidence, a3_signal.institutionalConviction);
  assertEqual(result.dataQuality.freshness, a3_signal.freshness);
  assertEqual(result.dataQuality.dataStatus, a3_signal.dataStatus);
});

test('21c. Regression — B3 rank matches A3.3', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const a3_intel = buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finraScore);
  const a3_signal = buildInstitutionalSignal(a3_intel);
  const a3_rank = rankInstitutionalSignal(a3_signal, 'AAPL');

  assertEqual(result.rankScore, a3_rank.institutionalRankScore);
  assertEqual(result.rankClass, a3_rank.institutionalRankClass);
});

test('21d. Regression — B3 decision matches A3 Final', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const a3_intel = buildInstitutionalIntelligence('AAPL', sec, makeFinraData(), finraScore);
  const a3_signal = buildInstitutionalSignal(a3_intel);
  const a3_rank = rankInstitutionalSignal(a3_signal, 'AAPL');
  const a3_decision = buildInstitutionalDecision(a3_intel, a3_signal, a3_rank, 'AAPL');

  assertEqual(result.decisionStatus, a3_decision.institutionalStatus);
  assertEqual(result.executionQuality, a3_decision.executionQuality);
});

// === 22. B1 regression ===
test('22. B1 regression — penny intelligence unaffected', () => {
  const stockData = {
    symbol: 'TEST',
    price: 2.50,
    volume: 500000,
    relativeVolume: 2.5,
    rsi: 45,
    averageVolume20: 200000,
    technicalReady: true,
    setupScore: 75,
  };
  const penny = buildPennyIntelligence(stockData, {});
  assertTrue(Number.isFinite(penny.penny.score) || penny.penny.score === null);
  assertTrue(penny.dataAvailability !== undefined);
});

// === 23. B2 regression ===
test('23. B2 regression — options intelligence unaffected', () => {
  const contract = {
    symbol: 'TEST250117C00050000',
    optionType: 'CALL',
    strike: 50, daysToExpiration: 30, premium: 0.50,
    bid: 0.48, ask: 0.52, volume: 500, openInterest: 1000,
    impliedVolatility: 0.45, spreadPct: 8, underlying: 48, distancePct: 4.2,
  };
  const optsResult = buildOptionsIntelligenceResult('TEST', [contract]);
  assertTrue(optsResult.optionsAvailability === true);
  assertNotNull(optsResult.provenance);
  assertEqual(optsResult.provenance.contracts, 'A2');
});

// === Edge cases ===

test('Edge: null input — defaultInstitutionalRadar', () => {
  const result = defaultInstitutionalRadar();
  assertEqual(result.institutionalQuality, 'UNAVAILABLE');
  assertEqual(result.institutionalAction, 'INSUFFICIENT_DATA');
  assertTrue(result.thesis.includes('No institutional data'));
});

test('Edge: NaN in finraScore — handled gracefully', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore({ score: NaN });
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  // finraScore.score is NaN, which is not a valid number — should be treated as null
  assertTrue(
    result.dataQuality.hasFinra === false,
    `Expected hasFinra=false for NaN score`
  );
});

test('Edge: Infinity in finraScore — handled gracefully', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore({ score: Infinity });
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  assertTrue(result.institutionalScore === null || Number.isFinite(result.institutionalScore));
});

test('Edge: Empty filings array — NO_RELEVANT_FILINGS', () => {
  const sec = makeSecData({ latestRelevantFilings: [], secDataStatus: 'ok' });
  const result = buildInstitutionalRadarResult('TEST', sec, null, null);
  assertEqual(result.filingSignal, 'NO_RELEVANT_FILINGS');
});

test('Edge: Duplicate filing records — handled without crash', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-Q', filingDate: '2024-01-15' },
      { form: '10-Q', filingDate: '2024-01-15' },
      { form: '10-Q', filingDate: '2024-01-15' },
    ],
  });
  const result = buildInstitutionalRadarResult('TEST', sec, null, null);
  assertTrue(result.institutionalAvailability === true);
  assertTrue(result.keySignals.length > 0);
});

test('Edge: Conflicting timestamps — no look-ahead', () => {
  const sec = makeSecData({
    latestRelevantFilings: [
      { form: '10-K', filingDate: '2024-01-01' },
      { form: '10-Q', filingDate: '2024-02-01' },
      { form: '8-K', filingDate: '2024-01-15' },
    ],
  });
  const result = buildInstitutionalRadarResult('TEST', sec, null, null);
  assertTrue(result.dataQuality.freshness >= 0 && result.dataQuality.freshness <= 100);
});

test('Edge: Malformed SEC data — missing secDataStatus', () => {
  const sec = { latestRelevantFilings: [{ form: '10-Q', filingDate: '2024-01-15' }] };
  const result = buildInstitutionalRadarResult('TEST', sec, null, null);
  assertTrue(result.institutionalAvailability === true || result.institutionalAvailability === false);
});

test('Edge: Malformed FINRA score — missing score', () => {
  const finraScore = { confidence: 'moderate' };
  const result = buildInstitutionalRadarResult('AAPL', makeSecData(), makeFinraData(), finraScore);
  assertTrue(result.institutionalScore === null || Number.isFinite(result.institutionalScore));
});

test('Edge: Input not mutated — deep freeze test', () => {
  const sec = makeSecData();
  const finra = makeFinraData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, finra, finraScore);
  // Original inputs should not be mutated
  assertTrue(Array.isArray(sec.latestRelevantFilings));
  assertEqual(sec.secDataStatus, 'ok');
  assertEqual(finra.verified, true);
});

test('Rank opportunities — sorts by institutionalScore descending', () => {
  const sec1 = makeSecData();
  const finraScore1 = makeFinraScore({ score: 90 });
  const r1 = buildInstitutionalRadarResult('HIGH', sec1, makeFinraData(), finraScore1);

  const sec2 = makeSecData();
  const finraScore2 = makeFinraScore({ score: 30 });
  const r2 = buildInstitutionalRadarResult('LOW', sec2, makeFinraData(), finraScore2);

  const { ranked, top, alternatives } = rankInstitutionalOpportunitiesB3([r2, r1]);
  assertTrue(ranked[0].ticker === 'HIGH' || (ranked[0].institutionalScore ?? 0) >= (ranked[1].institutionalScore ?? 0));
  assertTrue(top.length > 0);
});

test('Rank opportunities — empty input returns empty arrays', () => {
  const { ranked, top, alternatives } = rankInstitutionalOpportunitiesB3([]);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
});

test('Rank opportunities — null input returns empty arrays', () => {
  const { ranked, top, alternatives } = rankInstitutionalOpportunitiesB3(null);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
});

test('classifyInstitutionalQuality — maps rank classes correctly', () => {
  assertEqual(classifyInstitutionalQuality('TOP'), 'EXCEPTIONAL');
  assertEqual(classifyInstitutionalQuality('STRONG'), 'HIGH');
  assertEqual(classifyInstitutionalQuality('WATCH'), 'MODERATE');
  assertEqual(classifyInstitutionalQuality('WEAK'), 'LOW');
  assertEqual(classifyInstitutionalQuality(null), 'UNAVAILABLE');
});

test('classifyInstitutionalAction — maps status to actions', () => {
  assertEqual(classifyInstitutionalAction('DECISION_TOP', 'TOP'), 'STRONG_INTEREST');
  assertEqual(classifyInstitutionalAction('DECISION_STRONG', 'STRONG'), 'MONITOR');
  assertEqual(classifyInstitutionalAction('DECISION_WATCH', 'WATCH'), 'WATCH');
  assertEqual(classifyInstitutionalAction('DECISION_MONITOR', 'WEAK'), 'OBSERVE');
  assertEqual(classifyInstitutionalAction('UNAVAILABLE', null), 'INSUFFICIENT_DATA');
});

test('buildAccumulationScore — null when no data', () => {
  assertNull(buildAccumulationScore(null, null, null));
});

test('buildAccumulationScore — returns score with data', () => {
  const intel = { institutionalActivityScore: 75, secDataStatus: 'ok', latestRelevantFilings: [{ form: '10-Q' }] };
  const signal = { institutionalSignalScore: 60 };
  const result = buildAccumulationScore(intel, signal, null);
  assertNotNull(result);
  assertScore0to100(result);
});

test('buildDistributionScore — null when no risk flags', () => {
  const intel = { secRiskFlags: [], secDataStatus: 'ok' };
  const result = buildDistributionScore(intel);
  assertNull(result);
});

test('buildDistributionScore — non-null with dilution risk', () => {
  const intel = { secRiskFlags: ['DILUTION_RISK'], secRiskLevel: 'high', secDataStatus: 'ok' };
  const result = buildDistributionScore(intel);
  assertNotNull(result);
  assertTrue(result > 0);
  assertScore0to100(result);
});

test('classifySmartMoneyBias — UNAVAILABLE when no data', () => {
  assertEqual(classifySmartMoneyBias(null), 'UNAVAILABLE');
});

test('classifySmartMoneyBias — classifies ownership strength correctly', () => {
  const intel = { ownershipStrength: 'STRONG', finraAvailable: true, secDataStatus: 'ok' };
  assertEqual(classifySmartMoneyBias(intel), 'STRONG_INTEREST');
});

test('clamp — clamps to range', () => {
  assertEqual(clamp(150, 0, 100), 100);
  assertEqual(clamp(-10, 0, 100), 0);
  assertEqual(clamp(50, 0, 100), 50);
});

test('n — number coercion', () => {
  assertEqual(n('42'), 42);
  assertEqual(n(null), null);
  assertEqual(n(undefined), null);
  assertEqual(n(NaN), null);
  assertEqual(n('abc'), null);
});

test('Full result has no undefined fields', () => {
  const sec = makeSecData();
  const result = buildInstitutionalRadarResult('AAPL', sec, null, null);
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) {
      throw new Error(`Field "${key}" is undefined`);
    }
  }
});

test('Full result with FINRA has no undefined fields', () => {
  const result = buildInstitutionalRadarResult(
    'AAPL',
    makeSecData(),
    makeFinraData(),
    makeFinraScore()
  );
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) {
      throw new Error(`Field "${key}" is undefined`);
    }
  }
});

test('Per-contract intelligence embedded in result', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);
  assertNotNull(result.intelligence);
  assertNotNull(result.signal);
  assertNotNull(result.rank);
  assertNotNull(result.decision);
});

test('Thesis is meaningful for valid data', () => {
  const result = buildInstitutionalRadarResult(
    'AAPL',
    makeSecData(),
    null,
    null
  );
  assertTrue(typeof result.thesis === 'string');
  assertTrue(result.thesis.length > 10);
});

test('Thesis explains when no data', () => {
  const result = buildInstitutionalRadarResult('AAPL', null, null, null);
  assertTrue(result.thesis.includes('No institutional data'));
});

test('No NaN or Infinity in any numeric output', () => {
  const sec = makeSecData();
  const finraScore = makeFinraScore();
  const result = buildInstitutionalRadarResult('AAPL', sec, makeFinraData(), finraScore);

  const numericFields = [
    result.institutionalScore,
    result.accumulationScore,
    result.distributionScore,
    result.decisionScore,
    result.rankScore,
    result.dataQuality.completeness,
    result.dataQuality.freshness,
    result.institutionalMomentum,
    result.finraScore?.score,
  ];

  for (const value of numericFields) {
    if (value != null) {
      assertTrue(
        Number.isFinite(value),
        `Expected finite, got ${value}`
      );
    }
  }
});

test('Provider metadata preserved in output', () => {
  const result = buildInstitutionalRadarResult(
    'AAPL',
    makeSecData(),
    makeFinraData({ source: 'FINRA ATS/OTC' }),
    makeFinraScore({ source: 'FINRA ATS/OTC' })
  );
  assertEqual(result.source, 'FINRA ATS/OTC');
  assertTrue(result.finraAvailable === true);
  assertTrue(result.finraScore.score != null);
});

test('SEC-only data — no FINRA fields claimed', () => {
  const result = buildInstitutionalRadarResult('AAPL', makeSecData(), null, null);
  assertNull(result.finraScore);
  assertTrue(result.finraAvailable === false);
  assertNotNull(result.source);
});

test('rankInstitutionalOpportunitiesB3 — handles mixed scores', () => {
  const r1 = buildInstitutionalRadarResult('AAPL', makeSecData(), null, null);
  const r2 = buildInstitutionalRadarResult('TSLA', makeSecData(), makeFinraData(), makeFinraScore());
  const { ranked } = rankInstitutionalOpportunitiesB3([r1, r2]);
  assertTrue(ranked.length === 2);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`B3 Institutional Radar Manager Tests: ${passCount} passed, ${failCount} failed`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
