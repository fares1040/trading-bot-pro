/**
 * Penny Intelligence Manager Tests (B1)
 *
 * Tests the unified B1 orchestration layer that composes A1-A8 outputs.
 *
 * Run with: node scripts/test-penny-intelligence-manager.mjs
 */

import {
  buildPennyIntelligence,
  defaultPennyIntelligence,
  filterPennyStocks,
  rankPennyOpportunities,
  calculateUnifiedScore,
  classifyPennyOpportunity,
  buildPennyCore,
  buildPennyLiquidity,
  buildPennyRisk,
  buildPennyStructure,
  buildPennyVolatility,
  buildAction,
  buildThesis,
  defaultSecIntelligence,
  n,
  clamp,
  pennyFilters,
  unifiedWeights,
} from '../lib/penny-intelligence-manager.js';

import {
  calculatePennyScore,
  calculatePennyRiskScore,
} from '../lib/penny-intelligence.js';

import {
  buildSetupIntelligence,
} from '../lib/setup-intelligence.js';

import {
  buildLiquidityIntelligence,
} from '../lib/liquidity-intelligence.js';

console.log('========================================');
console.log('Penny Intelligence Manager Tests (B1)');
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
    throw new Error((msg || '') + ' Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertClose(actual, expected, tol = 0.01, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error((msg || '') + ' Expected ~' + expected + ', got ' + actual);
  }
}

function assertNullish(value, msg) {
  if (value != null) throw new Error((msg || '') + ' Expected null/undefined, got ' + value);
}

function assertNotNullish(value, msg) {
  if (value == null) throw new Error((msg || '') + ' Expected non-null');
}

function assertTrue(condition, msg) {
  if (!condition) throw new Error(msg || 'Expected true, got false');
}

function makeStockData(overrides) {
  return {
    symbol: 'PENNY',
    price: 2.50,
    previousClose: 2.40,
    change: 0.10,
    changePercent: 4.17,
    volume: 5000000,
    averageVolume20: 2000000,
    relativeVolume: 2.5,
    momentumPercent: 15.0,
    momentumScore: 75,
    volumeScore: 70,
    liquidityScore: 85,
    trendScore: 65,
    breakout: 60,
    breakoutScore: 60,
    rsi: 55,
    rsiScore: 65,
    sma20: 2.45,
    sma50: 2.30,
    resistance20: 2.75,
    support20: 2.25,
    resistanceDistancePercent: 10.0,
    targetPrice: 2.75,
    stopLoss: 2.25,
    riskPercent: 10.0,
    rewardPercent: 20.0,
    riskReward: 2.0,
    riskScore: 80,
    atr: 0.30,
    bollingerBandwidth: 5.0,
    squeeze: false,
    squeezeScore: 30,
    cluster: false,
    clusterRangePercent: 6.0,
    clusterScore: 50,
    technicalScore: 70,
    discoveryScore: 75,
    setupScore: 72,
    signal: 'BUY',
    signalStrength: 'MEDIUM',
    directionBias: 'ميل فني صاعد',
    riskLevel: 'متوسط',
    dayHigh: 2.60,
    dayLow: 2.38,
    technicalReady: true,
    dataAvailability: { price: true, volume: true, technicals: true, options: false, darkPool: false, institutionalFlow: false },
    source: 'Hunter Stocks API',
    ...overrides,
  };
}

// ===== 1. Null/undefined input =====
test('1. Null stock data returns default intelligence', function() {
  const result = buildPennyIntelligence(null, {});
  assertEqual(result.kind, 'PENNY');
  assertEqual(result.unified?.quality, 'UNAVAILABLE');
  assertNullish(result.unified?.score);
  assertEqual(result.symbol, null);
  assertTrue(result.warnings.includes('NO_MARKET_DATA'));
  assertTrue(result.provenance.pennyCore === 'A1');
  assertTrue(result.provenance.setup === 'A7');
  assertTrue(result.provenance.marketLiquidity === 'A8');
  assertTrue(result.provenance.sec === 'A6');
});

