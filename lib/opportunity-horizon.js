/**
 * Opportunity Horizon Evaluator (1–3 Month)
 *
 * Reusable methodology layer that consumes existing Hunter intelligence
 * and answers: "Does the currently available evidence support a credible
 * 1–3 month opportunity?"
 *
 * Pure function — no network calls, no fabrication, no look-ahead.
 * Missing data remains null. NaN/Infinity values are sanitized.
 *
 * Consumes:
 *   - Fundamental quality (from SEC/catalyst intelligence)
 *   - Price/volume behavior (from market-engine / swing intelligence)
 *   - Liquidity (from liquidity-intelligence / swing intelligence)
 *   - Institutional evidence (from B3)
 *   - Catalysts (from B6)
 *   - Market/sector regime (from C10)
 *   - Classical structure (from classical technical evidence)
 *   - Options context (from B2, when available)
 *   - Gamma context (when data exists)
 *   - Risk/fragility (assessed internally)
 *   - Data completeness
 *
 * Possible results:
 *   - HIGHEST_QUALITY
 *   - HIGH_RISK_REWARD
 *   - EARLY_WATCHLIST
 *   - NOT_READY
 *   - UNAVAILABLE
 */

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (v === Infinity) return max;
  if (v === -Infinity) return min;
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

const HORIZON_THRESHOLDS = Object.freeze({
  HIGHEST_QUALITY: 85,
  HIGH_RISK_REWARD: 70,
  EARLY_WATCHLIST: 55,
  MIN_DATA_COVERAGE: 40,
  MIN_CONFIDENCE: 35,
});

const DOMAIN_WEIGHTS = Object.freeze({
  fundamentalQuality: 0.15,
  priceVolumeBehavior: 0.18,
  liquidity: 0.12,
  institutionalEvidence: 0.12,
  catalysts: 0.10,
  marketSectorRegime: 0.10,
  classicalStructure: 0.10,
  optionsContext: 0.05,
  gammaContext: 0.03,
  riskFragility: 0.05,
});

function defaultHorizon(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    horizon: 'UNAVAILABLE',
    horizonScore: null,
    confidence: 0,
    confidenceLevel: 'UNKNOWN',
    dataCompleteness: 0,
    evidenceCoverage: 0,
    domains: {
      fundamentalQuality: null,
      priceVolumeBehavior: null,
      liquidity: null,
      institutionalEvidence: null,
      catalysts: null,
      marketSectorRegime: null,
      classicalStructure: null,
      optionsContext: null,
      gammaContext: null,
      riskFragility: null,
    },
    riskFragility: {
      score: null,
      factors: [],
    },
    confirmation: [],
    invalidation: [],
    watchItems: [],
    reasons: ['No evidence available for 1–3 month horizon evaluation'],
    warnings: ['NO_EVIDENCE_AVAILABLE'],
    flags: [],
    provenance: {
      intelligence: 'HORIZON',
      engine: 'Opportunity Horizon 1-3M',
    },
    disclaimer:
      'Opportunity Horizon evaluates whether available evidence supports a credible 1–3 month opportunity. ' +
      'This is analytical only — not a buy/sell recommendation. ' +
      'Missing evidence remains null — never fabricated. ' +
      'No guarantee of future price movement.',
  };
}

function extractDomainScore(domain, evidence) {
  if (!evidence || typeof evidence !== 'object') return null;
  const candidates = [
    evidence.score,
    evidence.horizonScore,
    evidence.confidence,
    evidence.qualityScore,
    evidence.aggregateScore,
  ];
  for (const c of candidates) {
    const v = n(c);
    if (v != null) return clamp(v);
  }
  return null;
}

function extractDataCompleteness(domain, evidence) {
  if (!evidence || typeof evidence !== 'object') return null;
  const v = n(evidence.dataCompleteness);
  if (v != null) return clamp(v);
  if (evidence.dataAvailability && typeof evidence.dataAvailability === 'object') {
    const vals = Object.values(evidence.dataAvailability).filter(Boolean);
    const total = Object.keys(evidence.dataAvailability).length;
    if (total > 0) return clamp(Math.round((vals.length / total) * 100));
  }
  return null;
}

