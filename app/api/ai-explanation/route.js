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
  buildTradePlan,
  defaultTradePlan,
} from '@/lib/trade-plan-engine.js';
import {
  buildAIExplanation,
  defaultExplanation,
  rankExplanations,
  buildExplanationQualityBreakdown,
  buildExplanationDataAvailability,
} from '@/lib/ai-explanation.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 6;
const SEC_RATE_LIMIT_DELAY = 200;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeSymbol(symbol) {
  try {
    let marketData = null;
    let stockData = null;
    let secIntelligence = null;
    let optionsData = null;

    try {
      const { meta, quote } = await fetchChart(symbol, '6mo');
      marketData = analyzeQuote(meta || {}, quote || []);
      stockData = marketData;
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
      ? buildInstitutionalRadarResult(symbol, secIntelligence, null, null)
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
    });

    const tradePlan = buildTradePlan(symbol, {
      opportunityRanking,
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
    });

    return buildAIExplanation(symbol, {
      opportunityRanking,
      pennyIntelligence,
      optionsIntelligence,
      institutionalRadar,
      swingIntelligence,
      earlyExplosion,
      catalystIntelligence,
      tradePlan,
    });
  } catch (error) {
    console.error(`AI Explanation error for ${symbol}:`, error?.message || error);
    return defaultExplanation(symbol);
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
        ranking: { method: 'explanation_score', total: 0 },
        filters: {
          direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
        },
        dataAvailability: buildExplanationDataAvailability([]),
        qualityBreakdown: buildExplanationQualityBreakdown([]),
        limitations: 'C9 composes B1-B6, C7, and C8. Explanations are derived only from existing outputs — never fabricated.',
        disclaimer: 'تحليل شرح الذكاء مبني على مصادر ذكاء موجودة فقط — لا يمثل توصية شراء أو بيع. C9 AI Explanation is derived only from existing outputs. No fabricated levels or confidence.',
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

      if (i + BATCH_SIZE < symbols.length) {
        await sleep(SEC_RATE_LIMIT_DELAY);
      }
    }

    const { ranked, top, alternatives, ranking } = rankExplanations(results);

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
        direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
      },
      dataAvailability: buildExplanationDataAvailability(results),
      qualityBreakdown: buildExplanationQualityBreakdown(results),
      limitations:
        'C9 AI Explanation composes B1-B6, C7, and C8 outputs using shared market data. ' +
        'Market data fetched once per symbol via market-engine.js. ' +
        'SEC data fetched once per symbol via sec-filings.js and shared across B1, B3, B6. ' +
        'Options chain fetched once per symbol for B2. ' +
        'C7 and C8 computed once per symbol from the same B1-B6 outputs. ' +
        'Explanations are derived only from existing outputs — never fabricated. ' +
        'No BUY/SELL recommendation. Not financial advice.',
      disclaimer:
        'تحليل شرح الذكاء مبني على مصادر ذكاء موجودة فقط — لا يمثل توصية شراء أو بيع. ' +
        'C9 AI Explanation is derived only from existing B1-B6, C7, and C8 outputs. ' +
        'Not a buy/sell recommendation. No price levels, targets, or confidence values are fabricated.',
      errors: errors.slice(0, 5),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('AI Explanation API Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run AI Explanation',
      timestamp: new Date().toISOString(),
      scanned: 0,
      data: [],
      top: [],
      alternatives: [],
      ranking: { method: 'explanation_score', total: 0 },
      filters: {
        direction: ['LONG', 'SHORT', 'NEUTRAL', 'UNAVAILABLE'],
      },
      dataAvailability: buildExplanationDataAvailability([]),
      qualityBreakdown: buildExplanationQualityBreakdown([]),
      limitations: 'API error — analysis unavailable.',
      disclaimer: 'تحليل شرح الذكاء مبني على مصادر ذكاء موجودة فقط — لا يمثل توصية شراء أو بيع.',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    }, { status: 503 });
  }
}
