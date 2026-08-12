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
  if (!Number.isFinite(n)) return min;

  return Math.max(min, Math.min(max, n));
}

function round(value, decimals = 2) {
  const n = Number(value);

  if (!Number.isFinite(n)) return null;

  return Number(n.toFixed(decimals));
}

function isValidSymbol(symbol) {
  return /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
    String(symbol || '')
  );
}

function calculateSMA(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return null;
  }

  return average(values.slice(-period));
}

function calculateEMA(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);

  let ema = average(values.slice(0, period));

  if (ema == null) return null;

  for (let i = period; i < values.length; i += 1) {
    ema =
      (values[i] - ema) * multiplier +
      ema;
  }

  return ema;
}

function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];

    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];

    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    avgGain =
      ((avgGain * (period - 1)) + gain) /
      period;

    avgLoss =
      ((avgLoss * (period - 1)) + loss) /
      period;
  }

  if (avgLoss === 0) {
    return 100;
  }

  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateMomentum(closes, period = 5) {
  if (!Array.isArray(closes) || closes.length <= period) {
    return {
      percent: null,
      score: 50,
    };
  }

  const current = closes.at(-1);
  const previous = closes.at(-(period + 1));

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
    ((current - previous) / previous) * 100;

  return {
    percent,
    score: clamp(50 + percent * 8),
  };
}

function calculateVolumeMetrics(
  volumes,
  currentVolume,
  period = 20
) {
  if (!Array.isArray(volumes) || !volumes.length) {
    return {
      averageVolume: null,
      relativeVolume: null,
      volumeScore: 0,
      liquidityScore: 0,
    };
  }

  const previousVolumes =
    volumes.length > period
      ? volumes.slice(-(period + 1), -1)
      : volumes.slice(-period);

  const averageVolume =
    average(previousVolumes);

  const relativeVolume =
    averageVolume > 0 &&
    Number.isFinite(currentVolume)
      ? currentVolume / averageVolume
      : null;

  const volumeScore =
    relativeVolume != null
      ? clamp(
          45 +
            (relativeVolume - 1) * 35
        )
      : 50;

  let liquidityScore = 25;

  if (averageVolume >= 1_000_000) {
    liquidityScore = 100;
  } else if (averageVolume >= 500_000) {
    liquidityScore = 85;
  } else if (averageVolume >= 250_000) {
    liquidityScore = 70;
  } else if (averageVolume >= 100_000) {
    liquidityScore = 55;
  }

  return {
    averageVolume,
    relativeVolume,
    volumeScore,
    liquidityScore,
  };
}

function calculateTrendScore(price, sma20, sma50) {
  if (!price || !sma20 || !sma50) {
    return 50;
  }

  let score = 50;

  if (price > sma20) score += 15;
  if (price > sma50) score += 20;
  if (sma20 > sma50) score += 15;

  const distance =
    ((price - sma50) / sma50) * 100;

  score += clamp(
    distance * 2,
    -20,
    20
  );

  return clamp(score);
}

function calculateRsiScore(rsi) {
  if (rsi == null) return 50;

  if (rsi >= 45 && rsi <= 65) return 100;
  if (rsi > 65 && rsi <= 70) return 85;
  if (rsi >= 35 && rsi < 45) return 75;
  if (rsi > 70) return 45;
  if (rsi < 30) return 55;

  return 65;
}

