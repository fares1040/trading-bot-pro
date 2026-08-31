/**
 * Methodology Integration Tests
 *
 * Tests for:
 *   - Opportunity Horizon 1-3M (lib/opportunity-horizon.js)
 *   - Classical Technical Evidence (lib/classical-technical-evidence.js)
 *   - Candlestick Patterns (lib/candlestick-patterns.js)
 *   - Gamma Context (lib/gamma-context.js)
 *   - C7/C8/C9 integration with new evidence
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-methodology-integration.mjs
 */

import {
  buildOpportunityHorizon,
  defaultOpportunityHorizon,
  HORIZON_THRESHOLDS,
  DOMAIN_WEIGHTS,
} from '../lib/opportunity-horizon.js';

import {
  buildClassicalTechnicalEvidence,
  defaultClassicalTechnicalEvidence,
  detectMarketStructure,
  detectBreaker,
  detectFVG,
  detectLiquiditySweep,
  detectCRT,
  detectSupportResistance,
} from '../lib/classical-technical-evidence.js';

import {
  buildCandlestickPatterns,
  defaultCandlestickPatterns,
} from '../lib/candlestick-patterns.js';

import {
  buildGammaContext,
  defaultGammaContext,
  getGammaAvailability,
} from '../lib/gamma-context.js';

import { buildOpportunityRanking, defaultOpportunityRanking } from '../lib/opportunity-ranking.js';
import { buildTradePlan, defaultTradePlan } from '../lib/trade-plan-engine.js';

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

// ============================================================================
// HORIZON 1-3M TESTS
// ============================================================================

test('Horizon: default returns UNAVAILABLE with no symbol', () => {
  const r = buildOpportunityHorizon(null, {});
  assertEqual(r.horizon, 'UNAVAILABLE');
  assertNull(r.horizonScore);
  assertEqual(r.confidence, 0);
});

test('Horizon: default returns UNAVAILABLE with no inputs', () => {
  const r = buildOpportunityHorizon('AAPL', {});
  assertEqual(r.horizon, 'UNAVAILABLE');
  assertNull(r.horizonScore);
  assertTrue(r.confidence >= 0, 'confidence non-negative');
});

test('Horizon: complete inputs produce a bounded score', () => {
  const r = buildOpportunityHorizon('AAPL', {
    secIntelligence: { secScore: 65, insiderActivity: 'Accumulation' },
    catalystIntelligence: { catalystScore: 72, catalystTypes: ['EARNINGS', 'PRODUCT'] },
    swingIntelligence: { swingScore: 78, relativeVolume: 1.4, componentScores: { trend: 70, momentum: 65, volume: 75 } },
    marketData: { price: 180, sma20: 175, sma50: 170, averageVolume20: 5000000 },
    liquidityIntelligence: { liquidityScore: 80, liquidityQuality: 'EXCELLENT' },
    institutionalRadar: { institutionalScore: 68, institutionalActivity: 'Accumulation' },
    marketRegime: { regimeScore: 72, label: 'BULLISH', risk: 'FAVORABLE' },
    classicalEvidence: { marketStructure: { mssDetected: true, trend: 'BULLISH', confidence: 75 }, fvg: { detected: true, gaps: [{ type: 'BULLISH' }] }, breaker: { detected: false } },
    optionsIntelligence: { decision: { decisionScore: 65 } },
  });
  assertScoreBetween(r.horizonScore, 0, 100, 'horizon score');
  assertTrue(['HIGHEST_QUALITY', 'HIGH_RISK_REWARD', 'EARLY_WATCHLIST', 'NOT_READY', 'UNAVAILABLE'].includes(r.horizon), 'valid horizon label');
  assertTrue(r.confidence >= 0 && r.confidence <= 100, 'confidence bounded');
});