function assessFundamentalQuality(secIntelligence, catalystIntelligence) {
  if (!secIntelligence && !catalystIntelligence) return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  if (secIntelligence && typeof secIntelligence === 'object') {
    const filingScore = n(secIntelligence.secScore) ?? n(secIntelligence.filingScore) ?? n(secIntelligence.score);
    if (filingScore != null) {
      score += (filingScore - 50) * 0.3;
      reasons.push(`SEC/filing quality score ${filingScore}/100`);
    }
    if (secIntelligence.insiderActivity != null) {
      reasons.push(`Insider activity: ${secIntelligence.insiderActivity}`);
    }
  }

  if (catalystIntelligence && typeof catalystIntelligence === 'object') {
    const catalystScore = n(catalystIntelligence.catalystScore);
    if (catalystScore != null) {
      score += (catalystScore - 50) * 0.2;
      reasons.push(`Catalyst quality score ${catalystScore}/100`);
    }
    const types = Array.isArray(catalystIntelligence.catalystTypes) ? catalystIntelligence.catalystTypes : [];
    if (types.length > 0) {
      reasons.push(`Catalyst types: ${types.slice(0, 3).join(', ')}`);
    }
  }

  return { score: clamp(score), reasons: reasons.slice(0, 4) };
}

function assessPriceVolumeBehavior(swingIntelligence, marketData) {
  if (!swingIntelligence && !marketData) return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  if (swingIntelligence && typeof swingIntelligence === 'object') {
    const swingScore = n(swingIntelligence.swingScore);
    if (swingScore != null) {
      score += (swingScore - 50) * 0.4;
      reasons.push(`Swing score ${swingScore}/100`);
    }
    const trendScore = n(swingIntelligence.componentScores?.trend);
    if (trendScore != null) {
      score += (trendScore - 50) * 0.2;
      reasons.push(`Trend score ${trendScore}/100`);
    }
    const momentumScore = n(swingIntelligence.componentScores?.momentum);
    if (momentumScore != null) {
      score += (momentumScore - 50) * 0.15;
      reasons.push(`Momentum score ${momentumScore}/100`);
    }
    const rvol = n(swingIntelligence.relativeVolume);
    if (rvol != null) {
      if (rvol >= 1.5) { score += 10; reasons.push(`RVOL ${rvol}x strong`); }
      else if (rvol >= 1.0) { score += 3; reasons.push(`RVOL ${rvol}x`); }
      else { score -= 5; reasons.push(`RVOL ${rvol}x weak`); }
    }
  }

  if (marketData && typeof marketData === 'object') {
    const price = n(marketData.price);
    const sma20 = n(marketData.sma20);
    const sma50 = n(marketData.sma50);
    if (price != null && sma50 != null && price > sma50) {
      score += 5;
      reasons.push('Price above SMA50');
    }
    if (price != null && sma20 != null && price > sma20) {
      score += 3;
      reasons.push('Price above SMA20');
    }
  }

  return { score: clamp(score), reasons: reasons.slice(0, 5) };
}

