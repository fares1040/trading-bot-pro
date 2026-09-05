/**
 * Penny Intelligence Manager (B1)
 *
 * Unified orchestration layer for penny-stock intelligence.
 * Pure function module — no network calls in the manager itself.
 *
 * Composes outputs from:
 *   A1  — Penny Core (lib/penny-intelligence.js)
 *   A6  — SEC EDGAR (lib/sec-filings.js) [SEC results passed in]
 *   A7  — Setup Intelligence (lib/setup-intelligence.js) [computed from stock data]
 *   A8  — Liquidity Intelligence (lib/liquidity-intelligence.js) [computed from stock data]
 *
 * Eliminates redundancy present in the original /api/penny-radar route
 * by computing each A1 metric exactly once. Adds A7 and A8 integration
 * for richer penny-stock analysis.
 *
 * No BUY/SELL guarantees. Missing data = null. No fabricated values.
 */

import {
  calculatePennyScore,
  buildPennyReasons,
  calculateDollarVolume,
  classifyDollarVolume,
  calculateVolumeQuality,
  calculatePennyLiquidityScore,
  getLiquidityWarning,
  getLiquidityFlags,
  calculateLiquidityRisk,
  calculateVolatilityRisk,
  calculateResistanceRisk,
  calculateResistanceProximity,
  calculateStructureScore,
  calculateStructureRisk,
  calculateVolumeTrapRisk,
  calculateMomentumRisk,
  calculatePennyRiskScore,
  classifyPennyRisk,
  getPennyRiskLabel,
  getPennyRiskFlags,
  buildRiskReasons,
  generateEntryTargetZones,
  calculateSupportProximity,
  classifyBreakoutProximity,
} from './penny-intelligence.js';

import {
  buildSetupIntelligence,
  defaultSetupIntelligence,
} from './setup-intelligence.js';

import {
  buildLiquidityIntelligence,
  defaultLiquidityIntelligence,
} from './liquidity-intelligence.js';

const n = (value) => {
  if (value == null) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));

const pennyFilters = Object.freeze({
  MAX_PRICE: 5,
  MIN_PRICE: 0.10,
  MIN_AVG_VOLUME: 100000,
  MIN_RVOL: 1.0,
});

const unifiedWeights = Object.freeze({
  pennyScore: 0.35,
  riskInverted: 0.20,
  liquidityScore: 0.25,
  setupScore: 0.20,
});

function classifyPennyOpportunity(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= 85) return 'STRONG';
  if (score >= 70) return 'WATCH';
  if (score >= 50) return 'MODERATE';
  return 'WEAK';
}

function classifyUnifiedRisk(level) {
  if (level === 'low') return 'LOWER';
  if (level === 'moderate') return 'MODERATE';
  if (level === 'high') return 'ELEVATED';
  return 'EXTREME';
}

function defaultSecIntelligence() {
  return {
    secRiskScore: null,
    secRiskLevel: 'unavailable',
    secRiskFlags: [],
    secRiskReasons: ['SEC data unavailable'],
    dilutionRisk: 'unavailable',
    dilutionReason: null,
    offeringRisk: 'unavailable',
    offeringType: null,
    offeringDate: null,
    offeringReason: null,
    warrantRisk: 'unavailable',
    convertibleRisk: 'unavailable',
    warrantReasons: [],
    reverseSplitRisk: 'unavailable',
    reverseSplitDetected: false,
    reverseSplitDate: null,
    reverseSplitRatio: null,
    latestRelevantFilings: [],
    secDataStatus: 'unavailable',
  };
}

function buildPennyCore(stockData) {
  const item = stockData;
  const score = calculatePennyScore(item);
  const reasons = buildPennyReasons(item);
  const dataAvailability = stockData?.dataAvailability || {};
  const technicalReady = stockData?.technicalReady === true;

  return {
    score,
    quality: classifyPennyOpportunity(score),
    reasons,
    dataAvailability: {
      price: dataAvailability.price === true,
      volume: dataAvailability.volume === true,
      technicals: dataAvailability.technicals === true,
      options: dataAvailability.options === true,
      darkPool: dataAvailability.darkPool === true,
      institutionalFlow: dataAvailability.institutionalFlow === true,
    },
    technicalReady,
  };
}