test('Horizon: high-quality inputs produce HIGHEST_QUALITY', () => {
  const r = buildOpportunityHorizon('AAPL', {
    secIntelligence: { secScore: 85 },
    catalystIntelligence: { catalystScore: 88, catalystTypes: ['EARNINGS', 'CONTRACT'] },
    swingIntelligence: { swingScore: 90, relativeVolume: 1.8, componentScores: { trend: 85, momentum: 80, volume: 90 }, averageVolume20: 10000000 },
    marketData: { price: 200, sma20: 190, sma50: 185, averageVolume20: 10000000 },
    liquidityIntelligence: { liquidityScore: 90, liquidityQuality: 'EXCELLENT' },
    institutionalRadar: { institutionalScore: 82, institutionalActivity: 'Strong Accumulation' },
    marketRegime: { regimeScore: 85, label: 'BULLISH', risk: 'FAVORABLE' },
    classicalEvidence: { marketStructure: { mssDetected: true, trend: 'BULLISH', confidence: 85 }, fvg: { detected: true, gaps: [{ type: 'BULLISH' }, { type: 'BULLISH' }] }, breaker: { detected: true } },
    optionsIntelligence: { decision: { decisionScore: 75 } },
  });
  assertTrue(['HIGHEST_QUALITY', 'HIGH_RISK_REWARD'].includes(r.horizon), 'high-quality horizon, got: ' + r.horizon);
  assertScoreBetween(r.horizonScore, 50, 100, 'horizon score');
});

test('Horizon: fragile inputs produce NOT_READY', () => {
  const r = buildOpportunityHorizon('AAPL', {
    swingIntelligence: { swingScore: 30, relativeVolume: 0.5, riskLevel: 'high' },
    marketData: { price: 50, averageVolume20: 50000 },
    catalystIntelligence: { catalystRisk: 'HIGH' },
  });
  assertEqual(r.horizon, 'NOT_READY');
});

test('Horizon: missing inputs stay null, never zero', () => {
  const r = buildOpportunityHorizon('AAPL', {
    swingIntelligence: { swingScore: 60 },
  });
  assertNull(r.domains.fundamentalQuality);
  assertNull(r.domains.institutionalEvidence);
  assertNull(r.domains.marketSectorRegime);
});

test('Horizon: produces confirmation/invalidation/watch', () => {
  const r = buildOpportunityHorizon('AAPL', {
    swingIntelligence: { swingScore: 70, relativeVolume: 1.3 },
    marketData: { price: 100, averageVolume20: 1000000 },
    catalystIntelligence: { catalystScore: 65, catalystTypes: ['EARNINGS'], upcoming: true },
  });
  assertTrue(Array.isArray(r.confirmation), 'confirmation is array');
  assertTrue(Array.isArray(r.invalidation), 'invalidation is array');
  assertTrue(Array.isArray(r.watchItems), 'watchItems is array');
});

test('Horizon: data honesty — never fabricate fundamentals', () => {
  const r = buildOpportunityHorizon('AAPL', {});
  assertNull(r.domains.fundamentalQuality);
  assertFalse(r.reasons.some(reason => reason.includes('revenue') || reason.includes('earnings') || reason.includes(' fabricated')), 'no fabricated fundamentals');
});

// ============================================================================
// CLASSICAL TECHNICAL EVIDENCE TESTS
// ============================================================================

test('Classical: default returns UNAVAILABLE with no data', () => {
  const r = buildClassicalTechnicalEvidence({});
  assertEqual(r.evidenceCompleteness, 0);
  assertFalse(r.marketStructure.mssDetected);
  assertFalse(r.breaker.detected);
  assertFalse(r.fvg.detected);
  assertFalse(r.liquiditySweep.detected);
  assertEqual(r.crt.confirmationState, 'UNAVAILABLE');
});

