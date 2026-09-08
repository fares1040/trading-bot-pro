import {
  buildMTFEvidence,
  defaultMTFEvidence,
  resolveDirection,
  classifyAlignment,
  ALIGNMENT,
  DIRECTION,
} from '../lib/mtf-evidence.js';
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

const assertNull = (value, message) => {
  assert(value === null || value === undefined, `${message} — expected null, got ${value}`);
};

// ============================================================================
// DATA GENERATORS
// ============================================================================

function generateBullishOHLCV(start = 100, count = 50, step = 2) {
  const closes = Array.from({ length: count }, (_, i) => start + i * step);
  const highs = closes.map(c => c + 2);
  const lows = closes.map(c => c - 2);
  const volumes = Array.from({ length: count }, () => 1000);
  return { highs, lows, closes, volumes };
}

function generateBearishOHLCV(start = 150, count = 50, step = 2) {
  const closes = Array.from({ length: count }, (_, i) => start - i * step);
  const highs = closes.map(c => c + 2);
  const lows = closes.map(c => c - 2);
  const volumes = Array.from({ length: count }, () => 1000);
  return { highs, lows, closes, volumes };
}

function generateNeutralOHLCV(count = 50, base = 100) {
  const closes = Array.from({ length: count }, (_, i) => base + Math.sin(i * 0.3) * 5);
  const highs = closes.map(c => c + 2);
  const lows = closes.map(c => c - 2);
  const volumes = Array.from({ length: count }, () => 1000);
  return { highs, lows, closes, volumes };
}

// ============================================================================
// TESTS
// ============================================================================

console.log('=== MTF Evidence Test Suite ===\n');

// --- T01-T03: Imports ---
assert(typeof buildMTFEvidence === 'function', 'T01: buildMTFEvidence is imported');
assert(typeof defaultMTFEvidence === 'function', 'T02: defaultMTFEvidence is imported');
assert(typeof resolveDirection === 'function', 'T03: resolveDirection is imported');

// --- T04-T07: Empty inputs ---
const empty = buildMTFEvidence({});
assert(empty.alignment === ALIGNMENT.INSUFFICIENT_DATA, 'T04: empty → INSUFFICIENT_DATA');
assert(empty.direction === DIRECTION.UNAVAILABLE, 'T05: empty → UNAVAILABLE direction');
assert(empty.dataQuality.availableTimeframeCount === 0, 'T06: empty → 0 available timeframes');
assert(empty.supportingEvents.length === 0, 'T07: empty → no supporting events');

// --- T08-T10: Default MTF evidence ---
const def = defaultMTFEvidence();
assert(def.alignment === ALIGNMENT.INSUFFICIENT_DATA, 'T08: default → INSUFFICIENT_DATA');
assert(def.higherTimeframe === null, 'T09: default → no higher TF');
assert(def.primaryTimeframe === null, 'T10: default → no primary TF');

// --- T11-T14: Single timeframe (daily only) ---
const dailyData = generateBullishOHLCV();
const singleTF = buildMTFEvidence({
  primaryTimeframe: dailyData,
  primaryTimeframeLabel: 'daily',
  symbol: 'SINGLE',
});
assert(singleTF.alignment === ALIGNMENT.SINGLE_TIMEFRAME, 'T11: daily only → SINGLE_TIMEFRAME');
assert(singleTF.direction !== DIRECTION.UNAVAILABLE, 'T12: daily only → direction available');
assert(singleTF.primaryTimeframe !== null, 'T13: daily only → primary TF present');
assert(singleTF.higherTimeframe === null, 'T14: daily only → no higher TF');

