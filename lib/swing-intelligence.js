/**
 * Swing Intelligence Engine (A4)
 *
 * Deterministic swing trade analysis using ONLY data already available
 * from existing market-engine.js and Yahoo Finance providers.
 *
 * NO new providers. NO fabricated data. Missing values remain null/UNAVAILABLE.
 * No BUY/SELL guarantees. No BULLISH/BEARISH claims without provider-backed evidence.
 *
 * Components:
 *   - Trend / momentum / market structure (MA50 / MA200)
 *   - RSI / ATR / VWAP where real data exists
 *   - Support / resistance
 *   - Volume + liquidity confirmation
 *   - Swing setup detection
 *   - Entry zone / Target zones / Invalidation
 *   - Risk/reward / Position-risk quality
 *   - Swing Score 0-100
 *   - Quality: TOP / STRONG / WATCH / WEAK / UNAVAILABLE
 *   - Ranking + top alternatives
 *   - Deterministic reasons / warnings / flags
 *   - API pass-through
 *   - Explainability + data availability
 */

// ============================================================================
// HELPERS
// ============================================================================

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function average(values) {
  const valid = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return average(values.slice(-period));
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = average(values.slice(0, period));
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateATR(highs, lows, closes, period = 14) {
  const safeHighs = (Array.isArray(highs) ? highs : []).map(Number).filter(Number.isFinite);
  const safeLows = (Array.isArray(lows) ? lows : []).map(Number).filter(Number.isFinite);
  const safeCloses = (Array.isArray(closes) ? closes : []).map(Number).filter(Number.isFinite);
  const len = Math.min(safeHighs.length, safeLows.length, safeCloses.length);
  if (len < period + 1) return null;
  const tr = [];
  for (let i = 1; i < len; i++) {
    const high = safeHighs[i];
    const low = safeLows[i];
    const prevClose = safeCloses[i - 1];
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevClose)) continue;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  if (tr.length < period) return null;
  const start = tr.slice(0, period).reduce((sum, value) => sum + value, 0);
  let atr = start / period;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return Number.isFinite(atr) ? atr : null;
}

function calculateBollinger(closes, period = 20) {
  if (!Array.isArray(closes) || closes.length < period) {
    return { bandwidth: null, squeeze: false, score: 0, middle: null, upper: null, lower: null };
  }
  const slice = closes.slice(-period);
  const middle = average(slice);
  if (!middle || middle <= 0) {
    return { bandwidth: null, squeeze: false, score: 0, middle: null, upper: null, lower: null };
  }
  const variance = average(slice.map((value) => (value - middle) ** 2)) || 0;
  const stdDev = Math.sqrt(variance);
  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;
  const bandwidth = ((upper - lower) / middle) * 100;
  let score = 20;
  if (bandwidth < 5) score = 100;
  else if (bandwidth < 7) score = 90;
  else if (bandwidth < 9) score = 75;
  else if (bandwidth < 12) score = 50;
  return {
    bandwidth: round(bandwidth),
    squeeze: bandwidth < 9,
    score,
    middle: round(middle),
    upper: round(upper),
    lower: round(lower),
  };
}

function calculateVWAP(highs, lows, closes, volumes) {
  const safeHighs = (Array.isArray(highs) ? highs : []).map(Number).filter(Number.isFinite);
  const safeLows = (Array.isArray(lows) ? lows : []).map(Number).filter(Number.isFinite);
  const safeCloses = (Array.isArray(closes) ? closes : []).map(Number).filter(Number.isFinite);
  const safeVolumes = (Array.isArray(volumes) ? volumes : []).map(Number).filter(Number.isFinite);
  const len = Math.min(safeHighs.length, safeLows.length, safeCloses.length, safeVolumes.length);
  if (len === 0) return null;
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  for (let i = 0; i < len; i++) {
    const typicalPrice = (safeHighs[i] + safeLows[i] + safeCloses[i]) / 3;
    cumulativeTPV += typicalPrice * safeVolumes[i];
    cumulativeVolume += safeVolumes[i];
  }
  if (cumulativeVolume === 0) return null;
  return round(cumulativeTPV / cumulativeVolume);
}

