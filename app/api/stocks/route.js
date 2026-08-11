
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
|--------------------------------------------------------------------------
| HUNTER AI — STOCKS / DISCOVERY ENGINE
|--------------------------------------------------------------------------
|
| مسؤولية هذا المسار:
|
| Universe
|   ↓
| Market Gate
|   ↓
| Technical Analysis
|   ↓
| Discovery Score
|   ↓
| Setup Score
|   ↓
| Radar
|
| لا يتم اختراع:
| - Options
| - Dark Pool
| - Institutional Flow
|
| Official analysis:
| /api/analyze
|
| Market data:
| /api/market-data
|
| هذا الملف مخصص أساساً لـ:
| - Stock Universe
| - Discovery
| - Radar ranking
| - Candidate filtering
|--------------------------------------------------------------------------
*/

/* =========================================================
   CONFIG
========================================================= */

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_PRICE = 0.5;
const MAX_PRICE = 100;

const MIN_AVG_VOLUME = 100000;
const MIN_HISTORY = 60;

const MAX_UNIVERSE = 100;

const FINNHUB_API_BASE =
  'https://finnhub.io/api/v1';

const FINNHUB_TIMEOUT_MS = 8000;
const FINNHUB_CONCURRENCY = 4;

/* =========================================================
   FINNHUB
========================================================= */

function getFinnhubToken() {
  return (
    process.env.FINNHUB_API_KEY ||
    process.env.FINNHUB_TOKEN ||
    ''
  );
}

function createProviderStatus() {
  const configured =
    Boolean(getFinnhubToken());

  return {
    finnhub: {
      configured,
      available: configured,
      reason: configured
        ? null
        : 'FINNHUB_API_KEY غير مهيأ',
    },

    yahoo: {
      configured: true,
      available: true,
      reason: null,
    },
  };
}

/* =========================================================
   HELPERS
========================================================= */

function number(value, fallback = null) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function average(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const valid =
    values.filter(Number.isFinite);

  if (!valid.length) {
    return null;
  }

  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / valid.length
  );
}

function clamp(
  value,
  min = 0,
  max = 100
) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, n)
  );
}

function round(
  value,
  decimals = 2
) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Number(
    n.toFixed(decimals)
  );
}

function isValidSymbol(symbol) {
  return /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
    symbol || ''
  );
}

/* =========================================================
   RSI
========================================================= */

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
      closes[i] -
      closes[i - 1];

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
      closes[i] -
      closes[i - 1];

    const gain =
      delta > 0 ? delta : 0;

    const loss =
      delta < 0
        ? Math.abs(delta)
        : 0;

    avgGain =
      ((avgGain *
        (period - 1)) +
        gain) /
      period;

    avgLoss =
      ((avgLoss *
        (period - 1)) +
        loss) /
      period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  return (
    100 -
    100 /
      (1 +
        avgGain /
          avgLoss)
  );
}

/* =========================================================
   BOLLINGER
========================================================= */