function buildPennyLiquidity(stockData) {
  const price = n(stockData?.price);
  const volume = n(stockData?.volume);
  const avgVolume = n(stockData?.averageVolume20);
  const rvol = n(stockData?.relativeVolume);

  const dollarVolume = calculateDollarVolume(price, volume);
  const dollarVolumeClass = classifyDollarVolume(dollarVolume);
  const volumeQuality = calculateVolumeQuality({
    volume,
    averageVolume20: avgVolume,
    relativeVolume: rvol,
  });

  const liquidityScore = calculatePennyLiquidityScore({
    liquidityScore: stockData?.liquidityScore,
    dollarVolume,
    volumeQualityScore: volumeQuality.score,
  });

  const liquidityWarning = getLiquidityWarning(dollarVolume);
  const liquidityFlags = getLiquidityFlags({
    relativeVolume: rvol,
    dollarVolume,
    volumeQualityScore: volumeQuality.score,
  });

  const liquidityRisk = calculateLiquidityRisk({
    dollarVolume,
    volumeQualityScore: volumeQuality.score,
    liquidityScore,
    liquidityWarning,
    liquidityFlags,
  });

  return {
    score: liquidityScore,
    warning: liquidityWarning,
    flags: liquidityFlags,
    dollarVolume,
    dollarVolumeClass,
    volumeQualityScore: volumeQuality.score,
    volumeQuality: volumeQuality.quality,
    liquidityRisk,
  };
}

function buildPennyVolatility(stockData) {
  const price = n(stockData?.price);
  const volatilityRisk = calculateVolatilityRisk({
    price,
    atr: stockData?.atr,
    changePercent: stockData?.changePercent,
  });

  return {
    atr: n(stockData?.atr),
    vwapStatus: 'unavailable',
    volatilityRisk,
  };
}

function buildPennyStructure(stockData) {
  const price = n(stockData?.price);
  const support = n(stockData?.support20);
  const resistance = n(stockData?.resistance20);
  const breakoutScore = n(stockData?.breakoutScore);
  const clusterScore = n(stockData?.clusterScore);

  const supportProximity = calculateSupportProximity(price, support);
  const resistanceProximity = calculateResistanceProximity(price, resistance);
  const breakoutProximity = classifyBreakoutProximity(price, resistance, breakoutScore);

  const structureScore = calculateStructureScore({
    price,
    support,
    resistance,
    breakoutScore,
    clusterScore,
  });

  const structureRisk = calculateStructureRisk({
    structureScore,
    breakoutScore,
    clusterScore,
  });

  const resistanceDistance = resistance != null && price != null && price > 0
    ? ((resistance - price) / price) * 100
    : null;

  const resistanceRisk = calculateResistanceRisk({
    resistanceDistancePercent: resistanceDistance,
    resistanceProximity,
  });

  return {
    score: structureScore,
    supportProximity,
    resistanceProximity,
    resistanceRisk,
    structureRisk,
    resistanceDistancePercent: resistanceDistance,
    breakoutProximity,
  };
}

function buildPennyZones(stockData) {
  const price = n(stockData?.price);
  return generateEntryTargetZones(
    price,
    n(stockData?.support20),
    n(stockData?.resistance20),
    n(stockData?.atr)
  );
}

function buildPennyRisk(stockData, pennyLiquidity) {
  const price = n(stockData?.price);
  const rvol = n(stockData?.relativeVolume);
  const dollarVolume = pennyLiquidity.dollarVolume;
  const volumeQualityScore = pennyLiquidity.volumeQualityScore;
  const liquidityFlags = pennyLiquidity.flags;
  const liquidityScore = pennyLiquidity.score;
  const liquidityWarning = pennyLiquidity.warning;

  const volatilityRisk = calculateVolatilityRisk({
    price,
    atr: stockData?.atr,
    changePercent: stockData?.changePercent,
  });

  const resistanceProximity = calculateResistanceProximity(price, stockData?.resistance20);
  const resistanceDistance = n(stockData?.resistance20) != null && price != null && price > 0
    ? ((n(stockData?.resistance20) - price) / price) * 100
    : null;

  const resistanceRisk = calculateResistanceRisk({
    resistanceDistancePercent: resistanceDistance,
    resistanceProximity,
  });

  const structureScore = calculateStructureScore({
    price,
    support: n(stockData?.support20),
    resistance: n(stockData?.resistance20),
    breakoutScore: n(stockData?.breakoutScore),
    clusterScore: n(stockData?.clusterScore),
  });

  const structureRisk = calculateStructureRisk({
    structureScore,
    breakoutScore: n(stockData?.breakoutScore),
    clusterScore: n(stockData?.clusterScore),
  });

  const volumeTrapRisk = calculateVolumeTrapRisk({
    relativeVolume: rvol,
    dollarVolume,
    volumeQualityScore,
    liquidityFlags,
  });

  const breakoutProximity = classifyBreakoutProximity(price, stockData?.resistance20, stockData?.breakoutScore);

  const momentumRisk = calculateMomentumRisk({
    rsi: stockData?.rsi,
    changePercent: stockData?.changePercent,
    breakoutProximity,
  });

  const riskComponents = {
    liquidityRisk: pennyLiquidity.liquidityRisk,
    volatilityRisk,
    resistanceRisk,
    structureRisk,
    volumeTrapRisk,
    momentumRisk,
  };

  const riskScore = calculatePennyRiskScore(riskComponents);
  const riskLevel = classifyPennyRisk(riskScore);
  const riskLabel = getPennyRiskLabel(riskLevel);
  const riskFlags = getPennyRiskFlags({ ...riskComponents, liquidityFlags });
  const riskReasons = buildRiskReasons({
    ...riskComponents,
    dollarVolume,
    liquidityFlags,
    atr: stockData?.atr,
    price,
    resistanceDistancePercent: resistanceDistance,
    rsi: stockData?.rsi,
    changePercent: stockData?.changePercent,
    breakoutProximity,
  });

  return {
    score: riskScore,
    level: riskLevel,
    label: riskLabel,
    flags: riskFlags,
    reasons: riskReasons,
    components: riskComponents,
  };
}

