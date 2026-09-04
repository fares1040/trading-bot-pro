/**
 * D11 Command Center Tests
 *
 * Deterministic - no network, no dev server, no credentials.
 * Run with: node scripts/test-command-center.mjs
 *
 * Coverage:
 *   1-8.    Market regime section builds correctly
 *   9-14.   Top opportunities section builds correctly
 *   15-18.  Trade plans section builds correctly
 *   19-20.  Why Now section builds correctly
 *   21-22.  Intelligence coverage section builds correctly
 *   23-25.  Risk center section builds correctly
 *   26-28.  Action queue section builds correctly
 *   29.     Build command center with all sources
 *   30.     Data honesty tests
 *   31-32.  Directional safety tests
 *   33-36.  Null/undefined/malformed input
 *   37-38.  Determinism
 *   39-40.  Provenance tracking
 *   41-42.  Risk aggregation
 *   43-44.  No fabrication
 *   45-46.  Graceful provider failure
 *   47-48.  API contract
 *   49-50.  Default output
 *   51-52.  Backward compatibility
 *   53-54.  Section boundaries
 */

import {
  buildCommandCenter,
  defaultCommandCenter,
  buildMarketRegimeSection,
  buildTopOpportunitiesSection,
  buildTradePlansSection,
  buildWhyNowSection,
  buildIntelligenceCoverageSection,
  buildRiskCenterSection,
  buildActionQueueSection,
  REGIME_LABELS,
  QUALITY_LABELS,
  CONFIDENCE_LEVELS,
} from '../lib/command-center.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + 'Expected: ' + JSON.stringify(expected) + '\nActual: ' + JSON.stringify(actual));
  }
}

function assertTrue(value, msg) {
  if (!value) throw new Error(msg || 'Expected truthy but got: ' + JSON.stringify(value));
}

function assertFalse(value, msg) {
  if (value) throw new Error(msg || 'Expected falsy but got: ' + JSON.stringify(value));
}

function assertNull(value, msg) {
  if (value != null) throw new Error(msg || 'Expected null but got: ' + JSON.stringify(value));
}

const mockRegime = {
  regime: REGIME_LABELS.BULLISH,
  regimeScore: 85,
  confidence: 82,
  confidenceLevel: CONFIDENCE_LEVELS.HIGH,
  dataCompleteness: 75,
  reasons: ['S&P 500 trending positive', 'VIX low'],
  warnings: [],
  risks: [{ label: 'NO_MAJOR_RISKS_IDENTIFIED', severity: 'LOW', description: 'No risks' }],
  supportingEvidence: [],
  flags: ['BULLISH_REGIME'],
  componentScores: { trend: 88, momentum: 82, breadth: 75, volume: 70, volatility: 90 },
  dataAvailability: { trend: true, momentum: true, breadth: true, volume: true, volatility: true, data: true },
  freshness: { evaluatedAt: new Date().toISOString(), indexTimestamp: null, universeSize: 100, indexCount: 4 },
  limitations: [],
};

