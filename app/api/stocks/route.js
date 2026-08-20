// app/api/stocks/route.js
import { NextResponse } from 'next/server';
import { calculateATR } from '@/lib/penny-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const SYMBOL_REGEX = /^[A-Z][A-Z0-9.^=-]{0,11}$/;

const MIN_HISTORY = 60;
const MIN_PRICE = 0.5;
const MAX_PRICE = 100;
const MIN_AVERAGE_VOLUME = 100_000;

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Number(n.toFixed(decimals));
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return min;
  }

  return Math.max(min, Math.min(max, n));
}

function average(values) {
  const valid = values
    .map(Number)
    .filter(Number.isFinite);

  if (!valid.length) {
    return null;
  }

  return (
    valid.reduce((sum, value) => sum + value, 0) /
    valid.length
  );
}

function calculateSma(values, period) {
  if (values.length < period) {
    return null;
  }

  return average(values.slice(-period));
}

function calculateRsi(closes, period = 14) {
  if (closes.length <= period) {
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

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];

    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    averageGain =
      ((averageGain * (period - 1)) + gain) /
      period;

    averageLoss =
      ((averageLoss * (period - 1)) + loss) /
      period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  return (
    100 -
    100 / (1 + averageGain / averageLoss)
  );
}

function calculateRsiScore(rsi) {
  const value = Number(rsi);

  if (!Number.isFinite(value)) {
    return 50;
  }

  // أفضل منطقة للـsetup الصاعد ليست التشبع الشرائي.
  if (value >= 45 && value <= 65) {
    return 100;
  }

  if (value > 65 && value <= 70) {
    return 85;
  }

  if (value >= 35 && value < 45) {
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

function calculateMomentum(closes, period = 5) {
  if (closes.length <= period) {
    return {
      percent: null,
      score: 50,
    };
  }

  const current = closes.at(-1);
  const base = closes.at(-(period + 1));

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
    ((current - base) / base) * 100;

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
  if (!volumes.length) {
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

  const current = Number(currentVolume);

  const relativeVolume =
    Number.isFinite(current) &&
    averageVolume > 0
      ? current / averageVolume
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

function calculateTrendScore(
  price,
  sma20,
  sma50
) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(sma20) ||
    !Number.isFinite(sma50) ||
    sma50 <= 0
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

  const distanceFromSma50 =
    ((price - sma50) / sma50) * 100;

  score += clamp(
    distanceFromSma50 * 2,
    -20,
    20
  );

  return clamp(score);
}

function calculateBollinger(
  closes,
  period = 20,
  multiplier = 2
) {
  if (closes.length < period) {
    return {
      middle: null,
      upper: null,
      lower: null,
      bandwidth: null,
      squeeze: false,
      squeezeScore: 0,
    };
  }

  const window = closes.slice(-period);
  const middle = average(window);

  if (!middle || middle <= 0) {
    return {
      middle: null,
      upper: null,
      lower: null,
      bandwidth: null,
      squeeze: false,
      squeezeScore: 0,
    };
  }

  const variance =
    average(
      window.map(
        (value) =>
          (value - middle) ** 2
      )
    ) || 0;

  const standardDeviation =
    Math.sqrt(variance);

  const upper =
    middle +
    multiplier * standardDeviation;

  const lower =
    middle -
    multiplier * standardDeviation;

  const bandwidth =
    ((upper - lower) / middle) * 100;

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
    middle,
    upper,
    lower,
    bandwidth,
    squeeze: bandwidth < 9,
    squeezeScore,
  };
}

function calculateLevels(
  highs,
  lows,
  closes,
  lookback = 20
) {
  const priorHighs =
    highs.length >= lookback + 1
      ? highs.slice(
          -(lookback + 1),
          -1
        )
      : [];

  const priorLows =
    lows.length >= lookback + 1
      ? lows.slice(
          -(lookback + 1),
          -1
        )
      : [];

  const priorCloses =
    closes.length >= lookback + 1
      ? closes.slice(
          -(lookback + 1),
          -1
        )
      : [];

  const resistance =
    priorHighs.length
      ? Math.max(...priorHighs)
      : priorCloses.length
        ? Math.max(...priorCloses)
        : null;

  const support =
    priorLows.length
      ? Math.min(...priorLows)
      : priorCloses.length
        ? Math.min(...priorCloses)
        : null;

  return {
    resistance,
    support,
  };
}

function calculateBreakout(
  price,
  resistance
) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(resistance) ||
    price <= 0
  ) {
    return {
      distancePercent: null,
      score: 50,
    };
  }

  const distancePercent =
    ((resistance - price) / price) * 100;

  let score = 25;

  if (distancePercent <= 0) {
    score = 100;
  } else if (distancePercent <= 1) {
    score = 95;
  } else if (distancePercent <= 2) {
    score = 88;
  } else if (distancePercent <= 4) {
    score = 75;
  } else if (distancePercent <= 6) {
    score = 60;
  } else if (distancePercent <= 10) {
    score = 45;
  }

  return {
    distancePercent,
    score,
  };
}

