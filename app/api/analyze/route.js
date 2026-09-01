
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const MIN_HISTORY = 60;
const MIN_PRICE = 0.5;
const MAX_PRICE = 100;
const MIN_AVG_VOLUME = 100000;

/* =========================================================
   AI
========================================================= */

function getAI() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: key,
  });
}

/* =========================================================
   HELPERS
========================================================= */

function finite(value, fallback = null) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}

function average(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const valid = values.filter(
    Number.isFinite
  );

  if (!valid.length) {
    return null;
  }

  return (
    valid.reduce(
      (sum, value) => sum + value,
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

function validSymbol(symbol) {
  return /^[A-Z][A-Z0-9.^=-]{0,11}$/.test(
    symbol || ''
  );
}

/* =========================================================
   SMA
========================================================= */

function calculateSMA(
  values,
  period
) {
  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return null;
  }

  return average(
    values.slice(-period)
  );
}

/* =========================================================
   EMA
========================================================= */

function calculateEMA(
  values,
  period
) {
  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return null;
  }

  const multiplier =
    2 / (period + 1);

  let ema =
    average(
      values.slice(
        0,
        period
      )
    );

  for (
    let i = period;
    i < values.length;
    i += 1
  ) {
    ema =
      (values[i] - ema) *
        multiplier +
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
      losses += Math.abs(
        delta
      );
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
   MACD
========================================================= */

function calculateMACD(
  closes
) {
  if (
    !Array.isArray(closes) ||
    closes.length < 40
  ) {
    return {
      macd: null,
      signal: null,
      histogram: null,
      bullish: false,
      cross: false,
    };
  }

  const macdSeries = [];

  /*
   * نبني MACD التاريخي مرة واحدة
   * بدل إعادة حساب EMA من البداية
   * داخل كل دورة.
   */

  let ema12 = null;
  let ema26 = null;

  const multiplier12 =
    2 / 13;

  const multiplier26 =
    2 / 27;

  for (
    let i = 0;
    i < closes.length;
    i += 1
  ) {
    if (i === 11) {
      ema12 =
        average(
          closes.slice(
            0,
            12
          )
        );
    } else if (i > 11) {
      ema12 =
        (closes[i] -
          ema12) *
          multiplier12 +
        ema12;
    }

    if (i === 25) {
      ema26 =
        average(
          closes.slice(
            0,
            26
          )
        );
    } else if (i > 25) {
      ema26 =
        (closes[i] -
          ema26) *
          multiplier26 +
        ema26;
    }

    if (
      ema12 != null &&
      ema26 != null
    ) {
      macdSeries.push(
        ema12 - ema26
      );
    }
  }

  if (
    macdSeries.length < 9
  ) {
    return {
      macd: null,
      signal: null,
      histogram: null,
      bullish: false,
      cross: false,
    };
  }

  const signalLine =
    calculateEMA(
      macdSeries,
      9
    );

  const macd =
    macdSeries.at(-1);

  const previousMacd =
    macdSeries.at(-2);

  const previousSignal =
    macdSeries.length >= 10
      ? calculateEMA(
          macdSeries.slice(
            0,
            -1
          ),
          9
        )
      : null;

  const histogram =
    signalLine != null
      ? macd -
        signalLine
      : null;

  const cross =
    previousMacd != null &&
    previousSignal != null &&
    macd > signalLine &&
    previousMacd <=
      previousSignal;

  return {
    macd,
    signal:
      signalLine,
    histogram,
    bullish:
      histogram != null &&
      histogram > 0,
    cross,
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
    !Number.isFinite(
      current
    ) ||
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
    finite(
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

  if (
    average20 >=
    1000000
  ) {
    liquidityScore = 100;
  } else if (
    average20 >=
    500000
  ) {
    liquidityScore = 85;
  } else if (
    average20 >=
    250000
  ) {
    liquidityScore = 70;
  } else if (
    average20 >=
    100000
  ) {
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
    closes.slice(
      -period
    );

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
        value =>
          (value -
            middle) ** 2
      )
    ) || 0;

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

  let score = 20;

  if (
    bandwidth < 5
  ) {
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

  if (
    price > sma20
  ) {
    score += 15;
  }

  if (
    price > sma50
  ) {
    score += 20;
  }

  if (
    sma20 > sma50
  ) {
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

  if (
    distance <= 0
  ) {
    score = 100;
  } else if (
    distance <= 1
  ) {
    score = 95;
  } else if (
    distance <= 2
  ) {
    score = 88;
  } else if (
    distance <= 4
  ) {
    score = 75;
  } else if (
    distance <= 6
  ) {
    score = 60;
  } else if (
    distance <= 10
  ) {
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

function calculateRSIScore(
  rsi
) {
  if (
    rsi == null
  ) {
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

  if (
    rsi > 70
  ) {
    return 45;
  }

  if (
    rsi < 30
  ) {
    return 55;
  }

  return 65;
}

/* =========================================================
   SUPPORT / RESISTANCE
========================================================= */

function calculateLevels(
  highs,
  lows,
  lookback = 20
) {
  if (
    highs.length <
      lookback + 1 ||
    lows.length <
      lookback + 1
  ) {
    return {
      resistance: null,
      support: null,
    };
  }

  const resistance =
    Math.max(
      ...highs.slice(
        -(lookback + 1),
        -1
      )
    );

  const support =
    Math.min(
      ...lows.slice(
        -(lookback + 1),
        -1
      )
    );

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
      round(
        riskReward
      ),

    score,
  };
}

/* =========================================================
   FINAL TECHNICAL SCORE
========================================================= */

function calculateTechnicalScore({
  momentum,
  volume,
  trend,
  breakout,
  rsi,
  squeeze,
  macd,
  risk,
  liquidity,
  resistancePenalty,
}) {
  /*
   * الوزن الرسمي:
   *
   * Momentum       15%
   * Volume         15%
   * Trend          15%
   * Breakout       15%
   * RSI            10%
   * Bollinger      10%
   * MACD            5%
   * Risk/Reward    10%
   * Liquidity       5%
   *
   * = 100%
   */

  const raw =
    momentum * 0.15 +
    volume * 0.15 +
    trend * 0.15 +
    breakout * 0.15 +
    rsi * 0.10 +
    squeeze * 0.10 +
    macd * 0.05 +
    risk * 0.10 +
    liquidity * 0.05 -
    resistancePenalty;

  return Math.round(
    clamp(raw)
  );
}

/* =========================================================
   SIGNAL
========================================================= */

function getSignal(
  score
) {
  if (
    score >= 85
  ) {
    return {
      signal:
        'STRONG_BUY',
      strength:
        'HIGH',
    };
  }

  if (
    score >= 75
  ) {
    return {
      signal:
        'BUY',
      strength:
        'HIGH',
    };
  }

  if (
    score >= 65
  ) {
    return {
      signal:
        'BUY',
      strength:
        'MEDIUM',
    };
  }

  if (
    score >= 50
  ) {
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
   BUILD METRICS
========================================================= */

function buildMetrics(
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
    throw new Error(
      'بيانات تاريخية غير كافية للتحليل الفني'
    );
  }

  const price =
    finite(
      meta?.regularMarketPrice,
      closes.at(-1)
    );

  const previousClose =
    finite(
      meta?.previousClose ??
        meta?.chartPreviousClose,
      closes.at(-2)
    );

  const volume =
    finite(
      meta?.regularMarketVolume,
      volumes.at(-1)
    );

  const open =
    finite(
      opens.at(-1),
      previousClose
    );

  const changePercent =
    previousClose &&
    previousClose > 0
      ? ((price -
          previousClose) /
          previousClose) *
        100
      : 0;

  const gapPercent =
    previousClose &&
    previousClose > 0
      ? ((open -
          previousClose) /
          previousClose) *
        100
      : 0;

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

  const momentum =
    calculateMomentum(
      closes,
      5
    );

  const volumeMetrics =
    calculateVolume(
      volumes
    );

  const trendScore =
    calculateTrendScore(
      price,
      sma20,
      sma50
    );

  /*
   * المقاومة والدعم من High/Low
   * وليس من Close فقط.
   */
  const levels =
    calculateLevels(
      highs,
      lows,
      20
    );

  const breakout =
    calculateBreakout(
      price,
      levels.resistance
    );

  const rsiScore =
    calculateRSIScore(
      rsi
    );

  const bollinger =
    calculateBollinger(
      closes,
      20
    );

  const macd =
    calculateMACD(
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

  /*
   * MACD عامل مساعد.
   * لا نضاعف الزخم.
   */
  const macdScore =
    macd.cross
      ? 100
      : macd.bullish
        ? 75
        : 40;

  /*
   * Squeeze وحده ليس BUY.
   * هو استعداد للحركة فقط.
   */
  const squeezeScore =
    bollinger.squeeze
      ? bollinger.score
      : Math.min(
          bollinger.score,
          40
        );

  const technicalScore =
    calculateTechnicalScore({
      momentum:
        momentum.score,

      volume:
        volumeMetrics.score,

      trend:
        trendScore,

      breakout:
        breakout.score,

      rsi:
        rsiScore,

      squeeze:
        squeezeScore,

      macd:
        macdScore,

      risk:
        riskReward.score,

      liquidity:
        volumeMetrics.liquidityScore,

      resistancePenalty,
    });

  const signal =
    getSignal(
      technicalScore
    );

  const riskLevel =
    riskReward.riskReward != null &&
    riskReward.riskReward >= 2
      ? 'متوسط'
      : 'مرتفع';

  const directionBias =
    technicalScore >= 65
      ? 'ميل فني صاعد'
      : technicalScore <= 40
        ? 'ميل فني هابط'
        : 'ميل فني محايد';

  const marketState =
    price > sma20 &&
    sma20 > sma50
      ? 'BULLISH'
      : price < sma20 &&
          sma20 < sma50
        ? 'BEARISH'
        : 'MIXED';

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

    changePercent:
      round(changePercent),

    gapPercent:
      round(gapPercent),

    open:
      round(open, 4),

    volume,

    averageVolume20:
      Math.round(
        volumeMetrics.average20 ||
          0
      ),

    relativeVolume:
      round(
        volumeMetrics.relative
      ),

    liquidityScore:
      Math.round(
        volumeMetrics.liquidityScore
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
        volumeMetrics.score
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
      round(rsi),

    rsiScore:
      Math.round(
        rsiScore
      ),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

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
        squeezeScore
      ),

    macd:
      round(
        macd.macd,
        4
      ),

    macdSignal:
      round(
        macd.signal,
        4
      ),

    macdHistogram:
      round(
        macd.histogram,
        4
      ),

    macdBullish:
      macd.bullish,

    macdCross:
      macd.cross,

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

    setupScore:
      technicalScore,

    discoveryScore:
      null,

    institutionalScore:
      null,

    signal:
      signal.signal,

    signalStrength:
      signal.strength,

    directionBias,

    riskLevel,

    marketState,

    dayHigh:
      round(
        highs.at(-1) ||
          price
      ),

    dayLow:
      round(
        lows.at(-1) ||
          price
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
   YAHOO DATA
========================================================= */

async function fetchLiveStockData(
  symbol,
  range = '6mo'
) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (
    !validSymbol(clean)
  ) {
    throw new Error(
      'رمز سهم غير صالح'
    );
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(
      clean
    )}` +
    `?interval=1d&range=${range}&events=div%2Csplits`;

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
      `Yahoo Finance ${response.status}`
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

  const instrumentType =
    result.meta?.instrumentType ||
    result.meta?.quoteType;

  if (
    instrumentType &&
    instrumentType !==
      'EQUITY'
  ) {
    throw new Error(
      'هذا الرمز ليس سهماً'
    );
  }

  const quote =
    result.indicators
      ?.quote?.[0] || {};

  return {
    symbol:
      result.meta.symbol ||
      clean,

    meta:
      result.meta,

    quote,

    timestamps:
      result.timestamp || [],

    metrics:
      buildMetrics(
        result.meta,
        quote
      ),
  };
}

/* =========================================================
   SYMBOL EXTRACTION
========================================================= */

function extractSymbol(
  query = ''
) {
  const matches =
    String(query)
      .toUpperCase()
      .match(
        /\b[A-Z][A-Z0-9.^=-]{0,5}\b/g
      ) || [];

  const ignored =
    new Set([
      'THE',
      'FOR',
      'WITH',
      'NOW',
      'AND',
      'FROM',
      'THIS',
      'STOCK',
      'ANALYZE',
      'ANALYSIS',
      'PLEASE',
      'ABOUT',
      'PRICE',
      'WHAT',
      'SHOW',
      'GIVE',
      'BEST',
      'SCAN',
      'BUY',
      'SELL',
      'CALL',
      'PUT',
      'RSI',
      'SMA',
      'MACD',
      'AI',
    ]);

  return (
    matches.find(
      item =>
        !ignored.has(item)
    ) || null
  );
}

/* =========================================================
   GEMINI EXPLANATION
========================================================= */

async function explainWithAI(
  symbol,
  metrics,
  mode = 'general'
) {
  const ai =
    getAI();

  if (!ai) {
    return null;
  }

  const prompt = `
أنت مساعد تحليل فني محافظ داخل منصة HUNTER AI.

قواعد صارمة:
- لا تخترع أي رقم.
- لا تغير Technical Score.
- لا تنشئ Options أو Dark Pool أو Institutional Flow غير موجودة.
- لا تعد المستخدم بالربح.
- لا تعتبر Technical Score ضماناً.
- استخدم البيانات المرسلة فقط.
- إذا كانت البيانات غير كافية قل ذلك بوضوح.
- ركز على السعر والحجم والاتجاه والمقاومة والمخاطرة.
- أجب بالعربية وباختصار.

السهم: ${symbol}

السعر: ${metrics.price}
التغير: ${metrics.changePercent}%
الفجوة: ${metrics.gapPercent}%

Volume:
${metrics.volume}

Average Volume 20:
${metrics.averageVolume20}

Relative Volume:
${metrics.relativeVolume}

RSI:
${metrics.rsi}

SMA20:
${metrics.sma20}

SMA50:
${metrics.sma50}

Momentum Score:
${metrics.momentumScore}

Volume Score:
${metrics.volumeScore}

Trend Score:
${metrics.trendScore}

Breakout Score:
${metrics.breakoutScore}

Bollinger Squeeze:
${metrics.squeeze}

Bollinger Bandwidth:
${metrics.bollingerBandwidth}

MACD Bullish:
${metrics.macdBullish}

MACD Cross:
${metrics.macdCross}

Technical Score:
${metrics.technicalScore}/100

Risk/Reward:
${metrics.riskReward}

Target:
${metrics.targetPrice}

Stop Loss:
${metrics.stopLoss}

Direction:
${metrics.directionBias}

Mode:
${mode}

أعد JSON فقط:

{
  "recommendation": "قرار مختصر ومحافظ",
  "signal": "السبب الفني الرئيسي",
  "analysis": "تحليل مختصر من سطرين"
}
`;

  try {
    const response =
      await ai.models.generateContent({
        model:
          'gemini-2.5-flash',

        contents:
          prompt,

        config: {
          responseMimeType:
            'application/json',
          temperature: 0.2,
        },
      });

    const parsed =
      JSON.parse(
        response.text
      );

    return {
      recommendation:
        String(
          parsed?.recommendation ||
            ''
        ).slice(
          0,
          240
        ),

      signal:
        String(
          parsed?.signal ||
            ''
        ).slice(
          0,
          300
        ),

      analysis:
        String(
          parsed?.analysis ||
            ''
        ).slice(
          0,
          500
        ),
    };
  } catch (error) {
    console.error(
      'Gemini explanation error:',
      error?.message ||
        error
    );

    return null;
  }
}

/* =========================================================
   GENERAL AI CHAT
========================================================= */

async function answerGeneralWithAI(
  query
) {
  const ai =
    getAI();

  if (!ai) {
    return null;
  }

  const prompt = `
أنت مستشار تعليمي محافظ داخل منصة تداول اسمها HUNTER AI.

السؤال:
${String(
  query || ''
).slice(0, 1200)}

القواعد:
- لا تعد بالربح.
- لا تخترع أسعاراً أو أخباراً أو بيانات حية.
- إذا كان السؤال عن سهم محدد، اطلب تحليل السهم.
- ركز على إدارة رأس المال والانضباط.
- أجب بالعربية وباختصار.

أعد JSON فقط:
{
  "reply": "إجابة عربية مختصرة وعملية"
}
`;

  try {
    const response =
      await ai.models.generateContent({
        model:
          'gemini-2.5-flash',

        contents:
          prompt,

        config: {
          responseMimeType:
            'application/json',
          temperature: 0.2,
        },
      });

    const parsed =
      JSON.parse(
        response.text
      );

    return (
      String(
        parsed?.reply || ''
      ).slice(
        0,
        1200
      ) || null
    );
  } catch (error) {
    console.error(
      'Gemini general chat error:',
      error?.message ||
        error
    );

    return null;
  }
}

/* =========================================================
   RADAR CONFIG
========================================================= */

const radarConfigs = {
  cents: {
    tickers: [
      'SERV',
      'NVDA',
      'TSLA',
      'PLTR',
      'AMD',
      'SOFI',
    ],

    title:
      'رادار الأسهم منخفضة السعر',
  },

  darkpool_under_100: {
    tickers: [
      'NVDA',
      'AMD',
      'SOFI',
      'PLTR',
      'INTC',
      'MARA',
      'RIOT',
      'CLSK',
      'GME',
      'AMC',
      'HOOD',
      'NIO',
      'LCID',
      'RIVN',
      'SNDL',
      'TLRY',
    ],

    title:
      'رادار الحركة والحجم',
  },

  gaps: {
    tickers: [
      'NVDA',
      'AMD',
      'TSLA',
      'SOFI',
      'PLTR',
      'HOOD',
      'MARA',
      'RIOT',
      'GME',
      'AMC',
      'NIO',
      'LCID',
      'RIVN',
      'SNAP',
      'INTC',
    ],

    title:
      'رادار الفجوات الافتتاحية',
  },

  reversal: {
    tickers: [
      'NVDA',
      'AMD',
      'TSLA',
      'SOFI',
      'PLTR',
      'INTC',
      'SNAP',
      'HOOD',
      'NIO',
      'LCID',
      'RIVN',
      'GME',
      'AMC',
      'MARA',
      'RIOT',
    ],

    title:
      'رادار الانعكاسات والتشبع',
  },
};

/* =========================================================
   RADAR ITEM
========================================================= */

function buildRadarItem(
  stock,
  mode
) {
  const m =
    stock.metrics;

  let signal =
    'البيانات الفنية متوازنة؛ انتظر تأكيد السعر والحجم.';

  if (
    mode === 'gaps'
  ) {
    signal =
      Math.abs(
        m.gapPercent
      ) >= 1
        ? `فجوة افتتاحية ${
            m.gapPercent >= 0
              ? 'صاعدة'
              : 'هابطة'
          } بنسبة ${m.gapPercent.toFixed(
            2
          )}%؛ تحتاج تأكيد الحجم والسعر.`
        : 'لا توجد فجوة افتتاحية مهمة.';
  }

  if (
    mode === 'reversal'
  ) {
    signal =
      m.rsi != null &&
      m.rsi < 30
        ? 'تشبع بيعي؛ يحتاج تأكيد شمعة وحجم.'
        : m.rsi != null &&
            m.rsi > 70
          ? 'تشبع شرائي؛ خطر المطاردة مرتفع.'
          : 'RSI ليس في منطقة تشبع واضحة.';
  }

  if (
    mode ===
    'darkpool_under_100'
  ) {
    signal =
      'Dark Pool غير متاح من Yahoo؛ القراءة الحالية مبنية على السعر والحجم والمؤشرات الفنية فقط.';
  }

  if (
    mode === 'cents' &&
    m.relativeVolume >= 2 &&
    m.breakoutScore >= 80
  ) {
    signal =
      'حجم نسبي قوي مع قرب من مقاومة 20 جلسة؛ راقب الاختراق المؤكد.';
  }

  return {
    ticker:
      stock.symbol,

    price:
      m.price.toFixed(2),

    change_percent:
      m.changePercent.toFixed(
        2
      ),

    aiScore:
      m.technicalScore,

    technicalScore:
      m.technicalScore,

    momentum:
      m.momentumScore,

    volumeMultiplier:
      m.relativeVolume != null
        ? `x${m.relativeVolume.toFixed(
            2
          )}`
        : 'غير متاح',

    gapPercent:
      `${
        m.gapPercent >= 0
          ? '+'
          : ''
      }${m.gapPercent.toFixed(
        2
      )}%`,

    gapType:
      m.gapPercent >= 0
        ? 'صعود'
        : 'هبوط',

    change:
      `${
        m.changePercent >=
        0
          ? '+'
          : ''
      }${m.changePercent.toFixed(
        2
      )}%`,

    rsi:
      m.rsi == null
        ? 'غير متاح'
        : `RSI ${m.rsi.toFixed(
            1
          )}`,

    status:
      m.rsi != null &&
      m.rsi < 30
        ? 'تشبع بيعي'
        : m.rsi != null &&
            m.rsi > 70
          ? 'تشبع شرائي'
          : 'محايد',

    riskLevel:
      m.riskLevel,

    directionBias:
      m.directionBias,

    recommendation:
      mode ===
      'darkpool_under_100'
        ? 'لا تعتمد على Dark Pool من هذا المصدر.'
        : 'انتظر تأكيد السعر والحجم قبل الدخول.',

    signal,

    avgPrice:
      null,

    blockVolume:
      null,

    optionsDataAvailable:
      false,

    darkPoolDataAvailable:
      false,

    targetPrice:
      m.targetPrice,

    stopLoss:
      m.stopLoss,

    riskReward:
      m.riskReward,

    technicalReady:
      true,

    relativeVolume:
      round(
        m.relativeVolume
      ),

    sma50:
      m.sma50,
  };
}

/* =========================================================
   BACKTEST
========================================================= */

function calculateBacktest(
  closes,
  strategy
) {
  let wins = 0;
  let losses = 0;
  let totalTrades = 0;

  let grossProfit = 0;
  let grossLoss = 0;

  const holdingDays = 5;

  for (
    let i = 40;
    i <
    closes.length -
      holdingDays;
    i += 1
  ) {
    const prior =
      closes.slice(
        0,
        i
      );

    const sma20 =
      average(
        prior.slice(
          -20
        )
      );

    const previousSma20 =
      average(
        prior.slice(
          -21,
          -1
        )
      );

    const stdSlice =
      prior.slice(
        -20
      );

    const stdMean =
      average(
        stdSlice
      );

    const variance =
      average(
        stdSlice.map(
          value =>
            (value -
              stdMean) ** 2
        )
      ) || 0;

    const stdDev =
      Math.sqrt(
        variance
      );

    const upperBand =
      sma20 +
      2 * stdDev;

    const bandwidth =
      sma20
        ? (4 * stdDev) /
          sma20
        : 0;

    let trigger =
      false;

    if (
      strategy ===
      'sma_cross'
    ) {
      trigger =
        closes[i] >
          sma20 &&
        closes[i - 1] <=
          previousSma20;
    } else if (
      strategy ===
      'macd_hist'
    ) {
      const current =
        calculateMACD(
          prior
        );

      const previous =
        calculateMACD(
          prior.slice(
            0,
            -1
          )
        );

      trigger =
        current.histogram !=
          null &&
        previous.histogram !=
          null &&
        current.histogram >
          0 &&
        previous.histogram <=
          0;
    } else {
      trigger =
        bandwidth < 0.08 &&
        closes[i] >
          upperBand;
    }

    if (!trigger) {
      continue;
    }

    totalTrades += 1;

    const entry =
      closes[i];

    const exit =
      closes[
        i +
          holdingDays
      ];

    const returnPercent =
      entry
        ? ((exit - entry) /
            entry) *
          100
        : 0;

    if (
      returnPercent > 0
    ) {
      wins += 1;
      grossProfit +=
        returnPercent;
    } else {
      losses += 1;
      grossLoss +=
        Math.abs(
          returnPercent
        );
    }
  }

  const winRate =
    totalTrades
      ? (wins /
          totalTrades) *
        100
      : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit /
        grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  return {
    totalTrades,
    wins,
    losses,

    winRate:
      round(
        winRate,
        1
      ),

    profitFactor:
      Number.isFinite(
        profitFactor
      )
        ? round(
            profitFactor
          )
        : null,

    holdingDays,
  };
}

/* =========================================================
   POST API
========================================================= */

export async function POST(
  request
) {
  try {
    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const requestedSymbol =
      typeof body?.symbol ===
      'string'
        ? body.symbol
            .trim()
            .toUpperCase()
        : '';

    const query =
      typeof body?.query ===
      'string'
        ? body.query.trim()
        : '';

    const mode =
      typeof body?.mode ===
      'string'
        ? body.mode
        : 'general';

    const symbol =
      requestedSymbol ||
      extractSymbol(
        query
      );

    if (
      requestedSymbol &&
      !validSymbol(
        requestedSymbol
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'رمز السهم غير صالح.',
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       BACKTEST
    ===================================================== */

    if (
      mode ===
      'backtest'
    ) {
      if (!symbol) {
        return NextResponse.json(
          {
            success: false,
            error:
              'حدد رمز السهم للاختبار.',
          },
          {
            status: 400,
          }
        );
      }

      const allowedStrategies =
        [
          'bollinger_squeeze',
          'macd_hist',
          'sma_cross',
        ];

      const strategy =
        allowedStrategies.includes(
          body?.strategy
        )
          ? body.strategy
          : 'bollinger_squeeze';

      const stock =
        await fetchLiveStockData(
          symbol,
          '2y'
        );

      const closes =
        (
          stock.quote?.close ||
          []
        )
          .map(Number)
          .filter(
            Number.isFinite
          );

      if (
        closes.length <
        MIN_HISTORY
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'البيانات التاريخية غير كافية للاختبار.',
          },
          {
            status: 422,
          }
        );
      }

      const result =
        calculateBacktest(
          closes,
          strategy
        );

      return NextResponse.json(
        {
          success: true,

          ticker:
            stock.symbol,

          strategy,

          strategyName:
            strategy ===
            'sma_cross'
              ? 'تقاطع SMA20'
              : strategy ===
                  'macd_hist'
                ? 'MACD Momentum'
                : 'Bollinger Squeeze Breakout',

          dataSource:
            'Yahoo Finance historical chart data',

          ...result,

          recommendation:
            result.totalTrades ===
            0
              ? 'لا توجد صفقات تاريخية كافية وفق الشروط الحالية.'
              : result.winRate >=
                  60
                ? 'نتيجة تاريخية إيجابية، لكنها ليست ضماناً للأداء المستقبلي.'
                : 'النتيجة التاريخية تحتاج فلترة إضافية قبل الاعتماد عليها.',
        }
      );
    }

    /* =====================================================
       GENERAL AI CHAT
    ===================================================== */

    if (
      mode ===
        'general' &&
      !symbol
    ) {
      const reply =
        await answerGeneralWithAI(
          query
        );

      if (!reply) {
        return NextResponse.json(
          {
            success: false,

            error:
              process.env.GEMINI_API_KEY
                ? 'تعذر إنشاء إجابة AI حالياً.'
                : 'مساعد AI غير مهيأ. أضف GEMINI_API_KEY لتفعيل المحادثة العامة.',
          },
          {
            status: 503,
          }
        );
      }

      return NextResponse.json({
        success: true,

        reply,

        dataSource:
          'Gemini AI',

        disclaimer:
          'إجابة تعليمية؛ ليست ضماناً للربح أو بديلاً عن إدارة المخاطر.',
      });
    }

    /* =====================================================
       RADARS
    ===================================================== */

    if (
      radarConfigs[mode]
    ) {
      const results =
        await Promise.allSettled(
          radarConfigs[
            mode
          ].tickers.map(
            ticker =>
              fetchLiveStockData(
                ticker,
                '6mo'
              )
          )
        );

      const stocks =
        results
          .filter(
            result =>
              result.status ===
              'fulfilled'
          )
          .map(
            result =>
              result.value
          )
          .filter(
            stock =>
              stock.metrics
                .price >
                0 &&
              stock.metrics
                .price <
                100
          );

      if (
        !stocks.length
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              'لم يتم جلب بيانات حية كافية للرادار.',
          },
          {
            status: 503,
          }
        );
      }

      const items =
        stocks
          .map(
            stock =>
              buildRadarItem(
                stock,
                mode
              )
          )
          .sort(
            (a, b) =>
              b.technicalScore -
              a.technicalScore
          );

      return NextResponse.json(
        {
          success: true,

          type:
            mode,

          title:
            radarConfigs[
              mode
            ].title,

          items,

          dataSource:
            'Yahoo Finance chart data',

          limitations:
            mode ===
            'darkpool_under_100'
              ? 'لا توجد بيانات Dark Pool فعلية في مصدر Yahoo.'
              : 'لا توجد Options Chain فعلية في هذا المسار.',

          dataAvailability: {
            options:
              false,

            darkPool:
              false,

            institutionalFlow:
              false,
          },
        }
      );
    }

    /* =====================================================
       SINGLE STOCK ANALYSIS
    ===================================================== */

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,

          error:
            'حدد رمز السهم، مثال: SERV أو اكتب سؤالاً يتضمن الرمز.',
        },
        {
          status: 400,
        }
      );
    }

    const stock =
      await fetchLiveStockData(
        symbol,
        '6mo'
      );

    const metrics =
      stock.metrics;

    /*
     * Gemini يفسر فقط.
     * الرقم الرسمي يبقى حسابيًا.
     */

    const explanation =
      await explainWithAI(
        stock.symbol,
        metrics,
        mode
      );

    return NextResponse.json(
      {
        success: true,

        symbol:
          stock.symbol,

        price:
          metrics.price.toFixed(
            2
          ),

        change:
          `${
            metrics.changePercent >=
            0
              ? '+'
              : ''
          }${metrics.changePercent.toFixed(
            2
          )}%`,

        gapPercent:
          metrics.gapPercent,

        volume:
          Math.round(
            metrics.volume
          ).toLocaleString(),

        /*
         * الرقم الرسمي:
         * Technical Score
         */

        aiScore:
          metrics.technicalScore,

        technicalScore:
          metrics.technicalScore,

        setupScore:
          metrics.setupScore,

        momentum:
          metrics.momentumScore,

        momentumScore:
          metrics.momentumScore,

        volumeScore:
          metrics.volumeScore,

        trendScore:
          metrics.trendScore,

        breakout:
          metrics.breakout,

        breakoutScore:
          metrics.breakoutScore,

        rsi:
          metrics.rsi,

        rsiScore:
          metrics.rsiScore,

        relativeVolume:
          metrics.relativeVolume,

        liquidityScore:
          metrics.liquidityScore,

        sma20:
          metrics.sma20,

        sma50:
          metrics.sma50,

        resistance20:
          metrics.resistance20,

        support20:
          metrics.support20,

        resistanceDistance:
          metrics.resistanceDistance,

        squeeze:
          metrics.squeeze,

        bollingerBandwidth:
          metrics.bollingerBandwidth,

        squeezeScore:
          metrics.squeezeScore,

        macd:
          metrics.macd,

        macdSignal:
          metrics.macdSignal,

        macdHistogram:
          metrics.macdHistogram,

        macdBullish:
          metrics.macdBullish,

        macdCross:
          metrics.macdCross,

        targetPrice:
          metrics.targetPrice,

        stopLoss:
          metrics.stopLoss,

        riskPercent:
          metrics.riskPercent,

        rewardPercent:
          metrics.rewardPercent,

        riskReward:
          metrics.riskReward,

        riskScore:
          metrics.riskScore,

        riskLevel:
          metrics.riskLevel,

        directionBias:
          metrics.directionBias,

        marketState:
          metrics.marketState,

        signal:
          metrics.signal,

        signalStrength:
          metrics.signalStrength,

        recommendation:
          explanation?.recommendation ||
          'انتظر تأكيد السعر والحجم قبل اتخاذ القرار.',

        analysis:
          explanation?.analysis ||
          `التحليل الحسابي للسهم ${stock.symbol} يعطي Technical Score قدره ${metrics.technicalScore}/100.`,

        aiSignal:
          explanation?.signal ||
          'التفسير الذكي غير متاح حالياً؛ الدرجة الحسابية ما زالت متاحة.',

        /*
         * لا ندعي بيانات غير موجودة.
         */

        optionsDataAvailable:
          false,

        darkPoolDataAvailable:
          false,

        institutionalFlowAvailable:
          false,

        dataSource:
          'Yahoo Finance chart data',

        timestamp:
          new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error(
      'HUNTER AI Analyze API Error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'تعذر جلب أو تحليل بيانات السوق حالياً',

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
