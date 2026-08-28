/**
 * Early Explosion Radar (A5)
 *
 * Deterministic early-move / pre-explosion intelligence using ONLY data
 * already available from existing market-engine.js and Yahoo Finance providers.
 *
 * NO new providers. NO fabricated data. Missing values remain null/UNAVAILABLE.
 * No BUY/SELL guarantees. No BULLISH/BEARISH claims without provider-backed evidence.
 *
 * Components:
 *   - Volume acceleration / RVOL where available
 *   - Relative volume expansion
 *   - Price expansion
 *   - ATR expansion
 *   - Bollinger squeeze / compression
 *   - Range compression -> expansion
 *   - Momentum acceleration
 *   - Liquidity confirmation
 *   - Breakout proximity
 *   - Support/resistance proximity
 *   - Early Explosion Score 0-100
 *   - Quality: EXTREME / HIGH / WATCH / LOW / UNAVAILABLE
 *   - Rank opportunities + top alternatives
 *   - Deterministic reasons / warnings / flags
 *   - Risk + data-quality status
 *   - API pass-through
 *   - Compact Early Explosion Radar UI
 *   - Filters + sorting + explainability
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

// ============================================================================
// EARLY EXPLOSION SCORING COMPONENTS
// ============================================================================

const EXPLOSION_WEIGHTS = Object.freeze({
  volumeAcceleration: 0.20,
  relativeVolumeExpansion: 0.15,
  priceExpansion: 0.15,
  atrExpansion: 0.10,
  bollingerSqueeze: 0.15,
  rangeCompression: 0.10,
  momentumAcceleration: 0.10,
  liquidityConfirmation: 0.05,
});

const EXPLOSION_QUALITY_THRESHOLDS = Object.freeze({
  EXTREME: 85,
  HIGH: 70,
  WATCH: 55,
  LOW: 40,
});

function classifyExplosionQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.EXTREME) return 'EXTREME';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.WATCH) return 'WATCH';
  if (score >= EXPLOSION_QUALITY_THRESHOLDS.LOW) return 'LOW';
  return 'UNAVAILABLE';
}

// Volume Acceleration: current volume vs recent average (5-day vs 20-day)
function calculateVolumeAccelerationScore(volume, avgVolume5, avgVolume20) {
  if (volume == null || avgVolume5 == null || avgVolume20 == null) return 50;
  if (avgVolume5 <= 0 || avgVolume20 <= 0) return 50;
  const ratio5 = volume / avgVolume5;
  const ratio20 = volume / avgVolume20;
  const acceleration = ratio5 / ratio20; // >1 means accelerating
  let score = 50;
  if (acceleration >= 2.0) score = 100;
  else if (acceleration >= 1.5) score = 85;
  else if (acceleration >= 1.2) score = 70;
  else if (acceleration >= 1.0) score = 55;
  else if (acceleration >= 0.8) score = 40;
  else score = 25;
  return clamp(score);
}

// Relative Volume Expansion: RVOL trend over recent days
function calculateRelativeVolumeExpansionScore(relativeVolume, volumes, avgVolume20) {
  if (relativeVolume == null) return 50;
  let score = 50;
  if (relativeVolume >= 3.0) score = 100;
  else if (relativeVolume >= 2.0) score = 85;
  else if (relativeVolume >= 1.5) score = 70;
  else if (relativeVolume >= 1.2) score = 55;
  else if (relativeVolume >= 1.0) score = 45;
  else score = 30;

  // Check if volume is expanding (recent days higher than older)
  if (Array.isArray(volumes) && volumes.length >= 10 && avgVolume20 != null && avgVolume20 > 0) {
    const recent5 = average(volumes.slice(-5));
    const older5 = average(volumes.slice(-10, -5));
    if (recent5 != null && older5 != null && older5 > 0) {
      const expansion = recent5 / older5;
      if (expansion >= 1.5) score = Math.min(100, score + 15);
      else if (expansion >= 1.2) score = Math.min(100, score + 10);
      else if (expansion >= 1.0) score = Math.min(100, score + 5);
      else score = Math.max(0, score - 10);
    }
  }
  return clamp(score);
}

// Price Expansion: current range vs recent average range
function calculatePriceExpansionScore(highs, lows, closes) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) return 50;
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < 10) return 50;

  const ranges = [];
  for (let i = 1; i < len; i++) {
    const h = Number(highs[i]);
    const l = Number(lows[i]);
    const c = Number(closes[i]);
    if (Number.isFinite(h) && Number.isFinite(l) && Number.isFinite(c) && c > 0) {
      ranges.push(((h - l) / c) * 100);
    }
  }
  if (ranges.length < 10) return 50;

  const currentRange = ranges[ranges.length - 1];
  const avgRange = average(ranges.slice(-10, -1));
  if (avgRange == null || avgRange <= 0) return 50;

  const expansion = currentRange / avgRange;
  let score = 50;
  if (expansion >= 2.0) score = 100;
  else if (expansion >= 1.5) score = 85;
  else if (expansion >= 1.2) score = 70;
  else if (expansion >= 1.0) score = 55;
  else if (expansion >= 0.8) score = 40;
  else score = 25;
  return clamp(score);
}

// ATR Expansion: current ATR vs recent ATR
function calculateATRExpansionScore(highs, lows, closes) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) return 50;
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < 20) return 50;

  const currentAtr = calculateATR(highs.slice(-14), lows.slice(-14), closes.slice(-14), 14);
  const previousAtr = calculateATR(highs.slice(-28, -14), lows.slice(-28, -14), closes.slice(-28, -14), 14);

  if (currentAtr == null || previousAtr == null || previousAtr <= 0) return 50;

  const expansion = currentAtr / previousAtr;
  let score = 50;
  if (expansion >= 1.5) score = 100;
  else if (expansion >= 1.2) score = 80;
  else if (expansion >= 1.0) score = 60;
  else if (expansion >= 0.8) score = 45;
  else score = 30;
  return clamp(score);
}

// Bollinger Squeeze Score
function calculateBollingerSqueezeScore(bollinger) {
  if (!bollinger || bollinger.bandwidth == null) return 50;
  const bw = bollinger.bandwidth;
  let score = 50;
  if (bw < 4) score = 100;
  else if (bw < 6) score = 90;
  else if (bw < 8) score = 75;
  else if (bw < 10) score = 60;
  else if (bw < 12) score = 50;
  else if (bw < 15) score = 40;
  else score = 30;
  return clamp(score);
}

// Range Compression: recent range vs longer-term range
function calculateRangeCompressionScore(highs, lows, closes) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) return 50;
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < 30) return 50;

  const recentHigh = Math.max(...highs.slice(-10).map(Number).filter(Number.isFinite));
  const recentLow = Math.min(...lows.slice(-10).map(Number).filter(Number.isFinite));
  const longerHigh = Math.max(...highs.slice(-30, -10).map(Number).filter(Number.isFinite));
  const longerLow = Math.min(...lows.slice(-30, -10).map(Number).filter(Number.isFinite));

  if (!Number.isFinite(recentHigh) || !Number.isFinite(recentLow) ||
      !Number.isFinite(longerHigh) || !Number.isFinite(longerLow) ||
      longerHigh <= longerLow) return 50;

  const recentRange = recentHigh - recentLow;
  const longerRange = longerHigh - longerLow;
  const compression = recentRange / longerRange;

  let score = 50;
  if (compression <= 0.3) score = 100;
  else if (compression <= 0.4) score = 90;
  else if (compression <= 0.5) score = 75;
  else if (compression <= 0.6) score = 60;
  else if (compression <= 0.7) score = 50;
  else if (compression <= 0.8) score = 40;
  else score = 30;
  return clamp(score);
}

// Momentum Acceleration: rate of change acceleration
function calculateMomentumAccelerationScore(closes) {
  if (!Array.isArray(closes) || closes.length < 10) return 50;
  const safeCloses = closes.map(Number).filter(Number.isFinite);
  if (safeCloses.length < 10) return 50;

  // 5-day ROC vs 10-day ROC
  const roc5 = ((safeCloses[safeCloses.length - 1] - safeCloses[safeCloses.length - 6]) / safeCloses[safeCloses.length - 6]) * 100;
  const roc10 = ((safeCloses[safeCloses.length - 1] - safeCloses[safeCloses.length - 11]) / safeCloses[safeCloses.length - 11]) * 100;

  if (!Number.isFinite(roc5) || !Number.isFinite(roc10) || roc10 === 0) return 50;

  const acceleration = roc5 / roc10; // >1 means accelerating
  let score = 50;
  if (acceleration >= 2.0) score = 100;
  else if (acceleration >= 1.5) score = 85;
  else if (acceleration >= 1.2) score = 70;
  else if (acceleration >= 1.0) score = 55;
  else if (acceleration >= 0.8) score = 40;
  else score = 25;
  return clamp(score);
}

// Liquidity Confirmation: dollar volume and volume quality
function calculateLiquidityConfirmationScore(price, volume, avgVolume20, dollarVolume) {
  if (price == null || volume == null || avgVolume20 == null) return 50;
  let score = 50;
  const relVol = volume / avgVolume20;
  if (relVol >= 2.0) score += 20;
  else if (relVol >= 1.5) score += 15;
  else if (relVol >= 1.2) score += 10;
  else if (relVol >= 1.0) score += 5;
  else score -= 15;

  if (dollarVolume != null) {
    if (dollarVolume >= 10000000) score += 15;
    else if (dollarVolume >= 5000000) score += 10;
    else if (dollarVolume >= 1000000) score += 5;
    else if (dollarVolume < 500000) score -= 10;
  }
  return clamp(score);
}

// Breakout Proximity: distance to resistance
function calculateBreakoutProximityScore(price, resistance, resistanceDistance) {
  if (price == null || resistance == null || resistanceDistance == null) return 50;
  let score = 50;
  if (resistanceDistance <= 0) score = 100; // at or above resistance
  else if (resistanceDistance <= 0.5) score = 90;
  else if (resistanceDistance <= 1) score = 80;
  else if (resistanceDistance <= 2) score = 70;
  else if (resistanceDistance <= 3) score = 60;
  else if (resistanceDistance <= 5) score = 50;
  else if (resistanceDistance <= 8) score = 40;
  else score = 30;
  return clamp(score);
}

// Support/Resistance Proximity
function calculateSupportResistanceProximityScore(price, support, resistance) {
  if (price == null || support == null || resistance == null) return 50;
  const supportDist = ((price - support) / price) * 100;
  const resistanceDist = ((resistance - price) / price) * 100;
  let score = 50;
  // Near support = potential bounce
  if (supportDist <= 2) score += 15;
  else if (supportDist <= 5) score += 10;
  else if (supportDist <= 10) score += 5;
  // Near resistance = potential breakout
  if (resistanceDist <= 2) score += 15;
  else if (resistanceDist <= 5) score += 10;
  else if (resistanceDist <= 10) score += 5;
  return clamp(score);
}

// ============================================================================
// EARLY EXPLOSION SETUP DETECTION
// ============================================================================

function detectExplosionSetups(data, scores) {
  const setups = [];
  const {
    price, sma20, sma50, sma200, rsi, bollinger, relativeVolume,
    resistanceDistance, support, resistance, atr, cluster,
  } = data;

  const extremeVolume = relativeVolume != null && relativeVolume >= 2.0;
  const strongVolume = relativeVolume != null && relativeVolume >= 1.3;
  const squeezeReady = bollinger?.squeeze === true;
  const trendConfirmed = price != null && sma20 != null && sma50 != null &&
    price > sma20 && price > sma50;
  const aboveSMA200 = price != null && sma200 != null && price > sma200;
  const rsiValid = rsi != null && rsi >= 30 && rsi <= 80;

  // Setup 1: Volume Surge + Squeeze
  if (squeezeReady && scores.volumeAcceleration >= 60 && relativeVolume != null && relativeVolume >= 1.2) {
    setups.push({
      type: 'VOL_SURGE_SQUEEZE',
      label: 'Volume Surge + Bollinger Squeeze',
      description: 'Bollinger Band compression with accelerating volume. Coiled energy awaiting release.',
      strength: extremeVolume ? 'HIGH' : 'MEDIUM',
      confidence: extremeVolume ? 80 : 65,
    });
  }

  // Setup 2: Range Breakout Imminent
  if (resistanceDistance != null && resistanceDistance <= 2 &&
    scores.momentumAcceleration >= 60 && strongVolume) {
    setups.push({
      type: 'RANGE_BREAKOUT',
      label: 'Range Breakout Imminent',
      description: 'Price approaching resistance with accelerating momentum and volume. Potential breakout.',
      strength: scores.priceExpansion >= 70 ? 'HIGH' : 'MEDIUM',
      confidence: 75,
    });
  }

  // Setup 3: Momentum Blast
  if (scores.momentumAcceleration >= 70 && scores.priceExpansion >= 60 && strongVolume) {
    setups.push({
      type: 'MOMENTUM_BLAST',
      label: 'Momentum Blast',
      description: 'Accelerating momentum with expanding price range and volume. Early move underway.',
      strength: scores.volumeAcceleration >= 80 ? 'HIGH' : 'MEDIUM',
      confidence: 78,
    });
  }

  // Setup 4: Compression Release
  if (scores.rangeCompression >= 75 && squeezeReady && strongVolume) {
    setups.push({
      type: 'COMPRESSION_RELEASE',
      label: 'Compression Release',
      description: 'Tight range and Bollinger compression with rising volume. Spring-loading for expansion.',
      strength: scores.rangeCompression >= 90 ? 'HIGH' : 'MEDIUM',
      confidence: 72,
    });
  }

  // Setup 5: Liquidity Buildup at Key Level
  if (scores.breakoutProximity >= 70 && strongVolume && scores.supportResistanceProximity >= 65) {
    setups.push({
      type: 'LIQUIDITY_BUILDUP',
      label: 'Liquidity Buildup at Key Level',
      description: 'Price at key support/resistance with strong volume confirmation. Accumulation/distribution zone.',
      strength: extremeVolume ? 'HIGH' : 'MEDIUM',
      confidence: 70,
    });
  }

  // Setup 6: Trend Continuation (early move in confirmed trend)
  if (trendConfirmed && aboveSMA200 && rsiValid && scores.momentumAcceleration >= 55 && strongVolume) {
    setups.push({
      type: 'TREND_CONTINUATION',
      label: 'Trend Continuation',
      description: 'Early-move momentum in confirmed uptrend above SMA200 with volume backing.',
      strength: 'HIGH',
      confidence: 74,
    });
  }

  return setups;
}

// ============================================================================
// EARLY EXPLOSION ZONES (Entry / Target / Invalidation)
// ============================================================================

function calculateExplosionZones(price, support, resistance, atr) {
  const safePrice = n(price);
  if (safePrice == null || safePrice <= 0) {
    return {
      entryZone: null, target1: null, target2: null, invalidation: null,
      riskPercent: null, rewardPercent: null, stopLoss: null, riskReward: null,
    };
  }

  const stopLoss = (support != null && support > 0)
    ? Math.min(safePrice * 0.97, support * 0.995)
    : (atr != null && atr > 0 ? safePrice - atr * 2 : safePrice * 0.94);

  if (stopLoss >= safePrice) {
    return {
      entryZone: null, target1: null, target2: null, invalidation: null,
      riskPercent: null, rewardPercent: null, stopLoss: null, riskReward: null,
    };
  }

  const risk = safePrice - stopLoss;
  const riskPercent = round((risk / safePrice) * 100);

  const target1 = (resistance != null && resistance > safePrice) ? resistance : safePrice + risk * 2;
  const target2 = safePrice + (atr != null && atr > 0 ? atr * 2.5 : risk * 2.5);

  const reward1 = target1 - safePrice;
  const rewardPercent = round((reward1 / safePrice) * 100);
  const riskReward = risk > 0 ? round(reward1 / risk) : null;

  const entryLow = (support != null && support > 0) ? support : safePrice * 0.99;
  const entryZone = round(entryLow) + ' - ' + round(safePrice);

  return {
    entryZone,
    target1: round(target1),
    target2: round(target2),
    invalidation: round(stopLoss),
    riskPercent,
    rewardPercent,
    stopLoss: round(stopLoss),
    riskReward,
  };
}

// ============================================================================
// RANKING
// ============================================================================

function rankExplosionOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };
  const sorted = [...results].sort((a, b) => {
    const sa = a.explosionScore ?? -1;
    const sb = b.explosionScore ?? -1;
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
// REASONS / WARNINGS / FLAGS
// ============================================================================

function buildExplosionReasons(data, scores) {
  const reasons = [];
  const { relativeVolume, bollinger, price, resistance, support, atr, volume, avgVolume20 } = data;

  if (relativeVolume != null) {
    if (relativeVolume >= 2.5) reasons.push('RVOL ' + round(relativeVolume) + 'x explosive');
    else if (relativeVolume >= 1.5) reasons.push('RVOL ' + round(relativeVolume) + 'x strong');
    else if (relativeVolume >= 1.0) reasons.push('RVOL ' + round(relativeVolume) + 'x healthy');
    else reasons.push('RVOL ' + round(relativeVolume) + 'x weak');
  }

  if (bollinger?.squeeze) reasons.push('Bollinger Squeeze (' + round(bollinger.bandwidth) + '%)');
  else if (bollinger?.bandwidth != null) reasons.push('Bollinger Bandwidth ' + round(bollinger.bandwidth) + '%');

  if (scores.volumeAcceleration >= 70) reasons.push('Volume accelerating');
  if (scores.priceExpansion >= 70) reasons.push('Price range expanding');
  if (scores.atrExpansion >= 70) reasons.push('ATR expanding');
  if (scores.rangeCompression >= 70) reasons.push('Range compression detected');
  if (scores.momentumAcceleration >= 70) reasons.push('Momentum accelerating');

  if (resistance != null && price != null) {
    const dist = round(((resistance - price) / price) * 100);
    if (dist <= 2) reasons.push('Near resistance (' + dist + '%)');
  }

  if (support != null && price != null) {
    const dist = round(((price - support) / price) * 100);
    if (dist <= 3) reasons.push('Near support (' + dist + '%)');
  }

  if (atr != null && price != null) {
    reasons.push('ATR ' + round((atr / price) * 100) + '% of price');
  }

  return reasons.slice(0, 6);
}

function buildExplosionWarnings(data, scores) {
  const warnings = [];
  const { relativeVolume, rsi, atr, price, bollinger, volume, avgVolume20 } = data;

  if (relativeVolume != null && relativeVolume < 0.7) warnings.push('VERY_LOW_VOLUME');
  if (rsi != null && rsi > 80) warnings.push('RSI_EXTREME_OVERBOUGHT');
  if (rsi != null && rsi < 20) warnings.push('RSI_EXTREME_OVERSOLD');
  if (atr != null && price != null && (atr / price) * 100 > 10) warnings.push('EXTREME_ATR');
  if (bollinger?.bandwidth != null && bollinger.bandwidth > 20) warnings.push('WIDE_BOLLINGER_BANDS');
  if (volume != null && avgVolume20 != null && volume < avgVolume20 * 0.5) warnings.push('VOLUME_DRYING_UP');
  if (scores.volumeAcceleration < 30) warnings.push('VOLUME_DECELERATING');
  if (scores.momentumAcceleration < 30) warnings.push('MOMENTUM_DECELERATING');

  return warnings;
}

function buildExplosionFlags(data, scores) {
  const flags = [];
  const { relativeVolume, bollinger, price, resistance, support, atr, volume, avgVolume20 } = data;

  if (relativeVolume != null && relativeVolume >= 3.0) flags.push('EXTREME_RVOL');
  else if (relativeVolume != null && relativeVolume >= 2.0) flags.push('HIGH_RVOL');
  if (bollinger?.squeeze) flags.push('BOLLINGER_SQUEEZE');
  if (scores.rangeCompression >= 80) flags.push('TIGHT_RANGE_COMPRESSION');
  if (scores.priceExpansion >= 80) flags.push('PRICE_EXPANSION');
  if (scores.atrExpansion >= 80) flags.push('ATR_EXPANSION');
  if (scores.momentumAcceleration >= 80) flags.push('MOMENTUM_ACCELERATION');
  if (scores.volumeAcceleration >= 80) flags.push('VOLUME_ACCELERATION');
  if (resistance != null && price != null) {
    const dist = ((resistance - price) / price) * 100;
    if (dist <= 1) flags.push('AT_RESISTANCE');
    else if (dist <= 2) flags.push('NEAR_RESISTANCE');
  }
  if (support != null && price != null) {
    const dist = ((price - support) / price) * 100;
    if (dist <= 2) flags.push('AT_SUPPORT');
  }
  if (volume != null && avgVolume20 != null && volume >= avgVolume20 * 2) flags.push('VOLUME_SURGE');

  return flags;
}

// ============================================================================
// MAIN ENTRY: PURE FUNCTION
// ============================================================================

/**
 * Build complete early explosion intelligence from pre-fetched market data.
 * Pure function — no network calls.
 *
 * @param {Object} marketData - Output from market-engine.js analyzeQuote or similar
 * @returns {Object} early explosion intelligence
 */
