/**
 * Acceleration Radar
 *
 * Detects price and volume acceleration from process-local history.
 * Acceleration = rate of change of rate of change (second derivative).
 *
 * This module requires at least 3 history entries to compute acceleration.
 * With fewer entries, it returns INSUFFICIENT_DATA.
 *
 * Acceleration is NOT a trading signal. It is a derived metric indicating
 * whether momentum is increasing or decreasing.
 */

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

/**
 * @typedef {Object} AccelerationResult
 * @property {string} symbol
 * @property {string} status - 'OK' | 'INSUFFICIENT_DATA' | 'ERROR'
 * @property {number|null} priceAcceleration - second derivative of price changes
 * @property {number|null} volumeAcceleration - second derivative of volume
 * @property {string} direction - 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'UNAVAILABLE'
 * @property {string} freshness - 'FRESH' | 'STALE' | 'INSUFFICIENT'
 * @property {number} historySize - number of history entries used
 * @property {string[]} evidence
 * @property {string} disclaimer
 */

const DISCLAIMER = 'Acceleration radar is derived from polled market data. Not a trading signal.';

/**
 * Compute acceleration from a series of values.
 * Returns the second derivative (change of change).
 * @param {number[]} values - Series of numeric values (oldest first)
 * @returns {number|null}
 */
function computeAcceleration(values) {
  const valid = values.filter(v => v != null && Number.isFinite(v));
  if (valid.length < 3) return null;

  // First derivatives (changes)
  const changes = [];
  for (let i = 1; i < valid.length; i++) {
    changes.push(valid[i] - valid[i - 1]);
  }

  // Second derivatives (acceleration)
  if (changes.length < 2) return null;
  const accelerations = [];
  for (let i = 1; i < changes.length; i++) {
    accelerations.push(changes[i] - changes[i - 1]);
  }

  // Return average acceleration
  if (accelerations.length === 0) return null;
  return accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
}

/**
 * Detect acceleration from process-local history.
 * @param {string} symbol
 * @param {Object[]} history - Array of LiveSnapshot entries (oldest first)
 * @returns {AccelerationResult}
 */
export function detectAcceleration(symbol, history) {
  const evidence = [];

  if (!symbol) {
    return {
      symbol: 'UNKNOWN',
      status: 'ERROR', priceAcceleration: null, volumeAcceleration: null,
      direction: 'UNAVAILABLE', freshness: 'INSUFFICIENT',
      historySize: 0, evidence: ['No symbol provided'], disclaimer: DISCLAIMER,
    };
  }

  if (!Array.isArray(history) || history.length < 3) {
    return {
      symbol,
      status: 'INSUFFICIENT_DATA', priceAcceleration: null, volumeAcceleration: null,
      direction: 'UNAVAILABLE', freshness: 'INSUFFICIENT',
      historySize: history?.length || 0,
      evidence: [`Need 3+ history entries, have ${history?.length || 0}`],
      disclaimer: DISCLAIMER,
    };
  }

  // Check for stale data
  const latest = history.at(-1);
  if (latest?.stale) {
    return {
      symbol,
      status: 'OK', priceAcceleration: null, volumeAcceleration: null,
      direction: 'UNAVAILABLE', freshness: 'STALE',
      historySize: history.length,
      evidence: ['Latest data is stale'], disclaimer: DISCLAIMER,
    };
  }

  // Price acceleration
  const prices = history.map(h => h?.price);
  const priceAcceleration = n(computeAcceleration(prices));

  // Volume acceleration
  const volumes = history.map(h => h?.volume);
  const volumeAcceleration = n(computeAcceleration(volumes));

  // Direction
  let direction = 'STABLE';
  if (priceAcceleration != null) {
    if (priceAcceleration > 0.5) {
      direction = 'ACCELERATING';
      evidence.push(`Price accelerating (+${priceAcceleration.toFixed(2)})`);
    } else if (priceAcceleration < -0.5) {
      direction = 'DECELERATING';
      evidence.push(`Price decelerating (${priceAcceleration.toFixed(2)})`);
    } else {
      evidence.push(`Price stable (${priceAcceleration.toFixed(2)})`);
    }
  }

  if (volumeAcceleration != null) {
    if (volumeAcceleration > 1000) {
      evidence.push(`Volume accelerating (+${Math.round(volumeAcceleration).toLocaleString()})`);
    } else if (volumeAcceleration < -1000) {
      evidence.push(`Volume decelerating (${Math.round(volumeAcceleration).toLocaleString()})`);
    }
  }

  return {
    symbol,
    status: 'OK',
    priceAcceleration,
    volumeAcceleration,
    direction,
    freshness: 'FRESH',
    historySize: history.length,
    evidence,
    disclaimer: DISCLAIMER,
  };
}
