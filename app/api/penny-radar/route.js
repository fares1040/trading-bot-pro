import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_PRICE = 5;
const MIN_PRICE = 0.10;
const MIN_AVG_VOLUME = 100000;
const MIN_RVOL = 1.0;

const n = (value) => {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();

  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol)
    ? symbol
    : null;
}

function scorePenny(item) {
  const setup = Math.max(
    0,
    Math.min(100, n(item.setupScore) ?? 0)
  );

  const rvol = n(item.relativeVolume);

  const rsi = n(item.rsi);

  const rvolScore =
    rvol == null
      ? 0
      : Math.min(100, rvol * 40);

  const rsiScore =
    rsi == null
      ? 0
      : rsi >= 45 && rsi <= 72
        ? 100
        : rsi >= 35 && rsi <= 78
          ? 70
          : 30;

  return Math.round(
    Math.min(
      100,
      setup * 0.65 +
        rvolScore * 0.20 +
        rsiScore * 0.15
    )
  );
}

function buildReasons(item) {
  const reasons = [];

  if (n(item.setupScore) != null) {
    reasons.push(
      `Technical ${Math.round(
        n(item.setupScore)
      )}/100`
    );
  }

  if (n(item.relativeVolume) != null) {
    reasons.push(
      `RVOL ${Number(
        item.relativeVolume
      ).toFixed(2)}x`
    );
  }

  if (n(item.rsi) != null) {
    reasons.push(
      `RSI ${Number(
        item.rsi
      ).toFixed(1)}`
    );
  }

  if (n(item.averageVolume20) != null) {
    reasons.push(
      `Avg Vol 20 ${Math.round(
        n(item.averageVolume20)
      ).toLocaleString()}`
    );
  }

  return reasons.slice(0, 4);
}

export async function GET(request) {
  try {
    const origin =
      new URL(request.url).origin;

    const response = await fetch(
      `${origin}/api/stocks`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      }
    );

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      payload?.status !== 'success'
    ) {
      throw new Error(
        payload?.error ||
          'تعذر قراءة مصدر الأسهم الرئيسي'
      );
    }

    const source =
      Array.isArray(payload?.data)
        ? payload.data
        : [];

    const data = source
      .filter((item) => {
        const price =
          n(item.price);

        const avgVolume =
          n(item.averageVolume20);

        const rvol =
          n(item.relativeVolume);

        return (
          cleanSymbol(item.symbol) &&
          price != null &&
          price >= MIN_PRICE &&
          price <= MAX_PRICE &&
          avgVolume != null &&
          avgVolume >= MIN_AVG_VOLUME &&
          rvol != null &&
          rvol >= MIN_RVOL &&
          item.technicalReady === true
        );
      })
      .map((item) => {
        const score =
          scorePenny(item);

        const reasons =
          buildReasons(item);

        return {
          kind: 'PENNY',

          symbol:
            cleanSymbol(item.symbol),

          quoteType:
            item.quoteType ?? null,

          exchange:
            item.exchange ?? null,

          price:
            n(item.price),

          previousClose:
            n(item.previousClose),

          change:
            n(item.change),

          changePercent:
            n(item.changePercent),

          volume:
            n(item.volume) ?? 0,

          averageVolume20:
            n(item.averageVolume20),

          relativeVolume:
            n(item.relativeVolume),

          rsi:
            n(item.rsi),

          sma20:
            n(item.sma20),

          sma50:
            n(item.sma50),

          setupScore:
            n(item.setupScore),

          technicalScore:
            n(item.technicalScore),

          breakoutScore:
            n(item.breakoutScore),

          trendScore:
            n(item.trendScore),

          momentumScore:
            n(item.momentumScore),

          opportunityScore:
            score,

          action:
            score >= 85
              ? 'مراقبة تأكيد الاختراق والحجم'
              : score >= 75
                ? 'مراقبة'
                : 'انتظار',

          thesis:
            score >= 85
              ? 'إشارة فنية قوية ضمن رادار الأسهم منخفضة السعر'
              : 'مرشح منخفض السعر يحتاج تأكيدًا إضافيًا',

          reasons,

          riskLabel:
            'HIGH RISK / SPECULATIVE',

          dataAvailability: {
            price: true,
            volume: true,
            technicals: true,
            options: false,
            darkPool: false,
            institutionalFlow: false,
          },

          source:
            payload?.source ||
            'Hunter Stocks API',
        };
      })
      .sort(
        (a, b) =>
          Number(
            b.opportunityScore || 0
          ) -
          Number(
            a.opportunityScore || 0
          )
      )
      .slice(0, 30);

    return NextResponse.json(
      {
        success: true,

        timestamp:
          new Date().toISOString(),

        count:
          data.length,

        data,

        criteria: {
          price:
            `$${MIN_PRICE} - $${MAX_PRICE}`,

          minimumAverageVolume20:
            MIN_AVG_VOLUME,

          minimumRelativeVolume:
            MIN_RVOL,

          technicalReady:
            true,
        },

        dataAvailability: {
          price: true,
          volume: true,
          technicals: true,
          options: false,
          darkPool: false,
          institutionalFlow: false,
        },

        note:
          'Penny Radar يعتمد فقط على بيانات الأسهم الفنية الحقيقية من /api/stocks. لا يتم اختلاق تدفقات أو Options أو Dark Pool.',

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
      'Penny Radar error:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'تعذر قراءة رادار الأسهم منخفضة السعر حالياً.',

        data: [],

        dataAvailability: {
          price: false,
          volume: false,
          technicals: false,
          options: false,
          darkPool: false,
          institutionalFlow: false,
        },
      },
      {
        status: 503,
      }
    );
  }
}
