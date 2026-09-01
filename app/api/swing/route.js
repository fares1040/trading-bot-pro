
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

/* =========================================================
   HELPERS
========================================================= */

function average(values) {
  const valid = values.filter(Number.isFinite);

  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);

  if (!Number.isFinite(n)) return min;

  return Math.max(min, Math.min(max, n));
}

function round(value, decimals = 2) {
  return Number.isFinite(value)
    ? Number(value.toFixed(decimals))
    : null;
}

/* =========================================================
   RSI
========================================================= */

function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta =
      closes[i] - closes[i - 1];

    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  let avgGain =
    gains / period;

  let avgLoss =
    losses / period;

  for (
    let i = period + 1;
    i < closes.length;
    i += 1
  ) {
    const delta =
      closes[i] - closes[i - 1];

    const gain =
      delta > 0 ? delta : 0;

    const loss =
      delta < 0
        ? Math.abs(delta)
        : 0;

    avgGain =
      ((avgGain * (period - 1)) + gain) /
      period;

    avgLoss =
      ((avgLoss * (period - 1)) + loss) /
      period;
  }

  if (avgLoss === 0) return 100;

  return (
    100 -
    (100 / (1 + avgGain / avgLoss))
  );
}

/* =========================================================
   BOLLINGER
========================================================= */

function calculateBollinger(
  closes,
  period = 20
) {
  if (closes.length < period) {
    return {
      bandwidth: null,
      squeeze: false,
      score: 0,
    };
  }

  const slice =
    closes.slice(-period);

  const middle =
    average(slice);

  if (!middle || middle <= 0) {
    return {
      bandwidth: null,
      squeeze: false,
      score: 0,
    };
  }

  const variance =
    average(
      slice.map(
        (value) =>
          (value - middle) ** 2
      )
    ) || 0;

  const stdDev =
    Math.sqrt(variance);

  const upper =
    middle + 2 * stdDev;

  const lower =
    middle - 2 * stdDev;

  const bandwidth =
    ((upper - lower) / middle) * 100;

  let score = 20;

  if (bandwidth < 5) {
    score = 100;
  } else if (bandwidth < 7) {
    score = 90;
  } else if (bandwidth < 9) {
    score = 75;
  } else if (bandwidth < 12) {
    score = 50;
  }

  return {
    bandwidth: round(bandwidth),
    squeeze: bandwidth < 9,
    score,
  };
}

/* =========================================================
   CLUSTER
========================================================= */

function calculateCluster(
  price,
  highs,
  lows,
  relativeVolume
) {
  const recentHighs =
    highs.slice(-5);

  const recentLows =
    lows.slice(-5);

  if (
    !price ||
    !recentHighs.length ||
    !recentLows.length
  ) {
    return {
      rangePercent: null,
      isCluster: false,
      score: 0,
    };
  }

  const recentHigh =
    Math.max(...recentHighs);

  const recentLow =
    Math.min(...recentLows);

  const rangePercent =
    ((recentHigh - recentLow) / price) * 100;

  const isCluster =
    rangePercent <= 3.5 &&
    relativeVolume >= 1.1;

  let score = 25;

  if (rangePercent <= 2) {
    score = 100;
  } else if (rangePercent <= 3.5) {
    score = 85;
  } else if (rangePercent <= 5) {
    score = 60;
  }

  if (relativeVolume >= 1.5) {
    score += 10;
  }

  return {
    rangePercent:
      round(rangePercent),

    isCluster,

    score:
      Math.round(clamp(score)),
  };
}

/* =========================================================
   RISK / REWARD
========================================================= */

