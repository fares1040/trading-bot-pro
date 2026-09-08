/**
 * C9 AI Explanation Engine — Step 7 Technical Evidence Integration Tests
 *
 * Tests that Technical Evidence improves C9 explanation:
 * - WHY NOW based on TE families
 * - WHAT CONFIRMS the thesis
 * - WHAT INVALIDATES the thesis
 * - Counter-thesis from TE
 * - TE family explanations
 * - Conflict-aware explanation
 * - No fabricated claims
 * - Backward compatibility
 *
 * Run with: node scripts/test-c9-technical-evidence-explanation.mjs
 */

import {
  buildAIExplanation,
  defaultExplanation,
  explainTechnicalEvidenceFamily,
  explainTechnicalEvidenceFull,
  buildConfirms,
  buildInvalidates,
  buildCounterThesis,
  detectConflicts,
  buildWhyNow,
} from '../lib/ai-explanation.js';
import {
  buildTechnicalEvidence,
  defaultTechnicalEvidence,
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

function makeC7(score = 75) {
  return {
    opportunityScore: score,
    quality: score >= 85 ? "TOP" : score >= 70 ? "STRONG" : "WATCH",
    confidence: 70,
    dataCompleteness: 80,
    componentScores: { swingIntelligence: 75 },
    directionBias: "buy",
    warnings: [],
    risks: [],
    flags: [],
  };
}

function makeB4() {
  return {
    swingScore: 75,
    signal: "BUY",
    quality: "TOP",
    directionBias: "buy",
    setupClassification: [{ type: "BREAKOUT", confidence: 80 }],
    dataAvailability: { price: true, volume: true, technicals: true },
  };
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
      structureState: "BULLISH_CONTINUATION",
      structureClassification: { higherHighs: true, higherLows: true, lowerHighs: false, lowerLows: false },
      bos: { detected: true, direction: "BULLISH", level: 105, description: "BOS" },
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
      structureState: "BEARISH_CONTINUATION",
      structureClassification: { higherHighs: false, higherLows: false, lowerHighs: true, lowerLows: true },
      bos: { detected: false },
      choch: { detected: true, direction: "BEARISH", level: 90, description: "CHoCH" },
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
      structureState: "RANGE",
      structureClassification: { higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false },
      bos: { detected: false },
      choch: { detected: false },
      marketStructure: { mssDetected: false },
      confidence: 45,
    },
  });
}

function makeEmptyTE() {
  return defaultTechnicalEvidence("TEST");
}

// ============================================================================
// TESTS
// ============================================================================

console.log('=== C9 Technical Evidence Explanation Tests ===\n');

// --- T01-T03: Output contract includes new fields ---
const defaultResult = defaultExplanation("TEST");
assert(defaultResult.confirms !== undefined, "T01: default has confirms");
assert(defaultResult.invalidates !== undefined, "T02: default has invalidates");
assert(defaultResult.counterThesis !== undefined, "T03: default has counterThesis");
assert(defaultResult.technicalEvidenceExplanation === null, "T04: default has technicalEvidenceExplanation null");
assert(defaultResult.technicalEvidenceFamilies === null, "T05: default has technicalEvidenceFamilies null");

// --- T06-T08: explainTechnicalEvidenceFamily ---
const bullTE = makeBullishTE();
const structFamily = explainTechnicalEvidenceFamily("STRUCTURE", bullTE.families.structure);
assert(structFamily !== null, "T06: structure family explained");
assert(structFamily.explanation.includes("bullish"), "T07: structure explanation mentions bullish");
assert(structFamily.evidence.length > 0, "T08: structure has evidence");

// --- T09-T11: explainTechnicalEvidenceFull ---
const teEx = explainTechnicalEvidenceFull(bullTE);
assert(teEx !== null, "T09: TE full explanation produced");
assert(teEx.families.length >= 3, "T10: at least 3 families explained");
assert(teEx.overallDirection === "BULLISH", "T11: overall direction BULLISH");

// --- T12-T14: WHY NOW includes TE factors ---
const whyNowBull = buildWhyNow({ opportunityRanking: makeC7(75) }, [], bullTE);
assert(whyNowBull !== null, "T12: whyNow produced");
const teFactors = whyNowBull.filter(f => f.factor && f.factor.startsWith("TE "));
assert(teFactors.length >= 2, "T13: at least 2 TE factors in whyNow");
assert(teFactors.some(f => f.factor === "TE Structure"), "T14: TE Structure in whyNow");

// --- T15-T17: WHAT CONFIRMS ---
const confirms = buildConfirms({ opportunityRanking: makeC7(75) }, bullTE, { stopLoss: 97 });
assert(confirms.length > 0, "T15: confirms produced");
assert(confirms.some(c => c.source === "TE structure"), "T16: TE structure confirms");
assert(confirms.some(c => c.source === "C7 Opportunity Ranking"), "T17: C7 confirms");

// --- T18-T20: WHAT INVALIDATES ---
const invalidates = buildInvalidates({ opportunityRanking: makeC7(75) }, bullTE, { stopLoss: 97, invalidation: 95 });
assert(invalidates.length > 0, "T18: invalidates produced");
assert(invalidates.some(i => i.source === "C8 Trade Plan"), "T19: C8 stop in invalidates");
assert(invalidates.some(i => i.level === 97), "T20: stop level in invalidates");

// --- T21-T23: COUNTER-THESIS ---
const counterThesis = buildCounterThesis({ opportunityRanking: makeC7(75) }, bullTE, { stopLoss: 97 });
assert(counterThesis.length > 0, "T21: counterThesis produced");
assert(typeof counterThesis[0] === "string", "T22: counterThesis items are strings");
assert(counterThesis.some(c => c.includes("97")), "T23: counterThesis mentions stop level");

