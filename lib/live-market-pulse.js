const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function pct(current, previous) { if (current == null || previous == null || previous === 0) return null; return ((current - previous) / Math.abs(previous)) * 100; }
function directionFrom(value, threshold = 0.05) { if (!Number.isFinite(value) || Math.abs(value) < threshold) return 'FLAT'; return value > 0 ? 'UP' : 'DOWN'; }
export const PULSE_VERSION = '1.0';
export const PULSE_MODE = 'DERIVED';
export function buildLiveMarketPulse(current, history = []) {
  const snapshots = Array.isArray(history) ? history.filter(Boolean) : [];
  const previous = snapshots.at(-1) || null;
  const previousPrevious = snapshots.at(-2) || null;
  const price = finite(current?.price);
  const previousPrice = finite(previous?.price ?? current?.previousClose);
  const previousVolume = finite(previous?.volume);
  const volume = finite(current?.volume);
  const priceChangePercent = pct(price, previousPrice);
  const volumeChangePercent = pct(volume, previousVolume);
  const priorPriceChange = previous && previousPrevious ? pct(finite(previous.price), finite(previousPrevious.price)) : null;
  const priceAccelerationPercent = priceChangePercent == null || priorPriceChange == null ? null : priceChangePercent - priorPriceChange;
  const priorVolumeChange = previous && previousPrevious ? pct(finite(previous.volume), finite(previousPrevious.volume)) : null;
  const volumeAccelerationPercent = volumeChangePercent == null || priorVolumeChange == null ? null : volumeChangePercent - priorVolumeChange;
  const spread = current?.spread ?? null;
  const bid = finite(current?.bid);
  const ask = finite(current?.ask);
  const derivedSpread = bid != null && ask != null && bid > 0 ? ((ask - bid) / bid) * 100 : finite(spread);
  const vwap = finite(current?.vwap);
  const vwapDistancePercent = pct(price, vwap);
  const momentum = clamp(50 + (priceChangePercent || 0) * 8);
  const acceleration = clamp(50 + (priceAccelerationPercent || 0) * 6);
  const volumePressure = clamp(50 + (volumeChangePercent || 0) * 0.8);
  const vwapBias = vwapDistancePercent == null ? 50 : clamp(50 + vwapDistancePercent * 10);
  const pressureScore = Math.round(momentum * 0.35 + acceleration * 0.25 + volumePressure * 0.25 + vwapBias * 0.15);
  const direction = directionFrom((priceChangePercent || 0) * 0.5 + (priceAccelerationPercent || 0) * 0.5);
  const accelerationState = priceAccelerationPercent == null || volumeAccelerationPercent == null ? 'INSUFFICIENT_DATA' : priceAccelerationPercent > 0.15 && volumeAccelerationPercent > 5 ? 'ACCELERATING' : priceAccelerationPercent < -0.15 && volumeAccelerationPercent > 5 ? 'DECELERATING_DOWN' : 'STABLE';
  const evidence = [];
  if (priceChangePercent != null) evidence.push({ type: 'PRICE_CHANGE', value: Number(priceChangePercent.toFixed(4)), direction });
  if (priceAccelerationPercent != null) evidence.push({ type: 'PRICE_ACCELERATION', value: Number(priceAccelerationPercent.toFixed(4)) });
  if (volumeChangePercent != null) evidence.push({ type: 'VOLUME_CHANGE', value: Number(volumeChangePercent.toFixed(4)) });
  if (volumeAccelerationPercent != null) evidence.push({ type: 'VOLUME_ACCELERATION', value: Number(volumeAccelerationPercent.toFixed(4)) });
  if (vwapDistancePercent != null) evidence.push({ type: 'VWAP_DISTANCE', value: Number(vwapDistancePercent.toFixed(4)) });
  if (derivedSpread != null) evidence.push({ type: 'SPREAD', value: Number(derivedSpread.toFixed(4)) });
  return { version: PULSE_VERSION, mode: PULSE_MODE, symbol: String(current?.symbol || '').toUpperCase(), timestamp: current?.timestamp || null, fetchedAt: current?.fetchedAt || null, freshness: current?.freshness || null, direction, price, priceChangePercent: priceChangePercent == null ? null : Number(priceChangePercent.toFixed(4)), priceAccelerationPercent: priceAccelerationPercent == null ? null : Number(priceAccelerationPercent.toFixed(4)), volume, volumeChangePercent: volumeChangePercent == null ? null : Number(volumeChangePercent.toFixed(4)), volumeAccelerationPercent: volumeAccelerationPercent == null ? null : Number(volumeAccelerationPercent.toFixed(4)), vwap, vwapDistancePercent: vwapDistancePercent == null ? null : Number(vwapDistancePercent.toFixed(4)), spreadPercent: derivedSpread == null ? null : Number(derivedSpread.toFixed(4)), momentumScore: Math.round(momentum), accelerationScore: Math.round(acceleration), volumePressureScore: Math.round(volumePressure), vwapBiasScore: Math.round(vwapBias), pressureScore, accelerationState, evidence, dataQuality: current?.dataQuality || 'UNKNOWN', source: current?.source || null, disclaimer: 'Pulse metrics are derived from supplied market snapshots; they are not independent real-time order-flow or institutional-flow data.' };
}