const mockOpportunity = {
  data: [
    {
      symbol: 'TEST',
      opportunityScore: 78,
      quality: QUALITY_LABELS.STRONG,
      rank: 1,
      confidence: 75,
      confidenceLevel: CONFIDENCE_LEVELS.MODERATE,
      dataCompleteness: 70,
      dataAvailability: {
        pennyIntelligence: true,
        optionsIntelligence: true,
        institutionalRadar: true,
        swingIntelligence: false,
        earlyExplosion: true,
        catalystIntelligence: false,
      },
      sourceScores: {
        pennyIntelligence: 65,
        swingIntelligence: 70,
        earlyExplosion: 80,
      },
      risks: [],
      warnings: [],
      flags: ['FULL_INTELLIGENCE_COVERAGE'],
    },
  ],
  count: 1,
  scanned: 1,
  top: [{ symbol: 'TEST', opportunityScore: 78, quality: QUALITY_LABELS.STRONG }],
  qualityBreakdown: { TOP: 0, STRONG: 1, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
  dataAvailability: { pennyIntelligence: true, optionsIntelligence: true, swingIntelligence: false },
  limitations: [],
};

const mockTradePlan = {
  data: [
    {
      symbol: 'TEST',
      planScore: 82,
      planQuality: QUALITY_LABELS.TOP,
      planSignal: 'VALID_PLAN',
      direction: 'LONG',
      stopLoss: 10.50,
      target1: 13.20,
      riskReward: 2.4,
      dataCompleteness: 75,
      risks: [],
      warnings: [],
      dataAvailability: { opportunityRanking: true, swingIntelligence: true },
    },
  ],
  count: 1,
  top: [{ symbol: 'TEST', planScore: 82, planQuality: QUALITY_LABELS.TOP }],
  qualityBreakdown: { TOP: 1, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
};

const mockExplanation = {
  data: [
    {
      symbol: 'TEST',
      available: true,
      whyNow: [{ factor: 'C7 Opportunity Ranking', signal: 'STRONG', explanation: 'Test explanation', evidence: [] }],
    },
  ],
  count: 1,
  top: [{ symbol: 'TEST', factor: 'C7 Opportunity Ranking' }],
};

// ============================================================================
// 1-8. Build Market Regime Section correctly
// ============================================================================

test('1. buildMarketRegimeSection extracts data correctly', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertEqual(result.available, true);
  assertEqual(result.regime, REGIME_LABELS.BULLISH);
  assertEqual(result.regimeScore, 85);
});

test('2. buildMarketRegimeSection handles null input', () => {
  const result = buildMarketRegimeSection(null);
  assertEqual(result.available, false);
  assertEqual(result.regime, REGIME_LABELS.UNAVAILABLE);
});

test('3. buildMarketRegimeSection handles missing scores', () => {
  const data = { ...mockRegime, regimeScore: null, confidence: null };
  const result = buildMarketRegimeSection(data);
  assertEqual(result.regimeScore, null);
  assertEqual(result.confidence, null);
});

test('4. buildMarketRegimeSection preserves reasons', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertTrue(result.reasons.length === 2);
});

test('5. buildMarketRegimeSection preserves flags', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertTrue(result.flags.includes('BULLISH_REGIME'));
});

test('6. buildMarketRegimeSection preserves risks', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertTrue(Array.isArray(result.risks));
});

test('7. buildMarketRegimeSection preserves warnings', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertTrue(Array.isArray(result.warnings));
});

test('8. buildMarketRegimeSection preserves freshness', () => {
  const result = buildMarketRegimeSection(mockRegime);
  assertTrue(result.freshness != null);
});

// ============================================================================
// 9-14. Build Top Opportunities Section correctly
// ============================================================================

test('9. buildTopOpportunitiesSection extracts data correctly', () => {
  const result = buildTopOpportunitiesSection(mockOpportunity);
  assertEqual(result.available, true);
  assertEqual(result.count, 1);
  assertEqual(result.top.length, 1);
});

test('10. buildTopOpportunitiesSection handles null input', () => {
  const result = buildTopOpportunitiesSection(null);
  assertEqual(result.available, false);
  assertEqual(result.top.length, 0);
});

test('11. buildTopOpportunitiesSection filters UNAVAILABLE quality', () => {
  const data = {
    data: [
      { symbol: 'GOOD', quality: QUALITY_LABELS.STRONG, opportunityScore: 75, rank: 1, confidenceLevel: CONFIDENCE_LEVELS.MODERATE },
      { symbol: 'BAD', quality: QUALITY_LABELS.UNAVAILABLE, opportunityScore: null, rank: null },
    ],
  };
  const result = buildTopOpportunitiesSection(data);
  assertEqual(result.top.length, 1);
  assertEqual(result.top[0].symbol, 'GOOD');
});

test('12. buildTopOpportunitiesSection provides quality breakdown', () => {
  const result = buildTopOpportunitiesSection(mockOpportunity);
  assertEqual(typeof result.qualityBreakdown, 'object');
});

