import { NextResponse } from 'next/server';
import {
  calculateHunterScore,
  classifyMarketRegime,
  deriveConviction,
  evaluateHICCandidate,
  getInstitutionalIntelligenceStatus,
} from '@/lib/hunter-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function readJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, json };
}

export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;
    const [radarResult, indexResult] = await Promise.allSettled([
      readJson(`${origin}/api/stocks`),
      readJson(`${origin}/api/indices`),
    ]);

    const radarJson = radarResult.status === 'fulfilled' ? radarResult.value.json : null;
    const indexJson = indexResult.status === 'fulfilled' ? indexResult.value.json : null;
    const radar = Array.isArray(radarJson?.data) ? radarJson.data : [];
    const indices = Array.isArray(indexJson?.data) ? indexJson.data : [];
    const regime = classifyMarketRegime(indices);
    const institutional = getInstitutionalIntelligenceStatus();

    const opportunities = radar
      .filter((item) => item?.technicalReady && item?.setupScore != null)
      .map((item) => {
        const hic = evaluateHICCandidate(item, regime);
        const conviction = deriveConviction(item, regime);
        const hunter = calculateHunterScore({
          setupScore: item.setupScore,
          convictionScore: conviction.score,
          regimeScore: regime.score,
          hicEligible: hic.eligible,
          institutionalAvailable: institutional.available,
          institutionalScore: institutional.score,
        });
        return {
          ...item,
          hic,
          conviction,
          hunterScore: hunter.score,
          hunterTier: hunter.tier,
          hunterEligible: hunter.eligible,
          institutionalIntelligence: institutional,
        };
      })
      .filter((item) => item.hunterEligible)
      .sort((a, b) => Number(b.hunterScore || 0) - Number(a.hunterScore || 0))
      .slice(0, 12);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      regime,
      indices,
      opportunities,
      radarCount: radar.length,
      hicCount: opportunities.length,
      source: 'Hunter Intelligence / HIC / existing V4 radar',
      phases: {
        productionValidation: 'integrated',
        hicCandidateGate: 'active',
        marketDataThroughput: 'active',
        discovery: 'active',
        institutionalIntelligence: institutional.available ? 'active' : 'provider-not-connected',
        hunterScore: 'active',
        alerts: 'integrated',
        uiPremiumAdmin: 'feature-gated',
      },
      dataAvailability: {
        technical: opportunities.length > 0,
        options: false,
        darkPool: false,
        institutionalFlow: institutional.available,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Hunter intelligence error:', error?.message || error);
    return NextResponse.json({ success: false, error: 'تعذر بناء قراءة Hunter حالياً.' }, { status: 503 });
  }
}