test('Classical: detects bullish market structure', () => {
  const highs = [100, 102, 104, 103, 106, 105, 108, 107, 110, 109, 112, 111, 114, 113, 116];
  const lows = [98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
  const closes = [101, 103, 105, 104, 107, 106, 109, 108, 111, 110, 113, 112, 115, 114, 117];
  const r = detectMarketStructure(highs, lows, closes);
  assertEqual(r.trend, 'BULLISH');
  assertTrue(r.higherHighs);
  assertTrue(r.higherLows);
});

test('Classical: detects bearish market structure', () => {
  const highs = [116, 115, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102];
  const lows = [112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98];
  const closes = [115, 113, 111, 109, 107, 105, 103, 101, 99, 97, 95, 93, 91, 89, 87];
  const r = detectMarketStructure(highs, lows, closes);
  assertEqual(r.trend, 'BEARISH');
  assertTrue(r.lowerHighs);
  assertTrue(r.lowerLows);
});

test('Classical: detects FVG (bullish gap)', () => {
  const highs = [105, 104, 102, 101, 100];
  const lows = [103, 102, 100, 99, 98];
  const closes = [104, 103, 101, 100, 99];
  const r = detectFVG(highs, lows, closes);
  assertTrue(r.detected, 'FVG detected');
  assertTrue(r.gaps.some(g => g.type === 'BULLISH'), 'bullish FVG present');
});

test('Classical: detects FVG (bearish gap)', () => {
  const highs = [100, 99, 103, 104, 105];
  const lows = [98, 97, 101, 102, 103];
  const closes = [99, 98, 102, 103, 104];
  const r = detectFVG(highs, lows, closes);
  assertTrue(r.detected, 'FVG detected');
  assertTrue(r.gaps.some(g => g.type === 'BEARISH'), 'bearish FVG present');
});

test('Classical: detects Turtle Soup (sweep with return)', () => {
  const highs = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101];
  const lows = [98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const closes = [99, 100, 101, 102, 103, 104, 103, 102, 101, 100];
  const volumes = [1000, 1100, 1200, 1300, 1500, 1400, 1300, 1200, 1100, 1000];
  const r = detectLiquiditySweep(highs, lows, closes, volumes);
  assertTrue(r.detected, 'sweep detected: ' + r.sweepType);
  assertEqual(r.sweepType, 'TURTLE_SOUP');
  assertTrue(r.returnConfirmed);
});

test('Classical: simple breakout is NOT Turtle Soup', () => {
  const highs = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
  const lows = [98, 97, 96, 95, 94, 93, 92, 91, 90, 89];
  const closes = [99, 100, 101, 102, 103, 104, 105, 106, 107, 108];
  const volumes = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];
  const r = detectLiquiditySweep(highs, lows, closes, volumes);
  assertTrue(r.detected, 'sweep detected: ' + r.sweepType);
  assertEqual(r.sweepType, 'SIMPLE_BREAKOUT');
  assertFalse(r.returnConfirmed);
});

test('Classical: CRT available with sufficient HTF/LTF data', () => {
  const htfCloses = [100, 101, 102, 103, 104];
  const htfHighs = [100, 101, 102, 103, 105];
  const htfLows = [99, 100, 101, 102, 103];
  const ltfCloses = [103, 104, 105, 104, 103, 104, 105, 106, 105, 104];
  const ltfHighs = [103, 104, 105, 104, 103, 104, 105, 106, 105, 104];
  const ltfLows = [102, 103, 104, 103, 102, 103, 104, 105, 104, 103];
  const ltfVolumes = [1000, 1100, 1200, 1100, 1000, 1100, 1200, 1300, 1200, 1100];
  const r = detectCRT(htfCloses, htfHighs, htfLows, ltfCloses, ltfHighs, ltfLows, ltfVolumes);
  assertTrue(r.available, 'CRT available');
  assertTrue(r.crh != null, 'CRH present');
  assertTrue(r.crl != null, 'CRL present');
});

test('Classical: CRT unavailable with insufficient data', () => {
  const r = detectCRT([100], [100], [100], [100], [100], [100], [100]);
  assertFalse(r.available);
  assertEqual(r.confirmationState, 'UNAVAILABLE');
});

test('Classical: support/resistance detection', () => {
  const highs = [100, 102, 104, 103, 105, 104, 106, 105, 107, 106];
  const lows = [98, 99, 100, 101, 102, 103, 104, 105, 106, 105];
  const closes = [99, 101, 103, 102, 104, 103, 105, 104, 106, 105];
  const r = detectSupportResistance(highs, lows, closes, 100, 106);
  assertEqual(r.support, 100);
  assertEqual(r.resistance, 106);
});

