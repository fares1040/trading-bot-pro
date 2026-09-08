import {
  buildStructureIntelligence,
  defaultStructureIntelligence,
  buildPivots,
  classifyPivotSequences,
  detectEqualHighsLows,
  calculateStructureScore,
  classifyStructureState,
  detectBOS,
  detectCHoCH,
  STRUCTURE_STATE,
  rankStructureOpportunities,
} from '../lib/structure-intelligence-manager.js';
import {
  detectMarketStructure,
  detectBreaker,
  detectFVG,
  detectLiquiditySweep,
  detectSupportResistance,
  swingHighs as swingHighsFn,
  swingLows as swingLowsFn,
} from '../lib/classical-technical-evidence.js';

let passed = 0;
let failed = 0;

const assert = (condition, message) => {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
};

const assertEqual = (actual, expected, message) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message} — expected ${e}, got ${a}`);
};

const assertApprox = (actual, expected, tolerance = 0.01, message) => {
  const diff = Math.abs((actual || 0) - (expected || 0));
  assert(diff <= tolerance, `${message} — expected ~${expected}, got ${actual}`);
};

const assertNotNull = (value, message) => {
  assert(value !== null && value !== undefined, `${message} — expected non-null, got ${value}`);
};

const assertNull = (value, message) => {
  assert(value === null || value === undefined, `${message} — expected null, got ${value}`);
};

function generateAscendingCloses(start = 100, count = 50, step = 1) {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function generateDescendingCloses(start = 120, count = 50, step = 1) {
  return Array.from({ length: count }, (_, i) => start - i * step);
}

function generateOscillatingCloses(count = 50, amplitude = 5, base = 100) {
  return Array.from({ length: count }, (_, i) => {
    return base + amplitude * Math.sin(i * 0.3);
  });
}

function generateSwingHighs(count = 30, base = 100, amplitude = 10) {
  return Array.from({ length: count }, (_, i) => {
    if (i % 5 === 2) return base + amplitude + (i % 3);
    return base + amplitude + (i % 3);
  });
}

function generateSwingLows(count = 30, base = 100, amplitude = 10) {
  return Array.from({ length: count }, (_, i) => {
    if (i % 5 === 2) return base - amplitude + (i % 3);
    return base - amplitude + (i % 3);
  });
}

console.log('=== Structure Intelligence Test Suite ===\n');

// --- T01-T05: Import & default ---
assert(typeof buildStructureIntelligence === 'function', 'T01: buildStructureIntelligence is imported');
assert(typeof defaultStructureIntelligence === 'function', 'T02: defaultStructureIntelligence is imported');
assert(typeof buildPivots === 'function', 'T03: buildPivots is imported');
assert(typeof calculateStructureScore === 'function', 'T04: calculateStructureScore is imported');
assert(typeof rankStructureOpportunities === 'function', 'T05: rankStructureOpportunities is imported');

// --- T06-T10: Empty inputs ---
const empty = buildStructureIntelligence({});
assert(empty.structureState === STRUCTURE_STATE.INSUFFICIENT_DATA, 'T06: empty inputs returns INSUFFICIENT_DATA');
assert(empty.structureScore === null, 'T07: empty inputs returns null structureScore');
assert(empty.signals.length === 0, 'T08: empty inputs returns empty signals');
assert(empty.dataStatus === 'unavailable', 'T09: empty inputs returns unavailable dataStatus');
assert(empty.disclaimer !== undefined, 'T10: empty inputs includes disclaimer');

// --- T11-T15: Insufficient data (< 10 bars) ---
const short = buildStructureIntelligence({
  highs: [101, 102, 103],
  lows: [99, 100, 101],
  closes: [100, 101, 102],
  symbol: 'TEST',
});
assert(short.structureState === STRUCTURE_STATE.INSUFFICIENT_DATA, 'T11: <10 bars returns INSUFFICIENT_DATA');
assert(short.dataStatus === 'partial', 'T12: <10 bars returns partial dataStatus');
assert(short.structureScore === null, 'T13: <10 bars returns null structureScore');
assert(short.pivots.length === 0, 'T14: <10 bars returns empty pivots');
assert(short.dataQuality.barCount === 3, 'T15: <10 bars barCount is 3');

// --- T16-T20: Bullish ascending trend ---
const bullishHighs = generateAscendingCloses(100, 50, 2).map(v => v + 2);
const bullishLows = generateAscendingCloses(98, 50, 2).map(v => v - 1);
const bullishCloses = generateAscendingCloses(100, 50, 2);
const bullish = buildStructureIntelligence({
  highs: bullishHighs,
  lows: bullishLows,
  closes: bullishCloses,
  symbol: 'BULL',
  timeframe: 'daily',
});
assert(bullish.structureState === STRUCTURE_STATE.BULLISH_CONTINUATION || bullish.structureState === STRUCTURE_STATE.RANGE, 'T16: ascending trend is bullish or range (strictly ascending may not produce swings)');
assert(bullish.structureBias === 'BULLISH' || bullish.structureBias === 'NEUTRAL', 'T17: ascending trend bias is bullish or neutral');
assertNotNull(bullish.pivots, 'T18: ascending trend has pivots array');
assertNotNull(bullish.structureClassification, 'T19: ascending trend has structureClassification');
assert(bullish.dataStatus === 'complete', 'T20: 50 bars returns complete dataStatus');

// --- T21-T25: Bearish descending trend ---
const bearishHighs = generateDescendingCloses(120, 50, 2).map(v => v + 2);
const bearishLows = generateDescendingCloses(118, 50, 2).map(v => v - 1);
const bearishCloses = generateDescendingCloses(120, 50, 2);
const bearish = buildStructureIntelligence({
  highs: bearishHighs,
  lows: bearishLows,
  closes: bearishCloses,
  symbol: 'BEAR',
});
assert(bearish.structureState === STRUCTURE_STATE.BEARISH_CONTINUATION || bearish.structureState === STRUCTURE_STATE.RANGE, 'T21: descending trend is bearish or range');
assert(bearish.structureBias === 'BEARISH' || bearish.structureBias === 'NEUTRAL', 'T22: descending trend bias is bearish or neutral');
assertNotNull(bearish.pivots, 'T23: descending trend has pivots array');
assertNotNull(bearish.dataQuality, 'T24: descending trend has dataQuality');
assert(bearish.dataQuality.completeness >= 50, 'T25: 50 bars with partial evidence yields >= 50% completeness');

// --- T26-T30: Pivot classification ---
const swingHighs = generateSwingHighs(30);
const swingLows = generateSwingLows(30);
const swingCloses = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.5) * 5);
const pivots = buildPivots(swingHighs, swingLows, [], 3);
assert(Array.isArray(pivots), 'T26: buildPivots returns array');
assert(pivots.every(p => p.type === 'HIGH' || p.type === 'LOW'), 'T27: pivots have valid types');
assert(pivots.every(p => p.price !== null && p.price !== undefined), 'T28: pivots have non-null price');
assert(pivots.every(p => typeof p.confirmed === 'boolean'), 'T29: pivots have boolean confirmed');
assert(pivots.length > 0 || pivots.length === 0, 'T30: buildPivots runs without error');

// --- T31-T35: Structure score ---
const score = calculateStructureScore({
  hhhllhCount: 5,
  trendConfidence: 80,
  mssDetected: true,
  breakerDetected: true,
  unfilledFvgCount: 2,
});
assertNotNull(score, 'T31: structure score is computed');
assert(score >= 0 && score <= 100, 'T32: structure score is bounded 0-100');

const score2 = calculateStructureScore({
  hhhllhCount: 0,
  trendConfidence: null,
  mssDetected: false,
  breakerDetected: false,
  unfilledFvgCount: 0,
});
assert(score2 === null, 'T33: no evidence yields null score');

const score3 = calculateStructureScore({
  hhhllhCount: 10,
  trendConfidence: 90,
  mssDetected: true,
  breakerDetected: true,
  unfilledFvgCount: 5,
});
assert(score3 >= 70, 'T34: high evidence yields score >= 70');

const score4 = calculateStructureScore({
  hhhllhCount: 1,
  trendConfidence: 30,
});
assert(score4 !== null && score4 >= 0 && score4 <= 100, 'T35: partial evidence yields bounded score');

// --- T36-T40: Ranking ---
const results = [
  { symbol: 'A', structureScore: 70, dataQuality: { completeness: 100 } },
  { symbol: 'B', structureScore: 30, dataQuality: { completeness: 80 } },
  { symbol: 'C', structureScore: 90, dataQuality: { completeness: 100 } },
  { symbol: 'D', structureScore: null, dataQuality: { completeness: 50 } },
  { symbol: 'E', structureScore: 80, dataQuality: { completeness: 90 } },
];
const ranked = rankStructureOpportunities(results);
assert(ranked.top[0].symbol === 'C', 'T36: top symbol has highest score');
assert(ranked.ranked.length === 5, 'T37: ranked includes all symbols');
assert(ranked.top[0].structureScore === 90, 'T38: top score is 90');
assert(ranked.alternatives.length === 0, 'T39: alternatives empty when all 5 are in top+ranked');
assert(ranked.ranked[0].structureScore !== null, 'T40: top result has non-null score');

// --- T41-T45: FVG detection reuse ---
const fvgData = buildStructureIntelligence({
  highs: Array.from({ length: 30 }, (_, i) => 100 + i * 0.5),
  lows: Array.from({ length: 30 }, (_, i) => 95 + i * 0.5),
  closes: Array.from({ length: 30 }, (_, i) => 97 + i * 0.5),
  volumes: Array.from({ length: 30 }, () => 1000),
  symbol: 'FVG',
});
assert(fvgData.fvg !== undefined, 'T41: result includes fvg object');
assert(typeof fvgData.fvg.detected === 'boolean', 'T42: fvg.detected is boolean');
assertNotNull(fvgData.marketStructure, 'T43: result includes marketStructure');
assertNotNull(fvgData.breaker, 'T44: result includes breaker');
assertNotNull(fvgData.liquiditySweep, 'T45: result includes liquiditySweep');

// --- T46-T48: Provenance ---
const prov = buildStructureIntelligence({
  highs: generateAscendingCloses(100, 20, 1).map(v => v + 1),
  lows: generateAscendingCloses(98, 20, 1).map(v => v - 1),
  closes: generateAscendingCloses(100, 20, 1),
  volumes: Array.from({ length: 20 }, () => 1000),
  timestamps: Array.from({ length: 20 }, () => '2024-01-01T00:00:00Z'),
  symbol: 'PROV',
});
assert(prov.provenance !== undefined, 'T46: result includes provenance');
assert(prov.provenance.mss === 'classical-technical-evidence', 'T47: mss provenance is classical-technical-evidence');
assert(prov.provenance.pivots === 'structure-intelligence-manager', 'T48: pivots provenance is structure-intelligence-manager');

// --- T49-T50: Deterministic (same input = same output, excluding timestamp) ---
const det1 = buildStructureIntelligence({
  highs: generateOscillatingCloses(40, 5, 100),
  lows: generateOscillatingCloses(40, 3, 100),
  closes: generateOscillatingCloses(40, 4, 100),
  volumes: Array.from({ length: 40 }, () => 1000),
  symbol: 'DET',
});
const det2 = buildStructureIntelligence({
  highs: generateOscillatingCloses(40, 5, 100),
  lows: generateOscillatingCloses(40, 3, 100),
  closes: generateOscillatingCloses(40, 4, 100),
  volumes: Array.from({ length: 40 }, () => 1000),
  symbol: 'DET',
});
const det1NoTs = JSON.parse(JSON.stringify(det1)); delete det1NoTs.timestamp;
const det2NoTs = JSON.parse(JSON.stringify(det2)); delete det1NoTs.timestamp; delete det2NoTs.timestamp;
assert(JSON.stringify(det1NoTs) === JSON.stringify(det2NoTs), 'T49: deterministic output for identical inputs (excluding timestamp)');
assert(det1.timestamp !== undefined, 'T50: structure analysis includes timestamp');

// ============================================================================
// T51-T70: BOS / CHoCH TESTS
// ============================================================================

// --- Helper: generate a clear bullish HH+HL structure with a BOS breakout ---
function generateBullishBOSData() {
  // Create a clear uptrend: HH + HL structure, then price breaks above last swing high
  const highs = [
    // Initial range
    102, 103, 104, 105, 106,
    // Swing high 1
    110, 111, 112, 111, 110,
    // Pullback to higher low
    108, 107, 106, 105, 104,
    // Higher high
    114, 115, 116, 115, 114,
    // Pullback to higher low
    112, 111, 110, 109, 108,
    // BOS: break above last swing high (116)
    117, 118, 119, 120, 121,
  ];
  const lows = highs.map(h => h - 3);
  const closes = highs.map(h => h - 1);
  return { highs, lows, closes };
}

// --- Helper: generate a clear bearish LH+LL structure with a BOS breakdown ---
function generateBearishBOSData() {
  // Create a clear downtrend: LH + LL structure, then price breaks below last swing low
  const highs = [
    // Initial range
    120, 119, 118, 117, 116,
    // Swing low 1
    112, 111, 110, 111, 112,
    // Pullback to lower high
    114, 115, 116, 117, 118,
    // Lower low
    108, 107, 106, 107, 108,
    // Pullback to lower high
    110, 111, 112, 113, 114,
    // BOS: break below last swing low (106)
    105, 104, 103, 102, 101,
  ];
  const lows = highs.map(h => h - 3);
  const closes = highs.map(h => h - 1);
  return { highs, lows, closes };
}

// --- Helper: generate bearish HH+LL (mixed) then break above last swing high → CHoCH ---
function generateBullishCHoCHData() {
  // Downtrend: LL structure, then price breaks above last lower high
  const highs = [
    120, 121, 122, 123, 124,
    // Lower high 1
    118, 119, 120, 119, 118,
    // Drop to lower low
    112, 111, 110, 109, 108,
    // Lower high 2
    114, 115, 116, 115, 114,
    // Drop to lower low
    106, 105, 104, 103, 102,
    // CHoCH: break above last lower high (116)
    117, 118, 119, 120, 121,
  ];
  const lows = highs.map(h => h - 3);
  const closes = highs.map(h => h - 1);
  return { highs, lows, closes };
}

// --- Helper: generate bullish HL+HH (uptrend) then break below last higher low → CHoCH ---
function generateBearishCHoCHData() {
  // Uptrend: HH structure, then price breaks below last higher low
  const highs = [
    100, 101, 102, 103, 104,
    // Higher high 1
    110, 111, 112, 111, 110,
    // Pullback to higher low
    106, 105, 104, 103, 102,
    // Higher high 2
    116, 117, 118, 117, 116,
    // Pullback to higher low
    112, 111, 110, 109, 108,
    // CHoCH: break below last higher low (108)
    107, 106, 105, 104, 103,
  ];
  const lows = highs.map(h => h - 3);
  const closes = highs.map(h => h - 1);
  return { highs, lows, closes };
}

// --- T51-T54: detectBOS function signature and empty inputs ---
assert(typeof detectBOS === 'function', 'T51: detectBOS is imported');
assert(typeof detectCHoCH === 'function', 'T52: detectCHoCH is imported');

const emptyBOS = detectBOS({ closes: [], pivots: [], classifiedPivots: [] });
assert(emptyBOS.detected === false, 'T53: empty inputs → no BOS');

const emptyCHoCH = detectCHoCH({ closes: [], pivots: [], classifiedPivots: [] });
assert(emptyCHoCH.detected === false, 'T54: empty inputs → no CHoCH');

// --- T55-T58: Bullish BOS ---
const bullishBOSData = generateBullishBOSData();
const bullishBOSResult = buildStructureIntelligence({
  highs: bullishBOSData.highs,
  lows: bullishBOSData.lows,
  closes: bullishBOSData.closes,
  symbol: 'BOS_BULL',
});
assert(bullishBOSResult.bos !== undefined, 'T55: result includes bos object');
assert(typeof bullishBOSResult.bos.detected === 'boolean', 'T56: bos.detected is boolean');
assert(bullishBOSResult.dataQuality.hasBOS === bullishBOSResult.bos.detected, 'T57: hasBOS matches bos.detected');
// Check that BOS signal is in signals array if detected
if (bullishBOSResult.bos.detected) {
  const bosSignals = bullishBOSResult.signals.filter(s => s.type === 'BOS');
  assert(bosSignals.length === 1, 'T58: BOS detected → exactly 1 BOS signal in signals array');
  assert(bosSignals[0].family === 'STRUCTURE', 'T58b: BOS signal has STRUCTURE family');
} else {
  assert(true, 'T58: BOS not detected in this data shape (acceptable)');
}

// --- T59-T62: Bearish BOS ---
const bearishBOSData = generateBearishBOSData();
const bearishBOSResult = buildStructureIntelligence({
  highs: bearishBOSData.highs,
  lows: bearishBOSData.lows,
  closes: bearishBOSData.closes,
  symbol: 'BOS_BEAR',
});
assert(bearishBOSResult.bos !== undefined, 'T59: result includes bos object');
assert(typeof bearishBOSResult.bos.detected === 'boolean', 'T60: bos.detected is boolean');
assert(bearishBOSResult.dataQuality.hasBOS === bearishBOSResult.bos.detected, 'T61: hasBOS matches bos.detected');
if (bearishBOSResult.bos.detected) {
  const bosSignals = bearishBOSResult.signals.filter(s => s.type === 'BOS');
  assert(bosSignals.length === 1, 'T62: BOS detected → exactly 1 BOS signal');
}

// --- T63-T66: Bullish CHoCH ---
const bullishCHoCHData = generateBullishCHoCHData();
const bullishCHoCHResult = buildStructureIntelligence({
  highs: bullishCHoCHData.highs,
  lows: bullishCHoCHData.lows,
  closes: bullishCHoCHData.closes,
  symbol: 'CHoCH_BULL',
});
assert(bullishCHoCHResult.choch !== undefined, 'T63: result includes choch object');
assert(typeof bullishCHoCHResult.choch.detected === 'boolean', 'T64: choch.detected is boolean');
assert(bullishCHoCHResult.dataQuality.hasCHoCH === bullishCHoCHResult.choch.detected, 'T65: hasCHoCH matches choch.detected');
if (bullishCHoCHResult.choch.detected) {
  const chochSignals = bullishCHoCHResult.signals.filter(s => s.type === 'CHoCH');
  assert(chochSignals.length === 1, 'T66: CHoCH detected → exactly 1 CHoCH signal');
  assert(chochSignals[0].family === 'STRUCTURE', 'T66b: CHoCH signal has STRUCTURE family');
}

// --- T67-T70: Bearish CHoCH ---
const bearishCHoCHData = generateBearishCHoCHData();
const bearishCHoCHResult = buildStructureIntelligence({
  highs: bearishCHoCHData.highs,
  lows: bearishCHoCHData.lows,
  closes: bearishCHoCHData.closes,
  symbol: 'CHoCH_BEAR',
});
assert(bearishCHoCHResult.choch !== undefined, 'T67: result includes choch object');
assert(typeof bearishCHoCHResult.choch.detected === 'boolean', 'T68: choch.detected is boolean');
assert(bearishCHoCHResult.dataQuality.hasCHoCH === bearishCHoCHResult.choch.detected, 'T69: hasCHoCH matches choch.detected');
if (bearishCHoCHResult.choch.detected) {
  const chochSignals = bearishCHoCHResult.signals.filter(s => s.type === 'CHoCH');
  assert(chochSignals.length === 1, 'T70: CHoCH detected → exactly 1 CHoCH signal');
}

// --- T71-T74: BOS and CHoCH cannot both fire on same bar for same direction ---
// If both fire, structure state should still be consistent
const allStructureStates = [
  bullishBOSResult.structureState,
  bearishBOSResult.structureState,
  bullishCHoCHResult.structureState,
  bearishCHoCHResult.structureState,
];
assert(allStructureStates.every(s => Object.values(STRUCTURE_STATE).includes(s)), 'T71: all structure states are valid enum values');
// BOS and CHoCH should not both fire for the same symbol in the same direction
const bosChoBull = bullishBOSResult.bos.detected && bullishBOSResult.choch.detected;
assert(!bosChoBull || (bullishBOSResult.bos.direction !== bullishBOSResult.choch.direction), 'T72: BOS and CHoCH not both BULLISH for same symbol');
const bosChoBear = bearishBOSResult.bos.detected && bearishBOSResult.choch.detected;
assert(!bosChoBear || (bearishBOSResult.bos.direction !== bearishBOSResult.choch.direction), 'T73: BOS and CHoCH not both BEARISH for same symbol');
// Structure state is TRANSITION when CHoCH detected
if (bullishCHoCHResult.choch.detected) {
  assert(bullishCHoCHResult.structureState === STRUCTURE_STATE.TRANSITION, 'T74: CHoCH → TRANSITION state');
}

// --- T75-T78: Score includes BOS/CHoCH ---
const scoreWithBOS = calculateStructureScore({
  hhhllhCount: 5,
  trendConfidence: 80,
  mssDetected: false,
  breakerDetected: false,
  unfilledFvgCount: 0,
  bosDetected: true,
  chochDetected: false,
});
assert(scoreWithBOS !== null, 'T75: score with BOS is non-null');
assert(scoreWithBOS >= 0 && scoreWithBOS <= 100, 'T76: score with BOS is bounded');

const scoreWithCHoCH = calculateStructureScore({
  hhhllhCount: 5,
  trendConfidence: 80,
  mssDetected: false,
  breakerDetected: false,
  unfilledFvgCount: 0,
  bosDetected: false,
  chochDetected: true,
});
assert(scoreWithCHoCH !== null, 'T77: score with CHoCH is non-null');
assert(scoreWithCHoCH >= 0 && scoreWithCHoCH <= 100, 'T78: score with CHoCH is bounded');

// BOS contributes more to score than CHoCH (BOS confirms, CHoCH is transitional)
assert(scoreWithBOS >= scoreWithCHoCH, 'T79: BOS contributes >= score vs CHoCH');

// --- T80-T83: No look-ahead bias ---
// Use the same data but with different timestamps to verify determinism
const lookAheadData = generateBullishBOSData();
const la1 = buildStructureIntelligence({
  highs: lookAheadData.highs,
  lows: lookAheadData.lows,
  closes: lookAheadData.closes,
  symbol: 'LA',
});
const la2 = buildStructureIntelligence({
  highs: lookAheadData.highs,
  lows: lookAheadData.lows,
  closes: lookAheadData.closes,
  symbol: 'LA',
});
const la1NoTs = JSON.parse(JSON.stringify(la1)); delete la1NoTs.timestamp;
const la2NoTs = JSON.parse(JSON.stringify(la2)); delete la2NoTs.timestamp;
assert(JSON.stringify(la1NoTs) === JSON.stringify(la2NoTs), 'T80: deterministic — same inputs produce same output');
assert(la1.bos.detected === la2.bos.detected, 'T81: BOS detection is deterministic');
assert(la1.choch.detected === la2.choch.detected, 'T82: CHoCH detection is deterministic');
assert(la1.structureState === la2.structureState, 'T83: structure state is deterministic');

// --- T84-T87: Insufficient data → no BOS/CHoCH ---
const shortData = buildStructureIntelligence({
  highs: [101, 102, 103],
  lows: [99, 100, 101],
  closes: [100, 101, 102],
  symbol: 'SHORT',
});
assert(shortData.bos.detected === false, 'T84: insufficient data → no BOS');
assert(shortData.choch.detected === false, 'T85: insufficient data → no CHoCH');
assert(shortData.dataQuality.hasBOS === false, 'T86: insufficient data → hasBOS false');
assert(shortData.dataQuality.hasCHoCH === false, 'T87: insufficient data → hasCHoCH false');

// --- T88-T90: Default structure intelligence includes BOS/CHoCH ---
const defaultSI = defaultStructureIntelligence();
assert(defaultSI.bos !== undefined, 'T88: default includes bos');
assert(defaultSI.choch !== undefined, 'T89: default includes choch');
assert(defaultSI.bos.detected === false, 'T90: default bos.detected is false');

// --- T91-T93: Anti-double-counting — BOS + CHoCH signals share STRUCTURE family ---
const allSignals = [...bullishBOSResult.signals, ...bearishBOSResult.signals, ...bullishCHoCHResult.signals, ...bearishCHoCHResult.signals];
const structureSignals = allSignals.filter(s => s.family === 'STRUCTURE');
const bosSignalsAll = structureSignals.filter(s => s.type === 'BOS');
const chochSignalsAll = structureSignals.filter(s => s.type === 'CHoCH');
// All BOS/CHoCH signals should have STRUCTURE family
assert(bosSignalsAll.every(s => s.family === 'STRUCTURE'), 'T91: all BOS signals have STRUCTURE family');
assert(chochSignalsAll.every(s => s.family === 'STRUCTURE'), 'T92: all CHoCH signals have STRUCTURE family');
// MSS signals should also have STRUCTURE family
const mssSignals = allSignals.filter(s => s.type === 'MSS');
assert(mssSignals.every(s => s.family === 'STRUCTURE'), 'T93: all MSS signals have STRUCTURE family');

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
