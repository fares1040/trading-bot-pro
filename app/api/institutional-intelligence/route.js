import { NextResponse } from 'next/server';
import { buildSecIntelligence } from '@/lib/sec-filings.js';
import {
  getInstitutionalProviderStatus,
  fetchInstitutionalData,
  calculateInstitutionalScore,
} from '@/lib/institutional-provider.js';
import { buildInstitutionalRadarResult, defaultInstitutionalRadar, rankInstitutionalOpportunitiesB3 } from '@/lib/institutional-radar-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
}

async function analyzeSymbol(symbol) {
  try {
    const finraStatus = getInstitutionalProviderStatus();
    const finraAvailable = finraStatus.available === true && finraStatus.verified === true;

    let secData = null;
    try {
      secData = await buildSecIntelligence(symbol, fetch, 5000);
    } catch {
      secData = null;
    }

    let finraData = null;
    let finraScore = null;

    if (finraAvailable) {
      try {
        finraData = await fetchInstitutionalData(symbol);
        if (finraData) {
          finraScore = calculateInstitutionalScore(finraData);
        }
      } catch {
        finraData = null;
        finraScore = null;
      }
    }

    return buildInstitutionalRadarResult(symbol, secData, finraData, finraScore, {
      providerStatus: {
        provider: finraStatus.provider,
        available: finraStatus.available,
        verified: finraStatus.verified,
      },
    });
  } catch (error) {
    console.error(`Institutional Radar Manager error for ${symbol}:`, error?.message || error);
    return defaultInstitutionalRadar(symbol);
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
      const payload = await radarResponse.json().catch(() => ({}));

      symbols = (
        Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.stocks)
          ? payload.stocks
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
        dataAvailability: {
          sec: true,
          finra: false,
        },
        disclaimer:
          'B3 Institutional Radar Manager requires symbol list or /api/stocks fallback. ' +
          'FINRA ATS data is only available when provider is verified.',
      });
    }

    const finraStatus = getInstitutionalProviderStatus();

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

    const { ranked, top, alternatives } = rankInstitutionalOpportunitiesB3(results);
    const institutionalAvailable = results.some((r) => r.institutionalAvailability === true);

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
          sec: true,
          finra: finraStatus.available === true && finraStatus.verified === true,
        },
        universe: 'SEC EDGAR public filings via lib/sec-filings.js',
        provider: finraStatus.provider || 'sec',
        finraVerified: finraStatus.verified === true,
        disclaimer:
          'B3 Institutional Radar Manager composes A3.1-A3.3, A3-Final. ' +
          'Does not indicate directional buy/sell. FINRA ATS data does not indicate trade direction. ' +
          'Not a recommendation. Missing data preserved as null — never fabricated.',
        errors: errors.slice(0, 5),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Institutional Radar Manager API Error:', error?.message || error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Institutional Radar Manager',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}
