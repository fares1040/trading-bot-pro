/**
 * C7 Technical Evidence Integration Gate — Shadow Comparison Tests
 *
 * Tests that Technical Evidence integrates with C7 safely:
 * - Current C7 score is UNCHANGED by technical evidence
 * - Shadow comparison produces parallel interpretation
 * - Evidence families are exposed in output
 * - Anti-double-counting preserved
 * - Missing data handled safely
 * - Deterministic output
 *
 * Run with: node scripts/test-c7-technical-evidence-gate.mjs
 */

import {
  buildOpportunityRanking,
  defaultOpportunityRanking,
} from '../lib/opportunity-ranking.js';
import {
  buildTechnicalEvidence,
  defaultTechnicalEvidence,
  EVIDENCE_FAMILY,
  DIRECTION_ENUM,
} from '../lib/technical-evidence.js';

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
// DATA FIXTURES
// ============================================================================

function makeB1(score = 70) {
  return { pennyScore: score, setupScore: score, signal: 'BUY', quality: 'STRONG' };
}

function makeB4(score = 75) {
  return { swingScore: score, setupScore: score, signal: 'BUY', quality: 'TOP', expectedTimeframe: '1–3 Months' };
}

function makeB5(score = 65) {
  return { explosionScore: score, signal: 'BUY', quality: 'HIGH' };
}

function makeB6(score = 60) {
  return { catalystScore: score, quality: 'WATCH' };
}

function makeBullishTE() {
  return buildTechnicalEvidence({
    marketData: {
      price: 110, sma20: 105, sma50: 100, rsi: 62,
      relativeVolume: 1.8, volumeScore: 75, momentumPercent: 3,
      momentumScore: 65, trendScore: 80, bollingerBandwidth: 8,
      squeeze: false, resistance20: 115, support20: 95,
      closes: Array.from({ length: 60 }, (_, i) => 90 + i * 1.5),
      highs: Array.from({ length: 60 }, (_, i) => 92 + i * 1.5),
      lows: Array.from({ length: 60 }, (_, i) => 88 + i * 1.5),
      volumes: Array.from({ length: 60 }, () => 1000),
    },
    structureData: {
      structureState: 'BULLISH_CONTINUATION',
      structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
      bos: { detected: true, direction: 'BULLISH', level: 105, description: 'BOS' },
      choch: { detected: false },
      marketStructure: { mssDetected: false },
      confidence: 80,
    },
  });
}

function makeBearishTE() {
  return buildTechnicalEvidence({
    marketData: {
      price: 80, sma20: 85, sma50: 95, rsi: 35,
      relativeVolume: 1.5, volumeScore: 60, momentumPercent: -3,
      momentumScore: 35, trendScore: 30, bollingerBandwidth: 10,
      squeeze: false, resistance20: 90, support20: 75,
      closes: Array.from({ length: 60 }, (_, i) => 110 - i * 1),
      highs: Array.from({ length: 60 }, (_, i) => 112 - i * 1),
      lows: Array.from({ length: 60 }, (_, i) => 108 - i * 1),
      volumes: Array.from({ length: 60 }, () => 1000),
    },
    structureData: {
      structureState: 'BEARISH_CONTINUATION',
      structureClassification: { higherHighs: false, higherLows: false, lowerHighs: true, lowerLows: true },
      bos: { detected: false },
      choch: { detected: true, direction: 'BEARISH', level: 90, description: 'CHoCH' },
      marketStructure: { mssDetected: false },
      confidence: 70,
    },
  });
}

function makeMixedTE() {
  return buildTechnicalEvidence({
    marketData: {
      price: 100, sma20: 102, sma50: 98, rsi: 48,
      relativeVolume: 1.0, volumeScore: 50, momentumPercent: 0.5,
      momentumScore: 50, trendScore: 50, bollingerBandwidth: 6,
      squeeze: true, resistance20: 105, support20: 95,
      closes: Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.3) * 5),
      highs: Array.from({ length: 60 }, (_, i) => 102 + Math.sin(i * 0.3) * 5),
      lows: Array.from({ length: 60 }, (_, i) => 98 + Math.sin(i * 0.3) * 5),
      volumes: Array.from({ length: 60 }, () => 1000),
    },
    structureData: {
      structureState: 'RANGE',
      structureClassification: { higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false },
      bos: { detected: false },
      choch: { detected: false },
      marketStructure: { mssDetected: false },
      confidence: 45,
    },
  });
}

// ============================================================================
// TESTS
// ============================================================================

console.log('=== C7 Technical Evidence Integration Gate Tests ===\n');

