import { NextResponse } from 'next/server';
import { fetchOptionsChain } from '@/lib/options-provider.js';
import { buildOptionsIntelligenceResult, defaultOptionsIntelligence, rankOptionsOpportunities } from '@/lib/options-intelligence-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
}

async function analyzeSymbol(symbol) {
  try {
    const chain = await fetchOptionsChain(symbol);
    if (!chain.available || !Array.isArray(chain.contracts) || chain.contracts.length === 0) {
      return defaultOptionsIntelligence(symbol);
    }
    return buildOptionsIntelligenceResult(symbol, chain.contracts, {
      providerStatus: {
        provider: chain.provider,
        source: chain.source,
        available: chain.available,
      },
      timestamp: chain.dataTimestamp,
    });
  } catch (error) {
    console.error(`Options Intelligence Manager error for ${symbol}:`, error?.message || error);
    return defaultOptionsIntelligence(symbol);
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
      const origin = new URL(request.url).origin;
      const radarResponse = await fetch(`${origin}/api/stocks`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const radarJson = await radarResponse.json().catch(() => ({}));

      symbols = (
        Array.isArray(radarJson?.data)
          ? radarJson.data
          : Array.isArray(radarJson?.stocks)
          ? radarJson.stocks
          : []
      )
        .filter((x) => Number(x.price) > 0)
        .sort((a, b) => Number(b.setupScore || 0) - Number(a.setupScore || 0))
        .slice(0, 20)
        .map((x) => cleanSymbol(x.symbol))
        .filter(Boolean);
    }

    if (symbols.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        universe: 'Yahoo Finance US equities via /api/stocks',
        dataAvailability: { options: false },
        disclaimer: 'Get fresh symbol universe from /api/stocks or pass ?symbols=AAPL,TSLA',
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < symbols.length; i += 8) {
      const batch = await Promise.allSettled(
        symbols.slice(i, i + 8).map((symbol) => analyzeSymbol(symbol))
      );
      for (const item of batch) {
        if (item.status === 'fulfilled') {
          results.push(item.value);
        } else {
          errors.push(item.reason?.message || 'unknown error');
        }
      }
    }

    const { ranked, top, alternatives } = rankOptionsOpportunities(results);
    const optionsAvailable = results.some((r) => r.optionsAvailability === true);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        count: ranked.length,
        data: ranked,
        top,
        alternatives,
        scannedSymbols: symbols,
        dataAvailability: {
          options: optionsAvailable,
        },
        universe: 'Yahoo Finance options chain via lib/options-provider.js',
        disclaimer:
          'B2 Options Intelligence Manager composes A2 options intelligence. Not a buy/sell recommendation. Missing data preserved as null — never fabricated.',
        errors: errors.slice(0, 5),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Options Intelligence Manager API Error:', error?.message || error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Options Intelligence Manager',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}
