/**
 * Provider-neutral Live Flow normalizer.
 * Converts normalized observations into bounded evidence without inventing
 * direction, size, notional, freshness, or institutional attribution.
 */

import { normalizeLiveFlowObservation, validateLiveFlowObservation } from './live-flow-schema.js';

const MAX_OBSERVATIONS = 100;

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLiveFlowBatch(input = []) {
  const observations = Array.isArray(input) ? input.slice(0, MAX_OBSERVATIONS) : [];
  const normalized = [];
  const errors = [];

  for (const item of observations) {
    const observation = normalizeLiveFlowObservation(item);
    const validation = validateLiveFlowObservation(observation);
    if (!validation.valid) {
      errors.push({ symbol: observation.symbol || '', errors: validation.errors });
      continue;
    }
    normalized.push(observation);
  }

  return { observations: normalized, errors, truncated: Array.isArray(input) && input.length > MAX_OBSERVATIONS };
}

export function buildLiveFlowEvidence(observation) {
  const normalized = normalizeLiveFlowObservation(observation);
  const validation = validateLiveFlowObservation(normalized);
  if (!validation.valid) {
    return { valid: false, evidence: [], errors: validation.errors };
  }

  const evidence = [];
  const notional = finite(normalized.notional);
  const size = finite(normalized.size);

  if (normalized.direction !== 'UNKNOWN') {
    evidence.push({ type: 'FLOW_DIRECTION', value: normalized.direction });
  }
  if (notional != null) {
    evidence.push({ type: 'FLOW_NOTIONAL', value: notional });
  } else if (size != null) {
    evidence.push({ type: 'FLOW_SIZE', value: size });
  }
  if (normalized.type !== 'UNKNOWN') {
    evidence.push({ type: 'FLOW_TYPE', value: normalized.type });
  }
  if (normalized.freshness) {
    evidence.push({ type: 'FLOW_FRESHNESS', value: normalized.freshness.status || 'UNKNOWN' });
  }

  return {
    valid: true,
    symbol: normalized.symbol,
    evidence,
    source: normalized.source,
    dataQuality: normalized.dataQuality,
    disclaimer: normalized.disclaimer,
  };
}