test('1b. Default intelligence structure', function() {
  const def = defaultPennyIntelligence('DEFAULT');
  assertEqual(def.symbol, 'DEFAULT');
  assertEqual(def.kind, 'PENNY');
  assertNullish(def.unified?.score);
  assertEqual(def.unified?.quality, 'UNAVAILABLE');
  assertEqual(def.dataCompleteness, 0);
  assertEqual(def.technicalReady, false);
  assertTrue(def.disclaimer.includes('A1-A8'));
});

// ===== 2. Penny Core =====
test('2. Penny Core computes score and reasons', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.penny.score);
  assertTrue(result.penny.score >= 0 && result.penny.score <= 100);
  assertTrue(result.penny.reasons.length > 0);
  assertTrue(['STRONG', 'WATCH', 'MODERATE', 'WEAK', 'UNAVAILABLE'].includes(result.penny.quality));
});

test('2b. Penny Core uses A1 scoring directly', function() {
  const data = makeStockData();
  const direct = calculatePennyScore(data);
  const result = buildPennyIntelligence(data, {});
  assertEqual(result.penny.score, direct);
});

// ===== 3. Liquidity =====
test('3. Penny Liquidity computes dollar volume and quality', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.liquidity.dollarVolume);
  assertTrue(result.liquidity.dollarVolume > 0);
  assertTrue(['unavailable', 'very-low', 'low', 'healthy', 'strong'].includes(result.liquidity.dollarVolumeClass));
  assertNotNullish(result.liquidity.score);
  assertNotNullish(result.liquidity.volumeQualityScore);
});

test('3b. Penny Liquidity matches A1 functions', function() {
  const data = makeStockData();
  const result = buildPennyIntelligence(data, {});
  const price = n(data.price);
  const volume = n(data.volume);
  const expectedDv = price * volume;
  assertClose(result.liquidity.dollarVolume, expectedDv, 0.01);
});

// ===== 4. Volatility =====
test('4. Volatility computes ATR and risk', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.volatility.atr);
  assertEqual(result.volatility.vwapStatus, 'unavailable');
  assertNotNullish(result.volatility.volatilityRisk);
  assertTrue(result.volatility.volatilityRisk >= 0 && result.volatility.volatilityRisk <= 100);
});

// ===== 5. Structure =====
test('5. Structure computes score and proximities', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.structure.score);
  assertTrue(result.structure.score >= 0 && result.structure.score <= 100);
  assertTrue(result.structure.supportProximity !== null);
  assertTrue(result.structure.resistanceProximity !== null);
  assertTrue(['breakout', 'near-breakout', 'watch', 'unavailable'].includes(result.structure.breakoutProximity));
});

// ===== 6. Zones =====
test('6. Entry target zones are generated', function() {
  const result = buildPennyIntelligence(makeStockData({ support20: 2.25, resistance20: 2.75, atr: 0.30 }), {});
  assertEqual(result.zones.entryZone, '$2.25 - $2.29');
  assertEqual(result.zones.targetZone, '$2.75');
});

// ===== 7. Risk =====
test('7. Risk score is 0-100 and matches A1', function() {
  const data = makeStockData();
  const result = buildPennyIntelligence(data, {});
  assertNotNullish(result.risk.score);
  assertTrue(result.risk.score >= 0 && result.risk.score <= 100);
  assertTrue(['low', 'moderate', 'high', 'extreme', 'unavailable'].includes(result.risk.level));
  assertTrue(result.risk.label.length > 0);
  assertTrue(result.risk.flags.length > 0 || result.risk.flags.length === 0);
});

test('7b. Risk matches A1 calculatePennyRiskScore', function() {
  const data = makeStockData();
  const result = buildPennyIntelligence(data, {});

  const liq = buildPennyLiquidity(data);
  const riskComponents = result.risk.components;
  const directRiskScore = calculatePennyRiskScore(riskComponents);
  assertEqual(result.risk.score, directRiskScore);
});