function calculateBollinger(closes, period = 20) {
  if (!Array.isArray(closes) || closes.length < period) {
    return {
      middle: null,
      upper: null,
      lower: null,
      bandwidth: null,
      squeeze: false,
      score: 0,
    };
  }

  const slice = closes.slice(-period);
  const middle = average(slice);

  if (!middle || middle <= 0) {
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

  const stdDev = Math.sqrt(variance);

  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;

  const bandwidth =
    ((upper - lower) / middle) * 100;

  let score = 20;

  if (bandwidth < 5) score = 100;
  else if (bandwidth < 7) score = 90;
  else if (bandwidth < 9) score = 75;
  else if (bandwidth < 12) score = 50;

  return {
    middle,
    upper,
    lower,
    bandwidth,
    squeeze: bandwidth < 9,
    score,
  };
}

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

  const recentHighs = highs.slice(-5);
  const recentLows = lows.slice(-5);

  const high = Math.max(...recentHighs);
  const low = Math.min(...recentLows);

  const rangePercent =
    ((high - low) / price) * 100;

  const isCluster =
    rangePercent <= 3.5 &&
    Number(relativeVolume || 0) >= 1.1;

  let score = 25;

  if (rangePercent <= 2) score = 100;
  else if (rangePercent <= 3.5) score = 85;
  else if (rangePercent <= 5) score = 60;

  if (Number(relativeVolume || 0) >= 1.5) {
    score += 10;
  }

  return {
    isCluster,
    rangePercent,
    score: clamp(score),
  };
}

function calculateBreakout(price, closes) {
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
    Math.max(...closes.slice(-21, -1));

  if (!Number.isFinite(priorHigh) || priorHigh <= 0) {
    return {
      distancePercent: null,
      score: 50,
      priorHigh: null,
    };
  }

  const distancePercent =
    ((priorHigh - price) / price) * 100;

  let score = 25;

  if (distancePercent <= 0) score = 100;
  else if (distancePercent <= 1) score = 95;
  else if (distancePercent <= 2) score = 88;
  else if (distancePercent <= 4) score = 75;
  else if (distancePercent <= 6) score = 60;
  else if (distancePercent <= 10) score = 45;

  return {
    distancePercent,
    score,
    priorHigh,
  };
}

function calculateLevels(highs, lows, closes) {
  const resistance =
    highs.length >= 21
      ? Math.max(...highs.slice(-21, -1))
      : closes.length >= 21
        ? Math.max(...closes.slice(-21, -1))
        : null;

  const support =
    lows.length >= 21
      ? Math.min(...lows.slice(-21, -1))
      : closes.length >= 21
        ? Math.min(...closes.slice(-21, -1))
        : null;

  return {
    resistance,
    support,
  };
}

