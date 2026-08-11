import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 HUNTER-AI/4.1',
  Accept: 'application/json',
};

const cleanSymbol = (value) => {
  const symbol = String(value || '').trim().toUpperCase();

  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol)
    ? symbol
    : null;
};

const n = (value) => {
  const x = Number(value);

  return Number.isFinite(x)
    ? x
    : null;
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: YAHOO_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Yahoo options ${response.status}`
    );
  }

  if (!text || !text.trim()) {
    throw new Error(
      'Yahoo options returned an empty response'
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      'Yahoo options returned invalid JSON'
    );
  }
}

async function fetchOptions(symbol) {
  const url =
    `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(
      symbol
    )}`;

  const json = await fetchJson(url);

  const result =
    json?.optionChain?.result?.[0];

  const expiry =
    result?.expirationDates?.[0];

  if (!result || !expiry) {
    return [];
  }

  const chain =
    result?.options?.[0];

  const rows = [
    ...(Array.isArray(chain?.calls)
      ? chain.calls.map((x) => ({
          ...x,
          side: 'CALL',
        }))
      : []),

    ...(Array.isArray(chain?.puts)
      ? chain.puts.map((x) => ({
          ...x,
          side: 'PUT',
        }))
      : []),
  ];

  const underlying =
    n(result?.quote?.regularMarketPrice) ??
    n(result?.quote?.postMarketPrice);

  return rows.map((x) => {
    const bid = n(x.bid);
    const ask = n(x.ask);
    const last = n(x.lastPrice);

    const mid =
      bid != null &&
      ask != null &&
      bid > 0 &&
      ask > 0
        ? (bid + ask) / 2
        : last;

    const volume =
      n(x.volume) ?? 0;

    const openInterest =
      n(x.openInterest) ?? 0;

    const spreadPct =
      bid != null &&
      ask != null &&
      mid != null &&
      mid > 0
        ? ((ask - bid) / mid) * 100
        : null;

    const strike =
      n(x.strike);

    const distancePct =
      underlying &&
      strike
        ? Math.abs(
            (strike - underlying) /
              underlying
          ) * 100
        : null;

    const liquidityScore =
      Math.min(
        100,
        volume * 1.2
      ) * 0.45 +
      Math.min(
        100,
        openInterest / 5
      ) * 0.35 +
      (spreadPct == null
        ? 25
        : Math.max(
            0,
            100 - spreadPct * 3
          )) * 0.20;

    const premiumScore =
      mid != null
        ? Math.max(
            0,
            100 - mid * 100
          )
        : 0;

    const score = Math.round(
      Math.min(
        100,
        liquidityScore * 0.65 +
          premiumScore * 0.35
      )
    );

    return {
      contract:
        x.contractSymbol || null,

      side:
        x.side,

      strike,

      expiry:
        new Date(
          expiry * 1000
        )
          .toISOString()
          .slice(0, 10),

      premium:
        mid != null
          ? Number(
              mid.toFixed(2)
            )
          : null,

      contractCost:
        mid != null
          ? Number(
              (
                mid * 100
              ).toFixed(2)
            )
          : null,

      bid,
      ask,
      last,

      volume,
      openInterest,

      impliedVolatility:
        n(
          x.impliedVolatility
        ),

      spreadPct:
        spreadPct != null
          ? Number(
              spreadPct.toFixed(1)
            )
          : null,

      underlying,

      distancePct:
        distancePct != null
          ? Number(
              distancePct.toFixed(1)
            )
          : null,

      score,

      riskLabel:
        'HIGH RISK / SPECULATIVE',

      source:
        'Yahoo Finance options chain',
    };
  });
}

export async function GET(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const requested = (
      searchParams.get(
        'symbols'
      ) || ''
    )
      .split(',')
      .map(cleanSymbol)
      .filter(Boolean)
      .slice(0, 15);

    let symbols =
      requested;

    if (!symbols.length) {
      const origin =
        new URL(
          request.url
        ).origin;

      const radarResponse =
        await fetch(
          `${origin}/api/stocks`,
          {
            cache:
              'no-store',
          }
        );

      const radarJson =
        await radarResponse
          .json()
          .catch(
            () => ({})
          );

      symbols = (
        Array.isArray(
          radarJson?.data
        )
          ? radarJson.data
          : []
      )
        .filter(
          (x) =>
            Number(
              x.price
            ) > 0 &&
            Number(
              x.price
            ) <= 100
        )
        .sort(
          (a, b) =>
            Number(
              b.setupScore ||
                0
            ) -
            Number(
              a.setupScore ||
                0
            )
        )
        .slice(0, 12)
        .map((x) =>
          cleanSymbol(
            x.symbol
          )
        )
        .filter(Boolean);
    }

    const settled =
      await Promise.allSettled(
        symbols.map(
          async (symbol) => ({
            symbol,

            rows:
              await fetchOptions(
                symbol
              ),
          })
        )
      );

    const all = [];
    const errors = [];

    let successfulSources = 0;

    for (const item of settled) {
      if (
        item.status ===
        'fulfilled'
      ) {
        successfulSources +=
          1;

        all.push(
          ...item.value.rows.map(
            (row) => ({
              ...row,

              symbol:
                item.value
                  .symbol,
            })
          )
        );
      } else {
        errors.push(
          item.reason?.message ||
            'options provider error'
        );
      }
    }

    const cents =
      all
        .filter(
          (x) =>
            x.premium !=
              null &&
            x.premium > 0 &&
            x.premium <= 1
        )
        .filter(
          (x) =>
            (x.volume ||
              0) > 0 ||
            (x.openInterest ||
              0) > 0
        )
        .filter(
          (x) =>
            x.spreadPct ==
              null ||
            x.spreadPct <=
              35
        )
        .sort(
          (a, b) =>
            Number(
              b.score || 0
            ) -
            Number(
              a.score || 0
            )
        )
        .slice(0, 30);

    /*
    |--------------------------------------------------------------------------
    | VERIFIED FIX
    |--------------------------------------------------------------------------
    | Options are available only when at least one source succeeded
    | AND the provider returned actual option rows.
    |--------------------------------------------------------------------------
    */

    const optionsAvailable =
      successfulSources >
        0 &&
      all.length > 0;

    return NextResponse.json(
      {
        success:
          true,

        timestamp:
          new Date().toISOString(),

        count:
          cents.length,

        data:
          cents,

        scannedSymbols:
          symbols,

        dataAvailability: {
          options:
            optionsAvailable,

          darkPool:
            false,

          institutionalFlow:
            false,
        },

        methodology: {
          premiumMax:
            1,

          note:
            'عقود تحت $1 للـpremium فقط. لا تعني إمكانية مضاعفة مؤكدة. تكلفة العقد = premium × 100.',
        },

        errors:
          errors.slice(0, 3),

        source:
          'Yahoo Finance options chain',
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
      'Options radar error:',
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          'تعذر قراءة سلسلة الخيارات الحالية.',

        data: [],

        dataAvailability: {
          options:
            false,

          darkPool:
            false,

          institutionalFlow:
            false,
        },
      },
      {
        status:
          503,
      }
    );
  }
}