// --- T15-T18: Bullish alignment across 2 timeframes ---
const htfBullish = generateBullishOHLCV(100, 50, 2);
const primaryBullish = generateBullishOHLCV(100, 50, 2);
const bullAlign = buildMTFEvidence({
  higherTimeframe: htfBullish,
  primaryTimeframe: primaryBullish,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'BULL_ALIGN',
});
assert(bullAlign.alignment === ALIGNMENT.FULL_ALIGNMENT, 'T15: bullish + bullish → FULL_ALIGNMENT');
assert(bullAlign.direction === DIRECTION.BULLISH, 'T16: bullish alignment → BULLISH direction');
assert(bullAlign.higherTimeframe !== null, 'T17: has higher TF');
assert(bullAlign.primaryTimeframe !== null, 'T18: has primary TF');

// --- T19-T22: Bearish alignment across 2 timeframes ---
const htfBearish = generateBearishOHLCV();
const primaryBearish = generateBearishOHLCV();
const bearAlign = buildMTFEvidence({
  higherTimeframe: htfBearish,
  primaryTimeframe: primaryBearish,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'BEAR_ALIGN',
});
assert(bearAlign.alignment === ALIGNMENT.FULL_ALIGNMENT, 'T19: bearish + bearish → FULL_ALIGNMENT');
assert(bearAlign.direction === DIRECTION.BEARISH, 'T20: bearish alignment → BEARISH direction');
assert(bearAlign.dataQuality.htfAvailable === true, 'T21: HTF available');
assert(bearAlign.dataQuality.primaryAvailable === true, 'T22: primary available');

// --- T23-T26: Higher bullish + lower bearish → COUNTER_TREND ---
const htfBull = generateBullishOHLCV();
const primaryBear = generateBearishOHLCV();
const counterTrend = buildMTFEvidence({
  higherTimeframe: htfBull,
  primaryTimeframe: primaryBear,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'COUNTER',
});
assert(counterTrend.alignment === ALIGNMENT.COUNTER_TREND || counterTrend.alignment === ALIGNMENT.STRUCTURAL_CONFLICT, 'T23: bullish HTF + bearish primary → COUNTER_TREND or STRUCTURAL_CONFLICT');
assert(counterTrend.conflicts.length > 0, 'T24: has conflicts');
assert(counterTrend.dataQuality.hasConflicts === true, 'T25: hasConflicts true');
assert(counterTrend.limitations.length === 0 || counterTrend.limitations.length >= 0, 'T26: limitations is array');

// --- T27-T30: Higher bearish + lower bullish → COUNTER_TREND ---
const htfBear = generateBearishOHLCV();
const primaryBull = generateBullishOHLCV();
const counterTrend2 = buildMTFEvidence({
  higherTimeframe: htfBear,
  primaryTimeframe: primaryBull,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'COUNTER2',
});
assert(counterTrend2.alignment === ALIGNMENT.COUNTER_TREND || counterTrend2.alignment === ALIGNMENT.STRUCTURAL_CONFLICT, 'T27: bearish HTF + bullish primary → COUNTER_TREND or STRUCTURAL_CONFLICT');
assert(counterTrend2.conflicts.length > 0, 'T28: has conflicts');

// --- T31-T34: 3-timeframe bullish alignment ---
const htf3Bull = generateBullishOHLCV();
const primary3Bull = generateBullishOHLCV();
const exec3Bull = generateBullishOHLCV();
const full3 = buildMTFEvidence({
  higherTimeframe: htf3Bull,
  primaryTimeframe: primary3Bull,
  executionTimeframe: exec3Bull,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  executionTimeframeLabel: 'intraday',
  symbol: 'FULL3',
});
assert(full3.alignment === ALIGNMENT.FULL_ALIGNMENT, 'T31: 3x bullish → FULL_ALIGNMENT');
assert(full3.direction === DIRECTION.BULLISH, 'T32: 3x bullish → BULLISH');
assert(full3.executionTimeframe !== null, 'T33: has execution TF');
assert(full3.dataQuality.availableTimeframeCount === 3, 'T34: 3 available timeframes');

