/**
 * Technical Setup Intelligence Engine (A7)
 *
 * Classifies specific trading setups from existing Yahoo Finance market data.
 * Pure function — no network calls. Reuses lib/market-engine.js outputs.
 *
 * Setup types: BREAKOUT, PULLBACK, REVERSAL, SQUEEZE, CONTINUATION, BASE,
 *              MOMENTUM, CONSOLIDATION, OTHER
 *
 * No BUY/SELL guarantees. Missing data = null. No fabricated values.
 */

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));

const setupWeights = Object.freeze({
  setupStrength: 0.30,
  volumeConfirmation: 0.25,
  riskReward: 0.20,
  technicalReadiness: 0.15,
  dataCompleteness: 0.10,
});

const qualityThresholds = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});

function n(val) {
  if (val == null) return null;
  const x = Number(val);
  return Number.isFinite(x) ? x : null;
}

function identifySetupType(marketData) {
  const price = n(marketData?.price);
  const sma20 = n(marketData?.sma20);
  const sma50 = n(marketData?.sma50);
  const rsi = n(marketData?.rsi);
  const rvol = n(marketData?.relativeVolume);
  const resistance = n(marketData?.resistance20);
  const support = n(marketData?.support20);
  const squeeze = marketData?.squeeze === true;
  const bollingerBandwidth = n(marketData?.bollingerBandwidth);
  const clusterRange = n(marketData?.clusterRangePercent);
  const cluster = marketData?.cluster === true;
  const momentum = n(marketData?.momentumScore);
  const trend = n(marketData?.trendScore);
  const volumeScore = n(marketData?.volumeScore);

  const setup = { type: 'OTHER', confidence: null };

  if (price != null && resistance != null && price > resistance && rvol != null && rvol >= 1.2) {
    setup.type = 'BREAKOUT';
    setup.confidence = 85;
  } else if (squeeze && bollingerBandwidth != null && bollingerBandwidth < 9 && price != null && sma20 != null && (price < sma20 * 1.02)) {
    setup.type = 'SQUEEZE';
    setup.confidence = 80;
  } else if (price != null && sma20 != null && sma20 != 0 && rsi != null && rsi < 40 && price < sma20 && rvol != null && rvol >= 1.0) {
    setup.type = 'REVERSAL';
    setup.confidence = 75;
  } else if (price != null && sma20 != null && sma50 != null && rsi != null && price > sma20 && price < sma20 * 1.01 && rsi > 45 && rsi < 65 && rvol != null && rvol >= 1.0) {
    setup.type = 'PULLBACK';
    setup.confidence = 70;
  } else if (trend != null && trend >= 65 && price != null && sma50 != null && price > sma50 && rsi != null && rsi > 50 && rsi < 70) {
    setup.type = 'CONTINUATION';
    setup.confidence = 70;
  } else if (cluster && clusterRange != null && clusterRange <= 3.5 && rvol != null && rvol >= 1.1 && volumeScore != null && volumeScore >= 60) {
    setup.type = 'BASE';
    setup.confidence = 65;
  } else if (momentum != null && momentum >= 70 && volumeScore != null && volumeScore >= 60 && trend != null && trend >= 55) {
    setup.type = 'MOMENTUM';
    setup.confidence = 75;
  } else if (bollingerBandwidth != null && bollingerBandwidth < 5 && price != null && sma20 != null && price > sma20 * 0.97 && price < sma20 * 1.03) {
    setup.type = 'CONSOLIDATION';
    setup.confidence = 60;
  }

  return setup;
}

function calculateSetupStrength(marketData) {
  const setup = n(marketData?.setupScore);
  if (setup == null) return null;
  return clamp(setup);
}

function calculateVolumeConfirmation(marketData) {
  const rvol = n(marketData?.relativeVolume);
  const volumeScore = n(marketData?.volumeScore);
  if (rvol == null && volumeScore == null) return null;
  if (rvol != null && volumeScore != null) {
    return clamp(50 + (rvol - 1) * 25 + (volumeScore - 50) * 0.3);
  }
  if (rvol != null) return clamp(45 + (rvol - 1) * 35);
  if (volumeScore != null) return clamp(volumeScore);
  return null;
}

