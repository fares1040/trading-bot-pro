import {
  buildLiquidityIntelligence,
  defaultLiquidityIntelligence,
  calculateDollarVolume,
  classifyDollarVolume,
  calculateVolumeTierScore,
  calculateDollarVolumeScore,
  calculateVolumeConfirmationScore,
  calculateLiquidityDepthScore,
  classifyLiquidityQuality,
  detectLiquidityTraps,
  assessVolumeProfile,
  calculateLiquidityRisk,
  calculateLiquidityDataAvailability,
  calculateLiquidityCompleteness,
  buildLiquidityReasons,
  buildLiquidityWarnings,
  buildLiquidityFlags,
  rankLiquidityOpportunities,
  liquidityWeights,
  qualityThresholds,
} from '../lib/liquidity-intelligence.js';

console.log('========================================');
console.log('Liquidity Intelligence Tests (A8)');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (e) {
    console.log('FAIL: ' + name);
    console.log('   ' + e.message);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + ' Expected ' + expected + ', got ' + actual);
  }
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > (tolerance || 0.01)) {
    throw new Error((msg || '') + ' Expected ~' + expected + ', got ' + actual);
  }
}

function assertNullish(value, msg) {
  if (value != null) {
    throw new Error((msg || '') + ' Expected null/undefined, got ' + value);
  }
}

function assertNotNullish(value, msg) {
  if (value == null) {
    throw new Error((msg || '') + ' Expected non-null value');
  }
}

function assertTrue(condition, msg) {
  if (!condition) {
    throw new Error(msg || 'Expected true');
  }
}

function makeMarketData(overrides) {
  return {
    symbol: 'TEST',
    price: 100,
    previousClose: 98,
    changePercent: 2.04,
    volume: 1500000,
    averageVolume20: 1000000,
    relativeVolume: 1.5,
    momentumPercent: 5.0,
    momentumScore: 75,
    volumeScore: 70,
    trendScore: 65,
    breakoutScore: 60,
    rsi: 55,
    rsiScore: 65,
    sma20: 98,
    sma50: 95,
    resistance20: 105,
    support20: 95,
    resistanceDistancePercent: 5.0,
    bollingerBandwidth: 4.5,
    squeeze: false,
    squeezeScore: 30,
    cluster: false,
    clusterRangePercent: 6.0,
    clusterScore: 50,
    targetPrice: 105,
    stopLoss: 95,
    riskReward: 2.0,
    riskScore: 80,
    technicalScore: 70,
    discoveryScore: 75,
    setupScore: 72,
    signal: 'BUY',
    signalStrength: 'MEDIUM',
    directionBias: 'ميل فني صاعد',
    riskLevel: 'متوسط',
    dayHigh: 102,
    dayLow: 98,
    technicalReady: true,
    dataAvailability: { price: true, volume: true, technicals: true, options: false, darkPool: false, institutionalFlow: false },
    ...overrides,
  };
}

// ===== 1. Empty / null input =====
test('1. Null market data returns UNAVAILABLE', function() {
  const result = buildLiquidityIntelligence(null, 'TEST');
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.liquidityScore);
  assertEqual(result.symbol, 'TEST');
  assertEqual(result.liquidityTraps.length, 0);
  assertTrue(result.warnings.includes('NO_MARKET_DATA'));
});

test('1b. Missing market data returns UNAVAILABLE', function() {
  const result = buildLiquidityIntelligence(undefined, 'TEST');
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.liquidityScore);
});

// ===== 2. Missing/null data fields =====
test('2. Partial market data — missing fields remain null', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: null,
    volume: null,
    averageVolume20: null,
    relativeVolume: null,
  }), 'TEST');
  assertNullish(result.price);
  assertNullish(result.volume);
  assertNullish(result.averageVolume20);
  assertNullish(result.relativeVolume);
  assertNullish(result.dollarVolume);
  assertNullish(result.componentScores.dollarVolume);
  assertTrue(result.warnings.includes('NO_MARKET_DATA') || result.warnings.length > 0);
});

// ===== 3. Invalid data =====
test('3. Invalid data types are handled gracefully', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 'invalid',
    volume: NaN,
    relativeVolume: 'abc',
    averageVolume20: Infinity,
    bollingerBandwidth: -5,
  }), 'TEST');
  assertNullish(result.price);
  assertNullish(result.volume);
  assertNullish(result.relativeVolume);
  assertNullish(result.averageVolume20);
  assertTrue(typeof result.liquidityScore === 'number' || result.liquidityScore == null);
});

