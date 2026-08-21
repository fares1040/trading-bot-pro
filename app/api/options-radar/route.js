import { NextResponse } from 'next/server';
import { fetchOptionsChain, clearOptionsCache } from '@/lib/options-provider.js';
import {
  calculateOptionsLiquidity,
  calculateVolumeStrength,
  calculateOpenInterestStrength,
  calculatePremiumQuality,
  calculateContractQuality,
  calculateOptionsScore,
  classifyOptionsRisk,
  buildOptionsReasons,
  buildOptionsWarnings,
  buildOptionsIntelligence,
  buildOptionsFlowIntelligence,
  rankOptionsContracts,
  buildBestContractSummary,
  buildOptionsDecision,
  buildSymbolDecisionSummary,
  buildStrategyCandidates,
  buildSymbolStrategySummary,
  enrichStrategyWithDecision,
  selectRecommendedStrategy,
} from '@/lib/options-intelligence.js';
import { buildSecIntelligence } from '@/lib/sec-filings.js';
import {
  getInstitutionalProviderStatus,
  fetchInstitutionalData,
  calculateInstitutionalScore,
} from '@/lib/institutional-provider.js';
import {
  buildInstitutionalIntelligence,
} from '@/lib/institutional-intelligence.js';
import {
  buildInstitutionalSignal,
} from '@/lib/institutional-signal.js';
import {
  rankInstitutionalSignal,
  rankInstitutionalOpportunities,
  selectTopInstitutional,
} from '@/lib/institutional-ranking.js';
import {
  buildInstitutionalDecision,
  rankInstitutionalDecisions,
} from '@/lib/institutional-decision.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const n = (value) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
}

