
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

/*
|--------------------------------------------------------------------------
| TRADING BOT PRO V4 — CRON RADAR
|--------------------------------------------------------------------------
| مصدر البيانات:
| Yahoo Finance
|
| متاح:
| Price
| Volume
| RVOL
| RSI
| SMA20
| SMA50
| Momentum
| Bollinger Squeeze
| Cluster
| Breakout
| Risk / Reward
|
| غير متاح:
| Options Chain
| Dark Pool
| Institutional Flow
|
| لا توجد أي بيانات وهمية أو Math.random().
|--------------------------------------------------------------------------
*/

const symbolSectors = {
  NVDA: 'تكنولوجيا وذكاء اصطناعي',
  AMD: 'تكنولوجيا وذكاء اصطناعي',
  PLTR: 'تكنولوجيا وذكاء اصطناعي',
  SOFI: 'تكنولوجيا مالية وزخم',
  INTC: 'أشباه موصلات',
  SNAP: 'تواصل اجتماعي',
  HOOD: 'منصات مالية',
  NIO: 'سيارات كهربائية',
  RIVN: 'سيارات كهربائية',
  LCID: 'سيارات كهربائية',
  BAC: 'بنوك ومالية',
  WFC: 'مالية وبنوك',
  PBR: 'طاقة ونفط',
  OXY: 'طاقة ونفط',
  CLSK: 'تعدين بيتكوين',
  MARA: 'تعدين بيتكوين',
  RIOT: 'عملات رقمية',
  GME: 'أسهم ميم وزخم',
  SNDL: 'نمو وزخم',
  TLRY: 'نمو وطاقة بديلة',
  NVAX: 'تكنولوجيا حيوية',
  FCEL: 'طاقة بديلة',
  PLUG: 'طاقة بديلة',
  SIRI: 'إعلام وترفيه',
  BB: 'تكنولوجيا',
  NOK: 'تكنولوجيا',
  WBD: 'إعلام',
  DIS: 'إعلام وترفيه',
  PARA: 'إعلام',
  ROKU: 'تكنولوجيا',
  SHOP: 'تكنولوجيا',
  COIN: 'عملات رقمية',
  AFRM: 'تكنولوجيا مالية',
  UPST: 'تكنولوجيا مالية',
  RUN: 'طاقة بديلة',
  GM: 'سيارات',
  F: 'سيارات',
  VZ: 'اتصالات',
  T: 'اتصالات',
  KGC: 'تعدين',
  AUY: 'تعدين',
  AG: 'تعدين',
  EXAS: 'تكنولوجيا حيوية',
  NVST: 'تكنولوجيا حيوية',
  HAL: 'طاقة',
  SLB: 'طاقة',
  PFE: 'تكنولوجيا حيوية',
  BNTX: 'تكنولوجيا حيوية',
  ETSY: 'تكنولوجيا',
  W: 'تجزئة',
  CHWY: 'تجزئة',
  BABA: 'تجزئة',
  JD: 'تجزئة',
  PDD: 'تجزئة',
  SQ: 'تكنولوجيا مالية',
};

/* =========================
   SUPABASE
========================= */

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  return url && key
    ? createClient(url, key)
    : null;
}

/* =========================
   HELPERS
========================= */

function average(values) {
  const valid =
    values.filter(Number.isFinite);

  return valid.length
    ? valid.reduce(
        (sum, value) => sum + value,
        0
      ) / valid.length
    : null;
}

