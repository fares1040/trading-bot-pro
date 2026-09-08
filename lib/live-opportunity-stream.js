const DEFAULTS = Object.freeze({
  minPressureScore: 65,
  minPriceChangePercent: 0.25,
  minPriceAccelerationPercent: 0.15,
  minVolumeChangePercent: 10,
  minVolumeAccelerationPercent: 5,
  maxSpreadPercent: 1.5,
  cooldownMs: 60_000,
});

export const LIVE_OPPORTUNITY_VERSION = '1.0';
export const LIVE_OPPORTUNITY_MODE = 'DERIVED';
export const LIVE_OPPORTUNITY_SOURCE = 'LIVE_MARKET_PULSE';
export const LIVE_OPPORTUNITY_DEFAULTS = DEFAULTS;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function threshold(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeDirection(value) {
  return value === 'UP' || value === 'DOWN' ? value : 'FLAT';
}

function hasFreshData(pulse) {
  return pulse?.freshness?.status === 'FRESH' && pulse?.freshness?.isFresh === true;
}

function buildChecks(pulse, config) {
  const direction = normalizeDirection(pulse?.direction);
  const pressureScore = finite(pulse?.pressureScore);
  const priceChangePercent = finite(pulse?.priceChangePercent);
  const priceAccelerationPercent = finite(pulse?.priceAccelerationPercent);
  const volumeChangePercent = finite(pulse?.volumeChangePercent);
  const volumeAccelerationPercent = finite(pulse?.volumeAccelerationPercent);
  const spreadPercent = finite(pulse?.spreadPercent);

  const directionalPriceChange = priceChangePercent == null
    ? null
    : direction === 'UP' ? priceChangePercent : direction === 'DOWN' ? -priceChangePercent : 0;
  const directionalAcceleration = priceAccelerationPercent == null
    ? null
    : direction === 'UP' ? priceAccelerationPercent : direction === 'DOWN' ? -priceAccelerationPercent : 0;

  return {
    pressure: pressureScore != null && pressureScore >= config.minPressureScore,
    priceMove: directionalPriceChange != null && directionalPriceChange >= config.minPriceChangePercent,
    acceleration: directionalAcceleration != null && directionalAcceleration >= config.minPriceAccelerationPercent,
    volume: volumeChangePercent != null && volumeChangePercent >= config.minVolumeChangePercent,
    volumeAcceleration: volumeAccelerationPercent != null && volumeAccelerationPercent >= config.minVolumeAccelerationPercent,
    spreadAcceptable: spreadPercent == null || spreadPercent <= config.maxSpreadPercent,
    direction: direction !== 'FLAT',
  };
}

function buildEvidence(pulse, checks) {
  const evidence = [];
  if (checks.pressure) evidence.push({ type: 'PRESSURE', score: finite(pulse?.pressureScore) });
  if (checks.priceMove) evidence.push({ type: 'PRICE_MOVE', value: finite(pulse?.priceChangePercent) });
  if (checks.acceleration) evidence.push({ type: 'PRICE_ACCELERATION', value: finite(pulse?.priceAccelerationPercent) });
  if (checks.volume) evidence.push({ type: 'VOLUME_EXPANSION', value: finite(pulse?.volumeChangePercent) });
  if (checks.volumeAcceleration) evidence.push({ type: 'VOLUME_ACCELERATION', value: finite(pulse?.volumeAccelerationPercent) });
  return evidence;
}

export function detectLiveOpportunity(pulse, options = {}) {
  const config = {
    minPressureScore: threshold(options.minPressureScore, DEFAULTS.minPressureScore),
    minPriceChangePercent: threshold(options.minPriceChangePercent, DEFAULTS.minPriceChangePercent),
    minPriceAccelerationPercent: threshold(options.minPriceAccelerationPercent, DEFAULTS.minPriceAccelerationPercent),
    minVolumeChangePercent: threshold(options.minVolumeChangePercent, DEFAULTS.minVolumeChangePercent),
    minVolumeAccelerationPercent: threshold(options.minVolumeAccelerationPercent, DEFAULTS.minVolumeAccelerationPercent),
    maxSpreadPercent: threshold(options.maxSpreadPercent, DEFAULTS.maxSpreadPercent),
  };

  const symbol = String(pulse?.symbol || '').toUpperCase();
  if (!symbol || !pulse) {
    return { eligible: false, reason: 'INSUFFICIENT_DATA', symbol: symbol || null };
  }
  if (!hasFreshData(pulse)) {
    return { eligible: false, reason: 'STALE_OR_UNVERIFIED_DATA', symbol };
  }

  const checks = buildChecks(pulse, config);
  const evidence = buildEvidence(pulse, checks);
  const positiveChecks = [checks.pressure, checks.priceMove, checks.acceleration, checks.volume, checks.volumeAcceleration].filter(Boolean).length;
  const eligible = checks.direction && checks.spreadAcceptable && positiveChecks >= 3;

  return {
    eligible,
    reason: eligible ? 'LIVE_OPPORTUNITY' : positiveChecks < 3 ? 'INSUFFICIENT_CONFLUENCE' : !checks.spreadAcceptable ? 'SPREAD_TOO_WIDE' : 'NO_DIRECTION',
    symbol,
    direction: normalizeDirection(pulse.direction),
    timestamp: pulse.timestamp || null,
    fetchedAt: pulse.fetchedAt || null,
    freshness: pulse.freshness || null,
    pressureScore: finite(pulse.pressureScore),
    accelerationState: pulse.accelerationState || 'INSUFFICIENT_DATA',
    evidence,
    checks,
    dataQuality: pulse.dataQuality || 'UNKNOWN',
    source: LIVE_OPPORTUNITY_SOURCE,
    mode: LIVE_OPPORTUNITY_MODE,
    version: LIVE_OPPORTUNITY_VERSION,
    disclaimer: 'Opportunity detection is derived from polled market snapshots and pulse metrics; it is not independent real-time order-flow, options-flow, or institutional-flow data.',
  };
}

export function createLiveOpportunityStream(options = {}) {
  const cooldownMs = Math.max(0, threshold(options.cooldownMs, DEFAULTS.cooldownMs));
  const detectorOptions = { ...options };
  delete detectorOptions.cooldownMs;
  const lastEmittedAt = new Map();

  return {
    evaluate(pulse, now = Date.now()) {
      const detection = detectLiveOpportunity(pulse, detectorOptions);
      if (!detection.eligible) return { ...detection, emitted: false };
      const symbol = detection.symbol;
      const previous = lastEmittedAt.get(symbol);
      if (previous != null && now - previous < cooldownMs) {
        return { ...detection, emitted: false, reason: 'COOLDOWN' };
      }
      lastEmittedAt.set(symbol, now);
      return { ...detection, emitted: true };
    },
    clear(symbol) {
      if (symbol == null) lastEmittedAt.clear();
      else lastEmittedAt.delete(String(symbol).toUpperCase());
    },
    stats() {
      return { trackedSymbols: lastEmittedAt.size, cooldownMs };
    },
  };
}