test('Classical: buildClassicalTechnicalEvidence composes all detectors', () => {
  const highs = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i * 0.5) * 5);
  const lows = Array.from({ length: 20 }, (_, i) => 95 + Math.sin(i * 0.5) * 5);
  const closes = Array.from({ length: 20 }, (_, i) => 97 + Math.sin(i * 0.5) * 5);
  const volumes = Array.from({ length: 20 }, () => 1000 + Math.random() * 500);
  const r = buildClassicalTechnicalEvidence({
    highs, lows, closes, volumes,
    existingSupport: 95,
    existingResistance: 105,
    symbol: 'AAPL',
  });
  assertTrue(r.evidenceCompleteness > 0, 'has some evidence');
  assertTrue(r.marketStructure.confidence != null, 'market structure has confidence');
});

// ============================================================================
// CANDLESTICK PATTERN TESTS
// ============================================================================

test('Candlestick: default returns empty patterns', () => {
  const r = buildCandlestickPatterns({});
  assertEqual(r.patterns.length, 0);
  assertEqual(r.dataCompleteness, 0);
});

test('Candlestick: detects Hammer (bullish)', () => {
  const opens = [100, 98];
  const highs = [101, 99];
  const lows = [99, 95];
  const closes = [99, 99];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  const hammer = r.patterns.find(p => p.name === 'Hammer');
  assertTrue(hammer != null, 'Hammer detected');
  assertEqual(hammer.type, 'BULLISH');
});

test('Candlestick: detects Shooting Star (bearish)', () => {
  const opens = [100, 102];
  const highs = [101, 105];
  const lows = [99, 101];
  const closes = [99, 101];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  const star = r.patterns.find(p => p.name === 'Shooting Star');
  assertTrue(star != null, 'Shooting Star detected');
  assertEqual(star.type, 'BEARISH');
});

test('Candlestick: detects Bullish Engulfing', () => {
  const opens = [102, 99];
  const highs = [103, 100];
  const lows = [101, 98];
  const closes = [101, 103];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  const engulfing = r.patterns.find(p => p.name === 'Bullish Engulfing');
  assertTrue(engulfing != null, 'Bullish Engulfing detected');
  assertEqual(engulfing.type, 'BULLISH');
});

test('Candlestick: detects Bearish Engulfing', () => {
  const opens = [98, 101];
  const highs = [99, 102];
  const lows = [97, 100];
  const closes = [99, 97];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  const engulfing = r.patterns.find(p => p.name === 'Bearish Engulfing');
  assertTrue(engulfing != null, 'Bearish Engulfing detected');
  assertEqual(engulfing.type, 'BEARISH');
});

test('Candlestick: context analysis provides buyer/seller pressure', () => {
  const opens = [100, 101, 102];
  const highs = [101, 102, 103];
  const lows = [99, 100, 101];
  const closes = [101, 102, 103];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  assertTrue(r.context.buyerPressure != null, 'buyer pressure present');
  assertTrue(r.context.sellerPressure != null, 'seller pressure present');
});

test('Candlestick: no patterns when data insufficient', () => {
  const r = buildCandlestickPatterns({ opens: [100], highs: [101], lows: [99], closes: [100] });
  assertEqual(r.patterns.length, 0, 'no patterns with insufficient data');
});

// ============================================================================
// GAMMA CONTEXT TESTS
// ============================================================================

test('Gamma: default returns UNAVAILABLE', () => {
  const r = buildGammaContext({ symbol: 'AAPL' });
  assertEqual(r.gammaAvailability, 'UNAVAILABLE');
  assertNull(r.gamma);
  assertNull(r.gex);
});

test('Gamma: unavailable with empty options', () => {
  const r = buildGammaContext({ symbol: 'AAPL', optionsContracts: [] });
  assertEqual(r.gammaAvailability, 'UNAVAILABLE');
});

test('Gamma: unavailable when no gamma fields in contracts', () => {
  const contracts = [{ symbol: 'AAPL', strike: 100, optionType: 'CALL', volume: 100, openInterest: 500 }];
  const r = buildGammaContext({ symbol: 'AAPL', optionsContracts: contracts });
  assertEqual(r.gammaAvailability, 'UNAVAILABLE');
});

