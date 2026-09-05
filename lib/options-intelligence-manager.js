/**
 * Options Intelligence Manager (B2)
 *
 * Unified orchestration layer for options intelligence.
 * Pure function module — no network calls in the manager itself.
 *
 * Composes outputs from:
 *   A2  — Options Intelligence (lib/options-intelligence.js)
 *   A2  — Options Provider (lib/options-provider.js) [contracts passed in]
 *   A6  — SEC EDGAR (lib/sec-filings.js) [passed in as secIntelligence, optional]
 *
 * Produces a normalized B2 Options Intelligence result suitable for
 * downstream Decision layers:
 *   - Opportunity Ranking
 *   - Trade Plan Engine
 *   - AI Explanation
 *   - Market Regime Center
 *
 * No BUY/SELL guarantees. Missing data = null. No fabricated values.
 * Directional flow (bullish/bearish) is ONLY derived from verifiable
 * call/put volume and premium pressure — never assumed.
 */

import {
  n,
  buildOptionsIntelligence,
  buildOptionsFlowIntelligence,
  rankOptionsContracts,
  buildBestContractSummary,
  buildSymbolDecisionSummary,
  buildSymbolStrategySummary,
  enrichStrategyWithDecision,
  selectRecommendedStrategy,
  calculateCallPutPressure,
  calculatePremiumPressure,
  calculateFlowConfidence,
  calculateVolumeOIActivity,
  classifyFlowDirection,
  classifyContractQuality,
  classifyDecisionStatus,
} from './options-intelligence.js';

const clamp = (v, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));

function nowISO() {
  return new Date().toISOString();
}

function average(values) {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function median(values) {
  const valid = values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 0) {
    return (valid[mid - 1] + valid[mid]) / 2;
  }
  return valid[mid];
}

function classifyActivityScore(strength) {
  const map = {
    VERY_HIGH: 100,
    HIGH: 80,
    NORMAL: 60,
    LOW: 40,
    UNAVAILABLE: null,
  };
  return map[strength] ?? null;
}

function classifyConviction(confidence) {
  if (confidence == null) return 'UNAVAILABLE';
  const c = n(confidence);
  if (c == null) return 'UNAVAILABLE';
  if (c >= 80) return 'HIGH';
  if (c >= 60) return 'MEDIUM';
  if (c >= 40) return 'LOW';
  return 'UNAVAILABLE';
}

function classifyQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  const s = n(score);
  if (s == null) return 'UNAVAILABLE';
  if (s >= 80) return 'EXCELLENT';
  if (s >= 65) return 'GOOD';
  if (s >= 50) return 'MODERATE';
  if (s >= 35) return 'WEAK';
  return 'WEAK';
}

function classifyAction(decisionStatus, callPressure, putPressure) {
  if (decisionStatus === 'HIGH_QUALITY') return 'CONSIDER_OPENING';
  if (decisionStatus === 'GOOD_QUALITY') return 'MONITOR';
  if (decisionStatus === 'WATCH') return 'WATCH';
  if (decisionStatus === 'LOW_QUALITY') return 'AVOID';
  return 'INSUFFICIENT_DATA';
}

function buildKeySignals(contracts, flow, pressure, premiumPressure) {
  const signals = [];

  if (flow.callPutPressure && flow.callPutPressure !== 'UNAVAILABLE') {
    signals.push(`Flow pressure: ${flow.callPutPressure}`);
  }

  if (flow.activityStrength && flow.activityStrength !== 'UNAVAILABLE') {
    signals.push(`Activity level: ${flow.activityStrength}`);
  }

  if (flow.volumeToOIRatio != null) {
    const ratio = flow.volumeToOIRatio;
    if (ratio >= 2) {
      signals.push(`High volume/OI ratio (${ratio.toFixed(2)})`);
    } else if (ratio < 0.5) {
      signals.push(`Low volume/OI ratio (${ratio.toFixed(2)})`);
    }
  }

  if (premiumPressure.premiumPressureScore != null) {
    const pv = premiumPressure.premiumPressureScore;
    if (pv > 65) {
      signals.push(`Call premium dominance (${pv}%)`);
    } else if (pv < 35) {
      signals.push(`Put premium dominance (${100 - pv}%)`);
    }
  }

  const callContracts = contracts.filter(
    (c) => c.optionType === 'CALL' || c.side === 'CALL'
  );
  const putContracts = contracts.filter(
    (c) => c.optionType === 'PUT' || c.side === 'PUT'
  );

  if (callContracts.length > 0) {
    const callVol = callContracts.reduce(
      (sum, c) => sum + (n(c.volume) || 0),
      0
    );
    signals.push(`Call contracts: ${callContracts.length}, volume ${callVol}`);
  }

  if (putContracts.length > 0) {
    const putVol = putContracts.reduce(
      (sum, c) => sum + (n(c.volume) || 0),
      0
    );
    signals.push(`Put contracts: ${putContracts.length}, volume ${putVol}`);
  }

  const hasHighIV = contracts.some(
    (c) => c.impliedVolatility != null && c.impliedVolatility > 0.6
  );
  if (hasHighIV) {
    signals.push('Elevated implied volatility detected');
  }

  const hasLowIV = contracts.some(
    (c) => c.impliedVolatility != null && c.impliedVolatility < 0.3
  );
  if (hasLowIV) {
    signals.push('Low implied volatility detected');
  }

  return signals;
}

