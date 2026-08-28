import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import {
  normalizeSwingIntelligence as buildSwingIntelligenceManager,
  defaultSwingIntelligenceManager,
  rankSwingOpportunitiesB4,
} from '@/lib/swing-intelligence-manager.js';

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
    return buildSwingIntelligenceManager(marketData);
  } catch (error) {
    console.error(`Swing Intelligence error for ${symbol}:`, error?.message || error);
    return defaultSwingIntelligenceManager(symbol);
  }
}

export async function GET(request) {
  try {
    // Optional cron security
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

    // Analyze symbols in batches
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

    // Use B4 ranking (delegates to A4 rankSwingOpportunities)
    const { ranked, top, alternatives } = rankSwingOpportunitiesB4(results);

    // Filter for quality
    const qualityResults = ranked.filter(r => r.quality !== 'UNAVAILABLE' && r.quality !== 'WEAK');

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        count: qualityResults.length,
        scanned: symbols.length,
        data: qualityResults,
        top: top.filter(r => r.quality !== 'UNAVAILABLE' && r.quality !== 'WEAK'),
        alternatives: alternatives.filter(r => r.quality !== 'UNAVAILABLE' && r.quality !== 'WEAK'),
        universe: 'Yahoo Finance US trending equities',
        filters: {
          quality: 'TOP / STRONG / WATCH',
          minDataCompleteness: 50,
        },
        dataAvailability: {
          price: true,
          volume: true,
          technicals: true,
          rsi: true,
          sma20: true,
          sma50: true,
          sma200: 'calculated when 200 closes available',
          bollinger: true,
          atr: 'calculated when highs/lows/closes available',
          vwap: 'calculated when OHLCV available',
          supportResistance: true,
          riskReward: true,
        },
        limitations:
          'Swing Intelligence Manager (B4) uses Yahoo Finance data via market-engine.js (A4). ' +
          'No options chain, dark pool, or institutional flow data available from Yahoo. ' +
          'SMA200 requires 200 historical closes. ATR/VWAP require OHLCV arrays.',
        disclaimer:
          'B4 Swing Intelligence Manager composes A4 core engine. ' +
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
    console.error('Swing Intelligence API Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Swing Intelligence',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}