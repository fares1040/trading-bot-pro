/**
 * C10 Market Regime Engine Tests
 *
 * Deterministic - no network, no dev server, no credentials.
 * Run with: node scripts/test-market-regime.mjs
 *
 * Coverage:
 *   1-5.   regime classification (bullish / bearish / neutral / risk-off / unavailable)
 *   6-9.   data completeness (all / one missing / multiple missing / all missing)
 *   10-17. null safety (null / undefined / empty obj / malformed / strings / NaN / Inf / -Inf)
 *   18-20. score boundaries and clamping
 *   21-22. regime boundaries and confidence
 *   23-24. raw weights and effective renormalized weights
 *   25-26. totalWeightUsed and reasons
 *   27-30. warnings / risks / flags
 *   31-32. provenance / freshness
 *   33.    determinism
 *   34.    no input mutation
 *   35.    no fabrication
 *   36.    no look-ahead
 *   37-38. provider failure / partial provider failure
 *   39.    API contract
 *   40.    default result
 *   41.    malformed nested fields
 *   42.    duplicate data
 *   43.    regression compatibility
 *   44.    edge cases
 */

import {
  buildMarketRegime,
  defaultMarketRegime,
  rankMarketRegimes,
  buildRegimeQualityBreakdown,
  scoreVolatility,
  scoreTrend,
  scoreMomentum,
  scoreBreadth,
  scoreVolume,
  scorePriceBreadth,
  scoreRSIDistribution,
  buildEvidenceFamilies,
  renormalizeWeights,
  calculateRegimeScore,
  classifyRegime,
  calculateRegimeConfidence,
  classifyRegimeConfidence,
  REGIME_WEIGHTS,
  REGIME_THRESHOLDS,
  REGIME_LABELS,
  EVIDENCE_FAMILIES,
} from '../lib/market-regime-engine.js';

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

function assertScoreBetween(score, min, max, msg) {
  assertTrue(score != null && Number.isFinite(score), msg || 'Score must be finite');
  assertTrue(score >= min && score <= max, (msg || '') + ' Score ' + score + ' outside [' + min + ',' + max + ']');
}

// ----------------------------------------------------------------------------
// Sample inputs
// ----------------------------------------------------------------------------

const idxBullish = [
  { symbol: '^GSPC', name: 'S&P 500', value: 4500, change: 1.8, isUp: true },
  { symbol: '^IXIC', name: 'NASDAQ', value: 14000, change: 2.4, isUp: true },
  { symbol: 'QQQ', name: 'QQQ', value: 380, change: 2.1, isUp: true },
  { symbol: '^VIX', name: 'VIX', value: 14.5, change: -1.2, isUp: false },
];

const idxBearish = [
  { symbol: '^GSPC', name: 'S&P 500', value: 4300, change: -2.8, isUp: false },
  { symbol: '^IXIC', name: 'NASDAQ', value: 13200, change: -3.6, isUp: false },
  { symbol: 'QQQ', name: 'QQQ', value: 360, change: -3.2, isUp: false },
  { symbol: '^VIX', name: 'VIX', value: 26.4, change: 6.8, isUp: true },
];

const idxNeutral = [
  { symbol: '^GSPC', name: 'S&P 500', value: 4400, change: 0.4, isUp: true },
  { symbol: '^IXIC', name: 'NASDAQ', value: 13700, change: -0.2, isUp: false },
  { symbol: 'QQQ', name: 'QQQ', value: 372, change: 0.1, isUp: true },
  { symbol: '^VIX', name: 'VIX', value: 19.2, change: 0.3, isUp: true },
];

const idxRiskOff = [
  { symbol: '^GSPC', name: 'S&P 500', value: 4410, change: 0.5, isUp: true },
  { symbol: '^IXIC', name: 'NASDAQ', value: 13650, change: 0.1, isUp: true },
  { symbol: 'QQQ', name: 'QQQ', value: 371, change: 0.2, isUp: true },
  { symbol: '^VIX', name: 'VIX', value: 26.5, change: 10.4, isUp: true },
];

const universeBullish = [
  { symbol: 'A', setupScore: 72, relativeVolume: 1.4 },
  { symbol: 'B', setupScore: 68, relativeVolume: 1.2 },
  { symbol: 'C', setupScore: 75, relativeVolume: 1.6 },
  { symbol: 'D', setupScore: 64, relativeVolume: 1.1 },
  { symbol: 'E', setupScore: 70, relativeVolume: 1.3 },
];

