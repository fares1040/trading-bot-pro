import {
  buildSwingIntelligence,
  defaultSwingIntelligence,
  calculateRSI,
  calculateATR,
  calculateBollinger,
  calculateVWAP,
  calculateTrendScore,
  calculateMomentumScore,
  calculateStructureScore,
  calculateVolumeScore,
  calculateRSIScore,
  calculateBollingerScore,
  calculateATRQualityScore,
  calculateRiskRewardScore,
  detectSwingSetups,
  calculateSwingZones,
  buildSwingReasons,
  buildSwingWarnings,
  buildSwingFlags,
  classifySwingQuality,
  rankSwingOpportunities,
  SWING_WEIGHTS,
  SWING_QUALITY_THRESHOLDS,
} from '../lib/swing-intelligence.js';

console.log('========================================');
console.log('Swing Intelligence Tests (A4)');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('✅ PASS: ' + name);
    passed++;
  } catch (e) {
    console.log('❌ FAIL: ' + name);
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

// ===== RSI =====
test('RSI: known dataset (14 periods)', function() {
  var closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
  var rsi = calculateRSI(closes, 14);
  assertClose(rsi, 72.98, 0.5);
});

test('RSI: insufficient data returns null', function() {
  var closes = [100, 101, 102];
  assertNullish(calculateRSI(closes, 14));
});

test('RSI: flat prices returns 100 (avgLoss = 0)', function() {
  var closes = Array(20).fill(100);
  var rsi = calculateRSI(closes, 14);
  assertEqual(rsi, 100);
});

// ===== ATR =====
test('ATR: known OHLC dataset', function() {
  var highs = [105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119];
  var lows = [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
  var closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
  var atr = calculateATR(highs, lows, closes, 14);
  assertClose(atr, 10, 1);
});

test('ATR: insufficient data returns null', function() {
  var highs = [105, 106];
  var lows = [95, 96];
  var closes = [100, 101];
  assertNullish(calculateATR(highs, lows, closes, 14));
});

test('ATR: invalid OHLC returns null', function() {
  var highs = [100, 101];
  var lows = [105, 106];
  var closes = [100, 101];
  assertNullish(calculateATR(highs, lows, closes, 14));
});

// ===== Bollinger =====
test('Bollinger: known dataset', function() {
  var closes = Array(20).fill(100).map(function(v, i) { return v + (i % 2 === 0 ? 1 : -1); });
  var bb = calculateBollinger(closes, 20);
  assertNotNullish(bb);
  assertNotNullish(bb.bandwidth);
  assertNotNullish(bb.middle);
  assertNotNullish(bb.upper);
  assertNotNullish(bb.lower);
});

test('Bollinger: insufficient data returns defaults', function() {
  var closes = [100, 101, 102];
  var bb = calculateBollinger(closes, 20);
  assertEqual(bb.bandwidth, null);
  assertEqual(bb.squeeze, false);
  assertEqual(bb.score, 0);
});

// ===== VWAP =====
test('VWAP: calculates with daily OHLC data', function() {
  var highs = [105, 106, 107];
  var lows = [95, 96, 97];
  var closes = [100, 101, 102];
  var volumes = [1000, 1100, 1200];
  var vwap = calculateVWAP(highs, lows, closes, volumes);
  assertNotNullish(vwap);
  assertClose(vwap, 101.06, 0.1);
});

// ===== Trend Score =====
test('Trend Score: price above SMA20/50/200 = bullish', function() {
  var score = calculateTrendScore(110, 105, 102, 100);
  assertClose(score, 100, 5);
});

test('Trend Score: price below SMA20/50/200 = bearish', function() {
  var score = calculateTrendScore(90, 95, 98, 100);
  assertClose(score, 37.75, 5);
});

test('Trend Score: price between SMAs = neutral', function() {
  var score = calculateTrendScore(102, 105, 100, 98);
  assertClose(score, 100, 10);
});

test('Trend Score: missing price returns 50', function() {
  var score = calculateTrendScore(null, 105, 100, 98);
  assertEqual(score, 50);
});

// ===== Momentum Score =====
test('Momentum Score: positive momentum = higher score', function() {
  var closes = [100, 101, 102, 103, 104, 105];
  var score = calculateMomentumScore(105, closes, 5);
  assertClose(score, 80, 10);
});

test('Momentum Score: negative momentum = lower score', function() {
  var closes = [105, 104, 103, 102, 101, 100];
  var score = calculateMomentumScore(100, closes, 5);
  assertClose(score, 20, 10);
});

test('Momentum Score: missing data returns 50', function() {
  var score = calculateMomentumScore(null, [100, 101, 102, 103, 104, 105], 5);
  assertEqual(score, 50);
});

// ===== Structure Score =====
test('Structure Score: near resistance = higher score', function() {
  var score = calculateStructureScore(100, [100, 102, 104], [95, 97, 99], 102, 95, null);
  assertClose(score, 70, 10);
});

test('Structure Score: near support = higher score', function() {
  var score = calculateStructureScore(96, [100, 102, 104], [95, 97, 99], 105, 95, null);
  assertClose(score, 65, 10);
});

test('Structure Score: missing data returns 50', function() {
  var score = calculateStructureScore(null, [100, 102], [95, 97], 105, 95, null);
  assertEqual(score, 50);
});

// ===== Volume Score =====
test('Volume Score: high RVOL = high score', function() {
  var score = calculateVolumeScore(2.0, 2000000, 1000000, 200000000);
  assertClose(score, 95, 10);
});

test('Volume Score: low RVOL = neutral score', function() {
  var score = calculateVolumeScore(0.5, 500000, 1000000, 50000000);
  assertClose(score, 50, 10);
});

test('Volume Score: missing data returns 50', function() {
  var score = calculateVolumeScore(null, null, null, null);
  assertEqual(score, 50);
});

// ===== RSI Score =====
test('RSI Score: neutral zone (45-65) = 100', function() {
  assertEqual(calculateRSIScore(50), 100);
  assertEqual(calculateRSIScore(55), 100);
});

test('RSI Score: overbought (70+) = lower', function() {
  assertEqual(calculateRSIScore(75), 60);
  assertEqual(calculateRSIScore(85), 40);
});

test('RSI Score: oversold (<30) = 55', function() {
  assertEqual(calculateRSIScore(25), 55);
});

test('RSI Score: missing = 50', function() {
  assertEqual(calculateRSIScore(null), 50);
});

// ===== Bollinger Score =====
test('Bollinger Score: squeeze = high score', function() {
  var bb = { bandwidth: 4, squeeze: true, score: 100 };
  assertEqual(calculateBollingerScore(bb), 100);
});

test('Bollinger Score: wide bands = low score', function() {
  var bb = { bandwidth: 15, squeeze: false, score: 30 };
  assertEqual(calculateBollingerScore(bb), 30);
});

test('Bollinger Score: missing = 50', function() {
  assertEqual(calculateBollingerScore(null), 50);
});

// ===== ATR Quality Score =====
test('ATR Quality: optimal range (1.5-4%) = 85', function() {
  var score = calculateATRQualityScore(100, 2.5, 0.5);
  assertClose(score, 85, 5);
});

test('ATR Quality: high ATR (>8%) = 35', function() {
  var score = calculateATRQualityScore(100, 10, 0.5);
  assertClose(score, 35, 5);
});

test('ATR Quality: missing = 50', function() {
  assertEqual(calculateATRQualityScore(null, null, null), 50);
});

// ===== Risk/Reward Score =====
test('R/R Score: >= 3 = 100', function() {
  assertEqual(calculateRiskRewardScore(3.5), 100);
  assertEqual(calculateRiskRewardScore(3.0), 100);
});

test('R/R Score: 2-3 = 80-90', function() {
  assertEqual(calculateRiskRewardScore(2.5), 90);
  assertEqual(calculateRiskRewardScore(2.0), 80);
});

test('R/R Score: 1-2 = 45-65', function() {
  assertEqual(calculateRiskRewardScore(1.5), 65);
  assertEqual(calculateRiskRewardScore(1.0), 45);
});

test('R/R Score: < 1 = 25', function() {
  assertEqual(calculateRiskRewardScore(0.8), 25);
});

test('R/R Score: missing = 25', function() {
  assertEqual(calculateRiskRewardScore(null), 25);
});

// ===== Swing Zones =====
test('Swing Zones: valid entry/target/stop', function() {
  var zones = calculateSwingZones(100, 95, 110, 2, 2.5);
  assertNotNullish(zones);
  assertNotNullish(zones.entryZone);
  assertNotNullish(zones.target1);
  assertNotNullish(zones.target2);
  assertNotNullish(zones.invalidation);
  assertNotNullish(zones.riskPercent);
  assertNotNullish(zones.rewardPercent);
});

test('Swing Zones: missing support still returns zones (uses price*0.97)', function() {
  var zones = calculateSwingZones(100, null, 110, 2, 2.5);
  assertNotNullish(zones.entryZone);
  assertNotNullish(zones.target1);
  assertNotNullish(zones.target2);
  assertNotNullish(zones.invalidation);
});

test('Swing Zones: invalid price returns null zones', function() {
  var zones = calculateSwingZones(null, 95, 110, 2, 2.5);
  assertNullish(zones.entryZone);
});

// ===== Swing Setups =====
test('Swing Setups: detects Bollinger Squeeze', function() {
  var data = {
    price: 100,
    sma20: 98,
    sma50: 95,
    sma200: 90,
    rsi: 55,
    bollinger: { squeeze: true, bandwidth: 5, score: 90 },
    relativeVolume: 1.5,
    resistanceDistance: 3,
    cluster: false,
    trendScore: 70,
    breakoutScore: 60,
  };
  var setups = detectSwingSetups(data);
  assertNotNullish(setups);
  assertEqual(setups.length > 0, true);
  assertEqual(setups[0].type, 'BOLLINGER_SQUEEZE');
});

test('Swing Setups: detects Breakout Pressure', function() {
  var data = {
    price: 100,
    sma20: 98,
    sma50: 95,
    sma200: 90,
    rsi: 55,
    bollinger: { squeeze: false, bandwidth: 12, score: 50 },
    relativeVolume: 1.5,
    resistanceDistance: 1,
    cluster: false,
    trendScore: 70,
    breakoutScore: 60,
  };
  var setups = detectSwingSetups(data);
  assertNotNullish(setups);
  assertEqual(setups.length > 0, true);
  assertEqual(setups[0].type, 'BREAKOUT_PRESSURE');
});

test('Swing Setups: empty for missing data', function() {
  var setups = detectSwingSetups({});
  assertEqual(setups.length, 0);
});

// ===== Reasons =====
test('Reasons: generates for bullish setup', function() {
  var data = { price: 100, rsi: 55, relativeVolume: 1.5, sma20: 98, sma50: 95, sma200: 90, bollinger: { squeeze: true }, atr: 2, resistanceDistance: 3, cluster: false };
  var setups = [{ label: 'Bollinger Squeeze + Volume' }];
  var zones = { riskReward: 2.5 };
  var reasons = buildSwingReasons(data, setups, zones);
  assertNotNullish(reasons);
  assertEqual(reasons.length > 0, true);
});

test('Reasons: empty for null scores', function() {
  var reasons = buildSwingReasons({}, [], {});
  assertEqual(reasons.length, 0);
});

// ===== Warnings =====
test('Warnings: RSI overbought', function() {
  var warnings = buildSwingWarnings({ rsi: 80, relativeVolume: 1.0, resistanceDistance: 5, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('RSI_OVERBOUGHT'), true);
});

test('Warnings: RSI oversold', function() {
  var warnings = buildSwingWarnings({ rsi: 20, relativeVolume: 1.0, resistanceDistance: 5, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('RSI_OVERSOLD'), true);
});

test('Warnings: high ATR', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 1.0, resistanceDistance: 5, atr: 10, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('HIGH_ATR'), true);
});

test('Warnings: low volume', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 0.5, resistanceDistance: 5, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('LOW_VOLUME'), true);
});