function clamp(
  value,
  min = 0,
  max = 100
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function round(
  value,
  decimals = 2
) {
  return Number.isFinite(value)
    ? Number(value.toFixed(decimals))
    : null;
}

/* =========================
   RSI
========================= */

function calculateRSI(
  closes,
  period = 14
) {
  if (
    !Array.isArray(closes) ||
    closes.length <= period
  ) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (
    let i = 1;
    i <= period;
    i += 1
  ) {
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

    avgGain =
      (
        avgGain * (period - 1) +
        (delta > 0 ? delta : 0)
      ) / period;

    avgLoss =
      (
        avgLoss * (period - 1) +
        (delta < 0
          ? Math.abs(delta)
          : 0)
      ) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  return (
    100 -
    100 /
      (1 +
        avgGain / avgLoss)
  );
}

/* =========================
   SMA
========================= */

function calculateSMA(
  closes,
  period
) {
  if (
    !Array.isArray(closes) ||
    closes.length < period
  ) {
    return null;
  }

  return average(
    closes.slice(-period)
  );
}

/* =========================
   MOMENTUM
========================= */

function calculateMomentum(
  closes,
  period = 5
) {
  if (
    closes.length <= period
  ) {
    return {
      percent: 0,
      score: 50,
    };
  }

  const current =
    closes.at(-1);

  const base =
    closes.at(-(period + 1));

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(base) ||
    base <= 0
  ) {
    return {
      percent: 0,
      score: 50,
    };
  }

  const percent =
    ((current - base) /
      base) *
    100;

  return {
    percent,
    score: clamp(
      50 + percent * 8
    ),
  };
}

/* =========================
   VOLUME
========================= */

function calculateVolumeMetrics(
  volume,
  volumes
) {
  const avgVolume20 =
    average(
      volumes.slice(-21, -1)
    );

  const relativeVolume =
    avgVolume20 > 0
      ? volume / avgVolume20
      : 0;

  const volumeScore =
    clamp(
      45 +
        (relativeVolume - 1) *
          35
    );

  return {
    avgVolume20,
    relativeVolume,
    volumeScore,
  };
}

/* =========================
   TREND
========================= */

function calculateTrendScore(
  price,
  sma20,
  sma50
) {
  if (
    !price ||
    !sma20 ||
    !sma50
  ) {
    return 50;
  }

  let score = 50;

  if (price > sma20) {
    score += 15;
  }

  if (price > sma50) {
    score += 20;
  }

  if (sma20 > sma50) {
    score += 15;
  }

  const distance =
    ((price - sma50) /
      sma50) *
    100;

  score += clamp(
    distance * 2,
    -20,
    20
  );

  return clamp(score);
}

/* =========================
   BREAKOUT
========================= */

function calculateBreakout(
  price,
  prior20High
) {
  if (
    !price ||
    !prior20High
  ) {
    return {
      distancePercent: null,
      score: 50,
    };
  }

  const distancePercent =
    ((prior20High - price) /
      prior20High) *
    100;

  let score = 25;

  if (distancePercent <= 0) {
    score = 100;
  } else if (
    distancePercent <= 1
  ) {
    score = 95;
  } else if (
    distancePercent <= 2
  ) {
    score = 88;
  } else if (
    distancePercent <= 4
  ) {
    score = 75;
  } else if (
    distancePercent <= 6
  ) {
    score = 60;
  } else if (
    distancePercent <= 10
  ) {
    score = 45;
  }

  return {
    distancePercent,
    score,
  };
}

/* =========================
   RSI SCORE
========================= */

function calculateRsiScore(
  rsi
) {
  if (rsi == null) {
    return 50;
  }

  if (
    rsi >= 45 &&
    rsi <= 65
  ) {
    return 100;
  }

  if (
    rsi > 65 &&
    rsi <= 70
  ) {
    return 85;
  }

  if (
    rsi >= 35 &&
    rsi < 45
  ) {
    return 75;
  }

  if (rsi > 70) {
    return 45;
  }

  if (rsi < 30) {
    return 55;
  }

  return 65;
}

/* =========================
   BOLLINGER
========================= */

function calculateBollinger(
  closes,
  period = 20
) {
  if (
    closes.length < period
  ) {
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

  if (
    !middle ||
    middle <= 0
  ) {
    return {
      bandwidth: null,
      squeeze: false,
      score: 0,
    };
  }

  const variance =
    average(
      slice.map(
        value =>
          (value - middle) ** 2
      )
    );

  const stdDev =
    Math.sqrt(
      variance
    );

  const upper =
    middle +
    2 * stdDev;

  const lower =
    middle -
    2 * stdDev;

  const bandwidth =
    ((upper - lower) /
      middle) *
    100;

  const squeeze =
    bandwidth < 9;

  let score = 20;

  if (bandwidth < 5) {
    score = 100;
  } else if (
    bandwidth < 7
  ) {
    score = 90;
  } else if (
    bandwidth < 9
  ) {
    score = 75;
  } else if (
    bandwidth < 12
  ) {
    score = 50;
  }

  return {
    bandwidth,
    squeeze,
    score,
  };
}

/* =========================
   CLUSTER
========================= */

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
    !recentHighs.length ||
    !recentLows.length ||
    !price
  ) {
    return {
      rangePercent: null,
      isCluster: false,
      score: 0,
    };
  }

  const recentHigh =
    Math.max(
      ...recentHighs
    );

  const recentLow =
    Math.min(
      ...recentLows
    );

  const rangePercent =
    ((recentHigh - recentLow) /
      price) *
    100;

  const isCluster =
    rangePercent <= 3.5 &&
    relativeVolume >= 1.1;

  let score = 25;

  if (
    rangePercent <= 2
  ) {
    score = 100;
  } else if (
    rangePercent <= 3.5
  ) {
    score = 85;
  } else if (
    rangePercent <= 5
  ) {
    score = 60;
  }

  if (
    relativeVolume >= 1.5
  ) {
    score += 10;
  }

  return {
    rangePercent,
    isCluster,
    score: clamp(score),
  };
}

