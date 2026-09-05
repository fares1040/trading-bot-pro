/**
 * Early Explosion Intelligence Manager (B5)
 *
 * Orchestration layer that wraps A5 (lib/early-explosion-intelligence.js)
 * into a production-ready Early Explosion Intelligence Manager with:
 *   - Provenance tracking (A5 -> B5)
 *   - Unified output contract
 *   - Risk/safety layer (explosion risk, liquidity risk, low-data warnings)
 *   - Normalized setup classification
 *   - B5-specific ranking with stable symbol tie-break
 *   - Data quality aggregation
 *
 * Pure function module — no network calls in the manager itself.
 * No BUY/SELL guarantees. Missing data remains null. Never fabricated.
 *
 * Composes:
 *   A5  — Early Explosion Intelligence Core (lib/early-explosion-intelligence.js)
 */

import {
  buildEarlyExplosionIntelligence,
  defaultEarlyExplosionIntelligence,
  rankExplosionOpportunities,
  EXPLOSION_WEIGHTS,
  EXPLOSION_QUALITY_THRESHOLDS,
} from './early-explosion-intelligence.js';

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

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

function classifyExplosionRisk(score, riskLevel) {
  if (score == null) return 'UNKNOWN';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.EXTREME) return 'HIGH';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.HIGH) return 'MODERATE_HIGH';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.WATCH) return 'MODERATE';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.LOW) return 'LOW_MODERATE';
  return 'LOW';
}

function classifyLiquidityRisk(relativeVolume, volume, avgVolume20, dataCompleteness) {
  if (relativeVolume != null && relativeVolume < 0.7) return 'HIGH';
  if (volume != null && avgVolume20 != null && avgVolume20 > 0 && volume < avgVolume20 * 0.5) return 'HIGH';
  if (dataCompleteness != null && dataCompleteness < 40) return 'MODERATE';
  return 'LOW';
}

function normalizeSetup(setup) {
  if (!setup || typeof setup !== 'object' || !setup.type) return null;
  const evidence = [];

  if (setup.type) evidence.push(setup.type);
  if (setup.description) evidence.push(setup.description);

  return {
    type: setup.type || 'UNKNOWN',
    label: setup.label || setup.type || 'Unknown Setup',
    strength: setup.strength || 'UNKNOWN',
    confidence: typeof setup.confidence === 'number' ? setup.confidence : null,
    evidence: evidence,
  };
}

function normalizeSetups(setups) {
  if (!Array.isArray(setups)) return [];
  return setups
    .map(normalizeSetup)
    .filter((s) => s !== null);
}

