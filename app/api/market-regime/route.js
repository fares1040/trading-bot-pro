import { NextResponse } from 'next/server';
import { buildMarketRegime, defaultMarketRegime } from '@/lib/market-regime-engine';
import { checkDashboardAccess } from '@/lib/access-control';
import { fetchIndices } from '@/lib/market-engine.js';
import { shouldAllowProviderCall, recordProviderFailure, recordProviderSuccess } from '@/lib/circuit-breaker-manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchUniverse(request) {
  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/stocks`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const json = await response.json().catch(() => null);
    const raw = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.stocks)
      ? json.stocks
      : [];
    return raw
      .map((x) => ({
        setupScore: typeof x?.setupScore === 'number' ? x.setupScore : null,
        relativeVolume: typeof x?.relativeVolume === 'number' ? x.relativeVolume : null,
        changePercent: typeof x?.changePercent === 'number' ? x.changePercent : null,
        rsi: typeof x?.rsi === 'number' ? x.rsi : null,
      }))
      .filter((x) => x.setupScore != null || x.relativeVolume != null);
  } catch {
    return [];
  }
}

async function fetchIndicesWithCircuitBreaker() {
  const cbStatus = shouldAllowProviderCall('yahoo');
  if (!cbStatus.allowed) {
    const err = new Error(`Yahoo circuit breaker is ${cbStatus.state}`);
    recordProviderFailure('yahoo', err, '/api/market-regime', null, false);
    return [];
  }

  try {
    const indices = await fetchIndices({ timeout: 10000 });
    recordProviderSuccess('yahoo', '/api/market-regime', null);
    return Array.isArray(indices) ? indices : [];
  } catch (err) {
    recordProviderFailure('yahoo', err, '/api/market-regime', null, false);

    if (err?.message?.includes('timeout') || err?.message?.includes('aborted')) {
    } else if (err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit')) {
    } else if (err?.message?.includes('empty') || err?.message?.includes('incomplete')) {
    }

    return [];
  }
}

export async function GET(request) {
  try {
    const { allowed, reason } = checkDashboardAccess(request);
    if (!allowed) {
      return NextResponse.json({ success: false, error: reason || 'Unauthorized' }, { status: 401 });
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
      fetchIndicesWithCircuitBreaker(),
      fetchUniverse(request),
    ]);

    let universe = [];
    if (universeSettled.status === 'fulfilled' && Array.isArray(universeSettled.value)) {
      universe = universeSettled.value;
    }

    const indices = indexSettled.status === 'fulfilled' && Array.isArray(indexSettled.value)
      ? indexSettled.value
      : [];

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