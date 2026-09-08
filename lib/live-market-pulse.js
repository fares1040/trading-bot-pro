/**
 * Live Market Pulse
 *
 * Derives a short-term market pulse from a live snapshot and its process-local
 * history. This is a lightweight momentum/pressure indicator — NOT a trading
 * signal.
 *
 * Pulse is derived from:
 * - Price momentum (recent change vs prior changes)
 * - Volume pressure (current RVOL vs recent average RVOL)
 * - RSI shift (current RSI vs prior RSI)
 *
 * All outputs are nullable. Missing data returns null, never 0.
 */

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function average(values) {
  const v = values.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * @typedef {Object} PulseResult
 * @property {string} symbol
 * @property {string} direction - 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE'
 * @property {number|null} pressure - 0-100 scale, higher = more pressure
 * @property {number|null} momentumScore - price momentum component
 * @property {number|null} volumePressure - volume pressure component
 * @property {number|null} rsiShift - RSI change from prior reading
 * @property {string} status - 'OK' | 'INSUFFICIENT_DATA' | 'STALE_DATA' | 'ERROR'
 * @property {string} freshness - 'FRESH' | 'STALE' | 'INSUFFICIENT'
 * @property {string[]} evidence
 * @property {string} disclaimer
 */

/**
 * Build a pulse result from a single snapshot (no history).
 * @param {Object} snapshot - LiveSnapshot from live-market-data.js
 * @returns {PulseResult}
 */
export function buildLiveMarketPulse(snapshot) {
  const evidence = [];
  const disclaimer = 'Live market pulse is derived from polled Yahoo data. Not a trading signal.';

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      symbol: snapshot?.symbol || 'UNKNOWN',
      direction: 'UNAVAILABLE', pressure: null,
      momentumScore: null, volumePressure: null, rsiShift: null,
      status: 'ERROR', freshness: 'INSUFFICIENT',
      evidence: ['No snapshot provided'], disclaimer,
    };
  }

  const { symbol, price, changePercent, relativeVolume, rsi, stale } = snapshot;

  if (snapshot.error) {
    return {
      symbol,
      direction: 'UNAVAILABLE', pressure: null,
      momentumScore: null, volumePressure: null, rsiShift: null,
      status: 'ERROR', freshness: 'INSUFFICIENT',
      evidence: [snapshot.error], disclaimer,
    };
  }

  if (stale) {
    return {
      symbol,
      direction: 'UNAVAILABLE', pressure: null,
      momentumScore: null, volumePressure: null, rsiShift: null,
      status: 'STALE_DATA', freshness: 'STALE',
      evidence: ['Market data is stale (delayed >48h)'], disclaimer,
    };
  }

  if (price == null) {
    return {
      symbol,
      direction: 'UNAVAILABLE', pressure: null,
      momentumScore: null, volumePressure: null, rsiShift: null,
      status: 'INSUFFICIENT_DATA', freshness: 'INSUFFICIENT',
      evidence: ['No price data available'], disclaimer,
    };
  }

  // Price momentum
  let momentumScore = null;
  if (changePercent != null) {
    momentumScore = Math.round(50 + changePercent * 8);
    momentumScore = Math.max(0, Math.min(100, momentumScore));
    evidence.push(`Price ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`);
  }

  // Volume pressure
  let volumePressure = null;
  if (relativeVolume != null) {
    volumePressure = Math.round(45 + (relativeVolume - 1) * 35);
    volumePressure = Math.max(0, Math.min(100, volumePressure));
    evidence.push(`RVOL ${relativeVolume.toFixed(2)}x`);
  }

  // RSI component
  let rsiShift = null;
  if (rsi != null) {
    evidence.push(`RSI ${rsi.toFixed(1)}`);
  }

  // Aggregate pressure
  const components = [momentumScore, volumePressure].filter(v => v != null);
  const pressure = components.length > 0
    ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
    : null;

  // Direction
  let direction = 'NEUTRAL';
  if (pressure != null) {
    if (pressure >= 65) direction = 'BULLISH';
    else if (pressure <= 35) direction = 'BEARISH';
  }

  return {
    symbol,
    direction,
    pressure,
    momentumScore,
    volumePressure,
    rsiShift,
    status: 'OK',
    freshness: 'FRESH',
    evidence,
    disclaimer,
  };
}

/**
 * Build a pulse result from a snapshot WITH history for richer analysis.
 * @param {Object} snapshot - LiveSnapshot
 * @param {Object[]} history - Array of prior LiveSnapshots (oldest first)
 * @returns {PulseResult}
 */
export function buildLiveMarketPulseWithHistory(snapshot, history) {
  const base = buildLiveMarketPulse(snapshot);

  if (base.status !== 'OK' || !Array.isArray(history) || history.length < 2) {
    return base;
  }

  const evidence = [...base.evidence];

  // Compute RSI shift from history
  const prevRsi = history.at(-1)?.rsi;
  const currRsi = snapshot?.rsi;
  let rsiShift = null;
  if (currRsi != null && prevRsi != null) {
    rsiShift = Number((currRsi - prevRsi).toFixed(1));
    if (Math.abs(rsiShift) >= 3) {
      evidence.push(`RSI shift ${rsiShift >= 0 ? '+' : ''}${rsiShift}`);
    }
  }

  // Compute average RVOL from history for context
  const histRvols = history.map(h => h?.relativeVolume).filter(v => v != null);
  const avgRvol = histRvols.length > 0
    ? histRvols.reduce((a, b) => a + b, 0) / histRvols.length
    : null;

  let volumePressure = base.volumePressure;
  if (avgRvol != null && snapshot?.relativeVolume != null && avgRvol > 0) {
    const ratio = snapshot.relativeVolume / avgRvol;
    if (ratio >= 1.5) {
      evidence.push(`Volume surge ${ratio.toFixed(1)}x avg`);
    }
  }

  // Recompute pressure with history context
  const components = [base.momentumScore, volumePressure].filter(v => v != null);
  const pressure = components.length > 0
    ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
    : base.pressure;

  let direction = base.direction;
  if (pressure != null) {
    if (pressure >= 65) direction = 'BULLISH';
    else if (pressure <= 35) direction = 'BEARISH';
  }

  return {
    ...base,
    direction,
    pressure,
    volumePressure,
    rsiShift,
    evidence,
  };
}