/* =========================
   RISK / REWARD
========================= */

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
      targetPrice: null,
      riskReward: null,
      riskPercent: null,
      rewardPercent: null,
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
      targetPrice: null,
      riskReward: null,
      riskPercent: null,
      rewardPercent: null,
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
      targetPrice: null,
      riskReward: null,
      riskPercent:
        round(
          (risk / price) *
            100
        ),
      rewardPercent: null,
      score: 25,
    };
  }

  const riskReward =
    reward / risk;

  let score = 25;

  if (
    riskReward >= 3
  ) {
    score = 100;
  } else if (
    riskReward >= 2.5
  ) {
    score = 90;
  } else if (
    riskReward >= 2
  ) {
    score = 80;
  } else if (
    riskReward >= 1.5
  ) {
    score = 65;
  } else if (
    riskReward >= 1
  ) {
    score = 45;
  }

  return {
    stopLoss:
      round(stopLoss),

    targetPrice:
      round(resistance),

    riskReward:
      round(riskReward),

    riskPercent:
      round(
        (risk / price) *
          100
      ),

    rewardPercent:
      round(
        (reward / price) *
          100
      ),

    score,
  };
}

/* =========================
   FINAL SCORE
========================= */

function calculateTechnicalScore({
  momentumScore,
  volumeScore,
  trendScore,
  breakoutScore,
  rsiScore,
  squeezeScore,
  clusterScore,
  riskScore,
  resistancePenalty,
}) {
  const raw =
    momentumScore * 0.15 +
    volumeScore * 0.15 +
    trendScore * 0.15 +
    breakoutScore * 0.15 +
    rsiScore * 0.10 +
    squeezeScore * 0.10 +
    clusterScore * 0.10 +
    riskScore * 0.10 -
    resistancePenalty;

  return Math.round(
    clamp(raw)
  );
}

/* =========================
   SIGNAL
========================= */

function getSignal(score) {
  if (score >= 85) {
    return {
      signal: 'STRONG_BUY',
      strength: 'HIGH',
    };
  }

  if (score >= 75) {
    return {
      signal: 'BUY',
      strength: 'HIGH',
    };
  }

  if (score >= 65) {
    return {
      signal: 'BUY',
      strength: 'MEDIUM',
    };
  }

  return {
    signal: 'NEUTRAL',
    strength: 'LOW',
  };
}

/* =========================
   ANALYTICS
========================= */

