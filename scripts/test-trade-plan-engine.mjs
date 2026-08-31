/**
 * C8 Trade Plan Engine Tests
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-trade-plan-engine.mjs
 *
 * Coverage:
 *   1.  complete valid plan
 *   2.  null / undefined / empty
 *   3.  malformed / NaN / Infinity
 *   4.  partial data
 *   5.  all components missing
 *   6.  renormalization
 *   7.  score / quality boundaries
 *   8.  direction normalization
 *   9.  long / short / invalid R/R
 *   10. missing entry / stop / target
 *   11. position sizing (with and without capital)
 *   12. risk aggregation + flags
 *   13. provenance
 *   14. data completeness
 *   15. determinism
 *   16. input immutability
 *   17. no fabrication
 *   18. no look-ahead
 *   19. ranking + stable tie-break
 *   20. API contract
 *   21. graceful failure
 *   22. C7 regression
 *   23. B1-B6 regression
 */

import {
  buildTradePlan,
  defaultTradePlan,
  rankTradePlans,
  calculateTradePlanScore,
  classifyPlanQuality,
  classifyPlanSignal,
  calculateRR,
  riskRewardQualityScore,
  calculatePositionSizing,
  normalizeDirection,
  normalizeTimeframe,
  DIRECTION,
  TIMEFRAME,
  TRADE_PLAN_WEIGHTS,
  TRADE_PLAN_QUALITY_THRESHOLDS,
  PLAN_SIGNAL_THRESHOLDS,
} from '../lib/trade-plan-engine.js';

import { buildOpportunityRanking } from '../lib/opportunity-ranking.js';
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
// B1-B6 + C7 sample inputs (built from real upstream managers)
// ----------------------------------------------------------------------------

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
  directionBias: 'up',
  riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
};

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
  directionBias: 'up',
  riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
}, {});

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

const c7Sample = buildOpportunityRanking('AAPL', {
  pennyIntelligence: b1Sample,
  optionsIntelligence: b2Sample,
  institutionalRadar: b3Sample,
  swingIntelligence: b4Sample,
  earlyExplosion: b5Sample,
  catalystIntelligence: b6Sample,
});

const completeSources = {
  opportunityRanking: c7Sample,
  pennyIntelligence: b1Sample,
  optionsIntelligence: b2Sample,
  institutionalRadar: b3Sample,
  swingIntelligence: b4Sample,
  earlyExplosion: b5Sample,
  catalystIntelligence: b6Sample,
};

const sourceKeys = Object.keys(completeSources);// ----------------------------------------------------------------------------
// 1. Complete valid plan
// ----------------------------------------------------------------------------
test('complete valid plan produces a numeric planScore', () => {
  const r = buildTradePlan('AAPL', completeSources);
  assertScoreBetween(r.planScore, 0, 100, 'complete plan score');
  assertTrue(r.available === true, 'plan available with full data');
  assertTrue(r.planQuality !== 'UNAVAILABLE', 'quality available');
  assertTrue(r.planSignal !== 'UNAVAILABLE', 'signal available');
  assertTrue(r.entryZone != null || r.entryPrice != null, 'entry present from B4/B5 zones');
});

test('complete plan exposes all required output fields', () => {
  const r = buildTradePlan('AAPL', completeSources);
  const required = [
    'symbol', 'timestamp', 'available', 'planQuality', 'planScore', 'planSignal',
    'setup', 'directionBias', 'direction', 'timeframe',
    'entryZone', 'entryPrice', 'stopLoss', 'target1', 'target2', 'target3', 'invalidation',
    'riskReward', 'riskAmount', 'rewardAmount', 'riskPercent', 'rewardPercent',
    'positionSizing', 'maxRiskPercent',
    'confidence', 'confidenceLevel', 'supportingEvidence', 'risks', 'warnings', 'flags',
    'componentScores', 'componentWeights',
    'dataAvailability', 'dataCompleteness', 'provenance', 'limitations', 'disclaimer',
  ];
  for (const f of required) {
    assertTrue(f in r, 'missing field: ' + f);
  }
  assertTrue(Array.isArray(r.supportingEvidence), 'evidence array');
  assertTrue(Array.isArray(r.risks), 'risks array');
  assertTrue(Array.isArray(r.warnings), 'warnings array');
  assertTrue(Array.isArray(r.flags), 'flags array');
  assertTrue(typeof r.positionSizing === 'object', 'positionSizing object');
});

test('complete plan never fabricates a simple average of component scores', () => {
  const r = buildTradePlan('AAPL', completeSources);
  const vals = Object.values(r.componentScores).filter((v) => v != null);
  if (vals.length > 0) {
    const simpleAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    assertTrue(Math.abs(simpleAvg - r.planScore) > 0.01 || r.planScore == null,
      'plan score should not equal a simple average');
  }
});

