/**
 * Live Flow Intelligence — provider-neutral schema.
 *
 * This module only normalizes already-supplied flow observations.
 * It does not fetch data, infer institutional activity, or fabricate values.
 */

export const LIVE_FLOW_VERSION = '1.0';
export const LIVE_FLOW_MODE = 'SCHEMA';

const FLOW_TYPES = Object.freeze(['TRADE', 'QUOTE', 'OPTIONS', 'UNKNOWN']);
const DIRECTIONS = Object.freeze(['BUY', 'SELL', 'NEUTRAL', 'UNKNOWN']);

function finite(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value, fallback = null) {
  if (value == null) return fallback;
  const v = String(value).trim();
  return v || fallback;
}

export function normalizeLiveFlowObservation(input = {}) {
  const type = text(input.type, 'UNKNOWN').toUpperCase();
  const direction = text(input.direction, 'UNKNOWN').toUpperCase();

  return Object.freeze({
    version: LIVE_FLOW_VERSION,
    mode: LIVE_FLOW_MODE,
    symbol: text(input.symbol, '').toUpperCase(),
    type: FLOW_TYPES.includes(type) ? type : 'UNKNOWN',
    direction: DIRECTIONS.includes(direction) ? direction : 'UNKNOWN',
    price: finite(input.price),
    size: finite(input.size),
    notional: finite(input.notional),
    bid: finite(input.bid),
    ask: finite(input.ask),
    timestamp: text(input.timestamp),
    receivedAt: text(input.receivedAt),
    source: text(input.source),
    freshness: input.freshness || null,
    dataQuality: text(input.dataQuality, 'UNKNOWN'),
    evidence: Array.isArray(input.evidence) ? [...input.evidence] : [],
    disclaimer: 'Schema-normalized flow observation only. No institutional or whale attribution is inferred without provider evidence.',
  });
}

export function validateLiveFlowObservation(observation) {
  const value = observation || {};
  const errors = [];
  if (!value.symbol) errors.push('Missing symbol');
  if (!FLOW_TYPES.includes(value.type)) errors.push('Invalid flow type');
  if (!DIRECTIONS.includes(value.direction)) errors.push('Invalid flow direction');
  return { valid: errors.length === 0, errors };
}