function calculateRiskRewardScore(marketData) {
  const rr = n(marketData?.riskReward);
  if (rr == null) return null;
  if (rr <= 0) return 0;
  if (rr >= 3) return 100;
  return clamp(rr * 30);
}

function calculateTechnicalReadiness(marketData) {
  const dataAvail = marketData?.dataAvailability;
  if (!dataAvail) return null;
  const checks = [dataAvail.price, dataAvail.volume, dataAvail.technicals];
  const allAvailable = checks.every(c => c === true);
  return allAvailable ? 100 : 50;
}

function calculateSetupDataCompleteness(marketData) {
  const required = ['price', 'sma20', 'sma50', 'rsi', 'relativeVolume', 'squeeze', 'riskReward', 'breakoutScore', 'trendScore', 'volumeScore'];
  let count = 0;
  for (const key of required) {
    if (marketData[key] != null) count++;
  }
  return Math.round((count / required.length) * 100);
}

function calculateSetupScore(marketData) {
  const components = {
    setupStrength: calculateSetupStrength(marketData),
    volumeConfirmation: calculateVolumeConfirmation(marketData),
    riskReward: calculateRiskRewardScore(marketData),
    technicalReadiness: calculateTechnicalReadiness(marketData),
    dataCompleteness: calculateSetupDataCompleteness(marketData),
  };

  const weighted = [
    { score: components.setupStrength, weight: setupWeights.setupStrength },
    { score: components.volumeConfirmation, weight: setupWeights.volumeConfirmation },
    { score: components.riskReward, weight: setupWeights.riskReward },
    { score: components.technicalReadiness, weight: setupWeights.technicalReadiness },
    { score: components.dataCompleteness, weight: setupWeights.dataCompleteness },
  ];

  const available = weighted.filter(w => w.score != null);
  if (available.length === 0) return { score: null, components };

  const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
  const weightedSum = available.reduce((sum, w) => sum + w.score * w.weight, 0);
  const score = Math.round(clamp(weightedSum / totalWeight));

  return { score, components };
}

function classifySetupQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= qualityThresholds.TOP) return 'TOP';
  if (score >= qualityThresholds.STRONG) return 'STRONG';
  if (score >= qualityThresholds.WATCH) return 'WATCH';
  if (score >= qualityThresholds.WEAK) return 'WEAK';
  return 'UNAVAILABLE';
}

function buildSetupReasons(marketData, setupInfo, scoreComponents) {
  const reasons = [];
  const price = n(marketData?.price);
  const rsi = n(marketData?.rsi);
  const rvol = n(marketData?.relativeVolume);
  const rr = n(marketData?.riskReward);

  if (setupInfo.type !== 'OTHER' && setupInfo.type !== 'UNAVAILABLE') {
    reasons.push(`${setupInfo.type} setup detected (confidence ${setupInfo.confidence})`);
  } else if (setupInfo.type === 'OTHER') {
    reasons.push('No clear setup pattern detected — market data insufficient for setup classification');
  }

  if (rr != null && rr >= 2) {
    reasons.push(`R/R ${rr.toFixed(2)} — favorable risk/reward`);
  } else if (rr != null && rr < 1.5) {
    reasons.push(`R/R ${rr.toFixed(2)} — tight risk/reward`);
  }

  if (rvol != null && rvol >= 1.5) {
    reasons.push(`RVOL ${rvol.toFixed(2)}x — strong volume confirmation`);
  } else if (rvol != null && rvol >= 1.0) {
    reasons.push(`RVOL ${rvol.toFixed(2)}x — volume confirmed`);
  }

  if (rsi != null && rsi < 30) {
    reasons.push(`RSI ${rsi.toFixed(1)} — oversold, potential reversal`);
  } else if (rsi != null && rsi > 70) {
    reasons.push(`RSI ${rsi.toFixed(1)} — overbought`);
  } else if (rsi != null) {
    reasons.push(`RSI ${rsi.toFixed(1)} — neutral zone`);
  }

  if (marketData?.squeeze === true) {
    reasons.push('Bollinger Band squeeze — low volatility compression');
  }

  if (price != null && n(marketData?.sma20) != null && price > n(marketData?.sma20)) {
    reasons.push('Price above SMA20 — bullish structure');
  } else if (price != null && n(marketData?.sma20) != null && price < n(marketData?.sma20)) {
    reasons.push('Price below SMA20 — bearish structure');
  }

  if (!marketData?.technicalReady) {
    reasons.push('Technical indicators incomplete');
  }

  return reasons.slice(0, 6);
}