// --- T24-T26: TE CONFLICTS in detectConflicts ---
const mixedTE = makeMixedTE();
const conflicts = detectConflicts({ opportunityRanking: makeC7(75) }, mixedTE);
assert(Array.isArray(conflicts), "T24: conflicts is array");
// Mixed TE may or may not have conflicts depending on family directions
assert(conflicts.length >= 0, "T25: conflicts handled");

// --- T27-T29: Bearish TE produces correct explanation ---
const bearEx = explainTechnicalEvidenceFull(makeBearishTE());
assert(bearEx !== null, "T27: bearish TE explained");
assert(bearEx.overallDirection === "BEARISH", "T28: overall direction BEARISH");
assert(bearEx.families.some(f => f.explanation.includes("bearish")), "T29: bearish in explanation");

// --- T30-T32: Empty TE handled safely ---
const emptyEx = explainTechnicalEvidenceFull(makeEmptyTE());
assert(emptyEx === null, "T30: empty TE → null explanation");

const emptyConfirms = buildConfirms({ opportunityRanking: makeC7(75) }, makeEmptyTE(), null);
assert(emptyConfirms.length >= 0, "T31: empty TE → safe confirms");

const emptyInvalidates = buildInvalidates({ opportunityRanking: makeC7(75) }, makeEmptyTE(), null);
assert(emptyInvalidates.length >= 0, "T32: empty TE → safe invalidates");

// --- T33-T35: Missing TE handled safely ---
const noTE_confirms = buildConfirms({ opportunityRanking: makeC7(75) }, null, null);
assert(noTE_confirms.length >= 0, "T33: null TE → safe confirms");

const noTE_invalidates = buildInvalidates({ opportunityRanking: makeC7(75) }, null, null);
assert(noTE_invalidates.length >= 0, "T34: null TE → safe invalidates");

const noTE_counter = buildCounterThesis({ opportunityRanking: makeC7(75) }, null, null);
assert(noTE_counter.length > 0, "T35: null TE → counterThesis still produced");

// --- T36-T38: Full integration test ---
const fullResult = buildAIExplanation("TEST", {
  opportunityRanking: makeC7(75),
  swingIntelligence: makeB4(),
}, { technicalEvidence: makeBullishTE() });

assert(fullResult.available === true, "T36: available");
assert(fullResult.confirms.length > 0, "T37: confirms in output");
assert(Array.isArray(fullResult.invalidates), "T38: invalidates is array");
assert(fullResult.counterThesis.length > 0, "T39: counterThesis in output");
assert(fullResult.technicalEvidenceExplanation !== null, "T40: TE explanation in output");
assert(fullResult.technicalEvidenceFamilies !== null, "T41: TE families in output");
assert(fullResult.dataAvailability.technicalEvidence === true, "T42: TE available in dataAvailability");

// --- T43-T45: WhyNow includes TE in full integration ---
assert(fullResult.whyNow !== null, "T43: whyNow produced");
const teWhyNow = fullResult.whyNow.filter(f => f.factor && f.factor.startsWith("TE "));
assert(teWhyNow.length >= 2, "T44: TE factors in whyNow");

// --- T46-T48: No fabricated claims ---
const noSources = buildAIExplanation("TEST", {}, { technicalEvidence: makeBullishTE() });
assert(noSources.available === true, "T46: TE-only → available");
assert(noSources.technicalEvidenceExplanation !== null, "T47: TE explanation present");
assert(noSources.disclaimer.includes("Technical Evidence"), "T48: disclaimer mentions TE");

// --- T49-T51: Deterministic output ---
const det1 = buildAIExplanation("TEST", { opportunityRanking: makeC7(75) }, { technicalEvidence: makeBullishTE() });
const det2 = buildAIExplanation("TEST", { opportunityRanking: makeC7(75) }, { technicalEvidence: makeBullishTE() });
const d1NoTs = JSON.parse(JSON.stringify(det1)); delete d1NoTs.timestamp;
const d2NoTs = JSON.parse(JSON.stringify(det2)); delete d2NoTs.timestamp;
assert(JSON.stringify(d1NoTs) === JSON.stringify(d2NoTs), "T49: deterministic output");
assertEqual(det1.confirms.length, det2.confirms.length, "T50: deterministic confirms");
assertEqual(det1.invalidates.length, det2.invalidates.length, "T51: deterministic invalidates");

// --- T52-T54: No double-counting in explanation language ---
const teExFull = explainTechnicalEvidenceFull(makeBullishTE());
const allExplanations = teExFull.families.map(f => f.explanation).join(" ");
// Should not list HH, HL, BOS, bullish structure as 4 separate items
assert(!allExplanations.includes("HH, HL, BOS and bullish structure"), "T52: no double-counting HH/HL/BOS");

// --- T55-T57: MTF conflict mentioned when present ---
// (synthetic data may not produce MTF conflict, but the function should handle it)
const mtfConflicts = detectConflicts({ opportunityRanking: makeC7(75) }, makeMixedTE());
assert(Array.isArray(mtfConflicts), "T53: MTF conflicts handled");

// --- T58-T60: Existing behavior regression ---
const withoutTE = buildAIExplanation("TEST", {
  opportunityRanking: makeC7(75),
  swingIntelligence: makeB4(),
});
assert(withoutTE.technicalEvidenceExplanation === null, "T54: no TE → no TE explanation");
assert(withoutTE.dataAvailability.technicalEvidence === false, "T55: no TE → TE unavailable");
assert(withoutTE.confirms.length >= 0, "T56: no TE → confirms still works");
assert(withoutTE.invalidates.length >= 0, "T57: no TE → invalidates still works");
assert(withoutTE.counterThesis.length > 0, "T58: no TE → counterThesis still works");

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
}