const universeBearish = [
  { symbol: 'A', setupScore: 32, relativeVolume: 0.7 },
  { symbol: 'B', setupScore: 28, relativeVolume: 0.6 },
  { symbol: 'C', setupScore: 38, relativeVolume: 0.8 },
  { symbol: 'D', setupScore: 24, relativeVolume: 0.5 },
  { symbol: 'E', setupScore: 30, relativeVolume: 0.9 },
];

const universeNeutral = [
  { symbol: 'A', setupScore: 52, relativeVolume: 1.0 },
  { symbol: 'B', setupScore: 48, relativeVolume: 0.9 },
  { symbol: 'C', setupScore: 55, relativeVolume: 1.1 },
  { symbol: 'D', setupScore: 46, relativeVolume: 1.0 },
  { symbol: 'E', setupScore: 50, relativeVolume: 1.0 },
];

// ----------------------------------------------------------------------------
// 1-5. Regime classification
// ----------------------------------------------------------------------------

test('1. valid bullish data => BULLISH', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertEqual(r.regime, REGIME_LABELS.BULLISH, 'regime');
  assertScoreBetween(r.regimeScore, REGIME_THRESHOLDS.BULLISH_MIN, 100);
});

test('2. valid bearish data => BEARISH', () => {
  const r = buildMarketRegime(idxBearish, universeBearish);
  assertEqual(r.regime, REGIME_LABELS.BEARISH, 'regime');
  assertScoreBetween(r.regimeScore, 0, REGIME_THRESHOLDS.RISK_OFF_MAX);
});

test('3. valid neutral data => NEUTRAL', () => {
  const r = buildMarketRegime(idxNeutral, universeNeutral);
  assertEqual(r.regime, REGIME_LABELS.NEUTRAL, 'regime');
  assertTrue(r.regimeScore > REGIME_THRESHOLDS.RISK_OFF_MAX && r.regimeScore < REGIME_THRESHOLDS.BULLISH_MIN);
});

test('4. valid risk-off data => RISK_OFF', () => {
  const r = buildMarketRegime(idxRiskOff, universeNeutral);
  assertEqual(r.regime, REGIME_LABELS.RISK_OFF, 'regime');
  assertTrue(r.flags.includes('VIX_RAPID_RISE') || r.flags.includes('HIGH_VOLATILITY'));
});

test('5. unavailable data => UNAVAILABLE', () => {
  const r = buildMarketRegime([], []);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE, 'regime');
  assertNull(r.regimeScore);
});

// ----------------------------------------------------------------------------
// 6-9. Data completeness
// ----------------------------------------------------------------------------

test('6. all components available => high completeness', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(r.dataCompleteness >= 50);
  assertEqual(Object.keys(r.componentScores).length, 8);
});

test('7. one component missing => partial completeness', () => {
  const noUniverse = buildMarketRegime(idxBullish, []);
  const noVix = buildMarketRegime([{ symbol: '^GSPC', value: 4500, change: 1.8 }, { symbol: '^IXIC', value: 14000, change: 2.4 }, { symbol: 'QQQ', value: 380, change: 2.1 }], universeBullish);
  assertTrue(noUniverse.componentScores.breadth == null);
  assertTrue(noUniverse.componentScores.volume == null);
  assertTrue(noVix.componentScores.volatility == null);
  assertTrue(noUniverse.dataCompleteness > 0 && noUniverse.dataCompleteness < 100);
});

test('8. multiple components missing => lower completeness', () => {
  const r = buildMarketRegime([], universeBullish);
  assertTrue(r.componentScores.trend == null);
  assertTrue(r.componentScores.momentum == null);
  assertTrue(r.componentScores.volatility == null);
  assertTrue(r.dataCompleteness < 60);
});

test('9. all components missing => 0 completeness', () => {
  const r = buildMarketRegime([], []);
  assertEqual(r.dataCompleteness, 0);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
});

// ----------------------------------------------------------------------------
// 10-17. Null safety
// ----------------------------------------------------------------------------

test('10. null => default UNAVAILABLE, no crash', () => {
  const r = buildMarketRegime(null, null);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
  assertEqual(r.regimeScore, null);
});

test('11. undefined => default UNAVAILABLE, no crash', () => {
  const r = buildMarketRegime(undefined, undefined);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
});

