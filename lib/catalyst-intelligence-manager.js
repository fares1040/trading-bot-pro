/**
 * Catalyst Intelligence Manager (B6)
 *
 * Orchestration/manager layer that wraps B6 Catalyst Intelligence Engine
 * (lib/catalyst-intelligence.js) into a production-ready Catalyst
 * Intelligence Manager with:
 *   - Provenance tracking (B6 engine → B6 manager)
 *   - Unified output contract
 *   - Normalized catalyst objects
 *   - Aggregated risks
 *   - B6-specific ranking with stable symbol tie-break
 *   - Data quality aggregation
 *
 * Pure function module — no network calls in the manager itself.
 * No BUY/SELL guarantees. Missing data preserved as null. Never fabricated.
 *
 * Composes:
 *   B6 Core — Catalyst Intelligence Engine (lib/catalyst-intelligence.js)
 *   A6 — SEC EDGAR Intelligence (lib/sec-edgar-intelligence.js)
 *   market-engine.js for market data
 */

import {
  buildCatalystIntelligence,
  defaultCatalystIntelligence,
  rankCatalystOpportunities,
  calculateCatalystQuality,
  normalizeCatalyst,
  CATALYST_QUALITY_THRESHOLDS,
  CATALYST_WEIGHTS,
} from './catalyst-intelligence.js';

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

function normalizeCatalysts(catalysts) {
  if (!Array.isArray(catalysts)) return [];
  return catalysts
    .map(normalizeCatalyst)
    .filter((c) => c !== null);
}

function classifyCatalystRisk(score) {
  if (score == null) return 'UNKNOWN';
  if (score >= CATALYST_QUALITY_THRESHOLDS.TOP) return 'LOW';
  if (score >= CATALYST_QUALITY_THRESHOLDS.STRONG) return 'MODERATE_LOW';
  if (score >= CATALYST_QUALITY_THRESHOLDS.WATCH) return 'MODERATE';
  if (score >= CATALYST_QUALITY_THRESHOLDS.WEAK) return 'MODERATE_HIGH';
  return 'HIGH';
}

function buildCatalystIntelligenceManager(symbol, secIntelligence, marketData, opts = {}) {
  const rawResult = buildCatalystIntelligence(symbol, secIntelligence, marketData);
  const timestamp = opts.timestamp || nowISO();

  // If no catalysts and no score, return the default with symbol set
  if (rawResult.catalystScore == null && rawResult.catalysts.length === 0) {
    const def = defaultCatalystIntelligence(symbol || null);
    def.timestamp = timestamp;
    def.provenance = {
      intelligence: 'B6',
      engine: 'B6 Catalyst Intelligence',
      manager: 'B6',
      ...(secIntelligence ? { secSource: 'SEC EDGAR (A6)' } : {}),
      ...(marketData ? { marketSource: 'Yahoo Finance via market-engine.js' } : {}),
    };
    def.dataAvailability = {
      ...def.dataAvailability,
      ...rawResult.dataAvailability,
    };
    def.dataCompleteness = rawResult.dataCompleteness || 0;
    return def;
  }

  const normalizedCatalysts = normalizeCatalysts(rawResult.catalysts);

  return {
    ...rawResult,
    symbol: symbol || rawResult.symbol || null,
    timestamp,
    catalysts: normalizedCatalysts,

    source: rawResult.source || null,
    provenance: {
      ...rawResult.provenance,
      manager: 'B6',
    },

    componentWeights: {
      significance: CATALYST_WEIGHTS.significance * 100,
      recency: CATALYST_WEIGHTS.recency * 100,
      reliability: CATALYST_WEIGHTS.reliability * 100,
      freshness: CATALYST_WEIGHTS.freshness * 100,
      marketRelevance: CATALYST_WEIGHTS.marketRelevance * 100,
      dataCompleteness: CATALYST_WEIGHTS.dataCompleteness * 100,
    },

    catalystRisk: classifyCatalystRisk(rawResult.catalystScore),

    secEvidence: secIntelligence
      ? {
          secEdgarScore: secIntelligence.secEdgarScore,
          filingCategory: secIntelligence.filingCategory,
          latestFiling: secIntelligence.latestFiling,
          insiderActivity: secIntelligence.insiderActivity,
          materialEventInfo: secIntelligence.materialEventInfo,
          capitalStructureSignals: secIntelligence.capitalStructureSignals,
          secRiskScore: secIntelligence.secRiskScore,
          dataStatus: secIntelligence.secDataStatus,
        }
      : null,

    disclaimer:
      'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Catalyst Intelligence Manager (B6) composes B6 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated. ' +
      'Data from SEC EDGAR and Yahoo Finance.',
  };
}