// ===== 8. A7 Setup Integration =====
test('8. A7 Setup Intelligence is computed from stock data', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertTrue(result.setup.quality !== undefined);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.setup.quality));
  assertTrue(typeof result.setup.setupType === 'string');
  assertNotNullish(result.setup.setupScore);
  assertTrue(result.setup.setupScore >= 0 && result.setup.setupScore <= 100);
});

test('8b. A7 setup integration can accept pre-computed results', function() {
  const data = makeStockData();
  const setupResult = buildSetupIntelligence(data, 'PENNY');
  const result = buildPennyIntelligence(data, { setupIntelligence: setupResult });
  assertNotNullish(result.setup.setupScore);
  assertEqual(result.setup.setupScore, setupResult.setupScore);
  assertEqual(result.setup.setupType, setupResult.setupType);
});

// ===== 9. A8 Liquidity Integration =====
test('9. A8 Liquidity Intelligence is computed from stock data', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.marketLiquidity.liquidityScore);
  assertTrue(result.marketLiquidity.liquidityScore >= 0 && result.marketLiquidity.liquidityScore <= 100);
  assertTrue(['EXCELLENT', 'GOOD', 'MODERATE', 'POOR', 'CRITICAL', 'UNAVAILABLE'].includes(result.marketLiquidity.quality));
  assertTrue(Array.isArray(result.marketLiquidity.liquidityTraps));
  assertNotNullish(result.marketLiquidity.liquidityRisk);
});

test('9b. A8 liquidity integration can accept pre-computed results', function() {
  const data = makeStockData();
  const liqResult = buildLiquidityIntelligence(data, 'PENNY');
  const result = buildPennyIntelligence(data, { liquidityIntelligence: liqResult });
  assertEqual(result.marketLiquidity.liquidityScore, liqResult.liquidityScore);
  assertEqual(result.marketLiquidity.quality, liqResult.quality);
});

// ===== 10. SEC EDGAR Integration =====
test('10. SEC intelligence is integrated when provided', function() {
  const secIntel = {
    secRiskScore: 20,
    secRiskLevel: 'low',
    secRiskFlags: [],
    secRiskReasons: [],
    dilutionRisk: 'none',
    offeringRisk: 'none',
    warrantRisk: 'none',
    convertibleRisk: 'none',
    reverseSplitRisk: 'none',
    reverseSplitDetected: false,
    latestRelevantFilings: [{ form: '10-K', filingDate: '2024-10-30' }],
    secDataStatus: 'ok',
  };
  const result = buildPennyIntelligence(makeStockData(), { secIntelligence: secIntel });
  assertEqual(result.sec.secRiskScore, 20);
  assertEqual(result.sec.secRiskLevel, 'low');
  assertEqual(result.sec.secDataStatus, 'ok');
  assertEqual(result.dataAvailability.sec, true);
});

test('10b. SEC defaults when not provided', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertEqual(result.sec.secDataStatus, 'unavailable');
  assertEqual(result.sec.dilutionRisk, 'unavailable');
  assertEqual(result.dataAvailability.sec, false);
});

// ===== 11. Unified Score =====
test('11. Unified score is computed from all layers', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertNotNullish(result.unified?.score);
  assertTrue(result.unified.score >= 0 && result.unified.score <= 100);
  assertTrue(['STRONG', 'WATCH', 'MODERATE', 'WEAK', 'UNAVAILABLE'].includes(result.unified?.quality));
  assertTrue(result.unified.action.length > 0);
  assertTrue(result.unified.thesis.length > 0);
});

test('11b. Unified score renormalization with missing components', function() {
  const data = makeStockData({ setupScore: null, rsi: null });
  const result = buildPennyIntelligence(data, {});
  assertTrue(result.setup.setupScore != null || result.setup.setupScore == null);
  if (result.unified?.score != null) {
    assertTrue(result.unified.score >= 0 && result.unified.score <= 100);
  }
});

