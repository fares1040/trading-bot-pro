import { normalizeOptionsFlowObservation } from './options-flow-evidence.js';

export const OPTIONS_FLOW_AGGREGATOR_VERSION = '1.0';

function fresh(item) {
  return item?.freshness?.status === 'FRESH' && item?.freshness?.isFresh === true;
}

export function aggregateOptionsFlow(observations = [], options = {}) {
  const freshOnly = options.freshOnly !== false;
  const normalized = Array.isArray(observations)
    ? observations.filter(Boolean).map(normalizeOptionsFlowObservation)
    : [];
  const usable = normalized.filter((item) => !freshOnly || fresh(item));
  const directional = usable.filter((item) => item.direction === 'BUY' || item.direction === 'SELL');
  const buy = directional.filter((item) => item.direction === 'BUY');
  const sell = directional.filter((item) => item.direction === 'SELL');
  const weight = (item) => {
    if (Number.isFinite(item.notional) && item.notional > 0) return item.notional;
    if (Number.isFinite(item.contracts) && item.contracts > 0) return item.contracts;
    return 1;
  };
  const buyWeight = buy.reduce((sum, item) => sum + weight(item), 0);
  const sellWeight = sell.reduce((sum, item) => sum + weight(item), 0);
  const total = buyWeight + sellWeight;
  const pressureScore = total > 0 ? Math.round((Math.abs(buyWeight - sellWeight) / total) * 100) : 0;
  const direction = total === 0 ? 'UNKNOWN' : buyWeight > sellWeight ? 'BUY' : sellWeight > buyWeight ? 'SELL' : 'NEUTRAL';
  const confidence = total > 0 ? Math.round((Math.abs(buyWeight - sellWeight) / total) * Math.min(1, usable.length / 5) * 100) / 100 : 0;
  return {
    version: OPTIONS_FLOW_AGGREGATOR_VERSION,
    observationCount: usable.length,
    buyCount: buy.length,
    sellCount: sell.length,
    buyWeight,
    sellWeight,
    pressureScore,
    direction,
    confidence,
    dataQuality: usable.length === 0 ? 'INSUFFICIENT_DATA' : 'OBSERVED',
    disclaimer: 'Options pressure is derived from supplied observations and is not proof of institutional, smart-money, or whale activity.',
  };
}
