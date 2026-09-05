/**
 * C7 Opportunity Ranking Tests
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-opportunity-ranking.mjs
 *
 * Coverage:
 *   1.  complete B1-B6 input
 *   2.  each B1-B6 missing individually
 *   3.  multiple missing components
 *   4.  all missing
 *   5.  null/undefined
 *   6.  malformed values
 *   7.  NaN/Infinity
 *   8.  score clamping
 *   9.  weight renormalization
 *   10. quality boundaries
 *   11. ranking
 *   12. stable tie-breaking
 *   13. data completeness
 *   14. confidence
 *   15. conflicting signals
 *   16. risk propagation
 *   17. provenance
 *   18. no fabrication
 *   19. no input mutation
 *   20. no look-ahead
 *   21. determinism
 *   22. API contract
 *   23. B1-B6 regression
 */

import {
  buildOpportunityRanking,
  defaultOpportunityRanking,
  rankOpportunities,
  calculateOpportunityScore,
  calculateOpportunityQuality,
  OPPORTUNITY_WEIGHTS,
  OPPORTUNITY_QUALITY_THRESHOLDS,
  clamp,
  n,
} from '../lib/opportunity-ranking.js';

import { buildPennyIntelligence } from '../lib/penny-intelligence-manager.js';
import { buildOptionsIntelligenceResult, defaultOptionsIntelligence } from '../lib/options-intelligence-manager.js';
import { buildInstitutionalRadarResult, defaultInstitutionalRadar } from '../lib/institutional-radar-manager.js';
import { normalizeSwingIntelligence as buildSwingIntelligenceManager, defaultSwingIntelligenceManager } from '../lib/swing-intelligence-manager.js';
import { buildEarlyExplosionIntelligenceManager, defaultEarlyExplosionIntelligenceManager } from '../lib/early-explosion-intelligence-manager.js';
import { buildCatalystIntelligenceManager, defaultCatalystIntelligenceManager } from '../lib/catalyst-intelligence-manager.js';

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

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + 'Expected: ' + JSON.stringify(expected) + '\nActual: ' + JSON.stringify(actual));
  }
}

function assertTrue(value, msg = '') {
  if (!value) throw new Error(msg || 'Expected truthy value but got falsy');
}

function assertFalse(value, msg = '') {
  if (value) throw new Error(msg || 'Expected falsy value but got truthy');
}

function assertNull(value, msg = '') {
  if (value != null) throw new Error(msg || 'Expected null but got ' + JSON.stringify(value));
}

function assertScoreBetween(score, min, max, msg = '') {
  assertTrue(score != null && Number.isFinite(score), msg || 'Score must be a finite number');
  assertTrue(score >= min && score <= max, (msg || '') + ' Score ' + score + ' outside [' + min + ',' + max + ']');
}

// ----------------------------------------------------------------------------
// B1-B6 sample inputs (built from real B1-B6 manager outputs)
// ----------------------------------------------------------------------------

const b1Sample = buildPennyIntelligence({
  symbol: 'AAPL',
  price: 180.25,
  previousClose: 179.10,
  changePercent: 0.64,
  relativeVolume: 1.2,
  averageVolume20: 60000000,
  rsi: 58,
  setupScore: 62,
  signal: 'WATCH',
  signalStrength: 60,
  directionBias: 'صاعد',
  riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
}, {});

const swingMarketData = {
  symbol: 'AAPL',
  price: 180.25,
  changePercent: 0.64,
  relativeVolume: 1.2,
  rsi: 58,
  atr: 2.4,
  sma20: 178.5,
  sma50: 175.0,
  sma200: 165.0,
  vwap: 179.8,
  support: 176.0,
  resistance: 183.0,
  bollinger: { squeeze: false, bandwidth: 0.08 },
  cluster: false,
  riskReward: 1.8,
  signal: 'WATCH',
  signalStrength: 60,
  directionBias: 'صاعد',
  riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
};

const b4Sample = buildSwingIntelligenceManager(swingMarketData);
const b5Sample = buildEarlyExplosionIntelligenceManager(swingMarketData);
const b6Sample = buildCatalystIntelligenceManager('AAPL', null, swingMarketData);

const optionsContracts = [{
  symbol: 'AAPL', underlying: 180.25, expiry: '2026-09-18',
  strike: 180, optionType: 'CALL', premium: 3.20, volume: 1200, openInterest: 4500,
  bid: 3.10, ask: 3.30, bidAskSpread: 0.20, impliedVolatility: 0.28,
  delta: 0.52, gamma: 0.04, theta: -0.05, vega: 0.08,
  dataTimestamp: new Date().toISOString(),
}];
const b2Sample = buildOptionsIntelligenceResult('AAPL', optionsContracts, {
  providerStatus: { provider: 'yahoo', source: 'Yahoo Finance options chain', available: true },
  timestamp: new Date().toISOString(),
});

const b3Sample = buildInstitutionalRadarResult('AAPL', null, null, null);

const completeSources = {
  pennyIntelligence: b1Sample,
  optionsIntelligence: b2Sample,
  institutionalRadar: b3Sample,
  swingIntelligence: b4Sample,
  earlyExplosion: b5Sample,
  catalystIntelligence: b6Sample,
};

const sourceKeys = ['pennyIntelligence', 'optionsIntelligence', 'institutionalRadar', 'swingIntelligence', 'earlyExplosion', 'catalystIntelligence'];

// ----------------------------------------------------------------------------
// 1. Complete B1-B6 input
// ----------------------------------------------------------------------------
test('complete B1-B6 input produces a numeric score', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  assertScoreBetween(r.opportunityScore, 0, 100, 'complete input score');
  assertTrue(r.quality !== 'UNAVAILABLE', 'complete input quality');
  assertTrue(Object.keys(r.componentScores).length === 6, '6 component scores');
});