function buildRisks(ranking, flow, contracts) {
  const risks = [];
  const seen = new Set();

  function add(label, severity, description) {
    const key = `${label}:${severity}`;
    if (!seen.has(key)) {
      seen.add(key);
      risks.push({ label, severity, description });
    }
  }

  if (ranking && Array.isArray(ranking)) {
    for (const r of ranking) {
      const warnings = r.contractWarnings || [];
      for (const w of warnings) {
        if (w.includes('Wide spread')) add('WIDE_SPREAD', 'HIGH', w);
        else if (w.includes('Short DTE')) add('SHORT_DTE', 'HIGH', w);
        else if (w.includes('Extreme IV')) add('HIGH_IV', 'HIGH', w);
        else if (w.includes('Low volume')) add('LOW_VOLUME', 'LOW', w);
        else if (w.includes('Low open interest')) add('LOW_OI', 'LOW', w);
        else if (w.includes('Far OTM')) add('FAR_OTM', 'MEDIUM', w);
      }
    }
  }

  if (flow && flow.flowRiskFlags && Array.isArray(flow.flowRiskFlags)) {
    for (const flag of flow.flowRiskFlags) {
      if (flag === 'EXTREME_VOLUME_OI') {
        add('EXTREME_FLOW_ACTIVITY', 'HIGH', 'Extreme volume to open interest ratio');
      } else if (flag === 'CONTRADICTORY_PRESSURE') {
        add('CONTRADICTORY_PRESSURE', 'MEDIUM', 'Volume and open interest signals diverge');
      }
    }
  }

  for (const c of contracts) {
    const dte = n(c.daysToExpiration);
    if (dte != null && dte <= 3) {
      add('EXTREME_DECAY', 'HIGH', 'Contracts with 0-3 DTE face extreme time decay');
      break;
    }
  }

  for (const c of contracts) {
    const iv = n(c.impliedVolatility);
    if (iv != null && iv > 1.0) {
      add('EXTREME_IV', 'HIGH', 'Implied volatility above 100%');
      break;
    }
  }

  return risks;
}

function buildThesis(callScore, putScore, bullishFlowScore, bearishFlowScore, unusualActivityScore, decisionStatus, callPressure, putPressure) {
  const parts = [];

  if (decisionStatus === 'HIGH_QUALITY') {
    parts.push('High-quality options setup detected');
  } else if (decisionStatus === 'GOOD_QUALITY') {
    parts.push('Moderate options setup with room for monitoring');
  } else if (decisionStatus === 'WATCH') {
    parts.push('Options setup warrants monitoring');
  } else if (decisionStatus === 'LOW_QUALITY') {
    parts.push('Options setup shows low quality signals');
  }

  if (callPressure && callPressure !== 'UNAVAILABLE') {
    if (callPressure === 'CALL_PRESSURE') {
      parts.push('call buying pressure dominates the chain');
    } else if (callPressure === 'PUT_PRESSURE') {
      parts.push('put selling pressure dominates the chain');
    } else {
      parts.push('call and put activity is balanced');
    }
  }

  if (putPressure && putPressure !== 'UNAVAILABLE') {
    if (putPressure === 'PUT_PRESSURE') {
      parts.push('directional put interest increasing');
    }
  }

  if (unusualActivityScore != null && unusualActivityScore >= 80) {
    parts.push('unusual volume activity detected');
  } else if (unusualActivityScore != null && unusualActivityScore >= 60) {
    parts.push('above-average volume activity observed');
  }

  if (!parts.length) {
    parts.push('Insufficient options data to generate a meaningful thesis');
  }

  return parts.join('; ') + '.';
}

