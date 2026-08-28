/**
 * Liquidity Intelligence Engine (A8)
 *
 * Market-wide liquidity quality analysis built on existing Yahoo Finance market data.
 * Pure function — no network calls. Reuses lib/market-engine.js outputs.
 *
 * Classifies liquidity tiers, detects liquidity traps, assesses volume profile,
 * and provides liquidity-based risk intelligence.
 *
 * No BUY/SELL guarantees. Missing data = null. No fabricated values.
 */

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));

const liquidityWeights = Object.freeze({
  volumeTier: 0.30,
  dollarVolume: 0.25,
  volumeConfirmation: 0.20,
  liquidityDepth: 0.15,
  dataCompleteness: 0.10,
});

const qualityThresholds = Object.freeze({
  EXCELLENT: 85,
  GOOD: 70,
  MODERATE: 45,
  POOR: 25,
});

function n(val) {
  if (val == null) return null;
  const x = Number(val);
  return Number.isFinite(x) ? x : null;
}

function calculateDollarVolume(price, volume) {
  const p = n(price);
  const v = n(volume);
  if (p == null || v == null || p <= 0 || v <= 0) return null;
  return p * v;
}

function classifyDollarVolume(dv) {
  if (dv == null) return 'unavailable';
  const d = n(dv);
  if (d == null) return 'unavailable';
  if (d >= 25_000_000) return 'excellent';
  if (d >= 10_000_000) return 'good';
  if (d >= 2_500_000) return 'moderate';
  if (d >= 500_000) return 'weak';
  return 'poor';
}

function calculateVolumeTierScore(avgVolume) {
  const av = n(avgVolume);
  if (av == null) return null;
  if (av >= 1_000_000) return 100;
  if (av >= 500_000) return 85;
  if (av >= 250_000) return 70;
  if (av >= 100_000) return 55;
  return 25;
}

function calculateDollarVolumeScore(dv) {
  if (dv == null) return null;
  if (dv >= 25_000_000) return 100;
  if (dv >= 10_000_000) return 85;
  if (dv >= 2_500_000) return 70;
  if (dv >= 500_000) return 40;
  return 15;
}

function calculateVolumeConfirmationScore(rvol) {
  const r = n(rvol);
  if (r == null) return null;
  if (r >= 2.0) return 100;
  if (r >= 1.5) return 85;
  if (r >= 1.0) return 65;
  if (r >= 0.5) return 30;
  return 10;
}

function calculateLiquidityDepthScore(marketData) {
  // Uses Bollinger bandwidth as a volatility/proxy for liquidity depth.
  // Low bandwidth = stable/liquid, high bandwidth = volatile/stress.
  const bb = n(marketData?.bollingerBandwidth);
  if (bb == null) return null;
  if (bb < 4) return 100;
  if (bb < 7) return 80;
  if (bb < 10) return 60;
  if (bb < 15) return 40;
  return 20;
}

function classifyLiquidityQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= qualityThresholds.EXCELLENT) return 'EXCELLENT';
  if (score >= qualityThresholds.GOOD) return 'GOOD';
  if (score >= qualityThresholds.MODERATE) return 'MODERATE';
  if (score >= qualityThresholds.POOR) return 'POOR';
  return 'CRITICAL';
}

function detectLiquidityTraps(marketData) {
  const traps = [];
  const rvol = n(marketData?.relativeVolume);
  const price = n(marketData?.price);
  const volume = n(marketData?.volume);
  const avgVol = n(marketData?.averageVolume20);
  const dv = calculateDollarVolume(price, volume);

  if (rvol != null && rvol >= 1.5 && dv != null && dv < 1_000_000) {
    traps.push('HIGH_RVOL_LOW_DOLLAR_VOLUME');
  }

  if (dv != null && dv < 500_000) {
    traps.push('LOW_DOLLAR_VOLUME');
  }

  if (avgVol != null && avgVol < 100_000) {
    traps.push('THIN_TRADING');
  }

  if (rvol != null && rvol >= 2.0 && volumeScoreLow(marketData)) {
    traps.push('VOLUME_SPIKE_LOW_LIQUIDITY');
  }

  return traps;
}