function buildAnalytics(
  meta,
  quote
) {
  const closes =
    (quote?.close || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const volumes =
    (quote?.volume || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const highs =
    (quote?.high || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const lows =
    (quote?.low || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  if (
    closes.length < 60 ||
    volumes.length < 21
  ) {
    return null;
  }

  const price =
    Number(
      meta?.regularMarketPrice
    ) ||
    closes.at(-1);

  const previousClose =
    Number(
      meta?.previousClose
    ) ||
    Number(
      meta?.chartPreviousClose
    ) ||
    closes.at(-2);

  const volume =
    Number(
      meta?.regularMarketVolume
    ) ||
    volumes.at(-1);

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(
      previousClose
    ) ||
    price <= 0 ||
    previousClose <= 0
  ) {
    return null;
  }

  const changePercent =
    ((price -
      previousClose) /
      previousClose) *
    100;

  const sma20 =
    calculateSMA(
      closes,
      20
    );

  const sma50 =
    calculateSMA(
      closes,
      50
    );

  const rsi =
    calculateRSI(
      closes,
      14
    );

  const volumeMetrics =
    calculateVolumeMetrics(
      volume,
      volumes
    );

  const prior20High =
    Math.max(
      ...closes.slice(
        -21,
        -1
      )
    );

  const prior20Low =
    Math.min(
      ...lows.slice(
        -21,
        -1
      )
    );

  const momentum =
    calculateMomentum(
      closes
    );

  const trendScore =
    calculateTrendScore(
      price,
      sma20,
      sma50
    );

  const breakout =
    calculateBreakout(
      price,
      prior20High
    );

  const rsiScore =
    calculateRsiScore(
      rsi
    );

  const bollinger =
    calculateBollinger(
      closes
    );

  const cluster =
    calculateCluster(
      price,
      highs,
      lows,
      volumeMetrics.relativeVolume
    );

  const riskReward =
    calculateRiskReward(
      price,
      prior20Low,
      prior20High
    );

  const resistanceDistancePercent =
    ((prior20High -
      price) /
      price) *
    100;

  let resistancePenalty = 0;

  if (
    resistanceDistancePercent >=
      0 &&
    resistanceDistancePercent <
      1
  ) {
    resistancePenalty = 12;
  } else if (
    resistanceDistancePercent < 2
  ) {
    resistancePenalty = 7;
  }

  const technicalScore =
    calculateTechnicalScore({
      momentumScore:
        momentum.score,

      volumeScore:
        volumeMetrics.volumeScore,

      trendScore,

      breakoutScore:
        breakout.score,

      rsiScore,

      squeezeScore:
        bollinger.score,

      clusterScore:
        cluster.score,

      riskScore:
        riskReward.score,

      resistancePenalty,
    });

  const signal =
    getSignal(
      technicalScore
    );

  const bullishStructure =
    price > sma20 &&
    price > sma50 &&
    sma20 > sma50;

  return {
    price:
      round(price),

    changePercent:
      round(changePercent),

    volume:
      Math.round(volume),

    relativeVolume:
      round(
        volumeMetrics.relativeVolume
      ),

    rsi:
      rsi == null
        ? null
        : round(rsi),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

    momentumScore:
      Math.round(
        momentum.score
      ),

    volumeScore:
      Math.round(
        volumeMetrics.volumeScore
      ),

    trendScore:
      Math.round(
        trendScore
      ),

    breakoutScore:
      Math.round(
        breakout.score
      ),

    squeeze:
      bollinger.squeeze,

    bollingerBandwidth:
      round(
        bollinger.bandwidth
      ),

    squeezeScore:
      Math.round(
        bollinger.score
      ),

    cluster:
      cluster.isCluster,

    clusterRangePercent:
      round(
        cluster.rangePercent
      ),

    clusterScore:
      Math.round(
        cluster.score
      ),

    resistanceDistancePercent:
      round(
        resistanceDistancePercent
      ),

    targetPrice:
      riskReward.targetPrice,

    stopLoss:
      riskReward.stopLoss,

    riskReward:
      riskReward.riskReward,

    riskPercent:
      riskReward.riskPercent,

    rewardPercent:
      riskReward.rewardPercent,

    technicalScore,

    signal:
      signal.signal,

    signalStrength:
      signal.strength,

    bullishStructure,
  };
}

/* =========================
   FETCH STOCK
========================= */

async function fetchStock(
  symbol
) {
  const clean =
    String(symbol)
      .trim()
      .toUpperCase();

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(clean)}` +
    `?interval=1d&range=1y&events=div%2Csplits`;

  const response =
    await fetch(url, {
      headers:
        YAHOO_HEADERS,
      cache: 'no-store',
    });

  if (!response.ok) {
    return null;
  }

  const json =
    await response.json();

  const result =
    json?.chart?.result?.[0];

  if (!result?.meta) {
    return null;
  }

  const quoteType =
    result.meta?.quoteType ||
    result.meta?.instrumentType;

  if (
    quoteType &&
    quoteType !== 'EQUITY'
  ) {
    return null;
  }

  const analytics =
    buildAnalytics(
      result.meta,
      result.indicators
        ?.quote?.[0] || {}
    );

  if (!analytics) {
    return null;
  }

  return {
    symbol:
      result.meta?.symbol ||
      clean,

    analytics,
  };
}

/* =========================
   MARKET SESSION
========================= */

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

  const values =
    Object.fromEntries(
      parts.map(
        part => [
          part.type,
          part.value,
        ]
      )
    );

  const weekday =
    values.weekday;

  const hour =
    Number(values.hour);

  const minute =
    Number(values.minute);

  const minutes =
    hour * 60 +
    minute;

  const weekdays = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
  ];

  const marketOpen =
    9 * 60 + 30;

  const marketClose =
    16 * 60;

  return {
    weekday,
    nyTime:
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,

    active:
      weekdays.includes(
        weekday
      ) &&
      minutes >=
        marketOpen &&
      minutes <
        marketClose,
  };
}

/* =========================
   CANDIDATE GATE
========================= */

function qualifies(
  analytics
) {
  if (!analytics) {
    return false;
  }

  const priceOk =
    analytics.price > 0 &&
    analytics.price < 100;

  const volumeOk =
    analytics.volume >=
    100000;

  const scoreOk =
    analytics.technicalScore >=
    75;

  const confirmation =
    analytics.relativeVolume >=
      1.1 ||
    analytics.squeeze ||
    analytics.cluster ||
    analytics.breakoutScore >=
      75;

  return (
    priceOk &&
    volumeOk &&
    scoreOk &&
    confirmation
  );
}

/* =========================
   BUILD OPPORTUNITY
========================= */

function buildOpportunity(
  stock
) {
  const m =
    stock.analytics;

  let status =
    '📊 فرصة فنية';

  let reason =
    'توافق عدة عوامل فنية معاً.';

  if (
    m.squeeze &&
    m.cluster &&
    m.bullishStructure
  ) {
    status =
      '🔥 SQUEEZE + CLUSTER';

    reason =
      'ضغط بولنجر مع كلاستر وبنية سعرية صاعدة؛ ننتظر تأكيد الاختراق بالحجم.';
  } else if (
    m.squeeze &&
    m.bullishStructure
  ) {
    status =
      '⚡ BOLLINGER SQUEEZE';

    reason =
      'انكماش بولنجر مع اتجاه صاعد؛ الحركة القادمة تحتاج تأكيد السعر والحجم.';
  } else if (
    m.cluster &&
    m.relativeVolume >= 1.5
  ) {
    status =
      '💎 CLUSTER + VOLUME';

    reason =
      'نطاق سعري ضيق مع حجم نسبي مرتفع؛ إعداد مراقبة وليس ضماناً للاختراق.';
  } else if (
    m.breakoutScore >= 88 &&
    m.relativeVolume >= 1.5
  ) {
    status =
      '🚀 BREAKOUT WATCH';

    reason =
      'السعر قريب من أعلى 20 جلسة مع حجم نسبي قوي؛ ننتظر اختراقاً مؤكداً.';
  }

  /*
    confidence هنا ليس احتمال نجاح الصفقة.
    هو نفس Technical Score الحسابي.
  */

  return {
    ticker:
      stock.symbol,

    price:
      m.price,

    change_percent:
      m.changePercent,

    volume_status:
      status,

    target_price:
      m.targetPrice,

    stop_loss:
      m.stopLoss,

    confidence:
      m.technicalScore,

    reason:
      `${reason} | RSI ${m.rsi ?? 'N/A'} | RVOL ${m.relativeVolume}x | SMA50 ${m.sma50 ?? 'N/A'}`,

    sector:
      symbolSectors[
        stock.symbol
      ] || 'عام',

    /*
      لا توجد بيانات Options حقيقية.
      لذلك لا نرسل Strike أو Premium أو Expiry من التخمين.
    */

    option_idea:
      null,

    created_at:
      new Date().toISOString(),

    /*
      بيانات إضافية للاستخدام داخل التقرير/API فقط.
      لا يتم إرسالها إلى Supabase إذا لم تكن أعمدة موجودة.
    */

    risk_reward:
      m.riskReward,

    risk_percent:
      m.riskPercent,

    reward_percent:
      m.rewardPercent,

    technical: {
      score:
        m.technicalScore,

      rsi:
        m.rsi,

      relativeVolume:
        m.relativeVolume,

      sma20:
        m.sma20,

      sma50:
        m.sma50,

      squeeze:
        m.squeeze,

      cluster:
        m.cluster,

      breakoutScore:
        m.breakoutScore,

      signal:
        m.signal,

      signalStrength:
        m.signalStrength,
    },
  };
}

/* =========================
   DUPLICATE CHECK
========================= */

async function isDuplicate(
  supabase,
  ticker
) {
  if (!supabase) {
    return false;
  }

  const since =
    new Date(
      Date.now() -
        30 *
          60 *
          1000
    ).toISOString();

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'auto_signals'
        )
        .select(
          'ticker, created_at'
        )
        .eq(
          'ticker',
          ticker
        )
        .gte(
          'created_at',
          since
        )
        .limit(1);

    if (error) {
      console.error(
        'Duplicate check error:',
        error.message
      );

      return false;
    }

    return (
      Array.isArray(data) &&
      data.length > 0
    );
  } catch {
    return false;
  }
}

/* =========================
   SAVE
========================= */

async function saveOpportunity(
  supabase,
  opportunity
) {
  if (!supabase) {
    return false;
  }

  if (
    await isDuplicate(
      supabase,
      opportunity.ticker
    )
  ) {
    return false;
  }

  /*
    IMPORTANT:
    Insert only columns already used by the old project.
    This avoids breaking Supabase if extra columns don't exist.
  */

  const dbRow = {
    ticker:
      opportunity.ticker,

    price:
      opportunity.price,

    change_percent:
      opportunity.change_percent,

    volume_status:
      opportunity.volume_status,

    target_price:
      opportunity.target_price,

    stop_loss:
      opportunity.stop_loss,

    confidence:
      opportunity.confidence,

    reason:
      opportunity.reason,

    sector:
      opportunity.sector,

    option_idea:
      null,

    created_at:
      opportunity.created_at,
  };

  const {
    error,
  } =
    await supabase
      .from(
        'auto_signals'
      )
      .insert([
        dbRow,
      ]);

  if (error) {
    console.error(
      'auto_signals insert error:',
      error.message
    );

    return false;
  }

  return true;
}

/* =========================
   REPORT
========================= */

function buildReport(
  opportunities
) {
  let report =
    '🔥 *Trading Bot Pro V4 — Radar* 🔥\n' +
    '📊 قراءة فنية من السعر والحجم والبيانات التاريخية\n' +
    '⚠️ Options / Dark Pool / Institutional Flow غير متاحة من المصدر الحالي\n' +
    '━━━━━━━━━━━━━━━━━━\n';

  opportunities
    .slice(0, 5)
    .forEach(
      opportunity => {
        const t =
          opportunity.technical;

        report +=
          `\n📌 *${opportunity.ticker}*\n` +
          `💰 $${opportunity.price} (${opportunity.change_percent >= 0 ? '+' : ''}${opportunity.change_percent}%)\n` +
          `🧠 Score: ${opportunity.confidence}/100\n` +
          `📊 ${opportunity.volume_status}\n` +
          `📈 RSI: ${t.rsi ?? 'N/A'} | RVOL: x${t.relativeVolume}\n` +
          `📐 SMA20: $${t.sma20 ?? 'N/A'} | SMA50: $${t.sma50 ?? 'N/A'}\n` +
          `🎯 الهدف: ${opportunity.target_price ?? 'غير مؤكد'}\n` +
          `🛑 وقف الخسارة: ${opportunity.stop_loss ?? 'غير متاح'}\n` +
          `⚖️ R:R: ${opportunity.risk_reward ?? 'غير متاح'}\n` +
          `📝 ${opportunity.reason}\n` +
          '━━━━━━━━━━━━━━━━━━\n';
      }
    );

  return report;
}

/* =========================
   NOTIFICATIONS
========================= */

async function sendNotifications(
  opportunities
) {
  if (
    !opportunities.length
  ) {
    return;
  }

  const report =
    buildReport(
      opportunities
    );

  const baseUrl =
    process.env
      .NEXT_PUBLIC_BASE_URL;

  const botToken =
    process.env
      .TELEGRAM_BOT_TOKEN;

  const chatId =
    process.env
      .TELEGRAM_CHAT_ID;

  if (
    botToken &&
    chatId
  ) {
    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              chat_id:
                chatId,

              text:
                report,

              parse_mode:
                'Markdown',

              ...(baseUrl
                ? {
                    reply_markup:
                      {
                        inline_keyboard:
                          [[
                            {
                              text:
                                '📊 فتح Trading Bot Pro',

                              url:
                                baseUrl,
                            },
                          ]],
                      },
                  }
                : {}),
            }),
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Telegram notification error:',
        error
      );
    }
  }

  const discordUrl =
    process.env
      .DISCORD_WEBHOOK_URL;

  if (
    discordUrl
  ) {
    try {
      await fetch(
        discordUrl,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              content:
                report.replace(
                  /\*/g,
                  '**'
                ),
            }),
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Discord notification error:',
        error
      );
    }
  }
}

/* =========================
   GET /api/cron
========================= */

export async function GET(
  request
) {
  try {
    /*
      حماية Cron
    */

    const cronSecret =
      process.env
        .CRON_SECRET;

    if (
      cronSecret
    ) {
      const authorization =
        request.headers.get(
          'authorization'
        );

      if (
        authorization !==
        `Bearer ${cronSecret}`
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              'Unauthorized',
          },
          {
            status:
              401,
          }
        );
      }
    }

    /*
      وقت السوق الحقيقي بتوقيت نيويورك
    */

    const market =
      getMarketSession();

    if (
      !market.active
    ) {
      return NextResponse.json({
        success:
          true,

        market_active:
          false,

        ny_time:
          market.nyTime,

        count:
          0,

        data:
          [],

        message:
          'السوق الأمريكي مغلق حالياً. تم تخطي الفحص.',

        timestamp:
          new Date().toISOString(),
      });
    }

    const supabase =
      getSupabase();

    const symbols =
      Object.keys(
        symbolSectors
      );

    const detected =
      [];

    const newlySaved =
      [];

    const BATCH_SIZE =
      8;

    /*
      فحص الأسهم على دفعات
      لتجنب الضغط على Yahoo
    */

    for (
      let i = 0;
      i < symbols.length;
      i += BATCH_SIZE
    ) {
      const batch =
        symbols.slice(
          i,
          i +
            BATCH_SIZE
        );

      const results =
        await Promise.allSettled(
          batch.map(
            symbol =>
              fetchStock(
                symbol
              )
          )
        );

      results.forEach(
        result => {
          if (
            result.status !==
            'fulfilled'
          ) {
            return;
          }

          const stock =
            result.value;

          if (
            !stock
          ) {
            return;
          }

          if (
            !qualifies(
              stock.analytics
            )
          ) {
            return;
          }

          detected.push(
            buildOpportunity(
              stock
            )
          );
        }
      );
    }

    /*
      الأقوى أولاً
    */

    detected.sort(
      (
        a,
        b
      ) =>
        (
          b.confidence ||
          0
        ) -
        (
          a.confidence ||
          0
        )
    );

    /*
      حفظ أفضل 10 فقط
    */

    for (
      const opportunity of
        detected.slice(
          0,
          10
        )
    ) {
      const saved =
        await saveOpportunity(
          supabase,
          opportunity
        );

      if (
        saved
      ) {
        newlySaved.push(
          opportunity
        );
      }
    }

    /*
      التنبيه فقط للإشارات الجديدة
      وليس كل Cron
    */

    await sendNotifications(
      newlySaved
    );

    return NextResponse.json({
      success:
        true,

      market_active:
        true,

      ny_time:
        market.nyTime,

      scanned:
        symbols.length,

      count:
        detected.length,

      newly_saved:
        newlySaved.length,

      data:
        detected.slice(
          0,
          10
        ),

      dataSource:
        'Yahoo Finance',

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
        'لا توجد Options Chain أو Dark Pool أو Institutional Flow فعلية من مصدر البيانات الحالي.',

      timestamp:
        new Date().toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      'Cron radar error:',
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          'تعذر تشغيل الرادار الآلي حالياً',

        details:
          process.env.NODE_ENV ===
          'development'
            ? error?.message
            : undefined,
      },
      {
        status:
          503,
      }
    );
  }
}