function assessLiquidity(liquidityIntelligence, swingIntelligence, marketData) {
  if (!liquidityIntelligence && !swingIntelligence && !marketData) return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  if (liquidityIntelligence && typeof liquidityIntelligence === 'object') {
    const liqScore = n(liquidityIntelligence.liquidityScore) ?? n(liquidityIntelligence.score);
    if (liqScore != null) {
      score += (liqScore - 50) * 0.5;
      reasons.push(`Liquidity score ${liqScore}/100`);
    }
    if (liquidityIntelligence.liquidityQuality) {
      reasons.push(`Liquidity quality: ${liquidityIntelligence.liquidityQuality}`);
    }
  }

  if (swingIntelligence && typeof swingIntelligence === 'object') {
    const volumeScore = n(swingIntelligence.componentScores?.volume);
    if (volumeScore != null) {
      score += (volumeScore - 50) * 0.2;
      reasons.push(`Volume score ${volumeScore}/100`);
    }
    const avgVol = n(swingIntelligence.averageVolume20);
    if (avgVol != null) {
      if (avgVol >= 1_000_000) { score += 8; reasons.push('Avg volume > 1M'); }
      else if (avgVol >= 500_000) { score += 4; reasons.push('Avg volume > 500k'); }
      else if (avgVol < 100_000) { score -= 8; reasons.push('Avg volume < 100k — fragile liquidity'); }
    }
  }

  if (marketData && typeof marketData === 'object') {
    const avgVol = n(marketData.averageVolume20);
    if (avgVol != null && avgVol < 100_000) {
      score -= 5;
      reasons.push('Low average volume — execution risk');
    }
  }

  return { score: clamp(score), reasons: reasons.slice(0, 4) };
}

