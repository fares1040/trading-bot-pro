
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_PRICE = 0.5;
const MAX_PRICE = 100;
const MIN_VOLUME = 100000;
const MIN_HISTORY = 60;
const DISCOVERY_COUNT = 30;
const MAX_UNIVERSE = 25;

/* =========================================================
   HELPERS
========================================================= */

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function average(values) {
  const valid = values.filter(Number.isFinite);

  if (!valid.length) return null;

  return (
    valid.reduce((sum, value) => sum + value, 0) /
    valid.length
  );
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return min;
  }

  return Math.max(min, Math.min(max, n));
}

function round(value, decimals = 2) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Number(n.toFixed(decimals));
}

function isValidSymbol(symbol) {
  return /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
    String(symbol || '')
  );
}

/* =========================================================
   SMA
========================================================= */

function calculateSMA(values, period) {
  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return null;
  }

  return average(values.slice(-period));
}

/* =========================================================
   EMA
========================================================= */

function calculateEMA(values, period) {
  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return null;
  }

  const multiplier = 2 / (period + 1);

  let ema = average(
    values.slice(0, period)
  );

  if (ema == null) {
    return null;
  }

  for (
    let i = period;
    i < values.length;
    i += 1
  ) {
    ema =
      (values[i] - ema) * multiplier +
      ema;
  }

  return ema;
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
      delta > 0
        ? delta
        : 0;

    const loss =
      delta < 0
        ? Math.abs(delta)
        : 0;

    avgGain =
      ((avgGain * (period - 1)) +
        gain) /
      period;

    avgLoss =
      ((avgLoss * (period - 1)) +
        loss) /
      period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs =
    avgGain /
    avgLoss;

  return (
    100 -
    100 /
      (1 + rs)
  );
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

  const previous =
    closes.at(
      -(period + 1)
    );

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return {
      percent: null,
      score: 50,
    };
  }

  const percent =
    ((current - previous) /
      previous) *
    100;

  return {
    percent,
    score: clamp(
      50 + percent * 8
    ),
  };
}

/* =========================================================
   VOLUME
========================================================= */

function calculateVolumeMetrics(
  volumes,
  currentVolume,
  period = 20
) {
  if (
    !Array.isArray(volumes) ||
    !volumes.length
  ) {
    return {
      averageVolume: null,
      relativeVolume: null,
      volumeScore: 0,
      liquidityScore: 0,
    };
  }

  const previousVolumes =
    volumes.length > period
      ? volumes.slice(
          -(period + 1),
          -1
        )
      : volumes.slice(
          -period
        );

  const averageVolume =
    average(previousVolumes);

  const relativeVolume =
    averageVolume &&
    averageVolume > 0
      ? currentVolume /
        averageVolume
      : null;

  const volumeScore =
    relativeVolume != null
      ? clamp(
          45 +
            (relativeVolume - 1) *
              35
        )
      : 50;

  let liquidityScore = 25;

  if (
    averageVolume >=
    1000000
  ) {
    liquidityScore = 100;
  } else if (
    averageVolume >=
    500000
  ) {
    liquidityScore = 85;
  } else if (
    averageVolume >=
    250000
  ) {
    liquidityScore = 70;
  } else if (
    averageVolume >=
    100000
  ) {
    liquidityScore = 55;
  }

  return {
    averageVolume,
    relativeVolume,
    volumeScore,
    liquidityScore,
  };
}

/* =========================================================
   TREND
========================================================= */

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