test('3b. NaN/Infinity do not crash', function() {
  const md = makeMarketData();
  md.price = NaN;
  md.volume = Infinity;
  md.relativeVolume = NaN;
  md.averageVolume20 = Infinity;
  md.bollingerBandwidth = NaN;
  md.volumeScore = Infinity;
  const result = buildLiquidityIntelligence(md, 'TEST');
  assertTrue(typeof result === 'object');
  assertTrue(typeof result.liquidityScore === 'number' || result.liquidityScore == null);
  assertTrue(Number.isFinite(result.liquidityScore || 0) || result.liquidityScore == null);
});

// ===== 4. Dollar volume calculation =====
test('4. Dollar volume calculation', function() {
  assertEqual(calculateDollarVolume(100, 1500000), 150000000);
  assertEqual(calculateDollarVolume(50, 100000), 5000000);
  assertNullish(calculateDollarVolume(null, 100));
  assertNullish(calculateDollarVolume(100, null));
  assertNullish(calculateDollarVolume(0, 100));
  assertNullish(calculateDollarVolume(100, 0));
  assertNullish(calculateDollarVolume(-5, 100));
});

test('4b. Dollar volume classification', function() {
  assertEqual(classifyDollarVolume(30_000_000), 'excellent');
  assertEqual(classifyDollarVolume(15_000_000), 'good');
  assertEqual(classifyDollarVolume(5_000_000), 'moderate');
  assertEqual(classifyDollarVolume(750_000), 'weak');
  assertEqual(classifyDollarVolume(250_000), 'poor');
  assertEqual(classifyDollarVolume(null), 'unavailable');
});

// ===== 5. Volume tier score =====
test('5. Volume tier score', function() {
  assertEqual(calculateVolumeTierScore(1_500_000), 100);
  assertEqual(calculateVolumeTierScore(750_000), 85);
  assertEqual(calculateVolumeTierScore(300_000), 70);
  assertEqual(calculateVolumeTierScore(150_000), 55);
  assertEqual(calculateVolumeTierScore(50_000), 25);
  assertNullish(calculateVolumeTierScore(null));
});

// ===== 6. Volume confirmation score =====
test('6. Volume confirmation score', function() {
  assertEqual(calculateVolumeConfirmationScore(2.5), 100);
  assertEqual(calculateVolumeConfirmationScore(1.5), 85);
  assertEqual(calculateVolumeConfirmationScore(1.0), 65);
  assertEqual(calculateVolumeConfirmationScore(0.5), 30);
  assertEqual(calculateVolumeConfirmationScore(0.1), 10);
  assertNullish(calculateVolumeConfirmationScore(null));
});

// ===== 7. Liquidity depth score =====
test('7. Liquidity depth score (Bollinger bandwidth proxy)', function() {
  assertEqual(calculateLiquidityDepthScore({ bollingerBandwidth: 3 }), 100);
  assertEqual(calculateLiquidityDepthScore({ bollingerBandwidth: 5 }), 80);
  assertEqual(calculateLiquidityDepthScore({ bollingerBandwidth: 8 }), 60);
  assertEqual(calculateLiquidityDepthScore({ bollingerBandwidth: 12 }), 40);
  assertEqual(calculateLiquidityDepthScore({ bollingerBandwidth: 20 }), 20);
  assertNullish(calculateLiquidityDepthScore({ bollingerBandwidth: null }));
  assertNullish(calculateLiquidityDepthScore({}));
});

// ===== 8. Liquidity quality classification =====
test('8. Liquidity quality classification thresholds', function() {
  assertEqual(classifyLiquidityQuality(90), 'EXCELLENT');
  assertEqual(classifyLiquidityQuality(85), 'EXCELLENT');
  assertEqual(classifyLiquidityQuality(75), 'GOOD');
  assertEqual(classifyLiquidityQuality(70), 'GOOD');
  assertEqual(classifyLiquidityQuality(55), 'MODERATE');
  assertEqual(classifyLiquidityQuality(45), 'MODERATE');
  assertEqual(classifyLiquidityQuality(35), 'POOR');
  assertEqual(classifyLiquidityQuality(25), 'POOR');
  assertEqual(classifyLiquidityQuality(20), 'CRITICAL');
  assertEqual(classifyLiquidityQuality(0), 'CRITICAL');
  assertEqual(classifyLiquidityQuality(null), 'UNAVAILABLE');
  assertEqual(classifyLiquidityQuality(100), 'EXCELLENT');
});