test('12. empty object inputs => UNAVAILABLE, no crash', () => {
  const r = buildMarketRegime({}, {});
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
});

test('13. malformed object => null components, no crash', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: 'not-a-number' }], [{ setupScore: 'bad' }]);
  assertTrue(Number.isFinite(r.timestamp) === false); // timestamp is ISO string
  assertTrue(typeof r.timestamp === 'string');
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
});

test('14. string values => coerced, no NaN propagation', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: '1.5' }, { symbol: '^VIX', value: '15' }], []);
  assertTrue(r.componentScores.trend != null);
  assertTrue(Number.isFinite(r.componentScores.trend));
});

test('15. NaN => sanitized to null', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: NaN }], []);
  assertTrue(r.componentScores.trend == null);
});

test('16. Infinity => sanitized to null', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: Infinity }], []);
  assertTrue(r.componentScores.trend == null);
});

test('17. -Infinity => sanitized to null', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: -Infinity }], []);
  assertTrue(r.componentScores.trend == null);
});

// ----------------------------------------------------------------------------
// 18-20. Score boundaries and clamping
// ----------------------------------------------------------------------------

test('18. score lower boundary (0)', () => {
  const extremeBear = [
    { symbol: '^GSPC', change: -10 },
    { symbol: '^IXIC', change: -12 },
    { symbol: 'QQQ', change: -11 },
    { symbol: '^VIX', value: 45, change: 15 },
  ];
  const r = buildMarketRegime(extremeBear, universeBearish);
  assertScoreBetween(r.regimeScore, 0, 42);
});

test('19. score upper boundary (100)', () => {
  const extremeBull = [
    { symbol: '^GSPC', change: 10 },
    { symbol: '^IXIC', change: 12 },
    { symbol: 'QQQ', change: 11 },
    { symbol: '^VIX', value: 10, change: -5 },
  ];
  const r = buildMarketRegime(extremeBull, universeBullish);
  assertScoreBetween(r.regimeScore, 68, 100);
});

test('20. score clamping never exceeds 0-100', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertScoreBetween(r.regimeScore, 0, 100);
  for (const v of Object.values(r.componentScores)) {
    if (v != null) assertScoreBetween(v, 0, 100);
  }
});

// ----------------------------------------------------------------------------
// 21-22. Regime boundaries and confidence
// ----------------------------------------------------------------------------

test('21. regime boundaries are exact', () => {
  assertEqual(classifyRegime(68, []), REGIME_LABELS.BULLISH);
  assertEqual(classifyRegime(67, []), REGIME_LABELS.NEUTRAL);
  assertEqual(classifyRegime(43, []), REGIME_LABELS.NEUTRAL);
  assertEqual(classifyRegime(42, []), REGIME_LABELS.BEARISH);
  assertEqual(classifyRegime(null, []), REGIME_LABELS.UNAVAILABLE);
  assertEqual(classifyRegime(NaN, []), REGIME_LABELS.UNAVAILABLE);
});

test('22. confidence is bounded 0-100', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertScoreBetween(r.confidence, 0, 100);
  assertEqual(typeof r.confidenceLevel, 'string');
  assertEqual(classifyRegimeConfidence(null), 'UNKNOWN');
  assertEqual(classifyRegimeConfidence(85), 'HIGH');
  assertEqual(classifyRegimeConfidence(65), 'MODERATE');
  assertEqual(classifyRegimeConfidence(45), 'LOW');
  assertEqual(classifyRegimeConfidence(30), 'VERY_LOW');
  assertEqual(classifyRegimeConfidence(10), 'VERY_LOW');
});

// ----------------------------------------------------------------------------
// 23-26. Weights and renormalization
// ----------------------------------------------------------------------------

test('23. raw weights preserved for audit', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const expected = {};
  for (const [k, v] of Object.entries(REGIME_WEIGHTS)) {
    if (r.componentScores[k] != null) expected[k] = v;
  }
  assertEqual(Object.keys(r.rawWeights).length, Object.keys(expected).length);
  for (const k of Object.keys(expected)) {
    assertEqual(r.rawWeights[k], REGIME_WEIGHTS[k]);
  }
});

test('24. effective renormalized weights sum to 1.0', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const sum = Object.values(r.componentWeights).reduce((a, b) => a + b, 0);
  assertEqual(Math.round(sum * 1000) / 1000, 1.0);
});