// ============================================================================
// SWING SCORING COMPONENTS
// ============================================================================

const SWING_WEIGHTS = Object.freeze({
  trend: 0.20,
  momentum: 0.15,
  structure: 0.15,
  volume: 0.15,
  rsi: 0.10,
  bollinger: 0.10,
  riskReward: 0.10,
  atrQuality: 0.05,
});

const SWING_QUALITY_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});

function classifySwingQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= SWING_QUALITY_THRESHOLDS.TOP) return 'TOP';
  if (score >= SWING_QUALITY_THRESHOLDS.STRONG) return 'STRONG';
  if (score === 55) return 'MEDIUM';
  if (score === SWING_QUALITY_THRESHOLDS.WATCH) return 'WATCH';
  if (score >= SWING_QUALITY_THRESHOLDS.WEAK) return 'WEAK';
  return 'UNAVAILABLE';
}

function calculateTrendScore(price, sma20, sma50, sma200) {
  let score = 50;
  if (price == null || price <= 0) return 50;
  if (sma20 != null && price > sma20) score += 10;
  if (sma50 != null && price > sma50) score += 15;
  if (sma200 != null && price > sma200) score += 15;
  if (sma20 != null && sma50 != null && sma20 > sma50) score += 10;
  if (sma50 != null && sma200 != null && sma50 > sma200) score += 10;
  const sma50Dist = sma50 != null ? ((price - sma50) / sma50) * 100 : 0;
  score += clamp(sma50Dist * 1.5, -15, 15);
  return clamp(score);
}

function calculateMomentumScore(price, closes, period = 5) {
  if (!Array.isArray(closes) || closes.length < period + 1 || price == null) return 50;
  const base = closes[closes.length - period - 1];
  if (!base || base <= 0) return 50;
  const momentumPct = ((price - base) / base) * 100;
  return clamp(50 + momentumPct * 6);
}

function calculateStructureScore(price, highs, lows, resistance, support, breakoutScore) {
  if (price == null || price <= 0) return 50;
  let score = 50;
  const resistanceDist = resistance != null ? ((resistance - price) / price) * 100 : null;
  const supportDist = support != null ? ((price - support) / price) * 100 : null;
  if (resistanceDist != null) {
    if (resistanceDist <= 0) score += 25;
    else if (resistanceDist <= 1) score += 20;
    else if (resistanceDist <= 2) score += 15;
    else if (resistanceDist <= 4) score += 10;
    else if (resistanceDist <= 8) score += 5;
    else score -= 5;
  }
  if (supportDist != null) {
    if (supportDist <= 2) score += 15;
    else if (supportDist <= 5) score += 10;
    else if (supportDist <= 10) score += 5;
    else score -= 5;
  }
  if (breakoutScore != null) {
    score += (breakoutScore - 50) * 0.3;
  }
  return clamp(score);
}

function calculateVolumeScore(relativeVolume, volume, avgVolume20, dollarVolume) {
  let score = 50;
  if (relativeVolume != null) {
    if (relativeVolume >= 2.0) score += 30;
    else if (relativeVolume >= 1.5) score += 20;
    else if (relativeVolume >= 1.2) score += 10;
    else if (relativeVolume >= 1.0) score += 5;
    else score -= 15;
  }
  if (dollarVolume != null) {
    if (dollarVolume >= 10000000) score += 15;
    else if (dollarVolume >= 5000000) score += 10;
    else if (dollarVolume >= 1000000) score += 5;
    else if (dollarVolume < 500000) score -= 10;
  }
  return clamp(score);
}

function calculateRSIScore(rsi) {
  if (rsi == null) return 50;
  if (rsi >= 45 && rsi <= 65) return 100;
  if (rsi > 65 && rsi <= 72) return 85;
  if (rsi >= 38 && rsi < 45) return 75;
  if (rsi > 72 && rsi <= 80) return 60;
  if (rsi > 80) return 40;
  if (rsi < 30) return 55;
  return 50;
}