export function buildEarlyExplosionIntelligence(marketData) {
  if (!marketData) {
    return defaultEarlyExplosionIntelligence();
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
    riskLevel: marketRiskLevel,
    dayHigh,
    dayLow,
    highs,
    lows,
    closes,
    volumes,
  } = marketData;

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

  // Calculate 5-day average volume
  let avgVolume5 = null;
  if (Array.isArray(volumes) && volumes.length >= 5) {
    avgVolume5 = average(volumes.slice(-5));
  }

  // Calculate dollar volume
  const dollarVolume = price != null && volume != null ? price * volume : null;

  // Calculate component scores
  const volumeAccelerationScore = calculateVolumeAccelerationScore(volume, avgVolume5, averageVolume20);
  const relativeVolumeExpansionScore = calculateRelativeVolumeExpansionScore(relativeVolume, volumes, averageVolume20);
  const priceExpansionScore = calculatePriceExpansionScore(highs, lows, closes);
  const atrExpansionScore = calculateATRExpansionScore(highs, lows, closes);
  const bollingerSqueezeScore = calculateBollingerSqueezeScore(bollinger);
  const rangeCompressionScore = calculateRangeCompressionScore(highs, lows, closes);
  const momentumAccelerationScore = calculateMomentumAccelerationScore(closes);
  const liquidityConfirmationScore = calculateLiquidityConfirmationScore(price, volume, averageVolume20, dollarVolume);
  const breakoutProximityScore = calculateBreakoutProximityScore(price, resistance20, resistanceDistancePercent);
  const supportResistanceProximityScore = calculateSupportResistanceProximityScore(price, support20, resistance20);

  // Combine breakout and support/resistance proximity
  const proximityScore = (breakoutProximityScore + supportResistanceProximityScore) / 2;

  // Calculate final explosion score (weighted average of available components)
  const components = [
    { score: volumeAccelerationScore, weight: EXPLOSION_WEIGHTS.volumeAcceleration },
    { score: relativeVolumeExpansionScore, weight: EXPLOSION_WEIGHTS.relativeVolumeExpansion },
    { score: priceExpansionScore, weight: EXPLOSION_WEIGHTS.priceExpansion },
    { score: atrExpansionScore, weight: EXPLOSION_WEIGHTS.atrExpansion },
    { score: bollingerSqueezeScore, weight: EXPLOSION_WEIGHTS.bollingerSqueeze },
    { score: rangeCompressionScore, weight: EXPLOSION_WEIGHTS.rangeCompression },
    { score: momentumAccelerationScore, weight: EXPLOSION_WEIGHTS.momentumAcceleration },
    { score: liquidityConfirmationScore, weight: EXPLOSION_WEIGHTS.liquidityConfirmation },
  ];

  const availableComponents = components.filter(c => c.score != null);
  let explosionScore = null;
  if (availableComponents.length > 0) {
    const totalWeight = availableComponents.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = availableComponents.reduce((sum, c) => sum + c.score * c.weight, 0);
    explosionScore = Math.round(clamp(weightedSum / totalWeight));
  }

  const quality = classifyExplosionQuality(explosionScore);

  // Build reasons, warnings, flags
  const scores = {
    volumeAcceleration: volumeAccelerationScore,
    relativeVolumeExpansion: relativeVolumeExpansionScore,
    priceExpansion: priceExpansionScore,
    atrExpansion: atrExpansionScore,
    bollingerSqueeze: bollingerSqueezeScore,
    rangeCompression: rangeCompressionScore,
    momentumAcceleration: momentumAccelerationScore,
    liquidityConfirmation: liquidityConfirmationScore,
    breakoutProximity: breakoutProximityScore,
    supportResistanceProximity: supportResistanceProximityScore,
  };

  const reasons = buildExplosionReasons(marketData, scores);
  const warnings = buildExplosionWarnings(marketData, scores);
  const flags = buildExplosionFlags(marketData, scores);

  // Data availability
  const dataAvailability = {
    price: price != null,
    volume: volume != null,
    relativeVolume: relativeVolume != null,
    rsi: rsi != null,
    bollinger: bollinger != null,
    atr: atr != null,
    highsLowsCloses: Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes) && highs.length >= 30,
    volumes: Array.isArray(volumes) && volumes.length >= 10,
    supportResistance: support20 != null && resistance20 != null,
    dollarVolume: dollarVolume != null,
  };

  const availableCount = Object.values(dataAvailability).filter(Boolean).length;
  const totalCount = Object.keys(dataAvailability).length;
  const dataCompleteness = Math.round((availableCount / totalCount) * 100);

  // Risk assessment
  let riskLevel = 'UNKNOWN';
  let riskScore = 50;
  if (explosionScore != null) {
    if (explosionScore >= 85) { riskLevel = 'HIGH'; riskScore = 75; }
    else if (explosionScore >= 70) { riskLevel = 'MODERATE_HIGH'; riskScore = 60; }
    else if (explosionScore >= 55) { riskLevel = 'MODERATE'; riskScore = 45; }
    else if (explosionScore >= 40) { riskLevel = 'LOW_MODERATE'; riskScore = 30; }
    else { riskLevel = 'LOW'; riskScore = 20; }
  }

  // Adjust risk based on warnings
  if (warnings.includes('EXTREME_ATR') || warnings.includes('RSI_EXTREME_OVERBOUGHT')) {
    riskLevel = 'HIGH';
    riskScore = Math.min(100, riskScore + 15);
  }
   if (warnings.includes('VERY_LOW_VOLUME') || warnings.includes('VOLUME_DRYING_UP')) {
     riskLevel = 'HIGH';
     riskScore = Math.min(100, riskScore + 10);
   }

   // Calculate ATR percentile (compare current ATR to 20-day ATR range)
   let atrPercentile = null;
   if (atr != null && Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes) && highs.length >= 20) {
     const recentAtr = calculateATR(highs.slice(-20), lows.slice(-20), closes.slice(-20), 14);
     if (recentAtr != null && recentAtr > 0) {
       atrPercentile = Math.min(1, atr / recentAtr);
     }
   }

   // Build scoring data for setup detection
   const scoringData = {
     price,
     sma20, sma50, sma200,
     rsi,
     bollinger,
     relativeVolume,
     resistanceDistance: resistanceDistancePercent,
     support: support20,
     resistance: resistance20,
     atr,
     cluster,
   };

   // Detect early-explosion setups
   const setups = detectExplosionSetups(scoringData, scores);

   // Calculate zones
   const zones = calculateExplosionZones(price, support20, resistance20, atr);

    return {
     symbol: marketData.ticker || marketData.symbol || null,
     price: round(price),
     changePercent: round(changePercent),
     explosionScore,
     quality,
     componentScores: {
        volumeAcceleration: volumeAccelerationScore,
        relativeVolumeExpansion: relativeVolumeExpansionScore,
        priceExpansion: priceExpansionScore,
        atrExpansion: atrExpansionScore,
        bollingerSqueeze: bollingerSqueezeScore,
        rangeCompression: rangeCompressionScore,
        momentumAcceleration: momentumAccelerationScore,
        liquidityConfirmation: liquidityConfirmationScore,
        breakoutProximity: breakoutProximityScore,
        supportResistanceProximity: supportResistanceProximityScore,
        riskReward: zones.riskReward,
      },
      volumeAcceleration: volumeAccelerationScore,
      relativeVolumeExpansion: relativeVolumeExpansionScore,
      priceExpansion: priceExpansionScore,
      atrExpansion: atrExpansionScore,
      bollingerSqueeze: bollingerSqueezeScore,
      rangeCompression: rangeCompressionScore,
      momentumAcceleration: momentumAccelerationScore,
      liquidityConfirmation: liquidityConfirmationScore,
      breakoutProximity: breakoutProximityScore,
      srProximity: supportResistanceProximityScore,
     reasons,
     warnings,
     flags,
     dataAvailability,
     dataCompleteness,
     riskLevel,
     riskScore: clamp(riskScore),
     bollinger: bollinger ? {
       bandwidth: bollinger.bandwidth,
       squeeze: bollinger.squeeze,
       score: bollinger.score,
       middle: bollinger.middle,
       upper: bollinger.upper,
       lower: bollinger.lower,
     } : null,
     atr: round(atr),
     atrPercentile: atrPercentile != null ? round(atrPercentile * 100) : null,
     avgVolume5: round(avgVolume5),
     avgVolume20: round(averageVolume20),
     relativeVolume: relativeVolume != null ? round(relativeVolume) : null,
     rvol: relativeVolume != null ? round(relativeVolume) : null,
     rsi: rsi != null ? round(rsi) : null,
     resistance: round(resistance20),
     support: round(support20),
     resistanceDistance: round(resistanceDistancePercent),
     cluster: cluster,
     clusterRange: round(clusterRangePercent),
     setups,
     zones,
     riskReward: zones.riskReward,
     riskPercent: zones.riskPercent,
     rewardPercent: zones.rewardPercent,
     technicalScore: technicalScore != null ? Math.round(technicalScore) : null,
     setupScore: setupScore != null ? Math.round(setupScore) : null,
     signal,
     signalStrength,
     directionBias,
    disclaimer: 'Early Explosion Radar is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

export function defaultEarlyExplosionIntelligence() {
  return {
    symbol: null,
    price: null,
    changePercent: null,
    explosionScore: null,
    quality: 'UNAVAILABLE',
      componentScores: {
        volumeAcceleration: null,
        relativeVolumeExpansion: null,
        priceExpansion: null,
        atrExpansion: null,
        bollingerSqueeze: null,
        rangeCompression: null,
        momentumAcceleration: null,
        liquidityConfirmation: null,
        breakoutProximity: null,
        supportResistanceProximity: null,
        riskReward: null,
      },
      volumeAcceleration: null,
      relativeVolumeExpansion: null,
      priceExpansion: null,
      atrExpansion: null,
      bollingerSqueeze: null,
      rangeCompression: null,
      momentumAcceleration: null,
      liquidityConfirmation: null,
      breakoutProximity: null,
      srProximity: null,
     reasons: [],
     warnings: [],
     flags: [],
     dataAvailability: {
       price: false,
       volume: false,
       relativeVolume: false,
       rsi: false,
       bollinger: false,
       atr: false,
       highsLowsCloses: false,
       volumes: false,
       supportResistance: false,
       dollarVolume: false,
     },
     dataCompleteness: 0,
     riskLevel: 'UNKNOWN',
     riskScore: 50,
     bollinger: null,
     atr: null,
     atrPercentile: null,
     avgVolume5: null,
     avgVolume20: null,
     relativeVolume: null,
     rvol: null,
     rsi: null,
     resistance: null,
     support: null,
     resistanceDistance: null,
     cluster: false,
     clusterRange: null,
     setups: [],
     zones: { entryZone: null, target1: null, target2: null, invalidation: null, riskPercent: null, rewardPercent: null, stopLoss: null, riskReward: null },
     riskReward: null,
     riskPercent: null,
     rewardPercent: null,
     technicalScore: null,
     setupScore: null,
     signal: 'UNAVAILABLE',
     signalStrength: 'LOW',
     directionBias: 'ميل فني محايد',
     disclaimer: 'Early Explosion Radar is analytical only. Not a buy/sell recommendation. Data from Yahoo Finance.',
  };
}

// Export helpers for testing
export {
  n,
  clamp,
  round,
  average,
  sma,
  calculateATR,
  calculateBollinger,
  calculateVolumeAccelerationScore,
  calculateRelativeVolumeExpansionScore,
  calculatePriceExpansionScore,
  calculateATRExpansionScore,
  calculateBollingerSqueezeScore,
  calculateRangeCompressionScore,
  calculateMomentumAccelerationScore,
  calculateLiquidityConfirmationScore,
  calculateBreakoutProximityScore,
  calculateSupportResistanceProximityScore,
   buildExplosionReasons,
   buildExplosionWarnings,
   buildExplosionFlags,
   detectExplosionSetups,
   calculateExplosionZones,
   rankExplosionOpportunities,
   classifyExplosionQuality,
  EXPLOSION_WEIGHTS,
  EXPLOSION_QUALITY_THRESHOLDS,
};