function calculateRiskReward(
  price,
  support,
  resistance
) {
  if (
    !price ||
    !support ||
    !resistance
  ) {
    return {
      stopLoss: null,
      target1: null,
      target2: null,
      riskPercent: null,
      rewardPercent: null,
      riskReward: null,
      score: 0,
    };
  }

  const stopLoss =
    Math.min(
      price * 0.97,
      support * 0.995
    );

  if (
    stopLoss >= price
  ) {
    return {
      stopLoss: null,
      target1: null,
      target2: null,
      riskPercent: null,
      rewardPercent: null,
      riskReward: null,
      score: 0,
    };
  }

  const risk =
    price - stopLoss;

  const reward =
    resistance - price;

  if (
    risk <= 0 ||
    reward <= 0
  ) {
    return {
      stopLoss:
        round(stopLoss),

      target1: null,
      target2: null,

      riskPercent:
        round(
          (risk / price) * 100
        ),

      rewardPercent: null,
      riskReward: null,
      score: 20,
    };
  }

  const riskReward =
    reward / risk;

  let score = 25;

  if (riskReward >= 3) {
    score = 100;
  } else if (riskReward >= 2.5) {
    score = 90;
  } else if (riskReward >= 2) {
    score = 80;
  } else if (riskReward >= 1.5) {
    score = 65;
  } else if (riskReward >= 1) {
    score = 45;
  }

  const target1 =
    resistance;

  const target2 =
    price + risk * 2.5;

  return {
    stopLoss:
      round(stopLoss),

    target1:
      round(target1),

    target2:
      round(target2),

    riskPercent:
      round(
        (risk / price) * 100
      ),

    rewardPercent:
      round(
        (reward / price) * 100
      ),

    riskReward:
      round(riskReward),

    score,
  };
}

/* =========================================================
   ANALYZE STOCK
========================================================= */

