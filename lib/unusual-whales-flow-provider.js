/**
 * Unusual Whales Flow Provider
 *
 * Optional provider adapter for real options-flow evidence.
 * Disabled unless UNUSUAL_WHALES_API_KEY is configured.
 * No fallback/fabrication: missing credentials or unavailable provider returns
 * an empty evidence set so downstream flow/smart-money remains UNKNOWN/
 * UNATTRIBUTED.
 */

const DEFAULT_BASE_URL = 'https://api.unusualwhales.com/api';
const DEFAULT_PATH = '/option-trades/flow-alerts';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 8000;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDirection(row) {
  const side = String(row?.side ?? row?.direction ?? row?.trade_side ?? '').toUpperCase();
  if (side === 'BUY' || side === 'BULLISH' || side === 'CALL') return 'BUY';
  if (side === 'SELL' || side === 'BEARISH' || side === 'PUT') return 'SELL';
  return 'UNKNOWN';
}

function normalizeObservation(row, symbol) {
  const premium = finite(row?.total_premium ?? row?.premium ?? row?.totalPremium);
  const size = finite(row?.total_size ?? row?.size ?? row?.totalSize);
  const executedAt = finite(row?.executed_at ?? row?.executedAt ?? row?.end_time ?? row?.timestamp);

  return {
    symbol,
    type: 'OPTIONS',
    direction: normalizeDirection(row),
    notional: premium,
    size,
    timestamp: executedAt == null ? null : (executedAt > 10_000_000_000 ? executedAt : executedAt * 1000),
    source: 'UNUSUAL_WHALES',
    providerEvidence: {
      alertId: row?.id ?? null,
      ruleId: row?.rule_id ?? null,
      optionChain: row?.option_chain ?? null,
      totalPremium: premium,
      askPremium: finite(row?.total_ask_side_prem),
      bidPremium: finite(row?.total_bid_side_prem),
      volume: finite(row?.volume),
      openInterest: finite(row?.open_interest),
      volumeOiRatio: finite(row?.volume_oi_ratio),
      tradeCount: finite(row?.trade_count),
      hasSweep: row?.has_sweep === true,
      hasFloor: row?.has_floor === true,
      allOpeningTrades: row?.all_opening_trades === true,
    },
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.flow_alerts)) return payload.flow_alerts;
  return [];
}

export function isUnusualWhalesConfigured(env = process.env) {
  return Boolean(String(env.UNUSUAL_WHALES_API_KEY || '').trim());
}

export async function fetchUnusualWhalesFlow(symbol, options = {}) {
  const cleanSymbol = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.^=-]{0,11}$/.test(cleanSymbol)) {
    throw new Error('Invalid symbol format');
  }

  if (!isUnusualWhalesConfigured(options.env)) {
    return {
      configured: false,
      source: 'UNUSUAL_WHALES',
      observations: [],
      attributionEvidence: [],
      dataQuality: 'UNAVAILABLE',
      disclaimer: 'Unusual Whales flow is not configured. No flow or smart-money evidence is inferred.',
    };
  }

  const baseUrl = String(options.baseUrl || options.env?.UNUSUAL_WHALES_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const path = String(options.path || options.env?.UNUSUAL_WHALES_FLOW_PATH || DEFAULT_PATH);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit || options.env?.UNUSUAL_WHALES_FLOW_LIMIT || DEFAULT_LIMIT)));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  url.searchParams.set('ticker', cleanSymbol);
  url.searchParams.set('limit', String(limit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${String(options.apiKey || options.env?.UNUSUAL_WHALES_API_KEY).trim()}`,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        configured: true,
        source: 'UNUSUAL_WHALES',
        observations: [],
        attributionEvidence: [],
        dataQuality: response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'UNAVAILABLE',
        status: response.status,
        disclaimer: `Unusual Whales flow provider returned HTTP ${response.status}. No flow or smart-money evidence is inferred.`,
      };
    }

    const payload = await response.json();
    const rows = extractRows(payload);
    const observations = rows
      .map((row) => normalizeObservation(row, cleanSymbol))
      .filter((row) => row.direction !== 'UNKNOWN' || row.notional != null || row.size != null);

    return {
      configured: true,
      source: 'UNUSUAL_WHALES',
      observations,
      attributionEvidence: [],
      dataQuality: observations.length ? 'OBSERVED' : 'INSUFFICIENT_DATA',
      observationCount: observations.length,
      disclaimer: 'Options flow is provider-sourced from Unusual Whales. BUY/SELL does not by itself prove opening/closing or institutional intent.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export { normalizeObservation, extractRows };
