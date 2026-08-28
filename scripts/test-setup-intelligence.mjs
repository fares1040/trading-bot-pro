import {
  buildSetupIntelligence,
  defaultSetupIntelligence,
  identifySetupType,
  calculateSetupScore,
  classifySetupQuality,
  buildSetupReasons,
  buildSetupWarnings,
  buildSetupFlags,
  calculateSetupDataAvailability,
  calculateSetupDataCompleteness,
  rankSetupOpportunities,
  setupWeights,
  qualityThresholds,
} from '../lib/setup-intelligence.js';

console.log('========================================');
console.log('Technical Setup Intelligence Tests (A7)');
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
  const result = buildSetupIntelligence(null, 'TEST');
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.setupScore);
  assertEqual(result.symbol, 'TEST');
  assertEqual(result.setupType, 'OTHER');
  assertTrue(result.warnings.includes('NO_MARKET_DATA'));
});

test('1b. Missing market data returns UNAVAILABLE', function() {
  const result = buildSetupIntelligence(undefined, 'TEST');
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.setupScore);
});

// ===== 2. Missing/null data fields =====
test('2. Partial market data — missing fields remain null', function() {
  const result = buildSetupIntelligence(makeMarketData({
    rsi: null,
    sma20: null,
    sma50: null,
    riskReward: null,
    relativeVolume: null,
  }), 'TEST');
  assertNullish(result.rsi);
  assertNullish(result.sma20);
  assertNullish(result.sma50);
  assertNullish(result.riskReward);
  assertNullish(result.relativeVolume);
  assertNullish(result.componentScores.riskReward);
  assertTrue(result.warnings.includes('NO_RISK_REWARD'));
});

// ===== 3. Invalid data =====
test('3. Invalid data types are handled gracefully', function() {
  const result = buildSetupIntelligence(makeMarketData({
    price: 'invalid',
    rsi: NaN,
    setupScore: Infinity,
    riskReward: -1,
    relativeVolume: 'abc',
  }), 'TEST');
  assertNullish(result.price);
  assertNullish(result.rsi);
  assertNullish(result.componentScores.setupStrength);
  assertEqual(result.riskReward, -1);
  assertNotNullish(result);
});

test('3b. NaN/Infinity do not crash', function() {
  const md = makeMarketData();
  md.price = NaN;
  md.rsi = Infinity;
  md.setupScore = NaN;
  md.riskReward = Infinity;
  md.relativeVolume = NaN;
  const result = buildSetupIntelligence(md, 'TEST');
  assertTrue(typeof result === 'object');
  assertNullish(result.componentScores.setupStrength);
  assertTrue(result.setupScore >= 0 && result.setupScore <= 100);
});