// ===== 9. Liquidity traps =====
test('9. Liquidity trap detection', function() {
  const traps = detectLiquidityTraps(makeMarketData({
    price: 50,
    volume: 5000,
    relativeVolume: 2.5,
    averageVolume20: 100000,
  }));
  assertTrue(traps.includes('HIGH_RVOL_LOW_DOLLAR_VOLUME'));
  assertTrue(traps.includes('LOW_DOLLAR_VOLUME'));
});

test('9b. No traps for healthy liquidity', function() {
  const traps = detectLiquidityTraps(makeMarketData({
    price: 100,
    volume: 1500000,
    relativeVolume: 1.5,
    averageVolume20: 1000000,
  }));
  assertTrue(traps.length === 0);
});

test('9c. Thin trading trap', function() {
  const traps = detectLiquidityTraps(makeMarketData({
    averageVolume20: 50000,
    relativeVolume: 1.0,
  }));
  assertTrue(traps.includes('THIN_TRADING'));
});

// ===== 10. Volume profile =====
test('10. Volume profile assessment', function() {
  const profile = assessVolumeProfile(makeMarketData({
    price: 100, volume: 1500000, averageVolume20: 1000000, relativeVolume: 1.5,
  }));
  assertNotNullish(profile);
  assertNotNullish(profile.currentDollarVolume);
  assertNotNullish(profile.averageDollarVolume);
  assertTrue(profile.currentDollarVolume === 150000000);
});

test('10b. Volume profile null for missing data', function() {
  const profile = assessVolumeProfile(makeMarketData({
    price: null, volume: null, averageVolume20: null,
  }));
  assertNullish(profile);
});

// ===== 11. Liquidity risk =====
test('11. Liquidity risk assessment', function() {
  const risk = calculateLiquidityRisk(makeMarketData({
    price: 100, volume: 1500000, averageVolume20: 1000000, relativeVolume: 1.5,
  }));
  assertTrue(risk.score >= 0 && risk.score <= 100);
  assertTrue(['MINIMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(risk.level));
  assertTrue(risk.reasons.length > 0);
});

test('11b. Liquidity risk for thin trading', function() {
  const risk = calculateLiquidityRisk(makeMarketData({
    price: 5, volume: 50000, averageVolume20: 50000, relativeVolume: 0.5,
  }));
  assertTrue(risk.score >= 40);
  assertTrue(risk.level === 'HIGH' || risk.level === 'CRITICAL');
});

// ===== 12. Scoring and quality =====
test('12. Liquidity score is in 0-100 range', function() {
  const result = buildLiquidityIntelligence(makeMarketData(), 'TEST');
  assertNotNullish(result.liquidityScore);
  assertTrue(result.liquidityScore >= 0 && result.liquidityScore <= 100);
});

test('12b. Liquidity score is null when marketData is null', function() {
  const result = buildLiquidityIntelligence(null, 'TEST');
  assertNullish(result.liquidityScore);
});

test('12c. Component scores are present', function() {
  const result = buildLiquidityIntelligence(makeMarketData(), 'TEST');
  assertNotNullish(result.componentScores.volumeTier);
  assertNotNullish(result.componentScores.dollarVolume);
  assertNotNullish(result.componentScores.volumeConfirmation);
  assertNotNullish(result.componentScores.liquidityDepth);
  assertNotNullish(result.componentScores.dataCompleteness);
});

test('12d. Component scores are null for missing data', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    averageVolume20: null, price: null, volume: null,
    relativeVolume: null, bollingerBandwidth: null, volumeScore: null,
  }), 'TEST');
  assertNullish(result.componentScores.volumeTier);
  assertNullish(result.componentScores.dollarVolume);
  assertNullish(result.componentScores.volumeConfirmation);
  assertNullish(result.componentScores.liquidityDepth);
  assertEqual(result.componentScores.dataCompleteness, 0);
  assertNullish(result.liquidityScore);
});