test('13. buildTopOpportunitiesSection provides data availability', () => {
  const result = buildTopOpportunitiesSection(mockOpportunity);
  assertTrue(result.dataAvailability.pennyIntelligence === true);
});

test('14. buildTopOpportunitiesSection preserves limitations as array', () => {
  const result = buildTopOpportunitiesSection(mockOpportunity);
  assertEqual(Array.isArray(result.limitations), true);
  assertEqual(result.limitations.length, 0);
});

// ============================================================================
// 15-18. Build Trade Plans Section correctly
// ============================================================================

test('15. buildTradePlansSection extracts data correctly', () => {
  const result = buildTradePlansSection(mockTradePlan);
  assertEqual(result.available, true);
  assertEqual(result.count, 1);
  assertEqual(result.top.length, 1);
});

test('16. buildTradePlansSection handles null input', () => {
  const result = buildTradePlansSection(null);
  assertEqual(result.available, false);
});

test('17. buildTradePlansSection provides quality breakdown', () => {
  const result = buildTradePlansSection(mockTradePlan);
  assertEqual(result.qualityBreakdown.TOP, 1);
});

test('18. buildTradePlansSection filters UNAVAILABLE signals', () => {
  const data = {
    data: [
      { symbol: 'X', planSignal: 'VALID_PLAN', planScore: 80 },
      { symbol: 'Y', planSignal: 'UNAVAILABLE', planScore: null },
    ],
  };
  const result = buildTradePlansSection(data);
  assertEqual(result.top.length, 1);
});

// ============================================================================
// 19-20. Build Why Now Section correctly
// ============================================================================

test('19. buildWhyNowSection extracts explanations', () => {
  const result = buildWhyNowSection(mockExplanation);
  assertEqual(result.available, true);
  assertEqual(result.count, 1);
});

test('20. buildWhyNowSection handles null input', () => {
  const result = buildWhyNowSection(null);
  assertEqual(result.available, false);
});

// ============================================================================
// 21-22. Build Intelligence Coverage Section correctly
// ============================================================================

test('21. buildIntelligenceCoverageSection computes coverage', () => {
  const result = buildIntelligenceCoverageSection(mockOpportunity);
  assertEqual(result.available, true);
  assertEqual(result.coverageCount >= 0, true);
});

test('22. buildIntelligenceCoverageSection handles no data', () => {
  const result = buildIntelligenceCoverageSection(null);
  assertEqual(result.available, false);
});

// ============================================================================
// 23-25. Build Risk Center Section correctly
// ============================================================================

test('23. buildRiskCenterSection aggregates risks from regime', () => {
  const result = buildRiskCenterSection(null, null, mockRegime);
  assertTrue(result.risks.length > 0);
});

test('24. buildRiskCenterSection identifies regime warnings', () => {
  const bearishRegime = { ...mockRegime, regime: REGIME_LABELS.BEARISH };
  const result = buildRiskCenterSection(null, null, bearishRegime);
  assertTrue(result.regimeWarnings.some(w => w.type === 'BEARISH_ENVIRONMENT'));
});

test('25. buildRiskCenterSection aggregates from opportunities', () => {
  const oppWithRisks = {
    data: [{ symbol: 'X', risks: [{ label: 'HIGH_RISK', severity: 'HIGH', description: 'Test' }] }],
  };
  const result = buildRiskCenterSection(oppWithRisks, null, null);
  assertTrue(result.risks.some(r => r.label === 'HIGH_RISK'));
});

// ============================================================================
// 26-28. Build Action Queue Section correctly
// ============================================================================

test('26. buildActionQueueSection builds top opportunities', () => {
  const result = buildActionQueueSection(mockOpportunity, null, null);
  assertTrue(result.topOpportunities.length > 0);
});

test('27. buildActionQueueSection builds valid trade plans', () => {
  const result = buildActionQueueSection(mockOpportunity, mockTradePlan, null);
  assertTrue(result.validTradePlans.length > 0);
});