function buildDataQuality(contracts, flow, providerStatus) {
  const hasCalls = contracts.some(
    (c) => c.optionType === 'CALL' || c.optionType === 'call'
  );
  const hasPuts = contracts.some(
    (c) => c.optionType === 'PUT' || c.optionType === 'put'
  );
  const hasVolume = contracts.some(
    (c) => n(c.volume) != null && c.volume > 0
  );
  const hasOI = contracts.some(
    (c) => n(c.openInterest) != null && c.openInterest > 0
  );
  const hasIV = contracts.some(
    (c) => n(c.impliedVolatility) != null
  );
  const hasPremium = contracts.some(
    (c) => n(c.premium) != null
  );
  const hasBidAsk = contracts.some(
    (c) => n(c.bid) != null && n(c.ask) != null
  );

  const checks = [
    hasCalls,
    hasPuts,
    hasVolume,
    hasOI,
    hasIV,
    hasPremium,
    hasBidAsk,
  ];

  const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  let available = false;
  if (providerStatus && typeof providerStatus.available === 'boolean') {
    available = providerStatus.available;
  } else if (contracts.length > 0 && hasPremium && hasVolume && hasOI) {
    available = true;
  }

  return {
    available,
    completeness,
    hasCalls,
    hasPuts,
    hasVolume,
    hasOI,
    hasIV,
    hasPremium,
    hasBidAsk,
    provider: providerStatus?.provider || flow?.dataStatus === 'complete' ? 'yahoo' : null,
    dataStatus: flow?.dataStatus || (completeness === 100 ? 'complete' : completeness > 0 ? 'partial' : 'unavailable'),
  };
}

function buildDefaultCallsPuts(contracts, flow) {
  const callContracts = contracts.filter(
    (c) => c.optionType === 'CALL' || c.optionType === 'call'
  );
  const putContracts = contracts.filter(
    (c) => c.optionType === 'PUT' || c.optionType === 'put'
  );

  const callIntelligences = callContracts.map(buildOptionsIntelligence);
  const putIntelligences = putContracts.map(buildOptionsIntelligence);

  const callScores = callIntelligences
    .map((i) => i.optionsScore)
    .filter((s) => s != null);
  const putScores = putIntelligences
    .map((i) => i.optionsScore)
    .filter((s) => s != null);

  const callScore = callScores.length > 0
    ? Math.round(callScores.reduce((a, b) => a + b, 0) / callScores.length)
    : null;

  const putScore = putScores.length > 0
    ? Math.round(putScores.reduce((a, b) => a + b, 0) / putScores.length)
    : null;

  return {
    calls: {
      count: callContracts.length,
      contracts: callContracts,
      intelligence: callIntelligences,
      score: callScore,
      quality: classifyQuality(callScore),
    },
    puts: {
      count: putContracts.length,
      contracts: putContracts,
      intelligence: putIntelligences,
      score: putScore,
      quality: classifyQuality(putScore),
    },
  };
}

function buildFlowScores(flow, pressure, premiumPressure) {
  let bullishFlowScore = null;
  let bearishFlowScore = null;

  if (flow.callPutPressure === 'CALL_PRESSURE' && flow.callPutPressureScore != null) {
    bullishFlowScore = flow.callPutPressureScore;
  }

  if (flow.callPutPressure === 'PUT_PRESSURE' && flow.callPutPressureScore != null) {
    bearishFlowScore = 100 - flow.callPutPressureScore;
  }

  if (flow.callPutPressure === 'BALANCED') {
    bullishFlowScore = null;
    bearishFlowScore = null;
  }

  if (premiumPressure.premiumPressureScore != null) {
    const pv = premiumPressure.premiumPressureScore;
    if (pv > 50) {
      if (bullishFlowScore == null) bullishFlowScore = pv;
      else bullishFlowScore = Math.round((bullishFlowScore + pv) / 2);
    } else if (pv < 50) {
      const putSide = 100 - pv;
      if (bearishFlowScore == null) bearishFlowScore = putSide;
      else bearishFlowScore = Math.round((bearishFlowScore + putSide) / 2);
    }
  }

  if (flow.callPutPressure === 'UNAVAILABLE' && premiumPressure.premiumPressureScore != null) {
    const pv = premiumPressure.premiumPressureScore;
    bullishFlowScore = pv > 55 ? pv : null;
    bearishFlowScore = pv < 45 ? 100 - pv : null;
  }

  return { bullishFlowScore, bearishFlowScore };
}