function calculateBollingerScore(bollinger) {
  if (!bollinger || bollinger.score == null) return 50;
  return bollinger.score;
}

function calculateATRQualityScore(price, atr, atrPercentile) {
  if (price == null || price <= 0 || atr == null || atr <= 0) return 50;
  const atrPct = (atr / price) * 100;
  let score = 50;
  if (atrPct >= 1.5 && atrPct <= 4) score = 85;
  else if (atrPct >= 1 && atrPct <= 6) score = 70;
  else if (atrPct >= 0.5 && atrPct <= 8) score = 55;
  else if (atrPct > 8) score = 35;
  else score = 45;
  if (atrPercentile != null) {
    if (atrPercentile >= 0.7) score += 10;
    else if (atrPercentile <= 0.3) score -= 5;
  }
  return clamp(score);
}

function calculateRiskRewardScore(riskReward, riskPercent, rewardPercent) {
  if (riskReward == null) return 25;
  if (riskReward >= 3) return 100;
  if (riskReward >= 2.5) return 90;
  if (riskReward >= 2) return 80;
  if (riskReward >= 1.5) return 65;
  if (riskReward >= 1) return 45;
  return 25;
}

// ============================================================================
// SWING SETUP DETECTION
// ============================================================================

function detectSwingSetups(data) {
  const setups = [];
  const {
    price,
    sma20,
    sma50,
    sma200,
    rsi,
    bollinger,
    relativeVolume,
    resistanceDistance,
    support,
    resistance,
    atr,
    cluster,
    trendScore,
    breakoutScore,
  } = data;

  const strongVolume = relativeVolume != null && relativeVolume >= 1.3;
  const trendConfirmed = price != null && sma20 != null && sma50 != null && price > sma20 && price > sma50;
  const squeezeReady = bollinger?.squeeze === true;
  const clusterReady = cluster === true;
  const breakoutReady = resistanceDistance != null && resistanceDistance <= 2 && relativeVolume != null && relativeVolume >= 1.25;
  const rsiNeutral = rsi != null && rsi >= 40 && rsi <= 70;
  const aboveSMA200 = price != null && sma200 != null && price > sma200;

  // Setup 1: Bollinger Squeeze + Volume
  if (squeezeReady && strongVolume && rsiNeutral) {
    setups.push({
      type: 'BOLLINGER_SQUEEZE',
      label: 'Bollinger Squeeze + Volume',
      description: 'Bollinger Band compression with rising relative volume. Awaiting breakout confirmation.',
      strength: trendConfirmed ? 'HIGH' : 'MEDIUM',
      confidence: trendConfirmed ? 80 : 65,
    });
  }

  // Setup 2: Price Cluster + Volume
  if (clusterReady && strongVolume && rsiNeutral) {
    setups.push({
      type: 'PRICE_CLUSTER',
      label: 'Price Cluster + Volume',
      description: 'Tight price range consolidation with above-average volume. Coiled spring pattern.',
      strength: trendConfirmed ? 'HIGH' : 'MEDIUM',
      confidence: trendConfirmed ? 78 : 62,
    });
  }

  // Setup 3: Breakout Pressure
  if (breakoutReady && trendConfirmed && rsiNeutral) {
    setups.push({
      type: 'BREAKOUT_PRESSURE',
      label: 'Breakout Pressure',
      description: 'Price approaching resistance with volume support and confirmed uptrend.',
      strength: 'HIGH',
      confidence: 75,
    });
  }

  // Setup 4: Trend Pullback (buy the dip in uptrend)
  if (trendConfirmed && aboveSMA200 && rsi != null && rsi >= 40 && rsi <= 55 && relativeVolume != null && relativeVolume >= 1.0) {
    setups.push({
      type: 'TREND_PULLBACK',
      label: 'Trend Pullback',
      description: 'Pullback to rising moving averages in confirmed uptrend with healthy RSI.',
      strength: 'MEDIUM',
      confidence: 70,
    });
  }

  // Setup 5: Support Test
  if (support != null && price != null && resistance != null) {
    const supportDist = ((price - support) / price) * 100;
    if (supportDist <= 3 && relativeVolume != null && relativeVolume >= 1.1 && rsiNeutral) {
      setups.push({
        type: 'SUPPORT_TEST',
        label: 'Support Test',
        description: 'Price testing key support level with volume confirmation.',
        strength: trendConfirmed ? 'MEDIUM' : 'LOW',
        confidence: trendConfirmed ? 65 : 50,
      });
    }
  }

  return setups;
}