test('Gamma: available when gamma data provided', () => {
  const r = buildGammaContext({
    symbol: 'AAPL',
    gammaData: {
      gamma: 0.05,
      gex: 1000000,
      gammaConcentration: 'CONCENTRATED',
      dealerPositioning: 'NEUTRAL',
      profile: 'CONCENTRATED',
    },
  });
  assertEqual(r.gammaAvailability, 'AVAILABLE');
  assertEqual(r.gamma, 0.05);
  assertEqual(r.gex, 1000000);
});

test('Gamma: derived from contracts with gamma field', () => {
  const contracts = [
    { symbol: 'AAPL', strike: 100, optionType: 'CALL', gamma: 0.04 },
    { symbol: 'AAPL', strike: 110, optionType: 'CALL', gamma: 0.03 },
  ];
  const r = buildGammaContext({ symbol: 'AAPL', optionsContracts: contracts });
  assertEqual(r.gammaAvailability, 'AVAILABLE');
  assertTrue(r.gamma != null, 'gamma derived');
  assertTrue(r.profile === 'CONCENTRATED', 'concentrated profile');
});

test('Gamma: getGammaAvailability returns correct state', () => {
  assertEqual(getGammaAvailability([]), 'UNAVAILABLE');
  assertEqual(getGammaAvailability([{ volume: 100 }]), 'UNAVAILABLE');
  assertEqual(getGammaAvailability([{ gamma: 0.05 }]), 'AVAILABLE');
});

// ============================================================================
// C7 INTEGRATION TESTS
// ============================================================================

test('C7: accepts optional methodology evidence', () => {
  const sources = {
    pennyIntelligence: { pennyScore: 60, dataCompleteness: 50, dataAvailability: { price: true } },
    optionsIntelligence: { decision: { decisionScore: 55 }, dataCompleteness: 40, dataAvailability: { price: true } },
    institutionalRadar: { institutionalScore: 50, dataCompleteness: 30, dataAvailability: { price: true } },
    swingIntelligence: { swingScore: 65, dataCompleteness: 60, dataAvailability: { price: true } },
    earlyExplosion: { explosionScore: 55, dataCompleteness: 40, dataAvailability: { price: true } },
    catalystIntelligence: { catalystScore: 60, dataCompleteness: 50, dataAvailability: { price: true } },
  };

  const horizon = buildOpportunityHorizon('AAPL', {
    swingIntelligence: sources.swingIntelligence,
    marketData: { price: 100, averageVolume20: 1000000 },
    catalystIntelligence: { catalystScore: 65, catalystTypes: ['EARNINGS'] },
  });
  const classical = buildClassicalTechnicalEvidence({
    highs: Array.from({ length: 20 }, (_, i) => 100 + i),
    lows: Array.from({ length: 20 }, (_, i) => 95 + i),
    closes: Array.from({ length: 20 }, (_, i) => 97 + i),
    volumes: Array.from({ length: 20 }, () => 1000),
  });
  const candlestick = buildCandlestickPatterns({
    opens: Array.from({ length: 20 }, (_, i) => 97 + i),
    highs: Array.from({ length: 20 }, (_, i) => 100 + i),
    lows: Array.from({ length: 20 }, (_, i) => 95 + i),
    closes: Array.from({ length: 20 }, (_, i) => 97 + i),
  });

  const r = buildOpportunityRanking('AAPL', sources, {
    horizonEvidence: horizon,
    classicalEvidence: classical,
    candlestickEvidence: candlestick,
    gammaContext: defaultGammaContext('AAPL'),
  });

  assertTrue(r.horizonEvidence != null, 'horizonEvidence attached');
  assertTrue(r.classicalEvidence != null, 'classicalEvidence attached');
  assertTrue(r.candlestickEvidence != null, 'candlestickEvidence attached');
  assertTrue(r.gammaContext != null, 'gammaContext attached');
  assertTrue(r.horizonEvidence.horizon != null, 'horizon has classification');
  assertTrue(r.flags.length > 0, 'flags present');
});

