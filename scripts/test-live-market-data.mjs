#!/usr/bin/env node

import { strict as assert } from 'node:assert';
import {
  clearLiveMarketDataCache,
  fetchLiveMarketSnapshot,
  getLiveMarketDataCacheStats,
  LIVE_DATA_MODE,
  LIVE_DATA_SOURCE,
} from '../lib/live-market-data.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log('PASS: ' + name); passed++; }
  catch (error) { console.error('FAIL: ' + name + ' — ' + error.message); failed++; }
}

async function asyncTest(name, fn) {
  try { await fn(); console.log('PASS: ' + name); passed++; }
  catch (error) { console.error('FAIL: ' + name + ' — ' + error.message); failed++; }
}

const originalFetch = globalThis.fetch;

function mockYahooResponse({ timestamp = Math.floor((Date.now() - 20_000) / 1000), includeVolume = true } = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { chart: { result: [{
        meta: { symbol: 'AAPL', regularMarketPrice: 201.25, previousClose: 200, ...(includeVolume ? { regularMarketVolume: 1_500_000 } : {}) },
        timestamp: [timestamp],
        indicators: { quote: [{ open: [200.5], high: [202], low: [199.75], close: [201.25], ...(includeVolume ? { volume: [1_450_000] } : {}) }] },
      }] } };
    },
  };
}

try {
  test('exports explicit polling mode and Yahoo source', () => {
    assert.equal(LIVE_DATA_MODE, 'POLLING');
    assert.equal(LIVE_DATA_SOURCE, 'YAHOO_CHART');
  });

  test('cache starts empty after clear', () => {
    clearLiveMarketDataCache();
    assert.equal(getLiveMarketDataCacheStats().size, 0);
  });

  await asyncTest('normalizes a live snapshot without fabricating fields', async () => {
    clearLiveMarketDataCache();
    globalThis.fetch = async () => mockYahooResponse();
    const snapshot = await fetchLiveMarketSnapshot('AAPL', { ttlMs: 1000 });
    assert.equal(snapshot.symbol, 'AAPL');
    assert.equal(snapshot.price, 201.25);
    assert.equal(snapshot.previousClose, 200);
    assert.equal(snapshot.volume, 1_500_000);
    assert.equal(snapshot.candle.high, 202);
    assert.equal(snapshot.source, 'YAHOO_CHART');
    assert.equal(snapshot.mode, 'POLLING');
    assert.equal(snapshot.interval, '1m');
    assert.ok(snapshot.timestamp);
    assert.ok(snapshot.fetchedAt);
    assert.equal(typeof snapshot.freshness.ageMs, 'number');
    assert.equal(snapshot.disclaimer.includes('not a guaranteed real-time market feed'), true);
  });

  await asyncTest('preserves missing volume as unknown instead of zero', async () => {
    clearLiveMarketDataCache();
    globalThis.fetch = async () => mockYahooResponse({ includeVolume: false });
    const snapshot = await fetchLiveMarketSnapshot('AAPL');
    assert.equal(snapshot.volume, null);
  });

  await asyncTest('uses the cache within TTL', async () => {
    clearLiveMarketDataCache();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockYahooResponse(); };
    await fetchLiveMarketSnapshot('AAPL', { ttlMs: 10_000 });
    const second = await fetchLiveMarketSnapshot('AAPL', { ttlMs: 10_000 });
    assert.equal(calls, 1);
    assert.equal(second.cache.hit, true);
    assert.equal(getLiveMarketDataCacheStats().valid, 1);
  });

  await asyncTest('refreshes after TTL expiry', async () => {
    clearLiveMarketDataCache();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockYahooResponse(); };
    await fetchLiveMarketSnapshot('AAPL', { ttlMs: 0 });
    await fetchLiveMarketSnapshot('AAPL', { ttlMs: 0 });
    assert.equal(calls, 2);
  });

  await asyncTest('rejects invalid symbols before network access', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockYahooResponse(); };
    await assert.rejects(() => fetchLiveMarketSnapshot('bad symbol'), /رمز سهم غير صالح/);
    assert.equal(calls, 0);
  });

  await asyncTest('rejects excessively long symbols before network access', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return mockYahooResponse(); };
    await assert.rejects(() => fetchLiveMarketSnapshot('A'.repeat(13)), /رمز سهم غير صالح/);
    assert.equal(calls, 0);
  });

  await asyncTest('marks delayed data as stale using freshness threshold', async () => {
    clearLiveMarketDataCache();
    const oldTimestamp = Math.floor((Date.now() - 5 * 60_000) / 1000);
    globalThis.fetch = async () => mockYahooResponse({ timestamp: oldTimestamp });
    const snapshot = await fetchLiveMarketSnapshot('AAPL', { freshThresholdMs: 60_000 });
    assert.equal(snapshot.freshness.isFresh, false);
    assert.equal(snapshot.freshness.status, 'STALE');
  });

  await asyncTest('propagates provider HTTP errors', async () => {
    clearLiveMarketDataCache();
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(() => fetchLiveMarketSnapshot('AAPL'), /Yahoo Finance 429/);
  });

  await asyncTest('aborts requests after the configured timeout', async () => {
    clearLiveMarketDataCache();
    globalThis.fetch = (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    await assert.rejects(() => fetchLiveMarketSnapshot('AAPL', { timeoutMs: 1000 }), /Aborted/);
  });

  await asyncTest('does not cache failed provider responses', async () => {
    clearLiveMarketDataCache();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
    await assert.rejects(() => fetchLiveMarketSnapshot('AAPL'), /Yahoo Finance 503/);
    await assert.rejects(() => fetchLiveMarketSnapshot('AAPL'), /Yahoo Finance 503/);
    assert.equal(calls, 2);
    assert.equal(getLiveMarketDataCacheStats().size, 0);
  });
} finally {
  globalThis.fetch = originalFetch;
  clearLiveMarketDataCache();
}

console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