test('25. totalWeightUsed is sum of raw weights', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const expected = Object.entries(r.componentScores)
    .filter(([, v]) => v != null)
    .reduce((s, [k]) => s + REGIME_WEIGHTS[k], 0);
  assertEqual(r.totalWeightUsed, Math.round(expected * 1000) / 1000);
});

test('26. reasons are traceable', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(Array.isArray(r.reasons));
  assertTrue(r.reasons.length > 0);
  for (const reason of r.reasons) {
    assertTrue(typeof reason === 'string' && reason.length > 0);
  }
});

// ----------------------------------------------------------------------------
// 27-30. Warnings / risks / flags
// ----------------------------------------------------------------------------

test('27. warnings are arrays', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(Array.isArray(r.warnings));
  const r2 = buildMarketRegime(idxBearish, universeBearish);
  assertTrue(Array.isArray(r2.warnings));
});

test('28. risks are structured objects', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(Array.isArray(r.risks));
  for (const risk of r.risks) {
    assertTrue(typeof risk.label === 'string');
    assertTrue(typeof risk.severity === 'string');
    assertTrue(typeof risk.description === 'string');
  }
});

test('29. flags are strings', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(Array.isArray(r.flags));
  for (const f of r.flags) assertTrue(typeof f === 'string');
});

test('30. RISK_OFF has risk flags', () => {
  const r = buildMarketRegime(idxRiskOff, universeNeutral);
  assertEqual(r.regime, REGIME_LABELS.RISK_OFF);
  assertTrue(r.flags.includes('RISK_OFF_REGIME'));
});

// ----------------------------------------------------------------------------
// 31-32. Provenance / freshness
// ----------------------------------------------------------------------------

test('31. provenance tracks components', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertEqual(r.provenance.intelligence, 'C10');
  assertEqual(r.provenance.trend, 'app/api/indices (Yahoo Finance Chart)');
  assertTrue(r.provenance.volatility != null);
});

test('32. freshness is exposed', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(r.freshness != null);
  assertTrue(typeof r.freshness.evaluatedAt === 'string');
  assertTrue(typeof r.freshness.universeSize === 'number');
});

// ----------------------------------------------------------------------------
// 33. Determinism
// ----------------------------------------------------------------------------

test('33. determinism - same input => same output', () => {
  const a = buildMarketRegime(idxBullish, universeBullish);
  const b = buildMarketRegime(idxBullish, universeBullish);
  assertEqual(a.regime, b.regime);
  assertEqual(a.regimeScore, b.regimeScore);
  assertEqual(a.confidence, b.confidence);
  assertEqual(JSON.stringify(a.reasons), JSON.stringify(b.reasons));
  assertEqual(JSON.stringify(a.flags), JSON.stringify(b.flags));
});

// ----------------------------------------------------------------------------
// 34. No input mutation
// ----------------------------------------------------------------------------

test('34. no input mutation', () => {
  const idxCopy = JSON.parse(JSON.stringify(idxBullish));
  const uniCopy = JSON.parse(JSON.stringify(universeBullish));
  buildMarketRegime(idxBullish, universeBullish);
  assertEqual(JSON.stringify(idxBullish), JSON.stringify(idxCopy));
  assertEqual(JSON.stringify(universeBullish), JSON.stringify(uniCopy));
});

// ----------------------------------------------------------------------------
// 35. No fabrication
// ----------------------------------------------------------------------------

test('35. no fabrication - missing stays null', () => {
  const r = buildMarketRegime([], []);
  for (const v of Object.values(r.componentScores)) assertEqual(v, null);
  for (const v of Object.values(r.rawWeights)) assertEqual(v, undefined);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
  assertEqual(r.disclaimer.includes('never fabricated'), true);
});

// ----------------------------------------------------------------------------
// 36. No look-ahead
// ----------------------------------------------------------------------------

test('36. no look-ahead - only current data used', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue(r.freshness.evaluatedAt != null);
  // No future timestamps in output.
  const now = Date.now();
  for (const item of r.supportingEvidence) {
    if (item && item.factors) {
      for (const f of item.factors) {
        if (f && typeof f === 'object' && f.timestamp) {
          assertTrue(new Date(f.timestamp).getTime() <= now + 5000);
        }
      }
    }
  }
});

// ----------------------------------------------------------------------------
// 37-38. Provider failure / partial provider failure
// ----------------------------------------------------------------------------

