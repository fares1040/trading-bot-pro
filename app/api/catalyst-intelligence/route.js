import { NextResponse } from 'next/server';
import { fetchChart, fetchTrending, analyzeQuote } from '@/lib/market-engine';
import { buildSecIntelligence } from '@/lib/sec-filings';
import {
  buildCatalystIntelligenceManager,
  defaultCatalystIntelligenceManager,
  rankCatalystOpportunitiesB6,
  buildQualityBreakdown,
  buildDataAvailability,
} from '@/lib/catalyst-intelligence-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol) ? symbol : null;
}

async function analyzeSymbol(symbol) {
  try {
    const [chartResult, secData] = await Promise.all([
      (async () => {
        try {
          const { meta, quote } = await fetchChart(symbol, '6mo');
          const marketData = analyzeQuote(meta || {}, quote || []);
          return { meta, quote, marketData };
        } catch (e) {
          return { meta: null, quote: null, marketData: null };
        }
      })(),
      (async () => {
        try {
          return await buildSecIntelligence(symbol);
        } catch (e) {
          return {
            symbol,
            secDataStatus: 'unavailable',
            secRiskScore: null,
            secRiskLevel: 'unavailable',
            dilutionRisk: 'unavailable',
            offeringRisk: 'unavailable',
            warrantRisk: 'unavailable',
            convertibleRisk: 'unavailable',
            reverseSplitRisk: 'unavailable',
            secRiskFlags: [],
            secRiskReasons: [e?.message || 'SEC data unavailable'],
            latestRelevantFilings: [],
            filings: [],
            cik: null,
          };
        }
      })(),
    ]);

    const marketData = chartResult?.marketData || null;
    const secIntelligenceInput = secData || null;

    if (!marketData && (!secIntelligenceInput || secIntelligenceInput.secDataStatus === 'unavailable')) {
      return defaultCatalystIntelligenceManager(symbol);
    }

    return buildCatalystIntelligenceManager(symbol, secIntelligenceInput, marketData);
  } catch (error) {
    console.error(`Catalyst Intelligence error for ${symbol}:`, error?.message || error);
    return defaultCatalystIntelligenceManager(symbol);
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
      symbols = await fetchTrending(30);
    }

    if (!symbols.length) {
      return NextResponse.json({
        success: false,
        error: 'No valid universe found',
        timestamp: new Date().toISOString(),
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        ranking: { method: 'catalyst_score', total: 0 },
        filters: { quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'] },
        dataAvailability: buildDataAvailability([]),
        qualityBreakdown: buildQualityBreakdown([]),
        limitations: 'No valid symbols found for scanning.',
        disclaimer: 'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر.',
        errors: [],
      }, { status: 503 });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < symbols.length; i += 5) {
      const batch = await Promise.allSettled(
        symbols.slice(i, i + 5).map((symbol) => analyzeSymbol(symbol))
      );
      for (const item of batch) {
        if (item.status === 'fulfilled') {
          results.push(item.value);
        } else {
          errors.push(item.reason?.message || 'unknown error');
        }
      }
    }

    const { data: ranked, top, alternatives, ranking } = rankCatalystOpportunitiesB6(results);

    const qualityResults = ranked.filter(
      (r) => r.quality !== 'UNAVAILABLE'
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: qualityResults.length,
      scanned: symbols.length,
      data: ranked,
      top: top,
      alternatives: alternatives,
      ranking,
      filters: {
        quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'],
        catalystType: [
          'EARNINGS',
          'SEC_MATERIAL_EVENT',
          'SEC_OFFERING',
          'SEC_DILUTION',
          'SEC_FINANCING',
          'FDA_REGULATORY',
          'CONTRACT_DEAL',
          'PARTNERSHIP',
          'PRODUCT_LAUNCH',
          'ANALYST_ACTION',
          'INSIDER_ACTIVITY',
          'CORPORATE_EVENT',
          'MACRO_SECTOR_EVENT',
          'NO_VERIFIED_CATALYST',
        ],
        reliability: ['VERIFIED', 'HIGH', 'MODERATE', 'LOW', 'UNAVAILABLE'],
        significance: ['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'UNKNOWN'],
      },
      dataAvailability: buildDataAvailability(results),
      qualityBreakdown: buildQualityBreakdown(results),
      limitations:
        'B6 Catalyst Intelligence Manager composes SEC EDGAR (A6) + market-engine.js. ' +
        'SEC data is limited to public filings. Form 4 transaction direction (buy/sell) ' +
        'requires document-level parsing — not available via submissions JSON. ' +
        'Filing content is not parsed — only metadata is analyzed. ' +
        'Yahoo Finance earnings dates and market data are used where available. ' +
        'No fabricated catalyst data. Missing evidence remains null.',
      disclaimer:
        'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
        'Catalyst Intelligence (B6) is analytical only — not a buy/sell recommendation. ' +
        'Missing data is explicitly nulled — never fabricated. ' +
        'Data from SEC EDGAR and Yahoo Finance.',
      errors: errors.slice(0, 5),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Catalyst Intelligence API Error:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run Catalyst Intelligence',
        timestamp: new Date().toISOString(),
        scanned: 0,
        data: [],
        top: [],
        alternatives: [],
        ranking: { method: 'catalyst_score', total: 0 },
        filters: { quality: ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'] },
        dataAvailability: buildDataAvailability([]),
        qualityBreakdown: buildQualityBreakdown([]),
        limitations: 'API error — analysis unavailable.',
        disclaimer: 'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر.',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 503 }
    );
  }
}
