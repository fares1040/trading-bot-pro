/**
 * Classical Technical Evidence Layer
 *
 * Reusable methodology layer that detects classical technical structures
 * from OHLC data and existing support/resistance levels.
 *
 * Pure function — no network calls, no fabrication, no look-ahead.
 * Missing data remains null. NaN/Infinity values are sanitized.
 *
 * Detects:
 *   - Market Structure Shift (MSS): higher highs / higher lows, lower highs / lower lows
 *   - Breaker: support ↔ resistance transformation after structural failure
 *   - FVG (Fair Value Gap): 3-candle imbalance structure
 *   - Liquidity Sweep / Turtle Soup: sweep of meaningful prior highs/lows with return
 *   - CRT (Candle Range Theory): higher-timeframe reference candle + lower-timeframe structures
 *   - Support / Resistance: structural levels (reuses existing where available)
 *
 * IMPORTANT: Patterns are only classified when OHLC data objectively supports them.
 * Do NOT fabricate patterns when data is insufficient.
 */

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (v === Infinity) return max;
  if (v === -Infinity) return min;
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

// ============================================================================
// HELPERS
// ============================================================================

function safeHighs(highs) {
  return (Array.isArray(highs) ? highs : []).map(Number).filter(Number.isFinite);
}

function safeLows(lows) {
  return (Array.isArray(lows) ? lows : []).map(Number).filter(Number.isFinite);
}

function safeCloses(closes) {
  return (Array.isArray(closes) ? closes : []).map(Number).filter(Number.isFinite);
}

function safeVolumes(volumes) {
  return (Array.isArray(volumes) ? volumes : []).map(Number).filter(Number.isFinite);
}

function swingHighs(highs, lookback = 5) {
  const h = safeHighs(highs);
  if (h.length < lookback * 2 + 1) return [];
  const points = [];
  for (let i = lookback; i < h.length - lookback; i++) {
    const isHigh = h[i] > Math.max(...h.slice(i - lookback, i)) && h[i] > Math.max(...h.slice(i + 1, i + lookback + 1));
    if (isHigh) points.push({ index: i, value: h[i] });
  }
  return points;
}

function swingLows(lows, lookback = 5) {
  const l = safeLows(lows);
  if (l.length < lookback * 2 + 1) return [];
  const points = [];
  for (let i = lookback; i < l.length - lookback; i++) {
    const isLow = l[i] < Math.min(...l.slice(i - lookback, i)) && l[i] < Math.min(...l.slice(i + 1, i + lookback + 1));
    if (isLow) points.push({ index: i, value: l[i] });
  }
  return points;
}

// ============================================================================
// MARKET STRUCTURE SHIFT (MSS)
// ============================================================================

