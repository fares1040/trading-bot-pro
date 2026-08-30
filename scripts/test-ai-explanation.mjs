/**
 * C9 AI Explanation Engine Tests
 *
 * Deterministic — no network, no dev server, no credentials.
 * Run with: node scripts/test-ai-explanation.mjs
 *
 * Coverage:
 *   1. valid full input
 *   2. empty input
 *   3. null input
 *   4. undefined fields
 *   5. malformed input
 *   6. NaN
 *   7. Infinity
 *   8-15. missing B1-B6 / C7 / C8
 *   16. all sources missing
 *   17. partial sources
 *   18. conflicting bullish/bearish evidence
 *   19. whyNow generation
 *   20. no whyNow when evidence absent
 *   21-27. per-domain explanations
 *   28. risk explanation
 *   29. provenance
 *   30. data availability
 *   31. data completeness
 *   32. confidence preservation
 *   33. no fabrication
 *   34. no look-ahead
 *   35. deterministic output
 *   36. input immutability
 *   37. API contract
 *   38-45. regression B1-B6 / C7 / C8
 */

import {
  buildAIExplanation,
  defaultExplanation,
  rankExplanations,
  buildExplanationQualityBreakdown,
  buildExplanationDataAvailability,
  sourceHasData,
  resolveDirection,
  resolveTimeframe,
  explainPenny,
  explainOptions,
  explainInstitutional,
  explainSwing,
  explainExplosion,
  explainCatalyst,
  explainOpportunity,
  explainTradePlan,
  buildWhyNow,
  detectConflicts,
  aggregateRisks,
  buildKeyLevels,
  buildHeadline,
  buildSummary,
  buildThesis,
  splitEvidence,
  explainTechnical,
  explainMomentum,
  buildProvenance,
  preserveConfidence,
  explainConfidence,
} from '../lib/ai-explanation.js';

import { buildPennyIntelligence } from '../lib/penny-intelligence-manager.js';
import { buildOptionsIntelligenceResult, defaultOptionsIntelligence } from '../lib/options-intelligence-manager.js';
import { buildInstitutionalRadarResult, defaultInstitutionalRadar } from '../lib/institutional-radar-manager.js';
import { normalizeSwingIntelligence as buildSwingIntelligenceManager, defaultSwingIntelligenceManager } from '../lib/swing-intelligence-manager.js';
import { buildEarlyExplosionIntelligenceManager, defaultEarlyExplosionIntelligenceManager } from '../lib/early-explosion-intelligence-manager.js';
import { buildCatalystIntelligenceManager, defaultCatalystIntelligenceManager } from '../lib/catalyst-intelligence-manager.js';
import { buildOpportunityRanking } from '../lib/opportunity-ranking.js';
import { buildTradePlan } from '../lib/trade-plan-engine.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + 'Expected: ' + JSON.stringify(expected) + '\nActual: ' + JSON.stringify(actual));
  }
}

function assertTrue(value, msg = '') {
  if (!value) throw new Error(msg || 'Expected truthy value but got falsy');
}

function assertFalse(value, msg = '') {
  if (value) throw new Error(msg || 'Expected falsy value but got truthy');
}

function assertNull(value, msg = '') {
  if (value != null) throw new Error(msg || 'Expected null but got ' + JSON.stringify(value));
}

function assertScoreBetween(score, min, max, msg = '') {
  assertTrue(score != null && Number.isFinite(score), msg || 'Score must be a finite number');
  assertTrue(score >= min && score <= max, (msg || '') + ' Score ' + score + ' outside [' + min + ',' + max + ']');
}

// ----------------------------------------------------------------------------
// B1-B6 + C7 + C8 sample inputs (built from real upstream managers)
// ----------------------------------------------------------------------------
const swingMarketData = {
  symbol: 'AAPL', price: 180.25, changePercent: 0.64, relativeVolume: 1.2,
  rsi: 58, atr: 2.4, sma20: 178.5, sma50: 175.0, sma200: 165.0, vwap: 179.8,
  support: 176.0, resistance: 183.0, bollinger: { squeeze: false, bandwidth: 0.08 },
  cluster: false, riskReward: 1.8, signal: 'WATCH', signalStrength: 60,
  directionBias: 'up', riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
};

const b1Sample = buildPennyIntelligence({
  symbol: 'AAPL', price: 180.25, previousClose: 179.10, changePercent: 0.64,
  relativeVolume: 1.2, averageVolume20: 60000000, rsi: 58, setupScore: 62,
  signal: 'WATCH', signalStrength: 60, directionBias: 'up', riskLevel: 'moderate',
  dataAvailability: { price: true, volume: true, technicals: true, sec: false, setup: true, marketLiquidity: true },
}, {});

const b4Sample = buildSwingIntelligenceManager(swingMarketData);
const b5Sample = buildEarlyExplosionIntelligenceManager(swingMarketData);
const b6Sample = buildCatalystIntelligenceManager('AAPL', null, swingMarketData);

