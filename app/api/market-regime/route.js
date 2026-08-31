import { NextResponse } from 'next/server';
import { buildMarketRegime, defaultMarketRegime } from '@/lib/market-regime-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const INDEXES = [
  { symbol: '^IXIC', name: 'NASDAQ' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'QQQ' },
  { symbol: '^VIX', name: 'VIX' },
];

async function fetchIndex({ symbol, name }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    '?interval=1d&range=5d&events=div%2Csplits';
  const response = await fetch(url, { headers: YAHOO_HEADERS, cache: 'no-store' });
  if (!response.ok) throw new Error(`Yahoo ${symbol} ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  const closes = Array.isArray(quote?.close) ? quote.close.map(Number).filter(Number.isFinite) : [];
  const price = Number(meta?.regularMarketPrice) || closes.at(-1);
  const previousClose = Number(meta?.previousClose) || Number(meta?.chartPreviousClose) || closes.at(-2);
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose <= 0) {
    throw new Error(`Yahoo ${symbol} returned incomplete quote data`);
  }
  const change = ((price - previousClose) / previousClose) * 100;
  return {
    symbol,
    name,
    value: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    isUp: change >= 0,
    timestamp: new Date().toISOString(),
  };
}

async function fetchUniverse(request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/stocks`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) return [];
  const json = await response.json().catch(() => null);
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map((item) => ({
    symbol: item?.symbol || null,
    setupScore: item?.setupScore ?? null,
    relativeVolume: item?.relativeVolume ?? null,
    averageVolume20: item?.averageVolume20 ?? null,
    price: item?.price ?? null,
  }));
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
    const requestedSymbols = (searchParams.get('symbols') || '')
      .split(',')
      .map((s) => String(s || '').trim().toUpperCase())
      .filter((s) => /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(s))
      .slice(0, 25);

    // Fetch indices and universe in parallel; a single provider failure
    // must not crash the entire request.
    const [indexSettled, universeSettled] = await Promise.allSettled([
      Promise.allSettled(INDEXES.map(fetchIndex)),
      fetchUniverse(request),
    ]);

    const indices = indexSettled.status === 'fulfilled'
      ? indexSettled.value.filter((i) => i.status === 'fulfilled').map((i) => i.value)
      : [];

    let universe = [];
    if (universeSettled.status === 'fulfilled' && Array.isArray(universeSettled.value)) {
      universe = universeSettled.value;
    }

    const regime = buildMarketRegime(indices, universe);

    return NextResponse.json({
      success: true,
      timestamp: regime.timestamp,
      regime,
      indices,
      universeSize: universe.length,
      indexCount: indices.length,
      source: 'Yahoo Finance Chart (indices) + /api/stocks (universe)',
      limitations: regime.limitations,
      disclaimer: regime.disclaimer,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Market Regime API Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: 'Failed to compute market regime',
      timestamp: new Date().toISOString(),
      regime: defaultMarketRegime(null),
      indices: [],
      universeSize: 0,
      indexCount: 0,
      limitations: 'API error - analysis unavailable.',
      disclaimer: 'Market Regime (C10) is context only - not a buy/sell signal.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}