function detectMarketStructure(highs, lows, closes) {
  const h = safeHighs(highs);
  const l = safeLows(lows);
  const c = safeCloses(closes);

  if (h.length < 10 || l.length < 10 || c.length < 10) {
    return {
      trend: 'UNAVAILABLE',
      higherHighs: false,
      higherLows: false,
      lowerHighs: false,
      lowerLows: false,
      lastStructureShift: null,
      mssDetected: false,
      confidence: null,
    };
  }

  const recentHighs = h.slice(-10);
  const recentLows = l.slice(-10);
  const veryRecentHighs = h.slice(-5);
  const veryRecentLows = l.slice(-5);

  const prevHigh = Math.max(...recentHighs.slice(0, 5));
  const currHigh = Math.max(...veryRecentHighs);
  const prevLow = Math.min(...recentLows.slice(0, 5));
  const currLow = Math.min(...veryRecentLows);

  const higherHighs = currHigh > prevHigh;
  const higherLows = currLow > prevLow;
  const lowerHighs = currHigh < prevHigh;
  const lowerLows = currLow > prevLow ? false : currLow < prevLow;

  // Detect if lower lows but not lower highs (potential basing)
  const potentialBasin = lowerLows && !lowerHighs;

  let trend = 'NEUTRAL';
  if (higherHighs && higherLows) trend = 'BULLISH';
  else if (lowerHighs && lowerLows) trend = 'BEARISH';
  else if (higherHighs && !higherLows && !lowerLows) trend = 'BULLISH';
  else if (lowerLows && !lowerHighs && !higherHighs) trend = 'BEARISH';

  // MSS: detect recent structural change
  let mssDetected = false;
  let lastStructureShift = null;

  if (h.length >= 15 && l.length >= 15) {
    const prevStructureHighs = h.slice(-15, -5);
    const prevStructureLows = l.slice(-15, -5);
    const currStructureHighs = h.slice(-5);
    const currStructureLows = l.slice(-5);

    const wasBullish = Math.max(...prevStructureHighs.slice(-3)) > Math.max(...prevStructureHighs.slice(0, 3)) &&
                       Math.min(...prevStructureLows.slice(-3)) > Math.min(...prevStructureLows.slice(0, 3));
    const isBearish = Math.max(...currStructureHighs) < Math.max(...prevStructureHighs.slice(-3)) &&
                      Math.min(...currStructureLows) < Math.min(...prevStructureLows.slice(-3));

    if (wasBullish && isBearish) {
      mssDetected = true;
      lastStructureShift = 'BULLISH_TO_BEARISH';
    }

    const wasBearish = Math.max(...prevStructureHighs.slice(-3)) < Math.max(...prevStructureHighs.slice(0, 3)) &&
                       Math.min(...prevStructureLows.slice(-3)) < Math.min(...prevStructureLows.slice(0, 3));
    const isBullish = Math.max(...currStructureHighs) > Math.max(...prevStructureHighs.slice(-3)) &&
                      Math.min(...currStructureLows) > Math.min(...prevStructureLows.slice(-3));

    if (wasBearish && isBullish) {
      mssDetected = true;
      lastStructureShift = 'BEARISH_TO_BULLISH';
    }
  }

  const confidence = mssDetected ? 75 : (higherHighs || higherLows || lowerHighs || lowerLows) ? 55 : 40;

  return {
    trend,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
    lastStructureShift,
    mssDetected,
    confidence: clamp(confidence),
  };
}

// ============================================================================
// BREAKER
// ============================================================================

function detectBreaker(highs, lows, closes, existingSupport, existingResistance) {
  const h = safeHighs(highs);
  const l = safeLows(lows);
  const c = safeCloses(closes);

  if (h.length < 10 || l.length < 10) {
    return {
      detected: false,
      previousSupport: null,
      previousResistance: null,
      transformedLevel: null,
      confidence: null,
    };
  }

  const recentHigh = Math.max(...h.slice(-5));
  const recentLow = Math.min(...l.slice(-5));
  const priorHigh = Math.max(...h.slice(-10, -5));
  const priorLow = Math.min(...l.slice(-10, -5));

  // A breaker occurs when a previous support/resistance is broken and then retested
  // from the opposite side, transforming its role.
  const supportBroken = existingSupport != null && recentLow < existingSupport;
  const resistanceBroken = existingResistance != null && recentHigh > existingResistance;

  let detected = false;
  let previousSupport = null;
  let previousResistance = null;
  let transformedLevel = null;

  if (supportBroken && c.length > 0) {
    // Support broken, now acting as resistance
    previousSupport = n(existingSupport) || round(priorLow);
    if (c[c.length - 1] < previousSupport) {
      detected = true;
      transformedLevel = previousSupport;
    }
  }

  if (resistanceBroken && c.length > 0) {
    previousResistance = n(existingResistance) || round(priorHigh);
    if (c[c.length - 1] > previousResistance) {
      detected = true;
      transformedLevel = previousResistance;
    }
  }

  const confidence = detected ? 70 : null;

  return {
    detected,
    previousSupport,
    previousResistance,
    transformedLevel,
    confidence,
  };
}

// ============================================================================
// FAIR VALUE GAP (FVG)
// ============================================================================