function buildAction(score, riskScore, riskLevel) {
  if (score == null) return 'انتظار';

  if (score >= 85) {
    if (riskLevel === 'moderate' || riskLevel === 'low') {
      return 'مراقبة تأكيد الاختراق والحجم';
    }
    return 'مراقبة';
  }
  if (score >= 75) return 'مراقبة';
  return 'انتظار';
}

function buildThesis(score, quality) {
  if (quality === 'STRONG') return 'إشارة فنية قوية ضمن رادار الأسهم منخفضة السعر';
  if (quality === 'WATCH') return 'مرشح منخفض السعر يحتاج تأكيدًا إضافيًا';
  return 'مرشح منخفض السعر يحتاج تأكيدًا إضافيًا';
}

function calculateUnifiedScore(pennyScore, riskScore, liquidityScore, setupScore) {
  const components = [
    { score: n(pennyScore), weight: unifiedWeights.pennyScore },
    { score: riskScore != null ? clamp(100 - riskScore) : null, weight: unifiedWeights.riskInverted },
    { score: n(liquidityScore), weight: unifiedWeights.liquidityScore },
    { score: n(setupScore), weight: unifiedWeights.setupScore },
  ];

  const available = components.filter(w => w.score != null);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
  const weightedSum = available.reduce((sum, w) => sum + w.score * w.weight, 0);
  return Math.round(clamp(weightedSum / totalWeight));
}