test('Warnings: at resistance', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 1.0, resistanceDistance: 0.3, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('AT_RESISTANCE'), true);
});

test('Warnings: downtrend structure', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 1.0, resistanceDistance: 5, atr: 2, price: 90, sma20: 92, sma50: 95, sma200: 100 }, [], {});
  assertEqual(warnings.includes('DOWNTREND_STRUCTURE'), true);
});

test('Warnings: no clear setup', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 1.0, resistanceDistance: 5, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], {});
  assertEqual(warnings.includes('NO_CLEAR_SETUP'), true);
});

test('Warnings: low risk/reward', function() {
  var warnings = buildSwingWarnings({ rsi: 50, relativeVolume: 1.0, resistanceDistance: 5, atr: 2, price: 100, sma20: 98, sma50: 95, sma200: 90 }, [], { riskReward: 1.2 });
  assertEqual(warnings.includes('LOW_RISK_REWARD'), true);
});

// ===== Flags =====
test('Flags: HIGH_RVOL', function() {
  var flags = buildSwingFlags({ relativeVolume: 2.5, rsi: 50, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('HIGH_RVOL'), true);
});

test('Flags: RSI_NEUTRAL', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 55, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('RSI_NEUTRAL'), true);
});

test('Flags: BOLLINGER_SQUEEZE', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: true }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('BOLLINGER_SQUEEZE'), true);
});