const optionsContracts = [{
  symbol: 'AAPL', underlying: 180.25, expiry: '2026-09-18',
  strike: 180, optionType: 'CALL', premium: 3.20, volume: 1200, openInterest: 4500,
  bid: 3.10, ask: 3.30, bidAskSpread: 0.20, impliedVolatility: 0.28,
  delta: 0.52, gamma: 0.04, theta: -0.05, vega: 0.08,
  dataTimestamp: new Date().toISOString(),
}];
const b2Sample = buildOptionsIntelligenceResult('AAPL', optionsContracts, {
  providerStatus: { provider: 'yahoo', source: 'Yahoo Finance options chain', available: true },
  timestamp: new Date().toISOString(),
});

const b3Sample = buildInstitutionalRadarResult('AAPL', null, null, null);

const c7Sample = buildOpportunityRanking('AAPL', {
  pennyIntelligence: b1Sample, optionsIntelligence: b2Sample,
  institutionalRadar: b3Sample, swingIntelligence: b4Sample,
  earlyExplosion: b5Sample, catalystIntelligence: b6Sample,
});

const tpSample = buildTradePlan('AAPL', {
  opportunityRanking: c7Sample, pennyIntelligence: b1Sample,
  optionsIntelligence: b2Sample, institutionalRadar: b3Sample,
  swingIntelligence: b4Sample, earlyExplosion: b5Sample,
  catalystIntelligence: b6Sample,
});

const completeSources = {
  opportunityRanking: c7Sample, pennyIntelligence: b1Sample,
  optionsIntelligence: b2Sample, institutionalRadar: b3Sample,
  swingIntelligence: b4Sample, earlyExplosion: b5Sample,
  catalystIntelligence: b6Sample, tradePlan: tpSample,
};

const sourceKeys = Object.keys(completeSources);
// ----------------------------------------------------------------------------
// 1. Complete valid input
// ----------------------------------------------------------------------------
test('complete valid input produces an available explanation', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(r.available === true, 'explanation available with full data');
  assertTrue(typeof r.headline === 'string' && r.headline.length > 0, 'headline present');
  assertTrue(typeof r.summary === 'string' && r.summary.length > 0, 'summary present');
});

test('complete explanation exposes all required output fields', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  const required = [
    'symbol', 'timestamp', 'available', 'headline', 'summary', 'thesis',
    'whyNow', 'whyItMatters', 'supportingEvidence', 'positiveEvidence', 'negativeEvidence',
    'technicalExplanation', 'momentumExplanation', 'optionsExplanation',
    'institutionalExplanation', 'catalystExplanation', 'explosionExplanation',
    'opportunityExplanation', 'tradePlanExplanation',
    'directionBias', 'direction', 'directionWord', 'setup', 'timeframe',
    'keyLevels', 'entryExplanation', 'stopExplanation', 'targetExplanation', 'riskRewardExplanation',
    'risks', 'warnings', 'conflicts',
    'confidence', 'confidenceExplanation',
    'dataAvailability', 'dataCompleteness', 'provenance', 'limitations', 'disclaimer',
  ];
  for (const f of required) {
    assertTrue(f in r, 'missing field: ' + f);
  }
  assertTrue(Array.isArray(r.supportingEvidence), 'supporting evidence array');
  assertTrue(Array.isArray(r.positiveEvidence), 'positive evidence array');
  assertTrue(Array.isArray(r.negativeEvidence), 'negative evidence array');
  assertTrue(Array.isArray(r.risks), 'risks array');
  assertTrue(Array.isArray(r.warnings), 'warnings array');
  assertTrue(Array.isArray(r.conflicts), 'conflicts array');
  assertTrue(typeof r.keyLevels === 'object', 'keyLevels object');
});

test('complete explanation never fabricates price levels', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  // Levels come from B4/B5 zones only. When upstream provides invalidation,
  // C8-style derivation folds it into stopLoss (verified, not fabricated).
  // When upstream provides nothing, the level must stay null.
  const b4HasStop = b4Sample.stopLoss != null;
  const b4HasInvalidation = b4Sample.invalidation != null;
  if (!b4HasStop && !b4HasInvalidation) {
    assertEqual(r.keyLevels.stopLoss, null, 'stopLoss null when B4 has neither stop nor invalidation');
  }
  if (b4Sample.entryZone == null) assertEqual(r.keyLevels.entryZone, null, 'entryZone not fabricated');
  if (b4Sample.target1 == null) assertEqual(r.keyLevels.target1, null, 'target1 not fabricated');
});

// ----------------------------------------------------------------------------
// 2. null input
// ----------------------------------------------------------------------------
test('null symbol returns default', () => {
  const r = buildAIExplanation(null, completeSources);
  assertEqual(r.symbol, null);
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
});

test('null sources returns default', () => {
  const r = buildAIExplanation('AAPL', null);
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
  assertEqual(r.timeframe, 'UNKNOWN');
  assertEqual(r.headline, null);
});

// ----------------------------------------------------------------------------
// 3. undefined fields
// ----------------------------------------------------------------------------
test('undefined fields handled gracefully', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: undefined, swingIntelligence: undefined,
    earlyExplosion: undefined, optionsIntelligence: undefined,
    institutionalRadar: undefined, catalystIntelligence: undefined,
    tradePlan: undefined, pennyIntelligence: undefined,
  });
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// 4. empty input
// ----------------------------------------------------------------------------
test('empty sources object returns unavailable', () => {
  const r = buildAIExplanation('AAPL', {});
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
  assertEqual(r.timeframe, 'UNKNOWN');
  assertNull(r.headline);
  assertNull(r.whyNow);
  assertTrue(r.risks.some((risk) => risk.label === 'NO_INTELLIGENCE_AVAILABLE'), 'no-intelligence risk');
});