// ===== 13. Missing-component renormalization =====
test('13. Missing components are renormalized', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    averageVolume20: null, relativeVolume: null, volumeScore: null,
    bollingerBandwidth: null,
  }), 'TEST');
  assertTrue(typeof result.liquidityScore === 'number' || result.liquidityScore == null);
  if (result.liquidityScore != null) {
    assertTrue(result.liquidityScore >= 0 && result.liquidityScore <= 100);
  }
});

// ===== 14. Reasons =====
test('14. Reasons are deterministic and evidence-based', function() {
  const result = buildLiquidityIntelligence(makeMarketData(), 'TEST');
  assertTrue(result.reasons.length > 0);
  assertTrue(result.reasons.some(r => r.includes('Liquidity quality') || r.includes('Dollar volume') || r.includes('RVOL')));
});

test('14b. Reasons for no data', function() {
  const result = buildLiquidityIntelligence(null, 'TEST');
  assertTrue(result.reasons.length === 0);
});

// ===== 15. Warnings =====
test('15. Warnings detect critical liquidity', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 10, volume: 5000, averageVolume20: 50000, relativeVolume: 0.5,
  }), 'TEST');
  assertTrue(result.liquidityScore != null && result.liquidityScore < 50);
  assertTrue(result.warnings.length > 0);
});

test('15b. Warnings for null data', function() {
  const result = buildLiquidityIntelligence(null, 'TEST');
  assertTrue(result.warnings.includes('NO_MARKET_DATA'));
});

// ===== 16. Flags =====
test('16. Flags identify liquidity conditions', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 10, volume: 5000, averageVolume20: 50000, relativeVolume: 0.3,
    bollingerBandwidth: 15,
  }), 'TEST');
  assertTrue(result.flags.length > 0);
  assertTrue(result.flags.some(f => f.startsWith('TRAP_') || f === 'LOW_LIQUIDITY' || f === 'LOW_DOLLAR_VOLUME'));
});

test('16b. Flags for healthy liquidity', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 100, volume: 1500000, averageVolume20: 1000000,
    relativeVolume: 1.5, bollingerBandwidth: 4,
  }), 'TEST');
  assertTrue(result.flags.includes('LIQ_EXCELLENT') || result.flags.includes('LIQ_GOOD') || result.flags.includes('HIGH_LIQUIDITY'));
});

// ===== 17. Data availability and completeness =====
test('17. Data availability is calculated', function() {
  const result = buildLiquidityIntelligence(makeMarketData(), 'TEST');
  assertTrue(result.dataCompleteness > 0);
  assertTrue(result.dataCompleteness <= 100);
  assertTrue(typeof result.dataAvailability === 'object');
  assertTrue(result.dataAvailability.price === true);
  assertTrue(result.dataAvailability.volume === true);
});

test('17b. Data completeness is low for missing fields', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: null, volume: null, averageVolume20: null,
    relativeVolume: null, bollingerBandwidth: null, volumeScore: null,
  }), 'TEST');
  assertTrue(result.dataCompleteness < 50);
});

// ===== 18. Stable deterministic output =====
test('18. Stable deterministic output', function() {
  const md = makeMarketData({ symbol: 'STABLE' });
  const result1 = buildLiquidityIntelligence(md, 'STABLE');
  const result2 = buildLiquidityIntelligence(md, 'STABLE');
  assertEqual(result1.liquidityScore, result2.liquidityScore);
  assertEqual(result1.quality, result2.quality);
  assertEqual(JSON.stringify(result1.reasons), JSON.stringify(result2.reasons));
  assertEqual(JSON.stringify(result1.flags), JSON.stringify(result2.flags));
  assertEqual(JSON.stringify(result1.warnings), JSON.stringify(result2.warnings));
  assertEqual(JSON.stringify(result1.liquidityTraps), JSON.stringify(result2.liquidityTraps));
});

// ===== 19. Integration: full market data =====
test('19. Full integration - complete market data', function() {
  const result = buildLiquidityIntelligence(makeMarketData({ symbol: 'AAPL' }), 'AAPL');
  assertEqual(result.symbol, 'AAPL');
  assertNotNullish(result.liquidityScore);
  assertTrue(['EXCELLENT', 'GOOD', 'MODERATE', 'POOR', 'CRITICAL', 'UNAVAILABLE'].includes(result.quality));
  assertTrue(result.reasons.length > 0);
  assertTrue(result.flags.length > 0);
  assertTrue(result.disclaimer.includes('analytical only'));
  assertTrue(result.dataCompleteness > 0);
  assertNotNullish(result.volumeProfile);
});

