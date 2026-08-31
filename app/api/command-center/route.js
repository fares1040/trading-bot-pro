import { NextResponse } from 'next/server';
import {
  buildCommandCenter,
  defaultCommandCenter,
} from '@/lib/command-center';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REGIME_LABELS = {
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  RISK_OFF: 'RISK_OFF',
  BEARISH: 'BEARISH',
  UNAVAILABLE: 'UNAVAILABLE',
};

const DEFAULT_LIMIT = 5;

async function fetchAPI(url, request) {
  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}${url}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const json = await response.json().catch(() => null);
    return json?.success ? json : null;
  } catch (e) {
    return null;
  }
}

async function fetchAllSources(request) {
  const [regime, opportunity, tradePlan, aiExplanation] = await Promise.allSettled([
    fetchAPI('/api/market-regime', request),
    fetchAPI('/api/opportunity-ranking', request),
    fetchAPI('/api/trade-plan', request),
    fetchAPI('/api/ai-explanation', request),
  ]);

  return {
    regimeData: regime.status === 'fulfilled' ? regime.value : null,
    opportunityData: opportunity.status === 'fulfilled' ? opportunity.value : null,
    tradePlanData: tradePlan.status === 'fulfilled' ? tradePlan.value : null,
    aiExplanationData: aiExplanation.status === 'fulfilled' ? aiExplanation.value : null,
  };
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
    const limit = Math.min(25, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const includeRawData = searchParams.get('raw') === 'true';

    const sourceData = await fetchAllSources(request);

    const commandCenter = buildCommandCenter(
      sourceData.regimeData,
      sourceData.opportunityData,
      sourceData.tradePlanData,
      sourceData.aiExplanationData
    );

    const response = {
      success: true,
      timestamp: commandCenter.timestamp,
      regime: sourceData.regimeData?.regime || REGIME_LABELS.UNAVAILABLE,
      regimeScore: sourceData.regimeData?.regimeScore || null,
      confidenceLevel: sourceData.regimeData?.confidenceLevel || 'UNKNOWN',
      opportunityCount: sourceData.opportunityData?.count || 0,
      planCount: (sourceData.tradePlanData?.data || []).length,
      intelligenceCoverage: sourceData.opportunityData?.dataAvailability
        ? Object.values(sourceData.opportunityData.dataAvailability).filter(Boolean).length
        : 0,
      sections: commandCenter.sections,
      summary: commandCenter.summary,
      limitations: commandCenter.limitations,
      disclaimer: commandCenter.disclaimer,
      provenance: {
        orchestration: 'D11 Command Center',
        marketRegime: sourceData.regimeData ? 'C10' : null,
        opportunityRanking: sourceData.opportunityData ? 'C7' : null,
        tradePlan: sourceData.tradePlanData ? 'C8' : null,
        aiExplanation: sourceData.aiExplanationData ? 'C9' : null,
        intelligenceSources: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
      },
    };

    if (includeRawData) {
      response.raw = {
        regime: sourceData.regimeData,
        opportunities: sourceData.opportunityData?.data || [],
        tradePlans: sourceData.tradePlanData?.data || [],
        explanations: sourceData.aiExplanationData?.data || [],
      };
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Command Center API Error:', error?.message || error);
    return NextResponse.json({
      success: false,
      error: 'Failed to build Command Center',
      timestamp: new Date().toISOString(),
      regime: REGIME_LABELS.UNAVAILABLE,
      regimeScore: null,
      confidenceLevel: 'UNKNOWN',
      opportunityCount: 0,
      planCount: 0,
      intelligenceCoverage: 0,
      sections: defaultCommandCenter().sections,
      summaries: defaultCommandCenter().summary,
      limitations: 'API error - Command Center unavailable.',
      disclaimer: 'D11 Command Center is an orchestration layer. Missing data is preserved as null - never fabricated.',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}

export async function HEAD(request) {
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: 'D11 Command Center API',
    version: '1.0.0',
    endpoints: [
      { path: '/api/command-center', method: 'GET', description: 'Command Center dashboard data' },
    ],
  });
}