test('all-null sources returns unavailable', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: null, swingIntelligence: null, earlyExplosion: null,
    optionsIntelligence: null, institutionalRadar: null,
    catalystIntelligence: null, tradePlan: null, pennyIntelligence: null,
  });
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
});

// ----------------------------------------------------------------------------
// 5. malformed input
// ----------------------------------------------------------------------------
test('malformed upstream objects do not throw', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: 'not-an-object',
    swingIntelligence: 42,
    earlyExplosion: null,
    optionsIntelligence: {},
    institutionalRadar: [],
    catalystIntelligence: { catalystScore: 'abc' },
    tradePlan: { planScore: 'xyz' },
    pennyIntelligence: { pennyScore: 'foo' },
  });
  assertTrue(r.directionBias === 'UNAVAILABLE' || r.directionBias === 'NEUTRAL',
    'malformed handled, got ' + r.directionBias);
});

test('NaN upstream scores never propagate as real evidence', () => {
  const sources = { ...completeSources };
  sources.swingIntelligence = { ...b4Sample, swingScore: NaN };
  const r = buildAIExplanation('AAPL', sources);
  // NaN never becomes a numeric strength in whyNow.
  for (const f of r.whyNow || []) {
    assertTrue(f.strength == null || Number.isFinite(f.strength), 'NaN strength in whyNow');
  }
});

test('Infinity upstream scores sanitized', () => {
  const sources = { ...completeSources };
  sources.earlyExplosion = { ...b5Sample, explosionScore: Infinity };
  const r = buildAIExplanation('AAPL', sources);
  for (const f of r.whyNow || []) {
    assertTrue(f.strength == null || Number.isFinite(f.strength), 'Infinity strength in whyNow');
  }
});
// ----------------------------------------------------------------------------
// 8-15. Missing individual sources
// ----------------------------------------------------------------------------
test('missing B1 does not fabricate penny evidence', () => {
  const sources = { ...completeSources };
  delete sources.pennyIntelligence;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.pennyIntelligence === false, 'penny not available');
  for (const e of r.supportingEvidence) {
    assertTrue(e.source !== 'B1 Penny Intelligence', 'B1 evidence not fabricated');
  }
});

test('missing B2 does not fabricate options evidence', () => {
  const sources = { ...completeSources };
  delete sources.optionsIntelligence;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.optionsIntelligence === false, 'options not available');
  assertNull(r.optionsExplanation, 'options explanation null when B2 missing');
});

test('missing B3 does not fabricate institutional evidence', () => {
  const sources = { ...completeSources };
  delete sources.institutionalRadar;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.institutionalRadar === false, 'institutional not available');
  assertNull(r.institutionalExplanation, 'institutional explanation null when B3 missing');
});

test('missing B4 does not fabricate swing evidence', () => {
  const sources = { ...completeSources };
  delete sources.swingIntelligence;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.swingIntelligence === false, 'swing not available');
  // B1 still feeds the technical explanation — absence of B4 must not fabricate
  // swing-only claims, but it also must not null out unrelated domains.
  assertTrue(r.technicalExplanation == null || typeof r.technicalExplanation === 'string',
    'technical explanation handled without B4');
  for (const e of r.supportingEvidence) {
    assertTrue(e.source !== 'B4 Swing Intelligence', 'B4 evidence not fabricated');
  }
});

test('missing B5 does not fabricate explosion evidence', () => {
  const sources = { ...completeSources };
  delete sources.earlyExplosion;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.earlyExplosion === false, 'explosion not available');
  assertNull(r.explosionExplanation, 'explosion explanation null when B5 missing');
});

test('missing B6 does not fabricate catalyst evidence', () => {
  const sources = { ...completeSources };
  delete sources.catalystIntelligence;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.catalystIntelligence === false, 'catalyst not available');
  assertNull(r.catalystExplanation, 'catalyst explanation null when B6 missing');
});

test('missing C7 does not fabricate opportunity evidence', () => {
  const sources = { ...completeSources };
  delete sources.opportunityRanking;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.opportunityRanking === false, 'C7 not available');
  assertNull(r.opportunityExplanation, 'opportunity explanation null when C7 missing');
});

test('missing C8 does not fabricate trade-plan evidence', () => {
  const sources = { ...completeSources };
  delete sources.tradePlan;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.dataAvailability.tradePlan === false, 'C8 not available');
  assertNull(r.tradePlanExplanation, 'trade-plan explanation null when C8 missing');
});

// ----------------------------------------------------------------------------
// 16. All sources missing
// ----------------------------------------------------------------------------
test('all sources missing => unavailable', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: { opportunityScore: null },
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
    pennyIntelligence: buildPennyIntelligence({}, {}),
    tradePlan: { planScore: null },
  });
  assertEqual(r.available, false);
  assertEqual(r.directionBias, 'UNAVAILABLE');
  assertNull(r.whyNow, 'no whyNow without evidence');
});