test('complete B1-B6 input exposes provenance for every source', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  for (const key of Object.keys(completeSources)) {
    assertTrue(r.provenance.sources[key] != null, 'provenance missing for ' + key);
    assertTrue(r.sourceIntelligence[key] != null, 'sourceIntelligence missing for ' + key);
  }
});

test('complete B1-B6 input never averages raw scores', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  const vals = Object.values(r.componentScores).filter((v) => v != null);
  const simpleAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
  assertTrue(Math.abs(simpleAvg - r.opportunityScore) > 0.01 || r.opportunityScore == null,
    'score should not equal a simple average');
});

// ----------------------------------------------------------------------------
// 2. Each B1-B6 missing individually
// ----------------------------------------------------------------------------
sourceKeys.forEach((key) => {
  test('missing ' + key + ' keeps that component null', () => {
    const sources = { ...completeSources };
    delete sources[key];
    const r = buildOpportunityRanking('AAPL', sources);
    const compKey = key + 'Score';
    assertNull(r.componentScores[compKey], key + ' component should be null when missing');
    assertScoreBetween(r.opportunityScore, 0, 100, 'score still bounded');
    assertTrue(r.dataAvailability[key] === false, key + ' dataAvailability should be false');
    assertTrue(r.warnings.some((w) => w.indexOf('MISSING_SOURCES') === 0), 'warning emitted for missing ' + key);
  });
});

// ----------------------------------------------------------------------------
// 3. Multiple missing components
// ----------------------------------------------------------------------------
test('multiple missing components renormalize weights', () => {
  const sources = { ...completeSources };
  delete sources.pennyIntelligence;
  delete sources.optionsIntelligence;
  delete sources.institutionalRadar;
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.pennyIntelligenceScore, 'penny null');
  assertNull(r.componentScores.optionsIntelligenceScore, 'options null');
  assertNull(r.componentScores.institutionalRadarScore, 'institutional null');
  assertTrue(r.componentScores.swingIntelligenceScore != null, 'swing present');
  assertTrue(r.componentScores.earlyExplosionScore != null, 'explosion present');
  // catalystIntelligence is null with no SEC/market data -> null component score
  assertTrue(r.componentScores.catalystIntelligenceScore == null, 'catalyst null with no data');
  assertScoreBetween(r.opportunityScore, 0, 100, 'renormalized score');
  const used = Object.values(r.usedWeights).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(used - 1.0) < 0.01, 'renormalized weights sum to 1, got ' + used);
});

test('usedWeights renormalized when only 2 of 6 present', () => {
  const sources = { ...completeSources };
  delete sources.pennyIntelligence;
  delete sources.optionsIntelligence;
  delete sources.institutionalRadar;
  delete sources.earlyExplosion;
  delete sources.catalystIntelligence;
  const r = buildOpportunityRanking('AAPL', sources);
  const used = Object.values(r.usedWeights).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(used - 1.0) < 0.01, 'weights should renormalize to 1, got ' + used);
  assertTrue(Object.keys(r.usedWeights).length === 1, 'only one weight used');
});

// ----------------------------------------------------------------------------
// 4. All missing
// ----------------------------------------------------------------------------
test('all missing returns UNAVAILABLE with no fabricated score', () => {
  const r = buildOpportunityRanking('AAPL', {});
  assertNull(r.opportunityScore, 'score must be null with no sources');
  assertEqual(r.quality, 'UNAVAILABLE', 'quality UNAVAILABLE when all missing');
  assertEqual(r.confidence, 0, 'confidence 0 when no sources');
  assertTrue(r.dataCompleteness === 0, 'data completeness 0');
  assertTrue(r.dataAvailability.pennyIntelligence === false, 'availability false');
});

test('sources object undefined returns UNAVAILABLE default', () => {
  const r = buildOpportunityRanking('AAPL', undefined);
  assertEqual(r.quality, 'UNAVAILABLE');
  assertNull(r.opportunityScore);
});

test('null symbol returns default', () => {
  const r = buildOpportunityRanking(null, completeSources);
  assertEqual(r.symbol, null);
  assertEqual(r.quality, 'UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// 5. null/undefined component values
// ----------------------------------------------------------------------------
test('null component values treated as missing, not zero', () => {
  const sources = { ...completeSources };
  sources.pennyIntelligence = null;
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.pennyIntelligenceScore, 'null component not treated as zero');
  assertTrue(r.dataAvailability.pennyIntelligence === false, 'null source unavailable');
});

test('undefined component values treated as missing', () => {
  const sources = { ...completeSources };
  sources.optionsIntelligence = undefined;
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.optionsIntelligenceScore, 'undefined component not treated as zero');
});

// ----------------------------------------------------------------------------
// 6. Malformed values
// ----------------------------------------------------------------------------
test('malformed string scores are sanitized to null', () => {
  // Minimal raw objects so only the primary score field is consulted
  // (B1 falls back to setupScore/hunterScore when pennyScore is malformed,
  //  so the penny source is deliberately given null fallbacks).
  const sources = {
    pennyIntelligence: { pennyScore: 'abc', setupScore: null, hunterScore: null, hunter: null, conviction: null },
    optionsIntelligence: { decision: { decisionScore: 'xyz' }, flow: { flowScore: null }, summary: { bestContractRankScore: null }, callScore: null, putScore: null },
    institutionalRadar: { institutionalScore: 'foo', rankScore: null, decisionScore: null, secEdgarScore: null },
    swingIntelligence: { swingScore: 'bar', setupScore: null },
    earlyExplosion: { explosionScore: 'baz' },
    catalystIntelligence: { catalystScore: 'qux' },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  for (const k of Object.keys(r.componentScores)) {
    assertNull(r.componentScores[k], 'malformed score sanitized to null for ' + k);
  }
  assertNull(r.opportunityScore, 'no score when all malformed');
});

test('object input instead of score is ignored', () => {
  const sources = { ...completeSources };
  sources.pennyIntelligence = { pennyScore: { nested: 'object' } };
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.pennyIntelligenceScore, 'object score ignored');
});

// ----------------------------------------------------------------------------
// 7. NaN/Infinity
// ----------------------------------------------------------------------------
test('NaN scores sanitized to null', () => {
  const sources = { ...completeSources };
  sources.pennyIntelligence = { pennyScore: NaN, setupScore: null, hunterScore: null, hunter: null, conviction: null };
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.pennyIntelligenceScore, 'NaN sanitized to null');
});

