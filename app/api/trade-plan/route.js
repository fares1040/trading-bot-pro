import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { fetchOptionsChain } from '@/lib/options-provider.js';
import { buildSecIntelligence } from '@/lib/sec-filings';
import {
  buildPennyIntelligence,
  defaultPennyIntelligence,
} from '@/lib/penny-intelligence-manager.js';
import {
  normalizeSwingIntelligence as buildSwingIntelligenceManagerFn,
  defaultSwingIntelligenceManager,
} from '@/lib/swing-intelligence-manager.js';
import {
  buildEarlyExplosionIntelligenceManager,
  defaultEarlyExplosionIntelligenceManager,
} from '@/lib/early-explosion-intelligence-manager.js';
import {
  buildOptionsIntelligenceResult,
  defaultOptionsIntelligence,
} from '@/lib/options-intelligence-manager.js';
import {
  buildInstitutionalRadarResult,
  defaultInstitutionalRadar,
} from '@/lib/institutional-radar-manager.js';
import {
  buildCatalystIntelligenceManager,
  defaultCatalystIntelligenceManager,
} from '@/lib/catalyst-intelligence-manager.js';
import {
  buildOpportunityRanking,
  defaultOpportunityRanking,
} from '@/lib/opportunity-ranking.js';
import {
  buildOpportunityHorizon,
  defaultOpportunityHorizon,
} from '@/lib/opportunity-horizon.js';
import {
  buildClassicalTechnicalEvidence,
  defaultClassicalTechnicalEvidence,
} from '@/lib/classical-technical-evidence.js';
import {
  buildCandlestickPatterns,
  defaultCandlestickPatterns,
} from '@/lib/candlestick-patterns.js';
import {
  buildGammaContext,
  defaultGammaContext,
} from '@/lib/gamma-context.js';
import {
  buildLiquidityIntelligence,
} from '@/lib/liquidity-intelligence.js';
import { fetchIndices } from '@/lib/market-engine.js';
import { buildMarketRegime, defaultMarketRegime } from '@/lib/market-regime-engine.js';
import { fetchInstitutionalData, calculateInstitutionalScore } from '@/lib/institutional-provider.js';
import {
  buildTradePlan,
  defaultTradePlan,
  rankTradePlans,
  buildTradePlanQualityBreakdown,
  buildTradePlanDataAvailability,
} from '@/lib/trade-plan-engine.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 6;
const SEC_RATE_LIMIT_DELAY = 200;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

