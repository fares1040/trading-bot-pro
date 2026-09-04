import { NextResponse } from 'next/server';
import {
  calculateHunterScore,
  classifyMarketRegime,
  deriveConviction,
  evaluateHICCandidate,
  getInstitutionalIntelligenceStatus,
  attachOptionsIntelligence,
  attachOptionsSignal,
} from '@/lib/hunter-intelligence';
import {
  calculateInstitutionalScore,
  fetchInstitutionalData,
} from '@/lib/institutional-provider';
import {
  fetchOptionsChain,
  getOptionsProviderStatus,
} from '@/lib/options-provider';

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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));

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

    const opportunities = (
      await Promise.all(
        radar
          .filter((item) => item?.technicalReady && item?.setupScore != null)
          .map(async (item) => {
            const hic = evaluateHICCandidate(item, regime);
            const conviction = deriveConviction(item, regime);

            // Institutional data is only fetched when a verified provider is
            // connected. When no provider is available (current state), no
            // request is made and no institutional score is generated —
            // Hunter scoring behavior remains exactly as before.
            let institutionalData = null;
            if (institutional.available) {
              institutionalData = await fetchInstitutionalData(item.symbol);
            }
            const institutionalScoreData = institutionalData
              ? calculateInstitutionalScore(institutionalData)
              : null;

            const hunter = calculateHunterScore({
              setupScore: item.setupScore,
              convictionScore: conviction.score,
              regimeScore: regime.score,
              hicEligible: hic.eligible,
              institutionalAvailable: Boolean(institutionalScoreData),
              institutionalScore: institutionalScoreData?.score ?? null,
            });

            return {
              ...item,
              hic,
              conviction,
              hunterScore: hunter.score,
              hunterTier: hunter.tier,
              hunterEligible: hunter.eligible,
              institutionalIntelligence: institutional,
              institutionalData: institutionalData,
            };
          })
      )
    )
      .filter((item) => item.hunterEligible)
      .sort((a, b) => Number(b.hunterScore || 0) - Number(a.hunterScore || 0))
      .slice(0, limit);

    // -----------------------------------------------------------------------
    // OPTIONS INTELLIGENCE LAYER (NON-SCORING)
    //
    // This layer is purely informational. It NEVER changes hunterScore, HIC,
    // Technical Score, Risk Engine, Market Regime, or Institutional Score.
    //
    // We only request options for the already-qualifying/liquid top
    // opportunities (HIC-eligible, bounded to the top 12). The shared options
    // provider reuses its in-memory cache, so the same symbol is never fetched
    // twice within a single request. Missing/unavailable options data simply
    // remains "unavailable" — it is never treated as negative and never
    // fabricated. A Yahoo timeout/error/malformed response is captured as an
    // explicit state and never breaks Hunter.
    // -----------------------------------------------------------------------
    const optionsProvider = getOptionsProviderStatus();

    // Only request options for symbols liquid enough to have a real options
    // market. This bounds the Yahoo request universe to qualifying names.
    const OPTIONS_MIN_AVG_VOLUME = 250000;

    const opportunitiesWithOptions = await Promise.all(
      opportunities.map(async (opp) => {
        const symbol = String(opp.symbol || '').trim().toUpperCase();
        const avgVolume = Number(opp.averageVolume20);
        const isLiquid = Number.isFinite(avgVolume) && avgVolume >= OPTIONS_MIN_AVG_VOLUME;

        // Skip the Yahoo request entirely for non-liquid / invalid symbols.
        if (!symbol || !isLiquid) {
          return attachOptionsIntelligence(opp, null);
        }

        let optionsResult = null;
        try {
          optionsResult = await fetchOptionsChain(symbol);
        } catch (err) {
          // Defensive: never let an options failure break Hunter scoring.
          optionsResult = null;
        }
        // optionsIntelligence = informational layer (STEP 3)
        // optionsSignal = independent analytical signal (STEP 4)
        // Neither feeds Hunter Score / HIC / Technical / Risk / Regime / Inst.
        const withIntel = attachOptionsIntelligence(opp, optionsResult);
        return attachOptionsSignal(withIntel, optionsResult);
      })
    );

    const optionsAvailableCount = opportunitiesWithOptions.filter(
      (o) => o.optionsIntelligence?.available
    ).length;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      regime,
      indices,
      opportunities: opportunitiesWithOptions,
      radarCount: radar.length,
      hicCount: opportunitiesWithOptions.length,
      source: 'Hunter Intelligence / HIC / existing V4 radar',
      phases: {
        productionValidation: 'integrated',
        hicCandidateGate: 'active',
        marketDataThroughput: 'active',
        discovery: 'active',
        institutionalIntelligence: institutional.available ? 'active' : 'provider-not-connected',
        optionsIntelligence: 'active-non-scoring',
        hunterScore: 'active',
        alerts: 'integrated',
        uiPremiumAdmin: 'feature-gated',
      },
      dataAvailability: {
        technical: opportunitiesWithOptions.length > 0,
        options: optionsAvailableCount > 0,
        optionsProvider: optionsProvider.provider,
        darkPool: false,
        institutionalFlow: institutional.available,
      },
      pagination: {
        page: 1,
        limit,
        totalResults: opportunitiesWithOptions.length,
        hasNext: false,
        hasPrevious: false,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Hunter intelligence error:', error?.message || error);
    return NextResponse.json({ success: false, error: 'تعذر بناء قراءة Hunter حالياً.' }, { status: 503 });
  }
}