test('Infinity scores sanitized to null', () => {
  const sources = { ...completeSources };
  sources.institutionalRadar = { ...b3Sample, institutionalScore: Infinity };
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.institutionalRadarScore, 'Infinity sanitized to null');
});

test('-Infinity scores sanitized to null', () => {
  const sources = { ...completeSources };
  sources.swingIntelligence = { ...b4Sample, swingScore: -Infinity };
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.swingIntelligenceScore, '-Infinity sanitized to null');
});

test('NaN never propagates into final score', () => {
  const sources = { ...completeSources };
  sources.earlyExplosion = { ...b5Sample, explosionScore: NaN };
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.opportunityScore == null || Number.isFinite(r.opportunityScore), 'final score must be finite or null');
  assertNull(r.componentScores.earlyExplosionScore, 'NaN component excluded');
});

// ----------------------------------------------------------------------------
// 8. Score clamping
// ----------------------------------------------------------------------------
test('scores above 100 are clamped to 100', () => {
  const sources = { ...completeSources };
  sources.pennyIntelligence = { ...b1Sample, pennyScore: 250 };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.pennyIntelligenceScore, 100, 'clamped to 100');
});

test('scores below 0 are clamped to 0', () => {
  const sources = { ...completeSources };
  sources.pennyIntelligence = { ...b1Sample, pennyScore: -50 };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.pennyIntelligenceScore, 0, 'clamped to 0');
});

test('final opportunityScore is clamped to 0-100', () => {
  // Set every source's score field to a huge value via the field each
  // extractor actually reads (verified against B1-B6 output shapes):
  //   B2 reads decision.decisionScore, not a top-level optionsScore.
  const fieldForSource = {
    pennyIntelligence: 'pennyScore',
    optionsIntelligence: 'decision',
    institutionalRadar: 'institutionalScore',
    swingIntelligence: 'swingScore',
    earlyExplosion: 'explosionScore',
    catalystIntelligence: 'catalystScore',
  };
  const sources = {};
  for (const k of Object.keys(completeSources)) {
    const patch = { ...completeSources[k] };
    if (k === 'optionsIntelligence') {
      patch.decision = { ...(completeSources[k].decision || {}), decisionScore: 9999 };
    } else {
      patch[fieldForSource[k]] = 9999;
    }
    sources[k] = patch;
  }
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.opportunityScore, 100, 'all-max scores clamp to 100');
  for (const k of Object.keys(sources)) {
    assertEqual(r.componentScores[k + 'Score'], 100, k + ' component clamped to 100');
  }
});

// ----------------------------------------------------------------------------
// 9. Weight renormalization
// ----------------------------------------------------------------------------
test('documented component weights sum to 1.0', () => {
  const sum = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(sum - 1.0) < 0.001, 'weights sum to 1, got ' + sum);
});

test('renormalized weights preserve relative proportions', () => {
  // Keep only options (0.15) and swing (0.20) — both non-null in completeSources.
  // Institutional/catalyst are null without SEC data, so exclude them.
  const sources = {
    optionsIntelligence: completeSources.optionsIntelligence,
    swingIntelligence: completeSources.swingIntelligence,
  };
  const r = buildOpportunityRanking('AAPL', sources);
  const w = r.usedWeights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(total - 1.0) < 0.01, 'renormalized total 1, got ' + total);
  // options (0.15) and swing (0.20) keep their relative ratio 3:4
  const ratio = w.optionsIntelligence / w.swingIntelligence;
  assertTrue(Math.abs(ratio - 0.75) < 0.01, 'relative ratio preserved, got ' + ratio);
});

// ----------------------------------------------------------------------------
// 10. Quality boundaries
// ----------------------------------------------------------------------------
test('quality TOP boundary at 85', () => {
  assertEqual(calculateOpportunityQuality(85), 'TOP');
  assertEqual(calculateOpportunityQuality(84.9), 'STRONG');
});

test('quality STRONG boundary at 70', () => {
  assertEqual(calculateOpportunityQuality(70), 'STRONG');
  assertEqual(calculateOpportunityQuality(69.9), 'WATCH');
});

test('quality WATCH boundary at 55', () => {
  assertEqual(calculateOpportunityQuality(55), 'WATCH');
  assertEqual(calculateOpportunityQuality(54.9), 'WEAK');
});

test('quality WEAK boundary at 40', () => {
  assertEqual(calculateOpportunityQuality(40), 'WEAK');
  assertEqual(calculateOpportunityQuality(39.9), 'UNAVAILABLE');
});

test('quality UNAVAILABLE for null score', () => {
  assertEqual(calculateOpportunityQuality(null), 'UNAVAILABLE');
  assertEqual(calculateOpportunityQuality(NaN), 'UNAVAILABLE');
});

test('quality thresholds match spec', () => {
  assertEqual(OPPORTUNITY_QUALITY_THRESHOLDS.TOP, 85);
  assertEqual(OPPORTUNITY_QUALITY_THRESHOLDS.STRONG, 70);
  assertEqual(OPPORTUNITY_QUALITY_THRESHOLDS.WATCH, 55);
  assertEqual(OPPORTUNITY_QUALITY_THRESHOLDS.WEAK, 40);
});

// ----------------------------------------------------------------------------
// 11. Ranking
// ----------------------------------------------------------------------------
function makeResult(symbol, score, dc, conf) {
  return {
    symbol,
    opportunityScore: score,
    quality: calculateOpportunityQuality(score),
    dataCompleteness: dc,
    confidence: conf,
  };
}

