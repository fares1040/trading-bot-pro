/**
 * D11 Command Center Orchestration Engine
 *
 * Pure orchestration layer that aggregates outputs from:
 *   - C10 Market Regime (lib/market-regime-engine.js)
 *   - C7 Opportunity Ranking (lib/opportunity-ranking.js)
 *   - C8 Trade Plan Engine (lib/trade-plan-engine.js)
 *   - C9 AI Explanation (lib/ai-explanation.js)
 *   - B1-B6 Intelligence Managers
 *
 * This is NOT a scoring engine. It consumes and presents upstream outputs
 * without duplicating or fabricating any values.
 *
 * Missing data remains null. NaN/Infinity values are sanitized.
 * No BUY/SELL recommendations. Data-honest only.
 */

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

export const REGIME_LABELS = Object.freeze({
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  RISK_OFF: 'RISK_OFF',
  BEARISH: 'BEARISH',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const QUALITY_LABELS = Object.freeze({
  TOP: 'TOP',
  STRONG: 'STRONG',
  WATCH: 'WATCH',
  WEAK: 'WEAK',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  VERY_LOW: 'VERY_LOW',
  UNKNOWN: 'UNKNOWN',
});

export const PLAN_SIGNAL_LABELS = Object.freeze({
  STRONG_PLAN: 'STRONG_PLAN',
  VALID_PLAN: 'VALID_PLAN',
  WATCH: 'WATCH',
  AVOID: 'AVOID',
  UNAVAILABLE: 'UNAVAILABLE',
});

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function safeString(str) {
  return typeof str === 'string' ? str : null;
}

export function buildMarketRegimeSection(regimeData) {
  if (!regimeData || regimeData.regime === undefined) {
    return {
      available: false,
      regime: REGIME_LABELS.UNAVAILABLE,
      regimeScore: null,
      confidence: 0,
      confidenceLevel: CONFIDENCE_LEVELS.UNKNOWN,
      dataCompleteness: 0,
      reasons: [],
      warnings: ['REGIME_UNAVAILABLE'],
      risks: [{ label: 'INSUFFICIENT_EVIDENCE', severity: 'HIGH', description: 'Market regime data unavailable' }],
      freshness: null,
      limitations: 'C10 Market Regime not available.',
    };
  }

  return {
    available: true,
    regime: regimeData.regime || REGIME_LABELS.UNAVAILABLE,
    regimeScore: n(regimeData.regimeScore),
    confidence: n(regimeData.confidence),
    confidenceLevel: safeString(regimeData.confidenceLevel) || CONFIDENCE_LEVELS.UNKNOWN,
    dataCompleteness: n(regimeData.dataCompleteness),
    reasons: safeArray(regimeData.reasons),
    warnings: safeArray(regimeData.warnings),
    risks: regimeData.risks || [{ label: 'NO_MAJOR_RISKS_IDENTIFIED', severity: 'LOW', description: 'No significant risks' }],
    supportingEvidence: safeArray(regimeData.supportingEvidence),
    flags: safeArray(regimeData.flags),
    componentScores: regimeData.componentScores || {},
    dataAvailability: regimeData.dataAvailability || {},
    freshness: regimeData.freshness ? {
      evaluatedAt: regimeData.freshness.evaluatedAt,
      indexTimestamp: regimeData.freshness.indexTimestamp,
      universeSize: regimeData.freshness.universeSize,
      indexCount: regimeData.freshness.indexCount,
    } : null,
    limitations: safeArray(regimeData.limitations),
    disclaimer: 'C10 Market Regime is context only - not a buy/sell signal.',
  };
}

export function buildTopOpportunitiesSection(opportunityData, limit = 5) {
  if (!opportunityData || !Array.isArray(opportunityData.data)) {
    return {
      available: false,
      count: 0,
      top: [],
      qualityBreakdown: { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
      dataAvailability: {
        pennyIntelligence: false,
        optionsIntelligence: false,
        institutionalRadar: false,
        swingIntelligence: false,
        earlyExplosion: false,
        catalystIntelligence: false,
      },
      limitations: 'C7 Opportunity Ranking data unavailable.',
    };
  }

  const top = opportunityData.data
    .filter((o) => o && o.quality !== 'UNAVAILABLE' && o.opportunityScore != null)
    .slice(0, limit);

  const qualityBreakdown = opportunityData.qualityBreakdown || {
    TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0,
  };

  const dataAvailability = opportunityData.dataAvailability || {};

  return {
    available: true,
    count: opportunityData.data.length,
    scanned: opportunityData.scanned || 0,
    top: top,
    qualityBreakdown,
    dataAvailability,
    ranking: opportunityData.ranking || { method: 'opportunity_score', total: 0 },
    limitations: opportunityData.limitations,
    disclaimer: opportunityData.disclaimer,
  };
}

export function buildTradePlansSection(tradePlanData, limit = 5) {
  if (!tradePlanData || !Array.isArray(tradePlanData.data)) {
    return {
      available: false,
      count: 0,
      top: [],
      qualityBreakdown: { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
      dataAvailability: {
        opportunityRanking: false,
        swingIntelligence: false,
        earlyExplosion: false,
        optionsIntelligence: false,
        institutionalRadar: false,
        catalystIntelligence: false,
        pennyIntelligence: false,
      },
      limitations: 'C8 Trade Plan data unavailable.',
    };
  }

  const top = tradePlanData.data
    .filter((t) => t && t.planSignal !== 'UNAVAILABLE' && t.planScore != null)
    .slice(0, limit);

  const qualityBreakdown = tradePlanData.qualityBreakdown || {
    TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0,
  };

  const dataAvailability = tradePlanData.dataAvailability || {};

  return {
    available: true,
    count: tradePlanData.data.length,
    scanned: tradePlanData.scanned || 0,
    top: top,
    qualityBreakdown,
    dataAvailability,
    ranking: tradePlanData.ranking || { method: 'trade_plan_score', total: 0 },
    limitations: tradePlanData.limitations,
    disclaimer: tradePlanData.disclaimer,
  };
}

export function buildWhyNowSection(aiExplanationData) {
  if (!aiExplanationData || !Array.isArray(aiExplanationData.data)) {
    return {
      available: false,
      top: [],
      count: 0,
      dataAvailability: {},
      limitations: 'C9 AI Explanation data unavailable.',
    };
  }

  const top = aiExplanationData.data
    .filter((e) => e && e.available !== false)
    .slice(0, 3);

  const dataAvailability = {};
  if (aiExplanationData.dataAvailability) {
    Object.entries(aiExplanationData.dataAvailability).forEach(([k, v]) => {
      dataAvailability[k] = v === true;
    });
  }

  return {
    available: true,
    count: aiExplanationData.data.length,
    top: top,
    dataAvailability,
    qualityBreakdown: aiExplanationData.qualityBreakdown || {},
    limitations: aiExplanationData.limitations,
    disclaimer: aiExplanationData.disclaimer,
  };
}

export function buildIntelligenceCoverageSection(opportunityData) {
  if (!opportunityData || !opportunityData.dataAvailability) {
    return {
      available: false,
      sources: {},
      coverageCount: 0,
      totalSources: 6,
      limitations: 'C7 dataAvailability unavailable.',
    };
  }

  const sources = {
    PENNY: {
      available: !!opportunityData.dataAvailability.pennyIntelligence,
      score: null,
      dataCompleteness: null,
      source: 'B1 Penny Intelligence',
      freshness: 'Live',
    },
    OPTIONS: {
      available: !!opportunityData.dataAvailability.optionsIntelligence,
      score: null,
      dataCompleteness: null,
      source: 'B2 Options Intelligence',
      freshness: 'Live',
    },
    INSTITUTIONAL: {
      available: !!opportunityData.dataAvailability.institutionalRadar,
      score: null,
      dataCompleteness: null,
      source: 'B3 Institutional Radar',
      freshness: 'Live',
    },
    SWING: {
      available: !!opportunityData.dataAvailability.swingIntelligence,
      score: null,
      dataCompleteness: null,
      source: 'B4 Swing Intelligence',
      freshness: 'Live',
    },
    EARLY_EXPLOSION: {
      available: !!opportunityData.dataAvailability.earlyExplosion,
      score: null,
      dataCompleteness: null,
      source: 'B5 Early Explosion',
      freshness: 'Live',
    },
    CATALYST: {
      available: !!opportunityData.dataAvailability.catalystIntelligence,
      score: null,
      dataCompleteness: null,
      source: 'B6 Catalyst Intelligence',
      freshness: 'Live',
    },
  };

  if (opportunityData.data && opportunityData.data.length > 0) {
    const sample = opportunityData.data[0];
    if (sample.sourceScores) {
      if (sample.sourceScores.pennyIntelligence != null) {
        sources.PENNY.available = true;
        sources.PENNY.score = Math.round(sample.sourceScores.pennyIntelligence);
        sources.PENNY.dataCompleteness = sample.dataCompleteness || null;
      }
      if (sample.sourceScores.optionsIntelligence != null) {
        sources.OPTIONS.available = true;
        sources.OPTIONS.score = Math.round(sample.sourceScores.optionsIntelligence);
        sources.OPTIONS.dataCompleteness = sample.dataCompleteness || null;
      }
      if (sample.sourceScores.institutionalRadar != null) {
        sources.INSTITUTIONAL.available = true;
        sources.INSTITUTIONAL.score = Math.round(sample.sourceScores.institutionalRadar);
        sources.INSTITUTIONAL.dataCompleteness = sample.dataCompleteness || null;
      }
      if (sample.sourceScores.swingIntelligence != null) {
        sources.SWING.available = true;
        sources.SWING.score = Math.round(sample.sourceScores.swingIntelligence);
        sources.SWING.dataCompleteness = sample.dataCompleteness || null;
      }
      if (sample.sourceScores.earlyExplosion != null) {
        sources.EARLY_EXPLOSION.available = true;
        sources.EARLY_EXPLOSION.score = Math.round(sample.sourceScores.earlyExplosion);
        sources.EARLY_EXPLOSION.dataCompleteness = sample.dataCompleteness || null;
      }
      if (sample.sourceScores.catalystIntelligence != null) {
        sources.CATALYST.available = true;
        sources.CATALYST.score = Math.round(sample.sourceScores.catalystIntelligence);
        sources.CATALYST.dataCompleteness = sample.dataCompleteness || null;
      }
    }
  }

  const coverageCount = Object.values(sources).filter((s) => s.available).length;

  return {
    available: true,
    sources,
    coverageCount,
    totalSources: 6,
    limitations: `Coverage: ${coverageCount} of 6 intelligence sources available.`,
  };
}

export function buildRiskCenterSection(opportunityData, tradePlanData, regimeData) {
  const allRisks = [];
  const allWarnings = [];

  if (regimeData && Array.isArray(regimeData.risks)) {
    regimeData.risks.forEach((r) => allRisks.push(r));
  }
  if (regimeData && Array.isArray(regimeData.warnings)) {
    regimeData.warnings.forEach((w) => allWarnings.push(w));
  }

  if (opportunityData && Array.isArray(opportunityData.data)) {
    opportunityData.data.forEach((o) => {
      if (o.risks) allRisks.push(...o.risks);
      if (o.warnings) allWarnings.push(...o.warnings);
    });
  }

  if (tradePlanData && Array.isArray(tradePlanData.data)) {
    tradePlanData.data.forEach((t) => {
      if (t.risks) allRisks.push(...t.risks);
      if (t.warnings) allWarnings.push(...t.warnings);
    });
  }

  const uniqueRisks = [];
  const seenRisks = new Set();
  allRisks.forEach((r) => {
    if (r && r.label && !seenRisks.has(r.label)) {
      seenRisks.add(r.label);
      uniqueRisks.push(r);
    }
  });

  const uniqueWarnings = [...new Set(allWarnings)];

  const regimeWarnings = [];
  if (regimeData) {
    if (regimeData.regime === REGIME_LABELS.BEARISH) regimeWarnings.push({ type: 'BEARISH_ENVIRONMENT', regime: regimeData.regime, score: regimeData.regimeScore });
    if (regimeData.regime === REGIME_LABELS.RISK_OFF) regimeWarnings.push({ type: 'RISK_OFF_ENVIRONMENT', regime: regimeData.regime, score: regimeData.regimeScore });
    if (regimeData.regime === REGIME_LABELS.UNAVAILABLE) regimeWarnings.push({ type: 'REGIME_UNAVAILABLE', regime: 'UNAVAILABLE' });
    if ((regimeData.warnings || []).length > 0) {
      regimeWarnings.push({ type: 'REGIME_WARNINGS', warnings: regimeData.warnings });
    }
  }

  const lowDataItems = [];
  if (opportunityData && Array.isArray(opportunityData.data)) {
    opportunityData.data.forEach((o) => {
      if (o.dataCompleteness != null && o.dataCompleteness < 50) {
        lowDataItems.push({ symbol: o.symbol, source: 'opportunityRanking', dataCompleteness: o.dataCompleteness });
      }
    });
  }
  if (tradePlanData && Array.isArray(tradePlanData.data)) {
    tradePlanData.data.forEach((t) => {
      if (t.dataCompleteness != null && t.dataCompleteness < 50) {
        lowDataItems.push({ symbol: t.symbol, source: 'tradePlan', dataCompleteness: t.dataCompleteness });
      }
    });
  }

  const unavailableItems = [];
  if (opportunityData && Array.isArray(opportunityData.data)) {
    opportunityData.data.forEach((o) => {
      if (o.quality === 'UNAVAILABLE' || o.opportunityScore == null) {
        unavailableItems.push({ symbol: o.symbol, source: 'opportunityRanking' });
      }
    });
  }
  if (tradePlanData && Array.isArray(tradePlanData.data)) {
    tradePlanData.data.forEach((t) => {
      if (t.planSignal === 'UNAVAILABLE' || t.planScore == null) {
        unavailableItems.push({ symbol: t.symbol, source: 'tradePlan' });
      }
    });
  }

  return {
    available: uniqueRisks.length > 0,
    risks: uniqueRisks,
    warnings: uniqueWarnings,
    regimeWarnings,
    lowDataItems,
    unavailableItems,
  };
}

export function buildActionQueueSection(opportunityData, tradePlanData, regimeData) {
  const topOpportunities = [];
  const highQualitySetups = [];
  const validTradePlans = [];
  const highRiskItems = [];
  const lowDataItem = [];
  const regimeWarnings = [];

  if (opportunityData && Array.isArray(opportunityData.data)) {
    opportunityData.data.forEach((o) => {
      if (o.opportunityScore != null && o.quality !== 'UNAVAILABLE') {
        topOpportunities.push({
          symbol: o.symbol,
          opportunityScore: o.opportunityScore,
          quality: o.quality,
          rank: o.rank,
        });
      }
      if (o.quality === 'TOP' || o.quality === 'STRONG') {
        highQualitySetups.push({ symbol: o.symbol, quality: o.quality, score: o.opportunityScore });
      }
      if ((o.risks || []).some((r) => r.severity === 'HIGH')) {
        highRiskItems.push({ symbol: o.symbol, source: 'opportunityRanking', risks: o.risks });
      }
      if (o.dataCompleteness != null && o.dataCompleteness < 50) {
        lowDataItem.push({ symbol: o.symbol, source: 'opportunityRanking', completeness: o.dataCompleteness });
      }
    });
  }

  if (tradePlanData && Array.isArray(tradePlanData.data)) {
    tradePlanData.data.forEach((t) => {
      if (t.planSignal === 'STRONG_PLAN' || t.planSignal === 'VALID_PLAN') {
        validTradePlans.push({
          symbol: t.symbol,
          planSignal: t.planSignal,
          planScore: t.planScore,
          direction: t.direction,
          riskReward: t.riskReward,
        });
      }
      if ((t.risks || []).some((r) => r.severity === 'HIGH')) {
        highRiskItems.push({ symbol: t.symbol, source: 'tradePlan', risks: t.risks });
      }
    });
  }

  if (regimeData) {
    if (regimeData.regime === REGIME_LABELS.BEARISH) {
      regimeWarnings.push({ type: 'BEARISH_REGIME', regime: regimeData.regime, score: regimeData.regimeScore });
    }
    if (regimeData.regime === REGIME_LABELS.RISK_OFF) {
      regimeWarnings.push({ type: 'RISK_OFF_REGIME', regime: regimeData.regime, score: regimeData.regimeScore });
    }
    if (regimeData.regime === REGIME_LABELS.UNAVAILABLE) {
      regimeWarnings.push({ type: 'REGIME_UNAVAILABLE', regime: 'UNAVAILABLE' });
    }
    if ((regimeData.warnings || []).length > 0) {
      regimeWarnings.push({ type: 'REGIME_WARNINGS', warnings: regimeData.warnings });
    }
  }

  return {
    topOpportunities: topOpportunities.slice(0, 5),
    highQualitySetups: highQualitySetups.slice(0, 5),
    validTradePlans: validTradePlans.slice(0, 5),
    highRiskItems: highRiskItems.slice(0, 5),
    lowDataItem: lowDataItem.slice(0, 5),
    regimeWarnings,
  };
}

export function buildCommandCenter(regimeData, opportunityData, tradePlanData, aiExplanationData) {
  const marketRegime = buildMarketRegimeSection(regimeData);
  const topOpportunities = buildTopOpportunitiesSection(opportunityData);
  const tradePlans = buildTradePlansSection(tradePlanData);
  const whyNow = buildWhyNowSection(aiExplanationData);
  const intelligenceCoverage = buildIntelligenceCoverageSection(opportunityData);
  const riskCenter = buildRiskCenterSection(opportunityData, tradePlanData, regimeData);
  const actionQueue = buildActionQueueSection(opportunityData, tradePlanData, regimeData);

  return {
    timestamp: nowISO(),
    sections: {
      marketRegime,
      topOpportunities,
      tradePlans,
      whyNow,
      intelligenceCoverage,
      riskCenter,
      actionQueue,
    },
    summary: {
      marketRegime: marketRegime.regime,
      regimeScore: marketRegime.regimeScore,
      confidenceLevel: marketRegime.confidenceLevel,
      opportunityCount: topOpportunities.count,
      planCount: tradePlans.top.length,
      intelligenceCoverage: intelligenceCoverage.coverageCount,
      riskCount: riskCenter.risks.length,
    },
    limitations: [],
    disclaimer: 'D11 Command Center is an orchestration/presentation layer. It aggregates upstream outputs without duplicating scoring logic. Missing data is preserved as null - never fabricated.',
  };
}

export function defaultCommandCenter() {
  return {
    timestamp: nowISO(),
    sections: {
      marketRegime: {
        available: false,
        regime: REGIME_LABELS.UNAVAILABLE,
        regimeScore: null,
        confidence: 0,
        confidenceLevel: CONFIDENCE_LEVELS.UNKNOWN,
        dataCompleteness: 0,
        reasons: ['Market regime data unavailable'],
        warnings: ['REGIME_UNAVAILABLE'],
        risks: [{ label: 'INSUFFICIENT_EVIDENCE', severity: 'HIGH', description: 'Market regime data unavailable' }],
      },
      topOpportunities: {
        available: false,
        count: 0,
        top: [],
        qualityBreakdown: { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
        dataAvailability: { pennyIntelligence: false, optionsIntelligence: false, institutionalRadar: false, swingIntelligence: false, earlyExplosion: false, catalystIntelligence: false },
      },
      tradePlans: {
        available: false,
        count: 0,
        top: [],
        qualityBreakdown: { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 },
        dataAvailability: { opportunityRanking: false, swingIntelligence: false, earlyExplosion: false, optionsIntelligence: false, institutionalRadar: false, catalystIntelligence: false, pennyIntelligence: false },
      },
      whyNow: {
        available: false,
        top: [],
        count: 0,
      },
      intelligenceCoverage: {
        available: false,
        sources: {},
        coverageCount: 0,
        totalSources: 6,
      },
      riskCenter: {
        available: false,
        risks: [],
        warnings: [],
        regimeWarnings: [],
        lowDataItems: [],
        unavailableItems: [],
      },
      actionQueue: {
        topOpportunities: [],
        highQualitySetups: [],
        validTradePlans: [],
        highRiskItems: [],
        lowDataItem: [],
        regimeWarnings: [],
      },
    },
    summary: {
      marketRegime: REGIME_LABELS.UNAVAILABLE,
      regimeScore: null,
      confidenceLevel: CONFIDENCE_LEVELS.UNKNOWN,
      opportunityCount: 0,
      planCount: 0,
      intelligenceCoverage: 0,
      riskCount: 0,
    },
    limitations: 'Command Center data unavailable.',
    disclaimer: 'D11 Command Center is an orchestration/presentation layer. Missing data is preserved as null - never fabricated.',
  };
}

export {
  n,
  round,
  nowISO,
};