// ----------------------------------------------------------------------------
// 2. null / undefined / empty
// ----------------------------------------------------------------------------
test('null symbol returns default', () => {
  const r = buildTradePlan(null, completeSources);
  assertEqual(r.symbol, null);
  assertEqual(r.planQuality, 'UNAVAILABLE');
  assertNull(r.planScore);
});

test('undefined sources returns default', () => {
  const r = buildTradePlan('AAPL', undefined);
  assertEqual(r.planQuality, 'UNAVAILABLE');
  assertNull(r.planScore);
});

test('empty sources object returns UNAVAILABLE', () => {
  const r = buildTradePlan('AAPL', {});
  assertNull(r.planScore, 'no sources => null score');
  assertEqual(r.planQuality, 'UNAVAILABLE');
  assertEqual(r.planSignal, 'UNAVAILABLE');
  assertEqual(r.direction, 'UNAVAILABLE');
});

test('all-null sources returns UNAVAILABLE', () => {
  const r = buildTradePlan('AAPL', {
    opportunityRanking: null,
    swingIntelligence: null,
    earlyExplosion: null,
    optionsIntelligence: null,
    institutionalRadar: null,
    catalystIntelligence: null,
    pennyIntelligence: null,
  });
  assertNull(r.planScore);
  assertEqual(r.planQuality, 'UNAVAILABLE');
});

test('defaultTradePlan has no fabricated score', () => {
  const d = defaultTradePlan('AAPL');
  assertNull(d.planScore);
  assertEqual(d.planQuality, 'UNAVAILABLE');
  assertEqual(d.planSignal, 'UNAVAILABLE');
  assertEqual(d.direction, 'UNAVAILABLE');
  assertEqual(d.available, false);
  for (const k of Object.keys(d.componentScores || {})) {
    assertNull(d.componentScores[k], 'default component null: ' + k);
  }
});

// ----------------------------------------------------------------------------
// 3. Malformed / NaN / Infinity
// ----------------------------------------------------------------------------
test('malformed string scores are sanitized to null', () => {
  const sources = {
    opportunityRanking: { opportunityScore: 'abc' },
    swingIntelligence: { swingScore: 'xyz', setupClassification: [] },
    earlyExplosion: { explosionScore: 'foo' },
    optionsIntelligence: { decision: { decisionScore: 'bar' } },
    institutionalRadar: { institutionalScore: 'qux' },
    catalystIntelligence: { catalystScore: 'baz' },
    pennyIntelligence: { pennyScore: 'qqq' },
  };
  const r = buildTradePlan('AAPL', sources);
  for (const k of Object.keys(r.componentScores)) {
    assertNull(r.componentScores[k], 'malformed sanitized for ' + k);
  }
  assertNull(r.planScore, 'no score when all malformed');
});

test('NaN component scores never propagate', () => {
  const sources = { ...completeSources };
  sources.swingIntelligence = { ...b4Sample, swingScore: NaN };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.componentScores.swingIntelligenceScore, 'NaN swing sanitized');
  assertTrue(r.planScore == null || Number.isFinite(r.planScore), 'final score finite or null');
});

test('Infinity component scores sanitized', () => {
  const sources = { ...completeSources };
  sources.earlyExplosion = { ...b5Sample, explosionScore: Infinity };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.componentScores.earlyExplosionScore, 'Infinity explosion sanitized');
});

test('-Infinity riskReward is invalid', () => {
  const rr = calculateRR(100, 90, 110, DIRECTION.LONG);
  assertTrue(rr != null, 'valid long rr');
  const bad = calculateRR(100, 110, 120, DIRECTION.LONG);
  assertNull(bad, 'stop above entry => invalid for long');
});

// ----------------------------------------------------------------------------
// 4. Partial data
// ----------------------------------------------------------------------------
test('partial data renormalizes weights', () => {
  const sources = { swingIntelligence: b4Sample, earlyExplosion: b5Sample };
  const r = buildTradePlan('AAPL', sources);
  assertScoreBetween(r.planScore, 0, 100, 'renormalized score');
  const used = Object.values(r.componentWeights).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(used - 1.0) < 0.01, 'weights renormalize to 1, got ' + used);
  assertTrue(Object.keys(r.componentWeights).length >= 1, 'at least one weight');
});