function calculateRiskReward(
  price,
  support,
  resistance
) {
  if (!price || !support || !resistance) {
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

  const risk = price - stopLoss;
  const reward = resistance - price;

  if (risk <= 0 || reward <= 0) {
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

  const riskReward = reward / risk;

  let score = 25;

  if (riskReward >= 3) score = 100;
  else if (riskReward >= 2.5) score = 90;
  else if (riskReward >= 2) score = 80;
  else if (riskReward >= 1.5) score = 65;
  else if (riskReward >= 1) score = 45;

  return {
    stopLoss: round(stopLoss),
    targetPrice: round(resistance),
    riskPercent: round(
      (risk / price) * 100
    ),
    rewardPercent: round(
      (reward / price) * 100
    ),
    riskReward: round(riskReward),
    score,
  };
}

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

  return Math.round(clamp(raw));
}

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

function getMarketState(price, sma20, sma50) {
  if (!price || !sma20 || !sma50) {
    return 'UNKNOWN';
  }

  if (price > sma20 && sma20 > sma50) {
    return 'BULLISH';
  }

  if (price < sma20 && sma20 < sma50) {
    return 'BEARISH';
  }

  return 'MIXED';
}

function isUsEquity(meta) {
  const quoteType =
    String(
      meta?.quoteType ||
        meta?.instrumentType ||
        ''
    ).toUpperCase();

  if (quoteType !== 'EQUITY') {
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

function analyzeQuote(meta, quote) {
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

  const opens =
    (quote?.open || [])
      .map(Number)
      .filter(Number.isFinite);

  if (closes.length < MIN_HISTORY) {
    return {
      technicalReady: false,
      dataQuality: 'بيانات تاريخية غير كافية',
      price: num(meta?.regularMarketPrice),
      technicalScore: null,
      discoveryScore: null,
      institutionalScore: null,
      setupScore: null,
      signal: 'NEUTRAL',
      signalStrength: 'LOW',
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

  if (!price || !previousClose) {
    return {
      technicalReady: false,
      dataQuality:
        'السعر أو الإغلاق السابق غير متاح',
      price: price || null,
      previousClose:
        previousClose || null,
      technicalScore: null,
      discoveryScore: null,
      institutionalScore: null,
      setupScore: null,
      signal: 'NEUTRAL',
      signalStrength: 'LOW',
    };
  }

  const open =
    opens.at(-1) ||
    previousClose ||
    price;

  const change =
    price - previousClose;

  const changePercent =
    (change / previousClose) * 100;

  const gapPercent =
    previousClose
      ? ((open - previousClose) /
          previousClose) *
        100
      : null;

  const sma20 =
    calculateSMA(closes, 20);

  const sma50 =
    calculateSMA(closes, 50);

  const ema12 =
    calculateEMA(closes, 12);

  const ema26 =
    calculateEMA(closes, 26);

  const rsi =
    calculateRSI(closes, 14);

  const momentum =
    calculateMomentum(closes, 5);

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
    calculateRsiScore(rsi);

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
      ? ((levels.resistance - price) /
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
      momentumScore: momentum.score,
      volumeScore:
        volumeMetrics.volumeScore,
      trendScore,
      breakoutScore: breakout.score,
      rsiScore,
      squeezeScore:
        bollinger.score,
      clusterScore:
        cluster.score,
      riskScore:
        riskReward.score,
      resistancePenalty,
    });

  const setupScore =
    technicalScore;

  const signal =
    getSignal(setupScore);

  const marketState =
    getMarketState(
      price,
      sma20,
      sma50
    );

  const currentHigh =
    highs.at(-1) || price;

  const currentLow =
    lows.at(-1) || price;

  const macd =
    ema12 != null &&
    ema26 != null
      ? ema12 - ema26
      : null;

  return {
    technicalReady: true,
    dataQuality:
      'بيانات فنية مكتملة',

    price: round(price, 4),
    previousClose:
      round(previousClose, 4),

    change: round(change, 4),
    changePercent:
      round(changePercent),

    gapPercent:
      round(gapPercent),

    open:
      round(open, 4),

    volume,

    averageVolume20:
      volumeMetrics.averageVolume != null
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
      round(momentum.percent),

    momentum:
      Math.round(momentum.score),

    momentumScore:
      Math.round(momentum.score),

    volumeScore:
      Math.round(
        volumeMetrics.volumeScore
      ),

    liquidityScore:
      Math.round(
        volumeMetrics.liquidityScore
      ),

    trendScore:
      Math.round(trendScore),

    breakout:
      Math.round(breakout.score),

    breakoutScore:
      Math.round(breakout.score),

    rsi:
      round(rsi),

    rsiScore:
      Math.round(rsiScore),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

    ema12:
      round(ema12),

    ema26:
      round(ema26),

    macd:
      round(macd),

    resistance20:
      round(levels.resistance),

    support20:
      round(levels.support),

    resistanceDistancePercent:
      round(resistanceDistance),

    resistanceDistance:
      round(resistanceDistance),

    squeeze:
      bollinger.squeeze,

    bollingerBandwidth:
      round(bollinger.bandwidth),

    squeezeScore:
      Math.round(bollinger.score),

    cluster:
      cluster.isCluster,

    clusterRangePercent:
      round(cluster.rangePercent),

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

    discoveryScore: null,

    institutionalScore: null,

    setupScore,

    signal:
      signal.signal,

    signalStrength:
      signal.strength,

    marketState,

    dayHigh:
      round(currentHigh),

    dayLow:
      round(currentLow),

    currency:
      meta?.currency || 'USD',

    quoteType:
      meta?.quoteType || null,

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
      institutionalFlow: false,
    },
  };
}

/* =========================================================
   MARKET DATA PROVIDERS
========================================================= */

const FINNHUB_API_KEY =
  process.env.FINNHUB_API_KEY || '';

const REQUEST_TIMEOUT_MS = 8000;
const HISTORY_DAYS = 180;

function withTimeout(
  promise,
  ms = REQUEST_TIMEOUT_MS
) {
  return Promise.race([
    promise,

    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Provider timeout'
            )
          ),
        ms
      )
    ),
  ]);
}

