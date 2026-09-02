import { NextResponse } from 'next/server';
import { buildStructureIntelligence, defaultStructureIntelligence } from '@/lib/structure-intelligence-manager.js';
import { fetchChart } from '@/lib/market-engine.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbolParam = searchParams.get('symbol');

  const symbol = cleanSymbol(symbolParam);
  if (!symbol) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid or missing symbol parameter',
        timestamp: new Date().toISOString(),
      },
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const { quote } = await fetchChart(symbol, '6mo');

    if (!quote || !Array.isArray(quote.close) || quote.close.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: defaultStructureIntelligence(symbol),
          timestamp: new Date().toISOString(),
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    const timestamps = quote.timestamp || [];

    const result = buildStructureIntelligence({
      highs,
      lows,
      closes,
      volumes,
      timestamps,
      existingSupport: null,
      existingResistance: null,
      symbol,
      timeframe: 'daily',
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: defaultStructureIntelligence(symbol),
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