// --- T01-T03: Output contract includes new fields ---
const defaultResult = defaultOpportunityRanking('TEST');
assert(defaultResult.technicalEvidence === null, 'T01: default has technicalEvidence = null');
assert(defaultResult.technicalEvidenceShadow === null, 'T02: default has technicalEvidenceShadow = null');

const basicResult = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() });
assert(basicResult.technicalEvidence === null, 'T03: no TE → technicalEvidence = null');

// --- T04-T07: Technical Evidence is exposed in output ---
const withTE = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBullishTE(),
});
assert(withTE.technicalEvidence !== null, 'T04: with TE → technicalEvidence present');
assert(withTE.technicalEvidenceShadow !== null, 'T05: with TE → shadow present');
assert(withTE.technicalEvidenceShadow.direction === 'BULLISH', 'T06: bullish TE → shadow direction BULLISH');
assert(withTE.technicalEvidenceShadow.alignment !== undefined, 'T07: shadow has alignment');

// --- T08-T11: Current C7 score is UNCHANGED by technical evidence ---
const withoutTE = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() });
const withTEsame = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBullishTE(),
});
assertEqual(withoutTE.opportunityScore, withTEsame.opportunityScore, 'T08: opportunityScore UNCHANGED by TE');
assertEqual(withoutTE.quality, withTEsame.quality, 'T09: quality UNCHANGED by TE');
assertEqual(withoutTE.confidence, withTEsame.confidence, 'T10: confidence UNCHANGED by TE');
assertEqual(withoutTE.componentScores, withTEsame.componentScores, 'T11: componentScores UNCHANGED by TE');

// --- T12-T15: Shadow comparison — bullish ---
const bullShadow = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBullishTE(),
});
assert(bullShadow.technicalEvidenceShadow.direction === 'BULLISH', 'T12: bullish shadow direction');
assert(bullShadow.technicalEvidenceShadow.bullishFamilies >= 2, 'T13: bullish families >= 2');
assert(bullShadow.technicalEvidenceShadow.familyCount >= 4, 'T14: at least 4 families available');
assert(typeof bullShadow.technicalEvidenceShadow.alignment === 'string', 'T15: alignment is string');

// --- T16-T19: Shadow comparison — bearish ---
const bearShadow = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBearishTE(),
});
assert(bearShadow.technicalEvidenceShadow.direction === 'BEARISH', 'T16: bearish shadow direction');
assert(bearShadow.technicalEvidenceShadow.bearishFamilies >= 2, 'T17: bearish families >= 2');

// --- T20-T23: Shadow comparison — mixed/neutral ---
const mixedShadow = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeMixedTE(),
});
assert(mixedShadow.technicalEvidenceShadow.direction === 'NEUTRAL' || mixedShadow.technicalEvidenceShadow.direction === 'BULLISH' || mixedShadow.technicalEvidenceShadow.direction === 'BEARISH', 'T20: mixed shadow → valid direction');

// --- T24-T27: Evidence families exposed ---
assert(withTE.technicalEvidence.structure !== undefined, 'T24: has structure family');
assert(withTE.technicalEvidence.trend !== undefined, 'T25: has trend family');
assert(withTE.technicalEvidence.momentum !== undefined, 'T26: has momentum family');
assert(withTE.technicalEvidence.volume !== undefined, 'T27: has volume family');

// --- T28-T31: No double counting — score unchanged with multiple families ---
const fullB1 = makeB1(70);
const fullB4 = makeB4(75);
const fullB5 = makeB5(65);
const fullB6 = makeB6(60);
const withoutFull = buildOpportunityRanking('TEST', {
  pennyIntelligence: fullB1,
  swingIntelligence: fullB4,
  earlyExplosion: fullB5,
  catalystIntelligence: fullB6,
});
const withFullTE = buildOpportunityRanking('TEST', {
  pennyIntelligence: fullB1,
  swingIntelligence: fullB4,
  earlyExplosion: fullB5,
  catalystIntelligence: fullB6,
}, { technicalEvidence: makeBullishTE() });
assertEqual(withoutFull.opportunityScore, withFullTE.opportunityScore, 'T28: full B1-B6 score UNCHANGED by TE');
assertEqual(withoutFull.quality, withFullTE.quality, 'T29: full quality UNCHANGED');
assertEqual(withoutFull.confidence, withFullTE.confidence, 'T30: full confidence UNCHANGED');
assert(withFullTE.technicalEvidenceShadow.direction === 'BULLISH', 'T31: shadow correctly identifies bullish');