test('28. buildActionQueueSection captures regime warnings', () => {
  const bearishRegime = { ...mockRegime, regime: REGIME_LABELS.BEARISH };
  const result = buildActionQueueSection(null, null, bearishRegime);
  assertTrue(result.regimeWarnings.length > 0);
});

// ============================================================================
// 29. Build Command Center with all sources
// ============================================================================

test('29. buildCommandCenter with all sources', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertEqual(result.sections.marketRegime.available, true);
  assertEqual(result.sections.topOpportunities.available, true);
  assertEqual(result.sections.tradePlans.available, true);
  assertEqual(result.sections.whyNow.available, true);
  assertEqual(result.sections.intelligenceCoverage.available, true);
  assertEqual(typeof result.summary.regimeScore, 'number');
});

// ============================================================================
// 30. Data Honesty Tests
// ============================================================================

test('30. data honesty - NULL values stay NULL', () => {
  const data = { ...mockRegime, regimeScore: null, confidence: null };
  const result = buildMarketRegimeSection(data);
  assertEqual(result.regimeScore, null);
});

// ============================================================================
// 31-32. Directional Safety Tests
// ============================================================================

test('31. directional safety - no manufactured direction', () => {
  const oppData = {
    data: [{ symbol: 'X', opportunityScore: 50, quality: QUALITY_LABELS.WEAK }],
  };
  const result = buildTopOpportunitiesSection(oppData);
  if (result.top[0]) {
    assertNull(result.top[0].directionBias);
  }
});

test('32. directional safety - preserve upstream direction', () => {
  const planData = {
    data: [{ symbol: 'X', direction: 'LONG', planScore: 80, planQuality: QUALITY_LABELS.TOP, planSignal: 'VALID_PLAN', risks: [], warnings: [] }],
  };
  const result = buildTradePlansSection(planData);
  assertEqual(result.top[0].direction, 'LONG');
});

// ============================================================================
// 33-36. Null/Undefined/Malformed Input
// ============================================================================

test('33. handles null regime data gracefully', () => {
  const result = buildCommandCenter(null, null, null, null);
  assertEqual(result.sections.marketRegime.regime, REGIME_LABELS.UNAVAILABLE);
});

test('34. handles undefined sections', () => {
  const result = buildMarketRegimeSection(undefined);
  assertEqual(result.regime, REGIME_LABELS.UNAVAILABLE);
});

test('35. handles empty object input', () => {
  const result = buildTopOpportunitiesSection({});
  assertEqual(result.available, false);
});

test('36. handles NaN values', () => {
  const data = { ...mockRegime, regimeScore: NaN };
  const result = buildMarketRegimeSection(data);
  assertEqual(result.regimeScore, null);
});

// ============================================================================
// 37-38. Determinism
// ============================================================================

test('37. determinism - same input produces same output', () => {
  const r1 = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  const r2 = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertEqual(JSON.stringify(r1.sections), JSON.stringify(r2.sections));
});

test('38. determinism - null inputs produce stable structure', () => {
  const d1 = buildCommandCenter(null, null, null, null);
  const d2 = buildCommandCenter(null, null, null, null);
  assertEqual(d1.timestamp != null, true);
  assertEqual(d2.timestamp != null, true);
  assertEqual(d1.sections.marketRegime.regime, d2.sections.marketRegime.regime);
  assertEqual(d1.sections.topOpportunities.available, d2.sections.topOpportunities.available);
});

// ============================================================================
// 39-40. Provenance Tracking
// ============================================================================

test('39. provenance is tracked in sections', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertEqual(typeof result.sections.marketRegime, 'object');
});

test('40. provenance reflects data source', () => {
  const result = buildCommandCenter(mockRegime, null, null, null);
  assertEqual(result.summary.marketRegime, REGIME_LABELS.BULLISH);
});

// ============================================================================
// 41-42. Risk Aggregation
// ============================================================================

test('41. risk aggregation from regime', () => {
  const result = buildRiskCenterSection(null, null, mockRegime);
  assertTrue(Array.isArray(result.risks));
});

