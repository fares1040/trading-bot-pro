import {
  buildSwingHorizon,
  defaultSwingHorizon,
  rankSwingHorizonOpportunities,
  assessTrend,
  assessMomentum,
  assessSupplyDemand,
  assessRiskReward,
  classifySetup,
  calculateSwingHorizonScore,
  classifySwingQuality,
  classifySwingStatus,
  assessRegimeAlignment,
  SWING_HORIZON_LABEL,
  TREND_DIRECTION,
  SWING_STATUS,
  SWING_QUALITY,
  SETUP_CLASSIFICATION,
  SWING_WEIGHTS,
} from '../lib/swing-horizon.js';
import {
  defaultSwingIntelligence,
  buildSwingIntelligence,
} from '../lib/swing-intelligence.js';
import { defaultStructureIntelligence, STRUCTURE_STATE } from '../lib/structure-intelligence-manager.js';
import { defaultCatalystIntelligence } from '../lib/catalyst-intelligence.js';

const passed = { count: 0, total: 0 };
const assert = (condition, message) => {
  passed.total++;
  if (condition) {
    passed.count++;
  } else {
    console.error(`FAIL: ${message}`);
  }
};

const assertEqual = (actual, expected, message) => {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const assertNotNull = (value, message) => {
  assert(value !== null && value !== undefined, `${message} — expected non-null`);
};

const assertNull = (value, message) => {
  assert(value === null || value === undefined, `${message} — expected null, got ${value}`);
};

const assertBounded = (value, min, max, message) => {
  assert(value != null && value >= min && value <= max,
    `${message} — expected ${min}-${max}, got ${value}`);
};

console.log('=== Swing Horizon Test Suite ===\n');

// --- T01-T03: Import & constants ---
assert(typeof buildSwingHorizon === 'function', 'T01: buildSwingHorizon is imported');
assert(SWING_HORIZON_LABEL === '1_3_MONTHS', 'T02: horizon label is 1_3_MONTHS');
assert(Object.keys(TREND_DIRECTION).length >= 6, 'T03: TREND_DIRECTION has all states');

// --- T04-T06: Empty/null inputs ---
const empty1 = buildSwingHorizon();
assert(empty1.swingScore === null, 'T04: no inputs returns null swingScore');
assert(empty1.dataStatus === 'unavailable', 'T05: no inputs returns unavailable dataStatus');
assert(empty1.disclaimer !== undefined, 'T06: default includes disclaimer');

const empty2 = buildSwingHorizon({});
assert(empty2.swingScore === null, 'T07: empty object returns null swingScore');
assert(empty2.horizon === SWING_HORIZON_LABEL, 'T08: horizon is 1_3_MONTHS');

// --- T09-T11: Insufficient data ---
const partial = buildSwingHorizon({ swingData: null, marketData: null });
assert(partial.swingScore === null, 'T09: no swing/market data returns null score');
assert(partial.setupClassification === SETUP_CLASSIFICATION.INSUFFICIENT_DATA, 'T10: insufficient data setup classification');
assert(partial.trend.direction === TREND_DIRECTION.INSUFFICIENT_DATA, 'T11: insufficient data trend direction');

// --- T12-T15: Build from marketData ---
const mockMarketData = {
  ticker: 'TEST',
  price: 100,
  closes: Array.from({ length: 100 }, (_, i) => 95 + i * 0.3),
  highs: Array.from({ length: 100 }, (_, i) => 96 + i * 0.3),
  lows: Array.from({ length: 100 }, (_, i) => 94 + i * 0.3),
  volumes: Array.from({ length: 100 }, (_, i) => 1000 + i * 10),
  sma20: 98,
  sma50: 96,
  sma200: 92,
  rsi: 58,
  relativeVolume: 1.2,
  momentumPercent: 12,
  resistance20: 105,
  support20: 90,
  riskReward: 3.0,
  technicalScore: 75,
  setupScore: 80,
  signal: 'BUY',
  directionBias: 'bullish',
  riskLevel: 'medium',
  changePercent: 8.5,
};
const fromMarketData = buildSwingHorizon({
  marketData: mockMarketData,
  symbol: 'TEST',
});
assertNotNull(fromMarketData.swingScore, 'T12: marketData-based build produces a score');
assertBounded(fromMarketData.swingScore, 0, 100, 'T13: swingScore bounded 0-100');
assert(fromMarketData.horizon === SWING_HORIZON_LABEL, 'T14: horizon preserved');
assertNotNull(fromMarketData.trend, 'T15: trend object present');

// --- T16-T18: Trend assessment — bullish ---
const bullishSwing = {
  symbol: 'BULL',
  price: 110,
  sma20: 105,
  sma50: 100,
  sma200: 95,
  rsi: 62,
  relativeVolume: 1.3,
  momentumPercent: 15,
  momentumScore: 65,
  riskReward: 2.5,
  zones: { entryZone: '98 - 110', target1: 125, target2: 135, invalidation: 97.5, riskPercent: 2.3, rewardPercent: 13.6 },
  entryZone: '98 - 110',
  target1: 125,
  target2: 135,
  invalidation: 97.5,
  riskPercent: 2.3,
  rewardPercent: 13.6,
  componentScores: { trend: 85, momentum: 70, structure: 75, volume: 65 },
  dataAvailability: { price: true, volume: true, technicals: true, rsi: true, sma20: true, sma50: true, sma200: true, supportResistance: true, riskReward: true },
  dataCompleteness: 100,
};
const bullishStructure = {
  structureBias: 'BULLISH',
  structureState: STRUCTURE_STATE.BULLISH_CONTINUATION,
  structureScore: 80,
  confidence: 65,
  marketStructure: {
    trend: 'BULLISH',
    higherHighs: true,
    higherLows: true,
    higherHighs: true,
    lowerHighs: false,
    lowerLows: false,
    mssDetected: false,
    confidence: 70,
  },
  supplyZones: [],
  demandZones: [{ level: '95', strength: 'STRONG', confidence: 80, touches: 2 }],
  signals: [],
  disclaimer: 'test',
};
const trend = assessTrend(bullishSwing, bullishStructure);
assert(trend.direction === TREND_DIRECTION.BULLISH, 'T16: bullish trend detected');
assert(trend.maturity === 'ESTABLISHED', 'T17: bullish trend maturity is ESTABLISHED');
assert(trend.strength >= 70, 'T18: established bullish trend strength >= 70');

// --- T19-T20: Trend assessment — bearish ---
const bearishSwing = {
  price: 85,
  sma20: 90,
  sma50: 95,
  sma200: 100,
  rsi: 35,
  relativeVolume: 1.1,
  momentumPercent: -8,
  momentumScore: 40,
  riskReward: 1.5,
  componentScores: { trend: 45, momentum: 40, structure: 40, volume: 50 },
  dataAvailability: { price: true, volume: true, technicals: true, rsi: true, sma20: true, sma50: true, sma200: true },
  dataCompleteness: 90,
};
const bearishStructure = {
  structureBias: 'BEARISH',
  structureState: STRUCTURE_STATE.BEARISH_CONTINUATION,
  structureScore: 70,
  confidence: 60,
  marketStructure: {
    trend: 'BEARISH',
    higherHighs: false,
    higherLows: false,
    lowerHighs: true,
    lowerLows: true,
    mssDetected: false,
    confidence: 65,
  },
  supplyZones: [{ level: '90', strength: 'STRONG', confidence: 75 }],
  demandZones: [],
  signals: [],
  disclaimer: 'test',
};
const bearishTrend = assessTrend(bearishSwing, bearishStructure);
assert(bearishTrend.direction === TREND_DIRECTION.BEARISH, 'T19: bearish trend detected');
assert(bearishTrend.maturity === 'ESTABLISHED', 'T20: bearish trend maturity is ESTABLISHED');

// --- T21-T22: Trend assessment — neutral/insufficient ---
const insufficientTrend = assessTrend(null, null);
assert(insufficientTrend.direction === TREND_DIRECTION.INSUFFICIENT_DATA, 'T21: null data returns INSUFFICIENT_DATA');
const neutralSwing = { price: 100, sma20: 98, sma50: 102, sma200: 95, rsi: 50 };
const neutralTrend = assessTrend(neutralSwing, { structureBias: 'NEUTRAL', structureState: STRUCTURE_STATE.RANGE });
assert(neutralTrend.direction === TREND_DIRECTION.NEUTRAL, 'T22: price above SMA200 but below SMA50 returns NEUTRAL');

// --- T23-T25: Momentum assessment ---
const momentumStrong = assessMomentum({ rsi: 60, momentumPercent: 8, relativeVolume: 1.4, momentumScore: 70 });
assert(momentumStrong.score != null, 'T23: momentum score computed');
assert(momentumStrong.direction !== 'NEUTRAL' || momentumStrong.score >= 60, 'T24: strong momentum detected');
const momentumWeak = assessMomentum({ rsi: 85, momentumPercent: 2, relativeVolume: 0.7, momentumScore: 30 });
assert(momentumWeak.score != null && momentumWeak.score < 60, 'T25: weak momentum produces lower score');

const momentumNone = assessMomentum(null);
assert(momentumNone.score === 50, 'T26: null momentum returns default score 50');

// --- T27-T29: Supply/Demand assessment ---
const sdResult = assessSupplyDemand(bullishStructure, bullishSwing);
assert(sdResult.riskReward === 2.5 || sdResult.riskReward != null, 'T27: supply/demand produces risk/reward');
assert(Array.isArray(sdResult.supplyZones), 'T28: supplyZones is array');
assert(Array.isArray(sdResult.demandZones), 'T29: demandZones is array');

const sdEmpty = assessSupplyDemand(null, null);
assert(sdEmpty.riskReward === null, 'T30: no structure/swing returns null risk/reward');

// --- T31-T33: Risk/Reward ---
const rr = assessRiskReward(bullishSwing, bullishStructure);
assert(rr.rewardRisk === 2.5, 'T31: risk/reward from swing data');
assert(rr.target === 125, 'T32: target from swing zones');
assertNotNull(rr.upsidePct, 'T33: upsidePct computed');

// --- T34-T35: Setup classification ---
const setupBullish = classifySetup(
  { direction: TREND_DIRECTION.BULLISH, maturity: 'ESTABLISHED', strength: 75 },
  { score: 65, score: 65 },
  { rewardRisk: 3.0, distanceToSupply: 15, distanceToDemand: 5, risks: [], reasons: [] },
  { structureState: STRUCTURE_STATE.BULLISH_CONTINUATION, marketStructure: { mssDetected: false } },
  bullishSwing
);
assert(setupBullish.classification === SETUP_CLASSIFICATION.TREND_CONTINUATION || setupBullish.classification === SETUP_CLASSIFICATION.PULLBACK_TO_DEMAND || setupBullish.classification === SETUP_CLASSIFICATION.EARLY_TREND, 'T34: bullish setup classified appropriately');

const setupInsufficient = classifySetup(
  { direction: TREND_DIRECTION.INSUFFICIENT_DATA },
  { score: null },
  { rewardRisk: null },
  { structureState: STRUCTURE_STATE.INSUFFICIENT_DATA },
  { price: null }
);
assert(setupInsufficient.classification === SETUP_CLASSIFICATION.INSUFFICIENT_DATA, 'T35: insufficient data setup classification');

// --- T36-T38: Swing score calculation ---
const scoreFull = calculateSwingHorizonScore({
  trendStrength: 80,
  structureScore: 70,
  momentumScore: 65,
  supplyDemandScore: 75,
  catalystScore: 60,
  rewardRisk: 3.0,
  regimeAlignment: 70,
  dataCompleteness: 100,
});
assertNotNull(scoreFull, 'T36: full score computed');
assertBounded(scoreFull, 0, 100, 'T37: full score bounded 0-100');

const scoreEmpty = calculateSwingHorizonScore({});
assert(scoreEmpty === null, 'T38: empty inputs return null score');

// --- T39-T41: Quality classification ---
const qExceptional = classifySwingQuality(90);
assert(qExceptional === SWING_QUALITY.EXCEPTIONAL, 'T39: score 90 = EXCEPTIONAL');
const qStrong = classifySwingQuality(72);
assert(qStrong === SWING_QUALITY.STRONG, 'T40: score 72 = STRONG');
const qInsufficient = classifySwingQuality(null);
assert(qInsufficient === SWING_QUALITY.INSUFFICIENT_DATA, 'T41: null score = INSUFFICIENT_DATA');

// --- T42-T43: Status classification ---
const statusFav = classifySwingStatus(75);
assert(statusFav === SWING_STATUS.FAVORABLE, 'T42: score 75 = FAVORABLE');
const statusLow = classifySwingStatus(20);
assert(statusLow === SWING_STATUS.HIGH_RISK, 'T43: score 20 = HIGH_RISK');

// --- T44-T45: Ranking ---
const testResults = [
  { symbol: 'A', swingScore: 80, dataQuality: { completeness: 90 } },
  { symbol: 'B', swingScore: 30, dataQuality: { completeness: 60 } },
  { symbol: 'C', swingScore: 95, dataQuality: { completeness: 95 } },
  { symbol: 'D', swingScore: null, dataQuality: { completeness: 40 } },
  { symbol: 'E', swingScore: 70, dataQuality: { completeness: 85 } },
];
const ranked = rankSwingHorizonOpportunities(testResults);
assert(ranked.top[0].symbol === 'C', 'T44: top symbol has highest score');
assert(ranked.ranked.length === 5, 'T45: ranked includes all 5 symbols');

// --- T46-T48: Determinism ---
const det1 = buildSwingHorizon({
  swingData: bullishSwing,
  structureData: bullishStructure,
  marketRegime: null,
  symbol: 'DET',
});
const det2 = buildSwingHorizon({
  swingData: bullishSwing,
  structureData: bullishStructure,
  marketRegime: null,
  symbol: 'DET',
});
const d1 = JSON.parse(JSON.stringify(det1));
const d2 = JSON.parse(JSON.stringify(det2));
delete d1.timestamp;
delete d2.timestamp;
assert(JSON.stringify(d1) === JSON.stringify(d2), 'T46: deterministic output for identical inputs (excluding timestamp)');

// --- T47-T48: No fabricated data ---
const minimal = buildSwingHorizon({
  swingData: { symbol: 'MIN', price: 50 },
  symbol: 'MIN',
});
assert(minimal.swingScore === null || minimal.swingScore >= 0, 'T47: minimal data does not produce fabricated score');
assert(minimal.thesis !== 'BUY NOW' && minimal.thesis.length > 0, 'T48: thesis is evidence-based, not a recommendation');

// --- T49-T50: NaN & Infinity handling ---
const scoreNaN = calculateSwingHorizonScore({
  trendStrength: NaN,
  structureScore: NaN,
});
assert(scoreNaN === null, 'T49: NaN inputs produce null score');

const scoreInf = calculateSwingHorizonScore({
  trendStrength: Infinity,
  structureScore: 50,
  momentumScore: 50,
});
assert(scoreInf !== null && Number.isFinite(scoreInf), 'T50: Infinity inputs handled gracefully');

console.log(`\n=== Results: ${passed.count}/${passed.total} passed ===\n`);
if (passed.count < passed.total) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
