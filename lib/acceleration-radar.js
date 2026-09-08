const DEFAULTS = Object.freeze({
  minPressureScore: 65,
  minPriceAccelerationPercent: 0.15,
  minVolumeAccelerationPercent: 5,
  maxSpreadPercent: 1.5,
  maxAgeMs: 90_000,
});

export const ACCELERATION_RADAR_VERSION = '1.0';
export const ACCELERATION_RADAR_MODE = 'DERIVED';
export const ACCELERATION_RADAR_SOURCE = 'LIVE_MARKET_PULSE';
export const ACCELERATION_RADAR_DEFAULTS = DEFAULTS;

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function threshold(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function direction(value) {
  return value === 'UP' || value === 'DOWN' ? value : 'FLAT';
}

function fresh(pulse, maxAgeMs) {
  if (pulse?.freshness?.status !== 'FRESH' || pulse?.freshness?.isFresh !== true) return false;
  const ageMs = finite(pulse.freshness.ageMs);
  return ageMs == null || ageMs <= maxAgeMs;
}

export function detectAcceleration(pulse, options = {}) {
  const config = {
    minPressureScore: threshold(options.minPressureScore, DEFAULTS.minPressureScore),
    minPriceAccelerationPercent: threshold(options.minPriceAccelerationPercent, DEFAULTS.minPriceAccelerationPercent),
    minVolumeAccelerationPercent: threshold(options.minVolumeAccelerationPercent, DEFAULTS.minVolumeAccelerationPercent),
    maxSpreadPercent: threshold(options.maxSpreadPercent, DEFAULTS.maxSpreadPercent),
    maxAgeMs: threshold(options.maxAgeMs, DEFAULTS.maxAgeMs),
  };

  const symbol = String(pulse?.symbol || '').toUpperCase();
  if (!pulse || !symbol) return { eligible: false, reason: 'INSUFFICIENT_DATA', symbol: symbol || null };
  if (!fresh(pulse, config.maxAgeMs)) return { eligible: false, reason: 'STALE_OR_UNVERIFIED_DATA', symbol };

  const dir = direction(pulse.direction);
  if (dir === 'FLAT') return { eligible: false, reason: 'NO_DIRECTION', symbol };

  const priceAcceleration = finite(pulse.priceAccelerationPercent);
  const volumeAcceleration = finite(pulse.volumeAccelerationPercent);
  const pressureScore = finite(pulse.pressureScore);
  const spreadPercent = finite(pulse.spreadPercent);

  const directionalPriceAcceleration = priceAcceleration == null ? null : dir === 'UP' ? priceAcceleration : -priceAcceleration;
  const priceAccelerating = directionalPriceAcceleration != null && directionalPriceAcceleration >= config.minPriceAccelerationPercent;
  const volumeAccelerating = volumeAcceleration != null && volumeAcceleration >= config.minVolumeAccelerationPercent;
  const pressureConfirmed = pressureScore != null && pressureScore >= config.minPressureScore;
  const spreadAcceptable = spreadPercent == null || spreadPercent <= config.maxSpreadPercent;
  const confirmed = [priceAccelerating, volumeAccelerating, pressureConfirmed].filter(Boolean).length;
  const eligible = spreadAcceptable && confirmed >= 2;

  const evidence = [];
  if (priceAccelerating) evidence.push({ type: 'PRICE_ACCELERATION', value: priceAcceleration });
  if (volumeAccelerating) evidence.push({ type: 'VOLUME_ACCELERATION', value: volumeAcceleration });
  if (pressureConfirmed) evidence.push({ type: 'PRESSURE', score: pressureScore });

  return {
    eligible,
    reason: eligible ? 'ACCELERATION_DETECTED' : !spreadAcceptable ? 'SPREAD_TOO_WIDE' : 'INSUFFICIENT_ACCELERATION_CONFLUENCE',
    symbol,
    direction: dir,
    timestamp: pulse.timestamp || null,
    fetchedAt: pulse.fetchedAt || null,
    freshness: pulse.freshness || null,
    accelerationState: pulse.accelerationState || 'INSUFFICIENT_DATA',
    priceAccelerationPercent: priceAcceleration,
    volumeAccelerationPercent: volumeAcceleration,
    pressureScore,
    spreadPercent,
    evidence,
    source: ACCELERATION_RADAR_SOURCE,
    mode: ACCELERATION_RADAR_MODE,
    version: ACCELERATION_RADAR_VERSION,
    disclaimer: 'Acceleration radar is derived from polled market snapshots and pulse metrics; it is not independent real-time order-flow, options-flow, or institutional-flow data.',
  };
}

export function createAccelerationRadar(options = {}) {
  return {
    evaluate(pulse) {
      return detectAcceleration(pulse, options);
    },
  };
}