function buildEarlyExplosionRisks(data, a5_result, componentScores, scores) {
  const risks = [];
  const seen = new Set();

  function add(label, severity, description) {
    const key = `${label}:${severity}`;
    if (!seen.has(key)) {
      seen.add(key);
      risks.push({ label, severity, description });
    }
  }

  // Explosion risk from A5
  const explosionRisk = classifyExplosionRisk(a5_result.explosionScore, a5_result.riskLevel);
  if (explosionRisk === 'HIGH' || explosionRisk === 'MODERATE_HIGH') {
    add('EXPLOSION_RISK', explosionRisk, `Explosion score ${a5_result.explosionScore} indicates elevated volatility risk`);
  }

  // Liquidity risk
  const liquidityRisk = classifyLiquidityRisk(
    a5_result.relativeVolume,
    a5_result.price != null && a5_result.riskReward != null ? null : null,
    null,
    a5_result.dataCompleteness
  );
  if (liquidityRisk === 'HIGH') {
    add('LIQUIDITY_RISK', 'HIGH', 'Low relative volume or drying-up volume detected');
  } else if (liquidityRisk === 'MODERATE') {
    add('LIQUIDITY_RISK', 'MODERATE', 'Data completeness below 40%');
  }

  // Low data warning
  if (a5_result.dataCompleteness != null && a5_result.dataCompleteness < 50) {
    add('LOW_DATA', 'MEDIUM', `Data completeness ${a5_result.dataCompleteness}% below 50%`);
  }

  // Stale/missing data
  if (a5_result.dataCompleteness === 0) {
    add('NO_DATA', 'HIGH', 'No market data available for analysis');
  }

  // Resistance proximity
  if (data.resistance != null && data.price != null && data.price > data.resistance) {
    add('RESISTANCE_PROXIMITY', 'MEDIUM', 'Price at/above resistance — verify breakout confirmation');
  }

  // Poor R/R
  if (a5_result.riskReward != null && a5_result.riskReward < 1.0) {
    add('POOR_RR', 'HIGH', `Risk/reward ${round(a5_result.riskReward)} below 1.0`);
  }

  // Conflicting signals
  const warnings = a5_result.warnings || [];
  if (warnings.includes('RSI_EXTREME_OVERBOUGHT') && scores.momentumAcceleration < 50) {
    add('CONFLICTING_SIGNALS', 'MEDIUM', 'RSI overbought while momentum decelerating');
  }
  if (warnings.includes('RSI_EXTREME_OVERSOLD') && scores.momentumAcceleration < 50) {
    add('CONFLICTING_SIGNALS', 'MEDIUM', 'RSI oversold while momentum decelerating');
  }

  // Map existing A5 warnings
  for (const w of warnings) {
    if (w === 'VERY_LOW_VOLUME' || w === 'VOLUME_DRYING_UP') {
      add('VOLUME_WARNING', 'HIGH', w);
    } else if (w === 'EXTREME_ATR' || w === 'WIDE_BOLLINGER_BANDS') {
      add('VOLATILITY_WARNING', 'MEDIUM', w);
    } else if (w === 'VOLUME_DECELERATING' || w === 'MOMENTUM_DECELERATING') {
      add('MOMENTUM_WARNING', 'LOW', w);
    }
  }

  return risks;
}