function buildSetupWarnings(marketData, setupInfo, scoreComponents) {
  const warnings = [];

  if (!marketData) {
    warnings.push('NO_MARKET_DATA');
    return warnings;
  }

  if (!marketData.technicalReady) {
    warnings.push('INCOMPLETE_TECHNICAL_DATA');
  }

  if (n(marketData?.riskReward) == null) {
    warnings.push('NO_RISK_REWARD');
  } else if (n(marketData?.riskReward) < 1.25) {
    warnings.push('LOW_RISK_REWARD');
  }

  if (n(marketData?.relativeVolume) != null && n(marketData?.relativeVolume) < 1.0) {
    warnings.push('LOW_VOLUME_CONFIRMATION');
  }

  const dataCompleteness = scoreComponents?.dataCompleteness;
  if (dataCompleteness != null && dataCompleteness < 60) {
    warnings.push('LOW_DATA_COMPLETENESS');
  }

  if (setupInfo.type === 'OTHER' || setupInfo.type === 'UNAVAILABLE') {
    warnings.push('NO_CLEAR_SETUP');
  }

  if (n(marketData?.rsi) != null) {
    if (n(marketData?.rsi) < 30) warnings.push('OVERSOLD_CONDITION');
    if (n(marketData?.rsi) > 70) warnings.push('OVERBOUGHT_CONDITION');
  }

  return warnings;
}

function buildSetupFlags(marketData, setupInfo) {
  const flags = [];

  if (setupInfo.type && setupInfo.type !== 'OTHER') flags.push(setupInfo.type);

  if (marketData?.squeeze === true) flags.push('BOLLINGER_SQUEEZE');
  if (marketData?.cluster === true) flags.push('PRICE_CLUSTER');

  const trend = n(marketData?.trendScore);
  if (trend != null && trend >= 70) flags.push('STRONG_TREND');
  if (trend != null && trend <= 30) flags.push('WEAK_TREND');

  const momentum = n(marketData?.momentumScore);
  if (momentum != null && momentum >= 80) flags.push('HIGH_MOMENTUM');
  if (momentum != null && momentum <= 20) flags.push('LOW_MOMENTUM');

  const rvol = n(marketData?.relativeVolume);
  if (rvol != null && rvol >= 2.0) flags.push('HIGH_VOLUME_SPIKE');
  if (rvol != null && rvol < 0.5) flags.push('LOW_VOLUME');

  const rr = n(marketData?.riskReward);
  if (rr != null && rr >= 3) flags.push('HIGH_RISK_REWARD');
  if (rr != null && rr < 1) flags.push('POOR_RISK_REWARD');

  if (n(marketData?.rsi) != null) {
    if (n(marketData?.rsi) < 30) flags.push('OVERSOLD');
    if (n(marketData?.rsi) > 70) flags.push('OVERBOUGHT');
  }

  return flags;
}

function calculateSetupDataAvailability(marketData) {
  const dataAvail = marketData?.dataAvailability || {};
  return {
    price: dataAvail.price === true,
    volume: dataAvail.volume === true,
    technicals: dataAvail.technicals === true,
    rsi: n(marketData?.rsi) != null,
    bollinger: n(marketData?.bollingerBandwidth) != null,
    sma: n(marketData?.sma20) != null && n(marketData?.sma50) != null,
    riskReward: n(marketData?.riskReward) != null,
    volume: n(marketData?.relativeVolume) != null,
    supportResistance: n(marketData?.support20) != null && n(marketData?.resistance20) != null,
    setupScore: n(marketData?.setupScore) != null,
  };
}