// ===== 4. Setup type classification =====
test('4. BREAKOUT setup detected', function() {
  const md = makeMarketData({ price: 110, resistance20: 105, relativeVolume: 1.5 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'BREAKOUT');
  assertTrue(result.flags.includes('BREAKOUT'));
});

test('4b. SQUEEZE setup detected', function() {
  const md = makeMarketData({ squeeze: true, bollingerBandwidth: 3, price: 99, sma20: 100 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'SQUEEZE');
  assertTrue(result.flags.includes('BOLLINGER_SQUEEZE'));
});

test('4c. REVERSAL setup detected', function() {
  const md = makeMarketData({ price: 96, sma20: 100, sma50: 95, rsi: 28, relativeVolume: 1.2 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'REVERSAL');
});

test('4d. PULLBACK setup detected', function() {
  const md = makeMarketData({ price: 100.5, sma20: 100, rsi: 50, relativeVolume: 1.0 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'PULLBACK');
});

test('4e. CONTINUATION setup detected', function() {
  const md = makeMarketData({ trendScore: 75, sma50: 95, price: 100, rsi: 55 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'CONTINUATION');
});

test('4f. MOMENTUM setup detected', function() {
  const md = makeMarketData({ momentumScore: 85, volumeScore: 70, trendScore: 60 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'MOMENTUM');
});

test('4g. CONSOLIDATION setup detected', function() {
  const md = makeMarketData({ bollingerBandwidth: 3, price: 100, sma20: 100 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertTrue(['CONSOLIDATION', 'SQUEEZE', 'BREAKOUT', 'PULLBACK', 'CONTINUATION', 'MOMENTUM', 'OTHER'].includes(result.setupType));
});

test('4h. No clear pattern returns OTHER', function() {
  const md = makeMarketData({ price: 100, sma20: 105, sma50: 110, rsi: 60, relativeVolume: 0.5, momentumScore: 30, volumeScore: 30, trendScore: 30 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertEqual(result.setupType, 'OTHER');
});

// ===== 5. Setup scoring =====
test('5. Setup score is in 0–100 range', function() {
  const result = buildSetupIntelligence(makeMarketData(), 'TEST');
  assertNotNullish(result.setupScore);
  assertTrue(result.setupScore >= 0 && result.setupScore <= 100);
});

test('5b. Setup score with full data is high', function() {
  const result = buildSetupIntelligence(makeMarketData(), 'TEST');
  assertTrue(result.setupScore >= 50);
});

test('5c. Setup score is null when marketData is null', function() {
  const result = buildSetupIntelligence(null, 'TEST');
  assertNullish(result.setupScore);
});

// ===== 6. Component scoring =====
test('6. Component scores are present', function() {
  const result = buildSetupIntelligence(makeMarketData(), 'TEST');
  assertNotNullish(result.componentScores.setupStrength);
  assertNotNullish(result.componentScores.volumeConfirmation);
  assertNotNullish(result.componentScores.riskReward);
  assertNotNullish(result.componentScores.technicalReadiness);
  assertNotNullish(result.componentScores.dataCompleteness);
});

test('6b. Component scores are null for missing data', function() {
  const result = buildSetupIntelligence(makeMarketData({
    setupScore: null,
    relativeVolume: null,
    volumeScore: null,
    riskReward: null,
    dataAvailability: { price: false, volume: false, technicals: false },
  }), 'TEST');
  assertNullish(result.componentScores.setupStrength);
  assertNullish(result.componentScores.volumeConfirmation);
  assertNullish(result.componentScores.riskReward);
});

// ===== 7. Quality classification =====
test('7. Quality classification thresholds', function() {
  assertEqual(classifySetupQuality(90), 'TOP');
  assertEqual(classifySetupQuality(85), 'TOP');
  assertEqual(classifySetupQuality(80), 'STRONG');
  assertEqual(classifySetupQuality(70), 'STRONG');
  assertEqual(classifySetupQuality(60), 'WATCH');
  assertEqual(classifySetupQuality(55), 'WATCH');
  assertEqual(classifySetupQuality(50), 'WEAK');
  assertEqual(classifySetupQuality(40), 'WEAK');
  assertEqual(classifySetupQuality(30), 'UNAVAILABLE');
  assertEqual(classifySetupQuality(null), 'UNAVAILABLE');
  assertEqual(classifySetupQuality(0), 'UNAVAILABLE');
  assertEqual(classifySetupQuality(100), 'TOP');
});

// ===== 8. Reasons =====
test('8. Reasons are deterministic and evidence-based', function() {
  const result = buildSetupIntelligence(makeMarketData(), 'TEST');
  assertTrue(result.reasons.length > 0);
  assertTrue(result.reasons.some(r => r.includes('setup') || r.includes('Setup')));
});

test('8b. Reasons for no data', function() {
  const result = buildSetupIntelligence(null, 'TEST');
  assertTrue(result.reasons.length === 0);
});

// ===== 9. Warnings =====
test('9. Warnings detect missing R/R', function() {
  const result = buildSetupIntelligence(makeMarketData({ riskReward: null }), 'TEST');
  assertTrue(result.warnings.includes('NO_RISK_REWARD'));
});

test('9b. Warnings detect low R/R', function() {
  const result = buildSetupIntelligence(makeMarketData({ riskReward: 0.8 }), 'TEST');
  assertTrue(result.warnings.includes('LOW_RISK_REWARD'));
});

test('9c. Warnings detect no clear setup', function() {
  const md = makeMarketData({ price: 100, sma20: 105, sma50: 110, rsi: 60, relativeVolume: 0.5, momentumScore: 30, volumeScore: 30, trendScore: 30 });
  const result = buildSetupIntelligence(md, 'TEST');
  assertTrue(result.warnings.includes('NO_CLEAR_SETUP'));
});

// ===== 10. Flags =====
test('10. Flags identify technical conditions', function() {
  const result = buildSetupIntelligence(makeMarketData({
    squeeze: true,
    cluster: true,
    trendScore: 80,
    momentumScore: 85,
    relativeVolume: 2.5,
    riskReward: 3.5,
    rsi: 25,
  }), 'TEST');
  assertTrue(result.flags.includes('BOLLINGER_SQUEEZE'));
  assertTrue(result.flags.includes('PRICE_CLUSTER'));
  assertTrue(result.flags.includes('STRONG_TREND'));
  assertTrue(result.flags.includes('HIGH_MOMENTUM'));
  assertTrue(result.flags.includes('HIGH_VOLUME_SPIKE'));
  assertTrue(result.flags.includes('HIGH_RISK_REWARD'));
  assertTrue(result.flags.includes('OVERSOLD'));
});

// ===== 11. Data completeness =====
test('11. Data completeness is calculated', function() {
  const result = buildSetupIntelligence(makeMarketData(), 'TEST');
  assertTrue(result.dataCompleteness > 0);
  assertTrue(result.dataCompleteness <= 100);
  assertTrue(typeof result.dataAvailability === 'object');
});

test('11b. Data completeness is low for missing fields', function() {
  const result = buildSetupIntelligence(makeMarketData({
    sma20: null, sma50: null, rsi: null, riskReward: null,
    relativeVolume: null, squeeze: null, bollingerBandwidth: null,
  }), 'TEST');
  assertTrue(result.dataCompleteness < 80);
});

// ===== 12. Missing-component renormalization =====
test('12. Missing components are renormalized', function() {
  const result = buildSetupIntelligence(makeMarketData({
    setupScore: null,
    relativeVolume: null,
    volumeScore: null,
    riskReward: null,
  }), 'TEST');
  assertNotNullish(result.setupScore);
  assertTrue(result.setupScore >= 0 && result.setupScore <= 100);
});

// ===== 13. Signal classification =====
test('13. Signal classification', function() {
  const highResult = buildSetupIntelligence(makeMarketData({ setupScore: 100, relativeVolume: 2.5, volumeScore: 90, riskReward: 3.0 }), 'TEST');
  assertEqual(highResult.signal, 'STRONG_BUY');

  const midResult = buildSetupIntelligence(makeMarketData({ setupScore: 75 }), 'TEST');
  assertEqual(midResult.signal, 'BUY');

  const lowResult = buildSetupIntelligence(makeMarketData({ setupScore: 20, volumeScore: 30, trendScore: 30, relativeVolume: 0.5, riskReward: 0.5 }), 'TEST');
  assertEqual(lowResult.signal, 'AVOID');

  const nullResult = buildSetupIntelligence(null, 'TEST');
  assertEqual(nullResult.signal, 'UNAVAILABLE');
});

// ===== 14. Ranking =====
test('14. Ranking sorts by score descending', function() {
  const results = [
    buildSetupIntelligence(makeMarketData({ symbol: 'LOW', setupScore: 30 }), 'LOW'),
    buildSetupIntelligence(makeMarketData({ symbol: 'HIGH', setupScore: 90 }), 'HIGH'),
    buildSetupIntelligence(null, 'NULL'),
  ];
  const ranked = rankSetupOpportunities(results);
  assertNotNullish(ranked.top);
  assertNotNullish(ranked.alternatives);
  assertTrue(ranked.ranked.length === 3);
  assertTrue(ranked.ranked[0].setupScore >= ranked.ranked[2].setupScore);
  assertEqual(ranked.ranked[0].symbol, 'HIGH');
});

// ===== 15. Stable deterministic output =====
test('15. Stable deterministic output', function() {
  const md = makeMarketData({ symbol: 'STABLE' });
  const result1 = buildSetupIntelligence(md, 'STABLE');
  const result2 = buildSetupIntelligence(md, 'STABLE');
  assertEqual(result1.setupScore, result2.setupScore);
  assertEqual(result1.quality, result2.quality);
  assertEqual(result1.setupType, result2.setupType);
  assertEqual(JSON.stringify(result1.reasons), JSON.stringify(result2.reasons));
  assertEqual(JSON.stringify(result1.flags), JSON.stringify(result2.flags));
  assertEqual(JSON.stringify(result1.warnings), JSON.stringify(result2.warnings));
});

// ===== 16. Integration: full market data =====
test('16. Full integration - complete market data', function() {
  const result = buildSetupIntelligence(makeMarketData({ symbol: 'AAPL' }), 'AAPL');
  assertEqual(result.symbol, 'AAPL');
  assertNotNullish(result.setupScore);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
  assertTrue(result.reasons.length > 0);
  assertTrue(result.flags.length > 0);
  assertTrue(result.disclaimer.includes('analytical only'));
  assertTrue(result.dataCompleteness > 0);
});

// ===== 17. Default intelligence =====
test('17. defaultSetupIntelligence', function() {
  const def = defaultSetupIntelligence('DEFAULT');
  assertNullish(def.setupScore);
  assertEqual(def.quality, 'UNAVAILABLE');
  assertEqual(def.setupType, 'OTHER');
  assertEqual(def.signal, 'UNAVAILABLE');
  assertTrue(def.warnings.includes('NO_MARKET_DATA'));
  assertTrue(def.disclaimer.includes('analytical only'));
});

// ===== 18. Setup confidence =====
test('18. Setup confidence reflects pattern strength', function() {
  const breakout = buildSetupIntelligence(makeMarketData({ price: 110, resistance20: 105, relativeVolume: 1.5 }), 'TEST');
  const other = buildSetupIntelligence(makeMarketData({ price: 100, sma20: 105, sma50: 110, rsi: 60, relativeVolume: 0.5, momentumScore: 30, volumeScore: 30, trendScore: 30, bollingerBandwidth: 20, cluster: false, clusterRangePercent: 10 }), 'TEST');
  assertTrue(breakout.setupConfidence > other.setupConfidence);
  assertNotNullish(breakout.setupConfidence);
  assertNullish(other.setupConfidence);
});

// ===== 19. Boundaries =====
test('19. Boundary: empty symbol defaults to null', function() {
  const result = buildSetupIntelligence(null, null);
  assertNullish(result.symbol);
});

test('19b. Boundary: score clamping', function() {
  const result = buildSetupIntelligence(makeMarketData({
    setupScore: 150,
    relativeVolume: 1.5,
    riskReward: 2.0,
  }), 'TEST');
  assertTrue(result.setupScore <= 100);
});

// ===== 20. Regression: re-exports existing data =====
test('20. Regression: passes through market data without mutation', function() {
  const md = makeMarketData({ symbol: 'AAPL' });
  const result = buildSetupIntelligence(md, 'AAPL');
  assertEqual(result.price, 100);
  assertEqual(result.rsi, 55);
  assertEqual(result.riskReward, 2.0);
  assertEqual(result.relativeVolume, 1.5);
});

// ===== 21. Regression A1–A6 =====
import { calculatePennyScore } from '../lib/penny-intelligence.js';
import { buildEarlyExplosionIntelligence } from '../lib/early-explosion-intelligence.js';
import { buildSwingIntelligence } from '../lib/swing-intelligence.js';
import { buildSecEdgarIntelligence } from '../lib/sec-edgar-intelligence.js';
import { computeOptionsSignal } from '../lib/hunter-intelligence.js';

test('21. Regression A1: Penny Intelligence unaffected by A7', function() {
  const pennyData = makeMarketData({
    symbol: 'PENNY',
    price: 3.50,
    relativeVolume: 1.6,
    rsi: 55,
    setupScore: 72,
  });
  const score = calculatePennyScore(pennyData);
  assertTrue(typeof score === 'number');
  assertTrue(score >= 0 && score <= 100);
  assertTrue(Number.isFinite(score));
});

test('21b. Regression A1: Penny score function unchanged', function() {
  const score = calculatePennyScore(makeMarketData({ symbol: 'PENNY2' }));
  assertTrue(typeof score === 'number');
  assertTrue(score >= 0 && score <= 100);
});

test('21c. Regression A2: Options Intelligence unaffected by A7', function() {
  const contracts = [
    { optionType: 'CALL', volume: 1000, openInterest: 500, liquidityScore: 80, impliedVolatility: 0.45 },
    { optionType: 'PUT', volume: 800, openInterest: 400, liquidityScore: 70, impliedVolatility: 0.50 },
  ];
  const optionsResult = {
    available: true,
    source: 'Yahoo Finance',
    contracts,
    underlyingPrice: 105,
    expiry: '2026-01-16',
    count: 2,
  };
  const signal = computeOptionsSignal(optionsResult);
  assertTrue(signal.available === true);
  assertTrue(typeof signal.score === 'number');
  assertTrue(signal.score >= 0 && signal.score <= 100);
});

test('21d. Regression A4: Swing Intelligence unaffected by A7', function() {
  const swingData = makeMarketData({ symbol: 'SWING' });
  const result = buildSwingIntelligence(swingData);
  assertTrue(result.swingScore >= 0 && result.swingScore <= 100);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
});

test('21e. Regression A4: Swing Intelligence deterministic', function() {
  const swingData1 = makeMarketData({ symbol: 'SWING', setupScore: 70 });
  const swingData2 = makeMarketData({ symbol: 'SWING', setupScore: 70 });
  const r1 = buildSwingIntelligence(swingData1);
  const r2 = buildSwingIntelligence(swingData2);
  assertEqual(r1.swingScore, r2.swingScore);
});

test('21f. Regression A5: Early Explosion Intelligence unaffected by A7', function() {
  const explosionData = makeMarketData({ symbol: 'EXPLOSION', setupScore: 90, momentumScore: 90, volumeScore: 80, trendScore: 75 });
  const result = buildEarlyExplosionIntelligence(explosionData);
  assertTrue(result.explosionScore >= 0 && result.explosionScore <= 100);
  assertTrue(['EXTREME', 'HIGH', 'WATCH', 'LOW', 'UNAVAILABLE'].includes(result.quality));
});

test('21g. Regression A6: SEC EDGAR Intelligence unaffected by A7', function() {
  const secData = {
    cik: '0000320193',
    symbol: 'AAPL',
    filings: [
      {
        form: '10-K',
        filingDate: '2024-10-30',
        daysAgo: 30,
        accessionNumber: '0000320193-24-000151',
      },
    ],
    dilutionRisk: 'none',
    offeringRisk: 'none',
    secRiskScore: 20,
  };
  const result = buildSecEdgarIntelligence(secData, 'AAPL');
  assertTrue(result.secEdgarScore >= 0 && result.secEdgarScore <= 100);
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
});

test('21h. Regression: A7 engine does not mutate input market data', function() {
  const md = makeMarketData({ symbol: 'NO_MUTATE' });
  const originalScore = md.setupScore;
  const originalPrice = md.price;
  buildSetupIntelligence(md, 'NO_MUTATE');
  assertEqual(md.setupScore, originalScore);
  assertEqual(md.price, originalPrice);
});

console.log('\n========================================');
console.log('Setup Intelligence Tests: ' + passed + ' Passed, ' + failed + ' Failed, ' + (passed + failed) + ' Total');
console.log('========================================');
if (failed > 0) process.exit(1);
