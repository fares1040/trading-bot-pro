/**
 * Live Market Data
 *
 * Fetches real-time(ish) market data from Yahoo Finance using the existing
 * fetchChart() from market-engine.js. This module does NOT create new network
 * clients — it reuses the established Yahoo fetch pattern.
 *
 * Data is polled, NOT streaming. Prices may be delayed.
 */

import { fetchChart, SYMBOL_RE } from './market-engine.js';

const HISTORY_MAX = 20;

/**
 * @typedef {Object} LiveSnapshot
 * @property {string} symbol
 * @property {number|null} price
 * @property {number|null} previousClose
 * @property {number|null} changePercent
 * @property {number|null} volume
 * @property {number|null} averageVolume20
 * @property {number|null} relativeVolume
 * @property {number|null} rsi
 * @property {number|null} sma20
 * @property {number|null} sma50
 * @property {number|null} atr
 * @property {boolean} stale
 * @property {string} fetchedAt
 * @property {string|null} asOf
 * @property {string} source
 */

function n(v) {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function average(values) {
  const v = values.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l += Math.abs(d);
  }
  let ag = g / period, al = l / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = ((ag * (period - 1)) + (d > 0 ? d : 0)) / period;
    al = ((al * (period - 1)) + (d < 0 ? Math.abs(d) : 0)) / period;
  }
  return al === 0 ? 100 : 100 - (100 / (1 + ag / al));
}

function calculateATR(highs, lows, closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    const h = n(highs[i]) ?? n(closes[i]) ?? 0;
    const l = n(lows[i]) ?? n(closes[i]) ?? 0;
    const pc = n(closes[i - 1]) ?? n(closes[i]) ?? 0;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return null;
  let atr = average(trs.slice(0, period));
  if (atr == null) return null;
  for (let i = period; i < trs.length; i++) {
    atr = ((atr * (period - 1)) + trs[i]) / period;
  }
  return atr;
}

/**
 * Fetch a single symbol's live market snapshot.
 * @param {string} symbol
 * @param {Object} [opts]
 * @param {string} [opts.range='5d'] - Yahoo chart range
 * @returns {Promise<LiveSnapshot>}
 */
export async function fetchLiveSnapshot(symbol, opts = {}) {
  const { range = '5d' } = opts;
  const clean = String(symbol || '').trim().toUpperCase();

  if (!SYMBOL_RE.test(clean)) {
    return {
      symbol: clean,
      price: null, previousClose: null, changePercent: null,
      volume: null, averageVolume20: null, relativeVolume: null,
      rsi: null, sma20: null, sma50: null, atr: null,
      stale: false, fetchedAt: new Date().toISOString(), asOf: null,
      source: 'yahoo', error: 'Invalid symbol',
    };
  }

  try {
    const chart = await fetchChart(clean, range);
    if (!chart?.meta || !chart?.quote) {
      throw new Error('No market data');
    }

    const closes = (chart.quote?.close || []).map(Number).filter(Number.isFinite);
    const highs = (chart.quote?.high || []).map(Number).filter(Number.isFinite);
    const lows = (chart.quote?.low || []).map(Number).filter(Number.isFinite);
    const vols = (chart.quote?.volume || []).map(Number).filter(Number.isFinite);

    if (closes.length < 20) {
      return {
        symbol: chart.symbol || clean,
        price: n(chart.meta?.regularMarketPrice) ?? n(closes.at(-1)),
        previousClose: n(chart.meta?.previousClose || chart.meta?.chartPreviousClose) ?? n(closes.at(-2)),
        changePercent: null, volume: n(vols.at(-1)),
        averageVolume20: null, relativeVolume: null,
        rsi: null, sma20: null, sma50: null, atr: null,
        stale: chart.stale ?? false, fetchedAt: chart.fetchedAt,
        asOf: chart.asOf, source: 'yahoo', error: 'Insufficient history',
      };
    }

    const price = n(chart.meta?.regularMarketPrice) ?? n(closes.at(-1));
    const prev = n(chart.meta?.previousClose || chart.meta?.chartPreviousClose) ?? n(closes.at(-2));
    const volume = n(vols.at(-1));
    const avgVol = average(vols.slice(-21, -1));
    const rvol = (avgVol && avgVol > 0 && volume != null) ? volume / avgVol : null;

    return {
      symbol: chart.symbol || clean,
      price,
      previousClose: prev,
      changePercent: (price != null && prev != null && prev > 0)
        ? ((price - prev) / prev) * 100
        : null,
      volume,
      averageVolume20: avgVol != null ? Math.round(avgVol) : null,
      relativeVolume: rvol != null ? Number(rvol.toFixed(2)) : null,
      rsi: n(calculateRSI(closes)),
      sma20: n(average(closes.slice(-20))),
      sma50: n(average(closes.slice(-50))),
      atr: n(calculateATR(highs, lows, closes)),
      stale: chart.stale ?? false,
      fetchedAt: chart.fetchedAt,
      asOf: chart.asOf,
      source: 'yahoo',
    };
  } catch (error) {
    return {
      symbol: clean,
      price: null, previousClose: null, changePercent: null,
      volume: null, averageVolume20: null, relativeVolume: null,
      rsi: null, sma20: null, sma50: null, atr: null,
      stale: false, fetchedAt: new Date().toISOString(), asOf: null,
      source: 'yahoo', error: error?.message || 'Fetch failed',
    };
  }
}

/**
 * Process-local history store for building per-symbol snapshots over time.
 * NOT persistent. Resets on serverless cold start.
 */
const historyStore = new Map();

/**
 * Update process-local history for a symbol.
 * @param {string} symbol
 * @param {LiveSnapshot} snapshot
 * @returns {{ count: number, entries: LiveSnapshot[] }}
 */
export function updateHistory(symbol, snapshot) {
  const key = String(symbol || '').trim().toUpperCase();
  if (!key) return { count: 0, entries: [] };

  const existing = historyStore.get(key) || [];
  const entries = [...existing, snapshot].slice(-HISTORY_MAX);
  historyStore.set(key, entries);
  return { count: entries.length, entries };
}

/**
 * Get process-local history for a symbol.
 * @param {string} symbol
 * @returns {LiveSnapshot[]}
 */
export function getHistory(symbol) {
  const key = String(symbol || '').trim().toUpperCase();
  return historyStore.get(key) || [];
}

/**
 * Clear history for a symbol or all symbols.
 * @param {string} [symbol]
 */
export function clearHistory(symbol) {
  if (symbol) {
    const key = String(symbol || '').trim().toUpperCase();
    historyStore.delete(key);
  } else {
    historyStore.clear();
  }
}

/**
 * Check if history has enough entries for acceleration analysis.
 * @param {string} symbol
 * @param {number} [minEntries=3]
 * @returns {boolean}
 */
export function hasEnoughHistory(symbol, minEntries = 3) {
  return getHistory(symbol).length >= minEntries;
}
