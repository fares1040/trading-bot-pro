/**
 * Institutional Radar Manager (B3)
 *
 * Unified orchestration layer for institutional intelligence.
 * Pure function module — no network calls in the manager itself.
 *
 * Composes outputs from:
 *   A3.1  — Institutional Intelligence Core (lib/institutional-intelligence.js)
 *   A3.2  — Institutional Signal & Conviction (lib/institutional-signal.js)
 *   A3.3  — Institutional Ranking & Conviction (lib/institutional-ranking.js)
 *   A3 Final — Institutional Decision (lib/institutional-decision.js)
 *   A6    — SEC EDGAR data (passed in as secData)
 *   A3 Provider — FINRA ATS/OTC data (passed in as finraData + finraScore)
 *
 * Produces a normalized B3 Institutional Radar result suitable for
 * downstream Decision layers:
 *   - Opportunity Ranking
 *   - Trade Plan Engine
 *   - AI Explanation
 *   - Market Regime Center
 *   - Future Unified Hunter scoring
 *
 * No BUY/SELL guarantees. Missing data = null. No fabricated values.
 * Institutional activity does NOT indicate direction (per A3 design).
 */

import {
  buildInstitutionalIntelligence,
  defaultInstitutionalIntelligence,
  calculateInstitutionalActivityScore,
  classifyOwnershipStrength,
  classifyInstitutionalActivity,
  classifyInstitutionalRisk,
  buildFilingSignals,
} from './institutional-intelligence.js';

import {
  buildInstitutionalSignal,
  defaultInstitutionalSignal,
  calculateDataQuality,
  calculateFreshness,
  calculateInstitutionalSignalScore,
  classifyInstitutionalConviction,
} from './institutional-signal.js';

import {
  rankInstitutionalSignal,
  rankInstitutionalOpportunities,
  selectTopInstitutional,
  defaultInstitutionalRank,
  calculateInstitutionalRankScore,
  classifyInstitutionalRank,
} from './institutional-ranking.js';

import {
  buildInstitutionalDecision,
  defaultInstitutionalDecision,
  calculateInstitutionalDecisionScore,
  classifyInstitutionalStatus,
  calculateExecutionQuality,
  rankInstitutionalDecisions,
} from './institutional-decision.js';

const n = (value) => {
  if (value == null) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

function nowISO() {
  return new Date().toISOString();
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0));
}

function classifyInstitutionalQuality(rankClass) {
  if (rankClass === 'TOP') return 'EXCEPTIONAL';
  if (rankClass === 'STRONG') return 'HIGH';
  if (rankClass === 'WATCH') return 'MODERATE';
  if (rankClass === 'WEAK') return 'LOW';
  return 'UNAVAILABLE';
}

function classifyInstitutionalAction(decisionStatus, rankClass) {
  if (decisionStatus === 'DECISION_TOP') return 'STRONG_INTEREST';
  if (decisionStatus === 'DECISION_STRONG') return 'MONITOR';
  if (decisionStatus === 'DECISION_WATCH') return 'WATCH';
  if (decisionStatus === 'DECISION_MONITOR') return 'OBSERVE';
  if (decisionStatus === 'DECISION_OBSERVE') return 'OBSERVE';
  return 'INSUFFICIENT_DATA';
}

/**
 * Derive accumulation proxy score from institutional intelligence.
 *
 * IMPORTANT: FINRA ATS data does NOT indicate trade direction (buy vs sell).
 * This is NOT directional accumulation — it is a proxy for institutional
 * interest based on:
 *   - Activity score (SEC filings + FINRA ATS volume)
 *   - Data completeness
 *   - Freshness of institutional data
 *
 * A high score indicates presence of institutional interest, NOT that
 * institutions are buying.
 */