function buildOptionsIntelligenceResult(symbol, contracts, opts = {}) {
  if (!Array.isArray(contracts) || contracts.length === 0 || !symbol) {
    return defaultOptionsIntelligence(symbol);
  }

  const secIntelligence = opts.secIntelligence || null;
  const providerStatus = opts.providerStatus || null;

  const provider = providerStatus || {
    provider: 'yahoo',
    source: 'Yahoo Finance options chain',
    configured: true,
  };

  const flow = buildOptionsFlowIntelligence(contracts);
  const pressure = calculateCallPutPressure(contracts);
  const premiumPressure = calculatePremiumPressure(contracts);
  const flowConfidence = calculateFlowConfidence(contracts);
  const ranking = rankOptionsContracts(contracts);
  const summary = buildBestContractSummary(contracts, ranking);
  const decisionSummary = buildSymbolDecisionSummary(contracts, ranking);
  const strategySummary = buildSymbolStrategySummary(ranking);

  if (strategySummary.strategyCandidates && strategySummary.strategyCandidates.length > 0) {
    strategySummary.strategyCandidates = strategySummary.strategyCandidates.map(enrichStrategyWithDecision);
  }
  if (strategySummary.bestStrategy) {
    enrichStrategyWithDecision(strategySummary.bestStrategy);
  }
  const strategyDecision = selectRecommendedStrategy(strategySummary.strategyCandidates || []);

  const { calls, puts } = buildDefaultCallsPuts(contracts, flow);

  const { bullishFlowScore, bearishFlowScore } = buildFlowScores(
    flow,
    pressure,
    premiumPressure
  );

  const unusualActivityScore = classifyActivityScore(flow.activityStrength);
  const flowConviction = classifyConviction(flowConfidence);
  const optionsQuality = summary.bestContractQuality
    ? summary.bestContractQuality
    : classifyQuality(
        ranking.length > 0 ? ranking[0].contractRankScore : null
      );

  const decisionStatus = decisionSummary.decisionStatus;
  const optionsAction = classifyAction(
    decisionStatus,
    flow.callPutPressure,
    flow.callPutPressure
  );

  const callPressure = flow.callPutPressure;
  const putPressure =
    flow.callPutPressure === 'PUT_PRESSURE'
      ? 'PUT_PRESSURE'
      : flow.callPutPressure === 'BALANCED'
      ? 'BALANCED'
      : null;

  const thesis = buildThesis(
    calls.score,
    puts.score,
    bullishFlowScore,
    bearishFlowScore,
    unusualActivityScore,
    decisionStatus,
    callPressure,
    putPressure
  );

  const keySignals = buildKeySignals(
    contracts,
    flow,
    pressure,
    premiumPressure
  );

  const risks = buildRisks(ranking, flow, contracts);
  const dataQuality = buildDataQuality(contracts, flow, provider);

  const timestamp = opts.timestamp || flow.dataTimestamp || nowISO();

  const underlyingPrice =
    contracts.length > 0 && contracts[0].underlying
      ? n(contracts[0].underlying)
      : null;

  return {
    ticker: symbol,
    timestamp,
    optionsAvailability: dataQuality.available,
    provider: provider.provider || 'yahoo',
    source: provider.source || 'Yahoo Finance options chain',

    expectedTimeframe: 'OPTIONS',

    callScore: calls.score,
    putScore: puts.score,
    bullishFlowScore,
    bearishFlowScore,
    unusualActivityScore,
    flowConviction,
    optionsQuality,
    optionsAction,
    thesis,
    keySignals,
    risks,

    underlyingPrice,
    expiry: contracts.length > 0 ? contracts[0].expiry || null : null,

    calls,
    puts,

    flow: {
      ...flow,
      callPutPressure: pressure.callPutPressure,
      callPutPressureScore: pressure.callPutPressureScore,
      callVolume: pressure.callVolume,
      putVolume: pressure.putVolume,
      callOI: pressure.callOI,
      putOI: pressure.putOI,
      callVolumeRatio: pressure.callVolumeRatio,
      putVolumeRatio: pressure.putVolumeRatio,
      callOIRatio: pressure.callOIRatio,
      putOIRatio: pressure.putOIRatio,
      callPremium: pressure.callPremium,
      putPremium: pressure.putPremium,
      callPremiumVolume: premiumPressure.callPremiumVolume,
      putPremiumVolume: premiumPressure.putPremiumVolume,
      premiumPressureScore: premiumPressure.premiumPressureScore,
    },

    ranking,
    summary,
    decision: decisionSummary,
    strategies: strategySummary,
    strategyDecision,

    sec: secIntelligence || null,

    dataQuality,

    provenance: {
      contracts: 'A2',
      flow: 'A2',
      ranking: 'A2',
      decision: 'A2',
      strategies: 'A2',
      ...(secIntelligence ? { sec: 'A6' } : {}),
    },

    disclaimer:
      'Options Intelligence Manager is analytical only. Composes A2 options intelligence. Not a buy/sell recommendation. Missing data preserved as null — never fabricated.',
  };
}

