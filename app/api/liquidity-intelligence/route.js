import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { buildLiquidityIntelligence, defaultLiquidityIntelligence, rankLiquidityOpportunities } from '@/lib/liquidity-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function analyzeSymbol(symbol) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);
    return buildLiquidityIntelligence(marketData, symbol);
  } catch (error) {
    console.error(`Liquidity Intelligence error for ${symbol}:`, error.message);
    return buildLiquidityIntelligence(null, symbol);
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

    const symbols = await fetchTrending(30);
    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No valid universe found' }, { status: 503 });
    }

    const results = [];
    for (let i = 0; i < symbols.length; i += 6) {
      const batch = await Promise.all(
        symbols.slice(i, i + 6).map(symbol => analyzeSymbol(symbol).catch(() => null))
      );
      results.push(...batch.filter(Boolean));
    }

    const { ranked, top, alternatives } = rankLiquidityOpportunities(results);

    return NextResponse.json({
      success: true,
      count: ranked.length,
      scanned: symbols.length,
      data: ranked,
      top,
      alternatives,
      universe: 'Yahoo Finance US trending equities',
      filters: {
        quality: ['EXCELLENT', 'GOOD', 'MODERATE', 'POOR', 'CRITICAL', 'UNAVAILABLE'],
        liquidityTier: ['EXCELLENT', 'GOOD', 'MODERATE', 'WEAK', 'CRITICAL'],
        trap: ['HIGH_RVOL_LOW_DOLLAR_VOLUME', 'LOW_DOLLAR_VOLUME', 'THIN_TRADING', 'VOLUME_SPIKE_LOW_LIQUIDITY', 'NONE'],
        risk: ['MINIMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
      },
      dataAvailability: {
        price: true,
        volume: true,
        averageVolume: true,
        relativeVolume: true,
        bollinger: true,
        volumeScore: true,
      },
      limitations: 'Liquidity Intelligence uses Yahoo Finance volume data. Dollar volume is an approximation. Volume spikes do not guarantee tradable liquidity. No guarantee of future performance.',
      disclaimer: 'Liquidity Intelligence is analytical only. Not a buy/sell recommendation.',
    });
  } catch (error) {
    console.error('Liquidity Intelligence API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Liquidity Intelligence',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}