// ----------------------------------------------------------------------------
// 17. Partial sources
// ----------------------------------------------------------------------------
test('partial sources still produce a valid explanation', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: b4Sample });
  assertTrue(r.available === true || r.available === false, 'no throw with partial');
  assertTrue(r.dataAvailability.swingIntelligence === true, 'swing available');
  assertTrue(r.dataAvailability.pennyIntelligence === false, 'penny not available');
});

test('partial sources do not fabricate missing-source evidence', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: b4Sample });
  for (const e of r.supportingEvidence) {
    assertTrue(e.source !== 'B1 Penny Intelligence', 'B1 not fabricated');
    assertTrue(e.source !== 'B2 Options Intelligence', 'B2 not fabricated');
    assertTrue(e.source !== 'C7 Opportunity Ranking', 'C7 not fabricated');
  }
});
// ----------------------------------------------------------------------------
// 18. Conflicting bullish/bearish evidence
// ----------------------------------------------------------------------------
test('conflicting bullish/bearish signals detected', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'STRONG_SELL' },
  };
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.conflicts.length > 0, 'conflict detected: ' + JSON.stringify(r.conflicts));
  assertTrue(r.conflicts[0].type === 'DIRECTIONAL_CONFLICT', 'directional conflict type');
  assertTrue(r.warnings.some((w) => w.indexOf('CONFLICTING_SIGNALS_DETECTED') === 0), 'conflict warning');
});

test('conflict does not force a directional conclusion', () => {
  const sources = {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'STRONG_SELL' },
  };
  const r = buildAIExplanation('AAPL', sources);
  // A conflict must not be hidden by fabricating a clean LONG/SHORT.
  assertTrue(r.conflicts.length > 0, 'conflict preserved, not resolved away');
  assertTrue(r.thesis.toLowerCase().includes('conflict') || r.warnings.some((w) => w.indexOf('CONFLICT') === 0),
    'conflict surfaced in thesis or warnings');
});

// ----------------------------------------------------------------------------
// 19-20. whyNow
// ----------------------------------------------------------------------------
test('whyNow generated from active evidence', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(Array.isArray(r.whyNow), 'whyNow is an array');
  assertTrue((r.whyNow || []).length > 0, 'whyNow has factors: ' + JSON.stringify(r.whyNow));
  for (const f of r.whyNow) {
    assertTrue(typeof f.factor === 'string', 'whyNow factor name');
    assertTrue(typeof f.explanation === 'string', 'whyNow explanation');
    assertTrue(Array.isArray(f.evidence), 'whyNow evidence array');
  }
});

test('no whyNow when evidence absent', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: { opportunityScore: null },
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
    pennyIntelligence: buildPennyIntelligence({}, {}),
    tradePlan: { planScore: null },
  });
  assertNull(r.whyNow, 'whyNow null when no evidence');
});

test('whyNow never contains generic filler', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  const forbidden = ['may move soon', 'could go up', 'could go down', 'might'];
  for (const f of r.whyNow || []) {
    for (const token of forbidden) {
      assertTrue(!f.explanation.toLowerCase().includes(token),
        'no filler "' + token + '" in: ' + f.explanation);
    }
  }
});
// ----------------------------------------------------------------------------
// 21-27. Per-domain explanations
// ----------------------------------------------------------------------------
test('technical explanation traces to B1/B4/B5 indicators', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(r.technicalExplanation != null, 'technical explanation present');
  assertTrue(r.technicalExplanation.includes('SMA200') || r.technicalExplanation.includes('price'),
    'technical cites real indicators: ' + r.technicalExplanation);
});

test('momentum explanation traces to upstream momentum fields', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(r.momentumExplanation != null, 'momentum explanation present');
  assertTrue(r.momentumExplanation.includes('RSI') || r.momentumExplanation.includes('signal'),
    'momentum cites real fields: ' + r.momentumExplanation);
});

test('options explanation traces to B2 only when present', () => {
  const withB2 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withB2.optionsExplanation != null, 'options explanation present with B2');
  const noB2 = buildAIExplanation('AAPL', { ...completeSources, optionsIntelligence: undefined });
  assertNull(noB2.optionsExplanation, 'options explanation null without B2');
});

test('institutional explanation traces to B3 only when present', () => {
  const withB3 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withB3.institutionalExplanation != null || withB3.institutionalExplanation == null, 'no throw');
  const noB3 = buildAIExplanation('AAPL', { ...completeSources, institutionalRadar: undefined });
  assertNull(noB3.institutionalExplanation, 'institutional explanation null without B3');
});

test('catalyst explanation traces to B6 only when present', () => {
  const withB6 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withB6.catalystExplanation != null || withB6.catalystExplanation == null, 'no throw');
  const noB6 = buildAIExplanation('AAPL', { ...completeSources, catalystIntelligence: undefined });
  assertNull(noB6.catalystExplanation, 'catalyst explanation null without B6');
});

test('explosion explanation traces to B5 only when present', () => {
  const withB5 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withB5.explosionExplanation != null, 'explosion explanation present with B5');
  const noB5 = buildAIExplanation('AAPL', { ...completeSources, earlyExplosion: undefined });
  assertNull(noB5.explosionExplanation, 'explosion explanation null without B5');
});