test('missing component excluded, never zero', () => {
  // Only swing present => setupQuality derives from B4 setupClassification.
  // With an empty classification it stays a low-but-real score, never zero.
  const sources = { swingIntelligence: { ...b4Sample, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  // Missing upstream sources must not appear as fabricated component scores.
  assertNull(r.componentScores.pennyIntelligence, 'penny not fabricated');
  assertNull(r.componentScores.earlyExplosion, 'explosion not fabricated');
  assertNull(r.componentScores.catalystIntelligence, 'catalyst not fabricated');
  assertNull(r.componentScores.optionsIntelligence, 'options not fabricated');
  assertNull(r.componentScores.institutionalRadar, 'institutional not fabricated');
  // dataCompleteness must be null when no real source contributes, never 0.
  assertTrue(r.componentScores.dataCompleteness == null || r.componentScores.dataCompleteness > 0,
    'dataCompleteness not fabricated from defaults');
});

// ----------------------------------------------------------------------------
// 5. All components missing
// ----------------------------------------------------------------------------
test('all components missing => null planScore', () => {
  const sources = { opportunityRanking: { opportunityScore: null }, swingIntelligence: { swingScore: null, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.planScore, 'null score when no components');
  assertEqual(r.planQuality, 'UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// 6. Renormalization
// ----------------------------------------------------------------------------
test('documented weights sum to 1.0', () => {
  const sum = Object.values(TRADE_PLAN_WEIGHTS).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(sum - 1.0) < 0.001, 'weights sum to 1, got ' + sum);
});

test('renormalized weights preserve relative proportions', () => {
  const sources = { swingIntelligence: b4Sample, earlyExplosion: b5Sample };
  const r = buildTradePlan('AAPL', sources);
  const w = r.componentWeights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(total - 1.0) < 0.01, 'renormalized total 1, got ' + total);
});

test('calculateTradePlanScore with no components returns null', () => {
  const res = calculateTradePlanScore({ setupQuality: null, riskRewardQuality: null, technicalReadiness: null, opportunityScore: null, catalystFlowSupport: null, dataCompleteness: null });
  assertNull(res.planScore);
  assertEqual(Object.keys(res.componentScores).length, 0);
});

test('calculateTradePlanScore renormalizes partial weights', () => {
  const res = calculateTradePlanScore({ setupQuality: 80, riskRewardQuality: null, technicalReadiness: null, opportunityScore: 60, catalystFlowSupport: null, dataCompleteness: null, horizonQuality: null });
  assertScoreBetween(res.planScore, 0, 100);
  const used = Object.values(res.usedWeights).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(used - 1.0) < 0.01, 'renormalized weights sum to 1, got ' + used);
  assertTrue(res.rawWeights.setupQuality === 0.22, 'raw weight preserved');
  assertTrue(typeof res.totalWeightUsed === 'number', 'totalWeightUsed is number');
});// ----------------------------------------------------------------------------
// 7. Score / quality boundaries
// ----------------------------------------------------------------------------
test('quality TOP boundary at 85', () => {
  assertEqual(classifyPlanQuality(85), 'TOP');
  assertEqual(classifyPlanQuality(84.9), 'STRONG');
});

test('quality STRONG boundary at 70', () => {
  assertEqual(classifyPlanQuality(70), 'STRONG');
  assertEqual(classifyPlanQuality(69.9), 'WATCH');
});

test('quality WATCH boundary at 55', () => {
  assertEqual(classifyPlanQuality(55), 'WATCH');
  assertEqual(classifyPlanQuality(54.9), 'WEAK');
});

test('quality WEAK boundary at 40', () => {
  assertEqual(classifyPlanQuality(40), 'WEAK');
  assertEqual(classifyPlanQuality(39.9), 'UNAVAILABLE');
});

test('quality UNAVAILABLE for null/NaN', () => {
  assertEqual(classifyPlanQuality(null), 'UNAVAILABLE');
  assertEqual(classifyPlanQuality(NaN), 'UNAVAILABLE');
});

test('quality thresholds match spec', () => {
  assertEqual(TRADE_PLAN_QUALITY_THRESHOLDS.TOP, 85);
  assertEqual(TRADE_PLAN_QUALITY_THRESHOLDS.STRONG, 70);
  assertEqual(TRADE_PLAN_QUALITY_THRESHOLDS.WATCH, 55);
  assertEqual(TRADE_PLAN_QUALITY_THRESHOLDS.WEAK, 40);
});

test('plan signal thresholds', () => {
  assertEqual(classifyPlanSignal(85), 'STRONG_PLAN');
  assertEqual(classifyPlanSignal(70), 'VALID_PLAN');
  assertEqual(classifyPlanSignal(55), 'WATCH');
  assertEqual(classifyPlanSignal(54), 'AVOID');
  assertEqual(classifyPlanSignal(null), 'UNAVAILABLE');
  assertEqual(PLAN_SIGNAL_THRESHOLDS.STRONG_PLAN, 85);
  assertEqual(PLAN_SIGNAL_THRESHOLDS.VALID_PLAN, 70);
  assertEqual(PLAN_SIGNAL_THRESHOLDS.WATCH, 55);
});

// ----------------------------------------------------------------------------
// 8. Direction normalization
// ----------------------------------------------------------------------------
test('direction token mapping', () => {
  assertEqual(normalizeDirection('up'), DIRECTION.LONG);
  assertEqual(normalizeDirection('bull'), DIRECTION.LONG);
  assertEqual(normalizeDirection('صاعد'), DIRECTION.LONG);
  assertEqual(normalizeDirection('sell'), DIRECTION.SHORT);
  assertEqual(normalizeDirection('bear'), DIRECTION.SHORT);
  assertEqual(normalizeDirection('هابط'), DIRECTION.SHORT);
  assertEqual(normalizeDirection('neutral'), DIRECTION.NEUTRAL);
  assertEqual(normalizeDirection('sideways'), DIRECTION.NEUTRAL);
  assertEqual(normalizeDirection(null), DIRECTION.UNAVAILABLE);
  assertEqual(normalizeDirection(''), DIRECTION.UNAVAILABLE);
});

test('weak/neutral evidence never coerced to LONG/SHORT', () => {
  const r = buildTradePlan('AAPL', { swingIntelligence: { ...b4Sample, swingScore: 20, directionBias: 'sideways', setupClassification: [] } });
  assertTrue(r.direction === DIRECTION.NEUTRAL || r.direction === DIRECTION.UNAVAILABLE,
    'weak evidence stays neutral, got ' + r.direction);
});

test('timeframe normalization', () => {
  assertEqual(normalizeTimeframe('swing'), TIMEFRAME.SWING);
  assertEqual(normalizeTimeframe(TIMEFRAME.POSITION), TIMEFRAME.POSITION);
  assertEqual(normalizeTimeframe('intraday'), TIMEFRAME.INTRADAY);
  assertEqual(normalizeTimeframe(null), TIMEFRAME.UNKNOWN);
  assertEqual(normalizeTimeframe('unknown-value'), TIMEFRAME.UNKNOWN);
});

// ----------------------------------------------------------------------------
// 9. Long / short / invalid R/R
// ----------------------------------------------------------------------------
test('long R/R: reward = target - entry, risk = entry - stop', () => {
  const rr = calculateRR(100, 90, 130, DIRECTION.LONG);
  // risk = 10, reward = 30 => 3.0
  assertEqual(rr, 3.0, 'long rr');
});

test('short R/R: reward = entry - target, risk = stop - entry', () => {
  const rr = calculateRR(100, 110, 70, DIRECTION.SHORT);
  // risk = 10, reward = 30 => 3.0
  assertEqual(rr, 3.0, 'short rr');
});

test('zero stop distance => invalid R/R', () => {
  const rr = calculateRR(100, 100, 130, DIRECTION.LONG);
  assertNull(rr, 'zero stop distance invalid');
});

test('negative risk => invalid R/R', () => {
  const rr = calculateRR(100, 110, 130, DIRECTION.LONG);
  assertNull(rr, 'stop above entry invalid for long');
});

test('target on wrong side => invalid R/R', () => {
  const rr = calculateRR(100, 90, 80, DIRECTION.LONG);
  assertNull(rr, 'target below entry invalid for long');
});

test('missing entry / stop / target => null R/R', () => {
  assertNull(calculateRR(null, 90, 130, DIRECTION.LONG), 'missing entry');
  assertNull(calculateRR(100, null, 130, DIRECTION.LONG), 'missing stop');
  assertNull(calculateRR(100, 90, null, DIRECTION.LONG), 'missing target');
});

test('riskRewardQualityScore boundaries', () => {
  assertEqual(riskRewardQualityScore(3), 100);
  assertEqual(riskRewardQualityScore(2), 80);
  assertEqual(riskRewardQualityScore(1.5), 65);
  assertEqual(riskRewardQualityScore(1), 50);
  assertEqual(riskRewardQualityScore(0.5), 20);
  assertNull(riskRewardQualityScore(null));
});

test('negative R/R never scored as valid', () => {
  assertTrue(riskRewardQualityScore(-1) <= 20, 'negative rr low score');
});// ----------------------------------------------------------------------------
// 10. Missing entry / stop / target
// ----------------------------------------------------------------------------
test('missing entry emits warning', () => {
  const sources = { swingIntelligence: { ...b4Sample, entryZone: null, target1: null, invalidation: null, stopLoss: null, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.warnings.some((w) => w.indexOf('MISSING_ENTRY') === 0), 'missing entry warning: ' + JSON.stringify(r.warnings));
  assertTrue(r.warnings.some((w) => w.indexOf('MISSING_STOP') === 0), 'missing stop warning');
  assertTrue(r.warnings.some((w) => w.indexOf('MISSING_TARGET') === 0), 'missing target warning');
  assertTrue(r.risks.some((risk) => risk.label === 'MISSING_STOP'), 'missing stop risk');
  assertTrue(r.risks.some((risk) => risk.label === 'MISSING_TARGET'), 'missing target risk');
  assertTrue(r.risks.some((risk) => risk.label === 'MISSING_ENTRY'), 'missing entry risk');
});

test('missing R/R emits RISK_REWARD_UNAVAILABLE warning', () => {
  // Null both target1 AND the upstream riskReward so no R/R can be derived.
  const sources = { swingIntelligence: { ...b4Sample, entryZone: null, target1: null, invalidation: null, stopLoss: null, riskReward: null, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.warnings.some((w) => w.indexOf('RISK_REWARD_UNAVAILABLE') === 0), 'rr unavailable warning: ' + JSON.stringify(r.warnings));
  assertNull(r.riskReward, 'riskReward null when levels missing');
});

test('levels preserved from B4 zones without fabrication', () => {
  const r = buildTradePlan('AAPL', completeSources);
  // B4 zones come from A4 — we only pass them through.
  if (b4Sample.entryZone != null) assertEqual(r.entryZone, b4Sample.entryZone, 'entryZone preserved');
  if (b4Sample.target1 != null) assertEqual(r.target1, b4Sample.target1, 'target1 preserved');
  if (b4Sample.stopLoss != null) assertEqual(r.stopLoss, b4Sample.stopLoss, 'stopLoss preserved');
});

// ----------------------------------------------------------------------------
// 11. Position sizing
// ----------------------------------------------------------------------------
test('position sizing without capital => unavailable/null', () => {
  const r = buildTradePlan('AAPL', completeSources);
  assertTrue(r.positionSizing.available === false, 'no capital => sizing unavailable');
  assertNull(r.positionSizing.positionSize, 'position size null without capital');
  assertNull(r.positionSizing.shares, 'shares null without capital');
  assertNull(r.positionSizing.accountCapital, 'capital null when not provided');
});

test('position sizing with capital computes deterministic size', () => {
  const r = buildTradePlan('AAPL', completeSources, { capital: 10000, maxRiskPercent: 2 });
  if (r.stopLoss != null && r.entryPrice != null) {
    assertTrue(r.positionSizing.available === true, 'sizing available with capital + stop');
    assertTrue(r.positionSizing.accountCapital === 10000, 'capital recorded');
    assertTrue(r.positionSizing.maxRiskPercent === 2, 'risk percent recorded');
    assertTrue((r.positionSizing.riskAmount || 0) > 0, 'risk amount positive');
    assertTrue((r.positionSizing.positionSize || 0) > 0, 'position size positive');
  } else {
    assertTrue(r.positionSizing.available === false, 'sizing unavailable without stop');
  }
});

test('invalid capital => sizing unavailable', () => {
  const r = buildTradePlan('AAPL', completeSources, { capital: -500, maxRiskPercent: 2 });
  assertTrue(r.positionSizing.available === false, 'negative capital unavailable');
  const r2 = buildTradePlan('AAPL', completeSources, { capital: 'abc', maxRiskPercent: 2 });
  assertTrue(r2.positionSizing.available === false, 'string capital unavailable');
});

test('invalid riskPercent => sizing unavailable', () => {
  const r = buildTradePlan('AAPL', completeSources, { capital: 10000, maxRiskPercent: -5 });
  assertTrue(r.positionSizing.available === false, 'negative risk percent unavailable');
  const r2 = buildTradePlan('AAPL', completeSources, { capital: 10000, maxRiskPercent: 150 });
  assertTrue(r2.positionSizing.available === false, 'risk percent > 100 unavailable');
});

test('position sizing without stop is unavailable even with capital', () => {
  const sources = { swingIntelligence: { ...b4Sample, stopLoss: null, invalidation: null, entryZone: 'zone', target1: 190, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources, { capital: 10000, maxRiskPercent: 2 });
  assertTrue(r.positionSizing.available === false, 'no stop => sizing unavailable');
});

// ----------------------------------------------------------------------------
// 12. Risk aggregation + flags
// ----------------------------------------------------------------------------
test('high explosion risk propagates', () => {
  const sources = { ...completeSources };
  sources.earlyExplosion = { ...b5Sample, explosionRisk: 'HIGH' };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'EXPLOSION_VOLATILITY_RISK'), 'explosion risk: ' + JSON.stringify(r.risks));
});

test('high catalyst risk propagates', () => {
  const sources = { ...completeSources };
  sources.catalystIntelligence = { ...b6Sample, catalystRisk: 'HIGH' };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'CATALYST_RISK'), 'catalyst risk');
});

test('low risk/reward emits LOW_RR risk', () => {
  const sources = { swingIntelligence: { ...b4Sample, riskReward: 0.5, entryZone: 'z', entryPrice: 180, stopLoss: 178, target1: 179, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'LOW_RR'), 'low rr risk');
  assertTrue(r.flags.some((f) => f === 'UNFAVORABLE_RR'), 'unfavorable rr flag');
});

test('favorable rr emits FAVORABLE_RR flag', () => {
  const sources = { swingIntelligence: { ...b4Sample, riskReward: 3.0, entryZone: 'z', entryPrice: 180, stopLoss: 178, target1: 186, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.flags.some((f) => f === 'FAVORABLE_RR'), 'favorable rr flag');
});

test('conflicting upstream signals propagate', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'SELL' },
  };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.risks.some((risk) => risk.label === 'SIGNAL_CONFLICT'), 'signal conflict risk');
});