function buildAccumulationScore(intelligence, signal, rank) {
  if (!intelligence || !signal) return null;

  const activityScore = n(intelligence.institutionalActivityScore);
  const signalScore = n(signal.institutionalSignalScore);
  const dataQuality = signal.dataQuality;
  const freshness = signal.freshness;

  if (activityScore == null && signalScore == null) return null;

  const components = [];

  if (activityScore != null) {
    components.push({ score: activityScore, weight: 0.45 });
  }
  if (signalScore != null) {
    components.push({ score: signalScore, weight: 0.30 });
  }
  if (dataQuality != null && dataQuality > 0) {
    components.push({ score: dataQuality, weight: 0.15 });
  }
  if (freshness != null && freshness > 0) {
    components.push({ score: freshness, weight: 0.10 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(clamp(weightedSum / totalWeight));
}

/**
 * Derive distribution risk score from SEC data.
 *
 * Based on SEC risk flags for dilution, offerings, and reverse splits.
 * A high score indicates elevated share-issuance/distribution risk.
 */
function buildDistributionScore(secData) {
  if (!secData) return null;

  const secRiskFlags = secData.secRiskFlags || [];
  const hasDilution = secRiskFlags.some(
    (f) => f.includes('DILUTION') || f.includes('OFFERING')
  );
  const hasReverseSplit = secRiskFlags.some((f) => f.includes('REVERSE_SPLIT'));

  if (!hasDilution && !hasReverseSplit) return null;

  let score = 0;
  if (hasDilution) score += 60;
  if (hasReverseSplit) score += 40;

  const risk = secData.secRiskLevel;
  if (risk === 'high') score = Math.round(score * 1.3);
  else if (risk === 'extreme') score = Math.round(score * 1.5);

  return clamp(score);
}

/**
 * Classify smart money bias from ownership strength and data sources.
 *
 * This is NOT a directional buy/sell signal. It classifies the quality
 * and presence of institutional interest.
 */
function classifySmartMoneyBias(intelligence) {
  if (!intelligence) return 'UNAVAILABLE';

  const ownership = intelligence.ownershipStrength;
  const hasFinra = intelligence.finraAvailable;
  const hasSec = intelligence.secDataStatus === 'ok';

  if (ownership === 'STRONG' && hasFinra) return 'STRONG_INTEREST';
  if (ownership === 'STRONG') return 'STRONG_INTEREST';
  if (ownership === 'MODERATE' && hasFinra) return 'MODERATE_INTEREST';
  if (ownership === 'MODERATE') return 'MODERATE_INTEREST';
  if (ownership === 'WEAK') return 'WEAK_INTEREST';
  if (hasSec || hasFinra) return 'LOW_INTEREST';
  return 'UNAVAILABLE';
}

function buildKeySignals(intelligence, signal, rank, finraScore, secData) {
  const signals = [];

  if (intelligence) {
    if (intelligence.institutionalActivity && intelligence.institutionalActivity !== 'UNAVAILABLE') {
      signals.push(`Institutional activity: ${intelligence.institutionalActivity}`);
    }

    if (intelligence.ownershipStrength && intelligence.ownershipStrength !== 'UNAVAILABLE') {
      signals.push(`Ownership strength: ${intelligence.ownershipStrength}`);
    }

    const riskLevel = intelligence.institutionalRisk;
    if (riskLevel && riskLevel !== 'UNAVAILABLE') {
      signals.push(`SEC risk level: ${riskLevel}`);
    }

    if (intelligence.filingSignals && intelligence.filingSignals.length > 0) {
      const forms = intelligence.filingSignals
        .map((f) => f.form)
        .filter(Boolean);
      if (forms.length > 0) {
        signals.push(`Recent filings: ${forms.join(', ')}`);
      }
    }

    if (secData?.latestRelevantFilings && secData.latestRelevantFilings.length > 0) {
      const forms = secData.latestRelevantFilings
        .map((f) => f.form)
        .filter(Boolean);
      if (forms.length > 0) {
        const filingStr = `Recent filings: ${forms.join(', ')}`;
        if (!signals.includes(filingStr)) {
          signals.push(filingStr);
        }
      }
    }
  }

  if (signal) {
    if (signal.institutionalSignalScore != null) {
      signals.push(`Institutional signal score: ${signal.institutionalSignalScore}/100`);
    }
    if (signal.institutionalConviction && signal.institutionalConviction !== 'UNAVAILABLE') {
      signals.push(`Conviction: ${signal.institutionalConviction}`);
    }
  }

  if (finraScore && finraScore.score != null) {
    signals.push(`FINRA ATS activity: ${finraScore.score}/100 (${finraScore.confidence || 'unknown'} confidence)`);
  }

  if (intelligence && intelligence.dataStatus) {
    signals.push(`Data status: ${intelligence.dataStatus}`);
  }

  return signals.slice(0, 10);
}

function buildInstitutionalRisks(intelligence, signal, secData) {
  const risks = [];
  const seen = new Set();

  function add(label, severity, description) {
    const key = `${label}:${severity}`;
    if (!seen.has(key)) {
      seen.add(key);
      risks.push({ label, severity, description });
    }
  }

  if (intelligence) {
    if (intelligence.warnings) {
      for (const w of intelligence.warnings) {
        if (w === 'SEC_DILUTION_RISK') {
          add('DILUTION_RISK', 'HIGH', 'SEC filings indicate share dilution risk');
        } else if (w === 'SEC_OFFERING_RISK') {
          add('OFFERING_RISK', 'HIGH', 'SEC filings indicate potential share offering');
        } else if (w === 'SEC_REVERSE_SPLIT') {
          add('REVERSE_SPLIT_RISK', 'MEDIUM', 'Reverse split history detected');
        }
      }
    }

    if (secData && secData.secRiskFlags && secData.secRiskFlags.length > 0) {
      for (const flag of secData.secRiskFlags) {
        if (flag.includes('DILUTION')) {
          add('DILUTION_RISK', 'HIGH', flag);
        } else if (flag.includes('OFFERING')) {
          add('OFFERING_RISK', 'HIGH', flag);
        }
      }
    }
  }

  if (signal && signal.warnings) {
    for (const w of signal.warnings) {
      if (w === 'INSTITUTIONAL_DATA_PARTIAL') {
        add('DATA_PARTIAL', 'LOW', 'Institutional data is partial — one provider missing');
      } else if (w === 'INSTITUTIONAL_FRESHNESS_STALE') {
        add('DATA_STALE', 'MEDIUM', 'Institutional data is stale (>180 days since last filing)');
      }
    }
  }

  if (signal && signal.dataQuality != null && signal.dataQuality < 100 && signal.dataQuality > 0) {
    add('DATA_INCOMPLETE', 'LOW', 'Not all institutional data sources are available');
  }

  if (signal && signal.freshness === 0 && signal.dataQuality > 0) {
    add('FRESHNESS_UNKNOWN', 'LOW', 'No filing dates available for freshness assessment');
  }

  return risks;
}

function buildInstitutionalThesis(intelligence, signal, rank, decision, secData) {
  const parts = [];

  if (decision && decision.institutionalDecisionScore != null) {
    if (decision.institutionalDecisionScore >= 80) {
      parts.push('Strong institutional interest detected');
    } else if (decision.institutionalDecisionScore >= 60) {
      parts.push('Moderate institutional interest present');
    } else if (decision.institutionalDecisionScore >= 40) {
      parts.push('Weak institutional signal, warrants monitoring');
    } else if (decision.institutionalDecisionScore >= 20) {
      parts.push('Institutional data is sparse, observe for changes');
    } else {
      parts.push('Limited institutional data available');
    }
  }

  if (signal && signal.institutionalConviction && signal.institutionalConviction !== 'UNAVAILABLE') {
    parts.push(`Institutional conviction is ${signal.institutionalConviction.toLowerCase()}`);
  }

  if (intelligence) {
    if (intelligence.ownershipStrength && intelligence.ownershipStrength !== 'UNAVAILABLE') {
      parts.push(`Ownership strength is ${intelligence.ownershipStrength.toLowerCase()}`);
    }

    const riskLevel = intelligence.institutionalRisk;
    if (riskLevel && riskLevel !== 'UNAVAILABLE' && (riskLevel === 'HIGH' || riskLevel === 'EXTREME')) {
      parts.push('SEC filings indicate potential share issuance activity');
    }

    const filingCount = secData?.latestRelevantFilings?.length || intelligence.filingSignals?.length || 0;
    if (filingCount > 0) {
      parts.push(`${filingCount} recent filings on record`);
    }
  }

  if (parts.length === 0) {
    parts.push('No institutional intelligence available — data sources not accessible');
  }

  return parts.join('; ') + '.';
}

function buildDataQualityInfo(intelligence, signal, finraScore, secData) {
  const hasSec = !!(secData && secData.secDataStatus === 'ok');
  const hasFinra = !!(finraScore && Number.isFinite(finraScore.score));
  const secAvailable = secData?.secDataStatus === 'ok' || secData?.secDataStatus === 'no_filings';
  const finraAvailable = !!finraScore;

  const checks = [
    hasSec,
    hasFinra,
    secAvailable,
    finraAvailable,
    intelligence?.filingSignals?.length > 0,
    intelligence?.finraAvailable === true,
  ];

  const completeness = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );

  let dataStatus = 'unavailable';
  let qualityLevel = 'UNAVAILABLE';

  if (hasSec && hasFinra) {
    dataStatus = 'complete';
    qualityLevel = 'COMPLETE';
  } else if (hasSec || hasFinra || secAvailable || finraAvailable) {
    dataStatus = 'partial';
    qualityLevel = 'PARTIAL';
  }

  let freshness = 0;
  let freshnessLabel = 'UNAVAILABLE';
  if (signal && signal.freshness != null) {
    freshness = signal.freshness;
    if (freshness === 100) freshnessLabel = 'FRESH';
    else if (freshness === 70) freshnessLabel = 'AGING';
    else if (freshness === 40) freshnessLabel = 'STALE';
    else freshnessLabel = 'UNAVAILABLE';
  }

  return {
    qualityLevel,
    completeness,
    freshness,
    freshnessLabel,
    dataStatus,
    hasSec,
    hasFinra,
    hasFilings: intelligence?.filingSignals?.length > 0,
    finraVerified: intelligence?.finraAvailable === true,
  };
}

function buildInstitutionalRadarResult(symbol, secData, finraData, finraScore, opts = {}) {
  const sec = secData || null;
  const finra = finraData || null;
  const finraS = finraScore || null;

  // If symbol is null or no data sources available at all
  if (!symbol && !sec && !finraS) {
    return defaultInstitutionalRadar(null);
  }

  // A3.1: Build institutional intelligence from SEC + FINRA data
  const intelligence = buildInstitutionalIntelligence(
    symbol || null,
    sec,
    finra,
    finraS
  );

  // If intelligence has no data
  if (!intelligence || intelligence.dataStatus === 'unavailable') {
    const result = defaultInstitutionalRadar(symbol);
    result.intelligence = intelligence || defaultInstitutionalIntelligence();
    result.signal = defaultInstitutionalSignal();
    result.rank = defaultInstitutionalRank(symbol);
    result.decision = defaultInstitutionalDecision(symbol);
    return result;
  }

  // A3.2: Build institutional signal
  const signal = buildInstitutionalSignal(intelligence);

  // A3.3: Build institutional rank
  const rank = rankInstitutionalSignal(signal, symbol);

  // A3 Final: Build institutional decision
  const decision = buildInstitutionalDecision(intelligence, signal, rank, symbol);

  // B3 normalized fields
  const institutionalScore = signal.institutionalSignalScore;

  const activityScore = intelligence.institutionalActivityScore;
  const accumulationScore = buildAccumulationScore(intelligence, signal, rank);
  const distributionScore = buildDistributionScore(sec);

  const smartMoneyBias = classifySmartMoneyBias(intelligence);
  const institutionalMomentum = signal.freshness;
  const ownershipSignal = intelligence.ownershipStrength;
  const filingSignal = sec && sec.latestRelevantFilings && sec.latestRelevantFilings.length > 0
    ? 'FILINGS_AVAILABLE'
    : intelligence.filingSignals && intelligence.filingSignals.length > 0
    ? 'FILINGS_AVAILABLE'
    : intelligence.secDataStatus === 'ok'
    ? 'NO_RELEVANT_FILINGS'
    : intelligence.secDataStatus === 'no_filings'
    ? 'NO_RECENT_FILINGS'
    : 'UNAVAILABLE';

  const confidence = signal.institutionalConviction;
  const keySignals = buildKeySignals(intelligence, signal, rank, finraS, sec);
  const risks = buildInstitutionalRisks(intelligence, signal, sec);
  const thesis = buildInstitutionalThesis(intelligence, signal, rank, decision, sec);
  const dataQuality = buildDataQualityInfo(intelligence, signal, finraS, sec);

  const institutionalQuality = classifyInstitutionalQuality(rank.institutionalRankClass);
  const institutionalAction = classifyInstitutionalAction(
    decision.institutionalStatus,
    rank.institutionalRankClass
  );

  const timestamp = opts.timestamp || nowISO();

  const hasInstitutionalData =
    intelligence.dataStatus !== 'unavailable' ||
    signal.institutionalSignalScore != null;

  return {
    ticker: symbol || intelligence.symbol || null,
    timestamp,

    institutionalAvailability: hasInstitutionalData,

    institutionalScore,
    institutionalQuality,
    institutionalAction,

    accumulationScore,
    distributionScore,
    smartMoneyBias,
    institutionalMomentum,

    ownershipStrength: ownershipSignal,
    institutionalActivity: intelligence.institutionalActivity,
    institutionalRisk: intelligence.institutionalRisk,
    filingSignal,

    confidence,
    conviction: signal.institutionalConviction,

    keySignals,
    risks,
    thesis,

    filingSignals: intelligence.filingSignals,
    secRiskFlags: secData?.secRiskFlags || [],
    secRiskLevel: secData?.secRiskLevel || intelligence.institutionalRisk,
    secRiskScore: secData?.secRiskScore || null,

    finraAvailable: !!intelligence.finraAvailable,
    finraScore: finraS,
    provider: intelligence.provider,
    source: finraS?.source || (intelligence.secDataStatus === 'ok' ? 'SEC EDGAR' : null),
    finraWeekStartDate: intelligence.finraWeekStartDate,

    decisionScore: decision.institutionalDecisionScore,
    decisionStatus: decision.institutionalStatus,
    executionQuality: decision.executionQuality,

    rankScore: rank.institutionalRankScore,
    rankClass: rank.institutionalRankClass,
    institutionalRankIndex: rank?.institutionalRankIndex ?? null,

    dataQuality,

    // Preserve full A3 layer outputs for downstream consumers
    intelligence,
    signal,
    rank,
    decision,

    provenance: {
      intelligence: 'A3.1',
      signal: 'A3.2',
      rank: 'A3.3',
      decision: 'A3-Final',
      sec: secData ? 'A6' : null,
      finra: finraS ? 'A3-Provider' : null,
    },

    disclaimer:
      'Institutional Radar Manager is analytical only (A3.1-A3.3, A3-Final). ' +
      'Does not indicate directional buy/sell. FINRA ATS data does not indicate trade direction. ' +
      'Not a recommendation. Missing data preserved as null — never fabricated.',
  };
}

function defaultInstitutionalRadar(symbol = null) {
  return {
    ticker: symbol || null,
    timestamp: nowISO(),

    institutionalAvailability: false,

    institutionalScore: null,
    institutionalQuality: 'UNAVAILABLE',
    institutionalAction: 'INSUFFICIENT_DATA',

    accumulationScore: null,
    distributionScore: null,
    smartMoneyBias: 'UNAVAILABLE',
    institutionalMomentum: null,

    ownershipStrength: 'UNAVAILABLE',
    institutionalActivity: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    filingSignal: 'UNAVAILABLE',

    confidence: 'UNAVAILABLE',
    conviction: 'UNAVAILABLE',

    keySignals: [],
    risks: [],
    thesis: 'No institutional data available for this symbol.',

    filingSignals: [],
    secRiskFlags: [],
    secRiskLevel: 'UNAVAILABLE',
    secRiskScore: null,

    finraAvailable: false,
    finraScore: null,
    provider: null,
    source: null,
    finraWeekStartDate: null,

    decisionScore: null,
    decisionStatus: 'UNAVAILABLE',
    executionQuality: null,

    rankScore: null,
    rankClass: 'UNAVAILABLE',
    institutionalRankIndex: null,

    dataQuality: {
      qualityLevel: 'UNAVAILABLE',
      completeness: 0,
      freshness: 0,
      freshnessLabel: 'UNAVAILABLE',
      dataStatus: 'unavailable',
      hasSec: false,
      hasFinra: false,
      hasFilings: false,
      finraVerified: false,
    },
    expectedTimeframe: 'UNKNOWN',

    intelligence: defaultInstitutionalIntelligence(),
    signal: defaultInstitutionalSignal(),
    rank: defaultInstitutionalRank(null),
    decision: defaultInstitutionalDecision(null),

    provenance: {
      intelligence: 'A3.1',
      signal: 'A3.2',
      rank: 'A3.3',
      decision: 'A3-Final',
      sec: null,
      finra: null,
    },

    disclaimer:
      'Institutional Radar Manager is analytical only (A3.1-A3.3, A3-Final). ' +
      'Does not indicate directional buy/sell. FINRA ATS data does not indicate trade direction. ' +
      'Not a recommendation. Missing data preserved as null — never fabricated.',
  };
}

/**
 * Rank multiple institutional radar results by signal score descending.
 * Returns ranked list, top opportunities, and alternatives.
 */
function rankInstitutionalOpportunitiesB3(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [] };
  }

  const sorted = [...results].sort((a, b) => {
    const sa = a.institutionalScore ?? a.rankScore ?? a.decisionScore ?? -1;
    const sb = b.institutionalScore ?? b.rankScore ?? b.decisionScore ?? -1;
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
  n,
  nowISO,
  clamp,
  classifyInstitutionalQuality,
  classifyInstitutionalAction,
  buildAccumulationScore,
  buildDistributionScore,
  classifySmartMoneyBias,
  buildKeySignals,
  buildInstitutionalRisks,
  buildInstitutionalThesis,
  buildDataQualityInfo,
  buildInstitutionalRadarResult,
  defaultInstitutionalRadar,
  rankInstitutionalOpportunitiesB3,
};

export default buildInstitutionalRadarResult;
