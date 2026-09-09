/**
 * Early Explosion Radar
 * Provider-neutral, evidence-gated pre-move classifier.
 * It detects preparation/ignition conditions; it does not predict price or infer whales.
 */

export const EARLY_EXPLOSION_RADAR_VERSION = '1.0';
export const EARLY_EXPLOSION_RADAR_MODE = 'DERIVED';

const DEFAULTS = Object.freeze({
  minSignals: 3,
  minPressureScore: 60,
  maxAgeMs: 90_000,
  maxSpreadPercent: 1.5,
});

const finite = (v) => v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const fresh = (entry, maxAgeMs) => {
  if (entry?.freshness?.status !== 'FRESH' || entry?.freshness?.isFresh !== true) return false;
  const age = finite(entry.freshness.ageMs);
  return age == null || age <= maxAgeMs;
};

export function detectEarlyExplosion(entry = {}, options = {}) {
  const config = {
    minSignals: Number.isFinite(Number(options.minSignals)) ? Number(options.minSignals) : DEFAULTS.minSignals,
    minPressureScore: Number.isFinite(Number(options.minPressureScore)) ? Number(options.minPressureScore) : DEFAULTS.minPressureScore,
    maxAgeMs: Number.isFinite(Number(options.maxAgeMs)) ? Number(options.maxAgeMs) : DEFAULTS.maxAgeMs,
    maxSpreadPercent: Number.isFinite(Number(options.maxSpreadPercent)) ? Number(options.maxSpreadPercent) : DEFAULTS.maxSpreadPercent,
  };
  const symbol = String(entry?.symbol || '').toUpperCase();
  if (!symbol) return { eligible: false, reason: 'INSUFFICIENT_DATA', symbol: null };
  if (!fresh(entry, config.maxAgeMs)) return { eligible: false, reason: 'STALE_OR_UNVERIFIED_DATA', symbol };

  const pressure = finite(entry.pulse?.pressureScore);
  const priceAccel = finite(entry.pulse?.priceAccelerationPercent);
  const volumeAccel = finite(entry.pulse?.volumeAccelerationPercent);
  const spread = finite(entry.pulse?.spreadPercent ?? entry.spreadPercent);
  const acceleration = entry.acceleration?.eligible === true;
  const flowPressure = finite(entry.flow?.pressureScore);
  const optionsPressure = finite(entry.optionsFlow?.pressureScore ?? entry.options?.pressureScore);

  const signals = [];
  if (pressure != null && pressure >= config.minPressureScore) signals.push({ type: 'MARKET_PRESSURE', score: pressure });
  if (priceAccel != null && priceAccel > 0) signals.push({ type: 'PRICE_ACCELERATION', value: priceAccel });
  if (volumeAccel != null && volumeAccel > 0) signals.push({ type: 'VOLUME_ACCELERATION', value: volumeAccel });
  if (acceleration) signals.push({ type: 'ACCELERATION_RADAR', value: true });
  if (flowPressure != null && flowPressure >= config.minPressureScore) signals.push({ type: 'FLOW_PRESSURE', score: flowPressure });
  if (optionsPressure != null && optionsPressure >= config.minPressureScore) signals.push({ type: 'OPTIONS_PRESSURE', score: optionsPressure });

  const spreadAcceptable = spread == null || spread <= config.maxSpreadPercent;
  const eligible = spreadAcceptable && signals.length >= config.minSignals;
  const state = eligible ? 'IGNITION' : signals.length >= 2 ? 'PREPARING' : 'QUIET';

  return {
    version: EARLY_EXPLOSION_RADAR_VERSION,
    mode: EARLY_EXPLOSION_RADAR_MODE,
    symbol,
    eligible,
    state,
    reason: eligible ? 'EARLY_EXPLOSION_CONFLUENCE' : !spreadAcceptable ? 'SPREAD_TOO_WIDE' : 'INSUFFICIENT_CONFLUENCE',
    signalCount: signals.length,
    signals,
    direction: entry.pulse?.direction || entry.opportunity?.direction || 'UNKNOWN',
    freshness: entry.freshness,
    source: 'LIVE_RADAR_EVIDENCE',
    disclaimer: 'Early Explosion Radar identifies derived preparation/ignition conditions from supplied market evidence. It does not predict price, guarantee a breakout, or prove institutional/whale activity.',
  };
}

export { DEFAULTS as EARLY_EXPLOSION_RADAR_DEFAULTS };