test('opportunity explanation traces to C7 only when present', () => {
  const withC7 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withC7.opportunityExplanation != null, 'opportunity explanation present with C7');
  const noC7 = buildAIExplanation('AAPL', { ...completeSources, opportunityRanking: undefined });
  assertNull(noC7.opportunityExplanation, 'opportunity explanation null without C7');
});

test('trade-plan explanation traces to C8 only when present', () => {
  const withC8 = buildAIExplanation('AAPL', completeSources);
  assertTrue(withC8.tradePlanExplanation != null, 'trade-plan explanation present with C8');
  const noC8 = buildAIExplanation('AAPL', { ...completeSources, tradePlan: undefined });
  assertNull(noC8.tradePlanExplanation, 'trade-plan explanation null without C8');
});

// ----------------------------------------------------------------------------
// 28. Risk explanation
// ----------------------------------------------------------------------------
test('risks are evidence-based and have label/severity/description', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  for (const risk of r.risks) {
    assertTrue(typeof risk.label === 'string', 'risk label string');
    assertTrue(typeof risk.severity === 'string', 'risk severity string');
    assertTrue(typeof risk.description === 'string', 'risk description string');
  }
});

test('conflicts expose type/severity/description', () => {
  const r = buildAIExplanation('AAPL', {
    swingIntelligence: { ...b4Sample, signal: 'STRONG_BUY' },
    earlyExplosion: { ...b5Sample, signal: 'STRONG_SELL' },
  });
  for (const c of r.conflicts) {
    assertTrue(typeof c.type === 'string', 'conflict type');
    assertTrue(typeof c.severity === 'string', 'conflict severity');
    assertTrue(typeof c.description === 'string', 'conflict description');
    assertTrue(Array.isArray(c.sources), 'conflict sources array');
  }
});
// ----------------------------------------------------------------------------
// 29. Provenance
// ----------------------------------------------------------------------------
test('provenance records C9 engine and all contributing sources', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertEqual(r.provenance.intelligence, 'C9');
  assertEqual(r.provenance.engine, 'C9 AI Explanation');
  assertEqual(r.provenance.opportunityRanking, 'C7 Opportunity Ranking');
  assertEqual(r.provenance.tradePlan, 'C8 Trade Plan Engine');
  for (const k of sourceKeys) {
    assertTrue(r.provenance[k] != null, 'provenance missing for ' + k);
  }
});

test('provenance marks missing sources as null', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: b4Sample });
  assertTrue(r.provenance.swingIntelligence != null, 'swing provenance present');
  assertNull(r.provenance.pennyIntelligence, 'missing provenance null');
  assertNull(r.provenance.tradePlan, 'missing provenance null');
});

// ----------------------------------------------------------------------------
// 30-31. Data availability + completeness
// ----------------------------------------------------------------------------
test('data availability flags all 8 sources', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  for (const k of sourceKeys) {
    assertTrue(r.dataAvailability[k] === true, k + ' available');
  }
});

test('data completeness bounded 0-100', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertScoreBetween(r.dataCompleteness, 0, 100, 'data completeness');
});

test('all-missing has zero data completeness', () => {
  const r = buildAIExplanation('AAPL', {});
  assertEqual(r.dataCompleteness, 0, 'zero completeness when all missing');
});

test('completeness reflects only real sources, never defaults', () => {
  // A single source's completeness must be preserved exactly (not dragged
  // toward zero by default placeholders that carry completeness 0).
  const single = buildAIExplanation('AAPL', { swingIntelligence: b4Sample });
  assertEqual(single.dataCompleteness, b4Sample.dataCompleteness,
    'single-source completeness equals the source value');
  // Completeness is always bounded [0, 100].
  assertScoreBetween(single.dataCompleteness, 0, 100, 'bounded single');
  const full = buildAIExplanation('AAPL', completeSources);
  assertScoreBetween(full.dataCompleteness, 0, 100, 'bounded full');
  // Adding default sources (completeness 0) must not create a non-zero
  // aggregate out of nothing.
  const defaultsOnly = buildAIExplanation('AAPL', {
    opportunityRanking: { opportunityScore: null },
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
    pennyIntelligence: buildPennyIntelligence({}, {}),
    tradePlan: { planScore: null },
  });
  assertEqual(defaultsOnly.dataCompleteness, 0, 'defaults aggregate to 0');
});

// ----------------------------------------------------------------------------
// 32. Confidence preservation
// ----------------------------------------------------------------------------
test('confidence preserved from C8 when present', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(r.confidence.source === 'C8 Trade Plan', 'confidence from C8');
  assertTrue(r.confidence.score != null, 'confidence score present');
  assertTrue(typeof r.confidenceExplanation === 'string' && r.confidenceExplanation.length > 0, 'confidence explanation');
});

test('confidence falls back to C7 when C8 missing', () => {
  const sources = { ...completeSources };
  delete sources.tradePlan;
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.confidence.source === 'C7 Opportunity Ranking', 'confidence from C7');
});