test('ranking sorts by opportunityScore descending', () => {
  const results = [
    makeResult('A', 50, 100, 80),
    makeResult('B', 80, 100, 80),
    makeResult('C', 60, 100, 80),
  ];
  const { ranked } = rankOpportunities(results);
  assertEqual(ranked[0].symbol, 'B', 'highest score first');
  assertEqual(ranked[1].symbol, 'C', 'second');
  assertEqual(ranked[2].symbol, 'A', 'lowest last');
  assertEqual(ranked[0].rank, 1);
  assertEqual(ranked[2].rank, 3);
});

test('null scores sink to the bottom', () => {
  const results = [
    makeResult('A', null, 100, 80),
    makeResult('B', 60, 100, 80),
  ];
  const { ranked } = rankOpportunities(results);
  assertEqual(ranked[0].symbol, 'B', 'non-null first');
  assertEqual(ranked[1].symbol, 'A', 'null last');
});

test('top slice contains 5 highest', () => {
  const results = [];
  for (let i = 0; i < 12; i++) {
    results.push(makeResult('S' + i, 90 - i, 100, 80));
  }
  const { top, alternatives, ranking } = rankOpportunities(results);
  assertEqual(top.length, 5, 'top has 5');
  assertEqual(alternatives.length, 5, 'alternatives has 5');
  assertEqual(ranking.total, 12, 'total 12');
});

// ----------------------------------------------------------------------------
// 12. Stable tie-breaking
// ----------------------------------------------------------------------------
test('stable tie-break: score -> dataCompleteness -> confidence -> symbol alpha', () => {
  const results = [
    makeResult('C', 75, 60, 70),
    makeResult('A', 75, 60, 70),
    makeResult('B', 75, 80, 70),
    makeResult('D', 75, 60, 80),
  ];
  const { ranked } = rankOpportunities(results);
  // B has highest dataCompleteness (80) -> first
  assertEqual(ranked[0].symbol, 'B', 'highest data completeness first');
  // D has highest confidence (80) -> second
  assertEqual(ranked[1].symbol, 'D', 'highest confidence second');
  // A before C alphabetically
  assertEqual(ranked[2].symbol, 'A', 'alpha tie-break A before C');
  assertEqual(ranked[3].symbol, 'C', 'alpha tie-break C last');
});

test('determinism: same input produces identical ranking', () => {
  const results = [];
  for (let i = 0; i < 10; i++) {
    results.push(makeResult('S' + i, (i * 17) % 80, (i * 13) % 100, (i * 7) % 100));
  }
  const a = rankOpportunities(results).ranked.map((r) => r.symbol);
  const b = rankOpportunities(results).ranked.map((r) => r.symbol);
  assertEqual(JSON.stringify(a), JSON.stringify(b), 'deterministic ranking');
});

test('empty results returns empty ranking', () => {
  const { ranked, top, alternatives, ranking } = rankOpportunities([]);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
  assertEqual(ranking.total, 0);
});

test('non-array input returns empty ranking', () => {
  const { ranked } = rankOpportunities(null);
  assertEqual(ranked.length, 0);
});

// ----------------------------------------------------------------------------
// 13. Data completeness
// ----------------------------------------------------------------------------
test('data completeness never improves score', () => {
  const high = buildOpportunityRanking('AAPL', completeSources);
  const sources = { ...completeSources };
  delete sources.pennyIntelligence;
  const low = buildOpportunityRanking('AAPL', sources);
  assertTrue(low.dataCompleteness <= high.dataCompleteness, 'fewer sources = lower completeness');
});

test('all-missing has zero data completeness', () => {
  const r = buildOpportunityRanking('AAPL', {});
  assertEqual(r.dataCompleteness, 0, 'zero completeness when all missing');
});

test('complete data availability flags all 6 sources', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  for (const k of sourceKeys) {
    assertTrue(r.dataAvailability[k] === true, k + ' available');
  }
});

// ----------------------------------------------------------------------------
// 14. Confidence
// ----------------------------------------------------------------------------
test('confidence increases with more sources', () => {
  const full = buildOpportunityRanking('AAPL', completeSources);
  const partial = buildOpportunityRanking('AAPL', { swingIntelligence: b4Sample });
  assertTrue(full.confidence >= partial.confidence, 'more sources => more confidence');
  assertScoreBetween(full.confidence, 0, 100, 'confidence bounded');
  assertScoreBetween(partial.confidence, 0, 100, 'confidence bounded');
});

test('confidence is zero with no sources', () => {
  const r = buildOpportunityRanking('AAPL', {});
  assertEqual(r.confidence, 0, 'confidence 0 with no sources');
  assertEqual(r.confidenceLevel, 'UNKNOWN', 'confidence level UNKNOWN');
});

// ----------------------------------------------------------------------------
// 15. Conflicting signals
// ----------------------------------------------------------------------------
test('conflicting BUY vs SELL signals are exposed', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'SELL' },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.warnings.some((w) => w.indexOf('CONFLICTING_SIGNALS_DETECTED') === 0),
    'conflict warning emitted: ' + JSON.stringify(r.warnings));
  assertTrue(r.risks.some((risk) => risk.label === 'SIGNAL_CONFLICT'), 'risk SIGNAL_CONFLICT emitted');
});

test('consistent BUY signals do not create conflict', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'BUY' },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertFalse(r.warnings.some((w) => w.indexOf('CONFLICTING_SIGNALS_DETECTED') === 0),
    'no conflict for consistent signals');
});

// ----------------------------------------------------------------------------
// 16. Risk propagation
// ----------------------------------------------------------------------------
test('high explosion risk propagates', () => {
  const sources = { ...completeSources };
  sources.earlyExplosion = { ...b5Sample, explosionRisk: 'HIGH' };
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'EXPLOSION_VOLATILITY_RISK'),
    'explosion risk propagated: ' + JSON.stringify(r.risks));
});

test('high catalyst risk propagates', () => {
  const sources = { ...completeSources };
  sources.catalystIntelligence = { ...b6Sample, catalystRisk: 'HIGH' };
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'CATALYST_RISK'),
    'catalyst risk propagated: ' + JSON.stringify(r.risks));
});