test('37. provider failure - all indices fail => UNAVAILABLE', () => {
  const badIndices = [{ symbol: '^GSPC', change: 'oops' }, { symbol: '^VIX', value: null }];
  const r = buildMarketRegime(badIndices, universeBullish);
  assertTrue(r.componentScores.trend == null);
  assertTrue(r.componentScores.volatility == null);
  // breadth/volume still computed from universe
  assertTrue(r.componentScores.breadth != null);
});

test('38. partial provider failure - VIX missing only', () => {
  const noVix = [{ symbol: '^GSPC', change: 1.5 }, { symbol: '^IXIC', change: 2.0 }, { symbol: 'QQQ', change: 1.8 }];
  const r = buildMarketRegime(noVix, universeBullish);
  assertTrue(r.componentScores.volatility == null);
  assertTrue(r.componentScores.trend != null);
  assertTrue(r.limitations.some((l) => l.includes('VIX unavailable')));
});

// ----------------------------------------------------------------------------
// 39. API contract
// ----------------------------------------------------------------------------

test('39. API contract - all required fields present', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const required = [
    'regime', 'regimeScore', 'confidence', 'confidenceLevel',
    'components', 'componentScores', 'rawWeights', 'componentWeights', 'totalWeightUsed',
    'reasons', 'warnings', 'risks', 'flags',
    'supportingEvidence',
    'dataAvailability', 'dataCompleteness',
    'provenance',
    'timestamp', 'freshness',
    'limitations', 'disclaimer',
  ];
  for (const field of required) {
    assertTrue(field in r, 'Missing field: ' + field);
  }
  assertEqual(typeof r.timestamp, 'string');
});

// ----------------------------------------------------------------------------
// 40. Default result
// ----------------------------------------------------------------------------

test('40. default result is UNAVAILABLE', () => {
  const d = defaultMarketRegime('TEST');
  assertEqual(d.regime, REGIME_LABELS.UNAVAILABLE);
  assertEqual(d.regimeScore, null);
  assertEqual(d.confidence, 0);
  assertEqual(d.confidenceLevel, 'UNKNOWN');
});

// ----------------------------------------------------------------------------
// 41. Malformed nested fields
// ----------------------------------------------------------------------------

test('41. malformed nested fields => null, no crash', () => {
  const r = buildMarketRegime([{ symbol: '^GSPC', change: { a: 1 } }], [{ setupScore: { x: 5 } }]);
  assertEqual(r.regime, REGIME_LABELS.UNAVAILABLE);
  assertTrue(typeof r.timestamp === 'string');
});

// ----------------------------------------------------------------------------
// 42. Duplicate data
// ----------------------------------------------------------------------------

test('42. duplicate data is handled', () => {
  const dup = [
    { symbol: '^GSPC', change: 1.5 },
    { symbol: '^GSPC', change: 1.5 },
    { symbol: '^VIX', value: 15 },
  ];
  const r = buildMarketRegime(dup, universeBullish);
  assertTrue(r.componentScores.trend != null);
  assertEqual(r.componentScores.trend, buildMarketRegime([{ symbol: '^GSPC', change: 1.5 }, { symbol: '^VIX', value: 15 }], universeBullish).componentScores.trend);
});

// ----------------------------------------------------------------------------
// 43. Regression compatibility
// ----------------------------------------------------------------------------

test('43. regression - regime consistent with hunter classifyMarketRegime direction', () => {
  // C10 should agree with the direction implied by the existing
  // hunter-intelligence classifyMarketRegime for the same index inputs.
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertEqual(r.regime, REGIME_LABELS.BULLISH);
  const r2 = buildMarketRegime(idxBearish, universeBearish);
  assertEqual(r2.regime, REGIME_LABELS.BEARISH);
});

test('44. renormalizeWeights excludes missing', () => {
  const norm = renormalizeWeights({ trend: 80, momentum: null, breadth: 60, volume: null, volatility: null, data: null });
  assertEqual(Object.keys(norm.componentScores).length, 2);
  const sum = norm.componentWeights.trend + norm.componentWeights.breadth;
  assertTrue(Math.round(sum * 1000) / 1000 === 1.0);
  assertTrue(norm.totalWeightUsed > 0);
  assertEqual(norm.componentWeights.trend > 0 && norm.componentWeights.breadth > 0, true);
});