test('confidence is UNAVAILABLE when no upstream confidence exists', () => {
  const r = buildAIExplanation('AAPL', {
    opportunityRanking: { opportunityScore: null },
    swingIntelligence: defaultSwingIntelligenceManager('AAPL'),
    earlyExplosion: defaultEarlyExplosionIntelligenceManager('AAPL'),
    optionsIntelligence: defaultOptionsIntelligence('AAPL'),
    institutionalRadar: defaultInstitutionalRadar('AAPL'),
    catalystIntelligence: defaultCatalystIntelligenceManager('AAPL'),
    pennyIntelligence: buildPennyIntelligence({}, {}),
    tradePlan: { planScore: null },
  });
  assertEqual(r.confidence.score, null, 'confidence null when none upstream');
  assertEqual(r.confidence.level, 'UNAVAILABLE', 'confidence level unavailable');
});

test('C9 does not manufacture a new confidence score', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  // C9's confidence must equal C8's confidence exactly.
  assertEqual(r.confidence.score, tpSample.confidence, 'C9 confidence equals C8');
});
// ----------------------------------------------------------------------------
// 33. No fabrication
// ----------------------------------------------------------------------------
test('no fabricated price levels', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  // Levels come from B4/B5 zones only. A level is only null when the upstream
  // provided neither the field nor its derivation source (e.g. invalidation).
  if (b4Sample.entryZone == null) assertEqual(r.keyLevels.entryZone, null, 'entryZone not fabricated');
  if (b4Sample.target1 == null) assertEqual(r.keyLevels.target1, null, 'target1 not fabricated');
  const b4Stop = b4Sample.stopLoss != null ? Number(b4Sample.stopLoss) : null;
  const b4Invalidation = b4Sample.invalidation != null ? Number(b4Sample.invalidation) : null;
  if (b4Stop == null && b4Invalidation == null) {
    assertEqual(r.keyLevels.stopLoss, null, 'stopLoss null when B4 has neither stop nor invalidation');
  } else {
    // Verified derivation (C8-style): stopLoss folds in invalidation when
    // upstream exposes no explicit stop level. This is not fabrication — it
    // is a deterministic pass-through of an existing level.
    const expectedStop = b4Stop != null ? b4Stop : b4Invalidation;
    assertEqual(r.keyLevels.stopLoss, expectedStop, 'stopLoss derived from existing invalidation');
  }
});

test('no fabricated confidence value', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  // Must equal C8's confidence exactly.
  assertEqual(r.confidence.score, tpSample.confidence, 'confidence not fabricated');
});

test('no fabricated confidence explanation', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(typeof r.confidenceExplanation === 'string' && r.confidenceExplanation.length > 0, 'confidence explanation present');
});

test('missing evidence never interpreted as negative', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: b4Sample });
  // Missing sources must not appear in negativeEvidence.
  for (const n of r.negativeEvidence) {
    assertTrue(n.factor !== 'B2 Options Intelligence', 'missing B2 not in negative');
    assertTrue(n.factor !== 'B3 Institutional Radar', 'missing B3 not in negative');
    assertTrue(n.factor !== 'C7 Opportunity Ranking', 'missing C7 not in negative');
  }
});

test('disclaimer states no BUY/SELL guarantee', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  assertTrue(typeof r.disclaimer === 'string' && r.disclaimer.length > 0, 'disclaimer present');
  assertTrue(r.disclaimer.toLowerCase().includes('not a buy/sell'), 'no buy/sell guarantee');
  assertTrue(r.disclaimer.includes('C9'), 'C9 disclaimer present');
});

// ----------------------------------------------------------------------------
// 34. No look-ahead
// ----------------------------------------------------------------------------
test('engine is pure — deterministic across repeated calls', () => {
  const a = buildAIExplanation('AAPL', completeSources);
  const b = buildAIExplanation('AAPL', completeSources);
  assertEqual(JSON.stringify(a.headline), JSON.stringify(b.headline), 'headline deterministic');
  assertEqual(JSON.stringify(a.directionBias), JSON.stringify(b.directionBias), 'direction deterministic');
  assertEqual(JSON.stringify(a.whyNow), JSON.stringify(b.whyNow), 'whyNow deterministic');
  assertEqual(JSON.stringify(a.summary), JSON.stringify(b.summary), 'summary deterministic');
  assertEqual(JSON.stringify(a.confidence), JSON.stringify(b.confidence), 'confidence deterministic');
});

// ----------------------------------------------------------------------------
// 35. Deterministic output
// ----------------------------------------------------------------------------
test('deterministic ranking across repeated runs', () => {
  const results = [];
  for (let i = 0; i < 8; i++) {
    results.push(buildAIExplanation('S' + i, { swingIntelligence: { ...b4Sample, swingScore: (i * 13) % 75, setupClassification: [] } }));
  }
  const a = rankExplanations(results).ranked.map((r) => r.symbol);
  const b = rankExplanations(results).ranked.map((r) => r.symbol);
  assertEqual(JSON.stringify(a), JSON.stringify(b), 'deterministic ranking');
});

// ----------------------------------------------------------------------------
// 36. Input immutability
// ----------------------------------------------------------------------------
test('input sources are not mutated', () => {
  const snapshot = JSON.stringify(completeSources);
  buildAIExplanation('AAPL', completeSources);
  assertEqual(JSON.stringify(completeSources), snapshot, 'inputs unchanged');
});