// ============================================================================
// ENTRY / TARGET / INVALIDATION ZONES
// ============================================================================

function calculateSwingZones(price, support, resistance, atr, riskReward) {
  if (price == null || price <= 0) {
    return { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null };
  }

  const stopLoss = support != null && support > 0
    ? Math.min(price * 0.97, support * 0.995)
    : price * 0.97;

  if (stopLoss >= price) {
    return { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null };
  }

  const risk = price - stopLoss;
  const riskPercent = round((risk / price) * 100);

  let target1 = resistance != null && resistance > price ? resistance : price + risk * 2;
  let target2 = price + risk * 3;

  const reward1 = target1 - price;
  const rewardPercent = round((reward1 / price) * 100);

  const entryLow = support != null && support > 0 ? support : price * 0.99;
  const entryHigh = price;
  const entryZone = round(entryLow) + ' - ' + round(entryHigh);

  const invalidation = stopLoss;

  return {
    entryZone,
    target1: round(target1),
    target2: round(target2),
    invalidation: round(invalidation),
    riskPercent,
    rewardPercent,
    stopLoss: round(stopLoss),
  };
}

// ============================================================================
// REASONS / WARNINGS / FLAGS
// ============================================================================

function buildSwingReasons(data, setups, zones) {
  const reasons = [];
  const { price, rsi, relativeVolume, sma20, sma50, sma200, bollinger, atr, resistanceDistance, cluster } = data;

  if (setups.length > 0) {
    reasons.push('Setup: ' + setups.map(s => s.label).join(', '));
  }

  if (rsi != null) {
    if (rsi >= 45 && rsi <= 65) reasons.push('RSI ' + round(rsi) + ' in neutral zone');
    else if (rsi > 70) reasons.push('RSI ' + round(rsi) + ' overbought');
    else if (rsi < 30) reasons.push('RSI ' + round(rsi) + ' oversold');
  }

  if (relativeVolume != null) {
    if (relativeVolume >= 1.5) reasons.push('RVOL ' + round(relativeVolume) + 'x strong');
    else if (relativeVolume >= 1.0) reasons.push('RVOL ' + round(relativeVolume) + 'x healthy');
    else reasons.push('RVOL ' + round(relativeVolume) + 'x weak');
  }

  if (sma20 != null && sma50 != null && price != null) {
    if (price > sma20 && price > sma50) reasons.push('Price above SMA20/50');
    else if (price < sma20 && price < sma50) reasons.push('Price below SMA20/50');
  }

  if (sma200 != null && price != null) {
    if (price > sma200) reasons.push('Above SMA200 (long-term uptrend)');
    else reasons.push('Below SMA200 (long-term downtrend)');
  }

  if (bollinger?.squeeze) reasons.push('Bollinger Squeeze active');
  if (cluster) reasons.push('Price cluster detected');

  if (resistanceDistance != null) {
    if (resistanceDistance <= 1) reasons.push('Near resistance (' + round(resistanceDistance) + '%)');
    else if (resistanceDistance <= 3) reasons.push('Approaching resistance (' + round(resistanceDistance) + '%)');
  }

  if (atr != null && price != null) {
    const atrPct = round((atr / price) * 100);
    reasons.push('ATR ' + atrPct + '% of price');
  }

  if (zones?.riskReward != null) {
    reasons.push('R/R ' + round(zones.riskReward));
  }

  return reasons.slice(0, 6);
}

