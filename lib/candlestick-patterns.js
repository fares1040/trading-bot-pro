/**
 * Candlestick Pattern Detection Layer
 *
 * Reusable methodology layer that detects classical candlestick patterns
 * from OHLC data and provides contextual evidence.
 *
 * Pure function — no network calls, no fabrication, no look-ahead.
 * Missing data remains null. NaN/Infinity values are sanitized.
 *
 * IMPORTANT:
 * - Candlesticks are treated as contextual evidence, not standalone signals.
 * - Patterns are only reported when OHLC data objectively supports them.
 * - Do NOT create a trade signal from a candlestick pattern alone.
 *
 * Detects:
 *   Bullish: Hammer, Bullish Engulfing, Piercing, Tweezer Bottom, Morning Star
 *   Bearish: Shooting Star, Bearish Engulfing, Dark Cloud Cover, Tweezer Top, Evening Star
 *
 * Contextual info:
 *   - body strength
 *   - upper-wick rejection
 *   - lower-wick rejection
 *   - buyer/seller pressure
 *   - reversal/continuation context
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

function safeOpen(opens) {
  return (Array.isArray(opens) ? opens : []).map(Number).filter(Number.isFinite);
}

function safeHigh(highs) {
  return (Array.isArray(highs) ? highs : []).map(Number).filter(Number.isFinite);
}

function safeLow(lows) {
  return (Array.isArray(lows) ? lows : []).map(Number).filter(Number.isFinite);
}

function safeClose(closes) {
  return (Array.isArray(closes) ? closes : []).map(Number).filter(Number.isFinite);
}

function bodySize(o, c) {
  return Math.abs(c - o);
}

function upperWick(h, o, c) {
  return h - Math.max(o, c);
}

function lowerWick(l, o, c) {
  return Math.min(o, c) - l;
}

function totalRange(h, l) {
  return h - l;
}

function isBullish(o, c) {
  return c > o;
}

function isBearish(o, c) {
  return o > c;
}

function isDoji(o, c, h, l) {
  const tr = totalRange(h, l);
  if (tr <= 0) return false;
  return bodySize(o, c) / tr < 0.1;
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

function detectHammer(o, h, l, c, prevClose) {
  if (!isBullish(o, c)) return null;
  const tr = totalRange(h, l);
  const body = bodySize(o, c);
  const lower = lowerWick(l, o, c);
  const upper = upperWick(h, o, c);

  if (tr <= 0 || body <= 0) return null;
  if (lower < tr * 0.6) return null;
  if (upper > tr * 0.15) return null;
  if (body > tr * 0.3) return null;

  // Hammer at/near a low
  const atLow = prevClose != null ? c < prevClose * 0.98 || l <= Math.min(prevClose, c) * 0.99 : true;

  return {
    name: 'Hammer',
    type: 'BULLISH',
    strength: atLow ? 'STRONG' : 'MODERATE',
    confidence: atLow ? 75 : 60,
    description: atLow ? 'Hammer at potential support — bullish reversal context' : 'Hammer pattern — potential reversal',
  };
}

function detectShootingStar(o, h, l, c, prevClose) {
  if (!isBearish(o, c)) return null;
  const tr = totalRange(h, l);
  const body = bodySize(o, c);
  const upper = upperWick(h, o, c);
  const lower = lowerWick(l, o, c);

  if (tr <= 0 || body <= 0) return null;
  if (upper < tr * 0.6) return null;
  if (lower > tr * 0.15) return null;
  if (body > tr * 0.3) return null;

  const atHigh = prevClose != null ? c > prevClose * 1.02 || h >= Math.max(prevClose, c) * 1.01 : true;

  return {
    name: 'Shooting Star',
    type: 'BEARISH',
    strength: atHigh ? 'STRONG' : 'MODERATE',
    confidence: atHigh ? 75 : 60,
    description: atHigh ? 'Shooting Star at potential resistance — bearish reversal context' : 'Shooting Star pattern — potential reversal',
  };
}

function detectBullishEngulfing(o1, c1, o2, c2, prevClose) {
  if (!isBearish(o1, c1)) return null;
  if (!isBullish(o2, c2)) return null;
  if (o2 >= c1 || c2 <= o1) return null;

  const body1 = bodySize(o1, c1);
  const body2 = bodySize(o2, c2);
  if (body2 <= body1 * 1.1) return null;

  const atLow = prevClose != null ? c2 < prevClose * 0.98 : true;

  return {
    name: 'Bullish Engulfing',
    type: 'BULLISH',
    strength: atLow ? 'STRONG' : 'MODERATE',
    confidence: atLow ? 78 : 65,
    description: atLow ? 'Bullish Engulfing at support — strong reversal signal' : 'Bullish Engulfing pattern',
  };
}

function detectBearishEngulfing(o1, c1, o2, c2, prevClose) {
  if (!isBullish(o1, c1)) return null;
  if (!isBearish(o2, c2)) return null;
  if (o2 <= c1 || c2 >= o1) return null;

  const body1 = bodySize(o1, c1);
  const body2 = bodySize(o2, c2);
  if (body2 <= body1 * 1.1) return null;

  const atHigh = prevClose != null ? c2 > prevClose * 1.02 : true;

  return {
    name: 'Bearish Engulfing',
    type: 'BEARISH',
    strength: atHigh ? 'STRONG' : 'MODERATE',
    confidence: atHigh ? 78 : 65,
    description: atHigh ? 'Bearish Engulfing at resistance — strong reversal signal' : 'Bearish Engulfing pattern',
  };
}

function detectPiercing(o1, c1, o2, c2, prevClose) {
  if (!isBearish(o1, c1)) return null;
  if (!isBullish(o2, c2)) return null;
  if (c2 <= o1 || o2 >= c1) return null;

  const midpoint = (o1 + c1) / 2;
  if (c2 < midpoint) return null;

  const body1 = bodySize(o1, c1);
  const body2 = bodySize(o2, c2);
  if (body2 < body1 * 0.5) return null;

  const atLow = prevClose != null ? c2 < prevClose * 0.98 : true;

  return {
    name: 'Piercing',
    type: 'BULLISH',
    strength: atLow ? 'MODERATE' : 'WEAK',
    confidence: atLow ? 65 : 55,
    description: atLow ? 'Piercing pattern near support — potential bullish reversal' : 'Piercing pattern',
  };
}

function detectDarkCloudCover(o1, c1, o2, c2, prevClose) {
  if (!isBullish(o1, c1)) return null;
  if (!isBearish(o2, c2)) return null;
  if (c2 >= o1 || o2 <= c1) return null;

  const midpoint = (o1 + c1) / 2;
  if (c2 > midpoint) return null;

  const body1 = bodySize(o1, c1);
  const body2 = bodySize(o2, c2);
  if (body2 < body1 * 0.5) return null;

  const atHigh = prevClose != null ? c2 > prevClose * 1.02 : true;

  return {
    name: 'Dark Cloud Cover',
    type: 'BEARISH',
    strength: atHigh ? 'MODERATE' : 'WEAK',
    confidence: atHigh ? 65 : 55,
    description: atHigh ? 'Dark Cloud Cover near resistance — potential bearish reversal' : 'Dark Cloud Cover pattern',
  };
}

function detectTweezerTop(o1, h1, o2, h2) {
  if (h1 == null || h2 == null) return null;
  const diff = Math.abs(h1 - h2);
  const avg = (h1 + h2) / 2;
  if (avg <= 0 || diff / avg > 0.01) return null;

  const body1 = bodySize(o1, h1 > o1 ? o1 : h1);
  const body2 = bodySize(o2, h2 > o2 ? o2 : h2);
  const tr = totalRange(Math.max(h1, h2), Math.min(o1, o2));

  return {
    name: 'Tweezer Top',
    type: 'BEARISH',
    strength: 'MODERATE',
    confidence: 60,
    description: 'Tweezer Top — double top at resistance',
  };
}

function detectTweezerBottom(o1, l1, o2, l2) {
  if (l1 == null || l2 == null) return null;
  const diff = Math.abs(l1 - l2);
  const avg = (l1 + l2) / 2;
  if (avg <= 0 || diff / avg > 0.01) return null;

  return {
    name: 'Tweezer Bottom',
    type: 'BULLISH',
    strength: 'MODERATE',
    confidence: 60,
    description: 'Tweezer Bottom — double bottom at support',
  };
}

function detectMorningStar(o1, c1, o2, c2, o3, c3, prevClose) {
  if (!isBearish(o1, c1)) return null;
  if (isBullish(o3, c3)) return null;
  const body2 = bodySize(o2, c2);
  if (body2 > totalRange(o2, c2) * 0.3) return null;

  const body1 = bodySize(o1, c1);
  const body3 = bodySize(o3, c3);
  if (body3 < body1 * 0.3) return null;
  if (c3 < (o1 + c1) / 2) return null;

  const atLow = prevClose != null ? c3 < prevClose * 0.98 : true;

  return {
    name: 'Morning Star',
    type: 'BULLISH',
    strength: atLow ? 'STRONG' : 'MODERATE',
    confidence: atLow ? 72 : 58,
    description: atLow ? 'Morning Star at support — strong bullish reversal' : 'Morning Star pattern',
  };
}

function detectEveningStar(o1, c1, o2, c2, o3, c3, prevClose) {
  if (!isBullish(o1, c1)) return null;
  if (isBearish(o3, c3)) return null;
  const body2 = bodySize(o2, c2);
  if (body2 > totalRange(o2, c3) * 0.3) return null;

  const body1 = bodySize(o1, c1);
  const body3 = bodySize(o3, c3);
  if (body3 < body1 * 0.3) return null;
  if (c3 > (o1 + c1) / 2) return null;

  const atHigh = prevClose != null ? c3 > prevClose * 1.02 : true;

  return {
    name: 'Evening Star',
    type: 'BEARISH',
    strength: atHigh ? 'STRONG' : 'MODERATE',
    confidence: atHigh ? 72 : 58,
    description: atHigh ? 'Evening Star at resistance — strong bearish reversal' : 'Evening Star pattern',
  };
}

// ============================================================================
// CONTEXTUAL ANALYSIS
// ============================================================================

function analyzeContext(opens, highs, lows, closes) {
  const o = safeOpen(opens);
  const h = safeHigh(highs);
  const l = safeLow(lows);
  const c = safeClose(closes);

  if (o.length < 3 || h.length < 3 || l.length < 3 || c.length < 3) {
    return {
      bodyStrength: null,
      upperWickRejection: null,
      lowerWickRejection: null,
      buyerPressure: null,
      sellerPressure: null,
      reversalContext: null,
      continuationContext: null,
    };
  }

  const last = c.length - 1;
  const body = bodySize(o[last], c[last]);
  const tr = totalRange(h[last], l[last]);
  const upper = upperWick(h[last], o[last], c[last]);
  const lower = lowerWick(l[last], o[last], c[last]);

  const bodyStrength = tr > 0 ? clamp((body / tr) * 100) : null;
  const upperWickRejection = tr > 0 ? clamp((upper / tr) * 100) : null;
  const lowerWickRejection = tr > 0 ? clamp((lower / tr) * 100) : null;

  // Buyer/seller pressure from last 3 candles
  let bullishCandles = 0;
  let bearishCandles = 0;
  for (let i = Math.max(0, last - 2); i <= last; i++) {
    if (isBullish(o[i], c[i])) bullishCandles++;
    else if (isBearish(o[i], c[i])) bearishCandles++;
  }

  const buyerPressure = bullishCandles > 0 ? clamp((bullishCandles / 3) * 100) : 0;
  const sellerPressure = bearishCandles > 0 ? clamp((bearishCandles / 3) * 100) : 0;

  // Reversal vs continuation context
  const prev3 = c.slice(-4, -1);
  const last3 = c.slice(-3);
  let reversalContext = null;
  let continuationContext = null;

  if (prev3.length >= 3 && last3.length >= 3) {
    const prevUp = prev3.every((p, i) => i === 0 || p >= prev3[i - 1]);
    const prevDown = prev3.every((p, i) => i === 0 || p <= prev3[i - 1]);
    const currUp = last3.every((p, i) => i === 0 || p >= last3[i - 1]);
    const currDown = last3.every((p, i) => i === 0 || p <= last3[i - 1]);

    if ((prevUp && currDown) || (prevDown && currUp)) reversalContext = true;
    else if ((prevUp && currUp) || (prevDown && currDown)) continuationContext = true;
  }

  return {
    bodyStrength,
    upperWickRejection,
    lowerWickRejection,
    buyerPressure,
    sellerPressure,
    reversalContext,
    continuationContext,
  };
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

export function buildCandlestickPatterns(inputs = {}) {
  const {
    opens = [],
    highs = [],
    lows = [],
    closes = [],
    symbol = null,
  } = inputs;

  const o = safeOpen(opens);
  const h = safeHigh(highs);
  const l = safeLow(lows);
  const c = safeClose(closes);

  const patterns = [];

  if (o.length >= 2 && h.length >= 2 && l.length >= 2 && c.length >= 2) {
    const last = c.length - 1;
    const prev = last - 1;
    const prevClose = c[prev];

    // 2-candle patterns
    patterns.push(detectHammer(o[last], h[last], l[last], c[last], prevClose));
    patterns.push(detectShootingStar(o[last], h[last], l[last], c[last], prevClose));
    patterns.push(detectBullishEngulfing(o[prev], c[prev], o[last], c[last], prevClose));
    patterns.push(detectBearishEngulfing(o[prev], c[prev], o[last], c[last], prevClose));
    patterns.push(detectPiercing(o[prev], c[prev], o[last], c[last], prevClose));
    patterns.push(detectDarkCloudCover(o[prev], c[prev], o[last], c[last], prevClose));
    patterns.push(detectTweezerTop(o[prev], h[prev], o[last], h[last]));
    patterns.push(detectTweezerBottom(o[prev], l[prev], o[last], l[last]));

    // 3-candle patterns
    if (o.length >= 3 && h.length >= 3 && l.length >= 3 && c.length >= 3) {
      const twoPrev = last - 2;
      patterns.push(detectMorningStar(o[twoPrev], c[twoPrev], o[prev], c[prev], o[last], c[last], prevClose));
      patterns.push(detectEveningStar(o[twoPrev], c[twoPrev], o[prev], c[prev], o[last], c[last], prevClose));
    }
  }

  const validPatterns = patterns.filter((p) => p != null);
  const context = analyzeContext(opens, highs, lows, closes);

  const dataCompleteness = o.length > 0 && h.length > 0 && l.length > 0 && c.length > 0
    ? clamp(Math.round((Math.min(o.length, h.length, l.length, c.length) / 20) * 100))
    : 0;

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    patterns: validPatterns.slice(0, 8),
    context,
    dataCompleteness,
    dataAvailability: {
      opens: opens.length > 0,
      highs: highs.length > 0,
      lows: lows.length > 0,
      closes: closes.length > 0,
    },
    provenance: {
      intelligence: 'CANDLESTICK',
      engine: 'Candlestick Pattern Detection',
    },
    disclaimer:
      'Candlestick patterns are contextual evidence only — not standalone trade signals. ' +
      'This engine never creates a BUY/SELL signal from a pattern alone. ' +
      'Missing data remains null — never fabricated.',
  };
}

export function defaultCandlestickPatterns(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    patterns: [],
    context: {
      bodyStrength: null,
      upperWickRejection: null,
      lowerWickRejection: null,
      buyerPressure: null,
      sellerPressure: null,
      reversalContext: null,
      continuationContext: null,
    },
    dataCompleteness: 0,
    dataAvailability: {
      opens: false,
      highs: false,
      lows: false,
      closes: false,
    },
    provenance: {
      intelligence: 'CANDLESTICK',
      engine: 'Candlestick Pattern Detection',
    },
    disclaimer:
      'Candlestick patterns are contextual evidence only — not standalone trade signals. ' +
      'This engine never creates a BUY/SELL signal from a pattern alone. ' +
      'Missing data remains null — never fabricated.',
  };
}