function calculateCluster(
  price,
  highs,
  lows,
  relativeVolume,
  lookback = 5
) {
  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    highs.length < lookback ||
    lows.length < lookback
  ) {
    return {
      rangePercent: null,
      isCluster: false,
      score: 0,
    };
  }

  const recentHighs =
    highs.slice(-lookback);

  const recentLows =
    lows.slice(-lookback);

  const high =
    Math.max(...recentHighs);

  const low =
    Math.min(...recentLows);

  const rangePercent =
    ((high - low) / price) * 100;

  const rvol =
    Number(relativeVolume) || 0;

  const isCluster =
    rangePercent <= 3.5 &&
    rvol >= 1.1;

  let score = 25;

  if (rangePercent <= 2) {
    score = 100;
  } else if (rangePercent <= 3.5) {
    score = 85;
  } else if (rangePercent <= 5) {
    score = 60;
  }

  if (rvol >= 1.5) {
    score += 10;
  }

  return {
    rangePercent,
    isCluster,
    score: clamp(score),
  };
}

function calculateRiskReward(
  price,
  support,
  resistance
) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(support) ||
    !Number.isFinite(resistance) ||
    price <= 0
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

  const stopLoss = Math.min(
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

  const riskRewardRatio =
    reward / risk;

  let score = 25;

  if (riskRewardRatio >= 3) {
    score = 100;
  } else if (riskRewardRatio >= 2.5) {
    score = 90;
  } else if (riskRewardRatio >= 2) {
    score = 80;
  } else if (riskRewardRatio >= 1.5) {
    score = 65;
  } else if (riskRewardRatio >= 1) {
    score = 45;
  }

  return {
    stopLoss: round(stopLoss),
    targetPrice: round(resistance),
    riskPercent: round(
      (risk / price) * 100
    ),
    rewardPercent: round(
      (reward / price) * 100
    ),
    riskReward: round(
      riskRewardRatio
    ),
    score,
  };
}

function buildDecision({
  setupScore,
  relativeVolume,
  riskReward,
  resistanceDistancePercent,
  cluster,
  squeeze,
  rsi,
}) {
  const reasons = [];
  const risks = [];
  const blockers = [];

  if (
    Number(relativeVolume) >= 1.5
  ) {
    reasons.push(
      'Volume أعلى من المتوسط بشكل واضح'
    );
  } else if (
    Number(relativeVolume) >= 1.1
  ) {
    reasons.push(
      'Volume يدعم الحركة'
    );
  }

  if (cluster) {
    reasons.push(
      'السعر داخل Cluster ضيق'
    );
  }

  if (squeeze) {
    reasons.push(
      'Bollinger Squeeze موجود'
    );
  }

  if (
    Number(rsi) >= 45 &&
    Number(rsi) <= 65
  ) {
    reasons.push(
      'RSI في منطقة مناسبة للـsetup'
    );
  }

  if (
    Number(riskReward) >= 2
  ) {
    reasons.push(
      `Risk/Reward جيد (${riskReward}x)`
    );
  }

  if (
    resistanceDistancePercent != null &&
    resistanceDistancePercent < 2
  ) {
    risks.push(
      'المقاومة قريبة'
    );
  }

  if (
    Number(rsi) > 70
  ) {
    risks.push(
      'RSI في منطقة تشبع شرائي'
    );
  }

  if (
    Number(relativeVolume) < 1
  ) {
    risks.push(
      'الحجم أقل من متوسطه'
    );
  }

  if (
    riskReward != null &&
    riskReward < 1.5
  ) {
    risks.push(
      'Risk/Reward ضعيف'
    );
    blockers.push(
      'لا توجد مساحة مخاطرة/عائد كافية'
    );
  }

  if (
    resistanceDistancePercent != null &&
    resistanceDistancePercent >= 0 &&
    resistanceDistancePercent < 1
  ) {
    blockers.push(
      'السهم قريب جدًا من المقاومة'
    );
  }

  let decision = 'REJECT';

  if (
    setupScore >= 80 &&
    blockers.length === 0
  ) {
    decision = 'BUY';
  } else if (
    setupScore >= 60 &&
    blockers.length === 0
  ) {
    decision = 'WATCH';
  } else if (
    setupScore >= 70 &&
    blockers.length <= 1
  ) {
    decision = 'WATCH';
  }

  return {
    decision,
    reasons: reasons.slice(0, 5),
    risks: risks.slice(0, 5),
    blockers: blockers.slice(0, 3),
  };
}