function defaultSetupIntelligence(symbol) {
  return {
    symbol: symbol || null,
    setupScore: null,
    quality: 'UNAVAILABLE',
    componentScores: {
      setupStrength: null,
      volumeConfirmation: null,
      riskReward: null,
      technicalReadiness: null,
      dataCompleteness: null,
    },
    setupType: 'OTHER',
    setupConfidence: null,
    signal: 'UNAVAILABLE',
    reasons: [],
    warnings: ['NO_MARKET_DATA'],
    flags: [],
    dataAvailability: {
      price: false,
      volume: false,
      technicals: false,
      rsi: false,
      bollinger: false,
      sma: false,
      riskReward: false,
      volume: false,
      supportResistance: false,
      setupScore: false,
    },
    dataCompleteness: 0,
    marketDataStatus: 'unavailable',
    disclaimer: 'Technical Setup Intelligence is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

function buildSetupIntelligence(marketData, symbol) {
  if (!marketData) {
    return defaultSetupIntelligence(symbol);
  }

  const setupInfo = identifySetupType(marketData);
  const scoring = calculateSetupScore(marketData);
  const { score: setupScore, components: scoreComponents } = scoring;
  const quality = classifySetupQuality(setupScore);

  let signal = 'NEUTRAL';
  if (setupScore != null) {
    if (setupScore >= 85) signal = 'STRONG_BUY';
    else if (setupScore >= 70) signal = 'BUY';
    else if (setupScore >= 50) signal = 'NEUTRAL';
    else signal = 'AVOID';
  }

  const reasons = buildSetupReasons(marketData, setupInfo, scoreComponents);
  const warnings = buildSetupWarnings(marketData, setupInfo, scoreComponents);
  const flags = buildSetupFlags(marketData, setupInfo);

  const availability = calculateSetupDataAvailability(marketData);
  const availableCount = Object.values(availability).filter(Boolean).length;
  const totalCount = Object.keys(availability).length;
  const dataCompleteness = Math.round((availableCount / totalCount) * 100);

  return {
    symbol: symbol || marketData?.symbol || null,
    setupScore,
    quality,
    componentScores: scoreComponents,
    setupType: setupInfo.type,
    setupConfidence: setupInfo.confidence,
    signal,
    reasons,
    warnings,
    flags,
    dataAvailability: availability,
    dataCompleteness,
    marketDataStatus: marketData?.dataAvailability ? 'ok' : 'partial',
    price: n(marketData?.price) ?? null,
    sma20: n(marketData?.sma20) ?? null,
    sma50: n(marketData?.sma50) ?? null,
    rsi: n(marketData?.rsi) ?? null,
    relativeVolume: n(marketData?.relativeVolume) ?? null,
    riskReward: n(marketData?.riskReward) ?? null,
    bollingerBandwidth: n(marketData?.bollingerBandwidth) ?? null,
    squeeze: marketData?.squeeze === true,
    technicalReady: marketData?.technicalReady === true,
    directionBias: marketData?.directionBias || 'محايد',
    disclaimer: 'Technical Setup Intelligence is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

function rankSetupOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.setupScore ?? -1;
    const sb = b.setupScore ?? -1;
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
  identifySetupType,
  calculateSetupStrength,
  calculateVolumeConfirmation,
  calculateRiskRewardScore,
  calculateTechnicalReadiness,
  calculateSetupDataCompleteness,
  calculateSetupScore,
  classifySetupQuality,
  buildSetupReasons,
  buildSetupWarnings,
  buildSetupFlags,
  calculateSetupDataAvailability,
  buildSetupIntelligence,
  defaultSetupIntelligence,
  rankSetupOpportunities,
  setupWeights,
  qualityThresholds,
};

export default buildSetupIntelligence;