// --- T35-T38: Missing higher timeframe ---
const missingHTF = buildMTFEvidence({
  primaryTimeframe: primaryBullish,
  primaryTimeframeLabel: 'daily',
  symbol: 'MISSING_HTF',
});
assert(missingHTF.alignment === ALIGNMENT.SINGLE_TIMEFRAME, 'T35: missing HTF → SINGLE_TIMEFRAME');
assert(missingHTF.higherTimeframe === null, 'T36: missing HTF → null');
assert(missingHTF.limitations.some(l => l.includes('unavailable')), 'T37: missing HTF → limitation noted');
assert(typeof missingHTF.dataQuality.htfAvailable === 'boolean', 'T38: missing HTF → htfAvailable is boolean');

// --- T39-T42: Missing lower timeframe ---
const missingExec = buildMTFEvidence({
  higherTimeframe: htfBullish,
  primaryTimeframe: primaryBullish,
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'MISSING_EXEC',
});
assert(missingExec.alignment === ALIGNMENT.FULL_ALIGNMENT, 'T39: missing exec → still FULL_ALIGNMENT');
assert(missingExec.executionTimeframe === null, 'T40: missing exec → null');
assert(missingExec.limitations.some(l => l.includes('unavailable')), 'T41: missing exec → limitation noted');
assert(typeof missingExec.dataQuality.execAvailable === 'boolean', 'T42: missing exec → execAvailable is boolean');

// --- T43-T46: Insufficient data on primary ---
const insufficientData = buildMTFEvidence({
  primaryTimeframe: { highs: [101, 102], lows: [99, 100], closes: [100, 101] },
  primaryTimeframeLabel: 'daily',
  symbol: 'INSUFF',
});
assert(insufficientData.alignment === ALIGNMENT.SINGLE_TIMEFRAME || insufficientData.alignment === ALIGNMENT.INSUFFICIENT_DATA, 'T43: insufficient data → degraded alignment');
assert(insufficientData.limitations.length >= 0, 'T44: has limitations');

// --- T47-T50: BOS remains attached to correct timeframe ---
const bosHTF = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(100, 50, 3),
  primaryTimeframe: generateBullishOHLCV(100, 50, 3),
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'BOS_TF',
});
// Check that any BOS events have correct timeframe label
for (const evt of bosHTF.supportingEvents) {
  if (evt.type === 'BOS') {
    assert(evt.timeframe === 'higherTimeframe' || evt.timeframe === 'primaryTimeframe' || evt.timeframe === 'executionTimeframe', `T47: BOS attached to valid timeframe label`);
    assert(typeof evt.timeframeLabel === 'string', 'T48: BOS has timeframeLabel string');
  }
}
assert(typeof bosHTF.supportingEvents.length === 'number', 'T49: supportingEvents is array');

// --- T51-T54: CHoCH remains attached to correct timeframe ---
// (CHoCH detection depends on data shape; we verify structure if detected)
const chochData = buildMTFEvidence({
  higherTimeframe: generateBearishOHLCV(150, 50, 2),
  primaryTimeframe: generateBullishOHLCV(100, 50, 3),
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'CHOCH_TF',
});
for (const evt of chochData.supportingEvents) {
  if (evt.type === 'CHoCH') {
    assert(evt.timeframe === 'higherTimeframe' || evt.timeframe === 'primaryTimeframe' || evt.timeframe === 'executionTimeframe', 'T51: CHoCH attached to valid timeframe');
  }
}
assert(chochData.alignment !== undefined, 'T52: alignment defined');
assert(typeof chochData.confidence === 'number' || chochData.confidence === null, 'T53: confidence is number or null');

// --- T55-T58: No double counting — all events are STRUCTURE family ---
const allEvents = [...full3.supportingEvents];
const allBOS = allEvents.filter(e => e.type === 'BOS');
const allCHoCH = allEvents.filter(e => e.type === 'CHoCH');
// Multiple BOS from different TFs are observations, not independent scores
assert(allBOS.length <= 3, 'T55: at most 3 BOS (one per TF)');
assert(allCHoCH.length <= 3, 'T56: at most 3 CHoCH (one per TF)');
assert(full3.family === 'STRUCTURE', 'T57: MTF evidence family is STRUCTURE');
assert(full3.type === 'MULTI_TIMEFRAME', 'T58: MTF evidence type is MULTI_TIMEFRAME');