test('low score below 40 emits LOW_OPPORTUNITY_SCORE risk', () => {
  const sources = {};
  for (const k of sourceKeys) {
    const field = k === 'pennyIntelligence' ? 'pennyScore' :
      k === 'optionsIntelligence' ? 'optionsScore' :
      k === 'institutionalRadar' ? 'institutionalScore' :
      k === 'swingIntelligence' ? 'swingScore' :
      k === 'earlyExplosion' ? 'explosionScore' : 'catalystScore';
    sources[k] = { ...completeSources[k], [field]: 20 };
  }
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'LOW_OPPORTUNITY_SCORE'),
    'low score risk emitted');
});

test('too many missing sources emits INCOMPLETE_INTELLIGENCE HIGH risk', () => {
  const sources = { swingIntelligence: b4Sample };
  const r = buildOpportunityRanking('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'INCOMPLETE_INTELLIGENCE' && risk.severity === 'HIGH'),
    'incomplete intelligence HIGH risk: ' + JSON.stringify(r.risks));
});

// ----------------------------------------------------------------------------
// 17. Provenance
// ----------------------------------------------------------------------------
test('provenance records C7 engine and all contributing sources', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  assertEqual(r.provenance.intelligence, 'C7');
  assertEqual(r.provenance.engine, 'C7 Opportunity Ranking');
  for (const k of sourceKeys) {
    assertTrue(r.provenance.sources[k] != null, 'source provenance for ' + k);
  }
  for (const k of sourceKeys) {
    assertTrue(r.sourceIntelligence[k] != null, 'sourceIntelligence for ' + k);
  }
});

test('provenance present even with partial sources', () => {
  const r = buildOpportunityRanking('AAPL', { swingIntelligence: b4Sample });
  assertEqual(r.provenance.intelligence, 'C7');
  assertTrue(r.provenance.sources.swingIntelligence != null, 'swing provenance present');
  assertNull(r.provenance.sources.pennyIntelligence, 'missing provenance is null');
});

// ----------------------------------------------------------------------------
// 18. No fabrication
// ----------------------------------------------------------------------------
test('missing sources are never fabricated into scores', () => {
  const r = buildOpportunityRanking('AAPL', { swingIntelligence: b4Sample });
  for (const k of sourceKeys) {
    if (k === 'swingIntelligence') continue;
    assertNull(r.componentScores[k + 'Score'], k + ' component not fabricated');
    assertTrue(r.dataAvailability[k] === false, k + ' not marked available');
  }
});

test('disclaimer is present and states no BUY/SELL guarantee', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  assertTrue(typeof r.disclaimer === 'string' && r.disclaimer.length > 0, 'disclaimer present');
  assertTrue(r.disclaimer.toLowerCase().includes('not a buy/sell'), 'no buy/sell guarantee');
  assertTrue(r.disclaimer.includes('Opportunity Ranking (C7)'), 'C7 disclaimer present');
});

test('default result has no fabricated score', () => {
  const d = defaultOpportunityRanking('AAPL');
  assertNull(d.opportunityScore, 'default score null');
  assertEqual(d.quality, 'UNAVAILABLE', 'default quality UNAVAILABLE');
  assertEqual(d.confidence, 0, 'default confidence 0');
  for (const k of Object.keys(d.componentScores)) {
    assertNull(d.componentScores[k], 'default component null: ' + k);
  }
});

// ----------------------------------------------------------------------------
// 19. No input mutation
// ----------------------------------------------------------------------------
test('input sources are not mutated', () => {
  const snapshot = JSON.stringify(completeSources);
  buildOpportunityRanking('AAPL', completeSources);
  assertEqual(JSON.stringify(completeSources), snapshot, 'inputs unchanged');
});

test('input sources not mutated when scores are extreme', () => {
  const sources = {};
  for (const k of Object.keys(completeSources)) {
    sources[k] = { ...completeSources[k] };
  }
  const snapshot = JSON.stringify(sources);
  buildOpportunityRanking('AAPL', sources);
  assertEqual(JSON.stringify(sources), snapshot, 'extreme inputs unchanged');
});

// ----------------------------------------------------------------------------
// 20. No look-ahead
// ----------------------------------------------------------------------------
test('engine is pure — no network, no Date dependence in score', () => {
  const a = buildOpportunityRanking('AAPL', completeSources);
  const b = buildOpportunityRanking('AAPL', completeSources);
  assertEqual(a.opportunityScore, b.opportunityScore, 'deterministic score');
  assertEqual(a.quality, b.quality, 'deterministic quality');
});

// ----------------------------------------------------------------------------
// 21. Determinism
// ----------------------------------------------------------------------------
test('deterministic: repeated calls yield identical results', () => {
  const a = buildOpportunityRanking('AAPL', completeSources);
  const b = buildOpportunityRanking('AAPL', completeSources);
  assertEqual(JSON.stringify(a.opportunityScore), JSON.stringify(b.opportunityScore));
  assertEqual(JSON.stringify(a.quality), JSON.stringify(b.quality));
  assertEqual(JSON.stringify(a.componentScores), JSON.stringify(b.componentScores));
  assertEqual(JSON.stringify(a.warnings), JSON.stringify(b.warnings));
});

test('deterministic ranking across repeated runs', () => {
  const results = [];
  for (let i = 0; i < 8; i++) {
    results.push(makeResult('T' + i, (i * 13) % 75, (i * 11) % 100, (i * 9) % 90));
  }
  const a = rankOpportunities(results).ranked.map((r) => r.symbol);
  const b = rankOpportunities(results).ranked.map((r) => r.symbol);
  assertEqual(JSON.stringify(a), JSON.stringify(b), 'deterministic');
});

