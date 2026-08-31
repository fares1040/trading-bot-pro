import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import {
  buildEarlyExplosionIntelligenceManager,
  defaultEarlyExplosionIntelligenceManager,
  rankEarlyExplosionOpportunitiesB5,
} from '@/lib/early-explosion-intelligence-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
}

async function analyzeSymbol(symbol) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);
    return buildEarlyExplosionIntelligenceManager(marketData);
  } catch (error) {
    console.error(`Early Explosion error for ${symbol}:`, error?.message || error);
    return defaultEarlyExplosionIntelligenceManager(symbol);
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
      return NextResponse.json({ success: false, error: 'No valid universe found' }, { status: 503 });
    }

    const results = [];
    const errors = [];
    for (let i = 0; i < symbols.length; i += 6) {
      const batch = await Promise.allSettled(
        symbols.slice(i, i + 6).map((symbol) => analyzeSymbol(symbol))
      );
      for (const item of batch) {
        if (item.status === 'fulfilled') {
          results.push(item.value);
        } else {
          errors.push(item.reason?.message || 'unknown error');
        }
      }
    }

    const { ranked, top, alternatives } = rankEarlyExplosionOpportunitiesB5(results);

    const qualityResults = ranked.filter((r) => r.quality !== 'UNAVAILABLE' && r.quality !== 'LOW');

    const qualityBreakdown = qualityResults.reduce((acc, r) => {
      const q = r.quality || 'UNAVAILABLE';
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        count: qualityResults.length,
        scanned: symbols.length,
        data: qualityResults,
        top: top.filter((r) => r.quality !== 'UNAVAILABLE' && r.quality !== 'LOW'),
        alternatives: alternatives.filter((r) => r.quality !== 'UNAVAILABLE' && r.quality !== 'LOW'),
        ranking: {
          ranked: ranked.length,
          top: top.length,
          alternatives: alternatives.length,
        },
        universe: 'Yahoo Finance US trending equities',
        filters: {
          quality: 'EXTREME / HIGH / WATCH',
          minDataCompleteness: 50,
        },
        dataAvailability: {
          price: true,
          volume: true,
          relativeVolume: true,
          rsi: true,
          bollinger: true,
          atr: 'calculated when highs/lows/closes available',
          highsLowsCloses: 'requires 30+ days',
          volumes: 'requires 10+ days',
          supportResistance: true,
          dollarVolume: true,
        },
        qualityBreakdown,
        limitations:
          'Early Explosion Intelligence Manager (B5) uses Yahoo Finance data via market-engine.js (A5). ' +
          'No options chain, dark pool, or institutional flow data available from Yahoo. ' +
          'ATR requires OHLCV arrays. RVOL requires 10+ days historical volume.',
        disclaimer:
          'B5 Early Explosion Intelligence Manager composes A5 core engine. ' +
          'Analytical only — not a buy/sell recommendation. ' +
          'Missing data preserved as null — never fabricated.',
        errors: errors.slice(0, 5),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Early Explosion API Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Early Explosion Radar',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}