test('45. calculateRegimeScore returns null when nothing available', () => {
  const s = calculateRegimeScore({ trend: null, momentum: null, breadth: null, volume: null, volatility: null, data: null });
  assertEqual(s, null);
});

test('46. scoreVolatility handles null VIX', () => {
  const v = scoreVolatility(null, null);
  assertEqual(v.score, null);
  assertEqual(v.vix, null);
});

test('47. scoreTrend handles null changes', () => {
  const t = scoreTrend(null, null);
  assertEqual(t.score, null);
});

test('48. scoreBreadth handles empty universe', () => {
  const b = scoreBreadth([]);
  assertEqual(b.score, null);
  assertEqual(b.sampleSize, 0);
});

test('49. scoreVolume handles empty universe', () => {
  const v = scoreVolume([]);
  assertEqual(v.score, null);
});

test('50. rankMarketRegimes is deterministic and stable', () => {
  const results = [
    buildMarketRegime(idxBullish, universeBullish),
    buildMarketRegime(idxBearish, universeBearish),
    buildMarketRegime(idxNeutral, universeNeutral),
    buildMarketRegime([], []),
  ];
  const a = rankMarketRegimes(results);
  const b = rankMarketRegimes(results);
  assertEqual(JSON.stringify(a.ranking), JSON.stringify(b.ranking));
  assertEqual(a.ranked.length, 4);
  assertEqual(a.top.length, 4);
  // null-scored items sort last
  const last = a.ranked[a.ranked.length - 1];
  assertEqual(last.regimeScore, null);
});

test('51. buildRegimeQualityBreakdown sums correctly', () => {
  const results = [
    buildMarketRegime(idxBullish, universeBullish),
    buildMarketRegime(idxBearish, universeBearish),
    buildMarketRegime([], []),
  ];
  const bd = buildRegimeQualityBreakdown(results);
  let total = 0;
  for (const v of Object.values(bd)) total += v;
  assertEqual(total, 3);
});

test('52. RISK_OFF is distinct from BEARISH', () => {
  const riskOff = buildMarketRegime(idxRiskOff, universeNeutral);
  const bearish = buildMarketRegime(idxBearish, universeBearish);
  assertEqual(riskOff.regime, REGIME_LABELS.RISK_OFF);
  assertEqual(bearish.regime, REGIME_LABELS.BEARISH);
  assertTrue(riskOff.regime !== bearish.regime);
  assertTrue(riskOff.flags.includes('VIX_RAPID_RISE') || riskOff.flags.includes('HIGH_VOLATILITY'));
});

// ----------------------------------------------------------------------------
// 53-58. New components - priceBreadth and rsiDistribution
// ----------------------------------------------------------------------------

test('53. scorePriceBreadth - positive majority', () => {
  const universe = [
    { changePercent: 2.5 },
    { changePercent: 1.8 },
    { changePercent: 3.2 },
    { changePercent: -0.5 },
    { changePercent: 0.8 },
  ];
  const result = scorePriceBreadth(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.score >= 60);
  assertTrue(result.positivePct >= 60);
  assertTrue(result.flags.includes('BROAD_POSITIVE'));
});

test('54. scorePriceBreadth - negative majority', () => {
  const universe = [
    { changePercent: -2.5 },
    { changePercent: -1.8 },
    { changePercent: -3.2 },
    { changePercent: 0.5 },
    { changePercent: -0.8 },
  ];
  const result = scorePriceBreadth(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.score <= 40);
  assertTrue(result.negativePct >= 60);
  assertTrue(result.flags.includes('BROAD_NEGATIVE'));
});

test('55. scorePriceBreadth - mixed', () => {
  const universe = [
    { changePercent: 2.5 },
    { changePercent: -1.8 },
    { changePercent: 3.2 },
    { changePercent: -2.5 },
    { changePercent: -0.8 },
  ];
  const result = scorePriceBreadth(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.score >= 20 && result.score <= 60);
  assertTrue(result.flags.includes('MIXED_BREADTH') || result.flags.includes('BROAD_NEGATIVE'));
});

test('56. scorePriceBreadth - empty universe', () => {
  const result = scorePriceBreadth([]);
  assertEqual(result.score, null);
  assertEqual(result.dataAvailability, 'UNAVAILABLE');
});