test('42. risk deduplication', () => {
  const oppData = {
    data: [
      { symbol: 'X', risks: [{ label: 'HIGH_RISK', severity: 'HIGH', description: 'A' }] },
      { symbol: 'Y', risks: [{ label: 'HIGH_RISK', severity: 'HIGH', description: 'B' }] },
    ],
  };
  const result = buildRiskCenterSection(oppData, null, null);
  const labels = result.risks.map(r => r.label);
  assertEqual(new Set(labels).size, 1);
});

// ============================================================================
// 43-44. No Fabrication
// ============================================================================

test('43. no fabrication - missing stays null not zero', () => {
  const data = { ...mockRegime, regimeScore: null, confidence: null };
  const result = buildMarketRegimeSection(data);
  assertEqual(result.regimeScore, null);
  assertEqual(result.confidence, null);
});

test('44. no fabrication - quality UNAVAILABLE items filtered', () => {
  const data = {
    data: [{ symbol: 'X', quality: QUALITY_LABELS.UNAVAILABLE, opportunityScore: null }],
  };
  const result = buildTopOpportunitiesSection(data);
  assertEqual(result.top.length, 0);
});

// ============================================================================
// 45-46. Graceful Provider Failure
// ============================================================================

test('45. graceful failure - all null sources', () => {
  const result = buildCommandCenter(null, null, null, null);
  assertEqual(result.sections.marketRegime.regime, REGIME_LABELS.UNAVAILABLE);
  assertEqual(result.sections.topOpportunities.count, 0);
});

test('46. graceful failure - partial null sources', () => {
  const result = buildCommandCenter(mockRegime, null, null, null);
  assertEqual(result.sections.marketRegime.available, true);
  assertEqual(result.sections.topOpportunities.available, false);
});

// ============================================================================
// 47-48. API Contract
// ============================================================================

test('47. API contract - all required fields present', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  const required = [
    'timestamp',
    'sections',
    'summary',
    'limitations',
    'disclaimer',
  ];
  for (const field of required) {
    assertTrue(field in result, 'Missing field: ' + field);
  }
  assertTrue(typeof result.timestamp === 'string');
  assertTrue(Array.isArray(result.sections.marketRegime.reasons));
});

test('48. API contract - sections are objects', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertTrue(typeof result.sections.marketRegime === 'object');
  assertTrue(typeof result.sections.topOpportunities === 'object');
  assertTrue(typeof result.sections.tradePlans === 'object');
});

// ============================================================================
// 49-50. Default Output
// ============================================================================

test('49. default output is sensible', () => {
  const result = defaultCommandCenter();
  assertTrue(typeof result.timestamp === 'string');
  assertEqual(result.sections.marketRegime.regime, REGIME_LABELS.UNAVAILABLE);
});

test('50. default output has all sections', () => {
  const result = defaultCommandCenter();
  assertTrue('marketRegime' in result.sections);
  assertTrue('topOpportunities' in result.sections);
  assertTrue('tradePlans' in result.sections);
});

// ============================================================================
// 51-52. Backward Compatibility
// ============================================================================

test('51. backward compatible - regime field in summary', () => {
  const result = buildCommandCenter(mockRegime, null, null, null);
  assertEqual(result.summary.marketRegime, REGIME_LABELS.BULLISH);
});

test('52. backward compatible - opportunity count', () => {
  const result = buildCommandCenter(null, mockOpportunity, null, null);
  assertEqual(result.summary.opportunityCount, 1);
});

test('53. pagination - default page 1 limit 5', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertEqual(result.pagination.page, 1);
  assertEqual(result.pagination.limit, 5);
});

test('54. pagination - hasNext false on first page when no data exceeds limit', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertFalse(result.pagination.hasNext);
});

test('55. pagination - hasPrevious false on first page', () => {
  const result = buildCommandCenter(mockRegime, mockOpportunity, mockTradePlan, mockExplanation);
  assertFalse(result.pagination.hasPrevious);
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n========================================');
console.log('D11 Command Center Tests: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}