async function analyzeSymbol(symbol) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
      clean
    )
  ) {
    return null;
  }

  const response =
    await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=6mo&events=div%2Csplits`,
      {
        headers: YAHOO_HEADERS,
        cache: 'no-store',
      }
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  const result =
    data?.chart?.result?.[0];

  const quote =
    result?.indicators?.quote?.[0];

  if (
    !result?.meta ||
    !quote
  ) {
    return null;
  }

  const quoteType =
    result.meta?.instrumentType ||
    result.meta?.quoteType;

  if (
    quoteType &&
    quoteType !== 'EQUITY'
  ) {
    return null;
  }

  const closes =
    (quote.close || [])
      .map(Number)
      .filter(Number.isFinite);

  const highs =
    (quote.high || [])
      .map(Number)
      .filter(Number.isFinite);

  const lows =
    (quote.low || [])
      .map(Number)
      .filter(Number.isFinite);

  const volumes =
    (quote.volume || [])
      .map(Number)
      .filter(Number.isFinite);

  if (
    closes.length < 60
  ) {
    return null;
  }

  const price =
    Number(
      result.meta?.regularMarketPrice ||
      closes.at(-1)
    );

  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    price >= 100
  ) {
    return null;
  }

  const previousClose =
    Number(
      result.meta?.previousClose ||
      result.meta?.chartPreviousClose ||
      closes.at(-2)
    );

  const volume =
    Number(
      result.meta?.regularMarketVolume ||
      volumes.at(-1) ||
      0
    );

  if (
    !Number.isFinite(volume) ||
    volume < 100000
  ) {
    return null;
  }

  const avgVolume20 =
    average(
      volumes.slice(-21, -1)
    );

  if (
    !avgVolume20 ||
    avgVolume20 <= 0
  ) {
    return null;
  }

  const relativeVolume =
    volume / avgVolume20;

  const changePercent =
    previousClose
      ? ((price - previousClose) /
          previousClose) *
        100
      : 0;

  const sma20 =
    average(
      closes.slice(-20)
    );

  const sma50 =
    average(
      closes.slice(-50)
    );

  const rsi =
    calculateRSI(closes);

  if (
    !sma20 ||
    !sma50 ||
    rsi == null
  ) {
    return null;
  }

  /* =====================================================
     MOMENTUM
  ===================================================== */

  const base =
    closes.at(-6);

  const momentumPercent =
    base
      ? ((price - base) / base) * 100
      : 0;

  const momentumScore =
    clamp(
      50 +
      momentumPercent * 8
    );

  /* =====================================================
     VOLUME
  ===================================================== */

  const volumeScore =
    clamp(
      45 +
      ((relativeVolume - 1) * 35)
    );

  /* =====================================================
     TREND
  ===================================================== */

  let trendScore = 50;

  if (price > sma20) {
    trendScore += 15;
  }

  if (price > sma50) {
    trendScore += 20;
  }

  if (sma20 > sma50) {
    trendScore += 15;
  }

  const sma50Distance =
    ((price - sma50) /
      sma50) *
    100;

  trendScore +=
    clamp(
      sma50Distance * 2,
      -20,
      20
    );

  trendScore =
    clamp(trendScore);

  /* =====================================================
     RESISTANCE / SUPPORT
  ===================================================== */

  const resistance =
    Math.max(
      ...highs.slice(-21, -1)
    );

  const support =
    Math.min(
      ...lows.slice(-21, -1)
    );

  const resistanceDistance =
    ((resistance - price) /
      price) *
    100;

  let breakoutScore = 25;

  if (
    resistanceDistance <= 0
  ) {
    breakoutScore = 100;
  } else if (
    resistanceDistance <= 1
  ) {
    breakoutScore = 95;
  } else if (
    resistanceDistance <= 2
  ) {
    breakoutScore = 88;
  } else if (
    resistanceDistance <= 4
  ) {
    breakoutScore = 75;
  } else if (
    resistanceDistance <= 6
  ) {
    breakoutScore = 60;
  } else if (
    resistanceDistance <= 10
  ) {
    breakoutScore = 45;
  }

  /* =====================================================
     RSI
  ===================================================== */

  let rsiScore = 65;

  if (
    rsi >= 45 &&
    rsi <= 65
  ) {
    rsiScore = 100;
  } else if (
    rsi > 65 &&
    rsi <= 70
  ) {
    rsiScore = 85;
  } else if (
    rsi >= 35 &&
    rsi < 45
  ) {
    rsiScore = 75;
  } else if (
    rsi > 70
  ) {
    rsiScore = 45;
  } else if (
    rsi < 30
  ) {
    rsiScore = 55;
  }

  /* =====================================================
     BOLLINGER
  ===================================================== */

  const bollinger =
    calculateBollinger(
      closes
    );

  /* =====================================================
     CLUSTER
  ===================================================== */

  const cluster =
    calculateCluster(
      price,
      highs,
      lows,
      relativeVolume
    );

  /* =====================================================
     RISK / REWARD
  ===================================================== */

  const riskReward =
    calculateRiskReward(
      price,
      support,
      resistance
    );

  /* =====================================================
     RESISTANCE PENALTY
  ===================================================== */

  let resistancePenalty = 0;

  if (
    resistanceDistance >= 0 &&
    resistanceDistance < 1
  ) {
    resistancePenalty = 12;
  } else if (
    resistanceDistance >= 0 &&
    resistanceDistance < 2
  ) {
    resistancePenalty = 7;
  }

  /* =====================================================
     TECHNICAL SCORE
  ===================================================== */

  const technicalScore =
    Math.round(
      clamp(
        momentumScore * 0.15 +
        volumeScore * 0.15 +
        trendScore * 0.15 +
        breakoutScore * 0.15 +
        rsiScore * 0.10 +
        bollinger.score * 0.10 +
        cluster.score * 0.10 +
        riskReward.score * 0.10 -
        resistancePenalty
      )
    );

  /* =====================================================
     SWING QUALIFICATION
  ===================================================== */

  const strongVolume =
    relativeVolume >= 1.3;

  const trendConfirmed =
    price > sma20 &&
    price > sma50;

  const squeezeReady =
    bollinger.squeeze;

  const clusterReady =
    cluster.isCluster;

  const breakoutReady =
    resistanceDistance <= 2 &&
    relativeVolume >= 1.25;

  /*
   * Swing signal requires a real setup.
   * A high score alone is not enough.
   */
  const setupDetected =
    (
      squeezeReady &&
      strongVolume
    ) ||
    (
      clusterReady &&
      strongVolume
    ) ||
    (
      breakoutReady &&
      trendConfirmed
    );

  if (!setupDetected) {
    return null;
  }

  /*
   * Avoid weak risk/reward when a target
   * is clearly available.
   */
  if (
    riskReward.riskReward != null &&
    riskReward.riskReward < 1
  ) {
    return null;
  }

  /* =====================================================
     STRATEGY
  ===================================================== */

  let strategy =
    '🎯 سوينغ: تجميع كلاستر';

  let reason =
    'نطاق سعري ضيق مع حجم نسبي داعم.';

  if (
    squeezeReady &&
    breakoutReady
  ) {
    strategy =
      '🔥 سوينغ: Squeeze + ضغط اختراق';

    reason =
      'ضغط Bollinger مع اقتراب السعر من المقاومة ووجود حجم نسبي داعم.';
  } else if (
    squeezeReady &&
    strongVolume
  ) {
    strategy =
      '⚡ سوينغ: Bollinger Squeeze';

    reason =
      'انكماش Bollinger مع ارتفاع الحجم النسبي؛ يحتاج تأكيد اختراق.';
  } else if (
    breakoutReady
  ) {
    strategy =
      '🚀 سوينغ: Breakout Pressure';

    reason =
      'السعر قريب من المقاومة مع حجم نسبي مرتفع واتجاه فني داعم.';
  } else if (
    clusterReady
  ) {
    strategy =
      '🎯 سوينغ: Cluster';

    reason =
      'تجميع سعري ضيق مع حجم نسبي أعلى من المتوسط.';
  }

  /* =====================================================
     SIGNAL STRENGTH
  ===================================================== */

  let signal =
    'WATCH';

  let signalStrength =
    'MEDIUM';

  if (
    technicalScore >= 85 &&
    riskReward.riskReward != null &&
    riskReward.riskReward >= 2
  ) {
    signal =
      'STRONG_BUY';

    signalStrength =
      'HIGH';
  } else if (
    technicalScore >= 75
  ) {
    signal =
      'BUY';

    signalStrength =
      'HIGH';
  } else if (
    technicalScore >= 65
  ) {
    signal =
      'BUY';

    signalStrength =
      'MEDIUM';
  }

  /* =====================================================
     FINAL OBJECT
  ===================================================== */

  return {
    ticker:
      result.meta?.symbol ||
      clean,

    price:
      round(price),

    change_percent:
      round(changePercent),

    strategy,

    signal,

    signal_strength:
      signalStrength,

    target_1:
      riskReward.target1,

    target_2:
      riskReward.target2,

    trailing_stop:
      riskReward.stopLoss,

    stop_loss:
      riskReward.stopLoss,

    risk_percent:
      riskReward.riskPercent,

    reward_percent:
      riskReward.rewardPercent,

    risk_reward:
      riskReward.riskReward,

    confidence:
      technicalScore,

    technical_score:
      technicalScore,

    reason,

    rsi:
      round(rsi),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

    relative_volume:
      round(relativeVolume),

    volume:
      volume,

    average_volume_20:
      Math.round(
        avgVolume20
      ),

    momentum_percent:
      round(momentumPercent),

    momentum_score:
      Math.round(
        momentumScore
      ),

    volume_score:
      Math.round(
        volumeScore
      ),

    trend_score:
      Math.round(
        trendScore
      ),

    breakout_score:
      Math.round(
        breakoutScore
      ),

    resistance:
      round(resistance),

    support:
      round(support),

    resistance_distance:
      round(resistanceDistance),

    squeeze:
      bollinger.squeeze,

    bollinger_bandwidth:
      bollinger.bandwidth,

    squeeze_score:
      bollinger.score,

    cluster:
      cluster.isCluster,

    cluster_range:
      cluster.rangePercent,

    cluster_score:
      cluster.score,

    technical_ready:
      true,

    data_quality:
      'بيانات فنية مكتملة',

    options_data_available:
      false,

    dark_pool_data_available:
      false,

    institutional_flow_available:
      false,

    options_note:
      'بيانات Options Chain غير متاحة من مصدر Yahoo الحالي.',

    dark_pool_note:
      'بيانات Dark Pool غير متاحة من مصدر Yahoo الحالي.',

    sector:
      result.meta?.longName ||
      result.meta?.shortName ||
      'سهم أمريكي',

    created_at:
      new Date().toISOString(),
  };
}

/* =========================================================
   DATABASE
========================================================= */

function getSupabase() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(
    url,
    key
  );
}

/* =========================================================
   MARKET SESSION
========================================================= */

function getMarketSession() {
  const now =
    new Date();

  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'America/New_York',

        weekday:
          'short',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hour12:
          false,
      }
    ).formatToParts(now);

  const data =
    Object.fromEntries(
      parts.map(
        ({ type, value }) =>
          [type, value]
      )
    );

  const weekdays = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ];

  const weekday =
    weekdays.indexOf(
      data.weekday
    );

  const minutes =
    Number(data.hour) * 60 +
    Number(data.minute);

  /*
   * Regular session:
   * 09:30 - 16:00 ET
   *
   * We intentionally don't treat
   * premarket as regular market.
   */
  const active =
    weekday >= 1 &&
    weekday <= 5 &&
    minutes >= 570 &&
    minutes <= 960;

  return {
    active,

    nyTime:
      `${data.hour}:${data.minute}`,
  };
}

/* =========================================================
   TELEGRAM / DISCORD
========================================================= */

async function sendReports(
  detected
) {
  if (!detected.length) {
    return;
  }

  const botToken =
    process.env
      .TELEGRAM_BOT_TOKEN;

  const chatId =
    process.env
      .TELEGRAM_CHAT_ID;

  const discordUrl =
    process.env
      .DISCORD_WEBHOOK_URL;

  const baseUrl =
    process.env
      .NEXT_PUBLIC_BASE_URL;

  const top =
    detected
      .slice(0, 5);

  let report =
    '🔥 *HUNTER AI — رادار السوينغ V4* 🔥\n';

  report +=
    'الأسهم الأمريكية أقل من $100\n';

  report +=
    '----------------------------------\n';

  top.forEach(
    (item) => {
      report +=
        `📌 *${item.ticker}*\n`;

      report +=
        `💰 $${item.price} (${item.change_percent}%)\n`;

      report +=
        `📊 ${item.strategy}\n`;

      report +=
        `🧠 Technical Score: ${item.technical_score}/100\n`;

      report +=
        `📈 RVOL: ${item.relative_volume}x | RSI: ${item.rsi}\n`;

      report +=
        `🎯 هدف 1: ${
          item.target_1
            ? `$${item.target_1}`
            : 'غير مؤكد'
        }\n`;

      report +=
        `🎯 هدف 2: ${
          item.target_2
            ? `$${item.target_2}`
            : 'غير مؤكد'
        }\n`;

      report +=
        `🛑 وقف: ${
          item.stop_loss
            ? `$${item.stop_loss}`
            : 'غير مؤكد'
        }\n`;

      report +=
        `⚖️ R/R: ${
          item.risk_reward ?? 'غير متاح'
        }\n`;

      report +=
        `🧠 ${item.reason}\n`;

      report +=
        '----------------------------------\n';
    }
  );

  if (
    botToken &&
    chatId
  ) {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          chat_id:
            chatId,

          text:
            report,

          parse_mode:
            'Markdown',

          ...(baseUrl
            ? {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text:
                          '📊 فتح الرادار',

                        url:
                          baseUrl,
                      },
                    ],
                  ],
                },
              }
            : {}),
        }),
      }
    ).catch(
      (error) =>
        console.error(
          'Telegram error:',
          error.message
        )
    );
  }

  if (discordUrl) {
    await fetch(
      discordUrl,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          content:
            report.replace(
              /\*/g,
              '**'
            ),
        }),
      }
    ).catch(
      (error) =>
        console.error(
          'Discord error:',
          error.message
        )
    );
  }
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request
) {
  try {
    /* =====================================================
       CRON SECURITY
    ===================================================== */

    const expectedSecret =
      process.env.CRON_SECRET ||
      process.env.VERCEL_CRON_SECRET;

    if (
      expectedSecret
    ) {
      const auth =
        request.headers.get(
          'authorization'
        );

      if (
        auth !==
        `Bearer ${expectedSecret}`
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Unauthorized',
          },
          {
            status: 401,
          }
        );
      }
    }

    /* =====================================================
       MARKET SESSION
    ===================================================== */

    const session =
      getMarketSession();

    if (
      !session.active
    ) {
      return NextResponse.json({
        success: true,

        market_active:
          false,

        ny_time:
          session.nyTime,

        count:
          0,

        data: [],

        message:
          'السوق الأمريكي خارج الجلسة الرئيسية.',
      });
    }

    /* =====================================================
       UNIVERSE
    ===================================================== */

    const trendingResponse =
      await fetch(
        'https://query1.finance.yahoo.com/v1/finance/trending/US?count=30',
        {
          headers:
            YAHOO_HEADERS,

          cache:
            'no-store',
        }
      );

    if (
      !trendingResponse.ok
    ) {
      throw new Error(
        `Yahoo trending ${trendingResponse.status}`
      );
    }

    const trendingData =
      await trendingResponse.json();

    const rawQuotes =
      trendingData
        ?.finance
        ?.result?.[0]
        ?.quotes || [];

    const symbols =
      rawQuotes
        .map(
          (item) =>
            item?.symbol
        )
        .filter(
          (symbol) =>
            /^[A-Z][A-Z0-9.]{0,5}$/
              .test(
                symbol || ''
              )
        )
        .slice(0, 30);

    if (!symbols.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            'لم يتم العثور على Universe صالح.',
        },
        {
          status: 503,
        }
      );
    }

    /* =====================================================
       ANALYSIS
    ===================================================== */

    const detected = [];

    /*
     * Batches protect Yahoo from
     * unnecessary concurrent load.
     */
    for (
      let i = 0;
      i < symbols.length;
      i += 6
    ) {
      const batch =
        await Promise.all(
          symbols
            .slice(i, i + 6)
            .map(
              (symbol) =>
                analyzeSymbol(
                  symbol
                ).catch(
                  () => null
                )
            )
        );

      detected.push(
        ...batch.filter(Boolean)
      );
    }

    detected.sort(
      (a, b) =>
        (b.technical_score ?? -1) -
        (a.technical_score ?? -1)
    );

    /* =====================================================
       DATABASE
    ===================================================== */

    const supabase =
      getSupabase();

    if (
      supabase &&
      detected.length
    ) {
      /*
       * Only save meaningful signals.
       */
      const dbRows =
        detected.map(
          (item) => ({
            ...item,
          })
        );

      const {
        error,
      } =
        await supabase
          .from(
            'swing_signals'
          )
          .insert(
            dbRows
          );

      if (error) {
        console.error(
          'Swing DB error:',
          error.message
        );
      }
    }

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    await sendReports(
      detected
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      market_active:
        true,

      ny_time:
        session.nyTime,

      count:
        detected.length,

      scanned:
        symbols.length,

      data:
        detected,

      universe:
        'Yahoo Finance US trending equities',

      filters: {
        price:
          '< $100',

        minimumVolume:
          '>= 100K',

        setup:
          'Squeeze / Cluster / Breakout',

        riskGate:
          'enabled',
      },

      dataAvailability: {
        price:
          true,

        volume:
          true,

        technicals:
          true,

        options:
          false,

        darkPool:
          false,

        institutionalFlow:
          false,
      },

      limitations:
        'Options Chain وDark Pool وInstitutional Flow غير متاحة من Yahoo Finance.',
    });

  } catch (error) {
    console.error(
      'Swing Radar Error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'تعذر تشغيل رادار السوينغ حالياً',

        details:
          process.env.NODE_ENV ===
          'development'
            ? error.message
            : undefined,
      },
      {
        status: 503,
      }
    );
  }
}