function defaultOptionsIntelligence(symbol) {
  return {
    ticker: symbol || null,
    timestamp: nowISO(),
    optionsAvailability: false,
    provider: null,
    source: null,

    callScore: null,
    putScore: null,
    bullishFlowScore: null,
    bearishFlowScore: null,
    unusualActivityScore: null,
    flowConviction: 'UNAVAILABLE',
    optionsQuality: 'UNAVAILABLE',
    optionsAction: 'INSUFFICIENT_DATA',
    thesis: 'No options chain data available for this symbol.',
    keySignals: [],
    risks: [],

    underlyingPrice: null,
    expiry: null,

    calls: {
      count: 0,
      contracts: [],
      intelligence: [],
      score: null,
      quality: 'UNAVAILABLE',
    },
    puts: {
      count: 0,
      contracts: [],
      intelligence: [],
      score: null,
      quality: 'UNAVAILABLE',
    },

    flow: {
      callVolume: 0,
      putVolume: 0,
      callOI: 0,
      putOI: 0,
      callPremium: null,
      putPremium: null,
      callVolumeRatio: null,
      putVolumeRatio: null,
      callOIRatio: null,
      putOIRatio: null,
      callPremiumVolume: null,
      putPremiumVolume: null,
      premiumPressureScore: null,
      callPutPressure: 'UNAVAILABLE',
      callPutPressureScore: null,
      volumeToOIRatio: null,
      activityStrength: 'UNAVAILABLE',
      flowDirection: 'UNAVAILABLE',
      flowConfidence: null,
      flowReason: 'Directional options flow data unavailable from current provider.',
      flowScore: null,
      flowDivergence: 'UNAVAILABLE',
      flowDivergenceReason: null,
      flowRiskLevel: 'LOW',
      flowRiskFlags: [],
      flowRiskReasons: [],
      dataStatus: 'unavailable',
    },

    ranking: [],
    summary: {
      bestContractSymbol: null,
      bestContractRankScore: null,
      bestContractQuality: null,
      bestContractReasons: [],
      alternativeContracts: [],
      contractCount: 0,
      averageRankScore: null,
      dataStatus: 'unavailable',
    },
    decision: {
      decisionScore: null,
      decisionStatus: 'UNAVAILABLE',
      executionQuality: 'UNAVAILABLE',
      riskLevel: 'UNAVAILABLE',
      recommendedContract: null,
      recommendedScore: null,
      recommendedQuality: null,
      recommendedReasons: [],
      alternativeContracts: [],
      avoidContracts: [],
      dataStatus: 'unavailable',
    },
    strategies: {
      strategyCandidates: [],
      bestStrategy: null,
      dataStatus: 'unavailable',
    },
    strategyDecision: null,

    sec: null,

    dataQuality: {
      available: false,
      completeness: 0,
      hasCalls: false,
      hasPuts: false,
      hasVolume: false,
      hasOI: false,
      hasIV: false,
      hasPremium: false,
      hasBidAsk: false,
      provider: null,
      dataStatus: 'unavailable',
    },

    provenance: {
      contracts: 'A2',
      flow: 'A2',
      ranking: 'A2',
      decision: 'A2',
      strategies: 'A2',
    },

    disclaimer:
      'Options Intelligence Manager is analytical only. Composes A2 options intelligence. Not a buy/sell recommendation. Missing data preserved as null — never fabricated.',
  };
}

function rankOptionsOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.flow?.flowScore ?? a.decision?.decisionScore ?? a.summary?.bestContractRankScore ?? -1;
    const sb = b.flow?.flowScore ?? b.decision?.decisionScore ?? b.summary?.bestContractRankScore ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataQuality?.completeness ?? 0;
    const db = b.dataQuality?.completeness ?? 0;
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
  nowISO,
  average,
  median,
  classifyActivityScore,
  classifyConviction,
  classifyQuality,
  classifyAction,
  buildKeySignals,
  buildRisks,
  buildThesis,
  buildDataQuality,
  buildDefaultCallsPuts,
  buildFlowScores,
  buildOptionsIntelligenceResult,
  defaultOptionsIntelligence,
  rankOptionsOpportunities,
};

export default buildOptionsIntelligenceResult;
