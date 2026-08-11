import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const INDEXES = [
  { symbol: '^IXIC', name: 'NASDAQ' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'QQQ' },
  { symbol: '^VIX', name: 'VIX' },
];

async function fetchIndex({ symbol, name }) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    '?interval=1d&range=5d&events=div%2Csplits';

  const response = await fetch(url, {
    headers: YAHOO_HEADERS,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${symbol} ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  const closes = Array.isArray(quote?.close)
    ? quote.close.map(Number).filter(Number.isFinite)
    : [];

  const price = Number(meta?.regularMarketPrice) || closes.at(-1);
  const previousClose =
    Number(meta?.previousClose) ||
    Number(meta?.chartPreviousClose) ||
    closes.at(-2);

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
  };
}

export async function GET() {
  const settled = await Promise.allSettled(INDEXES.map(fetchIndex));
  const data = settled
    .filter((item) => item.status === 'fulfilled')
    .map((item) => item.value);

  return NextResponse.json(
    {
      status: data.length ? 'success' : 'error',
      timestamp: new Date().toISOString(),
      data,
      source: 'Yahoo Finance Chart',
      incomplete: data.length !== INDEXES.length,
    },
    {
      status: data.length ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