function buildAnalytics(
  meta,
  quote
) {
  const closes =
    (quote?.close || [])
      .map(Number)
      .filter(Number.isFinite);

  const volumes =
    (quote?.volume || [])
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

  const currentVolume =
    num(
      meta?.regularMarketVolume,
      volumes.at(-1)
    );

  const sma20 =
    calculateSma(closes, 20);

  const sma50 =
    calculateSma(closes, 50);

  const rsi =
    calculateRsi(closes);

  const volumeMetrics =
    calculateVolumeMetrics(
      volumes,
      currentVolume,
      20
    );

  const momentum =
    calculateMomentum(closes, 5);

  const levels =
    calculateLevels(
      highs,
      lows,
      closes,
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
      levels.resistance
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
      volumeMetrics.relativeVolume,
      5
    );

  const riskReward =
    calculateRiskReward(
      price,
      levels.support,
      levels.resistance
    );

  const technicalReady =
    closes.length >= MIN_HISTORY &&
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(previousClose) &&
    previousClose > 0 &&
    Number.isFinite(
      volumeMetrics.averageVolume
    ) &&
    volumeMetrics.averageVolume > 0 &&
    Number.isFinite(sma20) &&
    Number.isFinite(sma50) &&
    rsi != null;

  if (!technicalReady) {
    return {
      technicalReady: false,
      dataQuality:
        'بيانات فنية غير مكتملة',

      price,
      previousClose,
      change: null,
      changePercent: null,

      volume: currentVolume,
      averageVolume20:
        volumeMetrics.averageVolume
          ? Math.round(
              volumeMetrics.averageVolume
            )
          : null,

      relativeVolume: null,
      momentumPercent: null,
      momentum: null,
      momentumScore: null,

      volumeScore: null,
      liquidityScore: null,
      trendScore: null,
      breakout: null,
      breakoutScore: null,

      rsi:
        rsi == null
          ? null
          : round(rsi),

      rsiScore: null,

      sma20:
        sma20 == null
          ? null
          : round(sma20),

      sma50:
        sma50 == null
          ? null
          : round(sma50),

      resistance20:
        levels.resistance == null
          ? null
          : round(levels.resistance),

      support20:
        levels.support == null
          ? null
          : round(levels.support),

      resistanceDistancePercent: null,

      targetPrice: null,
      stopLoss: null,
      riskPercent: null,
      rewardPercent: null,
      riskReward: null,
      riskScore: 0,

      bollingerBandwidth: null,
      squeeze: false,
      squeezeScore: 0,

      cluster: false,
      clusterRangePercent: null,
      clusterScore: 0,

      technicalScore: null,
      discoveryScore: null,
      setupScore: null,

      signal: 'INSUFFICIENT_DATA',
      decision: 'REJECT',

      reasons: [],
      risks: [
        'البيانات التاريخية غير كافية'
      ],
      blockers: [
        'لا يمكن تقييم السهم بشكل موثوق'
      ],

      marketState:
        meta?.marketState || 'UNKNOWN',

      currency:
        meta?.currency || 'USD',

      dataAvailability: {
        price: Number.isFinite(price),
        volume:
          Number.isFinite(
            currentVolume
          ),
        technicals: false,
        options: false,
        darkPool: false,
        institutionalFlow: false,
      },
    };
  }

  const change =
    price - previousClose;

  const changePercent =
    (change / previousClose) * 100;

  const technicalScore =
    clamp(
      momentum.score * 0.15 +
        volumeMetrics.volumeScore * 0.15 +
        trendScore * 0.15 +
        breakout.score * 0.15 +
        calculateRsiScore(rsi) * 0.10 +
        bollinger.squeezeScore * 0.10 +
        cluster.score * 0.10 +
        riskReward.score * 0.10
    );

  let adjustedTechnicalScore =
    technicalScore;

  if (
    breakout.distancePercent != null &&
    breakout.distancePercent >= 0 &&
    breakout.distancePercent < 1
  ) {
    adjustedTechnicalScore -= 12;
  } else if (
    breakout.distancePercent != null &&
    breakout.distancePercent < 2
  ) {
    adjustedTechnicalScore -= 7;
  }

  adjustedTechnicalScore =
    clamp(adjustedTechnicalScore);

  const discoveryScore =
    clamp(
      50 * 0.25 +
        clamp(
          30 +
            (volumeMetrics.relativeVolume || 0) *
              25,
          30,
          100
        ) *
          0.35 +
        clamp(
          40 +
            Math.abs(changePercent) * 5,
          40,
          100
        ) *
          0.15 +
        (
          currentVolume >= 1_000_000
            ? 100
            : currentVolume >= 500_000
              ? 80
              : currentVolume >= 100_000
                ? 60
                : 30
        ) *
          0.25
    );

  const setupScore =
    Math.round(
      adjustedTechnicalScore * 0.85 +
        discoveryScore * 0.15
    );

  const decision =
    buildDecision({
      setupScore,
      relativeVolume:
        volumeMetrics.relativeVolume,
      riskReward:
        riskReward.riskReward,
      resistanceDistancePercent:
        breakout.distancePercent,
      cluster:
        cluster.isCluster,
      squeeze:
        bollinger.squeeze,
      rsi,
    });

  const signal =
    decision.decision === 'BUY'
      ? 'BUY'
      : decision.decision === 'WATCH'
        ? 'WATCH'
        : 'REJECT';

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

    volume: currentVolume,

    averageVolume20:
      Math.round(
        volumeMetrics.averageVolume
      ),

    relativeVolume:
      round(
        volumeMetrics.relativeVolume
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
      Math.round(
        calculateRsiScore(rsi)
      ),

    sma20:
      round(sma20),

    sma50:
      round(sma50),

    resistance20:
      round(levels.resistance),

    support20:
      round(levels.support),

    resistanceDistancePercent:
      round(
        breakout.distancePercent
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

    atr:
      calculateATR(
        highs,
        lows,
        closes,
        14
      ),

    bollingerBandwidth:
      round(
        bollinger.bandwidth
      ),

    squeeze:
      bollinger.squeeze,

    squeezeScore:
      bollinger.squeezeScore,

    cluster:
      cluster.isCluster,

    clusterRangePercent:
      round(
        cluster.rangePercent
      ),

    clusterScore:
      Math.round(cluster.score),

    technicalScore:
      Math.round(
        adjustedTechnicalScore
      ),

    discoveryScore:
      Math.round(discoveryScore),

    setupScore,

    signal,

    decision: decision.decision,

    signalStrength:
      setupScore >= 75
        ? 'HIGH'
        : setupScore >= 60
          ? 'MEDIUM'
          : 'LOW',

    directionBias:
      setupScore >= 65
        ? 'ميل فني صاعد'
        : setupScore <= 40
          ? 'ميل فني هابط'
          : 'ميل فني محايد',

    riskLevel:
      setupScore >= 75
        ? 'متوسط'
        : setupScore >= 55
          ? 'متوسط إلى مرتفع'
          : 'مرتفع',

    reasons:
      decision.reasons,

    risks:
      decision.risks,

    blockers:
      decision.blockers,

    dayHigh:
      round(
        highs.at(-1) || price
      ),

    dayLow:
      round(
        lows.at(-1) || price
      ),

    marketState:
      meta?.marketState || 'UNKNOWN',

    currency:
      meta?.currency || 'USD',

    dataAvailability: {
      price: true,
      volume:
        Number.isFinite(
          currentVolume
        ),
      technicals: true,

      // لا ندعي توفر بيانات غير موجودة.
      options: false,
      darkPool: false,
      institutionalFlow: false,
    },
  };
}

async function fetchChart(
  symbol,
  range = '6mo'
) {
  const clean =
    String(symbol || '')
      .trim()
      .toUpperCase();

  if (!SYMBOL_REGEX.test(clean)) {
    throw new Error(
      'رمز سهم غير صالح'
    );
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      clean
    )}?interval=1d&range=${range}&events=div%2Csplits`;

  const response =
    await fetch(url, {
      headers: YAHOO_HEADERS,
      cache: 'no-store',
    });

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance ${response.status} for ${clean}`
    );
  }

  const data =
    await response.json();

  const result =
    data?.chart?.result?.[0];

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
  };
}

