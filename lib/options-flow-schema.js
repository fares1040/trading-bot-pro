/**
 * Provider-neutral options flow observation schema.
 * This layer normalizes supplied observations only; it does not create
 * real-time options data or infer whale activity from size alone.
 */

export const OPTIONS_FLOW_VERSION = '1.0';
export const OPTIONS_FLOW_MODE = 'SCHEMA';

const TYPES = new Set(['CALL', 'PUT', 'UNKNOWN']);
const DIRECTIONS = new Set(['BUY', 'SELL', 'NEUTRAL', 'UNKNOWN']);
const finite = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function normalizeOptionsFlowObservation(input = {}) {
  const type = TYPES.has(String(input.type ?? '').toUpperCase()) ? String(input.type).toUpperCase() : 'UNKNOWN';
  const direction = DIRECTIONS.has(String(input.direction ?? '').toUpperCase()) ? String(input.direction).toUpperCase() : 'UNKNOWN';
  return {
    version: OPTIONS_FLOW_VERSION,
    mode: OPTIONS_FLOW_MODE,
    symbol: typeof input.symbol === 'string' ? input.symbol.toUpperCase() : null,
    contractSymbol: typeof input.contractSymbol === 'string' ? input.contractSymbol : null,
    type,
    direction,
    strike: finite(input.strike),
    expiration: input.expiration ?? null,
    premium: finite(input.premium),
    volume: finite(input.volume),
    openInterest: finite(input.openInterest),
    impliedVolatility: finite(input.impliedVolatility),
    timestamp: input.timestamp ?? null,
    freshness: input.freshness ?? { status: 'UNKNOWN', isFresh: false },
    source: input.source ?? null,
    disclaimer: 'Schema-normalized options flow observation only. No real-time, institutional, or whale attribution is inferred without provider evidence.',
  };
}

export function validateOptionsFlowObservation(observation) {
  const errors = [];
  if (!observation || typeof observation !== 'object') errors.push('observation must be an object');
  else {
    if (!observation.symbol) errors.push('symbol is required');
    if (!TYPES.has(observation.type)) errors.push('type must be CALL, PUT, or UNKNOWN');
    if (!DIRECTIONS.has(observation.direction)) errors.push('direction is invalid');
  }
  return { valid: errors.length === 0, errors };
}