function assessInstitutionalEvidence(institutionalRadar) {
  if (!institutionalRadar || typeof institutionalRadar !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  const instScore = n(institutionalRadar.institutionalScore) ?? n(institutionalRadar.rankScore) ?? n(institutionalRadar.decisionScore);
  if (instScore != null) {
    score += (instScore - 50) * 0.5;
    reasons.push(`Institutional score ${instScore}/100`);
  }
  if (institutionalRadar.institutionalActivity) {
    reasons.push(`Activity: ${institutionalRadar.institutionalActivity}`);
  }
  if (institutionalRadar.accumulationScore != null) {
    reasons.push(`Accumulation proxy ${institutionalRadar.accumulationScore}/100`);
  }

  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

function assessCatalysts(catalystIntelligence) {
  if (!catalystIntelligence || typeof catalystIntelligence !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  const catalystScore = n(catalystIntelligence.catalystScore);
  if (catalystScore != null) {
    score += (catalystScore - 50) * 0.6;
    reasons.push(`Catalyst score ${catalystScore}/100`);
  }
  const types = Array.isArray(catalystIntelligence.catalystTypes) ? catalystIntelligence.catalystTypes : [];
  if (types.length > 0) {
    reasons.push(`Active catalyst types: ${types.slice(0, 3).join(', ')}`);
  }
  const upcoming = catalystIntelligence.upcoming ||
    (Array.isArray(catalystIntelligence.catalysts) &&
     catalystIntelligence.catalysts.some((c) => c && c.upcoming === true));
  if (upcoming) {
    reasons.push('Upcoming catalysts present (future-dated)');
  }

  return { score: clamp(score), reasons: reasons.slice(0, 4), upcoming };
}

function assessMarketSectorRegime(marketRegime) {
  if (!marketRegime || typeof marketRegime !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  const regimeScore = n(marketRegime.regimeScore) ?? n(marketRegime.score);
  if (regimeScore != null) {
    score += (regimeScore - 50) * 0.5;
    reasons.push(`Regime score ${regimeScore}/100`);
  }
  if (marketRegime.label) reasons.push(`Regime: ${marketRegime.label}`);
  if (marketRegime.risk) reasons.push(`Risk level: ${marketRegime.risk}`);

  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

function assessClassicalStructure(classicalEvidence) {
  if (!classicalEvidence || typeof classicalEvidence !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  if (classicalEvidence.marketStructure) {
    const ms = classicalEvidence.marketStructure;
    if (ms.mssDetected) { score += 15; reasons.push('Market Structure Shift detected'); }
    if (ms.trend === 'BULLISH') { score += 10; reasons.push('Bullish market structure'); }
    else if (ms.trend === 'BEARISH') { score -= 10; reasons.push('Bearish market structure'); }
    if (ms.higherHighs && ms.higherLows) { score += 8; reasons.push('Higher highs + higher lows'); }
    if (ms.lowerHighs && ms.lowerLows) { score -= 8; reasons.push('Lower highs + lower lows'); }
  }

  if (classicalEvidence.fvg) {
    const fvg = classicalEvidence.fvg;
    if (fvg.detected) {
      const bullishGaps = (fvg.gaps || []).filter((g) => g.type === 'BULLISH').length;
      const bearishGaps = (fvg.gaps || []).filter((g) => g.type === 'BEARISH').length;
      if (bullishGaps > bearishGaps) { score += 5; reasons.push(`${bullishGaps} bullish FVG(s)`); }
      else if (bearishGaps > bullishGaps) { score -= 5; reasons.push(`${bearishGaps} bearish FVG(s)`); }
    }
  }

  if (classicalEvidence.breaker) {
    const br = classicalEvidence.breaker;
    if (br.detected) { score += 5; reasons.push('Breaker level identified'); }
  }

  if (classicalEvidence.liquiditySweep) {
    const ls = classicalEvidence.liquiditySweep;
    if (ls.detected && ls.sweepType === 'TURTLE_SOUP' && ls.returnConfirmed) {
      score += 8; reasons.push('Turtle Soup confirmed');
    }
  }

  if (classicalEvidence.crt) {
    const crt = classicalEvidence.crt;
    if (crt.confirmationState === 'CONFIRMED') { score += 10; reasons.push('CRT confirmation state'); }
    else if (crt.confirmationState === 'WATCH') { score += 3; reasons.push('CRT in watch state'); }
  }

  if (classicalEvidence.supportResistance) {
    const sr = classicalEvidence.supportResistance;
    if (sr.support != null && sr.resistance != null) {
      reasons.push(`Support ${sr.support} / Resistance ${sr.resistance}`);
    }
  }

  return { score: clamp(score), reasons: reasons.slice(0, 6) };
}

function assessOptionsContext(optionsIntelligence) {
  if (!optionsIntelligence || typeof optionsIntelligence !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  const decisionScore = n(optionsIntelligence.decision?.decisionScore) ?? n(optionsIntelligence.flow?.flowScore);
  if (decisionScore != null) {
    score += (decisionScore - 50) * 0.4;
    reasons.push(`Options decision score ${decisionScore}/100`);
  }
  if (optionsIntelligence.flow?.callPutPressure) {
    reasons.push(`Call/put pressure: ${optionsIntelligence.flow.callPutPressure}`);
  }
  if (optionsIntelligence.flow?.activityStrength && optionsIntelligence.flow.activityStrength !== 'UNAVAILABLE') {
    reasons.push(`Activity: ${optionsIntelligence.flow.activityStrength}`);
  }

  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

function assessGammaContext(gammaContext) {
  if (!gammaContext || typeof gammaContext !== 'object') return { score: null, reasons: [] };
  const reasons = [];
  let score = 50;

  if (gammaContext.availability === 'UNAVAILABLE' || gammaContext.availability === 'UNAVAILABLE') {
    reasons.push('Gamma data unavailable from current provider');
    return { score: null, reasons };
  }

  const gex = n(gammaContext.gex);
  if (gex != null) {
    score += gex > 0 ? 10 : -10;
    reasons.push(`GEX ${gex}`);
  }
  if (gammaContext.gammaConcentration) {
    reasons.push(`Gamma concentration: ${gammaContext.gammaConcentration}`);
  }
  if (gammaContext.dealerPositioning) {
    reasons.push(`Dealer positioning: ${gammaContext.dealerPositioning}`);
  }

  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

function assessRiskFragility(sources, horizonScore) {
  const factors = [];
  let score = 50;

  const availableCount = Object.values(sources).filter((v) => v != null && typeof v === 'object').length;
  if (availableCount === 0) { factors.push('NO_INTELLIGENCE'); score -= 30; }
  else if (availableCount < 3) { factors.push('PARTIAL_INTELLIGENCE'); score -= 10; }

  for (const [key, source] of Object.entries(sources)) {
    if (!source || typeof source !== 'object') continue;

    if (key === 'catalystIntelligence' && source.catalystRisk === 'HIGH') {
      factors.push('HIGH_CATALYST_RISK');
      score -= 15;
    }
    if (key === 'earlyExplosion' && source.explosionRisk === 'HIGH') {
      factors.push('HIGH_EXPLOSION_RISK');
      score -= 10;
    }
    if (key === 'swingIntelligence' && source.riskLevel === 'high') {
      factors.push('HIGH_SWING_RISK');
      score -= 8;
    }
    if (key === 'optionsIntelligence' && source.flow?.flowRiskLevel === 'HIGH') {
      factors.push('HIGH_OPTIONS_RISK');
      score -= 5;
    }
    if (key === 'institutionalRadar' && source.institutionalRisk === 'high') {
      factors.push('HIGH_INSTITUTIONAL_RISK');
      score -= 10;
    }
    if (key === 'pennyIntelligence' && source.riskLabel === 'HIGH VOLATILITY') {
      factors.push('HIGH_VOLATILITY');
      score -= 8;
    }
  }

  if (horizonScore != null && horizonScore < 40) {
    factors.push('LOW_HORIZON_SCORE');
    score -= 10;
  }

  return { score: clamp(score), factors: factors.slice(0, 8) };
}

function classifyHorizon(score, dataCompleteness, confidence, riskFragility) {
  if (score == null || dataCompleteness < HORIZON_THRESHOLDS.MIN_DATA_COVERAGE || confidence < HORIZON_THRESHOLDS.MIN_CONFIDENCE) {
    return 'UNAVAILABLE';
  }
  if (riskFragility != null && riskFragility.score != null && riskFragility.score < 30) {
    return 'NOT_READY';
  }
  if (score >= HORIZON_THRESHOLDS.HIGHEST_QUALITY) return 'HIGHEST_QUALITY';
  if (score >= HORIZON_THRESHOLDS.HIGH_RISK_REWARD) return 'HIGH_RISK_REWARD';
  if (score >= HORIZON_THRESHOLDS.EARLY_WATCHLIST) return 'EARLY_WATCHLIST';
  return 'NOT_READY';
}

function buildConfirmationInvalidation(domains, riskFragility) {
  const confirmation = [];
  const invalidation = [];
  const watchItems = [];

  if (domains.fundamentalQuality != null && domains.fundamentalQuality >= 60) {
    confirmation.push('Fundamental quality confirmed by SEC/catalyst evidence');
  } else if (domains.fundamentalQuality == null) {
    watchItems.push('Await fundamental/ SEC data');
    invalidation.push('Weak or missing fundamental evidence');
  }

  if (domains.priceVolumeBehavior != null && domains.priceVolumeBehavior >= 60) {
    confirmation.push('Price/volume structure supports the thesis');
  } else if (domains.priceVolumeBehavior == null) {
    watchItems.push('Await price/volume confirmation');
  }

  if (domains.liquidity != null && domains.liquidity >= 60) {
    confirmation.push('Liquidity sufficient for entry/exit');
  } else if (domains.liquidity != null && domains.liquidity < 40) {
    invalidation.push('Insufficient liquidity for practical execution');
  }

  if (domains.institutionalEvidence != null && domains.institutionalEvidence >= 55) {
    confirmation.push('Institutional interest detected');
  }

  if (domains.catalysts != null && domains.catalysts >= 55) {
    confirmation.push('Catalyst evidence present');
    if (domains.catalystsUpcoming) {
      watchItems.push('Catalyst is upcoming — monitor for confirmation');
    }
  }

  if (domains.marketSectorRegime != null && domains.marketSectorRegime >= 60) {
    confirmation.push('Market regime supportive');
  } else if (domains.marketSectorRegime != null && domains.marketSectorRegime < 40) {
    invalidation.push('Unfavorable market regime');
  }

  if (domains.classicalStructure != null && domains.classicalStructure >= 55) {
    confirmation.push('Classical technical structure aligned');
  }

  if (domains.riskFragility != null && domains.riskFragility < 35) {
    invalidation.push('High fragility detected — evidence insufficient or conflicting');
  }

  if (riskFragility && riskFragility.factors && riskFragility.factors.length > 0) {
    for (const f of riskFragility.factors) {
      if (f.includes('HIGH') || f.includes('FRAGILE')) {
        invalidation.push(`Fragility factor: ${f}`);
      }
    }
  }

  return {
    confirmation: confirmation.slice(0, 6),
    invalidation: invalidation.slice(0, 6),
    watchItems: watchItems.slice(0, 6),
  };
}

function buildHorizonReasons(domains, horizonScore, horizon, confidence, dataCompleteness) {
  const reasons = [];

  if (horizonScore != null) {
    reasons.push(`Horizon score: ${horizonScore}/100`);
  } else {
    reasons.push('Insufficient evidence for horizon score');
  }

  reasons.push(`Classification: ${horizon}`);

  if (confidence != null) {
    const confLabel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : confidence >= 40 ? 'Low' : 'Very Low';
    reasons.push(`Confidence: ${confLabel} (${Math.round(confidence)}%)`);
  }

  if (dataCompleteness != null) {
    reasons.push(`Data completeness: ${dataCompleteness}%`);
  }

  const availableDomains = Object.entries(domains).filter(([, v]) => v != null).length;
  const totalDomains = Object.keys(domains).length;
  reasons.push(`Evidence domains: ${availableDomains}/${totalDomains}`);

  return reasons.slice(0, 8);
}

function buildHorizonWarnings(horizon, dataCompleteness, confidence, domains) {
  const warnings = [];

  if (horizon === 'UNAVAILABLE') {
    warnings.push('HORIZON_UNAVAILABLE');
  }
  if (dataCompleteness != null && dataCompleteness < HORIZON_THRESHOLDS.MIN_DATA_COVERAGE) {
    warnings.push('LOW_DATA_COVERAGE');
  }
  if (confidence != null && confidence < HORIZON_THRESHOLDS.MIN_CONFIDENCE) {
    warnings.push('LOW_CONFIDENCE');
  }

  const missingDomains = Object.entries(domains).filter(([, v]) => v == null).map(([k]) => k);
  if (missingDomains.length > 5) {
    warnings.push('MOST_DOMAINS_UNAVAILABLE');
  } else if (missingDomains.length > 0) {
    warnings.push(`MISSING_DOMAINS: ${missingDomains.join(', ')}`);
  }

  return warnings;
}

function buildHorizonFlags(horizon, domains, riskFragility) {
  const flags = [];

  if (horizon === 'HIGHEST_QUALITY') flags.push('HIGHEST_QUALITY_HORIZON');
  else if (horizon === 'HIGH_RISK_REWARD') flags.push('HIGH_RISK_REWARD_HORIZON');
  else if (horizon === 'EARLY_WATCHLIST') flags.push('EARLY_WATCHLIST_HORIZON');
  else if (horizon === 'NOT_READY') flags.push('NOT_READY_HORIZON');

  const strongDomains = Object.entries(domains).filter(([, v]) => v != null && v >= 65).length;
  if (strongDomains >= 4) flags.push('MULTI_DOMAIN_CONFIRMED');

  if (riskFragility && riskFragility.score != null && riskFragility.score >= 70) {
    flags.push('LOW_FRAGILITY');
  } else if (riskFragility && riskFragility.score != null && riskFragility.score < 35) {
    flags.push('HIGH_FRAGILITY');
  }

  return flags;
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

export function buildOpportunityHorizon(symbol, inputs = {}) {
  const defaultResult = defaultHorizon(symbol);

  if (!symbol) {
    return defaultResult;
  }

  const {
    secIntelligence = null,
    catalystIntelligence = null,
    swingIntelligence = null,
    marketData = null,
    liquidityIntelligence = null,
    institutionalRadar = null,
    marketRegime = null,
    classicalEvidence = null,
    optionsIntelligence = null,
    gammaContext = null,
  } = inputs;

  const fundamental = assessFundamentalQuality(secIntelligence, catalystIntelligence);
  const priceVolume = assessPriceVolumeBehavior(swingIntelligence, marketData);
  const liquidity = assessLiquidity(liquidityIntelligence, swingIntelligence, marketData);
  const institutional = assessInstitutionalEvidence(institutionalRadar);
  const catalysts = assessCatalysts(catalystIntelligence);
  const regime = assessMarketSectorRegime(marketRegime);
  const classical = assessClassicalStructure(classicalEvidence);
  const options = assessOptionsContext(optionsIntelligence);
  const gamma = assessGammaContext(gammaContext);

  const domains = {
    fundamentalQuality: fundamental.score,
    priceVolumeBehavior: priceVolume.score,
    liquidity: liquidity.score,
    institutionalEvidence: institutional.score,
    catalysts: catalysts.score,
    marketSectorRegime: regime.score,
    classicalStructure: classical.score,
    optionsContext: options.score,
    gammaContext: gamma.score,
    riskFragility: null,
    catalystsUpcoming: catalysts.upcoming || false,
  };

  const availableDomainScores = Object.values(domains).filter((v) => v != null && typeof v === 'number');
  const rawScore = availableDomainScores.length > 0
    ? availableDomainScores.reduce((a, b) => a + b, 0) / availableDomainScores.length
    : null;

  const riskFragility = assessRiskFragility(
    { secIntelligence, catalystIntelligence, swingIntelligence, marketData, liquidityIntelligence, institutionalRadar, marketRegime, classicalEvidence, optionsIntelligence, gammaContext },
    rawScore
  );
  domains.riskFragility = riskFragility.score;

  const horizonScore = rawScore != null ? clamp(Math.round(rawScore)) : null;
  const dataCompleteness = Object.values(domains).filter((v) => v != null).length > 0
    ? clamp(Math.round((Object.values(domains).filter((v) => v != null).length / Object.keys(domains).length) * 100))
    : 0;

  const confidence = dataCompleteness > 0
    ? clamp(dataCompleteness * 0.7 + (availableDomainScores.length / Object.keys(domains).length) * 30)
    : 0;

  const horizon = classifyHorizon(horizonScore, dataCompleteness, confidence, riskFragility);

  const { confirmation, invalidation, watchItems } = buildConfirmationInvalidation(domains, riskFragility);

  const reasons = buildHorizonReasons(domains, horizonScore, horizon, confidence, dataCompleteness);
  const warnings = buildHorizonWarnings(horizon, dataCompleteness, confidence, domains);
  const flags = buildHorizonFlags(horizon, domains, riskFragility);

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    horizon,
    horizonScore,
    confidence: round(confidence, 1),
    confidenceLevel: confidence >= 80 ? 'HIGH' : confidence >= 60 ? 'MODERATE' : confidence >= 40 ? 'LOW' : 'VERY_LOW',
    dataCompleteness,
    evidenceCoverage: Object.keys(domains).filter((k) => k !== 'riskFragility' && domains[k] != null).length,
    domains,
    riskFragility: {
      score: riskFragility.score,
      factors: riskFragility.factors,
    },
    confirmation,
    invalidation,
    watchItems,
    reasons,
    warnings,
    flags,
    provenance: {
      intelligence: 'HORIZON',
      engine: 'Opportunity Horizon 1-3M',
    },
    disclaimer:
      'Opportunity Horizon evaluates whether available evidence supports a credible 1–3 month opportunity. ' +
      'This is analytical only — not a buy/sell recommendation. ' +
      'Missing evidence remains null — never fabricated. ' +
      'No guarantee of future price movement.',
  };
}

function defaultOpportunityHorizon(symbol) {
  return defaultHorizon(symbol || null);
}

export {
  HORIZON_THRESHOLDS,
  DOMAIN_WEIGHTS,
  defaultOpportunityHorizon,
};