function volumeScoreLow(marketData) {
  const vqs = n(marketData?.volumeScore);
  if (vqs == null) return false;
  return vqs < 50;
}

function assessVolumeProfile(marketData) {
  const price = n(marketData?.price);
  const volume = n(marketData?.volume);
  const avgVol = n(marketData?.averageVolume20);
  const rvol = n(marketData?.relativeVolume);

  if (price == null || volume == null || avgVol == null) return null;

  // Volume concentration: current volume vs average (RVOL proxy)
  const concentration = rvol != null ? clamp(rvol * 17, 0, 100) : null;

  // Dollar volume depth
  const dv = calculateDollarVolume(price, volume);
  const dvClass = classifyDollarVolume(dv);

  // Average dollar volume (20-day)
  const avgDv = calculateDollarVolume(price, avgVol);
  const avgDvClass = classifyDollarVolume(avgDv);

  return {
    currentDollarVolume: dv,
    currentDollarVolumeClass: dvClass,
    averageDollarVolume: avgDv,
    averageDollarVolumeClass: avgDvClass,
    volumeConcentration: concentration,
    volumeConcentrationClass: concentration != null
      ? (concentration >= 85 ? 'HIGH' : concentration >= 65 ? 'MODERATE' : 'LOW')
      : null,
  };
}

function calculateLiquidityRisk(marketData) {
  let risk = 25;
  const reasons = [];

  const dv = calculateDollarVolume(n(marketData?.price), n(marketData?.volume));
  const traps = detectLiquidityTraps(marketData);

  if (dv != null) {
    if (dv < 250_000) { risk += 40; reasons.push('Very low dollar volume'); }
    else if (dv < 500_000) { risk += 30; reasons.push('Low dollar volume'); }
    else if (dv < 1_000_000) { risk += 15; reasons.push('Moderate dollar volume'); }
    else { risk -= 10; reasons.push('Healthy dollar volume'); }
  }

  const avgVol = n(marketData?.averageVolume20);
  if (avgVol != null) {
    if (avgVol < 100_000) { risk += 25; reasons.push('Thin trading - avg volume < 100K'); }
    else if (avgVol < 250_000) { risk += 10; reasons.push('Below-average liquidity'); }
    else { risk -= 5; reasons.push('Adequate average volume'); }
  }

  if (traps.includes('HIGH_RVOL_LOW_DOLLAR_VOLUME')) { risk += 20; reasons.push('Liquidity trap: high RVOL + low dollar volume'); }
  if (traps.includes('LOW_DOLLAR_VOLUME')) { risk += 15; reasons.push('Critical dollar volume'); }
  if (traps.includes('THIN_TRADING')) { risk += 15; reasons.push('Thin trading activity'); }

  const rvol = n(marketData?.relativeVolume);
  if (rvol != null && rvol < 0.5) { risk += 10; reasons.push('Below-average volume'); }

  const bb = n(marketData?.bollingerBandwidth);
  if (bb != null && bb > 10 && (dv != null && dv < 2_500_000)) {
    risk += 15; reasons.push('High volatility with low liquidity');
  }

  risk = clamp(risk);
  const level = risk >= 75 ? 'CRITICAL' : risk >= 60 ? 'HIGH' : risk >= 40 ? 'MODERATE' : risk >= 25 ? 'LOW' : 'MINIMAL';

  return { score: Math.round(risk), level, reasons: reasons.slice(0, 5) };
}

function calculateLiquidityDataAvailability(marketData) {
  return {
    price: n(marketData?.price) != null,
    volume: n(marketData?.volume) != null,
    averageVolume: n(marketData?.averageVolume20) != null,
    relativeVolume: n(marketData?.relativeVolume) != null,
    bollinger: n(marketData?.bollingerBandwidth) != null,
    volumeScore: n(marketData?.volumeScore) != null,
  };
}

