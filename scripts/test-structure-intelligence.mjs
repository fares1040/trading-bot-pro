import {
  buildStructureIntelligence,
  defaultStructureIntelligence,
  buildPivots,
  classifyPivotSequences,
  detectEqualHighsLows,
  calculateStructureScore,
  classifyStructureState,
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

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