function mapContractToRoute(normalized) {
  const contract = normalized.symbol || null;
  const side = normalized.optionType || null;

  return {
    contract,
    side,
    strike: n(normalized.strike),
    expiry: normalized.expiry || null,
    daysToExpiration: n(normalized.daysToExpiration),
    premium: n(normalized.premium),
    contractCost: n(normalized.contractCost),
    bid: n(normalized.bid),
    ask: n(normalized.ask),
    last: n(normalized.lastPrice),
    volume: n(normalized.volume),
    openInterest: n(normalized.openInterest),
    impliedVolatility: n(normalized.impliedVolatility),
    spreadPct: n(normalized.spreadPct),
    underlying: n(normalized.underlying),
    distancePct: n(normalized.distancePct),
    score: Number(normalized.score ?? 0),
    riskLabel: normalized.riskLabel || 'HIGH RISK / SPECULATIVE',
    source: normalized.source || 'Yahoo Finance options chain',
    optionsIntelligence: buildOptionsIntelligence(normalized),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const requested = (searchParams.get('symbols') || '')
      .split(',')
      .map(cleanSymbol)
      .filter(Boolean)
      .slice(0, 15);

    let symbols = requested;

    if (!symbols.length) {
      const origin = new URL(request.url).origin;
      const radarResponse = await fetch(`${origin}/api/stocks`, { cache: 'no-store' });
      const radarJson = await radarResponse.json().catch(() => ({}));

      symbols = (
        Array.isArray(radarJson?.data)
          ? radarJson.data
          : []
      )
        .filter((x) => Number(x.price) > 0 && Number(x.price) <= 100)
        .sort((a, b) => Number(b.setupScore || 0) - Number(a.setupScore || 0))
        .slice(0, 12)
        .map((x) => cleanSymbol(x.symbol))
        .filter(Boolean);
    }

    // === A3.1 Institutional Radar Core ===
    const finraStatus = getInstitutionalProviderStatus();
    const finraAvailable = finraStatus.available === true && finraStatus.verified === true;

    const settled = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const result = await fetchOptionsChain(symbol);
        const rawContracts = result.available ? result.contracts : [];
        const rows = rawContracts.map(mapContractToRoute);
        const flow = buildOptionsFlowIntelligence(rawContracts);
        const ranking = rankOptionsContracts(rawContracts);
        const summary = buildBestContractSummary(rawContracts, ranking);
        const decisionSummary = buildSymbolDecisionSummary(rawContracts, ranking);
        const strategySummary = buildSymbolStrategySummary(ranking);
        if (strategySummary.strategyCandidates && strategySummary.strategyCandidates.length > 0) {
          strategySummary.strategyCandidates = strategySummary.strategyCandidates.map(enrichStrategyWithDecision);
        }
        if (strategySummary.bestStrategy) {
          enrichStrategyWithDecision(strategySummary.bestStrategy);
        }
        const strategyDecision = selectRecommendedStrategy(strategySummary.strategyCandidates || []);

        // === A3.1 Institutional Radar Core (additive pass-through) ===
        // SEC EDGAR data — public, no credentials, cached in-memory.
        let secData = null;
        try {
          secData = await buildSecIntelligence(symbol, fetch, 5000);
        } catch {
          secData = null;
        }

        // FINRA ATS/OTC data — only fetched when provider is verified.
        let finraData = null;
        let finraScore = null;
        if (finraAvailable) {
          try {
            finraData = await fetchInstitutionalData(symbol);
            if (finraData) {
              finraScore = calculateInstitutionalScore(finraData);
            }
          } catch {
            finraData = null;
            finraScore = null;
          }
        }

        const institutionalIntelligence = buildInstitutionalIntelligence(
          symbol,
          secData,
          finraData,
          finraScore
        );

        // === A3.2 Institutional Signal & Conviction (additive pass-through) ===
        const institutionalSignal = buildInstitutionalSignal(institutionalIntelligence);

        // === A3.3 Institutional Ranking & Conviction Engine (additive pass-through) ===
        const institutionalRank = rankInstitutionalSignal(institutionalSignal, symbol);

        // === A3 Final: Institutional Decision (additive pass-through) ===
        const institutionalDecision = buildInstitutionalDecision(
          institutionalIntelligence,
          institutionalSignal,
          institutionalRank,
          symbol
        );

        return {
          symbol,
          rows,
          flow,
          ranking,
          summary,
          decisionSummary,
          strategySummary,
          strategyDecision,
          institutionalIntelligence,
          institutionalSignal,
          institutionalRank,
        };
      })
    );

    const all = [];
    const errors = [];
    let successfulSources = 0;
    const symbolRankingMap = new Map();

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        successfulSources += 1;
        symbolRankingMap.set(item.value.symbol, {
          flow: item.value.flow,
          ranking: item.value.ranking,
          summary: item.value.summary,
          decision: item.value.decisionSummary,
          strategy: item.value.strategySummary,
          strategyDecision: item.value.strategyDecision,
          institutionalIntelligence: item.value.institutionalIntelligence,
          institutionalSignal: item.value.institutionalSignal,
          institutionalRank: item.value.institutionalRank,
          institutionalDecision: item.value.institutionalDecision,
        });
        all.push(
          ...item.value.rows.map((row, index) => ({
            ...row,
            symbol: item.value.symbol,
            optionsFlow: item.value.flow,
            institutionalActivityScore: item.value.institutionalIntelligence?.institutionalActivityScore ?? null,
            institutionalRisk: item.value.institutionalIntelligence?.institutionalRisk ?? 'UNAVAILABLE',
            institutionalDataStatus: item.value.institutionalIntelligence?.dataStatus ?? 'unavailable',
            institutionalSignalScore: item.value.institutionalSignal?.institutionalSignalScore ?? null,
            institutionalConviction: item.value.institutionalSignal?.institutionalConviction ?? 'UNAVAILABLE',
            institutionalRankScore: item.value.institutionalRank?.institutionalRankScore ?? null,
            institutionalRankClass: item.value.institutionalRank?.institutionalRankClass ?? 'UNAVAILABLE',
            institutionalDecisionScore: item.value.institutionalDecision?.institutionalDecisionScore ?? null,
            institutionalStatus: item.value.institutionalDecision?.institutionalStatus ?? 'UNAVAILABLE',
            contractRankScore: item.value.ranking[index]?.contractRankScore ?? null,
            contractQuality: item.value.ranking[index]?.contractQuality ?? null,
            riskAdjustedScore: item.value.ranking[index]?.riskAdjustedScore ?? null,
            riskAdjustedLevel: item.value.ranking[index]?.riskAdjustedLevel ?? null,
            dteRisk: item.value.ranking[index]?.dteRisk ?? null,
            dteQualityScore: item.value.ranking[index]?.dteQualityScore ?? null,
            ivLevel: item.value.ranking[index]?.ivLevel ?? null,
            ivRiskScore: item.value.ranking[index]?.ivRiskScore ?? null,
            strikeClassification: item.value.ranking[index]?.strikeClassification ?? null,
            strikeQualityScore: item.value.ranking[index]?.strikeQualityScore ?? null,
            premiumQualityScore: item.value.ranking[index]?.premiumQualityScore ?? null,
            premiumQualityLevel: item.value.ranking[index]?.premiumQualityLevel ?? null,
            contractWarnings: item.value.ranking[index]?.contractWarnings || [],
            contractReasons: item.value.ranking[index]?.contractReasons || [],
            decisionScore: item.value.decisionSummary?.decisionScore ?? null,
            decisionStatus: item.value.decisionSummary?.decisionStatus ?? null,
            executionQuality: item.value.decisionSummary?.executionQuality ?? null,
            decisionRisk: item.value.decisionSummary?.riskLevel ?? null,
            decisionReasons: item.value.decisionSummary?.recommendedReasons || [],
            decisionWarnings: item.value.decisionSummary?.avoidContracts?.map(a => a.reason).filter(Boolean) || [],
            strategyDecisionScore: item.value.strategyDecision?.recommended?.strategyDecisionScore ?? null,
            strategyDecisionStatus: item.value.strategyDecision?.recommended?.decisionStatus ?? null,
            strategyCombinedRisk: item.value.strategyDecision?.recommended?.combinedRisk ?? null,
          }))
        );
      } else {
        errors.push(item.reason?.message || 'options provider error');
      }
    }

    const cents =
      all
        .filter((x) => x.daysToExpiration != null && x.daysToExpiration > 0)
        .filter((x) => x.premium != null && x.premium > 0 && x.premium <= 1)
        .filter((x) => (x.volume || 0) > 0 || (x.openInterest || 0) > 0)
        .filter((x) => x.spreadPct == null || x.spreadPct <= 35)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 30);

    const optionsAvailable = successfulSources > 0 && all.length > 0;

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        count: cents.length,
        data: cents,
        scannedSymbols: symbols,
        optionsRanking: Object.fromEntries(symbolRankingMap),
        institutionalOpportunities: selectTopInstitutional(
          Array.from(symbolRankingMap.values()).map((v) => v.institutionalSignal),
          5
        ),
        institutionalDecisions: rankInstitutionalDecisions(
          Array.from(symbolRankingMap.values()).map((v) => v.institutionalDecision),
          Object.fromEntries(
            Array.from(symbolRankingMap.entries()).map(([k, v]) => [k, v.institutionalSignal])
          ),
          Object.fromEntries(
            Array.from(symbolRankingMap.entries()).map(([k, v]) => [k, v.institutionalIntelligence])
          ),
          10
        ),
        dataAvailability: {
          options: optionsAvailable,
          darkPool: false,
          institutionalFlow: finraAvailable || true,
        },
        methodology: {
          premiumMax: 1,
          note: 'عقود تحت $1 للـpremium فقط. لا تعني إمكانية مضاعفة مؤكدة. تكلفة العقد = premium × 100.',
        },
        errors: errors.slice(0, 3),
        source: 'Yahoo Finance options chain',
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Options radar error:', error?.message || error);

    return NextResponse.json(
      {
        success: false,
        error: 'تعذر قراءة سلسلة الخيارات الحالية.',
        data: [],
        dataAvailability: {
          options: false,
          darkPool: false,
          institutionalFlow: finraAvailable || true,
         },
      },
      {
        status: 503,
      }
    );
  }
}