function defaultCatalystIntelligenceManager(symbol = null) {
  const coreDefault = defaultCatalystIntelligence(symbol);
  return {
    ...coreDefault,
    timestamp: nowISO(),
    source: null,
    provenance: {
      intelligence: 'B6',
      engine: 'B6 Catalyst Intelligence',
      manager: 'B6',
    },
    componentWeights: {
      significance: CATALYST_WEIGHTS.significance * 100,
      recency: CATALYST_WEIGHTS.recency * 100,
      reliability: CATALYST_WEIGHTS.reliability * 100,
      freshness: CATALYST_WEIGHTS.freshness * 100,
      marketRelevance: CATALYST_WEIGHTS.marketRelevance * 100,
      dataCompleteness: CATALYST_WEIGHTS.dataCompleteness * 100,
    },
    catalystRisk: 'UNKNOWN',
    secEvidence: null,
    catalysts: [],
    catalystScore: null,
    quality: 'UNAVAILABLE',
    dataAvailability: {
      secData: false,
      marketData: false,
      catalysts: false,
      catalystScore: false,
      catalystType: false,
      reliability: false,
      significance: false,
      recency: false,
    },
    dataCompleteness: 0,
    reasons: ['No catalyst evidence available for symbol'],
    warnings: ['NO_CATALYST_EVIDENCE', 'NO_VERIFIED_CATALYST'],
    flags: [],
    risks: [{ label: 'NO_CATALYST_RISK', severity: 'LOW', description: 'No verified catalyst evidence for symbol' }],
    disclaimer:
      'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Catalyst Intelligence Manager (B6) composes B6 core engine. ' +
      'Analytical only — not a buy/sell recommendation. ' +
      'Missing data preserved as null — never fabricated.',
  };
}

function rankCatalystOpportunitiesB6(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { data: [], top: [], alternatives: [], ranking: { method: 'catalyst_score', total: 0 } };
  }

  const { ranked, top, alternatives, ranking } = rankCatalystOpportunities(results);

  return {
    data: ranked,
    top: top,
    alternatives: alternatives,
    ranking: {
      ...ranking,
      method: 'catalyst_score_desc_then_data_completeness_recency_significance_alpha',
      totalResults: results.length,
    },
  };
}

function selectTopCatalysts(results, limit = 5) {
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }
  return rankCatalystOpportunities(results).ranked.slice(0, limit);
}

function buildQualityBreakdown(results) {
  const breakdown = {
    TOP: 0,
    STRONG: 0,
    WATCH: 0,
    WEAK: 0,
    UNAVAILABLE: 0,
  };
  if (!Array.isArray(results)) return breakdown;
  for (const r of results) {
    const q = r.quality || 'UNAVAILABLE';
    if (breakdown[q] != null) breakdown[q]++;
    else breakdown.UNAVAILABLE++;
  }
  return breakdown;
}

function buildDataAvailability(results) {
  const availability = {
    secData: false,
    marketData: false,
    catalysts: false,
    catalystScore: false,
    catalystType: false,
    reliability: false,
    significance: false,
    recency: false,
    insiderActivity: false,
    materialEvents: false,
    earningsData: false,
    offerings: false,
  };
  if (!Array.isArray(results)) return availability;
  for (const r of results) {
    if (r.dataAvailability) {
      for (const [key, val] of Object.entries(r.dataAvailability)) {
        if (val && availability.hasOwnProperty(key)) {
          availability[key] = true;
        }
      }
    }
    if (r.secEvidence) {
      if (r.secEvidence.insiderActivity?.form4Detected) availability.insiderActivity = true;
      if (r.secEvidence.materialEventInfo?.materialEventDetected) availability.materialEvents = true;
    }
    if (r.upcomingDate) availability.earningsData = true;
    if (r.catalystTypes && r.catalystTypes.includes('SEC_OFFERING')) availability.offerings = true;
  }
  return availability;
}

export {
  n,
  clamp,
  round,
  nowISO,
  classifyCatalystRisk,
  normalizeCatalysts,
  buildCatalystIntelligenceManager,
  defaultCatalystIntelligenceManager,
  rankCatalystOpportunitiesB6,
  selectTopCatalysts,
  buildQualityBreakdown,
  buildDataAvailability,
};

export default buildCatalystIntelligenceManager;
