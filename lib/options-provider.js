/**
 * Options Intelligence Provider — Shared Foundation
 *
 * Phase 6 — Options Intelligence (STEP 2)
 *
 * This module extracts and centralizes the Yahoo Finance options-chain logic
 * that was previously isolated inside app/api/options-radar/route.js. It is a
 * reusable provider so that future phases (e.g. connecting options to Hunter)
 * can import a single, well-tested source of truth.
 *
 * IMPORTANT (data-safety rules from AGENTS.md):
 * - No options data is fabricated or generated.
 * - Missing IV / open interest / volume / premium is preserved as null.
 * - We never silently substitute one data provider for another.
 * - When Yahoo returns no chain, an empty response, or an error, we return an
 *   explicit unavailable/empty state — we do NOT invent values.
 * - This module does NOT change Hunter scoring, HIC, Technical Score, Risk
 *   Engine, Market Regime, or institutional scoring.
 *
 * Data Source:
 * - Yahoo Finance public options chain (v7)
 *   https://query2.finance.yahoo.com/v7/finance/options/{symbol}
 *
 * Authentication:
 * - None required (public endpoint). No API key, no paid provider.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const YAHOO_OPTIONS_URL = (symbol) =>
  `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 HUNTER-AI/4.1',
  Accept: 'application/json',
};

const OPTIONS_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 60 * 1000; // 60s — options chains are not real-time critical

// In-memory cache keyed by uppercase symbol. Avoids duplicate Yahoo requests
// for the same symbol within the TTL window.
const optionsCache = new Map();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate and normalize a symbol for the options endpoint.
 * @param {string} value
 * @returns {string|null} cleaned symbol or null if invalid
 */
export function cleanSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(symbol) ? symbol : null;
}

/**
 * Coerce to finite number or null (never NaN, never fabricated).
 * @param {*} value
 * @returns {number|null}
 */
function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

/**
 * Normalize a single option contract into a stable internal schema.
 *
 * Only fields actually supplied by Yahoo are preserved. Missing values become
 * null — they are NEVER assumed to be zero or estimated.
 *
 * @param {Object} x - raw Yahoo contract object
 * @param {'CALL'|'PUT'} side
 * @param {number|null} underlying - underlying spot price
 * @param {number} expiry - expiration timestamp (seconds)
 * @returns {Object} normalized contract
 */
export function normalizeOptionContract(x, side, underlying, expiry) {
  const bid = n(x.bid);
  const ask = n(x.ask);
  const last = n(x.lastPrice);

  // Mid only when both bid/ask are valid and positive; otherwise fall back to
  // last price. If neither is available, premium stays null (not fabricated).
  const mid =
    bid != null && ask != null && bid > 0 && ask > 0
      ? (bid + ask) / 2
      : last;

  const volume = n(x.volume) ?? 0;
  const openInterest = n(x.openInterest) ?? 0;

  const spreadPct =
    bid != null && ask != null && mid != null && mid > 0
      ? ((ask - bid) / mid) * 100
      : null;

  const strike = n(x.strike);
  const distancePct =
    underlying && strike ? Math.abs((strike - underlying) / underlying) * 100 : null;

  // Liquidity score (0-100): volume + open interest + tight spread.
  const liquidityScore =
    Math.min(100, volume * 1.2) * 0.45 +
    Math.min(100, openInterest / 5) * 0.35 +
    (spreadPct == null ? 25 : Math.max(0, 100 - spreadPct * 3)) * 0.2;

  // Premium score (0-100): cheaper contracts score higher (capped at $1 scale).
  const premiumScore = mid != null ? Math.max(0, 100 - mid * 100) : 0;

  const score = Math.round(
    Math.min(100, liquidityScore * 0.65 + premiumScore * 0.35)
  );

  return {
    symbol: x.contractSymbol || null,
    optionType: side,
    strike,
    expiry:
      expiry != null
        ? new Date(expiry * 1000).toISOString().slice(0, 10)
        : null,
    bid,
    ask,
    lastPrice: last,
    // Premium = mid price per share (null if not derivable).
    premium: mid != null ? Number(mid.toFixed(2)) : null,
    // Cost to control 100 shares (null if premium unknown).
    contractCost: mid != null ? Number((mid * 100).toFixed(2)) : null,
    volume,
    openInterest,
    impliedVolatility: n(x.impliedVolatility),
    spreadPct: spreadPct != null ? Number(spreadPct.toFixed(1)) : null,
    underlying: underlying != null ? Number(underlying) : null,
    distancePct: distancePct != null ? Number(distancePct.toFixed(1)) : null,
    liquidityScore: Math.round(liquidityScore),
    premiumScore: Math.round(premiumScore),
    score,
    riskLabel: 'HIGH RISK / SPECULATIVE',
    source: 'Yahoo Finance options chain',
  };
}

// ============================================================================
// FETCH + NORMALIZE
// ============================================================================

/**
 * Fetch the raw Yahoo options JSON safely.
 * @param {string} symbol - cleaned symbol
 * @returns {Promise<Object>} { ok, json, error }
 */