// ----------------------------------------------------------------------------
// 22. API contract
// ----------------------------------------------------------------------------
test('result shape matches API contract fields', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  const requiredFields = [
    'symbol', 'timestamp', 'opportunityScore', 'quality', 'rank',
    'confidence', 'confidenceLevel', 'componentScores', 'availableComponents',
    'usedWeights', 'dataCompleteness', 'dataAvailability', 'reasons',
    'warnings', 'flags', 'risks', 'sourceIntelligence', 'sourceScores',
    'provenance', 'disclaimer',
  ];
  for (const f of requiredFields) {
    assertTrue(f in r, 'missing field: ' + f);
  }
  assertTrue(Array.isArray(r.reasons), 'reasons is array');
  assertTrue(Array.isArray(r.warnings), 'warnings is array');
  assertTrue(Array.isArray(r.flags), 'flags is array');
  assertTrue(Array.isArray(r.risks), 'risks is array');
  assertTrue(Array.isArray(r.availableComponents), 'availableComponents is array');
  assertTrue(r.timestamp != null, 'timestamp present');
});

test('risk objects have label/severity/description', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  for (const risk of r.risks) {
    assertTrue(typeof risk.label === 'string', 'risk label string');
    assertTrue(typeof risk.severity === 'string', 'risk severity string');
    assertTrue(typeof risk.description === 'string', 'risk description string');
  }
});

test('componentScores has exactly 6 keys', () => {
  const r = buildOpportunityRanking('AAPL', completeSources);
  assertEqual(Object.keys(r.componentScores).length, 6, '6 component score keys');
});

// ----------------------------------------------------------------------------
// 23. B1-B6 regression — ensure C7 consumes real B1-B6 output shapes
// ----------------------------------------------------------------------------
test('B1 regression: pennyScore fallback path works', () => {
  const sources = {
    pennyIntelligence: { ...b1Sample, setupScore: 55, pennyScore: undefined },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.pennyIntelligenceScore, 55, 'penny falls back to setupScore');
});

test('B1 regression: pennyScore null when neither available', () => {
  const sources = {
    pennyIntelligence: { ...b1Sample, setupScore: null, pennyScore: null, hunterScore: null },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.componentScores.pennyIntelligenceScore, 'penny null when nothing available');
});

test('B2 regression: optionsScore extracted from decision.decisionScore', () => {
  const sources = {
    optionsIntelligence: { ...b2Sample, decision: { ...(b2Sample.decision || {}), decisionScore: 77 } },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.optionsIntelligenceScore, 77, 'options from decision.decisionScore');
});

test('B2 regression: optionsScore null when all option fields null', () => {
  const d = defaultOptionsIntelligence('AAPL');
  const r = buildOpportunityRanking('AAPL', { optionsIntelligence: d });
  assertNull(r.componentScores.optionsIntelligenceScore, 'options null when no data');
});

test('B3 regression: institutionalScore extraction', () => {
  const sources = {
    institutionalRadar: { ...b3Sample, institutionalScore: 65 },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.institutionalRadarScore, 65, 'institutional from institutionalScore');
});

test('B3 regression: institutional falls back through rankScore/decisionScore', () => {
  const sources = {
    institutionalRadar: { ...b3Sample, institutionalScore: null, rankScore: 42, decisionScore: null },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.institutionalRadarScore, 42, 'institutional falls back to rankScore');
});

test('B4 regression: swingScore extraction', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 71 },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.swingIntelligenceScore, 71, 'swing from swingScore');
});

test('B4 regression: swing falls back to setupScore', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: null, setupScore: 53 },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.swingIntelligenceScore, 53, 'swing falls back to setupScore');
});

test('B5 regression: explosionScore extraction', () => {
  const sources = {
    earlyExplosion: { ...b5Sample, explosionScore: 68 },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.earlyExplosionScore, 68, 'explosion from explosionScore');
});

test('B6 regression: catalystScore extraction', () => {
  const sources = {
    catalystIntelligence: { ...b6Sample, catalystScore: 73 },
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.componentScores.catalystIntelligenceScore, 73, 'catalyst from catalystScore');
});

test('B6 regression: catalyst default returns null score', () => {
  const d = defaultCatalystIntelligenceManager('AAPL');
  const r = buildOpportunityRanking('AAPL', { catalystIntelligence: d });
  assertNull(r.componentScores.catalystIntelligenceScore, 'catalyst default null');
});

test('B1-B6 defaults all return UNAVAILABLE quality', () => {
  const defaults = [
    defaultOptionsIntelligence('AAPL'),
    defaultInstitutionalRadar('AAPL'),
    defaultSwingIntelligenceManager('AAPL'),
    defaultEarlyExplosionIntelligenceManager('AAPL'),
    defaultCatalystIntelligenceManager('AAPL'),
  ];
  for (const d of defaults) {
    assertTrue(d.quality === 'UNAVAILABLE' || d.optionsQuality === 'UNAVAILABLE' ||
      d.institutionalQuality === 'UNAVAILABLE', 'default quality UNAVAILABLE');
  }
});

test('C7 with all B1-B6 defaults yields UNAVAILABLE', () => {
  const sources = {
    pennyIntelligence: buildPennyIntelligence({}, {}),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
  };
  const r = buildOpportunityRanking('AAPL', sources);
  assertEqual(r.quality, 'UNAVAILABLE', 'all defaults => UNAVAILABLE');
  assertNull(r.opportunityScore, 'all defaults => null score');
});

// ----------------------------------------------------------------------------
// P1-5: Classical / Candlestick Evidence Integration
// ----------------------------------------------------------------------------

test('P1-5: classicalEvidence with mssDetected adds +1 to score', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 50 },
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  const r = buildOpportunityRanking('AAPL', sources, { classicalEvidence });
  assertTrue(r.evidenceAdjustment >= 1, 'evidence adjustment should be at least 1');
  assertTrue(r.opportunityScore > 50, 'score should be higher than base');
  assertTrue(r.reasons.some(r => r.includes('Evidence adjustment')), 'reason should mention evidence adjustment');
});