function normalizeSwingIntelligence(marketData, opts = {}) {
  const symbol = marketData?.ticker || marketData?.symbol || null;

  const a5_result = buildEarlyExplosionIntelligence(marketData || null);

  if (!a5_result || a5_result.quality === 'UNAVAILABLE') {
    return defaultEarlyExplosionIntelligenceManager(symbol);
  }

  const dataAvailability = a5_result.dataAvailability || {};
  const dataCompleteness = a5_result.dataCompleteness;

  const componentScores = a5_result.componentScores || {};
  const scores = {
    volumeAcceleration: n(componentScores.volumeAcceleration),
    relativeVolumeExpansion: n(componentScores.relativeVolumeExpansion),
    priceExpansion: n(componentScores.priceExpansion),
    atrExpansion: n(componentScores.atrExpansion),
    bollingerSqueeze: n(componentScores.bollingerSqueeze),
    rangeCompression: n(componentScores.rangeCompression),
    momentumAcceleration: n(componentScores.momentumAcceleration),
    liquidityConfirmation: n(componentScores.liquidityConfirmation),
    breakoutProximity: n(componentScores.breakoutProximity),
    supportResistanceProximity: n(componentScores.supportResistanceProximity),
    riskReward: a5_result.riskReward != null ? round(a5_result.riskReward) : null,
  };

  const componentWeights = {
    volumeAcceleration: EXPLOSION_WEIGHTS.volumeAcceleration * 100,
    relativeVolumeExpansion: EXPLOSION_WEIGHTS.relativeVolumeExpansion * 100,
    priceExpansion: EXPLOSION_WEIGHTS.priceExpansion * 100,
    atrExpansion: EXPLOSION_WEIGHTS.atrExpansion * 100,
    bollingerSqueeze: EXPLOSION_WEIGHTS.bollingerSqueeze * 100,
    rangeCompression: EXPLOSION_WEIGHTS.rangeCompression * 100,
    momentumAcceleration: EXPLOSION_WEIGHTS.momentumAcceleration * 100,
    liquidityConfirmation: EXPLOSION_WEIGHTS.liquidityConfirmation * 100,
  };

  const setupClassification = normalizeSetups(a5_result.setups);
  const setupCount = setupClassification.length;

  const zones = a5_result.zones || {
    entryZone: null, target1: null, target2: null, invalidation: null,
    riskPercent: null, rewardPercent: null, stopLoss: null, riskReward: null,
  };

  const entryZone = zones.entryZone;
  const target1 = zones.target1;
  const target2 = zones.target2;
  const invalidation = zones.invalidation;

  const reasons = (a5_result.reasons || []).slice(0, 6);
  const warnings = a5_result.warnings || [];
  const flags = a5_result.flags || [];

  const risks = buildEarlyExplosionRisks(marketData || {}, a5_result, componentScores, scores);

  const explosionRisk = classifyExplosionRisk(a5_result.explosionScore, a5_result.riskLevel);
  const liquidityRisk = classifyLiquidityRisk(
    a5_result.relativeVolume,
    null,
    null,
    a5_result.dataCompleteness
  );

  const hasData = a5_result.explosionScore != null || (a5_result.dataCompleteness != null && a5_result.dataCompleteness > 0);

  const timestamp = opts.timestamp || nowISO();

  return {
    symbol: symbol,
    timestamp,

    explosionIntelligenceAvailability: hasData,

    explosionScore: a5_result.explosionScore,
    quality: a5_result.quality,

    componentScores: scores,
    componentWeights,

    setupClassification,
    setupCount,

    entryZone,
    target1,
    target2,
    invalidation,
    riskReward: a5_result.riskReward != null ? round(a5_result.riskReward) : null,
    riskPercent: zones.riskPercent,
    rewardPercent: zones.rewardPercent,

    explosionRisk,
    liquidityRisk,

    volumeAcceleration: n(a5_result.volumeAcceleration),
    relativeVolumeExpansion: n(a5_result.relativeVolumeExpansion),
    priceExpansion: n(a5_result.priceExpansion),
    atrExpansion: n(a5_result.atrExpansion),
    bollingerSqueeze: n(a5_result.bollingerSqueeze),
    rangeCompression: n(a5_result.rangeCompression),
    momentumAcceleration: n(a5_result.momentumAcceleration),
    liquidityConfirmation: n(a5_result.liquidityConfirmation),
    breakoutProximity: n(a5_result.breakoutProximity),
    srProximity: n(a5_result.srProximity),

    expectedTimeframe: a5_result.quality === 'EXTREME' || a5_result.quality === 'HIGH' ? 'SHORT_TERM' : 'UNKNOWN',

    reasons,
    warnings,
    flags,
    risks,

    dataAvailability,
    dataCompleteness,

    signal: a5_result.signal != null ? a5_result.signal : (marketData?.signal || 'UNAVAILABLE'),
    signalStrength: a5_result.signalStrength != null ? a5_result.signalStrength : (marketData?.signalStrength || 'LOW'),
    directionBias: a5_result.directionBias != null ? a5_result.directionBias : (marketData?.directionBias || 'ميل فني محايد'),
    riskLevel: a5_result.riskLevel,
    riskScore: a5_result.riskScore,

    technicalScore: a5_result.technicalScore,
    setupScore: a5_result.setupScore,

    sma20: n(marketData?.sma20) !== null ? n(marketData?.sma20) : a5_result.sma20,
    sma50: n(marketData?.sma50) !== null ? n(marketData?.sma50) : a5_result.sma50,
    sma200: n(marketData?.sma200) !== null ? n(marketData?.sma200) : a5_result.sma200,
    rsi: a5_result.rsi != null ? a5_result.rsi : (marketData?.rsi != null ? n(marketData.rsi) : null),
    vwap: marketData?.vwap != null ? n(marketData.vwap) : null,
    atr: a5_result.atr,
    bollinger: a5_result.bollinger,
    cluster: marketData?.cluster != null ? marketData.cluster : a5_result.cluster,
    clusterRange: a5_result.clusterRange,
    relativeVolume: a5_result.relativeVolume,
    resistance: a5_result.resistance,
    support: a5_result.support,
    resistanceDistance: a5_result.resistanceDistance,

    price: a5_result.price,
    changePercent: a5_result.changePercent,

    source: 'Yahoo Finance via market-engine.js (A5)',
    provider: 'yahoo-finance',

    provenance: {
      intelligence: 'A5',
      manager: 'B5',
    },

    disclaimer:
      'Early Explosion Intelligence Manager (B5) composes A5 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated. ' +
      'Data from Yahoo Finance. ' +
      'ATR/VWAP require OHLCV arrays; VWAP requires volume data.',
  };
}

