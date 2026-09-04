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
  rankOpportunities,
  buildQualityBreakdown,
  buildOpportunityDataAvailability,
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
import { fetchInstitutionalData } from '@/lib/institutional-provider.js';
import { calculateInstitutionalScore } from '@/lib/institutional-provider.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 6;
const SEC_RATE_LIMIT_DELAY = 200;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch the live universe from the project's own /api/stocks endpoint so that
// C10 Market Regime can compute breadth + volume from real per-symbol evidence.
// No symbol, no setupScore, no relativeVolume is fabricated; missing fields
// are preserved and the engine handles them as null.
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

async function analyzeSymbol(symbol, marketRegime = null) {
  try {
    // Fetch market data ONCE — shared across B1-B6
    let marketData = null;
    let stockData = null;
    let secIntelligence = null;
    let optionsData = null;
    let finraData = null;
    let quote = null;

    // Market data: fetchChart + analyzeQuote (shared by B4, B5, B6)
    try {
      const { meta, quote: fetchedQuote } = await fetchChart(symbol, '6mo');
      quote = fetchedQuote || {};
      marketData = analyzeQuote(meta || {}, quote || []);
      stockData = marketData;
    } catch (e) {
      marketData = null;
      stockData = null;
    }

    // SEC data: shared by B1, B3, B6
    try {
      secIntelligence = await buildSecIntelligence(symbol);
    } catch (e) {
      secIntelligence = null;
    }

    // Options data: for B2 only
    try {
      const chain = await fetchOptionsChain(symbol);
      optionsData = chain;
    } catch (e) {
      optionsData = null;
    }

    // FINRA institutional data: for B3 only. Safe per-symbol fetch.
    // If credentials are missing or verification fails, fetchInstitutionalData
    // returns an unavailable-state object. We do not crash the whole analysis.
    try {
      finraData = await fetchInstitutionalData(symbol);
    } catch (e) {
      finraData = null;
    }

    // Build all B1-B6 intelligence from shared data
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

    const catalystIntelligence = secIntelligence || marketData
      ? buildCatalystIntelligenceManager(symbol, secIntelligence, marketData)
      : defaultCatalystIntelligenceManager(symbol);

    // Build methodology evidence layers (pure functions, no network)
    // Fix gamma context sequencing: compute gamma BEFORE horizon
    const liquidityIntelligence = marketData
      ? buildLiquidityIntelligence(marketData)
      : null;

    // Preserve raw OHLCV arrays (fix shadowing: do NOT overwrite quote with marketData)
    const rawQuote = quote || {};
    const quoteData = marketData || {};
    const highs = rawQuote?.high || [];
    const lows = rawQuote?.low || [];
    const closes = rawQuote?.close || [];
    const volumes = rawQuote?.volume || [];
    const opens = rawQuote?.open || [];

    // Compute gamma BEFORE horizon so gamma feeds into opportunity evaluation
    const gammaContext = buildGammaContext({
      symbol,
      optionsContracts: optionsData?.contracts || [],
    });

    const classicalEvidence = closes.length >= 10
      ? buildClassicalTechnicalEvidence({
          highs,
          lows,
          closes,
          volumes,
          existingSupport: quoteData?.support20 || null,
          existingResistance: quoteData?.resistance20 || null,
          significantLevels: [quoteData?.support20, quoteData?.resistance20].filter(Boolean),
          symbol,
        })
      : defaultClassicalTechnicalEvidence(symbol);

    const candlestickEvidence = opens.length >= 2 && highs.length >= 2 && lows.length >= 2 && closes.length >= 2
      ? buildCandlestickPatterns({
          opens,
          highs,
          lows,
          closes,
          symbol,
        })
      : defaultCandlestickPatterns(symbol);

    // Fetch market regime once per request (C10 feeds into Horizon)
    // Note: regime is computed once at GET level below; here we rely on the
    // regime passed from the route-level fetch (see below in analyzeSymbol).
    // For per-symbol evaluation we accept marketRegime from the route context.
    const horizonEvidence = buildOpportunityHorizon(symbol, {
      secIntelligence,
      catalystIntelligence,
      swingIntelligence,
      marketData,
      liquidityIntelligence,
      institutionalRadar,
      classicalEvidence,
      optionsIntelligence,
      gammaContext,
      marketRegime: marketRegime ? {
        regimeScore: marketRegime.regimeScore,
        score: marketRegime.regimeScore,
        label: marketRegime.regime,
        risk: marketRegime.regime === 'BULLISH' ? 'FAVORABLE' : marketRegime.regime === 'BEARISH' || marketRegime.regime === 'RISK_OFF' ? 'DEFENSIVE' : 'NORMAL',
      } : null,
    });

    // Compose C7 with all B1-B6 sources + methodology evidence
    return buildOpportunityRanking(symbol, {
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
    }, {
      horizonEvidence,
      classicalEvidence,
      candlestickEvidence,
      gammaContext,
    });
  } catch (error) {
    console.error(`Opportunity Ranking error for ${symbol}:`, error?.message || error);
    return defaultOpportunityRanking(symbol);
  }
}

function buildDataAvailabilitySummary(results) {
  const availability = {
    pennyIntelligence: false,
    optionsIntelligence: false,
    institutionalRadar: false,
    swingIntelligence: false,
    earlyExplosion: false,
    catalystIntelligence: false,
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
  }

  return availability;
}