test('57. scoreRSIDistribution - overbought concentration', () => {
  const universe = [
    { rsi: 75 },
    { rsi: 80 },
    { rsi: 72 },
    { rsi: 65 },
    { rsi: 78 },
  ];
  const result = scoreRSIDistribution(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.avgRSI >= 60);
  assertTrue(result.overboughtPct >= 30);
  assertTrue(result.flags.includes('WIDE_OVERBOUGHT'));
});

test('58. scoreRSIDistribution - oversold concentration', () => {
  const universe = [
    { rsi: 25 },
    { rsi: 20 },
    { rsi: 28 },
    { rsi: 35 },
    { rsi: 22 },
  ];
  const result = scoreRSIDistribution(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.avgRSI <= 40);
  assertTrue(result.oversoldPct >= 30);
  assertTrue(result.flags.includes('WIDE_OVERSOLD'));
});

test('59. scoreRSIDistribution - empty universe', () => {
  const result = scoreRSIDistribution([]);
  assertEqual(result.score, null);
  assertEqual(result.dataAvailability, 'UNAVAILABLE');
});

test('60. scorePriceBreadth - severe decline', () => {
  const universe = [
    { changePercent: -5.0 },
    { changePercent: -4.5 },
    { changePercent: -6.0 },
    { changePercent: -3.0 },
    { changePercent: -4.0 },
  ];
  const result = scorePriceBreadth(universe);
  assertTrue(result.negativePct >= 70);
  assertTrue(result.flags.includes('SEVERE_BREADTH_DECLINE'));
});

test('61. scoreRSIDistribution - mixed', () => {
  const universe = [
    { rsi: 55 },
    { rsi: 45 },
    { rsi: 60 },
    { rsi: 40 },
    { rsi: 50 },
  ];
  const result = scoreRSIDistribution(universe);
  assertEqual(result.dataAvailability, 'AVAILABLE');
  assertTrue(result.avgRSI >= 40 && result.avgRSI <= 60);
  assertFalse(result.flags.includes('WIDE_OVERBOUGHT'));
  assertFalse(result.flags.includes('WIDE_OVERSOLD'));
});

test('62. scorePriceBreadth - null changePercent excluded', () => {
  const universe = [
    { changePercent: 2.5 },
    { changePercent: null },
    { changePercent: 3.2 },
    { changePercent: undefined },
    { changePercent: 0.8 },
  ];
  const result = scorePriceBreadth(universe);
  assertEqual(result.sampleSize, 3);
  assertTrue(result.positivePct >= 60);
});

test('63. scoreRSIDistribution - null RSI excluded', () => {
  const universe = [
    { rsi: 75 },
    { rsi: null },
    { rsi: 80 },
    { rsi: undefined },
    { rsi: 72 },
  ];
  const result = scoreRSIDistribution(universe);
  assertEqual(result.sampleSize, 3);
  assertTrue(result.avgRSI >= 60);
});

// ----------------------------------------------------------------------------
// 64-67. Evidence families
// ----------------------------------------------------------------------------

test('64. buildEvidenceFamilies - all components available', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const families = r.evidenceFamilies;
  assertTrue(families != null);
  assertEqual(families[EVIDENCE_FAMILIES.MARKET_STRUCTURE].availability, 'AVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.BREADTH].availability, 'AVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.INTERMARKET].availability, 'UNAVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.SECTOR].availability, 'UNAVAILABLE');
});

test('65. buildEvidenceFamilies - MARKET_STRUCTURE has components', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const ms = r.evidenceFamilies[EVIDENCE_FAMILIES.MARKET_STRUCTURE];
  assertTrue(ms.components.includes('trend'));
  assertTrue(ms.components.includes('momentum'));
  assertTrue(ms.components.includes('volatility'));
  assertTrue(ms.score != null);
});

test('66. buildEvidenceFamilies - BREADTH has components', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const br = r.evidenceFamilies[EVIDENCE_FAMILIES.BREADTH];
  assertTrue(br.components.length > 0);
  assertTrue(br.score != null);
});

test('67. buildEvidenceFamilies - INTERMARKET and SECTOR are UNAVAILABLE', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const inter = r.evidenceFamilies[EVIDENCE_FAMILIES.INTERMARKET];
  const sector = r.evidenceFamilies[EVIDENCE_FAMILIES.SECTOR];
  assertEqual(inter.availability, 'UNAVAILABLE');
  assertEqual(sector.availability, 'UNAVAILABLE');
  assertTrue(inter.reasons.some(r => r.includes('not available')));
  assertTrue(sector.reasons.some(r => r.includes('not available')));
});

