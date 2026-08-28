import { NextResponse } from 'next/server';
import { buildPennyIntelligence, defaultPennyIntelligence, filterPennyStocks, rankPennyOpportunities } from '@/lib/penny-intelligence-manager';
import { buildSecIntelligence } from '@/lib/sec-filings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const cleanSymbol = (value) => {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
};

async function analyzeSymbol(item) {
  try {
    const sec = await buildSecIntelligence(item.symbol, fetch, 5000).catch(() => null);
    return buildPennyIntelligence(item, {
      secIntelligence: sec || undefined,
    });
  } catch (error) {
    console.error(`Penny Intelligence Manager error for ${item.symbol}:`, error.message);
    return buildPennyIntelligence(null, { symbol: cleanSymbol(item?.symbol) });
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

    const origin = new URL(request.url).origin;

    const response = await fetch(`${origin}/api/stocks`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.status !== 'success') {
      throw new Error(payload?.error || 'Failed to read stock universe');
    }

    const source = Array.isArray(payload?.data) ? payload.data : [];

    const pennyStocks = filterPennyStocks(source);

    if (pennyStocks.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        scanned: source.length,
        data: [],
        top: [],
        alternatives: [],
        universe: 'Yahoo Finance US equities via /api/stocks',
        filters: {
          priceRange: '$0.10 - $5.00',
          minAverageVolume20: 100000,
          minRelativeVolume: 1.0,
          technicalReady: true,
        },
        dataAvailability: {
          price: true,
          volume: true,
          technicals: true,
          sec: true,
          setup: true,
          marketLiquidity: true,
        },
        limitations: 'B1 Penny Intelligence Manager composes A1-A8 outputs. SEC data may be delayed or unavailable for some symbols. No guarantee of future performance.',
        disclaimer: 'Penny Intelligence Manager is analytical only. Not a buy/sell recommendation.',
      });
    }

    const results = [];
    for (let i = 0; i < pennyStocks.length; i += 8) {
      const batch = await Promise.all(
        pennyStocks.slice(i, i + 8).map(item => analyzeSymbol(item))
      );
      results.push(...batch);
    }

    const { ranked, top, alternatives } = rankPennyOpportunities(results);

    return NextResponse.json({
      success: true,
      count: ranked.length,
      scanned: pennyStocks.length,
      universeSize: source.length,
      data: ranked,
      top,
      alternatives,
      universe: 'Yahoo Finance US equities via /api/stocks',
      filters: {
        priceRange: '$0.10 - $5.00',
        minAverageVolume20: 100000,
        minRelativeVolume: 1.0,
        technicalReady: true,
      },
      dataAvailability: {
        price: true,
        volume: true,
        technicals: true,
        sec: true,
        setup: true,
        marketLiquidity: true,
      },
      limitations: 'B1 Penny Intelligence Manager composes A1-A8 outputs. SEC data may be delayed or unavailable for some symbols. No guarantee of future performance.',
      disclaimer: 'Penny Intelligence Manager is analytical only. Not a buy/sell recommendation.',
    });
  } catch (error) {
    console.error('Penny Intelligence Manager API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Penny Intelligence Manager',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}