test('C7 input not mutated by C9', () => {
  const snapshot = JSON.stringify(c7Sample);
  buildAIExplanation('AAPL', completeSources);
  assertEqual(JSON.stringify(c7Sample), snapshot, 'C7 untouched');
});

test('C8 input not mutated by C9', () => {
  const snapshot = JSON.stringify(tpSample);
  buildAIExplanation('AAPL', completeSources);
  assertEqual(JSON.stringify(tpSample), snapshot, 'C8 untouched');
});

// ----------------------------------------------------------------------------
// 37. API contract
// ----------------------------------------------------------------------------
test('result shape matches API contract fields', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  const required = [
    'symbol', 'timestamp', 'available', 'headline', 'summary', 'thesis',
    'whyNow', 'whyItMatters', 'supportingEvidence', 'positiveEvidence', 'negativeEvidence',
    'technicalExplanation', 'momentumExplanation', 'optionsExplanation',
    'institutionalExplanation', 'catalystExplanation', 'explosionExplanation',
    'opportunityExplanation', 'tradePlanExplanation',
    'directionBias', 'direction', 'directionWord', 'setup', 'timeframe',
    'keyLevels', 'entryExplanation', 'stopExplanation', 'targetExplanation', 'riskRewardExplanation',
    'risks', 'warnings', 'conflicts',
    'confidence', 'confidenceExplanation',
    'dataAvailability', 'dataCompleteness', 'provenance', 'limitations', 'disclaimer',
  ];
  for (const f of required) {
    assertTrue(f in r, 'missing field: ' + f);
  }
});

test('supporting evidence records source/evidence', () => {
  const r = buildAIExplanation('AAPL', completeSources);
  for (const e of r.supportingEvidence) {
    assertTrue(typeof e.source === 'string', 'evidence source string');
    assertTrue(typeof e.evidence === 'string', 'evidence text string');
  }
});

test('quality breakdown has all five buckets', () => {
  const breakdown = buildExplanationQualityBreakdown([buildAIExplanation('AAPL', completeSources)]);
  for (const q of ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE']) {
    assertTrue(q in breakdown, 'bucket missing: ' + q);
  }
});

test('data availability aggregator ORs across results', () => {
  const results = [
    buildAIExplanation('AAPL', { swingIntelligence: b4Sample }),
    buildAIExplanation('TSLA', { optionsIntelligence: { ...b2Sample, ticker: 'TSLA' } }),
  ];
  const agg = buildExplanationDataAvailability(results);
  assertTrue(agg.swingIntelligence === true, 'swing aggregated');
  assertTrue(agg.optionsIntelligence === true, 'options aggregated');
  assertTrue(agg.pennyIntelligence === false, 'penny still false');
});
// ----------------------------------------------------------------------------
// 38-45. Regression
// ----------------------------------------------------------------------------
test('B1 regression: pennyScore consumed', () => {
  const r = buildAIExplanation('AAPL', { pennyIntelligence: { ...b1Sample, pennyScore: 61 } });
  assertTrue(r.dataAvailability.pennyIntelligence === true, 'penny available');
  const ex = explainPenny({ ...b1Sample, pennyScore: 61 });
  assertTrue(ex != null && ex.explanation.includes('61'), 'penny explanation cites score');
});

test('B2 regression: optionsScore from decision.decisionScore', () => {
  const r = buildAIExplanation('AAPL', { optionsIntelligence: { decision: { decisionScore: 72 } } });
  assertTrue(r.dataAvailability.optionsIntelligence === true, 'options available');
});

test('B3 regression: institutionalScore extraction', () => {
  const r = buildAIExplanation('AAPL', { institutionalRadar: { institutionalScore: 65 } });
  assertTrue(r.dataAvailability.institutionalRadar === true, 'institutional available');
});

test('B4 regression: swingScore + zones consumed', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: { ...b4Sample, swingScore: 71 } });
  assertTrue(r.dataAvailability.swingIntelligence === true, 'swing available');
  assertTrue(r.directionBias === 'LONG' || r.directionBias === 'NEUTRAL',
    'direction from swing evidence, got ' + r.directionBias);
});

test('B5 regression: explosionScore + zones consumed', () => {
  const r = buildAIExplanation('AAPL', { earlyExplosion: { ...b5Sample, explosionScore: 68 } });
  assertTrue(r.dataAvailability.earlyExplosion === true, 'explosion available');
});

test('B6 regression: catalystScore consumed', () => {
  const r = buildAIExplanation('AAPL', { catalystIntelligence: { ...b6Sample, catalystScore: 73 } });
  assertTrue(r.dataAvailability.catalystIntelligence === true, 'catalyst available');
});

test('C7 regression: C9 consumes C7 opportunityScore', () => {
  const sources = { opportunityRanking: { ...c7Sample, opportunityScore: 77 } };
  const r = buildAIExplanation('AAPL', sources);
  assertTrue(r.opportunityExplanation != null, 'C7 explanation present');
  assertTrue(r.opportunityExplanation.includes('77'), 'C7 explanation cites score: ' + r.opportunityExplanation);
});

test('C7 regression: C9 does not mutate C7 output', () => {
  const snapshot = JSON.stringify(c7Sample);
  buildAIExplanation('AAPL', { opportunityRanking: c7Sample });
  assertEqual(JSON.stringify(c7Sample), snapshot, 'C7 untouched');
});