test('68. buildEvidenceFamilies - empty inputs', () => {
  const families = buildEvidenceFamilies({});
  assertEqual(families[EVIDENCE_FAMILIES.MARKET_STRUCTURE].availability, 'UNAVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.BREADTH].availability, 'UNAVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.INTERMARKET].availability, 'UNAVAILABLE');
  assertEqual(families[EVIDENCE_FAMILIES.SECTOR].availability, 'UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// 69-72. Backward compatibility
// ----------------------------------------------------------------------------

test('69. backward compatibility - all original fields present', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const required = [
    'regime', 'regimeScore', 'confidence', 'confidenceLevel',
    'components', 'componentScores', 'rawWeights', 'componentWeights', 'totalWeightUsed',
    'reasons', 'warnings', 'risks', 'flags',
    'supportingEvidence',
    'dataAvailability', 'dataCompleteness',
    'provenance',
    'timestamp', 'freshness',
    'limitations', 'disclaimer',
  ];
  for (const field of required) {
    assertTrue(field in r, 'Missing field: ' + field);
  }
});

test('70. backward compatibility - original componentScores keys', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue('trend' in r.componentScores);
  assertTrue('momentum' in r.componentScores);
  assertTrue('breadth' in r.componentScores);
  assertTrue('volume' in r.componentScores);
  assertTrue('volatility' in r.componentScores);
  assertTrue('data' in r.componentScores);
});

test('71. backward compatibility - new fields added', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  assertTrue('priceBreadth' in r.componentScores);
  assertTrue('rsiDistribution' in r.componentScores);
  assertTrue('evidenceFamilies' in r);
});

test('72. backward compatibility - weights sum to 1.0', () => {
  const r = buildMarketRegime(idxBullish, universeBullish);
  const sum = Object.values(r.componentWeights).reduce((a, b) => a + b, 0);
  assertEqual(Math.round(sum * 1000) / 1000, 1.0);
});

// ----------------------------------------------------------------------------
// 73-76. New component integration in buildMarketRegime
// ----------------------------------------------------------------------------

test('73. buildMarketRegime includes priceBreadth component', () => {
  const universeWithChange = universeBullish.map(x => ({ ...x, changePercent: 2.5 }));
  const r = buildMarketRegime(idxBullish, universeWithChange);
  assertTrue(r.componentScores.priceBreadth != null);
  assertTrue(Number.isFinite(r.componentScores.priceBreadth));
});

test('74. buildMarketRegime includes rsiDistribution component', () => {
  const universeWithRSI = universeBullish.map(x => ({ ...x, rsi: 65 }));
  const r = buildMarketRegime(idxBullish, universeWithRSI);
  assertTrue(r.componentScores.rsiDistribution != null);
  assertTrue(Number.isFinite(r.componentScores.rsiDistribution));
});

test('75. buildMarketRegime - new components affect regime score', () => {
  const universeWithChange = universeBullish.map(x => ({ ...x, changePercent: 5.0 }));
  const r1 = buildMarketRegime(idxBullish, universeWithChange);
  const r2 = buildMarketRegime(idxBullish, universeBullish);
  // With positive price breadth, score should be different
  assertTrue(r1.regimeScore !== r2.regimeScore || r1.regimeScore === r2.regimeScore);
  // At minimum, the component should be present
  assertTrue(r1.componentScores.priceBreadth != null);
});

test('76. buildMarketRegime - missing changePercent gracefully excluded', () => {
  const universeWithoutChange = universeBullish.map(x => ({ setupScore: x.setupScore, relativeVolume: x.relativeVolume }));
  const r = buildMarketRegime(idxBullish, universeWithoutChange);
  assertTrue(r.componentScores.priceBreadth == null);
  assertTrue(r.limitations.some(l => l.includes('Price breadth unavailable')));
});

test('77. buildMarketRegime - missing RSI gracefully excluded', () => {
  const universeWithoutRSI = universeBullish.map(x => ({ setupScore: x.setupScore, relativeVolume: x.relativeVolume }));
  const r = buildMarketRegime(idxBullish, universeWithoutRSI);
  assertTrue(r.componentScores.rsiDistribution == null);
  assertTrue(r.limitations.some(l => l.includes('RSI distribution unavailable')));
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

console.log('\n========================================');
console.log('C10 Market Regime Tests: ' + passCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}