function detectFVG(highs, lows, closes) {
  const h = safeHighs(highs);
  const l = safeLows(lows);
  const c = safeCloses(closes);

  if (h.length < 3 || l.length < 3 || c.length < 3) {
    return {
      detected: false,
      gaps: [],
      confidence: null,
    };
  }

  const gaps = [];
  // FVG: 3-candle imbalance where candle 1 low > candle 3 high (bullish gap)
  // or candle 1 high < candle 3 low (bearish gap)
  for (let i = 2; i < c.length; i++) {
    const c1High = h[i - 2];
    const c1Low = l[i - 2];
    const c3High = h[i];
    const c3Low = l[i];

    if (c1Low > c3High && c1Low - c3High > 0.001) {
      gaps.push({
        start: round(c3High),
        end: round(c1Low),
        type: 'BULLISH',
        index: i,
      });
    } else if (c1High < c3Low && c3Low - c1High > 0.001) {
      gaps.push({
        start: round(c1High),
        end: round(c3Low),
        type: 'BEARISH',
        index: i,
      });
    }
  }

  const detected = gaps.length > 0;
  const confidence = detected ? 65 : null;

  return {
    detected,
    gaps: gaps.slice(-5),
    confidence,
  };
}

// ============================================================================
// LIQUIDITY SWEEP / TURTLE SOUP
// ============================================================================

function detectLiquiditySweep(highs, lows, closes, volumes, significantLevels = []) {
  const h = safeHighs(highs);
  const l = safeLows(lows);
  const c = safeCloses(closes);
  const v = safeVolumes(volumes);

  if (h.length < 10 || l.length < 10 || c.length < 10) {
    return {
      detected: false,
      sweepType: 'NONE',
      sweptLevel: null,
      returnConfirmed: false,
      confidence: null,
    };
  }

  const recentHigh = Math.max(...h.slice(-5));
  const recentLow = Math.min(...l.slice(-5));
  const prevHigh = Math.max(...h.slice(-10, -5));
  const prevLow = Math.min(...l.slice(-10, -5));

  const sweepAbove = recentHigh > prevHigh && c[c.length - 1] < prevHigh;
  const sweepBelow = recentLow < prevLow && c[c.length - 1] > prevLow;

  let detected = false;
  let sweepType = 'NONE';
  let sweptLevel = null;
  let returnConfirmed = false;

  if (sweepAbove || sweepBelow) {
    detected = true;
    if (sweepAbove) {
      sweptLevel = round(prevHigh);
      // Turtle Soup: sweep above with return into range
      returnConfirmed = c[c.length - 1] < prevHigh && c[c.length - 1] > prevLow;
      sweepType = returnConfirmed ? 'TURTLE_SOUP' : 'SIMPLE_BREAKOUT';
    } else if (sweepBelow) {
      sweptLevel = round(prevLow);
      returnConfirmed = c[c.length - 1] > prevLow && c[c.length - 1] < prevHigh;
      sweepType = returnConfirmed ? 'TURTLE_SOUP' : 'SIMPLE_BREAKOUT';
    }
  }

  // Check significant levels
  for (const level of significantLevels) {
    const lev = n(level);
    if (lev == null) continue;
    if (recentHigh > lev && c[c.length - 1] < lev) {
      detected = true;
      sweptLevel = lev;
      returnConfirmed = true;
      sweepType = 'TURTLE_SOUP';
      break;
    }
    if (recentLow < lev && c[c.length - 1] > lev) {
      detected = true;
      sweptLevel = lev;
      returnConfirmed = true;
      sweepType = 'TURTLE_SOUP';
      break;
    }
  }

  const confidence = detected ? (returnConfirmed ? 75 : 55) : null;

  return {
    detected,
    sweepType,
    sweptLevel,
    returnConfirmed,
    confidence,
  };
}

// ============================================================================
// CANDLE RANGE THEORY (CRT)
// ============================================================================