function buildSwingWarnings(data, setups, zones) {
  const warnings = [];
  const { rsi, relativeVolume, resistanceDistance, atr, price, sma20, sma50, sma200 } = data;

  if (rsi != null && rsi > 75) warnings.push('RSI_OVERBOUGHT');
  if (rsi != null && rsi < 25) warnings.push('RSI_OVERSOLD');
  if (relativeVolume != null && relativeVolume < 0.8) warnings.push('LOW_VOLUME');
  if (resistanceDistance != null && resistanceDistance <= 0.5) warnings.push('AT_RESISTANCE');
  if (atr != null && price != null && (atr / price) * 100 > 8) warnings.push('HIGH_ATR');
  if (price != null && sma200 != null && price < sma200 && sma50 != null && sma20 != null && sma20 < sma50) warnings.push('DOWNTREND_STRUCTURE');
  if (setups.length === 0) warnings.push('NO_CLEAR_SETUP');
  if (zones?.riskReward != null && zones.riskReward < 1.5) warnings.push('LOW_RISK_REWARD');

  return warnings;
}

function buildSwingFlags(data, setups, zones) {
  const flags = [];
  const { relativeVolume, rsi, bollinger, cluster, resistanceDistance, sma20, sma50, sma200, price } = data;

  if (relativeVolume != null && relativeVolume >= 2.0) flags.push('HIGH_RVOL');
  if (rsi != null && rsi >= 45 && rsi <= 65) flags.push('RSI_NEUTRAL');
  if (bollinger?.squeeze) flags.push('BOLLINGER_SQUEEZE');
  if (cluster) flags.push('PRICE_CLUSTER');
  if (resistanceDistance != null && resistanceDistance <= 2) flags.push('NEAR_RESISTANCE');
  if (price != null && sma20 != null && sma50 != null && sma200 != null && price > sma20 && price > sma50 && price > sma200) flags.push('STRONG_UPTREND');
  if (setups.length >= 2) flags.push('MULTIPLE_SETUPS');
  if (zones?.riskReward != null && zones.riskReward >= 2.5) flags.push('EXCELLENT_RR');

  return flags;
}

// ============================================================================
// RANKING
// ============================================================================

function rankSwingOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };
  const sorted = [...results].sort((a, b) => {
    const sa = a.swingScore ?? -1;
    const sb = b.swingScore ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    const ra = a.riskReward ?? -1;
    const rb = b.riskReward ?? -1;
    return rb - ra;
  });
  const ranked = sorted.slice(0, 20);
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  return { ranked, top, alternatives };
}

// ============================================================================
// MAIN ENTRY: PURE FUNCTION
// ============================================================================

/**
 * Build complete swing intelligence from pre-fetched market data.
 * Pure function — no network calls.
 *
 * @param {Object} marketData - Output from market-engine.js analyzeQuote or similar
 * @returns {Object} swing intelligence
 */
