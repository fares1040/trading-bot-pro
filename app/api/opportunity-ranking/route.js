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

async function analyzeSymbol(symbol) {
  try {
    // Fetch market data ONCE — shared across B1-B6
    let marketData = null;
    let stockData = null;
    let secIntelligence = null;
    let optionsData = null;
    let finraData = null;

    // Market data: fetchChart + analyzeQuote (shared by B4, B5, B6)
    try {
      const { meta, quote } = await fetchChart(symbol, '6mo');
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

    const institutionalRadar = secIntelligence
      ? buildInstitutionalRadarResult(symbol, secIntelligence, finraData, null)
      : defaultInstitutionalRadar(symbol);

    const catalystIntelligence = secIntelligence || marketData
      ? buildCatalystIntelligenceManager(symbol, secIntelligence, marketData)
      : defaultCatalystIntelligenceManager(symbol);

    // Compose C7 with all B1-B6 sources
    return buildOpportunityRanking(symbol, {
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
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
        symbols.slice(i, i + BATCH_SIZE).map((symbol) => analyzeSymbol(symbol))
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

    const qualityBreakdown = {};
    const qualityLevels = ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'];
    qualityLevels.forEach((q) => { qualityBreakdown[q] = results.filter((r) => r.quality === q).length; });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: ranked.length,
      scanned: symbols.length,
      data: ranked,
      top: top,
      alternatives: alternatives,
      ranking,
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