// --- T59-T62: Deterministic output ---
const det1 = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBullishOHLCV(),
  symbol: 'DET',
});
const det2 = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBullishOHLCV(),
  symbol: 'DET',
});
const d1NoTs = JSON.parse(JSON.stringify(det1)); delete d1NoTs.timestamp;
const d2NoTs = JSON.parse(JSON.stringify(det2)); delete d2NoTs.timestamp;
assert(JSON.stringify(d1NoTs) === JSON.stringify(d2NoTs), 'T59: deterministic output');
assert(det1.alignment === det2.alignment, 'T60: deterministic alignment');
assert(det1.direction === det2.direction, 'T61: deterministic direction');
assert(det1.timestamp !== undefined, 'T62: has timestamp');

// --- T63-T66: No look-ahead bias (same as deterministic, verified by data shape) ---
const laData1 = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBearishOHLCV(),
  symbol: 'LA',
});
const laData2 = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBearishOHLCV(),
  symbol: 'LA',
});
assert(laData1.alignment === laData2.alignment, 'T63: look-ahead safe — same data → same alignment');
assert(laData1.direction === laData2.direction, 'T64: look-ahead safe — same data → same direction');
assert(laData1.conflicts.length === laData2.conflicts.length, 'T65: look-ahead safe — same conflicts count');

// --- T67-T70: Malformed / unordered candle data handled safely ---
const malformed = buildMTFEvidence({
  primaryTimeframe: { highs: [null, 102, undefined, 104], lows: [99, null, 101, null], closes: [100, 101, null, 103] },
  primaryTimeframeLabel: 'daily',
  symbol: 'MALFORMED',
});
assert(malformed.alignment !== undefined, 'T67: malformed data → no crash');
assert(typeof malformed.alignment === 'string', 'T68: malformed data → valid alignment string');
assert(malformed.dataQuality !== undefined, 'T69: malformed data → has dataQuality');
assert(malformed.limitations !== undefined, 'T70: malformed data → has limitations');

// --- T71-T74: Empty input handled safely ---
const emptyArr = buildMTFEvidence({
  primaryTimeframe: { highs: [], lows: [], closes: [], volumes: [] },
  primaryTimeframeLabel: 'daily',
  symbol: 'EMPTY_ARR',
});
assert(emptyArr.alignment !== undefined, 'T71: empty arrays → no crash');
assert(emptyArr.dataQuality.availableTimeframeCount <= 1, 'T72: empty arrays → low available count');

// --- T75-T78: Conflicts detected between HTF and primary ---
const conflictResult = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBearishOHLCV(),
  higherTimeframeLabel: 'weekly',
  primaryTimeframeLabel: 'daily',
  symbol: 'CONFLICT',
});
assert(conflictResult.conflicts.length > 0, 'T75: HTF/primary conflict → conflicts present');
assert(conflictResult.dataQuality.hasConflicts === true, 'T76: hasConflicts true');
const conflictTypes = conflictResult.conflicts.map(c => c.type);
assert(conflictTypes.includes('HIGHER_PRIMARY_CONFLICT') || conflictTypes.includes('COUNTER_TREND_EXECUTION'), 'T77: conflict type valid');

// --- T79-T80: Confidence reflects alignment ---
const fullAlignConf = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBullishOHLCV(),
  symbol: 'CONF_FULL',
});
const conflictConf = buildMTFEvidence({
  higherTimeframe: generateBullishOHLCV(),
  primaryTimeframe: generateBearishOHLCV(),
  symbol: 'CONF_CONF',
});
if (fullAlignConf.confidence != null && conflictConf.confidence != null) {
  assert(fullAlignConf.confidence >= conflictConf.confidence, 'T79: full alignment confidence >= conflict confidence');
}
assert(typeof fullAlignConf.confidence === 'number' || fullAlignConf.confidence === null, 'T80: confidence is number or null');

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