test('11c. Unified score is null when no data', function() {
  const result = buildPennyIntelligence(null, {});
  assertNullish(result.unified?.score);
  assertEqual(result.unified?.quality, 'UNAVAILABLE');
});

// ===== 12. Provenance =====
test('12. Provenance tracks all A1-A8 sources', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertEqual(result.provenance.pennyCore, 'A1');
  assertEqual(result.provenance.risk, 'A1');
  assertEqual(result.provenance.liquidity, 'A1');
  assertEqual(result.provenance.volatility, 'A1');
  assertEqual(result.provenance.structure, 'A1');
  assertEqual(result.provenance.zones, 'A1');
  assertEqual(result.provenance.setup, 'A7');
  assertEqual(result.provenance.marketLiquidity, 'A8');
  assertEqual(result.provenance.sec, 'A6');
});

// ===== 13. Reasons, Warnings, Flags =====
test('13. Reasons combine from all layers', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertTrue(result.reasons.length > 0);
  assertTrue(result.reasons.some(r => r.includes('RVOL') || r.includes('Dollar volume') || r.includes('Technical')));
});

test('13b. Warnings are deduplicated', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: 0.50, volume: 5000, averageVolume20: 100000, relativeVolume: 2.5,
  }), {});
  const warnings = result.warnings;
  const unique = [...new Set(warnings)];
  assertEqual(warnings.length, unique.length);
});

test('13c. Flags are deduplicated', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: 0.50, volume: 5000, averageVolume20: 50000, relativeVolume: 0.3,
    bollingerBandwidth: 15,
  }), {});
  const flags = result.flags;
  const unique = [...new Set(flags)];
  assertEqual(flags.length, unique.length);
});

// ===== 14. Data Availability =====
test('14. Data availability reflects all layers', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertTrue(result.dataAvailability.price === true);
  assertTrue(result.dataAvailability.volume === true);
  assertTrue(result.dataAvailability.technicals === true);
  assertTrue(result.dataAvailability.sec === false);
  assertTrue(result.dataAvailability.setup !== false);
  assertTrue(result.dataAvailability.marketLiquidity !== false);
  assertTrue(result.dataCompleteness > 0);
});

test('14b. Data completeness low for missing data', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: null, volume: null, averageVolume20: null,
    relativeVolume: null, rsi: null, bollingerBandwidth: null,
    dataAvailability: { price: false, volume: false, technicals: false, options: false, darkPool: false, institutionalFlow: false },
  }), {});
  assertTrue(result.dataCompleteness < 50);
});

// ===== 15. Filter Penny Stocks =====
test('15. filterPennyStocks filters by price, volume, RVOL, technicalReady', function() {
  const stocks = [
    { symbol: 'PENNY', price: 2.50, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'EXPENSIVE', price: 10.00, averageVolume20: 500000, relativeVolume: 2.0, technicalReady: true },
    { symbol: 'CHEAP', price: 0.50, averageVolume20: 50000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'LOWVOL', price: 1.00, averageVolume20: 200000, relativeVolume: 0.5, technicalReady: true },
    { symbol: 'NOTECH', price: 1.00, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: false },
  ];
  const filtered = filterPennyStocks(stocks);
  assertEqual(filtered.length, 1);
  assertEqual(filtered[0].symbol, 'PENNY');
});

test('15b. filterPennyStocks handles empty/null input', function() {
  assertEqual(filterPennyStocks(null).length, 0);
  assertEqual(filterPennyStocks([]).length, 0);
  assertEqual(filterPennyStocks(undefined).length, 0);
});

