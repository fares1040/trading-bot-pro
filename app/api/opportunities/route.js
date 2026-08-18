import { NextResponse } from 'next/server';
import { ALERT_THRESHOLDS } from '@/lib/alert-thresholds';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function read(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });

  const json = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    json,
  };
}

export async function GET(request) {
  try {
    const origin = new URL(request.url).origin;

    const [hunter, pennyRadar, optionsRadar] =
      await Promise.allSettled([
        read(`${origin}/api/hunter`),
        read(`${origin}/api/penny-radar`),
        read(`${origin}/api/options-radar`),
      ]);

    const h =
      hunter.status === 'fulfilled'
        ? hunter.value.json
        : {};

    const p =
      pennyRadar.status === 'fulfilled'
        ? pennyRadar.value.json
        : {};

    const o =
      optionsRadar.status === 'fulfilled'
        ? optionsRadar.value.json
        : {};

    const technical = (
      Array.isArray(h.opportunities)
        ? h.opportunities
        : []
    )
      .slice(0, 10)
      .map((x) => ({
        kind: 'TECHNICAL',
        symbol: x.symbol,

        score: Number(
          x.hunterScore ??
            x.conviction?.score ??
            x.setupScore ??
            0
        ),

        // Pass through Hunter eligibility WITHOUT recalculating Hunter Score.
        // This is the gate used by the alerts pipeline (Phase 7 / Step 1).
        hunterEligible:
          x.hunterEligible === true,
        hunterScore: Number(x.hunterScore ?? 0),

        setupScore: x.setupScore,
        price: x.price,
        rvol: x.relativeVolume,
        rsi: x.rsi,
        signal: x.signal,

        action:
          x.conviction?.action || null,

        reasons:
          Array.isArray(
            x.conviction?.reasons
          )
            ? x.conviction.reasons
            : [],

        riskLabel: 'TECHNICAL',
      }));

    const penny = (
      Array.isArray(p.data)
        ? p.data
        : []
    )
      .slice(0, 10)
      .map((x) => ({
        kind: 'PENNY',
        symbol: x.symbol,

        score: Number(
          x.hunterScore ??
            x.opportunityScore ??
            x.setupScore ??
            0
        ),

        setupScore: x.setupScore,
        price: x.price,
        rvol: x.relativeVolume,
        rsi: x.rsi,

        action:
          x.thesis || null,

        reasons:
          x.thesis
            ? [x.thesis]
            : [],

        riskLabel:
          x.riskLabel || 'HIGH VOLATILITY',
      }));

    const optionsData = (
      Array.isArray(o.data)
        ? o.data
        : []
    )
      .slice(0, 15)
      .map((x) => ({
        kind: 'OPTIONS_CENTS',
        symbol: x.symbol,
        contract: x.contract,
        side: x.side,

        score: Number(
          x.score ?? 0
        ),

        premium: x.premium,
        contractCost: x.contractCost,
        strike: x.strike,
        expiry: x.expiry,
        volume: x.volume,
        openInterest: x.openInterest,
        spreadPct: x.spreadPct,

        action:
          'مراقبة مضاربية فقط',

        reasons: [
          `Premium $${x.premium}`,
          `Volume ${x.volume}`,
          `OI ${x.openInterest}`,
        ],

        riskLabel:
          x.riskLabel || 'HIGH RISK',
      }));

    const all = [
      ...technical,
      ...penny,
      ...optionsData,
    ].sort(
      (a, b) =>
        Number(b.score || 0) -
        Number(a.score || 0)
    );

    return NextResponse.json(
      {
        success: true,

        timestamp:
          new Date().toISOString(),

        market:
          h.regime || null,

        technical,

        penny,

        options: optionsData,

        top: all.slice(0, 20),

        alerts: {
          hunterMinScore: ALERT_THRESHOLDS.hunterMinScore,
          technicalMinScore: ALERT_THRESHOLDS.technicalMinScore,
          pennyMinScore: ALERT_THRESHOLDS.pennyMinScore,
          optionsMinScore: ALERT_THRESHOLDS.optionsMinScore,

          note:
            'هذه عتبات تنبيه وليست توقعًا لمضاعفة أو ضمان ربح.',
        },

        dataAvailability: {
          technical:
            technical.length > 0,

          penny:
            penny.length > 0,

          options:
            o.dataAvailability?.options ===
            true,

          darkPool: false,

          institutionalFlow: false,
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error(
      'Opportunities aggregation error:',
      error?.message || error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر تجميع رادارات Hunter.',
      },
      {
        status: 503,
      }
    );
  }
}