function isUsEquity(meta) {
  return (
    meta?.quoteType === 'EQUITY' &&
    Boolean(
      meta?.exchangeTimezoneName ||
        meta?.fullExchangeName
    )
  );
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

    const symbol =
      searchParams
        .get('symbol')
        ?.trim()
        .toUpperCase();

    // -----------------------------------------
    // SINGLE SYMBOL
    // -----------------------------------------

    if (symbol) {
      const chart =
        await fetchChart(
          symbol
        );

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

              ...analytics,
            },
          ],
        },
        {
          headers: {
            'Cache-Control':
              'no-store, max-age=0',
          },
        }
      );
    }

    // -----------------------------------------
    // DISCOVERY
    // -----------------------------------------

    const trendingResponse =
      await fetch(
        'https://query1.finance.yahoo.com/v1/finance/trending/US?count=25',
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

    const symbols =
      (
        trendingData
          ?.finance
          ?.result?.[0]
          ?.quotes || []
      )
        .map(
          (item) =>
            item?.symbol
        )
        .filter(
          (item) =>
            SYMBOL_REGEX.test(
              item || ''
            )
        )
        .slice(0, 25);

    const settled =
      await Promise.allSettled(
        symbols.map(
          (item) =>
            fetchChart(item)
        )
      );

    const results =
      settled
        .filter(
          (item) =>
            item.status ===
            'fulfilled'
        )
        .map(
          (item) =>
            item.value
        )
        .filter(
          (chart) =>
            isUsEquity(
              chart.meta
            )
        )
        .map(
          (chart) => ({
            symbol:
              chart.symbol,

            quoteType:
              chart.meta
                ?.quoteType ||
              null,

            ...buildAnalytics(
              chart.meta,
              chart.quote
            ),
          })
        )
        .filter(
          (item) =>
            item.technicalReady &&
            item.price >=
              MIN_PRICE &&
            item.price <=
              MAX_PRICE &&
            Number(
              item.averageVolume20
            ) >=
              MIN_AVERAGE_VOLUME
        )
        .sort(
          (a, b) =>
            Number(
              b.setupScore || 0
            ) -
            Number(
              a.setupScore || 0
            )
        )
        .slice(0, 25);

    return NextResponse.json(
      {
        status: 'success',

        timestamp:
          new Date().toISOString(),

        count:
          results.length,

        data:
          results,

        universe:
          'Yahoo Finance US trending equities, price $0.50-$100, average volume >= 100K',

        limitations:
          'المصدر الحالي يوفر سعر/حجم/بيانات تاريخية، وليس Options أو Dark Pool أو تدفق مؤسسات لحظي.',
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
      'Stocks API Live Error:',
      error
    );

    return NextResponse.json(
      {
        status: 'error',

        timestamp:
          new Date().toISOString(),

        count: 0,

        data: [],

        error:
          'تعذر جلب بيانات الأسهم الأمريكية المباشرة حالياً',
      },
      {
        status: 503,
      }
    );
  }
}