function buildPennyIntelligence(stockData, options = {}) {
  const {
    secIntelligence,
    setupIntelligence,
    liquidityIntelligence: optLiquidity,
  } = options;

  if (!stockData) {
    return defaultPennyIntelligence(null, secIntelligence);
  }

  const symbol = stockData?.symbol || null;

  const pennyCore = buildPennyCore(stockData);
  const liquidity = buildPennyLiquidity(stockData);
  const volatility = buildPennyVolatility(stockData);
  const structure = buildPennyStructure(stockData);
  const zones = buildPennyZones(stockData);
  const risk = buildPennyRisk(stockData, liquidity);

  let setup = setupIntelligence;
  if (!setup) {
    setup = stockData ? buildSetupIntelligence(stockData, symbol) : defaultSetupIntelligence(symbol);
  }

  let marketLiquidity = optLiquidity;
  if (!marketLiquidity) {
    marketLiquidity = stockData ? buildLiquidityIntelligence(stockData, symbol) : defaultLiquidityIntelligence(symbol);
  }

  const sec = secIntelligence || defaultSecIntelligence();

  const unifiedScore = calculateUnifiedScore(
    pennyCore.score,
    risk.score,
    marketLiquidity.liquidityScore,
    setup.setupScore
  );

  const quality = classifyPennyOpportunity(unifiedScore ?? pennyCore.score);
  const action = buildAction(pennyCore.score, risk.score, risk.level);
  const thesis = buildThesis(pennyCore.score, quality);

  const allReasons = [
    ...(pennyCore.reasons || []),
    ...(risk.reasons || []),
    ...(marketLiquidity.reasons || []),
    ...(setup.reasons || []),
  ];

  const allWarnings = [
    ...(pennyCore.dataAvailability ? (pennyCore.dataAvailability.price ? [] : ['NO_PRICE_DATA']) : []),
    ...(setup.warnings || []),
    ...(marketLiquidity.warnings || []),
  ];

  const allFlags = [
    ...(risk.flags || []),
    ...(liquidity.flags || []),
    ...(marketLiquidity.flags || []),
    ...(setup.flags || []),
  ];

  let allReasonsUnique = [...new Map(allReasons.map(r => [r, r])).values()];
  let allWarningsUnique = [...new Map(allWarnings.map(w => [w, w])).values()];
  let allFlagsUnique = [...new Map(allFlags.map(f => [f, f])).values()];

  return {
    symbol,
    kind: 'PENNY',

    penny: {
      score: pennyCore.score,
      quality: pennyCore.quality,
      reasons: pennyCore.reasons,
    },

    risk: {
      score: risk.score,
      level: risk.level,
      label: risk.label,
      flags: risk.flags,
      reasons: risk.reasons,
      components: risk.components,
    },

    liquidity: {
      score: liquidity.score,
      warning: liquidity.warning,
      flags: liquidity.flags,
      dollarVolume: liquidity.dollarVolume,
      dollarVolumeClass: liquidity.dollarVolumeClass,
      volumeQualityScore: liquidity.volumeQualityScore,
      volumeQuality: liquidity.volumeQuality,
      liquidityRisk: liquidity.liquidityRisk,
    },

    volatility: {
      atr: volatility.atr,
      vwapStatus: volatility.vwapStatus,
      volatilityRisk: volatility.volatilityRisk,
    },

    structure: {
      score: structure.score,
      supportProximity: structure.supportProximity,
      resistanceProximity: structure.resistanceProximity,
      resistanceRisk: structure.resistanceRisk,
      structureRisk: structure.structureRisk,
      resistanceDistancePercent: structure.resistanceDistancePercent,
      breakoutProximity: structure.breakoutProximity,
    },

    zones: {
      entryZone: zones.entryZone,
      targetZone: zones.targetZone,
    },

    setup: {
      setupScore: setup.setupScore,
      quality: setup.quality,
      setupType: setup.setupType,
      setupConfidence: setup.setupConfidence,
      signal: setup.signal,
      componentScores: setup.componentScores,
      reasons: setup.reasons,
      warnings: setup.warnings,
      flags: setup.flags,
    },

    marketLiquidity: {
      liquidityScore: marketLiquidity.liquidityScore,
      quality: marketLiquidity.quality,
      liquidityTraps: marketLiquidity.liquidityTraps,
      liquidityTrapCount: marketLiquidity.liquidityTrapCount,
      liquidityRisk: marketLiquidity.liquidityRisk,
      componentScores: marketLiquidity.componentScores,
    },

    sec: sec,

    unified: {
      score: unifiedScore,
      quality,
      action,
      thesis,
      reasonCount: allReasonsUnique.length,
      warningCount: allWarningsUnique.length,
      flagCount: allFlagsUnique.length,
    },

    reasons: allReasonsUnique.slice(0, 8),
    warnings: allWarningsUnique.slice(0, 5),
    flags: allFlagsUnique.slice(0, 8),

    expectedTimeframe: 'UNKNOWN',

    price: n(stockData?.price),
    previousClose: n(stockData?.previousClose),
    changePercent: n(stockData?.changePercent),
    relativeVolume: n(stockData?.relativeVolume),
    averageVolume20: n(stockData?.averageVolume20),
    rsi: n(stockData?.rsi),
    setupScore: n(stockData?.setupScore),
    signal: stockData?.signal || null,
    signalStrength: stockData?.signalStrength || null,
    directionBias: stockData?.directionBias || 'محايد',
    riskLevel: stockData?.riskLevel || null,

    dataAvailability: {
      price: pennyCore.dataAvailability.price,
      volume: pennyCore.dataAvailability.volume,
      technicals: pennyCore.dataAvailability.technicals,
      sec: sec.secDataStatus === 'ok' ? true : sec.secDataStatus === 'unavailable' ? false : 'partial',
      setup: setup.marketDataStatus === 'ok' ? true : setup.marketDataStatus === 'unavailable' ? false : 'partial',
      marketLiquidity: marketLiquidity.marketDataStatus === 'ok' ? true : marketLiquidity.marketDataStatus === 'unavailable' ? false : 'partial',
    },
    dataCompleteness: stockData ? Math.round(
      Object.values(pennyCore.dataAvailability).filter(Boolean).length / 6 * 100
    ) : 0,
    technicalReady: pennyCore.technicalReady,
    marketDataStatus: stockData?.dataAvailability ? 'ok' : 'partial',

    provenance: {
      pennyCore: 'A1',
      risk: 'A1',
      liquidity: 'A1',
      volatility: 'A1',
      structure: 'A1',
      zones: 'A1',
      setup: 'A7',
      marketLiquidity: 'A8',
      sec: 'A6',
    },

    disclaimer: 'Penny Intelligence Manager is analytical only (A1-A8). Not a buy/sell recommendation. Data from Yahoo Finance and SEC EDGAR.',
  };
}