function calculateLiquidityCompleteness(marketData) {
  const required = ['price', 'volume', 'averageVolume20', 'relativeVolume', 'bollingerBandwidth', 'volumeScore'];
  let count = 0;
  for (const key of required) {
    if (marketData?.[key] != null) count++;
  }
  return Math.round((count / required.length) * 100);
}

function buildLiquidityIntelligence(marketData, symbol) {
  if (!marketData) {
    return defaultLiquidityIntelligence(symbol);
  }

  const price = n(marketData?.price);
  const volume = n(marketData?.volume);
  const avgVol = n(marketData?.averageVolume20);
  const rvol = n(marketData?.relativeVolume);
  const bb = n(marketData?.bollingerBandwidth);
  const volumeScore = n(marketData?.volumeScore);
  const dv = calculateDollarVolume(price, volume);
  const avgDv = calculateDollarVolume(price, avgVol);

  const componentScores = {
    volumeTier: calculateVolumeTierScore(avgVol),
    dollarVolume: calculateDollarVolumeScore(dv),
    volumeConfirmation: calculateVolumeConfirmationScore(rvol),
    liquidityDepth: calculateLiquidityDepthScore(marketData),
    dataCompleteness: calculateLiquidityCompleteness(marketData),
  };

  const weighted = [
    { score: componentScores.volumeTier, weight: liquidityWeights.volumeTier },
    { score: componentScores.dollarVolume, weight: liquidityWeights.dollarVolume },
    { score: componentScores.volumeConfirmation, weight: liquidityWeights.volumeConfirmation },
    { score: componentScores.liquidityDepth, weight: liquidityWeights.liquidityDepth },
    { score: componentScores.dataCompleteness, weight: liquidityWeights.dataCompleteness },
  ];

  const available = weighted.filter(w => w.score != null);
  const dataComponents = available.filter(w => w.score != componentScores.dataCompleteness || componentScores.dataCompleteness == null);
  const hasLiquidityData = dataComponents.length > 0;
  let liquidityScore = null;

  if (!hasLiquidityData) {
    liquidityScore = null;
  } else {
    const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
    const weightedSum = available.reduce((sum, w) => sum + w.score * w.weight, 0);
    liquidityScore = Math.round(clamp(weightedSum / totalWeight));
  }

  const quality = classifyLiquidityQuality(liquidityScore);
  const traps = detectLiquidityTraps(marketData);
  const profile = assessVolumeProfile(marketData);
  const risk = calculateLiquidityRisk(marketData);

  const reasons = buildLiquidityReasons(marketData, liquidityScore, quality, traps, risk, profile);
  const warnings = buildLiquidityWarnings(marketData, liquidityScore, quality, traps);
  const flags = buildLiquidityFlags(marketData, liquidityScore, quality, traps);

  const availability = calculateLiquidityDataAvailability(marketData);
  const availCount = Object.values(availability).filter(Boolean).length;
  const totalCount = Object.keys(availability).length;
  const dataCompleteness = Math.round((availCount / totalCount) * 100);

  return {
    symbol: symbol || marketData?.symbol || null,
    liquidityScore,
    quality,
    componentScores,
    liquidityTier: componentScores.volumeTier != null
      ? (componentScores.volumeTier >= 100 ? 'EXCELLENT' : componentScores.volumeTier >= 85 ? 'GOOD' : componentScores.volumeTier >= 70 ? 'MODERATE' : componentScores.volumeTier >= 55 ? 'WEAK' : 'CRITICAL')
      : null,
    dollarVolume: dv,
    dollarVolumeClass: classifyDollarVolume(dv),
    averageDollarVolume: avgDv,
    averageDollarVolumeClass: classifyDollarVolume(avgDv),
    averageVolume20: avgVol,
    relativeVolume: rvol,
    volume: volume,
    price: price,
    bollingerBandwidth: bb,
    volumeScore: volumeScore,
    liquidityTraps: traps,
    liquidityTrapCount: traps.length,
    volumeProfile: profile,
    liquidityRisk: risk,
    reasons,
    warnings,
    flags,
    dataAvailability: availability,
    dataCompleteness,
    technicalReady: marketData?.technicalReady === true,
    marketDataStatus: marketData?.dataAvailability ? 'ok' : 'partial',
    disclaimer: 'Liquidity Intelligence is analytical only. Not a buy/sell recommendation. Volume spikes do not guarantee liquidity. Data from Yahoo Finance.',
  };
}

