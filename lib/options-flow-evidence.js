/**
 * Provider-neutral options flow evidence.
 *
 * This layer normalizes observations only. It never infers whale or
 * institutional intent from price, volume, premium, or open interest alone.
 */

export const OPTIONS_FLOW_EVIDENCE_VERSION = '1.0';

const TYPES = new Set(['CALL', 'PUT', 'UNKNOWN']);
const DIRECTIONS = new Set(['BUY', 'SELL', 'NEUTRAL', 'UNKNOWN']);

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeOptionsFlowObservation(input = {}) {
  const type = TYPES.has(input.type) ? input.type : 'UNKNOWN';
  const direction = DIRECTIONS.has(input.direction) ? input.direction : 'UNKNOWN';
  return {
    symbol: text(input.symbol)?.toUpperCase() ?? null,
    type,
    direction,
    strike: finite(input.strike),
    expiry: text(input.expiry),
    premium: finite(input.premium),
    contracts: finite(input.contracts),
    openInterest: finite(input.openInterest),
    impliedVolatility: finite(input.impliedVolatility),
    notional: finite(input.notional),
    timestamp: finite(input.timestamp),
    freshness: input.freshness ?? null,
    provider: text(input.provider),
    attributionEvidence: Array.isArray(input.attributionEvidence) ? input.attributionEvidence.filter(Boolean) : [],
  };
}

export function validateOptionsFlowObservation(observation = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object') errors.push('observation must be an object');
  if (observation.symbol !== null && typeof observation.symbol !== 'string') errors.push('symbol must be string or null');
  if (!TYPES.has(observation.type)) errors.push('invalid type');
  if (!DIRECTIONS.has(observation.direction)) errors.push('invalid direction');
  return { valid: errors.length === 0, errors };
}

export function buildOptionsFlowEvidence(observation = {}) {
  const normalized = normalizeOptionsFlowObservation(observation);
  const evidence = [];
  if (normalized.direction !== 'UNKNOWN') evidence.push({ type: 'OPTIONS_DIRECTION', value: normalized.direction });
  if (normalized.type !== 'UNKNOWN') evidence.push({ type: 'OPTIONS_TYPE', value: normalized.type });
  if (normalized.notional != null) evidence.push({ type: 'OPTIONS_NOTIONAL', value: normalized.notional });
  else if (normalized.contracts != null) evidence.push({ type: 'OPTIONS_CONTRACTS', value: normalized.contracts });
  if (normalized.freshness) evidence.push({ type: 'OPTIONS_FRESHNESS', value: normalized.freshness.status ?? 'UNKNOWN' });
  return evidence;
}

export const OPTIONS_FLOW_DISCLAIMER = 'Options flow evidence is provider-derived and observation-based; premium, contracts, open interest, or direction alone does not prove smart-money, institutional, or whale activity.';