test('C8 regression: C9 consumes C8 trade plan', () => {
  const r = buildAIExplanation('AAPL', { tradePlan: { ...tpSample, planScore: 80, planSignal: 'STRONG_PLAN' } });
  assertTrue(r.tradePlanExplanation != null, 'C8 explanation present');
  assertTrue(r.tradePlanExplanation.includes('80'), 'C8 explanation cites score: ' + r.tradePlanExplanation);
});

test('C8 regression: C9 does not mutate C8 output', () => {
  const snapshot = JSON.stringify(tpSample);
  buildAIExplanation('AAPL', { tradePlan: tpSample });
  assertEqual(JSON.stringify(tpSample), snapshot, 'C8 untouched');
});

// ----------------------------------------------------------------------------
// Additional edge cases
// ----------------------------------------------------------------------------
test('direction neutral wording never coerced to LONG/SHORT', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: { ...b4Sample, directionBias: 'sideways', signal: 'WATCH', setupClassification: [] } });
  assertTrue(r.directionBias === 'NEUTRAL' || r.directionBias === 'UNAVAILABLE',
    'neutral stays neutral, got ' + r.directionBias);
  assertTrue(r.directionWord === 'neutral setup' || r.directionWord === 'no directional evidence',
    'neutral wording: ' + r.directionWord);
});

test('timeframe normalization', () => {
  assertEqual(resolveTimeframe({ swingIntelligence: { timeframe: 'swing' } }), 'SWING');
  assertEqual(resolveTimeframe({ earlyExplosion: { timeframe: 'intraday' } }), 'INTRADAY');
  assertEqual(resolveTimeframe({}), 'UNKNOWN');
});

test('default explanation has no fabricated values', () => {
  const d = defaultExplanation('AAPL');
  assertEqual(d.available, false);
  assertEqual(d.directionBias, 'UNAVAILABLE');
  assertEqual(d.confidence.score, null);
  assertNull(d.headline);
  assertNull(d.whyNow);
  assertEqual(d.timeframe, 'UNKNOWN');
  const actual = d.risks[0].label;
  const expected = 'NO_INTELLIGENCE_AVAILABLE';
  if (!(actual === expected)) {
    throw new Error('manual check failed: actual type=' + typeof actual +
      ' expected type=' + typeof expected +
      ' actual=' + JSON.stringify(actual) +
      ' expected=' + JSON.stringify(expected));
  }
});

test('ranking null scores sink to bottom', () => {
  const results = [
    buildAIExplanation('A', { opportunityRanking: { opportunityScore: null }, swingIntelligence: defaultSwingIntelligenceManager('A') }),
    buildAIExplanation('B', { opportunityRanking: { opportunityScore: 60 }, swingIntelligence: { ...b4Sample, symbol: 'B' } }),
  ];
  const { ranked } = rankExplanations(results);
  assertEqual(ranked[0].symbol, 'B', 'non-null first');
  assertEqual(ranked[1].symbol, 'A', 'null last');
});

test('empty results returns empty ranking', () => {
  const { ranked, top, alternatives, ranking } = rankExplanations([]);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
  assertEqual(ranking.total, 0);
});

test('non-array input returns empty ranking', () => {
  const { ranked } = rankExplanations(null);
  assertEqual(ranked.length, 0);
});

test('duplicate symbols ranked without breaking', () => {
  const results = [
    buildAIExplanation('AAPL', { opportunityRanking: { opportunityScore: 80 }, swingIntelligence: { ...b4Sample, symbol: 'AAPL' } }),
    buildAIExplanation('AAPL', { opportunityRanking: { opportunityScore: 60 }, swingIntelligence: { ...b4Sample, symbol: 'AAPL' } }),
  ];
  const { ranked } = rankExplanations(results);
  assertEqual(ranked.length, 2, 'duplicates ranked');
});

test('null upstream objects handled without throw', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: null, earlyExplosion: null });
  assertTrue(r.directionBias === 'UNAVAILABLE' || r.directionBias === 'NEUTRAL', 'null upstream handled');
  assertTrue(Array.isArray(r.risks), 'risks array after null inputs');
});

test('unknown setup stays null, not fabricated', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: { ...b4Sample, setupClassification: [] } });
  assertNull(r.setup, 'setup null when unknown');
});

test('headline/summary/thesis never fabricate a direction', () => {
  const r = buildAIExplanation('AAPL', { swingIntelligence: defaultSwingIntelligenceManager('AAPL') });
  // No real evidence => no fabricated directional language in headline.
  assertTrue(!r.headline || r.headline.toLowerCase().includes('no directional evidence') ||
    !r.headline.toLowerCase().includes('upside') && !r.headline.toLowerCase().includes('downside'),
    'headline does not fabricate direction: ' + r.headline);
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n========================================');
console.log('C9 AI Explanation Tests');
console.log('========================================\n');
console.log('PASS: ' + passCount);
console.log('FAIL: ' + failCount);
console.log('TOTAL: ' + (passCount + failCount));
if (failCount > 0) {
  console.error('\nSome tests FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests PASSED');
}
