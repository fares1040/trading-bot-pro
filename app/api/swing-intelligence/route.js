import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { buildSwingIntelligence, defaultSwingIntelligence } from '@/lib/swing-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

async function analyzeSymbol(symbol) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);
    return buildSwingIntelligence(marketData);
  } catch (error) {
    console.error(`Swing Intelligence error for ${symbol}:`, error.message);
    return null;
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

    // Get trending symbols
    const symbols = await fetchTrending(30);
    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No valid universe found' }, { status: 503 });
    }

    // Analyze symbols in batches
    const results = [];
    for (let i = 0; i < symbols.length; i += 6) {
      const batch = await Promise.all(
        symbols.slice(i, i + 6).map(symbol => analyzeSymbol(symbol).catch(() => null))
      );
      results.push(...batch.filter(Boolean));
    }

     // Sort by swing score descending
     results.sort((a, b) => (b.swingScore ?? -1) - (a.swingScore ?? -1));

     // Filter for quality
     const qualityResults = results.filter(r => r.quality !== 'UNAVAILABLE' && r.quality !== 'WEAK');

     // Ranking: top opportunities + alternatives
     const top = qualityResults.slice(0, 5);
     const alternatives = qualityResults.slice(5, 10);

     return NextResponse.json({
       success: true,
       count: qualityResults.length,
       scanned: symbols.length,
        data: qualityResults,
        top,
        alternatives,
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
      limitations: 'Swing Intelligence uses only Yahoo Finance data. No options, dark pool, or institutional flow data.',
      disclaimer: 'Swing Intelligence is analytical only. Not a buy/sell recommendation.',
    });
  } catch (error) {
    console.error('Swing Intelligence API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Swing Intelligence',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}