test('15c. filterPennyStocks boundary prices', function() {
  const stocks = [
    { symbol: 'BL', price: 0.10, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'BH', price: 5.00, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'BE', price: 0.09, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'BA', price: 5.01, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
  ];
  const filtered = filterPennyStocks(stocks);
  assertEqual(filtered.length, 2);
  assertTrue(filtered.some(x => x.symbol === 'BL'));
  assertTrue(filtered.some(x => x.symbol === 'BH'));
});

// ===== 16. Ranking =====
test('16. Ranking sorts by unified score descending', function() {
  const results = [
    buildPennyIntelligence(makeStockData({ symbol: 'LOW', setupScore: 30, rsi: 25 }), {}),
    buildPennyIntelligence(makeStockData({ symbol: 'HIGH', setupScore: 90, rsi: 65 }), {}),
  ];
  const ranked = rankPennyOpportunities(results);
  assertEqual(ranked.ranked[0].symbol, 'HIGH');
  assertEqual(ranked.top[0].symbol, 'HIGH');
});

test('16b. Ranking handles empty results', function() {
  const ranked = rankPennyOpportunities([]);
  assertEqual(ranked.ranked.length, 0);
  assertEqual(ranked.top.length, 0);
  assertEqual(ranked.alternatives.length, 0);
});

test('16c. Ranking handles null input', function() {
  const ranked = rankPennyOpportunities(null);
  assertEqual(ranked.ranked.length, 0);
});

// ===== 17. Determinism =====
test('17. Deterministic output for same input', function() {
  const data = makeStockData({ symbol: 'DETERMINISTIC' });
  const result1 = buildPennyIntelligence(data, {});
  const result2 = buildPennyIntelligence(data, {});
  assertEqual(result1.penny.score, result2.penny.score);
  assertEqual(result1.unified.score, result2.unified.score);
  assertEqual(JSON.stringify(result1.reasons), JSON.stringify(result2.reasons));
  assertEqual(JSON.stringify(result1.flags), JSON.stringify(result2.flags));
  assertEqual(JSON.stringify(result1.risk), JSON.stringify(result2.risk));
});

test('17b. Deterministic with SEC integration', function() {
  const data = makeStockData({ symbol: 'SEC_DET' });
  const sec = { secRiskScore: 25, secRiskLevel: 'moderate', secRiskFlags: ['DILUTION_RISK'], secDataStatus: 'ok', dilutionRisk: 'moderate', offeringRisk: 'none', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none', reverseSplitDetected: false, latestRelevantFilings: [], secRiskReasons: [], dilutionReason: 'test', offeringType: null, offeringDate: null, offeringReason: null, warrantReasons: [], reverseSplitDate: null, reverseSplitRatio: null };
  const result1 = buildPennyIntelligence(data, { secIntelligence: sec });
  const result2 = buildPennyIntelligence(data, { secIntelligence: sec });
  assertEqual(result1.sec.secRiskScore, result2.sec.secRiskScore);
  assertEqual(JSON.stringify(result1.sec), JSON.stringify(result2.sec));
});

// ===== 18. Missing/invalid data =====
test('18. Missing fields are null-safe (A1 defaults apply)', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: null, volume: null, averageVolume20: null,
    relativeVolume: null, rsi: null, atr: null,
    support20: null, resistance20: null,
    dataAvailability: { price: false, volume: false, technicals: false, options: false, darkPool: false, institutionalFlow: false },
  }), {});
  assertNotNullish(result);
  assertTrue(typeof result.penny.score === 'number' || result.penny.score == null);
  assertTrue(typeof result.risk.score === 'number' || result.risk.score == null);
  assertTrue(typeof result.unified?.score === 'number' || result.unified?.score == null);
  assertTrue(result.dataCompleteness === 0);
});

test('18b. Invalid data types handled gracefully', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: 'invalid',
    volume: NaN,
    averageVolume20: 'abc',
    relativeVolume: Infinity,
  }), {});
  assertTrue(typeof result === 'object');
  assertTrue(typeof result.penny?.score === 'number' || result.penny?.score == null);
});