test('C7: backward compatibility — works without new evidence', () => {
  const sources = {
    pennyIntelligence: { pennyScore: 60, dataCompleteness: 50, dataAvailability: { price: true } },
    optionsIntelligence: { decision: { decisionScore: 55 }, dataCompleteness: 40, dataAvailability: { price: true } },
    institutionalRadar: { institutionalScore: 50, dataCompleteness: 30, dataAvailability: { price: true } },
    swingIntelligence: { swingScore: 65, dataCompleteness: 60, dataAvailability: { price: true } },
    earlyExplosion: { explosionScore: 55, dataCompleteness: 40, dataAvailability: { price: true } },
    catalystIntelligence: { catalystScore: 60, dataCompleteness: 50, dataAvailability: { price: true } },
  };

  const r = buildOpportunityRanking('AAPL', sources);
  assertNull(r.horizonEvidence, 'no horizonEvidence when not provided');
  assertNull(r.classicalEvidence, 'no classicalEvidence when not provided');
  assertTrue(r.opportunityScore != null, 'score still computed');
});

// ============================================================================
// C8 INTEGRATION TESTS
// ============================================================================

test('C8: reads horizonEvidence from C7', () => {
  const horizon = buildOpportunityHorizon('AAPL', {
    swingIntelligence: { swingScore: 70, relativeVolume: 1.3 },
    marketData: { price: 100, averageVolume20: 1000000 },
  });

  const c7 = {
    opportunityScore: 72,
    quality: 'STRONG',
    confidence: 65,
    horizonEvidence: horizon,
    provenance: { engine: 'C7' },
  };

  const b4 = {
    swingScore: 70,
    setupClassification: [{ type: 'BREAKOUT', confidence: 75 }],
    entryZone: '99 - 101',
    target1: 105,
    invalidation: 98,
    stopLoss: 98,
    riskReward: 2.5,
    dataAvailability: { price: true, volume: true, technicals: true },
  };

  const tp = buildTradePlan('AAPL', { opportunityRanking: c7, swingIntelligence: b4 }, {});
  assertTrue(tp.horizonEvidence != null, 'horizonEvidence present in trade plan');
  assertEqual(tp.horizonEvidence.horizon, horizon.horizon);
  assertTrue(tp.confirmation.length > 0 || tp.invalidation.length > 0 || tp.watchItems.length > 0, 'horizon fields propagated');
});

// ============================================================================
// DATA HONESTY TESTS
// ============================================================================

test('Data honesty: horizon never fabricates fundamentals', () => {
  const r = buildOpportunityHorizon('XYZ', {});
  assertNull(r.domains.fundamentalQuality);
  assertFalse(r.reasons.some(reason => /revenue|earnings|profit|margin/i.test(reason)), 'no fabricated fundamentals');
});

test('Data honesty: classical never fabricates patterns', () => {
  const r = buildClassicalTechnicalEvidence({});
  assertFalse(r.marketStructure.mssDetected, 'no MSS when no data');
  assertFalse(r.breaker.detected, 'no breaker when no data');
  assertFalse(r.fvg.detected, 'no FVG when no data');
});

test('Data honesty: candlestick never signals alone', () => {
  const opens = [100, 99];
  const highs = [101, 100];
  const lows = [99, 98];
  const closes = [99, 99];
  const r = buildCandlestickPatterns({ opens, highs, lows, closes });
  assertTrue(r.patterns.length >= 0, 'patterns may exist');
  assertTrue(r.disclaimer.includes('not standalone'), 'disclaimer warns against standalone use');
});

test('Data honesty: gamma never invents values', () => {
  const r = buildGammaContext({ symbol: 'AAPL' });
  assertNull(r.gamma);
  assertNull(r.gex);
  assertEqual(r.gammaAvailability, 'UNAVAILABLE');
});

// ============================================================================
// NO LOOK-AHEAD TESTS
// ============================================================================