export function buildSwingIntelligence(marketData) {
  if (!marketData) {
    return defaultSwingIntelligence();
  }

  const {
    price,
    previousClose,
    changePercent,
    volume,
    averageVolume20,
    relativeVolume,
    momentumPercent,
    rsi,
    sma20,
    sma50,
    sma200,
    resistance: resistance20,
    support: support20,
    resistanceDistancePercent,
    bollingerBandwidth,
    squeeze,
    squeezeScore,
    cluster,
    clusterRangePercent,
    clusterScore,
    targetPrice,
    stopLoss,
    riskReward,
    technicalScore,
    setupScore,
    signal,
    signalStrength,
    directionBias,
    riskLevel,
    dayHigh,
    dayLow,
    highs,
    lows,
    closes,
    volumes,
  } = marketData;

  // Calculate SMA200 if not provided (need 200 closes)
  let calculatedSma200 = sma200;
  if (calculatedSma200 == null && Array.isArray(closes) && closes.length >= 200) {
    calculatedSma200 = sma(closes, 200);
  }

  // Calculate Bollinger if not provided
  let bollinger = null;
  if (bollingerBandwidth != null) {
    bollinger = { bandwidth: bollingerBandwidth, squeeze: squeeze, score: squeezeScore };
  } else if (Array.isArray(closes) && closes.length >= 20) {
    bollinger = calculateBollinger(closes);
  }

  // Calculate ATR if not provided
  let atr = null;
  if (Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes) && highs.length >= 15) {
    atr = calculateATR(highs, lows, closes);
  }

  // Calculate VWAP if data available
  let vwap = null;
  if (Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes) && Array.isArray(volumes)) {
    vwap = calculateVWAP(highs, lows, closes, volumes);
  }

  // Calculate dollar volume
  const dollarVolume = price != null && volume != null ? price * volume : null;

  // Calculate ATR percentile (simplified - compare to 20-day ATR range)
  let atrPercentile = null;
  if (atr != null && Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes) && highs.length >= 20) {
    const recentAtr = calculateATR(highs.slice(-20), lows.slice(-20), closes.slice(-20), 14);
    if (recentAtr != null && recentAtr > 0) {
      atrPercentile = Math.min(1, atr / recentAtr);
    }
  }

  // Prepare data object for scoring
  const scoringData = {
    price,
    sma20,
    sma50,
    sma200: calculatedSma200,
    rsi,
    bollinger,
    relativeVolume,
    resistanceDistance: resistanceDistancePercent,
    support: support20,
    resistance: resistance20,
    atr,
    cluster,
    trendScore: null, // will be calculated
    breakoutScore: null, // will be calculated
  };

  // Calculate component scores
  const trendScore = calculateTrendScore(price, sma20, sma50, calculatedSma200);
  const momentumScore = calculateMomentumScore(price, closes);
  const structureScore = calculateStructureScore(price, highs, lows, resistance20, support20, null);
  const volumeScore = calculateVolumeScore(relativeVolume, volume, averageVolume20, dollarVolume);
  const rsiScore = calculateRSIScore(rsi);
  const bollingerScore = calculateBollingerScore(bollinger);
  const atrQualityScore = calculateATRQualityScore(price, atr, atrPercentile);
  const riskRewardScore = calculateRiskRewardScore(riskReward);

  scoringData.trendScore = trendScore;
  scoringData.breakoutScore = structureScore; // reuse structure as breakout proxy

  // Detect setups
  const setups = detectSwingSetups(scoringData);

  // Calculate zones
  const zones = calculateSwingZones(price, support20, resistance20, atr, riskReward);

  // Calculate final swing score (weighted average of available components)
  const components = [
    { score: trendScore, weight: SWING_WEIGHTS.trend },
    { score: momentumScore, weight: SWING_WEIGHTS.momentum },
    { score: structureScore, weight: SWING_WEIGHTS.structure },
    { score: volumeScore, weight: SWING_WEIGHTS.volume },
    { score: rsiScore, weight: SWING_WEIGHTS.rsi },
    { score: bollingerScore, weight: SWING_WEIGHTS.bollinger },
    { score: riskRewardScore, weight: SWING_WEIGHTS.riskReward },
    { score: atrQualityScore, weight: SWING_WEIGHTS.atrQuality },
  ];

  const availableComponents = components.filter(c => c.score != null);
  let swingScore = null;
  if (availableComponents.length > 0) {
    const totalWeight = availableComponents.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = availableComponents.reduce((sum, c) => sum + c.score * c.weight, 0);
    swingScore = Math.round(clamp(weightedSum / totalWeight));
  }

  const quality = classifySwingQuality(swingScore);

  // Build reasons, warnings, flags
  const reasons = buildSwingReasons(scoringData, setups, zones);
  const warnings = buildSwingWarnings(scoringData, setups, zones);
  const flags = buildSwingFlags(scoringData, setups, zones);

  // Data availability
  const dataAvailability = {
    price: price != null,
    volume: volume != null,
    technicals: technicalScore != null,
    rsi: rsi != null,
    sma20: sma20 != null,
    sma50: sma50 != null,
    sma200: calculatedSma200 != null,
    bollinger: bollinger != null,
    atr: atr != null,
    vwap: vwap != null,
    supportResistance: support20 != null && resistance20 != null,
    riskReward: riskReward != null,
  };

  const availableCount = Object.values(dataAvailability).filter(Boolean).length;
  const totalCount = Object.keys(dataAvailability).length;
  const dataCompleteness = Math.round((availableCount / totalCount) * 100);

  return {
    symbol: marketData.ticker || marketData.symbol || null,
    price: round(price),
    changePercent: round(changePercent),
    swingScore,
    quality,
    setups,
    zones,
    componentScores: {
      trend: trendScore,
      momentum: momentumScore,
      structure: structureScore,
      volume: volumeScore,
      rsi: rsiScore,
      bollinger: bollingerScore,
      riskReward: riskRewardScore,
      atrQuality: atrQualityScore,
    },
    reasons,
    warnings,
    flags,
    dataAvailability,
    dataCompleteness,
    vwap,
    atr: round(atr),
    atrPercentile: atrPercentile != null ? round(atrPercentile * 100) : null,
    bollinger: bollinger ? {
      bandwidth: bollinger.bandwidth,
      squeeze: bollinger.squeeze,
      score: bollinger.score,
      middle: bollinger.middle,
      upper: bollinger.upper,
      lower: bollinger.lower,
    } : null,
    sma20: round(sma20),
    sma50: round(sma50),
    sma200: round(calculatedSma200),
    resistance: round(resistance20),
    support: round(support20),
    resistanceDistance: round(resistanceDistancePercent),
     cluster: cluster,
     clusterRange: round(clusterRangePercent),
     relativeVolume: relativeVolume != null ? round(relativeVolume) : null,
     riskReward: riskReward != null ? round(riskReward) : null,
    riskPercent: zones.riskPercent,
    rewardPercent: zones.rewardPercent,
    technicalScore: technicalScore != null ? Math.round(technicalScore) : null,
    setupScore: setupScore != null ? Math.round(setupScore) : null,
    signal,
    signalStrength,
    directionBias,
    riskLevel,
    disclaimer: 'Swing Intelligence is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

export function defaultSwingIntelligence() {
  return {
    symbol: null,
    price: null,
    changePercent: null,
    swingScore: null,
    quality: 'UNAVAILABLE',
    setups: [],
    zones: { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null, stopLoss: null },
    componentScores: {
      trend: null,
      momentum: null,
      structure: null,
      volume: null,
      rsi: null,
      bollinger: null,
      riskReward: null,
      atrQuality: null,
    },
    reasons: [],
    warnings: [],
    flags: [],
    dataAvailability: {
      price: false,
      volume: false,
      technicals: false,
      rsi: false,
      sma20: false,
      sma50: false,
      sma200: false,
      bollinger: false,
      atr: false,
      vwap: false,
      supportResistance: false,
      riskReward: false,
    },
    dataCompleteness: 0,
    vwap: null,
    atr: null,
    atrPercentile: null,
    bollinger: null,
    sma20: null,
    sma50: null,
    sma200: null,
    resistance: null,
    support: null,
    resistanceDistance: null,
     cluster: false,
     clusterRange: null,
     relativeVolume: null,
     riskReward: null,
    riskPercent: null,
    rewardPercent: null,
    technicalScore: null,
    setupScore: null,
    signal: 'UNAVAILABLE',
    signalStrength: 'LOW',
    directionBias: 'ميل فني محايد',
    riskLevel: 'غير محدد',
    disclaimer: 'Swing Intelligence is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

// Export helpers for testing
export {
  n,
  clamp,
  round,
  average,
  sma,
  ema,
  calculateRSI,
  calculateATR,
  calculateBollinger,
  calculateVWAP,
  calculateTrendScore,
  calculateMomentumScore,
  calculateStructureScore,
  calculateVolumeScore,
  calculateRSIScore,
  calculateBollingerScore,
  calculateATRQualityScore,
  calculateRiskRewardScore,
  detectSwingSetups,
  calculateSwingZones,
  buildSwingReasons,
  buildSwingWarnings,
  buildSwingFlags,
   classifySwingQuality,
   rankSwingOpportunities,
   SWING_WEIGHTS,
  SWING_QUALITY_THRESHOLDS,
};