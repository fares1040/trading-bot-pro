/**
 * Aggregates supplied flow observations into directional evidence.
 * This is descriptive only: it does not claim institutional/whale activity.
 */

import { normalizeLiveFlowBatch } from './live-flow-normalizer.js';

export const LIVE_FLOW_AGGREGATOR_VERSION = '1.0';

const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

export function aggregateLiveFlow(observations = [], options = {}) {
  const { observations: normalized, errors, truncated } = normalizeLiveFlowBatch(observations);
  const freshOnly = options.freshOnly !== false;
  const usable = normalized.filter((o) => {
    if (!freshOnly) return true;
    return o.freshness?.status === 'FRESH' && o.freshness?.isFresh === true;
  });

  let buy = 0;
  let sell = 0;
  let buyCount = 0;
  let sellCount = 0;
  let unknownCount = 0;

  for (const o of usable) {
    const weight = Number.isFinite(o.notional) && o.notional > 0 ? o.notional : Number.isFinite(o.size) && o.size > 0 ? o.size : 1;
    if (o.direction === 'BUY') { buy += weight; buyCount++; }
    else if (o.direction === 'SELL') { sell += weight; sellCount++; }
    else unknownCount++;
  }

  const total = buy + sell;
  const buyShare = total > 0 ? (buy / total) * 100 : null;
  const sellShare = total > 0 ? (sell / total) * 100 : null;
  const pressureScore = total > 0 ? Math.round(Math.max(buyShare, sellShare)) : null;
  const direction = total === 0 ? 'UNKNOWN' : buy === sell ? 'NEUTRAL' : buy > sell ? 'BUY' : 'SELL';
  const confidence = total === 0 ? 0 : Math.round(clamp(Math.abs(buy - sell) / total * 100) * Math.min(1, usable.length / 5));

  return {
    version: LIVE_FLOW_AGGREGATOR_VERSION,
    mode: 'DERIVED',
    direction,
    pressureScore,
    confidence,
    buyNotional: buy,
    sellNotional: sell,
    buyShare: buyShare == null ? null : Number(buyShare.toFixed(2)),
    sellShare: sellShare == null ? null : Number(sellShare.toFixed(2)),
    buyCount,
    sellCount,
    unknownCount,
    observationCount: usable.length,
    discardedCount: normalized.length - usable.length,
    errors,
    truncated,
    dataQuality: usable.length === 0 ? 'INSUFFICIENT_DATA' : 'OBSERVED',
    disclaimer: 'Flow pressure is derived only from supplied observations. It is not proof of institutional, whale, or smart-money activity.',
  };
}