function defaultEarlyExplosionIntelligenceManager(symbol = null) {
  const a5_default = defaultEarlyExplosionIntelligence();
  return {
    symbol: symbol || null,
    timestamp: nowISO(),

    explosionIntelligenceAvailability: false,

    explosionScore: null,
    quality: 'UNAVAILABLE',

    componentScores: {
      volumeAcceleration: null,
      relativeVolumeExpansion: null,
      priceExpansion: null,
      atrExpansion: null,
      bollingerSqueeze: null,
      rangeCompression: null,
      momentumAcceleration: null,
      liquidityConfirmation: null,
      breakoutProximity: null,
      supportResistanceProximity: null,
      riskReward: null,
    },

    componentWeights: {
      volumeAcceleration: EXPLOSION_WEIGHTS.volumeAcceleration * 100,
      relativeVolumeExpansion: EXPLOSION_WEIGHTS.relativeVolumeExpansion * 100,
      priceExpansion: EXPLOSION_WEIGHTS.priceExpansion * 100,
      atrExpansion: EXPLOSION_WEIGHTS.atrExpansion * 100,
      bollingerSqueeze: EXPLOSION_WEIGHTS.bollingerSqueeze * 100,
      rangeCompression: EXPLOSION_WEIGHTS.rangeCompression * 100,
      momentumAcceleration: EXPLOSION_WEIGHTS.momentumAcceleration * 100,
      liquidityConfirmation: EXPLOSION_WEIGHTS.liquidityConfirmation * 100,
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

    explosionRisk: 'UNKNOWN',
    liquidityRisk: 'UNKNOWN',

    volumeAcceleration: null,
    relativeVolumeExpansion: null,
    priceExpansion: null,
    atrExpansion: null,
    bollingerSqueeze: null,
    rangeCompression: null,
    momentumAcceleration: null,
    liquidityConfirmation: null,
    breakoutProximity: null,
    srProximity: null,

    expectedTimeframe: 'UNKNOWN',

    reasons: [],
    warnings: [],
    flags: [],
    risks: [],

    dataAvailability: a5_default.dataAvailability,
    dataCompleteness: 0,

    signal: a5_default.signal,
    signalStrength: a5_default.signalStrength,
    directionBias: a5_default.directionBias,
    riskLevel: a5_default.riskLevel,
    riskScore: a5_default.riskScore,

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

    source: 'Yahoo Finance via market-engine.js (A5)',
    provider: 'yahoo-finance',

    intelligence: a5_default,

    provenance: {
      intelligence: 'A5',
      manager: 'B5',
    },

    disclaimer:
      'Early Explosion Intelligence Manager (B5) composes A5 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated. ' +
      'Data from Yahoo Finance.',
  };
}

function rankEarlyExplosionOpportunitiesB5(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [] };
  }

  const sorted = [...results].sort((a, b) => {
    const sa = a.explosionScore ?? -1;
    const sb = b.explosionScore ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    const ra = a.riskReward ?? -1;
    const rb = b.riskReward ?? -1;
    if (rb !== ra) return rb - ra;
    const symA = (a.symbol || '').toString();
    const symB = (b.symbol || '').toString();
    return symA < symB ? -1 : symA > symB ? 1 : 0;
  });

  const ranked = sorted.slice(0, 20);
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  return { ranked, top, alternatives };
}

function normalizeSetupSetups(setups) {
  return normalizeSetups(setups);
}

export {
  n,
  clamp,
  round,
  nowISO,
  classifyExplosionRisk,
  classifyLiquidityRisk,
  normalizeSetup,
  normalizeSetups,
  normalizeSwingIntelligence as buildEarlyExplosionIntelligenceManager,
  defaultEarlyExplosionIntelligenceManager as defaultEarlyExplosionIntelligenceManager,
  rankEarlyExplosionOpportunitiesB5,
  normalizeSetupSetups,
};

export default normalizeSwingIntelligence;
