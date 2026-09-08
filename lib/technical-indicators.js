/**
 * Shared Technical Indicators
 *
 * Single source of truth for RSI, SMA, ATR, Bollinger Bands.
 * Eliminates duplication across market-engine.js, swing-intelligence.js,
 * early-explosion-intelligence.js, and penny-intelligence.js.
 *
 * All functions are pure, deterministic, and have no side effects.
 * Same inputs always produce same outputs.
 */

// ============================================================================
// HELPERS
// ============================================================================

const n = (value) => {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

const clamp = (value, min = 0, max = 100) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
};

const round = (value, decimals = 2) => {
  const v = n(value);
  return v != null ? Number(v.toFixed(decimals)) : null;
};

// ============================================================================
// RSI — Relative Strength Index (Wilder's Smoothing)
// ============================================================================

/**
 * Calculate RSI using Wilder's smoothing method.
 *
 * @param {number[]} closes - array of closing prices
 * @param {number} [period=14] - RSI period
 * @returns {number|null} RSI value 0-100, or null if insufficient data
 */
function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;

  const vals = closes.map(n).filter(v => v != null);
  if (vals.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = vals[i] - vals[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < vals.length; i++) {
    const diff = vals[i] - vals[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return clamp(100 - (100 / (1 + rs)));
}

// ============================================================================
// SMA — Simple Moving Average
// ============================================================================

/**
 * Calculate Simple Moving Average.
 *
 * @param {number[]} values - input array
 * @param {number} period - SMA period
 * @returns {number|null} SMA value, or null if insufficient data
 */
function calculateSMA(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const vals = values.map(n).filter(v => v != null);
  if (vals.length < period) return null;
  const slice = vals.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ============================================================================
// ATR — Average True Range (Wilder's Smoothing)
// ============================================================================

/**
 * Calculate ATR using Wilder's smoothing method.
 *
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} [period=14]
 * @returns {number|null} ATR value, or null if insufficient data
 */
function calculateATR(highs, lows, closes, period = 14) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes)) return null;
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;

  const h = highs.map(n);
  const l = lows.map(n);
  const c = closes.map(n);

  const trueRanges = [];
  for (let i = 1; i < h.length; i++) {
    const hl = (h[i] != null && l[i] != null) ? h[i] - l[i] : null;
    const hc = (h[i] != null && c[i - 1] != null) ? Math.abs(h[i] - c[i - 1]) : null;
    const lc = (l[i] != null && c[i - 1] != null) ? Math.abs(l[i] - c[i - 1]) : null;
    if (hl == null || hc == null || lc == null) continue;
    trueRanges.push(Math.max(hl, hc, lc));
  }

  if (trueRanges.length < period) return null;

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return round(atr);
}

// ============================================================================
// BOLLINGER BANDS
// ============================================================================

/**
 * Calculate Bollinger Bands with squeeze detection.
 *
 * @param {number[]} closes
 * @param {number} [period=20]
 * @param {number} [stdDevMultiplier=2]
 * @returns {Object|null} { middle, upper, lower, bandwidth, squeeze, score }
 */
function calculateBollinger(closes, period = 20, stdDevMultiplier = 2) {
  if (!Array.isArray(closes) || closes.length < period) return null;

  const vals = closes.map(n).filter(v => v != null);
  if (vals.length < period) return null;

  const slice = vals.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDev * stdDevMultiplier;
  const lower = middle - stdDev * stdDevMultiplier;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 0;

  // Squeeze detection: bandwidth < 5% = extreme squeeze, < 7% = squeeze
  let squeeze = false;
  let score = 50;
  if (bandwidth < 5) { squeeze = true; score = 100; }
  else if (bandwidth < 7) { squeeze = true; score = 90; }
  else if (bandwidth < 9) { score = 75; }
  else if (bandwidth < 12) { score = 50; }
  else if (bandwidth < 15) { score = 40; }
  else { score = 30; }

  return {
    middle: round(middle),
    upper: round(upper),
    lower: round(lower),
    bandwidth: round(bandwidth),
    squeeze,
    score,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  n,
  clamp,
  round,
  calculateRSI,
  calculateSMA,
  calculateATR,
  calculateBollinger,
};