// --- T32-T35: Missing TE handled safely ---
const noTE = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {});
assert(noTE.technicalEvidence === null, 'T32: no TE → null');
assert(noTE.technicalEvidenceShadow === null, 'T33: no TE → shadow null');

const nullTE = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, { technicalEvidence: null });
assert(nullTE.technicalEvidence === null, 'T34: null TE → null');
assert(nullTE.technicalEvidenceShadow === null, 'T35: null TE → shadow null');

// --- T36-T39: Conflicts detected in shadow ---
const conflictTE = buildTechnicalEvidence({
  marketData: {
    price: 100, sma20: 105, sma50: 110, rsi: 35,
    relativeVolume: 1.2, volumeScore: 55, momentumPercent: -2,
    momentumScore: 40, trendScore: 35, bollingerBandwidth: 8,
    squeeze: false, resistance20: 105, support20: 95,
    closes: Array.from({ length: 60 }, (_, i) => 110 - i * 0.5),
    highs: Array.from({ length: 60 }, (_, i) => 112 - i * 0.5),
    lows: Array.from({ length: 60 }, (_, i) => 108 - i * 0.5),
    volumes: Array.from({ length: 60 }, () => 1000),
  },
  structureData: {
    structureState: 'BULLISH_CONTINUATION',
    structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
    bos: { detected: false },
    choch: { detected: false },
    marketStructure: { mssDetected: false },
    confidence: 70,
  },
});
const conflictResult = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: conflictTE,
});
assert(conflictResult.technicalEvidenceShadow !== null, 'T36: conflict TE → shadow present');
assert(Array.isArray(conflictResult.technicalEvidenceShadow.conflicts), 'T37: conflicts is array');
// Structure is BULLISH but trend is BEARISH → should detect conflict
if (conflictResult.technicalEvidenceShadow.conflicts.length > 0) {
  assert(conflictResult.technicalEvidenceShadow.alignment === 'CONFLICTING', 'T38: conflicts → CONFLICTING alignment');
}

// --- T40-T43: Deterministic output ---
const det1 = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBullishTE(),
});
const det2 = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: makeBullishTE(),
});
const d1NoTs = JSON.parse(JSON.stringify(det1)); delete d1NoTs.timestamp;
const d2NoTs = JSON.parse(JSON.stringify(det2)); delete d2NoTs.timestamp;
assert(JSON.stringify(d1NoTs) === JSON.stringify(d2NoTs), 'T40: deterministic output');
assert(det1.technicalEvidenceShadow.direction === det2.technicalEvidenceShadow.direction, 'T41: deterministic shadow direction');
assert(det1.technicalEvidenceShadow.alignment === det2.technicalEvidenceShadow.alignment, 'T42: deterministic shadow alignment');

// --- T44-T47: Current classifications preserved ---
const highB4 = makeB4(90);
const highResult = buildOpportunityRanking('TEST', { swingIntelligence: highB4 });
assert(highResult.quality === 'TOP' || highResult.quality === 'STRONG', 'T43: high B4 → TOP/STRONG quality');

const lowB4 = makeB4(30);
const lowResult = buildOpportunityRanking('TEST', { swingIntelligence: lowB4 });
assert(lowResult.quality === 'WEAK' || lowResult.quality === 'UNAVAILABLE', 'T44: low B4 → WEAK/UNAVAILABLE quality');

// Adding TE does not change classification
const highWithTE = buildOpportunityRanking('TEST', { swingIntelligence: highB4 }, {
  technicalEvidence: makeBullishTE(),
});
assertEqual(highResult.quality, highWithTE.quality, 'T45: high quality preserved with TE');

const lowWithTE = buildOpportunityRanking('TEST', { swingIntelligence: lowB4 }, {
  technicalEvidence: makeBearishTE(),
});
assertEqual(lowResult.quality, lowWithTE.quality, 'T46: low quality preserved with TE');

// --- T48-T50: Empty input handled safely ---
const emptyTE = buildTechnicalEvidence({});
const emptyResult = buildOpportunityRanking('TEST', { swingIntelligence: makeB4() }, {
  technicalEvidence: emptyTE,
});
assert(emptyResult.technicalEvidence !== null, 'T47: empty TE → still exposed');
assert(emptyResult.technicalEvidenceShadow.direction === 'NEUTRAL' || emptyResult.technicalEvidenceShadow.direction === 'UNAVAILABLE', 'T48: empty TE → neutral/unavailable shadow');
assert(emptyResult.opportunityScore === withoutTE.opportunityScore, 'T49: empty TE → score unchanged');

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
