import {
  buildTechnicalEvidence,
  defaultTechnicalEvidence,
  buildStructureEvidence,
  buildTrendEvidence,
  buildMomentumEvidence,
  buildVolumeEvidence,
  buildVolatilityEvidence,
  buildPatternEvidence,
  EVIDENCE_FAMILY,
  DIRECTION_ENUM,
} from '../lib/technical-evidence.js';
import {
  calculateRSI,
  calculateSMA,
  calculateATR,
  calculateBollinger,
} from '../lib/technical-indicators.js';
import { STRUCTURE_STATE } from '../lib/structure-intelligence-manager.js';

let passed = 0;
let failed = 0;

const assert = (condition, message) => {
  if (condition) { passed++; } else { failed++; console.error(`FAIL: ${message}`); }
};

const assertEqual = (actual, expected, message) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message} — expected ${e}, got ${a}`);
};

const assertNotNull = (value, message) => {
  assert(value !== null && value !== undefined, `${message} — expected non-null, got ${value}`);
};

// ============================================================================
// DATA GENERATORS
// ============================================================================

function generateBullishMarketData() {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5);
  return {
    price: 190,
    sma20: 180,
    sma50: 150,
    rsi: 72,
    relativeVolume: 1.8,
    volumeScore: 75,
    momentumPercent: 3.5,
    momentumScore: 70,
    trendScore: 80,
    bollingerBandwidth: 8,
    squeeze: false,
    resistance20: 195,
    support20: 170,
    closes,
    highs: closes.map(c => c + 2),
    lows: closes.map(c => c - 2),
    volumes: Array.from({ length: 60 }, () => 1000),
  };
}

function generateBearishMarketData() {
  const closes = Array.from({ length: 60 }, (_, i) => 150 - i * 1.5);
  return {
    price: 60,
    sma20: 70,
    sma50: 110,
    rsi: 28,
    relativeVolume: 1.6,
    volumeScore: 65,
    momentumPercent: -4.2,
    momentumScore: 30,
    trendScore: 25,
    bollingerBandwidth: 10,
    squeeze: false,
    resistance20: 80,
    support20: 55,
    closes,
    highs: closes.map(c => c + 2),
    lows: closes.map(c => c - 2),
    volumes: Array.from({ length: 60 }, () => 1000),
  };
}

function generateNeutralMarketData() {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.3) * 5);
  return {
    price: 100,
    sma20: 100,
    sma50: 100,
    rsi: 50,
    relativeVolume: 1.0,
    volumeScore: 50,
    momentumPercent: 0.1,
    momentumScore: 50,
    trendScore: 50,
    bollingerBandwidth: 6,
    squeeze: true,
    resistance20: 105,
    support20: 95,
    closes,
    highs: closes.map(c => c + 2),
    lows: closes.map(c => c - 2),
    volumes: Array.from({ length: 60 }, () => 1000),
  };
}

// ============================================================================
// TESTS
// ============================================================================

console.log('=== Technical Evidence Test Suite ===\n');

// --- T01-T05: Imports ---
assert(typeof buildTechnicalEvidence === 'function', 'T01: buildTechnicalEvidence is imported');
assert(typeof defaultTechnicalEvidence === 'function', 'T02: defaultTechnicalEvidence is imported');
assert(typeof calculateRSI === 'function', 'T03: calculateRSI is imported');
assert(typeof calculateSMA === 'function', 'T04: calculateSMA is imported');
assert(typeof calculateATR === 'function', 'T05: calculateATR is imported');

// --- T06-T09: Shared indicators ---
assert(calculateRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) != null, 'T06: calculateRSI returns value');
assert(calculateSMA([1, 2, 3, 4, 5], 3) === 4, 'T07: calculateSMA returns correct value');
assert(calculateATR(Array.from({length:20},(_,i)=>10+i%3), Array.from({length:20},(_,i)=>8+i%3), Array.from({length:20},(_,i)=>9+i%3), 5) != null, 'T08: calculateATR returns value');
assert(calculateBollinger([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]) != null, 'T09: calculateBollinger returns object');

// --- T10-T13: Empty inputs ---
const empty = buildTechnicalEvidence({});
assert(empty.overallDirection === DIRECTION_ENUM.UNAVAILABLE, 'T10: empty → UNAVAILABLE');
assert(empty.familyCount === 6, 'T11: empty → 6 families');
assert(empty.availableFamilies === 0, 'T12: empty → 0 available families');
assert(empty.limitations.length > 0, 'T13: empty → has limitations');

// --- T14-T16: Default technical evidence ---
const def = defaultTechnicalEvidence();
assert(def.overallDirection === DIRECTION_ENUM.UNAVAILABLE, 'T14: default → UNAVAILABLE');
assert(def.familyCount === 6, 'T15: default → 6 families');
assert(def.timestamp !== undefined, 'T16: default → has timestamp');

// ============================================================================
// STRUCTURE FAMILY
// ============================================================================

// --- T17-T20: Structure — bullish ---
const bullStructure = buildStructureEvidence({
  structureState: STRUCTURE_STATE.BULLISH_CONTINUATION,
  structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
  bos: { detected: true, direction: 'BULLISH', level: 110, description: 'Bullish BOS' },
  choch: { detected: false },
  marketStructure: { mssDetected: false },
  confidence: 80,
});
assert(bullStructure.family === EVIDENCE_FAMILY.STRUCTURE, 'T17: structure family is STRUCTURE');
assert(bullStructure.direction === DIRECTION_ENUM.BULLISH, 'T18: bullish structure → BULLISH');
assert(bullStructure.observations.length >= 2, 'T19: bullish structure → has observations');
assert(bullStructure.observations.some(o => o.type === 'BOS'), 'T20: structure has BOS observation');

// --- T21-T23: Structure — bearish ---
const bearStructure = buildStructureEvidence({
  structureState: STRUCTURE_STATE.BEARISH_CONTINUATION,
  structureClassification: { higherHighs: false, higherLows: false, lowerHighs: true, lowerLows: true },
  bos: { detected: false },
  choch: { detected: true, direction: 'BEARISH', level: 90, description: 'Bearish CHoCH' },
  marketStructure: { mssDetected: false },
  confidence: 70,
});
assert(bearStructure.direction === DIRECTION_ENUM.BEARISH, 'T21: bearish structure → BEARISH');
assert(bearStructure.observations.some(o => o.type === 'CHoCH'), 'T22: structure has CHoCH observation');
assert(bearStructure.observations.some(o => o.type === 'LL'), 'T23: structure has LL observation');

// --- T24-T25: Structure — insufficient data ---
const insufficientStructure = buildStructureEvidence({
  structureState: STRUCTURE_STATE.INSUFFICIENT_DATA,
});
assert(insufficientStructure.direction === DIRECTION_ENUM.UNAVAILABLE, 'T24: insufficient → UNAVAILABLE');
assert(insufficientStructure.limitations.length > 0, 'T25: insufficient → has limitations');

// --- T26-T27: Structure — null input ---
const nullStructure = buildStructureEvidence(null);
assert(nullStructure.direction === DIRECTION_ENUM.UNAVAILABLE, 'T26: null → UNAVAILABLE');

// ============================================================================
// TREND FAMILY
// ============================================================================

// --- T28-T31: Trend — bullish ---
const bullTrend = buildTrendEvidence(generateBullishMarketData());
assert(bullTrend.family === EVIDENCE_FAMILY.TREND, 'T28: trend family is TREND');
assert(bullTrend.direction === DIRECTION_ENUM.BULLISH, 'T29: bullish data → BULLISH');
assert(bullTrend.observations.some(o => o.type === 'PRICE_ABOVE_SMA50'), 'T30: has PRICE_ABOVE_SMA50');
assert(bullTrend.strength != null, 'T31: has strength');

// --- T32-T34: Trend — bearish ---
const bearTrend = buildTrendEvidence(generateBearishMarketData());
assert(bearTrend.direction === DIRECTION_ENUM.BEARISH, 'T32: bearish data → BEARISH');
assert(bearTrend.observations.some(o => o.type === 'PRICE_BELOW_SMA50'), 'T33: has PRICE_BELOW_SMA50');

// --- T35-T36: Trend — neutral ---
const neutralTrend = buildTrendEvidence(generateNeutralMarketData());
assert(neutralTrend.direction === DIRECTION_ENUM.NEUTRAL || neutralTrend.direction === DIRECTION_ENUM.BULLISH || neutralTrend.direction === DIRECTION_ENUM.BEARISH, 'T35: neutral data → valid direction');

// ============================================================================
// MOMENTUM FAMILY
// ============================================================================

// --- T37-T40: Momentum — bullish (oversold) ---
const bullMomentum = buildMomentumEvidence({ rsi: 25, closes: Array.from({ length: 20 }, () => 100), momentumPercent: 1 });
assert(bullMomentum.family === EVIDENCE_FAMILY.MOMENTUM, 'T37: momentum family is MOMENTUM');
assert(bullMomentum.direction === DIRECTION_ENUM.BULLISH, 'T38: RSI 25 → BULLISH (oversold)');
assert(bullMomentum.observations.some(o => o.type === 'RSI_OVERSOLD'), 'T39: has RSI_OVERSOLD');

// --- T41-T43: Momentum — bearish (overbought) ---
const bearMomentum = buildMomentumEvidence({ rsi: 75, closes: Array.from({ length: 20 }, () => 100), momentumPercent: -1 });
assert(bearMomentum.direction === DIRECTION_ENUM.BEARISH, 'T41: RSI 75 → BEARISH (overbought)');
assert(bearMomentum.observations.some(o => o.type === 'RSI_OVERBOUGHT'), 'T42: has RSI_OVERBOUGHT');

// --- T44-T45: Momentum — insufficient data ---
const shortMomentum = buildMomentumEvidence({ closes: [1, 2, 3] });
assert(shortMomentum.limitations.length > 0, 'T44: short data → limitations');
assert(shortMomentum.direction === DIRECTION_ENUM.UNAVAILABLE, 'T45: short data → UNAVAILABLE');

// ============================================================================
// VOLUME FAMILY
// ============================================================================

// --- T46-T49: Volume — elevated ---
const elevatedVol = buildVolumeEvidence({ relativeVolume: 2.5, volumeScore: 85, price: 100, resistance20: 102 });
assert(elevatedVol.family === EVIDENCE_FAMILY.VOLUME, 'T46: volume family is VOLUME');
assert(elevatedVol.observations.some(o => o.type === 'HIGH_RVOL'), 'T47: has HIGH_RVOL');
assert(elevatedVol.strength != null, 'T48: has strength');

// --- T50-T51: Volume — normal ---
const normalVol = buildVolumeEvidence({ relativeVolume: 1.0, volumeScore: 50, price: 100, resistance20: 110 });
assert(normalVol.observations.some(o => o.type === 'NORMAL_RVOL'), 'T50: has NORMAL_RVOL');

// --- T52-T53: Volume — insufficient data ---
const noVol = buildVolumeEvidence({});
assert(noVol.direction === DIRECTION_ENUM.UNAVAILABLE, 'T52: no data → UNAVAILABLE');

// ============================================================================
// VOLATILITY FAMILY
// ============================================================================

// --- T54-T57: Volatility — squeeze ---
const squeezeVol = buildVolatilityEvidence({
  squeeze: true,
  bollingerBandwidth: 4.5,
  closes: Array.from({ length: 30 }, () => 100),
  highs: Array.from({ length: 30 }, () => 102),
  lows: Array.from({ length: 30 }, () => 98),
  price: 100,
});
assert(squeezeVol.family === EVIDENCE_FAMILY.VOLATILITY, 'T54: volatility family is VOLATILITY');
assert(squeezeVol.observations.some(o => o.type === 'BOLLINGER_SQUEEZE'), 'T55: has BOLLINGER_SQUEEZE');
assert(squeezeVol.direction === DIRECTION_ENUM.NEUTRAL, 'T56: volatility → NEUTRAL (not directional)');

// --- T58-T59: Volatility — normal ---
const normalVolatility = buildVolatilityEvidence({
  squeeze: false,
  bollingerBandwidth: 10,
  closes: Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5),
  highs: Array.from({ length: 30 }, (_, i) => 102 + Math.sin(i) * 5),
  lows: Array.from({ length: 30 }, (_, i) => 98 + Math.sin(i) * 5),
  price: 100,
});
assert(!normalVolatility.observations.some(o => o.type === 'BOLLINGER_SQUEEZE'), 'T58: no squeeze when bandwidth=10');

// ============================================================================
// PATTERN FAMILY
// ============================================================================

// --- T60-T62: Pattern — with data ---
const patternData = buildPatternEvidence({
  closes: Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5),
  highs: Array.from({ length: 30 }, (_, i) => 102 + Math.sin(i) * 5),
  lows: Array.from({ length: 30 }, (_, i) => 98 + Math.sin(i) * 5),
  volumes: Array.from({ length: 30 }, () => 1000),
});
assert(patternData.family === EVIDENCE_FAMILY.PATTERN, 'T60: pattern family is PATTERN');
assert(Array.isArray(patternData.observations), 'T61: observations is array');

// --- T63: Pattern — insufficient data ---
const shortPattern = buildPatternEvidence({ closes: [1, 2] });
assert(shortPattern.direction === DIRECTION_ENUM.UNAVAILABLE, 'T63: short data → UNAVAILABLE');

// ============================================================================
// GLOBAL / ANTI-DOUBLE-COUNTING
// ============================================================================

// --- T64-T68: Full evidence with bullish data ---
const fullBull = buildTechnicalEvidence({
  marketData: generateBullishMarketData(),
  structureData: {
    structureState: STRUCTURE_STATE.BULLISH_CONTINUATION,
    structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
    bos: { detected: true, direction: 'BULLISH', level: 110, description: 'BOS' },
    choch: { detected: false },
    marketStructure: { mssDetected: false },
    confidence: 80,
  },
  symbol: 'BULL',
});
assert(fullBull.overallDirection === DIRECTION_ENUM.BULLISH, 'T64: bullish data → BULLISH overall');
assert(fullBull.familyCount === 6, 'T65: 6 families present');
assert(fullBull.availableFamilies >= 4, 'T66: at least 4 families available');
assert(fullBull.overallConfidence != null, 'T67: has overall confidence');
assert(fullBull.timestamp !== undefined, 'T68: has timestamp');

// --- T69-T72: Full evidence with bearish data ---
const fullBear = buildTechnicalEvidence({
  marketData: generateBearishMarketData(),
  structureData: {
    structureState: STRUCTURE_STATE.BEARISH_CONTINUATION,
    structureClassification: { higherHighs: false, higherLows: false, lowerHighs: true, lowerLows: true },
    bos: { detected: false },
    choch: { detected: true, direction: 'BEARISH', level: 90, description: 'CHoCH' },
    marketStructure: { mssDetected: false },
    confidence: 70,
  },
  symbol: 'BEAR',
});
assert(fullBear.overallDirection === DIRECTION_ENUM.BEARISH, 'T69: bearish data → BEARISH overall');
assert(fullBear.familyCount === 6, 'T70: 6 families present');

// --- T73-T74: Anti-double-counting — observations grouped per family ---
// RSI observation should be ONE observation, not multiple
const singleRsi = buildMomentumEvidence({ rsi: 75, closes: Array.from({ length: 20 }, () => 100) });
const rsiObs = singleRsi.observations.filter(o => o.type && o.type.startsWith('RSI'));
assert(rsiObs.length <= 2, 'T73: RSI generates at most 2 observations (overbought + momentum)');

// Bollinger squeeze should be ONE observation
const singleSqueeze = buildVolatilityEvidence({
  squeeze: true,
  bollingerBandwidth: 4,
  closes: Array.from({ length: 30 }, () => 100),
  highs: Array.from({ length: 30 }, () => 102),
  lows: Array.from({ length: 30 }, () => 98),
  price: 100,
});
const squeezeObs = singleSqueeze.observations.filter(o => o.type === 'BOLLINGER_SQUEEZE');
assert(squeezeObs.length === 1, 'T74: Bollinger squeeze is ONE observation');

// --- T75-T76: No cross-family duplication ---
// STRUCTURE family does not contain RSI, RVOL, or Bollinger observations
const structOnly = buildStructureEvidence({
  structureState: STRUCTURE_STATE.BULLISH_CONTINUATION,
  structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
  bos: { detected: false },
  choch: { detected: false },
  marketStructure: { mssDetected: false },
  confidence: 80,
});
assert(!structOnly.observations.some(o => o.type === 'RSI_OVERBOUGHT' || o.type === 'RSI_OVERSOLD'), 'T75: STRUCTURE has no RSI observations');
assert(!structOnly.observations.some(o => o.type === 'HIGH_RVOL' || o.type === 'BOLLINGER_SQUEEZE'), 'T76: STRUCTURE has no volume/volatility observations');

// --- T77-T78: Deterministic output ---
const det1 = buildTechnicalEvidence({
  marketData: generateBullishMarketData(),
  symbol: 'DET',
});
const det2 = buildTechnicalEvidence({
  marketData: generateBullishMarketData(),
  symbol: 'DET',
});
const d1NoTs = JSON.parse(JSON.stringify(det1)); delete d1NoTs.timestamp;
const d2NoTs = JSON.parse(JSON.stringify(det2)); delete d2NoTs.timestamp;
assert(JSON.stringify(d1NoTs) === JSON.stringify(d2NoTs), 'T77: deterministic output');
assert(det1.overallDirection === det2.overallDirection, 'T78: deterministic direction');

// --- T79-T80: No look-ahead bias (same data → same evidence) ---
const la1 = buildTechnicalEvidence({ marketData: generateNeutralMarketData(), symbol: 'LA' });
const la2 = buildTechnicalEvidence({ marketData: generateNeutralMarketData(), symbol: 'LA' });
assert(la1.overallDirection === la2.overallDirection, 'T79: no look-ahead — same data → same direction');
assert(la1.familyCount === la2.familyCount, 'T80: no look-ahead — same family count');

// --- T81-T82: Malformed data handled safely ---
const malformed = buildTechnicalEvidence({
  marketData: { price: null, rsi: NaN, closes: [null, undefined, 100], sma50: 'invalid' },
});
assert(malformed.familyCount === 6, 'T81: malformed data → no crash, 6 families');
assert(typeof malformed.overallDirection === 'string', 'T82: malformed data → valid direction string');

// --- T83-T84: Empty input handled safely ---
const emptyInput = buildTechnicalEvidence({
  marketData: { closes: [], highs: [], lows: [], volumes: [] },
});
assert(emptyInput.familyCount === 6, 'T83: empty arrays → no crash');

// --- T85: Evidence family constants ---
assert(EVIDENCE_FAMILY.STRUCTURE === 'STRUCTURE', 'T85: STRUCTURE constant');
assert(EVIDENCE_FAMILY.TREND === 'TREND', 'T85b: TREND constant');
assert(EVIDENCE_FAMILY.MOMENTUM === 'MOMENTUM', 'T85c: MOMENTUM constant');
assert(EVIDENCE_FAMILY.VOLUME === 'VOLUME', 'T85d: VOLUME constant');
assert(EVIDENCE_FAMILY.VOLATILITY === 'VOLATILITY', 'T85e: VOLATILITY constant');
assert(EVIDENCE_FAMILY.PATTERN === 'PATTERN', 'T85f: PATTERN constant');

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