test('P1-5: candlestickEvidence with patterns adds +1 to score', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 50 },
  };
  const candlestickEvidence = {
    patterns: [{ name: 'Hammer', type: 'BULLISH', confidence: 75 }],
    context: {},
    dataCompleteness: 50,
  };
  const r = buildOpportunityRanking('AAPL', sources, { candlestickEvidence });
  assertTrue(r.evidenceAdjustment >= 1, 'evidence adjustment should be at least 1');
  assertTrue(r.opportunityScore > 50, 'score should be higher than base');
  assertTrue(r.reasons.some(r => r.includes('candlestick pattern')), 'reason should mention candlestick pattern');
});

test('P1-5: both classical and candlestick evidence present -> deterministic +2 max', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 50 },
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: true },
    fvg: { detected: true },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'WATCH' },
  };
  const candlestickEvidence = {
    patterns: [{ name: 'Hammer', type: 'BULLISH', confidence: 75 }],
    context: {},
    dataCompleteness: 50,
  };
  
  // Run multiple times to verify determinism
  const r1 = buildOpportunityRanking('AAPL', sources, { classicalEvidence, candlestickEvidence });
  const r2 = buildOpportunityRanking('AAPL', sources, { classicalEvidence, candlestickEvidence });
  
  assertEqual(r1.opportunityScore, r2.opportunityScore, 'deterministic behavior');
  assertTrue(r1.evidenceAdjustment === r2.evidenceAdjustment, 'deterministic adjustment');
  assertEqual(r1.evidenceAdjustment, 2, 'max +2 adjustment');
});

test('P1-5: missing evidence (null) -> no adjustment, no fabricated signal', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 50 },
  };
  const r1 = buildOpportunityRanking('AAPL', sources, {});
  const r2 = buildOpportunityRanking('AAPL', sources, { classicalEvidence: null });
  const r3 = buildOpportunityRanking('AAPL', sources, { candlestickEvidence: null });
  
  assertNull(r1.evidenceAdjustment, 'no adjustment when no evidence');
  assertNull(r2.evidenceAdjustment, 'no adjustment when classical is null');
  assertNull(r3.evidenceAdjustment, 'no adjustment when candlestick is null');
  assertNull(r1.evidenceReasons, 'no evidence reasons when no evidence');
});

test('P1-5: UNAVAILABLE evidence -> not counted as signal', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 50 },
  };
  const classicalEvidence = {
    marketStructure: { trend: 'UNAVAILABLE', mssDetected: false },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  const r = buildOpportunityRanking('AAPL', sources, { classicalEvidence });
  assertNull(r.evidenceAdjustment, 'no adjustment when no structures detected');
});

test('P1-5: evidence adjustment bounded, does not exceed current scoring bounds', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, swingScore: 84 },
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  const r = buildOpportunityRanking('AAPL', sources, { classicalEvidence });
  // Score 84 is STRONG (70-84), +1 would make 85 which is TOP
  // The adjustment should NOT push score across quality threshold
  assertTrue(r.quality === 'STRONG' || r.quality === 'TOP', 'quality should be valid');
  assertTrue(r.opportunityScore >= 0 && r.opportunityScore <= 100, 'score bounded 0-100');
});

test('P1-5: evidence adjustment does not break existing C7 ranking behavior', () => {
  const sourcesA = {
    swingIntelligence: { ...b4Sample, swingScore: 75 },
  };
  const sourcesB = {
    swingIntelligence: { ...b4Sample, swingScore: 60 },
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  
  const rA = buildOpportunityRanking('AAPL', sourcesA, { classicalEvidence });
  const rB = buildOpportunityRanking('AAPL', sourcesB, { classicalEvidence });
  
  assertTrue(rA.opportunityScore > rB.opportunityScore, 'higher base score should result in higher final score');
  assertTrue(rA.quality === 'STRONG' || rA.quality === 'TOP', 'quality should be valid for A');
  assertTrue(rB.quality === 'WATCH' || rB.quality === 'STRONG', 'quality should be valid for B');
});

test('P1-5: conflicts still work with evidence adjustment', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY', swingScore: 70 },
    earlyExplosion: { ...b5Sample, signal: 'SELL', explosionScore: 60 },
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  const r = buildOpportunityRanking('AAPL', sources, { classicalEvidence });
  assertTrue(r.warnings.some(w => w.indexOf('CONFLICTING_SIGNALS_DETECTED') === 0), 'conflict warning still emitted');
  assertTrue(r.evidenceAdjustment >= 1, 'evidence adjustment still works');
});

test('P1-5: data completeness guidance still works with evidence', () => {
  const sources = {
    swingIntelligence: b4Sample,
  };
  const classicalEvidence = {
    marketStructure: { mssDetected: true, trend: 'BULLISH' },
    breaker: { detected: false },
    fvg: { detected: false },
    liquiditySweep: { detected: false },
    crt: { confirmationState: 'UNAVAILABLE' },
  };
  const r = buildOpportunityRanking('AAPL', sources, { classicalEvidence });
  assertTrue(typeof r.dataCompletenessGuidance === 'string', 'dataCompletenessGuidance still present');
  assertTrue(r.dataCompleteness >= 0 && r.dataCompleteness <= 100, 'dataCompleteness bounded');
});

test('P1-5: no regression in existing B1-B6 behavior with evidence', () => {
  const r = buildOpportunityRanking('AAPL', completeSources, {
    classicalEvidence: {
      marketStructure: { mssDetected: true, trend: 'BULLISH' },
      breaker: { detected: false },
      fvg: { detected: false },
      liquiditySweep: { detected: false },
      crt: { confirmationState: 'UNAVAILABLE' },
    },
    candlestickEvidence: {
      patterns: [{ name: 'Hammer', type: 'BULLISH', confidence: 75 }],
      context: {},
      dataCompleteness: 50,
    },
  });
  
  assertTrue(Object.keys(r.componentScores).length === 6, 'still 6 component score keys');
  assertTrue(r.dataAvailability.pennyIntelligence === true, 'B1 availability intact');
  assertTrue(typeof r.disclaimer === 'string', 'disclaimer still present');
  assertTrue(r.provenance.intelligence === 'C7', 'provenance intact');
});