async function fetchYahooOptionsJson(symbol) {
  let response;
  try {
    response = await fetch(YAHOO_OPTIONS_URL(symbol), {
      headers: YAHOO_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(OPTIONS_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure or timeout — treat as unavailable, do not fabricate.
    return { ok: false, json: null, error: `yahoo-options-request-failed:${error?.message || 'unknown'}` };
  }

  if (!response.ok) {
    return { ok: false, json: null, error: `yahoo-options-${response.status}` };
  }

  const text = await response.text().catch(() => '');
  if (!text || !text.trim()) {
    return { ok: false, json: null, error: 'yahoo-options-empty-response' };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, json: null, error: 'yahoo-options-invalid-json' };
  }

  return { ok: true, json, error: null };
}

/**
 * Fetch and normalize the options chain for a symbol.
 *
 * Always resolves (never throws). Returns an explicit available/unavailable
 * state so callers can decide what to do without guessing.
 *
 * @param {string} symbol - raw ticker (will be validated)
 * @param {Object} [opts]
 * @param {boolean} [opts.skipCache] - bypass the in-memory cache
 * @returns {Promise<Object>} normalized options result
 */
export async function fetchOptionsChain(symbol, opts = {}) {
  const clean = cleanSymbol(symbol);
  if (!clean) {
    return {
      provider: 'yahoo',
      symbol: null,
      available: false,
      source: 'Yahoo Finance options chain',
      underlyingPrice: null,
      expiry: null,
      contracts: [],
      count: 0,
      dataTimestamp: new Date().toISOString(),
      reason: 'invalid-symbol',
      errors: ['symbol failed validation'],
    };
  }

  // Cache check
  if (!opts.skipCache) {
    const cached = optionsCache.get(clean);
    if (cached && cached.timestamp > Date.now() - CACHE_TTL_MS) {
      return { ...cached.data, cached: true };
    }
  }

  const { ok, json, error } = await fetchYahooOptionsJson(clean);

  if (!ok) {
    const result = {
      provider: 'yahoo',
      symbol: clean,
      available: false,
      source: 'Yahoo Finance options chain',
      underlyingPrice: null,
      expiry: null,
      contracts: [],
      count: 0,
      dataTimestamp: new Date().toISOString(),
      reason: error || 'yahoo-options-error',
      errors: [error || 'yahoo-options-error'],
    };
    return result;
  }

  const result = json?.optionChain?.result?.[0];
  const expiry = result?.expirationDates?.[0];

  if (!result || expiry == null) {
    const result2 = {
      provider: 'yahoo',
      symbol: clean,
      available: false,
      source: 'Yahoo Finance options chain',
      underlyingPrice: null,
      expiry: null,
      contracts: [],
      count: 0,
      dataTimestamp: new Date().toISOString(),
      reason: 'yahoo-options-no-chain',
      errors: ['Yahoo returned no optionChain result or expiration'],
    };
    return result2;
  }

  const chain = result?.options?.[0];
  const underlying =
    n(result?.quote?.regularMarketPrice) ?? n(result?.quote?.postMarketPrice);

  const rows = [
    ...(Array.isArray(chain?.calls)
      ? chain.calls.map((x) => normalizeOptionContract(x, 'CALL', underlying, expiry))
      : []),
    ...(Array.isArray(chain?.puts)
      ? chain.puts.map((x) => normalizeOptionContract(x, 'PUT', underlying, expiry))
      : []),
  ];

  if (rows.length === 0) {
    const result3 = {
      provider: 'yahoo',
      symbol: clean,
      available: false,
      source: 'Yahoo Finance options chain',
      underlyingPrice: underlying != null ? Number(underlying) : null,
      expiry: new Date(expiry * 1000).toISOString().slice(0, 10),
      contracts: [],
      count: 0,
      dataTimestamp: new Date().toISOString(),
      reason: 'yahoo-options-empty-chain',
      errors: ['Yahoo returned a chain with no calls or puts'],
    };
    return result3;
  }

  const normalized = {
    provider: 'yahoo',
    symbol: clean,
    available: true,
    source: 'Yahoo Finance options chain',
    underlyingPrice: underlying != null ? Number(underlying) : null,
    expiry: new Date(expiry * 1000).toISOString().slice(0, 10),
    contracts: rows,
    count: rows.length,
    dataTimestamp: new Date().toISOString(),
    reason: null,
    errors: [],
  };

  // Cache the successful result
  optionsCache.set(clean, { data: normalized, timestamp: Date.now() });

  return normalized;
}

// ============================================================================
// PROVIDER STATUS
// ============================================================================

/**
 * Report the options provider configuration/status.
 *
 * Yahoo is a public, unauthenticated endpoint, so it is "configured" without
 * any credentials. Actual data availability is only known after a live fetch
 * via fetchOptionsChain(); this function reports the static source identity.
 *
 * @returns {Object}
 */
export function getOptionsProviderStatus() {
  return {
    provider: 'yahoo',
    source: 'Yahoo Finance options chain',
    configured: true,
    requiresAuth: false,
    available: null, // unknown until a live fetch is performed
    note:
      'Yahoo Finance public options chain. No API key required. Real data only — missing values are preserved as null, never fabricated.',
    capabilities: {
      calls: true,
      puts: true,
      impliedVolatility: true,
      openInterest: true,
      volume: true,
      premium: true,
      liquidityScore: true,
    },
  };
}

/**
 * Clear the in-memory options cache (useful for testing).
 */
export function clearOptionsCache() {
  optionsCache.clear();
}