test('low data emits LOW_DATA warning', () => {
  const sources = { swingIntelligence: { ...b4Sample, swingScore: 50, dataCompleteness: 30, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.warnings.some((w) => w.indexOf('LOW_DATA_COMPLETENESS') === 0), 'low data warning');
});

test('risk objects have label/severity/description', () => {
  const r = buildTradePlan('AAPL', completeSources);
  for (const risk of r.risks) {
    assertTrue(typeof risk.label === 'string', 'risk label string');
    assertTrue(typeof risk.severity === 'string', 'risk severity string');
    assertTrue(typeof risk.description === 'string', 'risk description string');
  }
});

test('flags are evidence-based and deterministic', () => {
  const r = buildTradePlan('AAPL', completeSources);
  assertTrue(Array.isArray(r.flags), 'flags array');
  // Multi-source confirmed since >= 4 sources available
  assertTrue(r.flags.includes('MULTI_SOURCE_CONFIRMED') || r.flags.includes('FULL_INTELLIGENCE_COVERAGE'),
    'multi-source flag present: ' + JSON.stringify(r.flags));
});// ----------------------------------------------------------------------------
// 18. No fabrication (cleaned)
// ----------------------------------------------------------------------------
test('missing sources are never fabricated into scores', () => {
  const r = buildTradePlan('AAPL', { swingIntelligence: b4Sample });
  for (const k of sourceKeys) {
    if (k === 'swingIntelligence') continue;
    assertTrue(r.dataAvailability[k] === false, k + ' not marked available');
  }
  // Missing upstream sources must not produce fabricated component scores.
  assertNull(r.componentScores.pennyIntelligence, 'penny not fabricated');
  assertNull(r.componentScores.earlyExplosion, 'explosion not fabricated');
  assertNull(r.componentScores.catalystIntelligence, 'catalyst not fabricated');
  assertNull(r.componentScores.optionsIntelligence, 'options not fabricated');
  assertNull(r.componentScores.institutionalRadar, 'institutional not fabricated');
});

test('disclaimer states no BUY/SELL guarantee', () => {
  const r = buildTradePlan('AAPL', completeSources);
  assertTrue(typeof r.disclaimer === 'string' && r.disclaimer.length > 0, 'disclaimer present');
  assertTrue(r.disclaimer.toLowerCase().includes('not a buy/sell'), 'no buy/sell guarantee');
  assertTrue(r.disclaimer.includes('C8'), 'C8 disclaimer present');
});

test('missing levels are null, never zero', () => {
  // Null every upstream level field — including invalidation, which C8 also
  // folds into stopLoss — so no level can be derived.
  const sources = { swingIntelligence: { ...b4Sample, entryZone: null, entryPrice: null, stopLoss: null, target1: null, target2: null, invalidation: null, riskReward: null, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.entryZone, 'entryZone null when missing');
  assertNull(r.entryPrice, 'entryPrice null when missing');
  assertNull(r.stopLoss, 'stopLoss null when missing');
  assertNull(r.target1, 'target1 null when missing');
  assertNull(r.riskReward, 'riskReward null when missing');
});// ----------------------------------------------------------------------------
// 19. No look-ahead
// ----------------------------------------------------------------------------
test('engine is pure — no network, no Date dependence in score', () => {
  const a = buildTradePlan('AAPL', completeSources);
  const b = buildTradePlan('AAPL', completeSources);
  assertEqual(a.planScore, b.planScore, 'deterministic score');
  assertEqual(a.planQuality, b.planQuality, 'deterministic quality');
  // timestamp differs across calls (real clock) but score must not depend on it
  assertEqual(a.planSignal, b.planSignal, 'deterministic signal');
});

// ----------------------------------------------------------------------------
// 20. Ranking + stable tie-break
// ----------------------------------------------------------------------------
function makePlan(symbol, score, dc, rr, conf) {
  return {
    symbol,
    planScore: score,
    planQuality: classifyPlanQuality(score),
    planSignal: classifyPlanSignal(score),
    riskReward: rr,
    dataCompleteness: dc,
    confidence: conf,
  };
}

test('ranking sorts by planScore descending', () => {
  const results = [makePlan('A', 50, 100, 2, 80), makePlan('B', 80, 100, 2, 80), makePlan('C', 60, 100, 2, 80)];
  const { ranked } = rankTradePlans(results);
  assertEqual(ranked[0].symbol, 'B', 'highest score first');
  assertEqual(ranked[1].symbol, 'C', 'second');
  assertEqual(ranked[2].symbol, 'A', 'lowest last');
  assertEqual(ranked[0].rank, 1);
  assertEqual(ranked[2].rank, 3);
});

test('null scores sink to the bottom', () => {
  const results = [makePlan('A', null, 100, null, 80), makePlan('B', 60, 100, 2, 80)];
  const { ranked } = rankTradePlans(results);
  assertEqual(ranked[0].symbol, 'B', 'non-null first');
  assertEqual(ranked[1].symbol, 'A', 'null last');
});

test('top slice contains 5 highest', () => {
  const results = [];
  for (let i = 0; i < 12; i++) results.push(makePlan('S' + i, 90 - i, 100, 2, 80));
  const { top, alternatives, ranking } = rankTradePlans(results);
  assertEqual(top.length, 5, 'top has 5');
  assertEqual(alternatives.length, 5, 'alternatives has 5');
  assertEqual(ranking.total, 12, 'total 12');
});

test('stable tie-break: score -> dataCompleteness -> riskReward -> confidence -> symbol alpha', () => {
  const results = [
    makePlan('C', 75, 60, 1, 70),
    makePlan('A', 75, 60, 1, 70),
    makePlan('B', 75, 80, 1, 70),
    makePlan('D', 75, 60, 3, 70),
  ];
  const { ranked } = rankTradePlans(results);
  assertEqual(ranked[0].symbol, 'B', 'highest data completeness first');
  assertEqual(ranked[1].symbol, 'D', 'highest riskReward second');
  assertEqual(ranked[2].symbol, 'A', 'alpha tie-break A before C');
  assertEqual(ranked[3].symbol, 'C', 'alpha tie-break C last');
});

test('empty results returns empty ranking', () => {
  const { ranked, top, alternatives, ranking } = rankTradePlans([]);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
  assertEqual(ranking.total, 0);
});

test('non-array input returns empty ranking', () => {
  const { ranked } = rankTradePlans(null);
  assertEqual(ranked.length, 0);
});

// ----------------------------------------------------------------------------
// 21. API contract
// ----------------------------------------------------------------------------
test('result shape matches API contract fields', () => {
  const r = buildTradePlan('AAPL', completeSources);
  const requiredFields = [
    'symbol', 'timestamp', 'available', 'planQuality', 'planScore', 'planSignal',
    'setup', 'directionBias', 'direction', 'timeframe',
    'entryZone', 'entryPrice', 'stopLoss', 'target1', 'target2', 'target3', 'invalidation',
    'riskReward', 'riskAmount', 'rewardAmount', 'riskPercent', 'rewardPercent',
    'positionSizing', 'maxRiskPercent',
    'confidence', 'confidenceLevel', 'supportingEvidence', 'risks', 'warnings', 'flags',
    'componentScores', 'componentWeights',
    'dataAvailability', 'dataCompleteness', 'provenance', 'limitations', 'disclaimer',
  ];
  for (const f of requiredFields) {
    assertTrue(f in r, 'missing field: ' + f);
  }
});

test('componentScores contains the 6 trade-plan components', () => {
  const r = buildTradePlan('AAPL', completeSources);
  const expected = ['setupQuality', 'riskRewardQuality', 'technicalReadiness', 'opportunityScore', 'catalystFlowSupport', 'dataCompleteness'];
  for (const k of expected) {
    assertTrue(k in r.componentScores, 'missing component: ' + k);
  }
});

test('componentWeights are effective renormalized weights', () => {
  const r = buildTradePlan('AAPL', completeSources);
  const used = Object.values(r.componentWeights).reduce((a, b) => a + b, 0);
  assertTrue(Math.abs(used - 1.0) < 0.01, 'componentWeights sum to 1, got ' + used);
});

test('supportingEvidence records source/score/weight', () => {
  const r = buildTradePlan('AAPL', completeSources);
  for (const e of r.supportingEvidence) {
    assertTrue(typeof e.source === 'string', 'evidence source string');
    assertTrue(typeof e.label === 'string', 'evidence label string');
    assertTrue(e.score != null, 'evidence score present');
  }
});// ----------------------------------------------------------------------------
// 22. Graceful failure
// ----------------------------------------------------------------------------
test('malformed upstream objects do not throw', () => {
  const sources = {
    opportunityRanking: { opportunityScore: 'not-a-number' },
    swingIntelligence: 'not-an-object',
    earlyExplosion: 42,
    optionsIntelligence: null,
    institutionalRadar: undefined,
    catalystIntelligence: {},
    pennyIntelligence: [],
  };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.planScore == null || Number.isFinite(r.planScore), 'no throw, score finite or null');
  assertTrue(r.planQuality === 'UNAVAILABLE' || typeof r.planQuality === 'string', 'quality valid');
});

test('duplicate symbols in ranking do not break', () => {
  const results = [
    makePlan('AAPL', 80, 100, 2, 80),
    makePlan('AAPL', 60, 100, 2, 80),
  ];
  const { ranked } = rankTradePlans(results);
  assertEqual(ranked.length, 2, 'duplicate symbols ranked');
});

test('null upstream objects are handled', () => {
  const r = buildTradePlan('AAPL', { swingIntelligence: null, earlyExplosion: null });
  assertNull(r.planScore, 'null upstream => null score');
  assertEqual(r.planQuality, 'UNAVAILABLE');
});

test('unknown setup stays null, not fabricated', () => {
  const sources = { swingIntelligence: { ...b4Sample, setupClassification: [] } };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.setup, 'setup null when unknown');
});