function buildLiquidityReasons(marketData, score, quality, traps, risk, profile) {
  const reasons = [];

  if (score != null) {
    reasons.push(`Liquidity quality: ${quality} (${score}/100)`);
  } else {
    reasons.push('Insufficient volume data for liquidity assessment');
  }

  const dv = calculateDollarVolume(n(marketData?.price), n(marketData?.volume));
  if (dv != null) {
    const dvClass = classifyDollarVolume(dv);
    reasons.push(`Dollar volume: $${Number((dv / 1_000_000).toFixed(1))}M (${dvClass})`);
  }

  const rvol = n(marketData?.relativeVolume);
  if (rvol != null) {
    if (rvol >= 2.0) reasons.push(`High RVOL ${rvol.toFixed(2)}x — volume surge`);
    else if (rvol >= 1.0) reasons.push(`RVOL ${rvol.toFixed(2)}x — above average`);
    else reasons.push(`RVOL ${rvol.toFixed(2)}x — below average volume`);
  }

  const avgVol = n(marketData?.averageVolume20);
  if (avgVol != null) {
    if (avgVol >= 1_000_000) reasons.push(`Average volume ${Math.round(avgVol / 1_000_000)}M — excellent depth`);
    else if (avgVol >= 500_000) reasons.push(`Average volume ${Math.round(avgVol / 1_000)}K — good depth`);
    else if (avgVol >= 100_000) reasons.push(`Average volume ${Math.round(avgVol / 1_000)}K — adequate`);
    else reasons.push(`Average volume ${Math.round(avgVol / 1_000)}K — thin trading`);
  }

  if (traps.length > 0) {
    reasons.push(`Liquidity traps: ${traps.join(', ')}`);
  }

  if (risk?.level && risk.level !== 'MINIMAL') {
    reasons.push(`Liquidity risk: ${risk.level} (${risk.score}/100)`);
  }

  return reasons.slice(0, 6);
}

function buildLiquidityWarnings(marketData, score, quality, traps) {
  const warnings = [];

  if (!marketData) {
    warnings.push('NO_MARKET_DATA');
    return warnings;
  }

  if (!marketData.technicalReady) {
    warnings.push('INCOMPLETE_TECHNICAL_DATA');
  }

  if (score != null) {
    if (score < 30) warnings.push('CRITICAL_LIQUIDITY');
    else if (score < 50) warnings.push('POOR_LIQUIDITY');
    else if (score < 70) warnings.push('MODERATE_LIQUIDITY');
  }

  if (traps.includes('HIGH_RVOL_LOW_DOLLAR_VOLUME')) {
    warnings.push('LIQUIDITY_TRAP_HIGH_RVOL');
  }
  if (traps.includes('LOW_DOLLAR_VOLUME')) {
    warnings.push('CRITICAL_DOLLAR_VOLUME');
  }
  if (traps.includes('THIN_TRADING')) {
    warnings.push('THIN_TRADING');
  }
  if (traps.includes('VOLUME_SPIKE_LOW_LIQUIDITY')) {
    warnings.push('VOLUME_SPIKE_LOW_LIQUIDITY');
  }

  const rvol = n(marketData?.relativeVolume);
  if (rvol != null && rvol < 1.0) {
    warnings.push('BELOW_AVERAGE_VOLUME');
  }

  const dv = calculateDollarVolume(n(marketData?.price), n(marketData?.volume));
  if (dv != null && dv < 250_000) {
    warnings.push('VERY_LOW_DOLLAR_VOLUME');
  }

  const bb = n(marketData?.bollingerBandwidth);
  if (bb != null && bb > 10 && dv != null && dv < 2_500_000) {
    warnings.push('HIGH_VOLATILITY_LOW_LIQUIDITY');
  }

  return warnings;
}