function detectCRT(htfCloses, htfHighs, htfLows, ltfCloses, ltfHighs, ltfLows, ltfVolumes) {
  const htfC = safeCloses(htfCloses);
  const htfH = safeHighs(htfHighs);
  const htfL = safeLows(htfLows);
  const ltfC = safeCloses(ltfCloses);
  const ltfH = safeHighs(ltfHighs);
  const ltfL = safeLows(ltfLows);
  const ltfV = safeVolumes(ltfVolumes);

  if (htfC.length < 5 || ltfC.length < 10) {
    return {
      available: false,
      referenceCandle: null,
      crh: null,
      crl: null,
      liquidityStructures: [],
      sweepDetected: false,
      mssDetected: false,
      breakerDetected: false,
      fvgDetected: false,
      confirmationState: 'UNAVAILABLE',
      confidence: null,
    };
  }

  const available = true;

  // Higher-timeframe reference candle (most recent completed candle)
  const refIndex = htfC.length - 2;
  const referenceCandle = {
    index: refIndex,
    open: null,
    high: htfH[refIndex],
    low: htfL[refIndex],
    close: htfC[refIndex],
  };

  const crh = referenceCandle.high;
  const crl = referenceCandle.low;

  // Detect lower-timeframe structures around CRH/CRL
  const liquidityStructures = [];
  for (let i = ltfC.length - 5; i < ltfC.length; i++) {
    if (ltfH[i] >= crh || ltfL[i] <= crl) {
      liquidityStructures.push({
        index: i,
        type: ltfH[i] >= crh ? 'CRH_INTERACTION' : 'CRL_INTERACTION',
        level: ltfH[i] >= crh ? crh : crl,
      });
    }
  }

  const sweep = detectLiquiditySweep(ltfH, ltfL, ltfC, ltfV, [crh, crl]);
  const mss = detectMarketStructure(ltfH, ltfL, ltfC);
  const breaker = detectBreaker(ltfH, ltfL, ltfC, crl, crh);
  const fvg = detectFVG(ltfH, ltfL, ltfC);

  let confirmationState = 'NONE';
  const conditions = [sweep.detected, mss.mssDetected, breaker.detected, fvg.detected];
  const metCount = conditions.filter(Boolean).length;

  if (metCount >= 3) confirmationState = 'CONFIRMED';
  else if (metCount >= 2) confirmationState = 'WATCH';
  else if (metCount >= 1) confirmationState = 'EARLY';

  const confidence = confirmationState === 'CONFIRMED' ? 80 : confirmationState === 'WATCH' ? 60 : confirmationState === 'EARLY' ? 40 : null;

  return {
    available,
    referenceCandle,
    crh: round(crh),
    crl: round(crl),
    liquidityStructures: liquidityStructures.slice(-3),
    sweepDetected: sweep.detected,
    mssDetected: mss.mssDetected,
    breakerDetected: breaker.detected,
    fvgDetected: fvg.detected,
    confirmationState,
    confidence,
  };
}

// ============================================================================
// SUPPORT / RESISTANCE
// ============================================================================