function calculateBollinger(
  closes,
  period = 20
) {
  if (
    !Array.isArray(closes) ||
    closes.length < period
  ) {
    return {
      bandwidth: null,
      squeeze: false,
      squeezeScore: 0,
    };
  }

  const slice =
    closes.slice(-period);

  const middle =
    average(slice);

  if (
    middle == null ||
    middle <= 0
  ) {
    return {
      bandwidth: null,
      squeeze: false,
      squeezeScore: 0,
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
    middle +
    2 * stdDev;

  const lower =
    middle -
    2 * stdDev;

  const bandwidth =
    ((upper - lower) /
      middle) *
    100;

  let squeezeScore = 20;

  if (bandwidth < 5) {
    squeezeScore = 100;
  } else if (bandwidth < 7) {
    squeezeScore = 90;
  } else if (bandwidth < 9) {
    squeezeScore = 75;
  } else if (bandwidth < 12) {
    squeezeScore = 50;
  }

  return {
    bandwidth,
    squeeze:
      bandwidth < 9,
    squeezeScore,
  };
}

/* =========================================================
   MOMENTUM
========================================================= */

function calculateMomentum(
  closes,
  period = 5
) {
  if (
    !Array.isArray(closes) ||
    closes.length <= period
  ) {
    return {
      percent: null,
      score: 50,
    };
  }

  const current =
    closes.at(-1);

  const base =
    closes.at(
      -(period + 1)
    );

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(base) ||
    base <= 0
  ) {
    return {
      percent: null,
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
      50 +
        percent * 8
    ),
  };
}

/* =========================================================
   VOLUME
========================================================= */

function calculateVolume(
  volumes
) {
  if (
    !Array.isArray(volumes) ||
    volumes.length < 21
  ) {
    return {
      current: 0,
      average20: null,
      relative: null,
      score: 0,
      liquidityScore: 0,
    };
  }

  const current =
    number(
      volumes.at(-1),
      0
    );

  const average20 =
    average(
      volumes.slice(
        -21,
        -1
      )
    );

  const relative =
    average20 &&
    average20 > 0
      ? current /
        average20
      : null;

  const score =
    relative == null
      ? 0
      : clamp(
          45 +
            (relative - 1) *
              35
        );

  let liquidityScore = 25;

  if (average20 >= 1000000) {
    liquidityScore = 100;
  } else if (average20 >= 500000) {
    liquidityScore = 85;
  } else if (average20 >= 250000) {
    liquidityScore = 70;
  } else if (average20 >= 100000) {
    liquidityScore = 55;
  }

  return {
    current,
    average20,
    relative,
    score,
    liquidityScore,
  };
}

/* =========================================================
   TREND
========================================================= */

function calculateTrend(
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

/* =========================================================
   BREAKOUT
========================================================= */

function calculateBreakout(
  price,
  resistance
) {
  if (
    !price ||
    !resistance
  ) {
    return {
      distance: null,
      score: 50,
    };
  }

  const distance =
    ((resistance - price) /
      price) *
    100;

  let score = 25;

  if (distance <= 0) {
    score = 100;
  } else if (distance <= 1) {
    score = 95;
  } else if (distance <= 2) {
    score = 88;
  } else if (distance <= 4) {
    score = 75;
  } else if (distance <= 6) {
    score = 60;
  } else if (distance <= 10) {
    score = 45;
  }

  return {
    distance,
    score,
  };
}

/* =========================================================
   RSI SCORE
========================================================= */

function calculateRSIScore(value) {
  if (value == null) {
    return 50;
  }

  if (
    value >= 45 &&
    value <= 65
  ) {
    return 100;
  }

  if (
    value > 65 &&
    value <= 70
  ) {
    return 85;
  }

  if (
    value >= 35 &&
    value < 45
  ) {
    return 75;
  }

  if (value > 70) {
    return 45;
  }

  if (value < 30) {
    return 55;
  }

  return 65;
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
  if (
    !price ||
    highs.length < 5 ||
    lows.length < 5
  ) {
    return {
      range: null,
      isCluster: false,
      score: 0,
    };
  }

  const recentHighs =
    highs.slice(-5);

  const recentLows =
    lows.slice(-5);

  const high =
    Math.max(
      ...recentHighs
    );

  const low =
    Math.min(
      ...recentLows
    );

  const range =
    ((high - low) /
      price) *
    100;

  const rvol =
    Number(
      relativeVolume
    ) || 0;

  const isCluster =
    range <= 3.5 &&
    rvol >= 1.1;

  let score = 25;

  if (range <= 2) {
    score = 100;
  } else if (range <= 3.5) {
    score = 85;
  } else if (range <= 5) {
    score = 60;
  }

  if (rvol >= 1.5) {
    score += 10;
  }

  return {
    range,
    isCluster,
    score: clamp(score),
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
      targetPrice: null,
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
    stopLoss <= 0 ||
    stopLoss >= price
  ) {
    return {
      stopLoss: null,
      targetPrice: null,
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
      stopLoss: round(stopLoss),
      targetPrice: null,
      riskPercent: round(
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

  return {
    stopLoss: round(stopLoss),

    targetPrice:
      round(resistance),

    riskPercent: round(
      (risk / price) * 100
    ),

    rewardPercent: round(
      (reward / price) * 100
    ),

    riskReward: round(
      riskReward
    ),

    score,
  };
}

/* =========================================================
   DISCOVERY SCORE
========================================================= */

function calculateDiscoveryScore({
  rank,
  relativeVolume,
  changePercent,
  volume,
}) {
  let rankScore = 50;

  if (rank != null) {
    rankScore =
      clamp(
        100 -
          rank * 2.5,
        40,
        100
      );
  }

  const rvol =
    Number(
      relativeVolume
    ) || 0;

  const rvolScore =
    clamp(
      30 +
        rvol * 25,
      30,
      100
    );

  const change =
    Number(
      changePercent
    ) || 0;

  const activityScore =
    clamp(
      40 +
        Math.abs(change) *
          5,
      40,
      100
    );

  let liquidityScore = 30;

  if (volume >= 1000000) {
    liquidityScore = 100;
  } else if (volume >= 500000) {
    liquidityScore = 80;
  } else if (volume >= 100000) {
    liquidityScore = 60;
  }

  return Math.round(
    clamp(
      rankScore * 0.25 +
        rvolScore * 0.35 +
        activityScore * 0.15 +
        liquidityScore * 0.25
    )
  );
}

/* =========================================================
   TECHNICAL SCORE
========================================================= */

function calculateTechnicalScore({
  momentum,
  volume,
  trend,
  breakout,
  rsi,
  squeeze,
  cluster,
  risk,
  resistancePenalty,
}) {
  const raw =
    momentum * 0.15 +
    volume * 0.15 +
    trend * 0.15 +
    breakout * 0.15 +
    rsi * 0.10 +
    squeeze * 0.10 +
    cluster * 0.10 +
    risk * 0.10 -
    resistancePenalty;

  return Math.round(
    clamp(raw)
  );
}

/* =========================================================
   SIGNAL
========================================================= */

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

  if (score >= 50) {
    return {
      signal: 'NEUTRAL',
      strength: 'LOW',
    };
  }

  return {
    signal: 'AVOID',
    strength: 'LOW',
  };
}

/* =========================================================
   MARKET STATE
========================================================= */

function getMarketState(
  price,
  sma20,
  sma50
) {
  if (
    !price ||
    !sma20 ||
    !sma50
  ) {
    return 'UNKNOWN';
  }

  if (
    price > sma20 &&
    sma20 > sma50
  ) {
    return 'BULLISH';
  }

  if (
    price < sma20 &&
    sma20 < sma50
  ) {
    return 'BEARISH';
  }

  return 'MIXED';
}

/* =========================================================
   ANALYTICS
========================================================= */

function buildAnalytics(
  meta,
  quote,
  rank = null
) {
  const closes =
    (quote?.close || [])
      .map(Number)
      .filter(Number.isFinite);

  const highs =
    (quote?.high || [])
      .map(Number)
      .filter(Number.isFinite);

  const lows =
    (quote?.low || [])
      .map(Number)
      .filter(Number.isFinite);

  const volumes =
    (quote?.volume || [])
      .map(Number)
      .filter(Number.isFinite);

  const price =
    number(
      meta?.regularMarketPrice,
      closes.at(-1)
    );

  const previousClose =
    number(
      meta?.previousClose ??
        meta?.chartPreviousClose,
      closes.at(-2)
    );

  const volume =
    number(
      meta?.regularMarketVolume,
      volumes.at(-1)
    );

  if (
    closes.length < MIN_HISTORY ||
    !price ||
    !previousClose
  ) {
    return {
      technicalReady: false,
      dataQuality:
        'بيانات غير مكتملة',
      price,
      previousClose,
      setupScore: null,
    };
  }

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

  const volumeMetrics =
    calculateVolume(volumes);

  const momentum =
    calculateMomentum(closes);

  const resistance =
    closes.length >= 21
      ? Math.max(
          ...closes.slice(
            -21,
            -1
          )
        )
      : null;

  const support =
    lows.length >= 21
      ? Math.min(
          ...lows.slice(
            -21,
            -1
          )
        )
      : null;

  const trendScore =
    calculateTrend(
      price,
      sma20,
      sma50
    );

  const breakout =
    calculateBreakout(
      price,
      resistance
    );

  const rsiScore =
    calculateRSIScore(rsi);

  const bollinger =
    calculateBollinger(closes);

  const cluster =
    calculateCluster(
      price,
      highs,
      lows,
      volumeMetrics.relative
    );

  const riskReward =
    calculateRiskReward(
      price,
      support,
      resistance
    );

  const resistanceDistance =
    resistance
      ? ((resistance - price) /
          price) *
        100
      : null;

  let resistancePenalty = 0;

  if (
    resistanceDistance != null &&
    resistanceDistance >= 0 &&
    resistanceDistance < 1
  ) {
    resistancePenalty = 12;
  } else if (
    resistanceDistance != null &&
    resistanceDistance < 2
  ) {
    resistancePenalty = 7;
  }

  const technicalScore =
    calculateTechnicalScore({
      momentum: momentum.score,
      volume: volumeMetrics.score,
      trend: trendScore,
      breakout: breakout.score,
      rsi: rsiScore,
      squeeze:
        bollinger.squeezeScore,
      cluster: cluster.score,
      risk: riskReward.score,
      resistancePenalty,
    });

  const changePercent =
    ((price - previousClose) /
      previousClose) *
    100;

  /*
   * Discovery score:
   * لا يحل محل Technical Score.
   */

  const discoveryScore =
    calculateDiscoveryScore({
      rank,
      relativeVolume:
        volumeMetrics.relative,
      changePercent,
      volume,
    });

  /*
   * الرسمي للرادار:
   *
   * Technical = 85%
   * Discovery = 15%
   */

  const setupScore =
    Math.round(
      technicalScore * 0.85 +
        discoveryScore * 0.15
    );

  const signal =
    getSignal(setupScore);

  return {
    technicalReady: true,

    dataQuality:
      volumeMetrics.average20 >=
      MIN_AVG_VOLUME
        ? 'HIGH'
        : 'MEDIUM',

    price:
      round(price, 4),

    previousClose:
      round(previousClose, 4),

    change:
      round(
        price - previousClose,
        4
      ),

    changePercent:
      round(changePercent),

    volume,

    averageVolume20:
      Math.round(
        volumeMetrics.average20 || 0
      ),

    relativeVolume:
      round(
        volumeMetrics.relative,
        2
      ),

    liquidityScore:
      Math.round(
        volumeMetrics.liquidityScore
      ),

    momentumPercent:
      round(momentum.percent),

    momentum:
      Math.round(momentum.score),

    momentumScore:
      Math.round(momentum.score),

    volumeScore:
      Math.round(
        volumeMetrics.score
      ),

    trendScore:
      Math.round(trendScore),

    breakout:
      Math.round(breakout.score),

    breakoutScore:
      Math.round(breakout.score),

    rsi:
      rsi == null
        ? null
        : round(rsi),

    rsiScore:
      Math.round(rsiScore),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

    resistance20:
      round(resistance),

    support20:
      round(support),

    resistanceDistancePercent:
      round(resistanceDistance),

    resistanceDistance:
      round(resistanceDistance),

    squeeze:
      bollinger.squeeze,

    bollingerBandwidth:
      round(
        bollinger.bandwidth
      ),

    squeezeScore:
      Math.round(
        bollinger.squeezeScore
      ),

    cluster:
      cluster.isCluster,

    clusterRangePercent:
      round(cluster.range),

    clusterScore:
      Math.round(cluster.score),

    targetPrice:
      riskReward.targetPrice,

    stopLoss:
      riskReward.stopLoss,

    riskPercent:
      riskReward.riskPercent,

    rewardPercent:
      riskReward.rewardPercent,

    riskReward:
      riskReward.riskReward,

    riskScore:
      riskReward.score,

    technicalScore,

    discoveryScore,

    /*
     * لا يوجد مصدر مؤسسي فعلي.
     */

    institutionalScore: null,

    setupScore,

    signal:
      signal.signal,

    signalStrength:
      signal.strength,

    marketState:
      getMarketState(
        price,
        sma20,
        sma50
      ),

    dayHigh:
      round(
        highs.at(-1) || price
      ),

    dayLow:
      round(
        lows.at(-1) || price
      ),

    currency:
      meta?.currency || 'USD',

    dataAvailability: {
      price: true,
      volume: true,
      technicals: true,
      options: false,
      darkPool: false,
      institutionalFlow: false,
    },
  };
}

/* =========================================================
   YAHOO CHART
========================================================= */

async function fetchYahooChart(
  symbol
) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (
    !isValidSymbol(clean)
  ) {
    throw new Error(
      `Invalid symbol: ${clean}`
    );
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(clean)}` +
    `?interval=1d&range=6mo&events=div%2Csplits`;

  const response =
    await fetch(url, {
      headers:
        YAHOO_HEADERS,
      cache: 'no-store',
      signal:
        AbortSignal.timeout(8000),
    });

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance ${response.status}`
    );
  }

  const json =
    await response.json();

  const result =
    json?.chart?.result?.[0];

  if (!result?.meta) {
    throw new Error(
      `No data for ${clean}`
    );
  }

  return {
    provider: 'yahoo',

    symbol:
      result.meta.symbol ||
      clean,

    meta:
      result.meta,

    quote:
      result.indicators
        ?.quote?.[0] || {},
  };
}

/* =========================================================
   FINNHUB
========================================================= */

function unixDaysAgo(days) {
  return Math.floor(
    (
      Date.now() -
      days *
        24 *
        60 *
        60 *
        1000
    ) / 1000
  );
}

async function fetchFinnhubChart(
  symbol,
  providerStatus
) {
  const token =
    getFinnhubToken();

  if (
    !token ||
    !providerStatus.finnhub.available
  ) {
    const error =
      new Error(
        providerStatus.finnhub.reason ||
          'Finnhub غير متاح'
      );

    error.code =
      'FINNHUB_UNAVAILABLE';

    throw error;
  }

  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (
    !isValidSymbol(clean)
  ) {
    throw new Error(
      `Invalid symbol: ${clean}`
    );
  }

  const url =
    new URL(
      `${FINNHUB_API_BASE}/stock/candle`
    );

  url.searchParams.set(
    'symbol',
    clean
  );

  url.searchParams.set(
    'resolution',
    'D'
  );

  url.searchParams.set(
    'from',
    String(
      unixDaysAgo(190)
    )
  );

  url.searchParams.set(
    'to',
    String(
      Math.floor(
        Date.now() / 1000
      )
    )
  );

  url.searchParams.set(
    'token',
    token
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      FINNHUB_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(url, {
        cache: 'no-store',
        signal:
          controller.signal,
      });

    if (response.status === 429) {
      providerStatus.finnhub.available =
        false;

      providerStatus.finnhub.reason =
        'Finnhub rate limit (HTTP 429)';

      const error =
        new Error(
          providerStatus.finnhub.reason
        );

      error.code =
        'FINNHUB_RATE_LIMIT';

      throw error;
    }

    if (!response.ok) {
      const error =
        new Error(
          `Finnhub ${response.status}`
        );

      error.code =
        response.status === 401 ||
        response.status === 403
          ? 'FINNHUB_UNAVAILABLE'
          : 'FINNHUB_REQUEST_FAILED';

      if (
        error.code ===
        'FINNHUB_UNAVAILABLE'
      ) {
        providerStatus.finnhub.available =
          false;

        providerStatus.finnhub.reason =
          `Finnhub unavailable (HTTP ${response.status})`;
      }

      throw error;
    }

    const data =
      await response.json();

    if (
      data?.s !== 'ok' ||
      !Array.isArray(data?.c)
    ) {
      const error =
        new Error(
          'Finnhub returned no daily candle data'
        );

      error.code =
        'FINNHUB_NO_CANDLES';

      throw error;
    }

    const closes =
      data.c
        .map(Number)
        .filter(
          Number.isFinite
        );

    const highs =
      (data.h || [])
        .map(Number)
        .filter(
          Number.isFinite
        );

    const lows =
      (data.l || [])
        .map(Number)
        .filter(
          Number.isFinite
        );

    const volumes =
      (data.v || [])
        .map(Number)
        .filter(
          Number.isFinite
        );

    if (
      closes.length < MIN_HISTORY ||
      highs.length !== closes.length ||
      lows.length !== closes.length ||
      volumes.length !== closes.length
    ) {
      const error =
        new Error(
          'Finnhub returned insufficient daily OHLCV data'
        );

      error.code =
        'FINNHUB_NO_CANDLES';

      throw error;
    }

    return {
      provider: 'finnhub',

      symbol: clean,

      meta: {
        regularMarketPrice:
          closes.at(-1),

        previousClose:
          closes.at(-2),

        regularMarketVolume:
          volumes.at(-1),

        currency: 'USD',

        quoteType: 'EQUITY',

        exchangeTimezoneName:
          'America/New_York',
      },

      quote: {
        close: closes,
        high: highs,
        low: lows,
        volume: volumes,
      },
    };
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      providerStatus.finnhub.available =
        false;

      providerStatus.finnhub.reason =
        `Finnhub timeout after ${FINNHUB_TIMEOUT_MS}ms`;

      const timeoutError =
        new Error(
          providerStatus.finnhub.reason
        );

      timeoutError.code =
        'FINNHUB_TIMEOUT';

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   CHART PROVIDER
========================================================= */

async function fetchChart(
  symbol,
  providerStatus
) {
  if (
    providerStatus.finnhub.available
  ) {
    try {
      return await fetchFinnhubChart(
        symbol,
        providerStatus
      );
    } catch (error) {
      console.warn(
        `Finnhub failed for ${symbol}; using Yahoo fallback.`,
        error?.message ||
          error
      );
    }
  }

  return fetchYahooChart(
    symbol
  );
}

/* =========================================================
   US EQUITY CHECK
========================================================= */

function isUsEquity(meta) {
  const type =
    meta?.instrumentType ||
    meta?.quoteType;

  if (
    type !== 'EQUITY'
  ) {
    return false;
  }

  const exchange =
    String(
      meta?.fullExchangeName ||
        meta?.exchangeName ||
        ''
    ).toUpperCase();

  if (
    exchange.includes('NASDAQ') ||
    exchange.includes('NYSE') ||
    exchange.includes('AMEX') ||
    exchange.includes('NYSEARCA') ||
    exchange.includes('NYSE MKT')
  ) {
    return true;
  }

  return (
    meta?.exchangeTimezoneName ===
    'America/New_York'
  );
}

/* =========================================================
   CONFIGURED UNIVERSE
========================================================= */

async function getConfiguredUniverse() {
  const raw =
    process.env.HUNTER_UNIVERSE ||
    '';

  if (!raw.trim()) {
    return [];
  }

  const symbols =
    raw
      .split(',')
      .map(
        (item) =>
          item
            .trim()
            .toUpperCase()
      )
      .filter(
        isValidSymbol
      );

  return [
    ...new Set(symbols),
  ];
}

/* =========================================================
   YAHOO DISCOVERY FALLBACK
========================================================= */

async function getYahooDiscoveryUniverse() {
  const response =
    await fetch(
      'https://query1.finance.yahoo.com/v1/finance/trending/US?count=50',
      {
        headers:
          YAHOO_HEADERS,
        cache:
          'no-store',
        signal:
          AbortSignal.timeout(8000),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Yahoo trending ${response.status}`
    );
  }

  const data =
    await response.json();

  return (
    data?.finance
      ?.result?.[0]
      ?.quotes || []
  )
    .map(
      (item) =>
        item?.symbol
    )
    .filter(
      (symbol) =>
        isValidSymbol(symbol)
    );
}

/* =========================================================
   SCAN UNIVERSE
========================================================= */

async function scanUniverse(
  symbols,
  providerStatus
) {
  const results = [];

  const batchSize =
    providerStatus.finnhub.available
      ? FINNHUB_CONCURRENCY
      : 6;

  for (
    let i = 0;
    i < symbols.length;
    i += batchSize
  ) {
    const batch =
      symbols.slice(
        i,
        i + batchSize
      );

    const settled =
      await Promise.allSettled(
        batch.map(
          async (
            symbol,
            index
          ) => {
            try {
              const chart =
                await fetchChart(
                  symbol,
                  providerStatus
                );

              if (
                !isUsEquity(
                  chart.meta
                )
              ) {
                return null;
              }

              const analytics =
                buildAnalytics(
                  chart.meta,
                  chart.quote,
                  i + index + 1
                );

              return {
                symbol:
                  chart.symbol,

                quoteType:
                  chart.meta
                    ?.quoteType ||
                  null,

                exchange:
                  chart.meta
                    ?.fullExchangeName ||
                  chart.meta
                    ?.exchangeName ||
                  null,

                provider:
                  chart.provider,

                ...analytics,
              };
            } catch (error) {
              console.warn(
                `Stock scan failed for ${symbol}:`,
                error?.message ||
                  error
              );

              return null;
            }
          }
        )
      );

    results.push(
      ...settled
        .filter(
          (item) =>
            item.status ===
            'fulfilled'
        )
        .map(
          (item) =>
            item.value
        )
        .filter(Boolean)
    );
  }

  return results;
}

/* =========================================================
   MARKET GATE
========================================================= */

function passesMarketGate(item) {
  if (
    !item?.technicalReady
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      item.price
    )
  ) {
    return false;
  }

  if (
    item.price <= MIN_PRICE ||
    item.price >= MAX_PRICE
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      item.averageVolume20
    ) ||
    item.averageVolume20 <
      MIN_AVG_VOLUME
  ) {
    return false;
  }

  if (
    item.relativeVolume == null
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   GET API
========================================================= */

export async function GET(
  request
) {
  try {
    const {
      searchParams,
    } = new URL(
      request.url
    );

    const requestedSymbol =
      searchParams
        .get('symbol')
        ?.trim()
        .toUpperCase();

    /*
     * =====================================================
     * SINGLE STOCK
     * /api/stocks?symbol=SOFI
     * =====================================================
     */

    if (requestedSymbol) {
      if (
        !isValidSymbol(
          requestedSymbol
        )
      ) {
        return NextResponse.json(
          {
            status: 'error',
            error:
              'رمز السهم غير صالح',
          },
          {
            status: 400,
          }
        );
      }

      const providerStatus =
        createProviderStatus();

      const chart =
        await fetchChart(
          requestedSymbol,
          providerStatus
        );

      if (
        !isUsEquity(
          chart.meta
        )
      ) {
        return NextResponse.json(
          {
            status: 'error',
            error:
              'الرمز ليس سهماً أمريكياً',
          },
          {
            status: 422,
          }
        );
      }

      const analytics =
        buildAnalytics(
          chart.meta,
          chart.quote
        );

      return NextResponse.json(
        {
          status: 'success',

          timestamp:
            new Date().toISOString(),

          count: 1,

          data: [
            {
              symbol:
                chart.symbol,

              quoteType:
                chart.meta
                  ?.quoteType ||
                null,

              exchange:
                chart.meta
                  ?.fullExchangeName ||
                chart.meta
                  ?.exchangeName ||
                null,

              provider:
                chart.provider,

              ...analytics,
            },
          ],

          source:
            chart.provider ===
            'finnhub'
              ? 'Finnhub daily candles'
              : 'Yahoo Finance chart',

          providers:
            providerStatus,

          dataAvailability: {
            price: true,
            volume: true,
            technicals: true,
            options: false,
            darkPool: false,
            institutionalFlow:
              false,
          },

          limitations: {
            options: false,
            darkPool: false,
            institutionalFlow:
              false,

            note:
              'لا يتم احتساب أي بيانات غير متوفرة فعلياً.',
          },
        },
        {
          headers: {
            'Cache-Control':
              'no-store, max-age=0',
          },
        }
      );
    }

    /*
     * =====================================================
     * UNIVERSE
     * =====================================================
     */

    const providerStatus =
      createProviderStatus();

    const configured =
      await getConfiguredUniverse();

    let symbols =
      configured;

    let universeSource =
      'HUNTER_UNIVERSE';

    /*
     * Yahoo Trending:
     * Discovery fallback فقط.
     */

    if (!symbols.length) {
      symbols =
        await getYahooDiscoveryUniverse();

      universeSource =
        'Yahoo Trending Discovery Fallback';
    }

    const uniqueSymbols =
      [
        ...new Set(
          symbols
        ),
      ].slice(
        0,
        MAX_UNIVERSE
      );

    /*
     * =====================================================
     * SCAN
     * =====================================================
     */

    const scanned =
      await scanUniverse(
        uniqueSymbols,
        providerStatus
      );

    /*
     * =====================================================
     * MARKET GATE
     * =====================================================
     */

    const gated =
      scanned.filter(
        passesMarketGate
      );

    /*
     * =====================================================
     * SORT
     * =====================================================
     *
     * Setup Score:
     *
     * Technical 85%
     * Discovery 15%
     *
     * ثم RVOL كعامل كسر تعادل.
     */

    gated.sort(
      (a, b) => {
        const scoreDiff =
          (b.setupScore ?? -1) -
          (a.setupScore ?? -1);

        if (
          scoreDiff !== 0
        ) {
          return scoreDiff;
        }

        return (
          (b.relativeVolume ??
            0) -
          (a.relativeVolume ??
            0)
        );
      }
    );

    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     */

    return NextResponse.json(
      {
        status: 'success',

        timestamp:
          new Date().toISOString(),

        count:
          gated.length,

        scanned:
          uniqueSymbols.length,

        data:
          gated,

        universe:
          universeSource,

        providers:
          providerStatus,

        marketGate: {
          price:
            `$${MIN_PRICE} - $${MAX_PRICE}`,

          averageVolume:
            `>= ${MIN_AVG_VOLUME.toLocaleString()}`,

          history:
            `>= ${MIN_HISTORY} sessions`,
        },

        scoring: {
          technical:
            '85%',

          discovery:
            '15%',

          setupScore:
            'Technical 85% + Discovery 15%',

          institutional:
            'غير محتسب حتى يتوفر مصدر فعلي',
        },

        dataAvailability: {
          price: true,
          volume: true,
          technicals: true,
          options: false,
          darkPool: false,
          institutionalFlow:
            false,
        },

        limitations:
          'هذا المسار مسؤول عن Discovery وRadar. Yahoo Trending يستخدم كـ fallback فقط إذا لم يتم تعريف HUNTER_UNIVERSE. لا يتم اعتبار Trending تدفقاً مؤسسياً، ولا يتم اختلاق Options أو Dark Pool أو Institutional Flow.',
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
      'HUNTER AI V4 Stocks API Error:',
      error
    );

    return NextResponse.json(
      {
        status: 'error',

        timestamp:
          new Date().toISOString(),

        count: 0,

        scanned: 0,

        data: [],

        error:
          'تعذر جلب بيانات الأسهم الأمريكية المباشرة حالياً',

        details:
          process.env.NODE_ENV ===
          'development'
            ? error?.message
            : undefined,
      },
      {
        status: 503,

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
}
