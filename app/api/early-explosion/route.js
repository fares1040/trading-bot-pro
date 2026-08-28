import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { buildEarlyExplosionIntelligence, defaultEarlyExplosionIntelligence } from '@/lib/early-explosion-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function analyzeSymbol(symbol) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);
    return buildEarlyExplosionIntelligence(marketData);
  } catch (error) {
    console.error(`Early Explosion error for ${symbol}:`, error.message);
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

     // Sort by explosion score descending
     results.sort((a, b) => (b.explosionScore ?? -1) - (a.explosionScore ?? -1));

     // Filter for quality
     const qualityResults = results.filter(r => r.quality !== 'UNAVAILABLE' && r.quality !== 'LOW');

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
      limitations: 'Early Explosion Radar uses only Yahoo Finance data. No options, dark pool, or institutional flow data.',
      disclaimer: 'Early Explosion Radar is analytical only. Not a buy/sell recommendation.',
    });
  } catch (error) {
    console.error('Early Explosion API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Early Explosion Radar',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}