function defaultPennyIntelligence(symbol, secIntelligence) {
  const sec = secIntelligence || defaultSecIntelligence();
  return {
    symbol: symbol || null,
    expectedTimeframe: 'UNKNOWN',

    kind: 'PENNY',
    penny: { score: null, quality: 'UNAVAILABLE', reasons: [] },
    risk: { score: null, level: 'unavailable', label: 'RISK UNAVAILABLE', flags: [], reasons: [], components: { liquidityRisk: null, volatilityRisk: null, resistanceRisk: null, structureRisk: null, volumeTrapRisk: null, momentumRisk: null } },
    liquidity: { score: null, warning: 'unavailable', flags: [], dollarVolume: null, dollarVolumeClass: 'unavailable', volumeQualityScore: null, volumeQuality: 'unavailable', liquidityRisk: null },
    volatility: { atr: null, vwapStatus: 'unavailable', volatilityRisk: null },
    structure: { score: null, supportProximity: null, resistanceProximity: null, resistanceRisk: null, structureRisk: null, resistanceDistancePercent: null, breakoutProximity: 'unavailable' },
    zones: { entryZone: null, targetZone: null },
    setup: { ...defaultSetupIntelligence(symbol), reasons: [], warnings: [], flags: [], componentScores: {}, dataAvailability: {} },
    marketLiquidity: { ...defaultLiquidityIntelligence(symbol), reasons: [], warnings: [], flags: [], componentScores: {}, dataAvailability: {} },
    sec: sec,
    unified: { score: null, quality: 'UNAVAILABLE', action: 'انتظار', thesis: 'Insufficient data for analysis', reasonCount: 0, warningCount: 1, flagCount: 0 },
    reasons: [],
    warnings: ['NO_MARKET_DATA'],
    flags: [],
    price: null,
    previousClose: null,
    changePercent: null,
    relativeVolume: null,
    averageVolume20: null,
    rsi: null,
    setupScore: null,
    signal: null,
    signalStrength: null,
    directionBias: 'محايد',
    riskLevel: null,
    dataAvailability: { price: false, volume: false, technicals: false, sec: sec.secDataStatus, setup: false, marketLiquidity: false },
    dataCompleteness: 0,
    technicalReady: false,
    marketDataStatus: 'unavailable',
    provenance: { pennyCore: 'A1', risk: 'A1', liquidity: 'A1', volatility: 'A1', structure: 'A1', zones: 'A1', setup: 'A7', marketLiquidity: 'A8', sec: 'A6' },
    disclaimer: 'Penny Intelligence Manager is analytical only (A1-A8). Not a buy/sell recommendation. Data from Yahoo Finance and SEC EDGAR.',
  };
}

function filterPennyStocks(stocks) {
  if (!Array.isArray(stocks)) return [];
  return stocks.filter((item) => {
    const price = n(item?.price);
    const avgVolume = n(item?.averageVolume20);
    const rvol = n(item?.relativeVolume);
    const symbol = String(item?.symbol || '').trim().toUpperCase();
    return (
      symbol &&
      /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) &&
      price != null &&
      price >= pennyFilters.MIN_PRICE &&
      price <= pennyFilters.MAX_PRICE &&
      avgVolume != null &&
      avgVolume >= pennyFilters.MIN_AVG_VOLUME &&
      rvol != null &&
      rvol >= pennyFilters.MIN_RVOL &&
      item?.technicalReady === true
    );
  });
}

function rankPennyOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.unified?.score ?? a.penny?.score ?? -1;
    const sb = b.unified?.score ?? b.penny?.score ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    return 0;
  });

  const ranked = sorted.slice(0, 20);
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  return { ranked, top, alternatives };
}

export {
  clamp,
  n,
  pennyFilters,
  unifiedWeights,
  classifyPennyOpportunity,
  classifyUnifiedRisk,
  defaultSecIntelligence,
  buildPennyCore,
  buildPennyLiquidity,
  buildPennyVolatility,
  buildPennyStructure,
  buildPennyZones,
  buildPennyRisk,
  buildAction,
  buildThesis,
  calculateUnifiedScore,
  buildPennyIntelligence,
  defaultPennyIntelligence,
  filterPennyStocks,
  rankPennyOpportunities,
};

export default buildPennyIntelligence;