function buildLiquidityFlags(marketData, score, quality, traps) {
  const flags = [];

  if (quality) flags.push(`LIQ_${quality}`);

  if (score != null) {
    if (score >= 80) flags.push('HIGH_LIQUIDITY');
    if (score <= 30) flags.push('LOW_LIQUIDITY');
  }

  for (const trap of traps) {
    flags.push(`TRAP_${trap}`);
  }

  const rvol = n(marketData?.relativeVolume);
  if (rvol != null && rvol >= 2.0) flags.push('HIGH_RVOL');
  if (rvol != null && rvol < 0.5) flags.push('LOW_RVOL');

  const dv = calculateDollarVolume(n(marketData?.price), n(marketData?.volume));
  if (dv != null && dv < 500_000) flags.push('LOW_DOLLAR_VOLUME');

  const bb = n(marketData?.bollingerBandwidth);
  if (bb != null && bb > 10) flags.push('HIGH_VOLATILITY');
  if (bb != null && bb < 4) flags.push('LOW_VOLATILITY');

  const avgVol = n(marketData?.averageVolume20);
  if (avgVol != null && avgVol < 100_000) flags.push('THIN_TRADING');

  const volume = n(marketData?.volume);
  if (volume != null && volume === 0) flags.push('ZERO_VOLUME');

  return flags;
}

function defaultLiquidityIntelligence(symbol) {
  return {
    symbol: symbol || null,
    liquidityScore: null,
    quality: 'UNAVAILABLE',
    componentScores: {
      volumeTier: null,
      dollarVolume: null,
      volumeConfirmation: null,
      liquidityDepth: null,
      dataCompleteness: null,
    },
    liquidityTier: null,
    dollarVolume: null,
    dollarVolumeClass: 'unavailable',
    averageDollarVolume: null,
    averageDollarVolumeClass: 'unavailable',
    averageVolume20: null,
    relativeVolume: null,
    volume: null,
    price: null,
    bollingerBandwidth: null,
    volumeScore: null,
    liquidityTraps: [],
    liquidityTrapCount: 0,
    volumeProfile: null,
    liquidityRisk: { score: null, level: 'UNAVAILABLE', reasons: [] },
    reasons: [],
    warnings: ['NO_MARKET_DATA'],
    flags: [],
    dataAvailability: {
      price: false,
      volume: false,
      averageVolume: false,
      relativeVolume: false,
      bollinger: false,
      volumeScore: false,
    },
    dataCompleteness: 0,
    technicalReady: false,
    marketDataStatus: 'unavailable',
    disclaimer: 'Liquidity Intelligence is analytical only. Not a buy/sell recommendation. Volume spikes do not guarantee liquidity. Data from Yahoo Finance.',
  };
}

function rankLiquidityOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.liquidityScore ?? -1;
    const sb = b.liquidityScore ?? -1;
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
  calculateDollarVolume,
  classifyDollarVolume,
  calculateVolumeTierScore,
  calculateDollarVolumeScore,
  calculateVolumeConfirmationScore,
  calculateLiquidityDepthScore,
  classifyLiquidityQuality,
  detectLiquidityTraps,
  assessVolumeProfile,
  calculateLiquidityRisk,
  calculateLiquidityDataAvailability,
  calculateLiquidityCompleteness,
  buildLiquidityReasons,
  buildLiquidityWarnings,
  buildLiquidityFlags,
  buildLiquidityIntelligence,
  defaultLiquidityIntelligence,
  rankLiquidityOpportunities,
  liquidityWeights,
  qualityThresholds,
};

export default buildLiquidityIntelligence;