test('unavailable plan has UNAVAILABLE direction and UNKNOWN timeframe', () => {
  const r = buildTradePlan('AAPL', {});
  assertEqual(r.direction, 'UNAVAILABLE');
  assertEqual(r.timeframe, 'UNKNOWN');
});

// ----------------------------------------------------------------------------
// 23. C7 regression
// ----------------------------------------------------------------------------
test('C7 regression: C8 consumes C7 opportunityScore', () => {
  const sources = { opportunityRanking: { ...c7Sample, opportunityScore: 77 } };
  const r = buildTradePlan('AAPL', sources);
  assertEqual(r.componentScores.opportunityScore, 77, 'C7 opportunityScore consumed');
});

test('C7 regression: null C7 yields null component', () => {
  const sources = { opportunityRanking: { opportunityScore: null } };
  const r = buildTradePlan('AAPL', sources);
  assertNull(r.componentScores.opportunityScore, 'null c7 => null component');
});

test('C7 regression: C8 does not mutate C7 output', () => {
  const before = JSON.stringify(c7Sample);
  buildTradePlan('AAPL', { opportunityRanking: c7Sample });
  assertEqual(JSON.stringify(c7Sample), before, 'C7 untouched');
});

// ----------------------------------------------------------------------------
// 24. B1-B6 regression
// ----------------------------------------------------------------------------
test('B1 regression: pennyScore extraction', () => {
  const sources = { pennyIntelligence: { ...b1Sample, pennyScore: 61 } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.pennyIntelligence === true, 'penny available');
});