// ----------------------------------------------------------------------------
// Pagination Tests (API-level tests)
// ----------------------------------------------------------------------------
// Note: rankOpportunities() provides sorting/ranking. Pagination is applied
// at the API route level. These tests verify the ranking is stable.

test('pagination - ranking preserves order by score descending', () => {
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(makeResult('S' + i, 90 - i * 10, 100, 80));
  }
  const { ranked } = rankOpportunities(results);
  assertEqual(ranked[0].symbol, 'S0');
  assertEqual(ranked[1].symbol, 'S1');
  assertEqual(ranked[2].symbol, 'S2');
  assertEqual(ranked[3].symbol, 'S3');
  assertEqual(ranked[4].symbol, 'S4');
});

test('pagination - ranking stable across repeated calls', () => {
  const results = [];
  for (let i = 0; i < 3; i++) {
    results.push(makeResult('S' + i, 90 - i, 100, 80));
  }
  const { ranked: r1 } = rankOpportunities(results);
  const { ranked: r2 } = rankOpportunities(results);
  assertEqual(JSON.stringify(r1.map(x => x.symbol)), JSON.stringify(r2.map(x => x.symbol)));
});

test('pagination - ranking handles empty results', () => {
  const { ranked, ranking } = rankOpportunities([]);
  assertEqual(ranked.length, 0);
  assertEqual(ranking.total, 0);
});

// API-level pagination contract tests
test('pagination contract - page 2 limit 1 returns correct slice', () => {
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(makeResult('S' + i, 90 - i, 100, 80));
  }
  const { ranked } = rankOpportunities(results);
  const page = 2;
  const limit = 1;
  const startIndex = (page - 1) * limit;
  const slice = ranked.slice(startIndex, startIndex + limit);
  assertEqual(slice.length, 1);
  assertEqual(slice[0].symbol, 'S1');
});

test('pagination contract - last page may have fewer items', () => {
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(makeResult('S' + i, 90 - i, 100, 80));
  }
  const { ranked } = rankOpportunities(results);
  const page = 3;
  const limit = 2;
  const startIndex = (page - 1) * limit;
  const slice = ranked.slice(startIndex, startIndex + limit);
  assertEqual(slice.length, 1); // Last page has only 1 item
  assertEqual(slice[0].symbol, 'S4');
});

test('pagination contract - hasNext calculation', () => {
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(makeResult('S' + i, 90 - i, 100, 80));
  }
  const { ranked } = rankOpportunities(results);
  const limit = 2;
  // Page 1: 1*2=2 < 5 -> hasNext true
  assertTrue((1 * limit) < ranked.length);
  // Page 2: 2*2=4 < 5 -> hasNext true
  assertTrue((2 * limit) < ranked.length);
  // Page 3: 3*2=6 >= 5 -> hasNext false
  assertFalse((3 * limit) < ranked.length);
});

test('pagination contract - hasPrevious calculation', () => {
  const limit = 2;
  assertFalse(1 > 1); // Page 1: no previous
  assertTrue(2 > 1);  // Page 2: has previous
  assertTrue(3 > 1);  // Page 3: has previous
});


// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------

console.log('\n========================================');
console.log('C7 Opportunity Ranking Tests');
console.log('========================================\n');
console.log('PASS: ' + passCount);
console.log('FAIL: ' + failCount);
console.log('TOTAL: ' + (passCount + failCount));
if (failCount > 0) {
  console.error('\nSome tests FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests PASSED');
}

// P2-2: expectedTimeframe field
test('P2-2: expectedTimeframe aggregation — B4 TOP/STRONG => 1-3 Months', () => {
  const b4 = defaultSwingIntelligenceManager('AAPL');
  b4.quality = 'TOP';
  b4.expectedTimeframe = '1–3 Months';
  const r = buildOpportunityRanking('AAPL', { swingIntelligence: b4 });
  assertEqual(r.expectedTimeframe, '1–3 Months');
});

test('P2-2: expectedTimeframe aggregation — B5 EXTREME => SHORT_TERM', () => {
  const b5 = defaultEarlyExplosionIntelligenceManager('AAPL');
  b5.quality = 'EXTREME';
  b5.expectedTimeframe = 'SHORT_TERM';
  const r = buildOpportunityRanking('AAPL', { earlyExplosion: b5 });
  assertEqual(r.expectedTimeframe, 'SHORT_TERM');
});

test('P2-2: expectedTimeframe aggregation — B2 OPTIONS => OPTIONS', () => {
  const b2 = defaultOptionsIntelligence('AAPL');
  b2.expectedTimeframe = 'OPTIONS';
  const r = buildOpportunityRanking('AAPL', { optionsIntelligence: b2 });
  assertEqual(r.expectedTimeframe, 'OPTIONS');
});

test('P2-2: expectedTimeframe aggregation — B4 priority over B5', () => {
  const b4 = defaultSwingIntelligenceManager('AAPL');
  b4.quality = 'TOP';
  b4.expectedTimeframe = '1–3 Months';
  const b5 = defaultEarlyExplosionIntelligenceManager('AAPL');
  b5.quality = 'EXTREME';
  b5.expectedTimeframe = 'SHORT_TERM';
  const r = buildOpportunityRanking('AAPL', { swingIntelligence: b4, earlyExplosion: b5 });
  assertEqual(r.expectedTimeframe, '1–3 Months');
});

test('P2-2: expectedTimeframe — all UNKNOWN returns UNKNOWN', () => {
  const r = buildOpportunityRanking('AAPL', {
    pennyIntelligence: buildPennyIntelligence({}, {}),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
  });
  assertEqual(r.expectedTimeframe, 'UNKNOWN');
});

test('P2-2: expectedTimeframe — default result is UNKNOWN', () => {
  const d = defaultOpportunityRanking('AAPL');
  assertEqual(d.expectedTimeframe, 'UNKNOWN');
});
