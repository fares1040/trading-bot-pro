import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote, fetchIndices } from '@/lib/market-engine.js';
import { buildSwingIntelligence, defaultSwingIntelligence, rankSwingOpportunities } from '@/lib/swing-intelligence.js';
import { normalizeSwingIntelligence as buildSwingIntelligenceManager, defaultSwingIntelligenceManager } from '@/lib/swing-intelligence-manager.js';
import { buildStructureIntelligence, defaultStructureIntelligence } from '@/lib/structure-intelligence-manager.js';
import { buildCatalystIntelligenceManager, defaultCatalystIntelligenceManager } from '@/lib/catalyst-intelligence-manager.js';
import { buildMarketRegime, defaultMarketRegime } from '@/lib/market-regime-engine.js';
import { buildSecIntelligence } from '@/lib/sec-filings.js';
import {
  buildSwingHorizon,
  defaultSwingHorizon,
  rankSwingHorizonOpportunities,
  SWING_HORIZON_LABEL,
} from '@/lib/swing-horizon.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 6;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeSymbol(symbol, marketRegime = null) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);

    const swingIntelligence = marketData
      ? buildSwingIntelligenceManager(marketData)
      : defaultSwingIntelligenceManager(symbol);

    const highs = quote?.high || [];
    const lows = quote?.low || [];
    const closes = quote?.close || [];
    const volumes = quote?.volume || [];
    const timestamps = quote?.timestamp || [];

    const structureData = closes.length >= 10
      ? buildStructureIntelligence({
          highs,
          lows,
          closes,
          volumes,
          timestamps,
          existingSupport: marketData?.support20 || null,
          existingResistance: marketData?.resistance20 || null,
          symbol,
          timeframe: 'daily',
        })
      : defaultStructureIntelligence(symbol);

    let catalystData = null;
    try {
      const secIntelligence = await buildSecIntelligence(symbol);
      catalystData = buildCatalystIntelligenceManager(symbol, secIntelligence, marketData);
    } catch (e) {
      catalystData = defaultCatalystIntelligenceManager(symbol);
    }

    const result = buildSwingHorizon({
      swingData: swingIntelligence,
      structureData: structureData,
      catalystData: catalystData,
      marketRegime: marketRegime || null,
      marketData: marketData || null,
      symbol,
    });

    return result;
  } catch (error) {
    console.error(`Swing Horizon error for ${symbol}:`, error?.message || error);
    return defaultSwingHorizon(symbol);
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
        ranking: { method: 'swing_score', total: 0 },
        limitations: 'Swing Horizon composes intelligence from existing B4, B6, C10, and Structure Intelligence layers. No duplicate upstream requests.',
        disclaimer:
          'Swing Horizon is analytical only — not a buy/sell recommendation. ' +
          '1-3 month opportunity classification based on existing intelligence layers. ' +
          'Missing data remains null — never fabricated.',
        errors: [],
      }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    let marketRegime = null;
    try {
      const indices = await fetchIndices({ timeout: 10000 }).catch(() => []);
      if (indices && indices.length > 0) {
        marketRegime = buildMarketRegime(indices, []);
      }
    } catch (e) {
      marketRegime = null;
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

      if (i + BATCH_SIZE < symbols.length) {
        await sleep(200);
      }
    }

    const { ranked, top, alternatives } = rankSwingHorizonOpportunities(results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      horizon: SWING_HORIZON_LABEL,
      count: ranked.length,
      scanned: symbols.length,
      data: ranked,
      top: top,
      alternatives: alternatives,
      ranking: { method: 'swing_score', total: results.length },
      marketRegime: marketRegime
        ? {
            regime: marketRegime.regime,
            regimeScore: marketRegime.regimeScore,
            confidence: marketRegime.confidence,
          }
        : null,
      limitations:
        'Swing Horizon composes intelligence from existing layers: ' +
        'B4 Swing Intelligence, Structure Intelligence, B6 Catalyst Intelligence, C10 Market Regime. ' +
        'Market data is fetched once per symbol via market-engine.js. ' +
        'SEC intelligence is fetched once per symbol and shared with B6. ' +
        'No duplicate upstream requests. ' +
        'Swing Horizon is evidence-weighted — missing data remains null, never fabricated. ' +
        'The Decision Engine (C7) remains the sole authority for HUNT_NOW/WATCH/IGNORE.',
      disclaimer:
        'Swing Horizon is analytical only — not a buy/sell recommendation. ' +
        '1-3 month opportunity classification based on existing intelligence layers. ' +
        'Missing data remains null — never fabricated.',
      errors: errors.slice(0, 5),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Swing Horizon API Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Swing Horizon analysis',
        timestamp: new Date().toISOString(),
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        ranking: { method: 'swing_score', total: 0 },
        horizon: SWING_HORIZON_LABEL,
        limitations: 'API error — analysis unavailable.',
        disclaimer:
          'Swing Horizon is analytical only — not a buy/sell recommendation. ' +
          'Missing data remains null — never fabricated.',
        errors: [error instanceof Error ? error.message : 'unknown error'],
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }
}