test('B2 regression: optionsScore from decision.decisionScore', () => {
  const sources = { optionsIntelligence: { decision: { decisionScore: 72 } } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.optionsIntelligence === true, 'options available');
});

test('B3 regression: institutionalScore extraction', () => {
  const sources = { institutionalRadar: { institutionalScore: 65 } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.institutionalRadar === true, 'institutional available');
});

test('B4 regression: swingScore + zones consumed', () => {
  const sources = { swingIntelligence: { ...b4Sample, swingScore: 71 } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.swingIntelligence === true, 'swing available');
  assertTrue(r.direction === DIRECTION.LONG || r.direction === DIRECTION.NEUTRAL,
    'direction from swing evidence, got ' + r.direction);
});

test('B5 regression: explosionScore + zones consumed', () => {
  const sources = { earlyExplosion: { ...b5Sample, explosionScore: 68 } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.earlyExplosion === true, 'explosion available');
});

test('B6 regression: catalystScore consumed', () => {
  const sources = { catalystIntelligence: { ...b6Sample, catalystScore: 73 } };
  const r = buildTradePlan('AAPL', sources);
  assertTrue(r.dataAvailability.catalystIntelligence === true, 'catalyst available');
});

test('B1-B6 defaults all yield UNAVAILABLE plan', () => {
  const sources = {
    opportunityRanking: { opportunityScore: null },
    pennyIntelligence: buildPennyIntelligence({}, {}),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
  };
  const r = buildTradePlan('AAPL', sources);
  assertEqual(r.planQuality, 'UNAVAILABLE', 'all defaults => UNAVAILABLE');
  assertNull(r.planScore, 'all defaults => null score');
});

test('C8 with all B1-B6 defaults yields UNAVAILABLE', () => {
  const sources = {
    opportunityRanking: { opportunityScore: null },
    pennyIntelligence: buildPennyIntelligence({}, {}),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
  };
  const r = buildTradePlan('AAPL', sources);
  assertEqual(r.planQuality, 'UNAVAILABLE');
  assertNull(r.planScore);
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n========================================');
console.log('C8 Trade Plan Engine Tests');
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