// ===== 20. Default intelligence =====
test('20. defaultLiquidityIntelligence', function() {
  const def = defaultLiquidityIntelligence('DEFAULT');
  assertNullish(def.liquidityScore);
  assertEqual(def.quality, 'UNAVAILABLE');
  assertEqual(def.dollarVolumeClass, 'unavailable');
  assertEqual(def.liquidityTraps.length, 0);
  assertEqual(def.liquidityTrapCount, 0);
  assertTrue(def.warnings.includes('NO_MARKET_DATA'));
  assertTrue(def.disclaimer.includes('analytical only'));
  assertTrue(def.dataAvailability.price === false);
  assertTrue(def.dataAvailability.volume === false);
});

// ===== 21. Liquidity tiers and risk levels =====
test('21. Liquidity tier classification', function() {
  const excellent = buildLiquidityIntelligence(makeMarketData({
    averageVolume20: 2_000_000, price: 100, volume: 2_000_000, relativeVolume: 2.0,
  }), 'TEST');
  assertTrue(excellent.liquidityScore != null && excellent.liquidityScore >= 80);

  const poor = buildLiquidityIntelligence(makeMarketData({
    averageVolume20: 50_000, price: 5, volume: 10_000, relativeVolume: 0.2,
  }), 'TEST');
  assertTrue(poor.liquidityScore != null && poor.liquidityScore <= 40);
});

test('21b. Risk levels from liquidity risk', function() {
  const highRisk = calculateLiquidityRisk(makeMarketData({
    price: 2, volume: 5000, averageVolume20: 30000, relativeVolume: 0.3,
  }));
  assertTrue(highRisk.level === 'HIGH' || highRisk.level === 'CRITICAL');

  const lowRisk = calculateLiquidityRisk(makeMarketData({
    price: 100, volume: 2_000_000, averageVolume20: 1_000_000, relativeVolume: 1.5,
  }));
  assertTrue(lowRisk.level !== 'CRITICAL');
});

// ===== 22. Boundaries =====
test('22. Boundary: empty symbol defaults to null', function() {
  const result = buildLiquidityIntelligence(null, null);
  assertNullish(result.symbol);
});

test('22b. Boundary: score clamping', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    averageVolume20: 999999999, price: 999999, volume: 999999, relativeVolume: 99,
  }), 'TEST');
  assertTrue(result.liquidityScore <= 100);
});

test('22c. Boundary: zero volume', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 100, volume: 0, averageVolume20: 0, relativeVolume: 0,
  }), 'TEST');
  assertTrue(result.liquidityScore != null && result.liquidityScore >= 0);
  assertTrue(result.flags.includes('ZERO_VOLUME'));
});

// ===== 23. Ranking =====
test('23. Ranking sorts by score descending', function() {
  const results = [
    buildLiquidityIntelligence(makeMarketData({ symbol: 'LOW', averageVolume20: 50000, price: 5, volume: 5000, relativeVolume: 0.3 }), 'LOW'),
    buildLiquidityIntelligence(makeMarketData({ symbol: 'HIGH', averageVolume20: 2000000, price: 100, volume: 2000000, relativeVolume: 2.0 }), 'HIGH'),
  ];
  const ranked = rankLiquidityOpportunities(results);
  assertNotNullish(ranked.top);
  assertNotNullish(ranked.alternatives);
  assertTrue(ranked.ranked[0].liquidityScore >= ranked.ranked[1].liquidityScore);
  assertEqual(ranked.ranked[0].symbol, 'HIGH');
});

// ===== 24. Zero volume handling =====
test('24. Zero volume treated as no data', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: 100, volume: 0, averageVolume20: 1000000, relativeVolume: 0,
  }), 'TEST');
  // Zero volume should trigger traps/flags but not crash
  assertTrue(result.flags.includes('ZERO_VOLUME'));
});