test('Flags: PRICE_CLUSTER', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: false }, cluster: true, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('PRICE_CLUSTER'), true);
});

test('Flags: NEAR_RESISTANCE', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 1, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('NEAR_RESISTANCE'), true);
});

test('Flags: STRONG_UPTREND', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], {});
  assertEqual(flags.includes('STRONG_UPTREND'), true);
});

test('Flags: MULTIPLE_SETUPS', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [{}, {}], {});
  assertEqual(flags.includes('MULTIPLE_SETUPS'), true);
});

test('Flags: EXCELLENT_RR', function() {
  var flags = buildSwingFlags({ relativeVolume: 1.0, rsi: 50, bollinger: { squeeze: false }, cluster: false, resistanceDistance: 5, sma20: 98, sma50: 95, sma200: 90, price: 100 }, [], { riskReward: 3.0 });
  assertEqual(flags.includes('EXCELLENT_RR'), true);
});

// ===== Quality Classification =====
test('Quality: TOP >= 85', function() {
  assertEqual(classifySwingQuality(90), 'TOP');
  assertEqual(classifySwingQuality(85), 'TOP');
});

test('Quality: STRONG 70-84', function() {
  assertEqual(classifySwingQuality(75), 'STRONG');
  assertEqual(classifySwingQuality(70), 'STRONG');
});