function buildSourceBreakdown(results) {
  const breakdown = {
    pennyIntelligence: 0,
    optionsIntelligence: 0,
    institutionalRadar: 0,
    swingIntelligence: 0,
    earlyExplosion: 0,
    catalystIntelligence: 0,
  };

  if (!Array.isArray(results)) return breakdown;

  for (const r of results) {
    for (const key of Object.keys(breakdown)) {
      if (r.dataAvailability && r.dataAvailability[key]) {
        breakdown[key]++;
      }
    }
  }

  return breakdown;
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

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '0', 10)));
    // If limit is 0 or not provided, return all results (backward compatibility)
    const limitAll = limit === 0;

    // Fetch market regime once (C10 feeds Horizon — minimal overhead, 4 parallel index fetches)
    let marketRegime = null;
    try {
      const [indices, universe] = await Promise.all([
        fetchIndices().catch(() => []),
        fetchUniverseForRegime(request).catch(() => []),
      ]);
      if (indices && indices.length > 0) {
        marketRegime = buildMarketRegime(indices, universe);
      }
    } catch (e) {
      marketRegime = null;
    }

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
        ranking: { method: 'opportunity_score', total: 0 },
        filters: {
          quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
          source: ['pennyIntelligence', 'optionsIntelligence', 'institutionalRadar', 'swingIntelligence', 'earlyExplosion', 'catalystIntelligence'],
        },
        dataAvailability: buildDataAvailabilitySummary([]),
        qualityBreakdown: buildQualityBreakdown([]),
        sourceBreakdown: buildSourceBreakdown([]),
        limitations: 'C7 composes intelligence from B1-B6 using shared market data and SEC EDGAR. No duplicate upstream requests.',
        disclaimer: 'تحليل فرصة التداول مبني على بيانات مصادر ذكاء متاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر.',
        errors: [],
      }, { status: 503 });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = await Promise.allSettled(
        symbols.slice(i, i + BATCH_SIZE).map((symbol) => analyzeSymbol(symbol, marketRegime))
      );
        for (const item of batch) {
          if (item.status === 'fulfilled') {
            results.push(item.value);
          } else {
            errors.push(item.reason?.message || 'unknown error');
          }
        }

        // Brief delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < symbols.length) {
          await sleep(SEC_RATE_LIMIT_DELAY);
        }
      }

    const { ranked, top, alternatives, ranking } = rankOpportunities(results);

    // Apply pagination if limit is specified
    const totalResults = ranked.length;
    let paginatedRanked = ranked;
    let pagination = {
      page: 1,
      limit: totalResults,
      totalPages: 1,
      totalResults,
      hasNext: false,
      hasPrevious: false
    };

    if (!limitAll && limit > 0) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      paginatedRanked = ranked.slice(startIndex, endIndex);
      pagination = {
        page,
        limit,
        totalResults,
        totalPages: Math.ceil(totalResults / limit),
        hasNext: endIndex < totalResults,
        hasPrevious: page > 1
      };
    }

    const qualityBreakdown = buildQualityBreakdown(results);
    const qualityLevels = ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: paginatedRanked.length,
      scanned: symbols.length,
      data: paginatedRanked,
      top: top,
      alternatives: alternatives,
      ranking: {
        ...ranking,
        total: totalResults // Keep the actual total for ranking metadata
      },
      pagination,
      filters: {
        quality: qualityLevels,
        source: ['pennyIntelligence', 'optionsIntelligence', 'institutionalRadar', 'swingIntelligence', 'earlyExplosion', 'catalystIntelligence'],
        confidence: ['HIGH', 'MODERATE', 'LOW', 'VERY_LOW', 'UNKNOWN'],
        significance: ['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'UNKNOWN'],
      },
      dataAvailability: buildDataAvailabilitySummary(results),
      qualityBreakdown,
      sourceBreakdown: buildSourceBreakdown(results),
      limitations:
        'C7 Opportunity Ranking composes intelligence from B1-B6 using shared market data. ' +
        'Market data fetched once per symbol via market-engine.js. ' +
        'SEC data fetched once per symbol via sec-filings.js and shared across B1, B3, B6. ' +
        'Options chain fetched once per symbol for B2. ' +
        'No duplicate upstream requests. ' +
        'Scores are evidence-weighted aggregations — not simple averages. ' +
        'Missing intelligence sources result in null component scores — never fabricated.',
      disclaimer:
        'تحليل فرصة التداول مبني على بيانات مصادر ذكاء متاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
        'Opportunity Ranking (C7) is analytical only — not a buy/sell recommendation. ' +
        'Missing intelligence sources remain null — never fabricated. ' +
        'Scores are evidence-weighted aggregations of B1–B6 outputs.',
      errors: errors.slice(0, 5),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Opportunity Ranking API Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Opportunity Ranking',
        timestamp: new Date().toISOString(),
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        ranking: { method: 'opportunity_score', total: 0 },
        filters: {
          quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
          source: ['pennyIntelligence', 'optionsIntelligence', 'institutionalRadar', 'swingIntelligence', 'earlyExplosion', 'catalystIntelligence'],
        },
        dataAvailability: buildDataAvailabilitySummary([]),
        qualityBreakdown: buildQualityBreakdown([]),
        sourceBreakdown: buildSourceBreakdown([]),
        limitations: 'API error — analysis unavailable.',
        disclaimer: 'تحليل فرصة التداول مبني على بيانات مصادر ذكاء متاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}
