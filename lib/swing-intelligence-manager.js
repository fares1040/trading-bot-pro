/**
 * Swing Intelligence Manager (B4)
 *
 * Orchestration layer that wraps A4 (lib/swing-intelligence.js) into a
 * production-ready Swing Intelligence Manager with:
 *   - Provenance tracking
 *   - Unified output contract
 *   - Default handling
 *   - B4-specific ranking
 *   - Data quality aggregation
 *
 * Pure function module — no network calls in the manager itself.
 * No BUY/SELL guarantees. Missing data remains null. Never fabricated.
 *
 * Composes:
 *   A4  — Swing Intelligence Core (lib/swing-intelligence.js)
 */

import {
  buildSwingIntelligence,
  defaultSwingIntelligence,
  rankSwingOpportunities,
  SWING_WEIGHTS,
  SWING_QUALITY_THRESHOLDS,
} from './swing-intelligence.js';

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function nowISO() {
  return new Date().toISOString();
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function normalizeSwingIntelligence(marketData, opts = {}) {
  const symbol = marketData?.ticker || marketData?.symbol || null;
  const a4_result = buildSwingIntelligence(marketData || null);

  if (!a4_result || a4_result.quality === 'UNAVAILABLE') {
    const result = defaultSwingIntelligenceManager(symbol);
    if (a4_result && a4_result !== defaultSwingIntelligence()) {
      result.intelligence = a4_result;
    }
    return result;
  }

  const dataAvailability = a4_result.dataAvailability || {};
  const availableCount = Object.values(dataAvailability).filter(Boolean).length;
  const totalCount = Object.keys(dataAvailability).length;
  const dataCompleteness =
    a4_result.dataCompleteness != null
      ? a4_result.dataCompleteness
      : totalCount > 0
      ? Math.round((availableCount / totalCount) * 100)
      : 0;

  const swingScore = a4_result.swingScore;
  const quality = a4_result.quality;
  const componentScores = a4_result.componentScores || {};
  const riskReward = a4_result.riskReward;
  const setups = a4_result.setups || [];

  const componentScoresClean = {
    trend: n(componentScores.trend),
    momentum: n(componentScores.momentum),
    structure: n(componentScores.structure),
    volume: n(componentScores.volume),
    rsi: n(componentScores.rsi),
    bollinger: n(componentScores.bollinger),
    riskReward: n(componentScores.riskReward),
    atrQuality: n(componentScores.atrQuality),
  };

  const componentWeights = {
    trend: SWING_WEIGHTS.trend * 100,
    momentum: SWING_WEIGHTS.momentum * 100,
    structure: SWING_WEIGHTS.structure * 100,
    volume: SWING_WEIGHTS.volume * 100,
    rsi: SWING_WEIGHTS.rsi * 100,
    bollinger: SWING_WEIGHTS.bollinger * 100,
    riskReward: SWING_WEIGHTS.riskReward * 100,
    atrQuality: SWING_WEIGHTS.atrQuality * 100,
  };

  const setupClassification =
    setups.length > 0
      ? setups.map((s) => ({
          type: s.type,
          label: s.label,
          strength: s.strength,
          confidence: s.confidence,
          description: s.description,
        }))
      : [];

  const zones = a4_result.zones || {
    entryZone: null,
    target1: null,
    target2: null,
    invalidation: null,
    riskPercent: null,
    rewardPercent: null,
    stopLoss: null,
  };

  const entryZone = zones.entryZone;
  const target1 = zones.target1;
  const target2 = zones.target2;
  const invalidation = zones.invalidation;

  const reasons = (a4_result.reasons || []).slice(0, 6);
  const warnings = a4_result.warnings || [];
  const flags = a4_result.flags || [];

  const risks = [];
  const seenRisks = new Set();

  function addRisk(label, severity, description) {
    const key = `${label}:${severity}`;
    if (!seenRisks.has(key)) {
      seenRisks.add(key);
      risks.push({ label, severity, description });
    }
  }

  if (a4_result.rsi != null && a4_result.rsi > 75) {
    addRisk('RSI_OVERBOUGHT', 'MEDIUM', `RSI ${round(a4_result.rsi)} above 75`);
  }
  if (a4_result.rsi != null && a4_result.rsi < 25) {
    addRisk('RSI_OVERSOLD', 'MEDIUM', `RSI ${round(a4_result.rsi)} below 25`);
  }
  if (a4_result.relativeVolume != null && a4_result.relativeVolume < 0.8) {
    addRisk('LOW_VOLUME', 'MEDIUM', `Relative volume ${round(a4_result.relativeVolume)} below 0.8x`);
  }
  if (riskReward != null && riskReward < 1.0) {
    addRisk('NEGATIVE_RR', 'HIGH', `Risk/reward ${round(riskReward)} below 1.0`);
  }
  if (dataCompleteness < 50) {
    addRisk('LOW_DATA', 'MEDIUM', `Data completeness ${dataCompleteness}% below 50%`);
  }

  for (const w of warnings) {
    addRisk(w, 'LOW', w);
  }

  const smartMoneyBias = quality;

  const timestamp = opts.timestamp || nowISO();

  const hasData = swingScore != null || quality !== 'UNAVAILABLE';

  return {
    symbol: symbol,
    timestamp,

    swingIntelligenceAvailability: hasData,

    swingScore,
    quality,

    componentScores: componentScoresClean,
    componentWeights,

    setupClassification,
    setupCount: setups.length,

    entryZone,
    target1,
    target2,
    invalidation,
    riskReward: riskReward != null ? round(riskReward) : null,
    riskPercent: zones.riskPercent,
    rewardPercent: zones.rewardPercent,

    smartMoneyBias,

    reasons,
    warnings,
    flags,
    risks,

    dataAvailability,
    dataCompleteness,

    signal: a4_result.signal,
    signalStrength: a4_result.signalStrength,
    directionBias: a4_result.directionBias,
    riskLevel: a4_result.riskLevel,

    technicalScore: a4_result.technicalScore,
    setupScore: a4_result.setupScore,

    sma20: a4_result.sma20,
    sma50: a4_result.sma50,
    sma200: a4_result.sma200,
    rsi: marketData?.rsi != null ? n(marketData.rsi) : null,
    vwap: a4_result.vwap,
    atr: a4_result.atr,
    bollinger: a4_result.bollinger,
    cluster: a4_result.cluster,
    clusterRange: a4_result.clusterRange,
    relativeVolume: a4_result.relativeVolume,
    resistance: a4_result.resistance,
    support: a4_result.support,
    resistanceDistance: a4_result.resistanceDistance,

    price: a4_result.price,
    changePercent: a4_result.changePercent,

    source: 'Yahoo Finance via market-engine.js (A4)',
    provider: 'yahoo-finance',

    provenance: {
      intelligence: 'A4',
      manager: 'B4',
    },

    disclaimer:
      'Swing Intelligence Manager (B4) composes A4 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated. ' +
      'Data from Yahoo Finance. SMA200 requires 200 closes; ' +
      'ATR/VWAP require OHLCV arrays.',
  };
}

function defaultSwingIntelligenceManager(symbol = null) {
  const a4_default = defaultSwingIntelligence();
  return {
    symbol: symbol || null,
    timestamp: nowISO(),

    swingIntelligenceAvailability: false,

    swingScore: null,
    quality: 'UNAVAILABLE',

    componentScores: {
      trend: null,
      momentum: null,
      structure: null,
      volume: null,
      rsi: null,
      bollinger: null,
      riskReward: null,
      atrQuality: null,
    },

    componentWeights: {
      trend: SWING_WEIGHTS.trend * 100,
      momentum: SWING_WEIGHTS.momentum * 100,
      structure: SWING_WEIGHTS.structure * 100,
      volume: SWING_WEIGHTS.volume * 100,
      rsi: SWING_WEIGHTS.rsi * 100,
      bollinger: SWING_WEIGHTS.bollinger * 100,
      riskReward: SWING_WEIGHTS.riskReward * 100,
      atrQuality: SWING_WEIGHTS.atrQuality * 100,
    },

    setupClassification: [],
    setupCount: 0,

    entryZone: null,
    target1: null,
    target2: null,
    invalidation: null,
    riskReward: null,
    riskPercent: null,
    rewardPercent: null,

    smartMoneyBias: 'UNAVAILABLE',

    reasons: [],
    warnings: [],
    flags: [],
    risks: [],

    dataAvailability: a4_default.dataAvailability,
    dataCompleteness: 0,

    signal: a4_default.signal,
    signalStrength: a4_default.signalStrength,
    directionBias: a4_default.directionBias,
    riskLevel: a4_default.riskLevel,

    technicalScore: null,
    setupScore: null,

    sma20: null,
    sma50: null,
    sma200: null,
    rsi: null,
    vwap: null,
    atr: null,
    bollinger: null,
    cluster: false,
    clusterRange: null,
    relativeVolume: null,
    resistance: null,
    support: null,
    resistanceDistance: null,

    price: null,
    changePercent: null,

    source: 'Yahoo Finance via market-engine.js (A4)',
    provider: 'yahoo-finance',

    intelligence: a4_default,

    provenance: {
      intelligence: 'A4',
      manager: 'B4',
    },

    disclaimer:
      'Swing Intelligence Manager (B4) composes A4 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated. ' +
      'Data from Yahoo Finance.',
  };
}

function buildEntryZomes(price, support, resistance, atr, riskReward) {
  // Delegate to A4's calculateSwingZones
  // This is an alias for testing convenience
  if (!price || price <= 0) {
    return { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null, stopLoss: null };
  }
  const stopLoss = support != null && support > 0 ? Math.min(price * 0.97, support * 0.995) : price * 0.97;
  if (stopLoss >= price) {
    return { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null, stopLoss: null };
  }
  const risk = price - stopLoss;
  const riskPercent = round((risk / price) * 100);
  const target1 = resistance != null && resistance > price ? resistance : price + risk * 2;
  const target2 = price + risk * 3;
  const rewardPercent = round(((target1 - price) / price) * 100);
  return {
    entryZone: `${round(support != null ? support : price * 0.99)} - ${round(price)}`,
    target1: round(target1),
    target2: round(target2),
    invalidation: round(stopLoss),
    riskPercent,
    rewardPercent,
    stopLoss: round(stopLoss),
  };
}

function rankSwingOpportunitiesB4(results) {
  return rankSwingOpportunities(results);
}

function classifySwingRisk(score, riskLevel) {
  if (score == null) return 'UNKNOWN';
  if (score >= SWING_QUALITY_THRESHOLDS.TOP) return 'LOW';
  if (score >= SWING_QUALITY_THRESHOLDS.STRONG) return 'LOW';
  if (score >= SWING_QUALITY_THRESHOLDS.WATCH) return 'MODERATE';
  return 'HIGH';
}

export {
  n,
  clamp,
  round,
  nowISO,
  normalizeSwingIntelligence,
  defaultSwingIntelligenceManager,
  buildEntryZomes,
  rankSwingOpportunitiesB4,
  classifySwingRisk,
};

export default normalizeSwingIntelligence;