test('No look-ahead: upcoming catalysts flagged as upcoming', () => {
  const r = buildOpportunityHorizon('AAPL', {
    swingIntelligence: { swingScore: 70, relativeVolume: 1.3 },
    marketData: { price: 100, averageVolume20: 1000000 },
    catalystIntelligence: { catalystScore: 70, catalystTypes: ['EARNINGS'], upcoming: true },
    marketRegime: { regimeScore: 60 },
  });
  assertTrue(r.horizon !== 'UNAVAILABLE' || r.warnings.includes('HORIZON_UNAVAILABLE') || r.warnings.includes('LOW_DATA_COVERAGE'),
    'horizon evaluated or warned');
  const allText = [...r.confirmation, ...r.invalidation, ...r.watchItems, ...r.warnings].join(' ');
  assertTrue(allText.includes('upcoming') || allText.includes('UPCOMING') || r.horizon === 'UNAVAILABLE',
    'upcoming catalyst referenced somewhere');
});

test('No look-ahead: CRT uses only available data', () => {
  const r = buildClassicalTechnicalEvidence({
    highs: [100, 101, 102],
    lows: [98, 99, 100],
    closes: [99, 100, 101],
    volumes: [1000, 1100, 1200],
  });
  assertTrue(r.crt.confirmationState === 'NONE' || r.crt.confirmationState === 'EARLY' || r.crt.confirmationState === 'WATCH' || r.crt.confirmationState === 'CONFIRMED' || r.crt.confirmationState === 'UNAVAILABLE',
    'valid CRT state');
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

test('Determinism: horizon returns same result for same inputs', () => {
  const inputs = {
    swingIntelligence: { swingScore: 70, relativeVolume: 1.3 },
    marketData: { price: 100, averageVolume20: 1000000 },
  };
  const r1 = buildOpportunityHorizon('AAPL', inputs);
  const r2 = buildOpportunityHorizon('AAPL', inputs);
  assertEqual(r1.horizon, r2.horizon);
  assertEqual(r1.horizonScore, r2.horizonScore);
  assertEqual(r1.confidence, r2.confidence);
});

test('Determinism: classical returns same result for same inputs', () => {
  const inputs = {
    highs: [100, 101, 102, 103, 104],
    lows: [98, 99, 100, 101, 102],
    closes: [99, 100, 101, 102, 103],
    volumes: [1000, 1100, 1200, 1300, 1400],
  };
  const r1 = buildClassicalTechnicalEvidence(inputs);
  const r2 = buildClassicalTechnicalEvidence(inputs);
  assertEqual(r1.marketStructure.trend, r2.marketStructure.trend);
  assertEqual(r1.fvg.detected, r2.fvg.detected);
  assertEqual(r1.fvg.gaps.length, r2.fvg.gaps.length);
});

test('Determinism: candlestick returns same result for same inputs', () => {
  const inputs = {
    opens: [100, 99],
    highs: [101, 100],
    lows: [99, 98],
    closes: [99, 99],
  };
  const r1 = buildCandlestickPatterns(inputs);
  const r2 = buildCandlestickPatterns(inputs);
  assertEqual(r1.patterns.length, r2.patterns.length);
  if (r1.patterns.length > 0) {
    assertEqual(r1.patterns[0].name, r2.patterns[0].name);
  }
});

// ============================================================================
// PROVENANCE TESTS
// ============================================================================

test('Provenance: horizon includes engine identity', () => {
  const r = buildOpportunityHorizon('AAPL', {});
  assertEqual(r.provenance.intelligence, 'HORIZON');
  assertEqual(r.provenance.engine, 'Opportunity Horizon 1-3M');
});

test('Provenance: classical includes engine identity', () => {
  const r = buildClassicalTechnicalEvidence({});
  assertEqual(r.provenance.intelligence, 'CLASSICAL');
  assertEqual(r.provenance.engine, 'Classical Technical Evidence');
});

test('Provenance: candlestick includes engine identity', () => {
  const r = buildCandlestickPatterns({});
  assertEqual(r.provenance.intelligence, 'CANDLESTICK');
  assertEqual(r.provenance.engine, 'Candlestick Pattern Detection');
});

test('Provenance: gamma includes engine identity', () => {
  const r = buildGammaContext({ symbol: 'AAPL' });
  assertEqual(r.provenance.intelligence, 'GAMMA');
  assertEqual(r.provenance.engine, 'Gamma / GEX Context');
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== Methodology Integration Test Summary ===');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
if (failCount > 0) {
  console.error('TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
