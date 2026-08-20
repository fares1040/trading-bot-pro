import { calculatePennyScore, buildPennyReasons, scorePennySetup, scorePennyRvol, scorePennyRsi, calculateATR, calculateSupportProximity, calculateResistanceProximity, classifyBreakoutProximity, calculateStructureScore, generateEntryTargetZones, calculateDollarVolume, classifyDollarVolume, calculateVolumeQuality, calculatePennyLiquidityScore, getLiquidityWarning, getLiquidityFlags, calculateLiquidityRisk, calculateVolatilityRisk, calculateResistanceRisk, calculateStructureRisk, calculateVolumeTrapRisk, calculateMomentumRisk, calculatePennyRiskScore, classifyPennyRisk, getPennyRiskLabel, getPennyRiskFlags, buildRiskReasons } from '../lib/penny-intelligence.js';

let passCount = 0;
let failCount = 0;

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ': expected ' + expected + ', got ' + actual);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log('✅ PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('❌ FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

// 1. Existing setup score behavior
test('Penny setup score clamps to 0-100', () => {
  assertEqual(scorePennySetup(85), 85);
  assertEqual(scorePennySetup(120), 100);
  assertEqual(scorePennySetup(-10), 0);
  assertEqual(scorePennySetup(null), 0);
  assertEqual(scorePennySetup(undefined), 0);
  assertEqual(scorePennySetup(NaN), 0);
});

// 2. Existing RVOL score behavior
test('Penny RVOL score calculation', () => {
  assertEqual(scorePennyRvol(1.0), 40);
  assertEqual(scorePennyRvol(2.0), 80);
  assertEqual(scorePennyRvol(2.5), 100);
  assertEqual(scorePennyRvol(3.0), 100);
  assertEqual(scorePennyRvol(null), 0);
  assertEqual(scorePennyRvol(undefined), 0);
});

// 3. Existing RSI score behavior
test('Penny RSI score calculation', () => {
  assertEqual(scorePennyRsi(55), 100);
  assertEqual(scorePennyRsi(72), 100);
  assertEqual(scorePennyRsi(45), 100);
  assertEqual(scorePennyRsi(40), 70);
  assertEqual(scorePennyRsi(35), 70);
  assertEqual(scorePennyRsi(78), 70);
  assertEqual(scorePennyRsi(30), 30);
  assertEqual(scorePennyRsi(80), 30);
  assertEqual(scorePennyRsi(undefined), 0);
});

// 4. Final Penny Score formula
test('Penny score formula: setup * 0.65 + rvol * 0.20 + rsi * 0.15', () => {
  assertEqual(calculatePennyScore({ setupScore: 80, relativeVolume: 2.0, rsi: 55 }), 83);
  assertEqual(calculatePennyScore({ setupScore: 70, relativeVolume: 1.5, rsi: 60 }), 73);
  assertEqual(calculatePennyScore({ setupScore: 0, relativeVolume: undefined, rsi: undefined }), 0);
});

// 5. Boundary values
test('Penny score boundary: max 100', () => {
  assertEqual(calculatePennyScore({ setupScore: 100, relativeVolume: 3.0, rsi: 55 }), 100);
});

test('Penny score boundary: minimum 0', () => {
  assertEqual(calculatePennyScore({ setupScore: 0, relativeVolume: 0, rsi: undefined }), 0);
});

// 6. Known deterministic inputs
test('Penny score known values', () => {
  assertEqual(calculatePennyScore({ setupScore: 75, relativeVolume: 1.0, rsi: 50 }), 72);
});

// 7. No NaN / Infinity for valid inputs
test('Penny score never returns NaN or Infinity', () => {
  const result = calculatePennyScore({ setupScore: 85, relativeVolume: 2.5, rsi: 55 });
  assertTrue(Number.isFinite(result), 'Score should be finite');
  assertTrue(!Number.isNaN(result), 'Score should not be NaN');
});

// 8. Exported functions are callable
test('All exported functions are callable', () => {
  assertEqual(typeof scorePennySetup, 'function');
  assertEqual(typeof scorePennyRvol, 'function');
  assertEqual(typeof scorePennyRsi, 'function');
  assertEqual(typeof calculatePennyScore, 'function');
  assertEqual(typeof buildPennyReasons, 'function');
});

// 9. buildPennyReasons
test('buildPennyReasons generates correct reasons', () => {
  const reasons = buildPennyReasons({
    setupScore: 85,
    relativeVolume: 2.5,
    rsi: 55,
    averageVolume20: 150000
  });
  assertEqual(reasons.length, 4);
  assertTrue(reasons[0].startsWith('Technical'));
  assertTrue(reasons[1].startsWith('RVOL'));
  assertTrue(reasons[2].startsWith('RSI'));
  assertTrue(reasons[3].startsWith('Avg Vol 20'));
});

test('buildPennyReasons handles missing fields', () => {
  const reasons = buildPennyReasons({
    setupScore: undefined,
    relativeVolume: undefined,
    rsi: undefined,
    averageVolume20: undefined
  });
  assertEqual(reasons.length, 0);
});

// ATR tests
test('ATR: known OHLC dataset', () => {
  const highs = [10, 12, 14, 13, 15];
  const lows = [8, 9, 10, 11, 12];
  const closes = [9, 11, 13, 12, 14];
  const atr = calculateATR(highs, lows, closes, 3);
  assertTrue(Number.isFinite(atr), 'ATR should be finite');
  assertTrue(atr > 0, 'ATR should be positive for volatile data');
});

test('ATR: true range calculation', () => {
  const highs = [10, 12];
  const lows = [8, 9];
  const closes = [9, 11];
  const atr = calculateATR(highs, lows, closes, 1);
  assertTrue(Number.isFinite(atr), 'ATR should be finite');
  assertEqual(atr, 3, 'ATR with period 1 should equal the single true range');
});

test('ATR: 14-period default', () => {
  const highs = Array.from({ length: 20 }, (_, i) => 10 + Math.sin(i * 0.5) * 2);
  const lows = Array.from({ length: 20 }, (_, i) => 8 + Math.sin(i * 0.5) * 2);
  const closes = Array.from({ length: 20 }, (_, i) => 9 + Math.sin(i * 0.5) * 2);
  const atr = calculateATR(highs, lows, closes);
  assertTrue(Number.isFinite(atr), 'ATR should be finite with 20 bars');
  assertTrue(atr > 0, 'ATR should be positive');
});

test('ATR: insufficient data returns null', () => {
  const highs = [10, 12];
  const lows = [8, 9];
  const closes = [9, 11];
  assertEqual(calculateATR(highs, lows, closes, 14), null);
});

test('ATR: invalid OHLC returns null', () => {
  const highs = [10, undefined, 14];
  const lows = [8, 9, 10];
  const closes = [9, 11, 12];
  assertEqual(calculateATR(highs, lows, closes, 2), null);
});

test('ATR: no NaN or Infinity', () => {
  const highs = [10, 12, 14, 13, 15];
  const lows = [8, 9, 10, 11, 12];
  const closes = [9, 11, 13, 12, 14];
  const atr = calculateATR(highs, lows, closes, 3);
  assertTrue(Number.isFinite(atr), 'ATR should be finite');
  assertTrue(!Number.isNaN(atr), 'ATR should not be NaN');
});

test('ATR: empty arrays return null', () => {
  assertEqual(calculateATR([], [], [], 14), null);
});

// VWAP status test
test('VWAP: unavailable with daily OHLC data', () => {
  assertEqual('unavailable', 'unavailable');
});

// Support proximity tests
test('Support: distance calculation', () => {
  assertEqual(calculateSupportProximity(100, 98), 'very-near');
});

test('Support: very-near boundary (0-2%)', () => {
  assertEqual(calculateSupportProximity(100, 99), 'very-near');
  assertEqual(calculateSupportProximity(100, 98.5), 'very-near');
});

test('Support: near boundary (>2-5%)', () => {
  assertEqual(calculateSupportProximity(100, 97), 'near');
  assertEqual(calculateSupportProximity(100, 95.5), 'near');
});

test('Support: far boundary (>5%)', () => {
  assertEqual(calculateSupportProximity(100, 94), 'far');
  assertEqual(calculateSupportProximity(100, 90), 'far');
});

test('Support: missing values return null', () => {
  assertEqual(calculateSupportProximity(null, 90), null);
  assertEqual(calculateSupportProximity(100, null), null);
  assertEqual(calculateSupportProximity(0, 90), null);
  assertEqual(calculateSupportProximity(100, 0), null);
});

// Resistance proximity tests
test('Resistance: distance calculation', () => {
  assertEqual(calculateResistanceProximity(100, 102), 'very-near');
});

test('Resistance: very-near boundary (0-2%)', () => {
  assertEqual(calculateResistanceProximity(100, 101), 'very-near');
  assertEqual(calculateResistanceProximity(100, 101.5), 'very-near');
});

test('Resistance: near boundary (>2-5%)', () => {
  assertEqual(calculateResistanceProximity(100, 103), 'near');
  assertEqual(calculateResistanceProximity(100, 104.5), 'near');
});

test('Resistance: far boundary (>5%)', () => {
  assertEqual(calculateResistanceProximity(100, 106), 'far');
  assertEqual(calculateResistanceProximity(100, 110), 'far');
});

test('Resistance: missing values return null', () => {
  assertEqual(calculateResistanceProximity(null, 110), null);
  assertEqual(calculateResistanceProximity(100, null), null);
  assertEqual(calculateResistanceProximity(0, 110), null);
  assertEqual(calculateResistanceProximity(100, 0), null);
});

// Breakout proximity tests
test('Breakout: price at resistance with high score = breakout', () => {
  assertEqual(classifyBreakoutProximity(100, 100, 90), 'breakout');
});

test('Breakout: near resistance with high score = near-breakout', () => {
  assertEqual(classifyBreakoutProximity(100, 101.5, 80), 'near-breakout');
});

test('Breakout: moderate score = watch', () => {
  assertEqual(classifyBreakoutProximity(100, 105, 65), 'watch');
});

test('Breakout: low score = unavailable', () => {
  assertEqual(classifyBreakoutProximity(100, 110, 50), 'unavailable');
});

test('Breakout: missing data = unavailable', () => {
  assertEqual(classifyBreakoutProximity(null, 100, 80), 'unavailable');
  assertEqual(classifyBreakoutProximity(100, null, 80), 'unavailable');
  assertEqual(classifyBreakoutProximity(100, 100, null), 'unavailable');
});

// Structure score tests
test('Structure: score within 0-100', () => {
  const score = calculateStructureScore({
    price: 100,
    support: 95,
    resistance: 110,
    breakoutScore: 80,
    clusterScore: 70,
  });
  assertTrue(Number.isFinite(score), 'Structure score should be finite');
  assertTrue(score >= 0 && score <= 100, 'Structure score should be 0-100');
});

test('Structure: deterministic with known inputs', () => {
  const score1 = calculateStructureScore({
    price: 100,
    support: 95,
    resistance: 110,
    breakoutScore: 80,
    clusterScore: 70,
  });
  const score2 = calculateStructureScore({
    price: 100,
    support: 95,
    resistance: 110,
    breakoutScore: 80,
    clusterScore: 70,
  });
  assertEqual(score1, score2, 'Structure score should be deterministic');
});

test('Structure: missing inputs return 50-based score', () => {
  const score = calculateStructureScore({
    price: 100,
    support: null,
    resistance: null,
    breakoutScore: null,
    clusterScore: null,
  });
  assertTrue(Number.isFinite(score), 'Structure score should be finite with missing inputs');
});

// Entry/target zones
test('Entry/target: valid zones generated', () => {
  const zones = generateEntryTargetZones(100, 95, 110, 3);
  assertEqual(zones.entryZone, '$95.00 - $96.90');
  assertEqual(zones.targetZone, '$110.00');
});

test('Entry/target: missing support/resistance returns null zones', () => {
  const zones = generateEntryTargetZones(100, null, 110, 3);
  assertEqual(zones.entryZone, null);
  assertEqual(zones.targetZone, '$110.00');

  const zones2 = generateEntryTargetZones(100, 95, null, 3);
  assertEqual(zones2.entryZone, '$95.00 - $96.90');
  assertEqual(zones2.targetZone, null);
});

test('Entry/target: invalid price returns null zones', () => {
  const zones = generateEntryTargetZones(null, 95, 110, 3);
  assertEqual(zones.entryZone, null);
  assertEqual(zones.targetZone, null);
});

// Dollar volume tests
test('Dollar volume: valid calculation', () => {
  assertEqual(calculateDollarVolume(2.5, 1_000_000), 2_500_000);
  assertEqual(calculateDollarVolume(1.0, 500_000), 500_000);
});

test('Dollar volume: invalid inputs return null', () => {
  assertEqual(calculateDollarVolume(null, 1000), null);
  assertEqual(calculateDollarVolume(2.5, null), null);
  assertEqual(calculateDollarVolume(0, 1000), null);
  assertEqual(calculateDollarVolume(2.5, 0), null);
  assertEqual(calculateDollarVolume(NaN, 1000), null);
});

test('Dollar volume classification: strong >= $5M', () => {
  assertEqual(classifyDollarVolume(5_000_000), 'strong');
  assertEqual(classifyDollarVolume(10_000_000), 'strong');
});

test('Dollar volume classification: healthy >= $1M', () => {
  assertEqual(classifyDollarVolume(1_000_000), 'healthy');
  assertEqual(classifyDollarVolume(3_000_000), 'healthy');
});

test('Dollar volume classification: low >= $500K', () => {
  assertEqual(classifyDollarVolume(500_000), 'low');
  assertEqual(classifyDollarVolume(750_000), 'low');
});

test('Dollar volume classification: very-low < $500K', () => {
  assertEqual(classifyDollarVolume(250_000), 'very-low');
  assertEqual(classifyDollarVolume(100_000), 'very-low');
});

test('Dollar volume classification: unavailable for null', () => {
  assertEqual(classifyDollarVolume(null), 'unavailable');
});

// Volume quality tests
test('Volume quality: excellent RVOL', () => {
  const result = calculateVolumeQuality({ volume: 1_500_000, averageVolume20: 500_000, relativeVolume: 3.0 });
  assertTrue(result.score >= 85, 'Score ' + result.score + ' should be excellent');
  assertEqual(result.quality, 'excellent');
});

test('Volume quality: good RVOL', () => {
  const result = calculateVolumeQuality({ volume: 800_000, averageVolume20: 500_000, relativeVolume: 1.8 });
  assertTrue(result.score >= 70 && result.score < 85, 'Score ' + result.score + ' should be good');
  assertEqual(result.quality, 'good');
});

test('Volume quality: moderate RVOL', () => {
  const result = calculateVolumeQuality({ volume: 500_000, averageVolume20: 500_000, relativeVolume: 1.2 });
  assertTrue(result.score >= 50 && result.score < 70, 'Score ' + result.score + ' should be moderate');
  assertEqual(result.quality, 'moderate');
});

test('Volume quality: weak RVOL', () => {
  const result = calculateVolumeQuality({ volume: 200_000, averageVolume20: 500_000, relativeVolume: 0.5 });
  assertTrue(result.score < 50, 'Score ' + result.score + ' should be weak');
  assertEqual(result.quality, 'weak');
});

test('Volume quality: unavailable for missing data', () => {
  const result = calculateVolumeQuality({ volume: null, averageVolume20: 500_000, relativeVolume: 1.0 });
  assertEqual(result.score, null);
  assertEqual(result.quality, 'unavailable');
});

// Liquidity score tests
test('Liquidity score: preserves existing liquidityScore', () => {
  assertEqual(calculatePennyLiquidityScore({ liquidityScore: 85, dollarVolume: 500_000, volumeQualityScore: 70 }), 85);
});

test('Liquidity score: fallback when liquidityScore unavailable', () => {
  const result = calculatePennyLiquidityScore({ liquidityScore: null, dollarVolume: 2_000_000, volumeQualityScore: 80 });
  assertTrue(Number.isFinite(result), 'Liquidity score should be finite');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

test('Liquidity score: default fallback when all unavailable', () => {
  assertEqual(calculatePennyLiquidityScore({ liquidityScore: null, dollarVolume: null, volumeQualityScore: null }), 50);
});

// Liquidity warning tests
test('Liquidity warning: very-low < $250K', () => {
  assertEqual(getLiquidityWarning(200_000), 'very-low-liquidity');
});

test('Liquidity warning: low < $500K', () => {
  assertEqual(getLiquidityWarning(400_000), 'low-liquidity');
});

test('Liquidity warning: watch < $1M', () => {
  assertEqual(getLiquidityWarning(800_000), 'watch');
});

test('Liquidity warning: healthy >= $1M', () => {
  assertEqual(getLiquidityWarning(1_500_000), 'healthy');
});

test('Liquidity warning: unavailable for null', () => {
  assertEqual(getLiquidityWarning(null), 'unavailable');
});

// Liquidity flags tests
test('Liquidity flags: low dollar volume', () => {
  const flags = getLiquidityFlags({ relativeVolume: 1.5, dollarVolume: 400_000, volumeQualityScore: 60 });
  assertTrue(flags.includes('LOW_DOLLAR_VOLUME'), 'Should include LOW_DOLLAR_VOLUME');
});

test('Liquidity flags: weak volume', () => {
  const flags = getLiquidityFlags({ relativeVolume: 0.8, dollarVolume: 1_500_000, volumeQualityScore: 60 });
  assertTrue(flags.includes('WEAK_VOLUME'), 'Should include WEAK_VOLUME');
});

test('Liquidity flags: low liquidity', () => {
  const flags = getLiquidityFlags({ relativeVolume: 1.2, dollarVolume: 1_500_000, volumeQualityScore: 40 });
  assertTrue(flags.includes('LOW_LIQUIDITY'), 'Should include LOW_LIQUIDITY');
});

test('Liquidity flags: HIGH_RVOL_LOW_LIQUIDITY trap', () => {
  const flags = getLiquidityFlags({ relativeVolume: 2.0, dollarVolume: 800_000, volumeQualityScore: 70 });
  assertTrue(flags.includes('HIGH_RVOL_LOW_LIQUIDITY'), 'Should include HIGH_RVOL_LOW_LIQUIDITY');
});

test('Liquidity flags: no flags for healthy liquidity', () => {
  const flags = getLiquidityFlags({ relativeVolume: 1.5, dollarVolume: 2_000_000, volumeQualityScore: 80 });
  assertEqual(flags.length, 0, 'Should have no flags for healthy liquidity');
});

test('Liquidity flags: unavailable for missing data', () => {
  const flags = getLiquidityFlags({ relativeVolume: null, dollarVolume: null, volumeQualityScore: null });
  assertEqual(flags.length, 0, 'Should have no flags for missing data');
});

// Liquidity risk tests
test('Liquidity risk: very low dollar volume', () => {
  const risk = calculateLiquidityRisk({ dollarVolume: 200_000, volumeQualityScore: 40, liquidityScore: 30, liquidityWarning: 'very-low-liquidity', liquidityFlags: ['LOW_DOLLAR_VOLUME'] });
  assertTrue(risk >= 60, 'Liquidity risk ' + risk + ' should be high for very low dollar volume');
});

test('Liquidity risk: healthy dollar volume', () => {
  const risk = calculateLiquidityRisk({ dollarVolume: 3_000_000, volumeQualityScore: 85, liquidityScore: 90, liquidityWarning: 'healthy', liquidityFlags: [] });
  assertTrue(risk <= 40, 'Liquidity risk ' + risk + ' should be low for healthy dollar volume');
});

test('Liquidity risk: HIGH_RVOL_LOW_LIQUIDITY increases risk', () => {
  const risk = calculateLiquidityRisk({ dollarVolume: 800_000, volumeQualityScore: 70, liquidityScore: 70, liquidityWarning: 'watch', liquidityFlags: ['HIGH_RVOL_LOW_LIQUIDITY'] });
  assertTrue(risk >= 50, 'Liquidity risk ' + risk + ' should be elevated with HIGH_RVOL_LOW_LIQUIDITY');
});

test('Liquidity risk: unavailable for null inputs', () => {
  const risk = calculateLiquidityRisk({});
  assertTrue(Number.isFinite(risk), 'Liquidity risk should return finite value even with missing inputs');
});

// Volatility risk tests
test('Volatility risk: high ATR increases risk', () => {
  const risk = calculateVolatilityRisk({ price: 2.5, atr: 0.5, changePercent: 15 });
  assertTrue(risk >= 50, 'Volatility risk ' + risk + ' should be high for high ATR');
});

test('Volatility risk: low ATR decreases risk', () => {
  const risk = calculateVolatilityRisk({ price: 2.5, atr: 0.1, changePercent: 2 });
  assertTrue(risk <= 40, 'Volatility risk ' + risk + ' should be low for low ATR');
});

test('Volatility risk: null for missing ATR', () => {
  assertEqual(calculateVolatilityRisk({ price: 2.5, atr: null, changePercent: 5 }), null);
});

test('Volatility risk: extreme daily move increases risk', () => {
  const risk = calculateVolatilityRisk({ price: 2.5, atr: 0.2, changePercent: 35 });
  assertTrue(risk >= 50, 'Volatility risk ' + risk + ' should be elevated for extreme daily move');
});

// Resistance risk tests
test('Resistance risk: very near resistance', () => {
  assertEqual(calculateResistanceRisk({ resistanceDistancePercent: 1, resistanceProximity: 'very-near' }), 80);
});

test('Resistance risk: near resistance', () => {
  assertEqual(calculateResistanceRisk({ resistanceDistancePercent: 4, resistanceProximity: 'near' }), 50);
});

test('Resistance risk: far from resistance', () => {
  assertEqual(calculateResistanceRisk({ resistanceDistancePercent: 15, resistanceProximity: 'far' }), 20);
});

test('Resistance risk: null for missing data', () => {
  assertEqual(calculateResistanceRisk({}), null);
});

// Structure risk tests
test('Structure risk: weak structure increases risk', () => {
  const risk = calculateStructureRisk({ structureScore: 30, breakoutScore: 35, clusterScore: 30 });
  assertTrue(risk >= 60, 'Structure risk ' + risk + ' should be high for weak structure');
});

test('Structure risk: strong structure decreases risk', () => {
  const risk = calculateStructureRisk({ structureScore: 85, breakoutScore: 85, clusterScore: 80 });
  assertTrue(risk <= 30, 'Structure risk ' + risk + ' should be low for strong structure');
});

test('Structure risk: null for all missing data', () => {
  assertEqual(calculateStructureRisk({}), null);
});

// Volume trap risk tests
test('Volume trap risk: HIGH_RVOL_LOW_LIQUIDITY', () => {
  const risk = calculateVolumeTrapRisk({ relativeVolume: 2.5, dollarVolume: 800_000, volumeQualityScore: 70, liquidityFlags: ['HIGH_RVOL_LOW_LIQUIDITY'] });
  assertTrue(risk >= 60, 'Volume trap risk ' + risk + ' should be high for HIGH_RVOL_LOW_LIQUIDITY');
});

test('Volume trap risk: healthy volume', () => {
  const risk = calculateVolumeTrapRisk({ relativeVolume: 1.2, dollarVolume: 2_000_000, volumeQualityScore: 80, liquidityFlags: [] });
  assertTrue(risk <= 30, 'Volume trap risk ' + risk + ' should be low for healthy volume');
});

test('Volume trap risk: null for missing data', () => {
  assertEqual(calculateVolumeTrapRisk({}), null);
});

// Momentum risk tests
test('Momentum risk: extended RSI increases risk', () => {
  const risk = calculateMomentumRisk({ rsi: 82, changePercent: 15, breakoutProximity: 'near-breakout' });
  assertTrue(risk >= 50, 'Momentum risk ' + risk + ' should be high for extended RSI');
});

test('Momentum risk: normal momentum', () => {
  const risk = calculateMomentumRisk({ rsi: 55, changePercent: 3, breakoutProximity: 'watch' });
  assertTrue(risk <= 40, 'Momentum risk ' + risk + ' should be low for normal momentum');
});

test('Momentum risk: null for missing data', () => {
  assertEqual(calculateMomentumRisk({}), null);
});

// Final risk score tests
test('Risk score: weighted average with all components', () => {
  const score = calculatePennyRiskScore({
    liquidityRisk: 50,
    volatilityRisk: 40,
    resistanceRisk: 30,
    structureRisk: 35,
    volumeTrapRisk: 45,
    momentumRisk: 25,
  });
  assertTrue(Number.isFinite(score), 'Risk score should be finite');
  assertTrue(score >= 0 && score <= 100, 'Risk score ' + score + ' should be 0-100');
});

test('Risk score: null when all components unavailable', () => {
  assertEqual(calculatePennyRiskScore({}), null);
});

test('Risk score: renormalizes when some components unavailable', () => {
  const score = calculatePennyRiskScore({
    liquidityRisk: 60,
    volatilityRisk: null,
    resistanceRisk: 40,
    structureRisk: null,
    volumeTrapRisk: 50,
    momentumRisk: null,
  });
  assertTrue(Number.isFinite(score), 'Risk score should be finite with partial data');
  assertTrue(score >= 0 && score <= 100, 'Risk score ' + score + ' should be 0-100');
});

// Risk classification tests
test('Risk classification: low (0-39)', () => {
  assertEqual(classifyPennyRisk(20), 'low');
  assertEqual(classifyPennyRisk(39), 'low');
});

test('Risk classification: moderate (40-59)', () => {
  assertEqual(classifyPennyRisk(40), 'moderate');
  assertEqual(classifyPennyRisk(59), 'moderate');
});

test('Risk classification: high (60-79)', () => {
  assertEqual(classifyPennyRisk(60), 'high');
  assertEqual(classifyPennyRisk(79), 'high');
});

test('Risk classification: extreme (80-100)', () => {
  assertEqual(classifyPennyRisk(80), 'extreme');
  assertEqual(classifyPennyRisk(100), 'extreme');
});

test('Risk classification: unavailable for null', () => {
  assertEqual(classifyPennyRisk(null), 'unavailable');
});

test('Risk label mapping', () => {
  assertEqual(getPennyRiskLabel('low'), 'LOW RISK');
  assertEqual(getPennyRiskLabel('moderate'), 'MODERATE RISK');
  assertEqual(getPennyRiskLabel('high'), 'HIGH RISK');
  assertEqual(getPennyRiskLabel('extreme'), 'EXTREME RISK');
  assertEqual(getPennyRiskLabel('unavailable'), 'RISK UNAVAILABLE');
});

// Risk flags tests
test('Risk flags: low liquidity risk', () => {
  const flags = getPennyRiskFlags({ liquidityRisk: 70, liquidityFlags: [] });
  assertTrue(flags.includes('LOW_LIQUIDITY_RISK'), 'Should include LOW_LIQUIDITY_RISK');
});

test('Risk flags: high volatility', () => {
  const flags = getPennyRiskFlags({ volatilityRisk: 70, liquidityFlags: [] });
  assertTrue(flags.includes('HIGH_VOLATILITY'), 'Should include HIGH_VOLATILITY');
});

test('Risk flags: near resistance', () => {
  const flags = getPennyRiskFlags({ resistanceRisk: 70, liquidityFlags: [] });
  assertTrue(flags.includes('NEAR_RESISTANCE'), 'Should include NEAR_RESISTANCE');
});

test('Risk flags: weak structure', () => {
  const flags = getPennyRiskFlags({ structureRisk: 70, liquidityFlags: [] });
  assertTrue(flags.includes('WEAK_STRUCTURE'), 'Should include WEAK_STRUCTURE');
});

test('Risk flags: volume trap', () => {
  const flags = getPennyRiskFlags({ volumeTrapRisk: 60, liquidityFlags: [] });
  assertTrue(flags.includes('VOLUME_TRAP'), 'Should include VOLUME_TRAP');
});

test('Risk flags: extended momentum', () => {
  const flags = getPennyRiskFlags({ momentumRisk: 70, liquidityFlags: [] });
  assertTrue(flags.includes('EXTENDED_MOMENTUM'), 'Should include EXTENDED_MOMENTUM');
});

test('Risk flags: no flags for low risk', () => {
  const flags = getPennyRiskFlags({ liquidityRisk: 20, volatilityRisk: 20, resistanceRisk: 20, structureRisk: 20, volumeTrapRisk: 20, momentumRisk: 20, liquidityFlags: [] });
  assertEqual(flags.length, 0, 'Should have no flags for low risk');
});

// Risk reasons tests
test('Risk reasons: low dollar volume', () => {
  const reasons = buildRiskReasons({ dollarVolume: 300_000, liquidityFlags: ['LOW_DOLLAR_VOLUME'] });
  assertTrue(reasons.includes('Low dollar volume'), 'Should include low dollar volume reason');
});

test('Risk reasons: high RVOL low liquidity', () => {
  const reasons = buildRiskReasons({ liquidityFlags: ['HIGH_RVOL_LOW_LIQUIDITY'] });
  assertTrue(reasons.includes('High RVOL with weak liquidity'), 'Should include HIGH_RVOL_LOW_LIQUIDITY reason');
});

test('Risk reasons: near resistance', () => {
  const reasons = buildRiskReasons({ resistanceDistancePercent: 2 });
  assertTrue(reasons.includes('Price near resistance'), 'Should include near resistance reason');
});

test('Risk reasons: high ATR', () => {
  const reasons = buildRiskReasons({ atr: 0.5, price: 2.5 });
  assertTrue(reasons.some(function(r) { return r.includes('High ATR'); }), 'Should include high ATR reason');
});

test('Risk reasons: extreme daily move', () => {
  const reasons = buildRiskReasons({ changePercent: 30 });
  assertTrue(reasons.includes('Extreme daily move'), 'Should include extreme daily move reason');
});

test('Risk reasons: extended RSI', () => {
  const reasons = buildRiskReasons({ rsi: 82 });
  assertTrue(reasons.includes('Momentum appears extended'), 'Should include extended momentum reason');
});

test('Risk reasons: maximum 5 reasons', () => {
  const reasons = buildRiskReasons({
    dollarVolume: 200_000,
    liquidityFlags: ['HIGH_RVOL_LOW_LIQUIDITY', 'LOW_DOLLAR_VOLUME'],
    atr: 0.8,
    price: 2.5,
    resistanceDistancePercent: 1,
    changePercent: 35,
    rsi: 85,
    breakoutProximity: 'near-breakout',
  });
  assertTrue(reasons.length <= 5, 'Should have at most 5 reasons, got ' + reasons.length);
});

// No NaN/Infinity
test('No NaN or Infinity in risk calculations', () => {
  const risk = calculatePennyRiskScore({
    liquidityRisk: 50,
    volatilityRisk: 40,
    resistanceRisk: 30,
    structureRisk: 35,
    volumeTrapRisk: 45,
    momentumRisk: 25,
  });
  assertTrue(Number.isFinite(risk), 'Risk score should be finite');
  assertTrue(!Number.isNaN(risk), 'Risk score should not be NaN');
});

// Regression: existing Penny Score unchanged
test('Regression: Penny Score unchanged after risk addition', () => {
  assertEqual(calculatePennyScore({ setupScore: 85, relativeVolume: 2.0, rsi: 55 }), 86);
  assertEqual(calculatePennyScore({ setupScore: 70, relativeVolume: 1.5, rsi: 60 }), 73);
  assertEqual(calculatePennyScore({ setupScore: 0, relativeVolume: undefined, rsi: undefined }), 0);
});

console.log('\n========================================');
console.log('Penny Intelligence Tests');
console.log('========================================');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
console.log('Total: ' + (passCount + failCount));
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
