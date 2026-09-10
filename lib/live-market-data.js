import {
  recordProviderFailure,
  recordProviderSuccess,
  shouldAllowProviderCall,
} from './circuit-breaker-manager.js';

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'application/json',
};

const DEFAULT_TTL_MS = 15_000;
const DEFAULT_FRESH_THRESHOLD_MS = 90_000;
const LIVE_RANGE = '1d';
const LIVE_INTERVAL = '1m';
const cache = new Map();

export const LIVE_DATA_MODE = 'POLLING';
export const LIVE_DATA_SOURCE = 'YAHOO_CHART';

const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;

function nowMs() {
  return Date.now();
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildFreshness(asOf, fetchedAt, freshThresholdMs) {
  const asOfMs = asOf ? Date.parse(asOf) : NaN;
  const fetchedMs = Date.parse(fetchedAt);
  const referenceMs = Number.isFinite(asOfMs) ? asOfMs : fetchedMs;
  const ageMs = Number.isFinite(referenceMs) ? Math.max(0, fetchedMs - referenceMs) : null;

  return {
    asOf,
    fetchedAt,
    ageMs,
    thresholdMs: freshThresholdMs,
    isFresh: ageMs != null && ageMs <= freshThresholdMs,
    status: ageMs == null ? 'UNKNOWN' : ageMs <= freshThresholdMs ? 'FRESH' : 'STALE',
  };
}

function normalizeSnapshot(symbol, result, fetchedAt, freshThresholdMs) {
  const meta = result?.meta || {};
  const quote = result?.indicators?.quote?.[0] || {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const lastIndex = timestamps.length - 1;
  const timestamp = lastIndex >= 0 ? timestamps[lastIndex] : null;
  const asOf = Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : null;

  const price = normalizeNumber(meta.regularMarketPrice)
    ?? normalizeNumber(quote.close?.[lastIndex]);
  const previousClose = normalizeNumber(meta.previousClose)
    ?? normalizeNumber(meta.chartPreviousClose);
  const volume = normalizeNumber(meta.regularMarketVolume)
    ?? normalizeNumber(quote.volume?.[lastIndex]);
  const open = normalizeNumber(quote.open?.[lastIndex]);
  const high = normalizeNumber(quote.high?.[lastIndex]);
  const low = normalizeNumber(quote.low?.[lastIndex]);
  const close = normalizeNumber(quote.close?.[lastIndex]);
  const changePercent = price != null && previousClose > 0
    ? ((price - previousClose) / previousClose) * 100
    : null;

  const freshness = buildFreshness(asOf, fetchedAt, freshThresholdMs);

  return {
    symbol: String(meta.symbol || symbol).toUpperCase(),
    price,
    previousClose,
    changePercent: changePercent == null ? null : Number(changePercent.toFixed(4)),
    volume,
    candle: { open, high, low, close, timestamp: asOf },
    timestamp: asOf,
    fetchedAt,
    freshness,
    source: LIVE_DATA_SOURCE,
    mode: LIVE_DATA_MODE,
    interval: LIVE_INTERVAL,
    range: LIVE_RANGE,
    dataQuality: freshness.status,
    disclaimer: 'Yahoo chart data is polled and may be delayed; it is not a guaranteed real-time market feed.',
  };
}

function cacheKey(symbol) {
  return String(symbol).trim().toUpperCase();
}

export function clearLiveMarketDataCache(symbol) {
  if (symbol == null) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(symbol));
}

export function getLiveMarketDataCacheStats() {
  const current = nowMs();
  let valid = 0;
  for (const entry of cache.values()) {
    if (entry.expiresAt > current) valid++;
  }
  return { size: cache.size, valid };
}

export async function fetchLiveMarketSnapshot(symbol, opts = {}) {
  const clean = cacheKey(symbol);
  if (!SYMBOL_RE.test(clean)) throw new Error('رمز سهم غير صالح');

  const ttlMs = Number.isFinite(Number(opts.ttlMs)) ? Math.max(0, Number(opts.ttlMs)) : DEFAULT_TTL_MS;
  const freshThresholdMs = Number.isFinite(Number(opts.freshThresholdMs))
    ? Math.max(0, Number(opts.freshThresholdMs))
    : DEFAULT_FRESH_THRESHOLD_MS;
  const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) ? Math.max(1000, Number(opts.timeoutMs)) : 10000;
  const key = clean;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > nowMs()) {
    return { ...cached.snapshot, cache: { hit: true, ttlMs } };
  }

  const circuit = shouldAllowProviderCall('yahoo');
  if (!circuit.allowed) {
    const error = new Error('Yahoo provider circuit breaker is open');
    error.code = 'PROVIDER_CIRCUIT_OPEN';
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${LIVE_INTERVAL}&range=${LIVE_RANGE}&events=div%2Csplits`,
      { headers: YAHOO_HEADERS, cache: 'no-store', signal: controller.signal }
    );

    if (!response.ok) {
      const error = new Error(`Yahoo Finance ${response.status}`);
      recordProviderFailure('yahoo', error, 'live-market-data', clean, false);
      throw error;
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result?.meta) {
      const error = new Error('No live market data');
      recordProviderFailure('yahoo', error, 'live-market-data', clean, false);
      throw error;
    }

    const snapshot = normalizeSnapshot(clean, result, fetchedAt, freshThresholdMs);
    cache.set(key, { snapshot, expiresAt: nowMs() + ttlMs });
    recordProviderSuccess('yahoo', 'live-market-data', clean);
    return { ...snapshot, cache: { hit: false, ttlMs } };
  } catch (error) {
    if (error?.code !== 'PROVIDER_CIRCUIT_OPEN'
      && !String(error?.message || '').startsWith('Yahoo Finance ')
      && String(error?.message || '') !== 'No live market data') {
      recordProviderFailure('yahoo', error, 'live-market-data', clean, false);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