function getUnixRange(
  days = HISTORY_DAYS
) {
  const to =
    Math.floor(
      Date.now() / 1000
    );

  const from =
    to -
    days *
      24 *
      60 *
      60;

  return {
    from,
    to,
  };
}

async function fetchFinnhubCandles(
  symbol
) {
  if (!FINNHUB_API_KEY) {
    throw new Error(
      'FINNHUB_API_KEY is not configured'
    );
  }

  const {
    from,
    to,
  } = getUnixRange();

  const url =
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
      symbol
    )}` +
    `&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(
      FINNHUB_API_KEY
    )}`;

  const response =
    await withTimeout(
      fetch(url, {
        headers: {
          Accept:
            'application/json',
        },
        cache: 'no-store',
      })
    );

  if (!response.ok) {
    throw new Error(
      `Finnhub Candle ${response.status}`
    );
  }

  const json =
    await response.json();

  if (
    json?.s !== 'ok' ||
    !Array.isArray(json?.c) ||
    json.c.length < MIN_HISTORY
  ) {
    throw new Error(
      `Finnhub returned incomplete candle data for ${symbol}`
    );
  }

  const closes =
    json.c
      .map(Number)
      .filter(
        Number.isFinite
      );

  const highs =
    (json.h || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const lows =
    (json.l || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const opens =
    (json.o || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const volumes =
    (json.v || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

  const price =
    closes.at(-1);

  const previousClose =
    closes.at(-2);

  const volume =
    volumes.at(-1) || 0;

  return {
    symbol,

    meta: {
      symbol,
      quoteType:
        'EQUITY',

      instrumentType:
        'EQUITY',

      currency:
        'USD',

      exchange:
        'Finnhub',

      fullExchangeName:
        'Finnhub US Equity',

      exchangeName:
        'Finnhub',

      regularMarketPrice:
        price,

      previousClose,

      chartPreviousClose:
        previousClose,

      regularMarketVolume:
        volume,

      marketState:
        'UNKNOWN',
    },

    timestamps:
      json.t || [],

    quote: {
      close: closes,
      high: highs,
      low: lows,
      open: opens,
      volume: volumes,
    },

    source:
      'Finnhub',
  };
}

async function fetchYahooChart(
  symbol,
  range = '6mo'
) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (!isValidSymbol(clean)) {
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
    await withTimeout(
      fetch(url, {
        headers:
          YAHOO_HEADERS,
        cache: 'no-store',
      })
    );

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance ${response.status} for ${clean}`
    );
  }

  const json =
    await response.json();

  const result =
    json?.chart
      ?.result?.[0];

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
      result.timestamp || [],

    quote:
      result.indicators
        ?.quote?.[0] || {},

    source:
      'Yahoo Finance',
  };
}

async function fetchMarketData(
  symbol
) {
  /*
   * Finnhub = PRIMARY
   * Yahoo = FALLBACK ONLY
   *
   * No fabricated market values.
   */

  try {
    const data =
      await fetchFinnhubCandles(
        symbol
      );

    return {
      ...data,

      providerStatus: {
        primary:
          'Finnhub',

        used:
          'Finnhub',

        fallbackUsed:
          false,
      },
    };
  } catch (
    finnhubError
  ) {
    try {
      const data =
        await fetchYahooChart(
          symbol
        );

      return {
        ...data,

        providerStatus: {
          primary:
            'Finnhub',

          used:
            'Yahoo',

          fallbackUsed:
            true,

          primaryError:
            process.env.NODE_ENV ===
            'development'
              ? finnhubError?.message
              : undefined,
        },
      };
    } catch (
      yahooError
    ) {
      throw new Error(
        `Market data unavailable for ${symbol}: ` +
          `${
            finnhubError?.message ||
            'Finnhub failed'
          }; ` +
          `${
            yahooError?.message ||
            'Yahoo fallback failed'
          }`
      );
    }
  }
}