function normalizeCapital(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeRiskPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100 ? round(n, 2) : null;
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch the live universe from the project's own /api/stocks endpoint so that
// C10 Market Regime can compute breadth + volume from real per-symbol evidence.
// No fabrication. Missing setupScore / relativeVolume are preserved as null.
async function fetchUniverseForRegime(request) {
  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/stocks`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const raw = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.stocks)
      ? json.stocks
      : [];
    return raw
      .map((x) => ({
        setupScore: typeof x?.setupScore === 'number' ? x.setupScore : null,
        relativeVolume: typeof x?.relativeVolume === 'number' ? x.relativeVolume : null,
      }))
      .filter((x) => x.setupScore != null || x.relativeVolume != null);
  } catch {
    return [];
  }
}

async function analyzeSymbol(symbol, opts, marketRegime = null) {
  try {
    let marketData = null;
    let stockData = null;
    let secIntelligence = null;
    let optionsData = null;

    let highs = [];
    let lows = [];
    let closes = [];
    let volumes = [];
    let opens = [];

    try {
      const { meta, quote: rawQuote } = await fetchChart(symbol, '6mo');
      marketData = analyzeQuote(meta || {}, rawQuote || []);
      stockData = marketData;
      // Preserve raw OHLCV for Classical / Candlestick / Gamma / Horizon
      const quoteData = rawQuote || {};
      highs = quoteData?.high || [];
      lows = quoteData?.low || [];
      closes = quoteData?.close || [];
      volumes = quoteData?.volume || [];
      opens = quoteData?.open || [];
    } catch (e) {
      marketData = null;
      stockData = null;
    }

    try {
      secIntelligence = await buildSecIntelligence(symbol);
    } catch (e) {
      secIntelligence = null;
    }

    try {
      const chain = await fetchOptionsChain(symbol);
      optionsData = chain;
    } catch (e) {
      optionsData = null;
    }

    // FINRA institutional data: for B3 only. Safe per-symbol fetch.
    // Returns unavailable-state when credentials missing or verification fails.
    let finraData = null;
    try {
      finraData = await fetchInstitutionalData(symbol);
    } catch (e) {
      finraData = null;
    }

    const pennyIntelligence = stockData
      ? buildPennyIntelligence(stockData, { secIntelligence: secIntelligence || undefined })
      : defaultPennyIntelligence(symbol);

    const swingIntelligence = marketData
      ? buildSwingIntelligenceManagerFn(marketData)
      : defaultSwingIntelligenceManager(symbol);

    const earlyExplosion = marketData
      ? buildEarlyExplosionIntelligenceManager(marketData)
      : defaultEarlyExplosionIntelligenceManager(symbol);

    const optionsIntelligence = optionsData && optionsData.available && Array.isArray(optionsData.contracts) && optionsData.contracts.length > 0
      ? buildOptionsIntelligenceResult(symbol, optionsData.contracts, {
          providerStatus: {
            provider: optionsData.provider,
            source: optionsData.source,
            available: optionsData.available,
          },
          timestamp: optionsData.dataTimestamp,
        })
      : defaultOptionsIntelligence(symbol);

    const institutionalRadar = secIntelligence || finraData
      ? buildInstitutionalRadarResult(symbol, secIntelligence, finraData, finraData && finraData.available ? calculateInstitutionalScore(finraData) : null)
      : defaultInstitutionalRadar(symbol);

    const catalystIntelligence = (secIntelligence || marketData)
      ? buildCatalystIntelligenceManager(symbol, secIntelligence, marketData)
      : defaultCatalystIntelligenceManager(symbol);

    const opportunityRanking = buildOpportunityRanking(symbol, {
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
    }, {
      horizonEvidence: marketRegime ? buildOpportunityHorizon(symbol, {
        secIntelligence,
        catalystIntelligence,
        swingIntelligence,
        marketData,
        liquidityIntelligence: marketData ? buildLiquidityIntelligence(marketData) : null,
        institutionalRadar,
        classicalEvidence: closes.length >= 10 ? buildClassicalTechnicalEvidence({ highs, lows, closes, volumes, symbol }) : defaultClassicalTechnicalEvidence(symbol),
        optionsIntelligence,
        gammaContext: buildGammaContext({ symbol, optionsContracts: optionsData?.contracts || [] }),
        marketRegime: marketRegime ? { regimeScore: marketRegime.regimeScore, score: marketRegime.regimeScore, label: marketRegime.regime, risk: marketRegime.regime === 'BULLISH' ? 'FAVORABLE' : marketRegime.regime === 'BEARISH' || marketRegime.regime === 'RISK_OFF' ? 'DEFENSIVE' : 'NORMAL' } : null,
      }) : null,
      classicalEvidence: closes.length >= 10 ? buildClassicalTechnicalEvidence({ highs, lows, closes, volumes, symbol }) : defaultClassicalTechnicalEvidence(symbol),
      candlestickEvidence: opens.length >= 2 ? buildCandlestickPatterns({ opens, highs, lows, closes, symbol }) : defaultCandlestickPatterns(symbol),
      gammaContext: buildGammaContext({ symbol, optionsContracts: optionsData?.contracts || [] }),
    });

    return buildTradePlan(symbol, {
      opportunityRanking,
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
    }, {
      capital: opts.capital,
      maxRiskPercent: opts.maxRiskPercent,
    });
  } catch (error) {
    console.error(`Trade Plan error for ${symbol}:`, error?.message || error);
    return defaultTradePlan(symbol);
  }
}

export async function GET(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (expectedSecret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);

    const requested = (searchParams.get('symbols') || '')
      .split(',')
      .map(cleanSymbol)
      .filter(Boolean)
      .slice(0, 25);

    let symbols = requested;

    if (!symbols.length) {
      symbols = await fetchTrending(30);
    }

    if (!symbols.length) {
      return NextResponse.json({
        success: false,
        error: 'No valid universe found',
        timestamp: new Date().toISOString(),
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        ranking: { method: 'trade_plan_score', total: 0 },
        filters: {
          quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
          signal: ['STRONG_PLAN', 'VALID_PLAN', 'WATCH', 'AVOID', 'UNAVAILABLE'],
          direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
        },
        dataAvailability: buildTradePlanDataAvailability([]),
        qualityBreakdown: buildTradePlanQualityBreakdown([]),
        limitations: 'C8 composes C7 + B1-B6. Levels come only from upstream zone engines (B4/B5) — never fabricated.',
        disclaimer: 'تحليل وخطط تداول مشروطة فقط — ليست توصية شراء أو بيع. المستويات التي لا توجد لها بيانات موثوقة تبقى غير متاحة.',

        errors: [],
      }, { status: 503 });
    }

    const capital = normalizeCapital(searchParams.get('capital'));
    const maxRiskPercent = normalizeRiskPercent(searchParams.get('riskPercent'));
    const opts = { capital, maxRiskPercent };

    let marketRegime = null;
    try {
      const [indices, universe] = await Promise.all([
        fetchIndices().catch(() => []),
        fetchUniverseForRegime(request).catch(() => []),
      ]);
      if (indices && indices.length > 0) marketRegime = buildMarketRegime(indices, universe);
    } catch (e) { marketRegime = null; }

    const results = [];
    const errors = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = await Promise.allSettled(
        symbols.slice(i, i + BATCH_SIZE).map((symbol) => analyzeSymbol(symbol, opts, marketRegime))
      );
      for (const item of batch) {
        if (item.status === 'fulfilled') {
          results.push(item.value);
        } else {
          errors.push(item.reason?.message || 'unknown error');
        }
      }

      if (i + BATCH_SIZE < symbols.length) {
        await sleep(SEC_RATE_LIMIT_DELAY);
      }
    }

    const { ranked, top, alternatives, ranking } = rankTradePlans(results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: ranked.length,
      scanned: symbols.length,
      data: ranked,
      top,
      alternatives,
      ranking,
      filters: {
        quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
        signal: ['STRONG_PLAN', 'VALID_PLAN', 'WATCH', 'AVOID', 'UNAVAILABLE'],
        direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
      },
      dataAvailability: buildTradePlanDataAvailability(results),
      qualityBreakdown: buildTradePlanQualityBreakdown(results),
      limitations:
        'C8 Opportunity Trade Plan composes C7 + B1-B6 using shared market data. ' +
        'Market data fetched once per symbol via market-engine.js. ' +
        'SEC data fetched once per symbol via sec-filings.js and shared across B1, B3, B6. ' +
        'Options chain fetched once per symbol for B2. ' +
        'C7 computed once per symbol from the same B1-B6 outputs. ' +
        'Levels come only from upstream zone engines (B4/B5) — never fabricated. ' +
        'Missing components are excluded and weights renormalized. ' +
        'No BUY/SELL recommendation. Not financial advice.',
      disclaimer:
        'تحليل وخطط تداول مشروطة فقط — ليست توصية شراء أو بيع. ' +
        'Trade Plan (C8) is conditional only — not a buy/sell recommendation. ' +
        'Levels without trustworthy data remain unavailable. ' +
        'Missing levels remain null — never fabricated.',
      errors: errors.slice(0, 5),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Trade Plan API Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run Trade Plan',
      timestamp: new Date().toISOString(),
      scanned: 0,
      data: [],
      top: [],
      alternatives: [],
      ranking: { method: 'trade_plan_score', total: 0 },
      filters: {
        quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
        signal: ['STRONG_PLAN', 'VALID_PLAN', 'WATCH', 'AVOID', 'UNAVAILABLE'],
        direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
      },
      dataAvailability: buildTradePlanDataAvailability([]),
      qualityBreakdown: buildTradePlanQualityBreakdown([]),
      limitations: 'API error — analysis unavailable.',
      disclaimer: 'تحليل وخطط تداول مشروطة فقط — ليست توصية شراء أو بيع.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    }, { status: 503 });
  }
}