/* =========================================================
   RSI SCORE
========================================================= */

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
      middle: null,
      upper: null,
      lower: null,
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
    middle == null ||
    middle <= 0
  ) {
    return {
      middle: null,
      upper: null,
      lower: null,
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
    middle +
    2 * stdDev;

  const lower =
    middle -
    2 * stdDev;

  const bandwidth =
    ((upper - lower) /
      middle) *
    100;

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
    middle,
    upper,
    lower,
    bandwidth,
    squeeze:
      bandwidth < 9,
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
  if (
    !price ||
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    highs.length < 5 ||
    lows.length < 5
  ) {
    return {
      isCluster: false,
      rangePercent: null,
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

  const rangePercent =
    ((high - low) /
      price) *
    100;

  const isCluster =
    rangePercent <= 3.5 &&
    Number(relativeVolume || 0) >=
      1.1;

  let score = 25;

  if (rangePercent <= 2) {
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
    Number(relativeVolume || 0) >=
    1.5
  ) {
    score += 10;
  }

  return {
    isCluster,
    rangePercent,
    score: clamp(score),
  };
}

/* =========================================================
   BREAKOUT
========================================================= */

function calculateBreakout(
  price,
  closes
) {
  if (
    !price ||
    !Array.isArray(closes) ||
    closes.length < 21
  ) {
    return {
      distancePercent: null,
      score: 50,
      priorHigh: null,
    };
  }

  const priorHigh =
    Math.max(
      ...closes.slice(
        -21,
        -1
      )
    );

  if (
    !Number.isFinite(priorHigh) ||
    priorHigh <= 0
  ) {
    return {
      distancePercent: null,
      score: 50,
      priorHigh: null,
    };
  }

  const distancePercent =
    ((priorHigh - price) /
      price) *
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
    priorHigh,
  };
}

/* =========================================================
   SUPPORT / RESISTANCE
========================================================= */

function calculateLevels(
  highs,
  lows,
  closes
) {
  const resistance =
    highs.length >= 21
      ? Math.max(
          ...highs.slice(
            -21,
            -1
          )
        )
      : closes.length >= 21
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
      : closes.length >= 21
        ? Math.min(
            ...closes.slice(
              -21,
              -1
            )
          )
        : null;

  return {
    resistance,
    support,
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
      stopLoss:
        round(stopLoss),
      targetPrice: null,
      riskPercent:
        round(
          (risk / price) *
            100
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

    riskReward:
      round(riskReward),

    score,
  };
}

/* =========================================================
   FINAL SCORE
========================================================= */

function calculateScore({
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

/* =========================================================
   SIGNAL
========================================================= */

function getSignal(score) {
  if (score >= 85) {
    return {
      signal:
        'STRONG_BUY',
      strength:
        'HIGH',
    };
  }

  if (score >= 75) {
    return {
      signal:
        'BUY',
      strength:
        'HIGH',
    };
  }

  if (score >= 65) {
    return {
      signal:
        'BUY',
      strength:
        'MEDIUM',
    };
  }

  if (score >= 50) {
    return {
      signal:
        'NEUTRAL',
      strength:
        'LOW',
    };
  }

  return {
    signal:
      'AVOID',
    strength:
      'LOW',
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
   US EQUITY
========================================================= */

function isUsEquity(meta) {
  const quoteType =
    String(
      meta?.quoteType ||
        meta?.instrumentType ||
        ''
    ).toUpperCase();

  if (
    quoteType !== 'EQUITY'
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

  /*
   * Yahoo sometimes omits the full exchange.
   * New York timezone is used only as fallback.
   */
  return (
    meta?.exchangeTimezoneName ===
    'America/New_York'
  );
}

/* =========================================================
   ANALYTICS
========================================================= */

function analyzeQuote(
  meta,
  quote
) {
  const closes =
    (quote?.close || [])
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

  const volumes =
    (quote?.volume || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const opens =
    (quote?.open || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  if (
    closes.length <
    MIN_HISTORY
  ) {
    return {
      technicalReady:
        false,

      dataQuality:
        'بيانات تاريخية غير كافية',

      price:
        num(
          meta?.regularMarketPrice
        ),

      technicalScore:
        null,

      discoveryScore:
        null,

      institutionalScore:
        null,

      setupScore:
        null,

      signal:
        'NEUTRAL',

      signalStrength:
        'LOW',
    };
  }

  const price =
    num(
      meta?.regularMarketPrice,
      closes.at(-1)
    );

  const previousClose =
    num(
      meta?.previousClose ??
        meta?.chartPreviousClose,
      closes.at(-2)
    );

  const volume =
    num(
      meta?.regularMarketVolume,
      volumes.at(-1)
    );

  if (
    !price ||
    !previousClose
  ) {
    return {
      technicalReady:
        false,

      dataQuality:
        'السعر أو الإغلاق السابق غير متاح',

      price:
        price || null,

      previousClose:
        previousClose || null,

      technicalScore:
        null,

      discoveryScore:
        null,

      institutionalScore:
        null,

      setupScore:
        null,

      signal:
        'NEUTRAL',

      signalStrength:
        'LOW',
    };
  }

  const open =
    opens.at(-1) ||
    previousClose ||
    price;

  const change =
    price -
    previousClose;

  const changePercent =
    (change /
      previousClose) *
    100;

  const gapPercent =
    previousClose
      ? ((open -
          previousClose) /
          previousClose) *
        100
      : null;

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

  const ema12 =
    calculateEMA(
      closes,
      12
    );

  const ema26 =
    calculateEMA(
      closes,
      26
    );

  const rsi =
    calculateRSI(
      closes,
      14
    );

  const momentum =
    calculateMomentum(
      closes,
      5
    );

  const volumeMetrics =
    calculateVolumeMetrics(
      volumes,
      volume || 0,
      20
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
      closes
    );

  const rsiScore =
    calculateRsiScore(
      rsi
    );

  const bollinger =
    calculateBollinger(
      closes,
      20
    );

  const cluster =
    calculateCluster(
      price,
      highs,
      lows,
      volumeMetrics.relativeVolume
    );

  const levels =
    calculateLevels(
      highs,
      lows,
      closes
    );

  const riskReward =
    calculateRiskReward(
      price,
      levels.support,
      levels.resistance
    );

  const resistanceDistance =
    levels.resistance &&
    price
      ? ((levels.resistance -
          price) /
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
    calculateScore({
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

  /*
   * Market-data is the technical engine.
   * Discovery must never inflate the technical score.
   */
  const setupScore =
    technicalScore;

  const signal =
    getSignal(
      setupScore
    );

  const marketState =
    getMarketState(
      price,
      sma20,
      sma50
    );

  const currentHigh =
    highs.at(-1) ||
    price;

  const currentLow =
    lows.at(-1) ||
    price;

  const macd =
    ema12 != null &&
    ema26 != null
      ? ema12 - ema26
      : null;

  return {
    technicalReady:
      true,

    dataQuality:
      'بيانات فنية مكتملة',

    price:
      round(
        price,
        4
      ),

    previousClose:
      round(
        previousClose,
        4
      ),

    change:
      round(
        change,
        4
      ),

    changePercent:
      round(
        changePercent
      ),

    gapPercent:
      round(
        gapPercent
      ),

    open:
      round(
        open,
        4
      ),

    volume,

    averageVolume20:
      volumeMetrics.averageVolume !=
      null
        ? Math.round(
            volumeMetrics.averageVolume
          )
        : null,

    relativeVolume:
      round(
        volumeMetrics.relativeVolume,
        2
      ),

    momentumPercent:
      round(
        momentum.percent
      ),

    momentum:
      Math.round(
        momentum.score
      ),

    momentumScore:
      Math.round(
        momentum.score
      ),

    volumeScore:
      Math.round(
        volumeMetrics.volumeScore
      ),

    liquidityScore:
      Math.round(
        volumeMetrics.liquidityScore
      ),

    trendScore:
      Math.round(
        trendScore
      ),

    breakout:
      Math.round(
        breakout.score
      ),

    breakoutScore:
      Math.round(
        breakout.score
      ),

    rsi:
      round(
        rsi
      ),

    rsiScore:
      Math.round(
        rsiScore
      ),

    sma20:
      round(
        sma20
      ),

    sma50:
      round(
        sma50
      ),

    ema12:
      round(
        ema12
      ),

    ema26:
      round(
        ema26
      ),

    macd:
      round(
        macd
      ),

    resistance20:
      round(
        levels.resistance
      ),

    support20:
      round(
        levels.support
      ),

    resistanceDistancePercent:
      round(
        resistanceDistance
      ),

    resistanceDistance:
      round(
        resistanceDistance
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

    discoveryScore:
      null,

    institutionalScore:
      null,

    setupScore,

    signal:
      signal.signal,

    signalStrength:
      signal.strength,

    marketState,

    dayHigh:
      round(
        currentHigh
      ),

    dayLow:
      round(
        currentLow
      ),

    currency:
      meta?.currency ||
      'USD',

    quoteType:
      meta?.quoteType ||
      null,

    exchange:
      meta?.fullExchangeName ||
      meta?.exchangeName ||
      null,

    dataAvailability: {
      price: true,
      volume: true,
      technicals: true,
      options: false,
      darkPool: false,
      institutionalFlow:
        false,
    },
  };
}

/* =========================================================
   YAHOO CHART
========================================================= */

async function fetchChart(
  symbol,
  range = '6mo'
) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (
    !isValidSymbol(clean)
  ) {
    throw new Error(
      'رمز سهم غير صالح'
    );
  }

  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(clean)}` +
    `?interval=1d&range=${encodeURIComponent(
      range
    )}&events=div%2Csplits`;

  const response =
    await fetch(
      url,
      {
        headers:
          YAHOO_HEADERS,
        cache:
          'no-store',
        signal:
          AbortSignal.timeout(
            8000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance ${response.status} for ${clean}`
    );
  }

  const json =
    await response.json();

  const result =
    json?.chart?.result?.[0];

  if (!result?.meta) {
    throw new Error(
      `No market data for ${clean}`
    );
  }

  return {
    symbol:
      result.meta.symbol ||
      clean,

    meta:
      result.meta,

    timestamps:
      result.timestamp ||
      [],

    quote:
      result.indicators
        ?.quote?.[0] ||
      {},
  };
}

/* =========================================================
   TRENDING DISCOVERY
========================================================= */

async function fetchTrending(
  count = DISCOVERY_COUNT
) {
  const safeCount =
    Math.min(
      Math.max(
        Number(count) || 30,
        1
      ),
      50
    );

  const url =
    `https://query1.finance.yahoo.com/v1/finance/trending/US?count=${safeCount}`;

  const response =
    await fetch(
      url,
      {
        headers:
          YAHOO_HEADERS,
        cache:
          'no-store',
        signal:
          AbortSignal.timeout(
            8000
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Yahoo Trending ${response.status}`
    );
  }

  const json =
    await response.json();

  return (
    json?.finance
      ?.result?.[0]
      ?.quotes || []
  )
    .map(
      (item) =>
        String(
          item?.symbol || ''
        )
          .trim()
          .toUpperCase()
    )
    .filter(
      isValidSymbol
    );
}

/* =========================================================
   MARKET UNIVERSE
========================================================= */

async function getMarketUniverse() {
  const trending =
    await fetchTrending(
      DISCOVERY_COUNT
    );

  const symbols = [
    ...new Set(
      trending
    ),
  ].slice(
    0,
    MAX_UNIVERSE
  );

  /*
   * Controlled concurrency.
   * Do not fire all Yahoo requests simultaneously.
   */
  const concurrency = 5;
  const results = [];

  for (
    let i = 0;
    i < symbols.length;
    i += concurrency
  ) {
    const batch =
      symbols.slice(
        i,
        i + concurrency
      );

    const settled =
      await Promise.allSettled(
        batch.map(
          (symbol) =>
            fetchChart(
              symbol,
              '6mo'
            )
        )
      );

    for (
      let index = 0;
      index <
      settled.length;
      index += 1
    ) {
      const item =
        settled[index];

      if (
        item.status !==
        'fulfilled'
      ) {
        continue;
      }

      const chart =
        item.value;

      if (
        !isUsEquity(
          chart.meta
        )
      ) {
        continue;
      }

      const analytics =
        analyzeQuote(
          chart.meta,
          chart.quote
        );

      if (
        !analytics.technicalReady
      ) {
        continue;
      }

      /*
       * Basic market gate.
       */
      if (
        analytics.price == null ||
        analytics.price <=
          MIN_PRICE ||
        analytics.price >=
          MAX_PRICE
      ) {
        continue;
      }

      if (
        analytics.averageVolume20 ==
          null ||
        analytics.averageVolume20 <
          MIN_VOLUME
      ) {
        continue;
      }

      if (
        analytics.relativeVolume ==
          null
      ) {
        continue;
      }

      results.push({
        symbol:
          chart.symbol,

        quoteType:
          chart.meta?.quoteType ||
          null,

        exchange:
          chart.meta
            ?.fullExchangeName ||
          chart.meta
            ?.exchangeName ||
          null,

        ...analytics,
      });
    }
  }

  results.sort(
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

  return results;
}

/* =========================================================
   SINGLE STOCK
========================================================= */

async function getSingleStock(
  symbol
) {
  const chart =
    await fetchChart(
      symbol,
      '6mo'
    );

  if (
    !isUsEquity(
      chart.meta
    )
  ) {
    throw new Error(
      'الرمز ليس سهماً أمريكياً'
    );
  }

  const analytics =
    analyzeQuote(
      chart.meta,
      chart.quote
    );

  return {
    symbol:
      chart.symbol,

    quoteType:
      chart.meta?.quoteType ||
      null,

    exchange:
      chart.meta
        ?.fullExchangeName ||
      chart.meta
        ?.exchangeName ||
      null,

    ...analytics,
  };
}

/* =========================================================
   API
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

    if (
      requestedSymbol &&
      !isValidSymbol(
        requestedSymbol
      )
    ) {
      return NextResponse.json(
        {
          status:
            'error',

          error:
            'رمز السهم غير صالح',
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * SINGLE STOCK
     * /api/market-data?symbol=SOFI
     * =====================================================
     */

    if (
      requestedSymbol
    ) {
      const data =
        await getSingleStock(
          requestedSymbol
        );

      return NextResponse.json(
        {
          status:
            'success',

          timestamp:
            new Date().toISOString(),

          count: 1,

          data: [
            data,
          ],

          source:
            'Yahoo Finance Chart',

          dataAvailability: {
            price: true,
            volume: true,
            technicals:
              Boolean(
                data.technicalReady
              ),
            options: false,
            darkPool: false,
            institutionalFlow:
              false,
          },

          limitations:
            'Options وDark Pool وInstitutional Flow غير متاحة من مصدر البيانات الحالي.',
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
     * MARKET UNIVERSE
     * /api/market-data
     * =====================================================
     */

    const data =
      await getMarketUniverse();

    return NextResponse.json(
      {
        status:
          'success',

        timestamp:
          new Date().toISOString(),

        count:
          data.length,

        data,

        universe:
          'Yahoo Finance US trending equities — $0.50 < price < $100 — average volume >= 100K',

        source:
          'Yahoo Finance Chart + Trending',

        marketGate: {
          minPrice:
            MIN_PRICE,

          maxPrice:
            MAX_PRICE,

          minimumAverageVolume:
            MIN_VOLUME,

          minimumHistory:
            MIN_HISTORY,
        },

        scoring: {
          technical:
            '100%',

          discovery:
            '0%',

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
          'هذا endpoint مسؤول عن بيانات السوق والتحليل الفني فقط. لا يتم اعتبار Trending دليلاً على تدفق مؤسسي، ولا يتم اختلاق Options أو Dark Pool أو Institutional Flow.',
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
      'Market Data API Error:',
      error
    );

    return NextResponse.json(
      {
        status:
          'error',

        timestamp:
          new Date().toISOString(),

        count: 0,

        data: [],

        error:
          'تعذر جلب بيانات السوق حالياً',

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