async function fetchYahooTrending(
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
    await withTimeout(
      fetch(url, {
        headers:
          YAHOO_HEADERS,
        cache: 'no-store',
      })
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

function getConfiguredUniverse() {
  return [
    ...new Set(
      String(
        process.env.HUNTER_UNIVERSE ||
          ''
      )
        .split(',')
        .map(
          (symbol) =>
            symbol
              .trim()
              .toUpperCase()
        )
        .filter(
          isValidSymbol
        )
    ),
  ];
}

async function getDiscoverySymbols() {
  const configured =
    getConfiguredUniverse();

  if (configured.length) {
    return {
      symbols:
        configured.slice(
          0,
          MAX_UNIVERSE
        ),

      source:
        'HUNTER_UNIVERSE',

      fallback:
        false,
    };
  }

  /*
   * Yahoo Trending is discovery only.
   * It is NOT institutional flow.
   */

  const trending =
    await fetchYahooTrending(
      DISCOVERY_COUNT
    );

  return {
    symbols:
      [
        ...new Set(
          trending
        ),
      ].slice(
        0,
        MAX_UNIVERSE
      ),

    source:
      'Yahoo Trending fallback',

    fallback:
      true,
  };
}

async function getMarketUniverse() {
  const discovery =
    await getDiscoverySymbols();

  const symbols =
    discovery.symbols;

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
            fetchMarketData(
              symbol
            )
        )
      );

    for (
      const item of settled
    ) {
      if (
        item.status !==
        'fulfilled'
      ) {
        continue;
      }

      const chart =
        item.value;

      if (
        chart.source ===
          'Yahoo Finance' &&
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
        !analytics.technicalReady ||
        analytics.price == null ||
        analytics.price <= MIN_PRICE ||
        analytics.price >= MAX_PRICE ||
        analytics.averageVolume20 == null ||
        analytics.averageVolume20 < MIN_VOLUME ||
        analytics.relativeVolume == null
      ) {
        continue;
      }

      results.push({
        symbol:
          chart.symbol,

        quoteType:
          chart.meta
            ?.quoteType ||
          'EQUITY',

        exchange:
          chart.meta
            ?.fullExchangeName ||
          chart.meta
            ?.exchangeName ||
          null,

        source:
          chart.source,

        providerStatus:
          chart.providerStatus || {
            primary:
              'Finnhub',

            used:
              chart.source,

            fallbackUsed:
              chart.source !==
              'Finnhub',
          },

        ...analytics,
      });
    }
  }

  results.sort(
    (a, b) => {
      const scoreDiff =
        (b.setupScore ?? -1) -
        (a.setupScore ?? -1);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (
        (b.relativeVolume ?? 0) -
        (a.relativeVolume ?? 0)
      );
    }
  );

  return {
    data:
      results,

    discoverySource:
      discovery.source,

    discoveryFallback:
      discovery.fallback,
  };
}

async function getSingleStock(
  symbol
) {
  const chart =
    await fetchMarketData(
      symbol
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

    source:
      chart.source,

    providerStatus:
      chart.providerStatus || {
        primary:
          'Finnhub',

        used:
          chart.source,

        fallbackUsed:
          chart.source !==
          'Finnhub',
      },

    ...analytics,
  };
}

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
     * SINGLE STOCK
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
            data.source,

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
     * MARKET UNIVERSE
     */

    const universe =
      await getMarketUniverse();

    return NextResponse.json(
      {
        status:
          'success',

        timestamp:
          new Date().toISOString(),

        count:
          universe.data.length,

        data:
          universe.data,

        universe:
          'HUNTER_UNIVERSE preferred; Yahoo Trending discovery fallback — $0.50 < price < $100 — average volume >= 100K',

        discoverySource:
          universe.discoverySource,

        discoveryFallback:
          universe.discoveryFallback,

        source:
          'Finnhub primary + Yahoo fallback',

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
          'Finnhub هو المصدر الأساسي لبيانات السوق، وYahoo fallback عند فشل Finnhub. Yahoo Trending يستخدم للاكتشاف فقط عند غياب HUNTER_UNIVERSE. لا يتم اختلاق Options أو Dark Pool أو Institutional Flow.',
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