// ===== 25. Regression A1-A7 =====
import { calculatePennyScore } from '../lib/penny-intelligence.js';
import { buildEarlyExplosionIntelligence } from '../lib/early-explosion-intelligence.js';
import { buildSwingIntelligence } from '../lib/swing-intelligence.js';
import { buildSecEdgarIntelligence } from '../lib/sec-edgar-intelligence.js';
import { buildSetupIntelligence } from '../lib/setup-intelligence.js';
import { computeOptionsSignal } from '../lib/hunter-intelligence.js';

test('25. Regression A1: Penny Intelligence unaffected by A8', function() {
  const pennyData = makeMarketData({ symbol: 'PENNY', price: 3.50, relativeVolume: 1.6, rsi: 55 });
  const score = calculatePennyScore(pennyData);
  assertTrue(typeof score === 'number');
  assertTrue(score >= 0 && score <= 100);
  assertTrue(Number.isFinite(score));
});

test('25b. Regression A2: Options Intelligence unaffected by A8', function() {
  const contracts = [
    { optionType: 'CALL', volume: 1000, openInterest: 500, liquidityScore: 80, impliedVolatility: 0.45 },
    { optionType: 'PUT', volume: 800, openInterest: 400, liquidityScore: 70, impliedVolatility: 0.50 },
  ];
  const optionsResult = { available: true, source: 'Yahoo', contracts, underlyingPrice: 105, expiry: '2026-01-16', count: 2 };
  const signal = computeOptionsSignal(optionsResult);
  assertTrue(signal.available === true);
  assertTrue(typeof signal.score === 'number');
});

test('25c. Regression A4: Swing Intelligence unaffected by A8', function() {
  const result = buildSwingIntelligence(makeMarketData({ symbol: 'SWING' }));
  assertTrue(result.swingScore >= 0 && result.swingScore <= 100);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
});

test('25d. Regression A5: Early Explosion Intelligence unaffected by A8', function() {
  const result = buildEarlyExplosionIntelligence(makeMarketData({ symbol: 'EXPLOSION', setupScore: 90, momentumScore: 90, volumeScore: 80, trendScore: 75 }));
  assertTrue(result.explosionScore >= 0 && result.explosionScore <= 100);
  assertTrue(['EXTREME', 'HIGH', 'WATCH', 'LOW', 'UNAVAILABLE'].includes(result.quality));
});

test('25e. Regression A6: SEC EDGAR Intelligence unaffected by A8', function() {
  const secData = {
    cik: '0000320193', symbol: 'AAPL',
    filings: [{ form: '10-K', filingDate: '2024-10-30', daysAgo: 30, accessionNumber: '0000320193-24-000151' }],
    dilutionRisk: 'none', offeringRisk: 'none', secRiskScore: 20,
  };
  const result = buildSecEdgarIntelligence(secData, 'AAPL');
  assertTrue(result.secEdgarScore >= 0 && result.secEdgarScore <= 100);
});

test('25f. Regression A7: Setup Intelligence unaffected by A8', function() {
  const result = buildSetupIntelligence(makeMarketData({ symbol: 'SETUP' }), 'SETUP');
  assertTrue(typeof result.setupScore === 'number' || result.setupScore == null);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
});

test('25g. Regression: A8 engine does not mutate input market data', function() {
  const md = makeMarketData({ symbol: 'NO_MUTATE' });
  const originalScore = md.setupScore;
  const originalPrice = md.price;
  buildLiquidityIntelligence(md, 'NO_MUTATE');
  assertEqual(md.setupScore, originalScore);
  assertEqual(md.price, originalPrice);
});

// ===== 26. No fabricated data =====
test('26. No fabricated values for missing data', function() {
  const result = buildLiquidityIntelligence(makeMarketData({
    price: null, volume: null, averageVolume20: null,
    relativeVolume: null, bollingerBandwidth: null,
  }), 'TEST');
  assertNullish(result.dollarVolume);
  assertNullish(result.averageDollarVolume);
  assertNullish(result.relativeVolume);
  assertNullish(result.liquidityScore);
  assertEqual(result.quality, 'UNAVAILABLE');
});

console.log('\n========================================');
console.log('Liquidity Intelligence Tests: ' + passed + ' Passed, ' + failed + ' Failed, ' + (passed + failed) + ' Total');
console.log('========================================');
if (failed > 0) process.exit(1);