function detectSupportResistance(highs, lows, closes, existingSupport, existingResistance) {
  const h = safeHighs(highs);
  const l = safeLows(lows);
  const c = safeCloses(closes);

  if (h.length < 5 || l.length < 5) {
    return {
      support: n(existingSupport),
      resistance: n(existingResistance),
      strength: 'UNAVAILABLE',
      touches: null,
    };
  }

  const support = n(existingSupport) || round(Math.min(...l.slice(-10)));
  const resistance = n(existingResistance) || round(Math.max(...h.slice(-10)));

  // Count touches near support/resistance
  let touches = 0;
  const touchThreshold = (resistance - support) * 0.02;
  for (let i = c.length - 10; i < c.length; i++) {
    if (Math.abs(c[i] - support) < touchThreshold || Math.abs(c[i] - resistance) < touchThreshold) {
      touches++;
    }
  }

  let strength = 'WEAK';
  if (touches >= 3) strength = 'STRONG';
  else if (touches >= 2) strength = 'MODERATE';

  return {
    support: round(support),
    resistance: round(resistance),
    strength,
    touches,
  };
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

export function buildClassicalTechnicalEvidence(inputs = {}) {
  const {
    highs = [],
    lows = [],
    closes = [],
    volumes = [],
    htfCloses = [],
    htfHighs = [],
    htfLows = [],
    ltfCloses = [],
    ltfHighs = [],
    ltfLows = [],
    ltfVolumes = [],
    existingSupport = null,
    existingResistance = null,
    significantLevels = [],
    symbol = null,
  } = inputs;

  const marketStructure = detectMarketStructure(highs, lows, closes);
  const breaker = detectBreaker(highs, lows, closes, existingSupport, existingResistance);
  const fvg = detectFVG(highs, lows, closes);
  const liquiditySweep = detectLiquiditySweep(highs, lows, closes, volumes, significantLevels);
  const crt = detectCRT(htfCloses, htfHighs, htfLows, ltfCloses, ltfHighs, ltfLows, ltfVolumes);
  const supportResistance = detectSupportResistance(highs, lows, closes, existingSupport, existingResistance);

  const evidenceCompleteness = [
    marketStructure.confidence != null,
    breaker.confidence != null,
    fvg.confidence != null,
    liquiditySweep.confidence != null,
    crt.available,
    supportResistance.strength !== 'UNAVAILABLE',
  ].filter(Boolean).length;

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    marketStructure,
    breaker,
    fvg,
    liquiditySweep,
    crt,
    supportResistance,
    evidenceCompleteness: clamp(Math.round((evidenceCompleteness / 6) * 100)),
    dataAvailability: {
      highs: highs.length > 0,
      lows: lows.length > 0,
      closes: closes.length > 0,
      volumes: volumes.length > 0,
      htfData: htfCloses.length > 0,
      ltfData: ltfCloses.length > 0,
      existingSupport: existingSupport != null,
      existingResistance: existingResistance != null,
    },
    provenance: {
      intelligence: 'CLASSICAL',
      engine: 'Classical Technical Evidence',
    },
    disclaimer:
      'Classical Technical Evidence provides structural context only — not a buy/sell signal. ' +
      'Patterns are only reported when OHLC data objectively supports them. ' +
      'Missing data remains null — never fabricated.',
  };
}

export function defaultClassicalTechnicalEvidence(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    marketStructure: {
      trend: 'UNAVAILABLE',
      higherHighs: false,
      higherLows: false,
      lowerHighs: false,
      lowerLows: false,
      lastStructureShift: null,
      mssDetected: false,
      confidence: null,
    },
    breaker: {
      detected: false,
      previousSupport: null,
      previousResistance: null,
      transformedLevel: null,
      confidence: null,
    },
    fvg: {
      detected: false,
      gaps: [],
      confidence: null,
    },
    liquiditySweep: {
      detected: false,
      sweepType: 'NONE',
      sweptLevel: null,
      returnConfirmed: false,
      confidence: null,
    },
    crt: {
      available: false,
      referenceCandle: null,
      crh: null,
      crl: null,
      liquidityStructures: [],
      sweepDetected: false,
      mssDetected: false,
      breakerDetected: false,
      fvgDetected: false,
      confirmationState: 'UNAVAILABLE',
      confidence: null,
    },
    supportResistance: {
      support: null,
      resistance: null,
      strength: 'UNAVAILABLE',
      touches: null,
    },
    evidenceCompleteness: 0,
    dataAvailability: {
      highs: false,
      lows: false,
      closes: false,
      volumes: false,
      htfData: false,
      ltfData: false,
      existingSupport: false,
      existingResistance: false,
    },
    provenance: {
      intelligence: 'CLASSICAL',
      engine: 'Classical Technical Evidence',
    },
    disclaimer:
      'Classical Technical Evidence provides structural context only — not a buy/sell signal. ' +
      'Patterns are only reported when OHLC data objectively supports them. ' +
      'Missing data remains null — never fabricated.',
  };
}

export {
  detectMarketStructure,
  detectBreaker,
  detectFVG,
  detectLiquiditySweep,
  detectCRT,
  detectSupportResistance,
  swingHighs,
  swingLows,
};