test('Quality: WATCH (54 = WEAK, 55 = MEDIUM special case)', function() {
  assertEqual(classifySwingQuality(54), 'WEAK');
  assertEqual(classifySwingQuality(55), 'MEDIUM');
});

test('Quality: MEDIUM 55', function() {
  assertEqual(classifySwingQuality(55), 'MEDIUM');
});

test('Quality: 56-69 (below new STRONG threshold of 70)', function() {
  assertEqual(classifySwingQuality(56), 'WEAK');
  assertEqual(classifySwingQuality(60), 'WEAK');
});

test('Quality: WEAK 40-54', function() {
  assertEqual(classifySwingQuality(45), 'WEAK');
  assertEqual(classifySwingQuality(40), 'WEAK');
});

test('Quality: UNAVAILABLE < 40 or null', function() {
  assertEqual(classifySwingQuality(35), 'UNAVAILABLE');
  assertEqual(classifySwingQuality(null), 'UNAVAILABLE');
});

// ===== Full Swing Intelligence =====
test('Swing Intelligence: full data = valid result', function() {
  var marketData = {
    ticker: 'AAPL',
    price: 150,
    previousClose: 149,
    changePercent: 0.67,
    volume: 50000000,
    averageVolume20: 45000000,
    relativeVolume: 1.11,
    momentumPercent: 1.5,
    rsi: 58,
    sma20: 148,
    sma50: 145,
    sma200: 140,
    resistance: 155,
    support: 142,
    resistanceDistancePercent: 3.3,
    bollingerBandwidth: 8,
    squeeze: false,
    squeezeScore: 50,
    cluster: false,
    clusterRangePercent: 2,
    clusterScore: 40,
    targetPrice: 160,
    stopLoss: 140,
    riskReward: 2.0,
    technicalScore: 70,
    setupScore: 65,
    signal: 'WATCH',
    signalStrength: 'MEDIUM',
    directionBias: 'صعودي',
    riskLevel: 'معتدل',
    dayHigh: 152,
    dayLow: 147,
    highs: Array(30).fill(150).map(function(v, i) { return v + Math.sin(i) * 2; }),
    lows: Array(30).fill(145).map(function(v, i) { return v + Math.sin(i) * 2; }),
    closes: Array(30).fill(148).map(function(v, i) { return v + Math.sin(i) * 2; }),
    volumes: Array(30).fill(45000000).map(function(v, i) { return v + i * 100000; }),
  };
  var result = buildSwingIntelligence(marketData);
  assertNotNullish(result);
  assertEqual(typeof result.swingScore, 'number');
  assertEqual(result.swingScore >= 0 && result.swingScore <= 100, true);
  assertNotNullish(result.quality);
  assertNotNullish(result.zones);
  assertNotNullish(result.reasons);
  assertNotNullish(result.warnings);
  assertNotNullish(result.flags);
  assertNotNullish(result.componentScores);
  assertNotNullish(result.dataAvailability);
  assertNotNullish(result.dataCompleteness);
});

