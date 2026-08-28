import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { buildSetupIntelligence, defaultSetupIntelligence, rankSetupOpportunities } from '@/lib/setup-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function analyzeSymbol(symbol) {
  try {
    const { meta, quote } = await fetchChart(symbol, '6mo');
    const marketData = analyzeQuote(meta, quote);
    return buildSetupIntelligence(marketData, symbol);
  } catch (error) {
    console.error(`Setup Intelligence error for ${symbol}:`, error.message);
    return buildSetupIntelligence(null, symbol);
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

    const { ranked, top, alternatives } = rankSetupOpportunities(results);

    return NextResponse.json({
      success: true,
      count: ranked.length,
      scanned: symbols.length,
      data: ranked,
      top,
      alternatives,
      universe: 'Yahoo Finance US trending equities',
      filters: {
        quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
        setupType: ['BREAKOUT', 'PULLBACK', 'REVERSAL', 'SQUEEZE', 'CONTINUATION', 'BASE', 'MOMENTUM', 'CONSOLIDATION', 'OTHER'],
        signal: ['STRONG_BUY', 'BUY', 'NEUTRAL', 'AVOID', 'UNAVAILABLE'],
      },
      dataAvailability: {
        price: true,
        volume: true,
        rsi: true,
        bollinger: true,
        sma: true,
        riskReward: true,
        supportResistance: true,
        setupScore: true,
      },
      limitations: 'Technical Setup Intelligence uses only Yahoo Finance data. Setup classification is pattern-based and may miss atypical setups. No guarantee of future performance.',
      disclaimer: 'Technical Setup Intelligence is analytical only. Not a buy/sell recommendation.',
    });
  } catch (error) {
    console.error('Setup Intelligence API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Setup Intelligence',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}