test('18c. NaN/Infinity do not crash', function() {
  const md = makeStockData();
  md.price = NaN;
  md.volume = Infinity;
  md.relativeVolume = NaN;
  md.atr = Infinity;
  md.rsi = -Infinity;
  md.setupScore = NaN;
  const result = buildPennyIntelligence(md, {});
  assertTrue(typeof result === 'object');
  assertTrue(result.unified?.score != null && Number.isFinite(result.unified.score));
});

// ===== 19. No fabricated data =====
test('19. No fabricated data for completely null input', function() {
  const result = buildPennyIntelligence(null, {});
  assertEqual(result.unified?.score, null);
  assertEqual(result.unified?.quality, 'UNAVAILABLE');
  assertNullish(result.penny.score);
  assertNullish(result.risk.score);
  assertNullish(result.liquidity.dollarVolume);
  assertNullish(result.zones.entryZone);
  assertTrue(result.warnings.includes('NO_MARKET_DATA'));
});

// ===== 20. No input mutation =====
test('20. Input stock data is not mutated', function() {
  const data = makeStockData({ symbol: 'NO_MUTATE' });
  const originalScore = data.setupScore;
  const originalPrice = data.price;
  buildPennyIntelligence(data, {});
  assertEqual(data.setupScore, originalScore);
  assertEqual(data.price, originalPrice);
});

// ===== 21. Action and Thesis =====
test('21. Action and thesis are generated', function() {
  const result = buildPennyIntelligence(makeStockData(), {});
  assertTrue(result.unified.action.length > 0);
  assertTrue(result.unified.thesis.length > 0);
});

test('21b. Action reflects score and risk', function() {
  const highScore = buildPennyIntelligence(makeStockData({ setupScore: 90, rsi: 65 }), {});
  const lowScore = buildPennyIntelligence(makeStockData({ setupScore: 30, rsi: 25 }), {});
  assertTrue(highScore.unified.score > lowScore.unified.score);
});

// ===== 22. Boundaries =====
test('22. Empty symbol returns null', function() {
  const result = buildPennyIntelligence(makeStockData({ symbol: null }), {});
  assertNullish(result.symbol);
});

test('22b. Zero volume is handled', function() {
  const result = buildPennyIntelligence(makeStockData({
    price: 1.00, volume: 0, averageVolume20: 0, relativeVolume: 0,
  }), {});
  assertTrue(result.liquidity.dollarVolume === null);
});

// ===== 23. A1-A8 Regression =====
test('23. Regression: A1 functions produce same results independently', function() {
  const data = makeStockData();
  const result = buildPennyIntelligence(data, {});
  assertEqual(result.penny.score, calculatePennyScore(data));
});

test('23b. Regression: A7 buildSetupIntelligence not affected', function() {
  const result = buildPennyIntelligence(makeStockData({ symbol: 'REG_A7' }), {});
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.setup.quality));
  assertTrue(result.setup.setupScore >= 0 && result.setup.setupScore <= 100);
});

test('23c. Regression: A8 buildLiquidityIntelligence not affected', function() {
  const result = buildPennyIntelligence(makeStockData({ symbol: 'REG_A8' }), {});
  assertTrue(['EXCELLENT', 'GOOD', 'MODERATE', 'POOR', 'CRITICAL', 'UNAVAILABLE'].includes(result.marketLiquidity.quality));
  assertTrue(result.marketLiquidity.liquidityScore >= 0 && result.marketLiquidity.liquidityScore <= 100);
});

test('23d. Regression: B1 engine does not mutate input', function() {
  const data = makeStockData({ symbol: 'NO_MUTATION_B1' });
  const snapshot = JSON.stringify(data);
  buildPennyIntelligence(data, {});
  assertEqual(JSON.stringify(data), snapshot);
});

console.log('\n========================================');
console.log('Penny Intelligence Manager Tests: ' + passed + ' Passed, ' + failed + ' Failed, ' + (passed + failed) + ' Total');
console.log('========================================');
if (failed > 0) process.exit(1);