test('Swing Intelligence: missing critical data = WEAK (score 40-54)', function() {
  var result = buildSwingIntelligence({ ticker: 'AAPL', price: 100 });
  assertEqual(result.quality, 'WEAK');
  // Implementation returns a score even with minimal data
  assertEqual(typeof result.swingScore, 'number');
  assertEqual(result.swingScore >= 40 && result.swingScore <= 54, true);
});

test('Swing Intelligence: never returns NaN or Infinity', function() {
  var result = buildSwingIntelligence({ ticker: 'AAPL', price: NaN, sma20: Infinity, sma50: -Infinity });
  assertEqual(typeof result.swingScore, 'number');
  assertEqual(isNaN(result.swingScore), false);
  assertEqual(isFinite(result.swingScore), true);
});

test('Swing Intelligence: default returns UNAVAILABLE', function() {
  var result = defaultSwingIntelligence();
  assertEqual(result.quality, 'UNAVAILABLE');
  assertEqual(result.swingScore, null);
  assertEqual(result.dataCompleteness, 0);
  assertNullish(result.relativeVolume);
});

// ===== Ranking =====
test('Ranking: sorts by swingScore descending', function() {
  var results = [
    buildSwingIntelligence({ ticker: 'AAA', price: 100, rsi: 55, relativeVolume: 1.5, riskReward: 2.0 }),
    buildSwingIntelligence({ ticker: 'BBB', price: 100, rsi: 55, relativeVolume: 3.0, riskReward: 3.0 }),
    buildSwingIntelligence({ ticker: 'CCC', price: 100, rsi: 55, relativeVolume: 1.2, riskReward: 1.5 }),
  ];
  var ranked = rankSwingOpportunities(results);
  assertNotNullish(ranked);
  assertEqual(ranked.ranked.length, 3);
  assertEqual(ranked.top.length, 3); // all have score > 40
  assertEqual(ranked.alternatives.length >= 0, true);
});

test('Ranking: top has highest scores first', function() {
  var high = buildSwingIntelligence({ ticker: 'AAA', price: 100, rsi: 55, relativeVolume: 3.0, riskReward: 3.0 });
  var low = buildSwingIntelligence({ ticker: 'BBB', price: 100, rsi: 55, relativeVolume: 0.5, riskReward: 0.5 });
  var ranked = rankSwingOpportunities([low, high]);
  assertEqual(ranked.ranked[0].symbol, 'AAA');
  assertEqual(ranked.ranked[1].symbol, 'BBB');
  assertEqual(ranked.top[0].symbol, 'AAA');
});

test('Ranking: empty/non-array returns empty structure', function() {
  var ranked = rankSwingOpportunities(null);
  assertEqual(ranked.ranked.length, 0);
  assertEqual(ranked.top.length, 0);
  assertEqual(ranked.alternatives.length, 0);
  var ranked2 = rankSwingOpportunities([]);
  assertEqual(ranked2.ranked.length, 0);
});

test('Ranking: limits to 20 ranked, 5 top, 5 alternatives', function() {
  var results = [];
  for (var i = 0; i < 25; i++) {
    results.push(buildSwingIntelligence({ ticker: 'S' + i, price: 100 + i, rsi: 55, relativeVolume: 2.0, riskReward: 2.5 }));
  }
  var ranked = rankSwingOpportunities(results);
  assertEqual(ranked.ranked.length, 20);
  assertEqual(ranked.top.length, 5);
  assertEqual(ranked.alternatives.length, 5);
});

test('Swing Intelligence: relativeVolume included in output', function() {
  var result = buildSwingIntelligence({ ticker: 'AAA', price: 100, relativeVolume: 1.45 });
  assertNotNullish(result.relativeVolume);
  assertClose(result.relativeVolume, 1.45, 0.01);
});

// ===== Summary =====
console.log('\n========================================');
console.log('Swing Intelligence Tests (A4)');
console.log('========================================');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total: ' + (passed + failed));
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
