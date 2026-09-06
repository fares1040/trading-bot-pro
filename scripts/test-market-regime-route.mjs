/**
 * Market Regime Route Observability Tests — P1-9
 *
 * Verifies that app/api/market-regime/route.js:
 *   - reuses the canonical fetchIndices from lib/market-engine.js
 *   - records source failures through failure-events
 *   - preserves fail-soft behavior (empty indices array on failure)
 *   - does NOT trip circuit for EMPTY_RESPONSE or MALFORMED_RESPONSE
 *   - preserves response contract (BULLISH/NEUTRAL/RISK_OFF/BEARISH/UNAVAILABLE)
 *
 * Run with: node scripts/test-market-regime-route.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { fetchIndices } from '../lib/market-engine.js';
import {
  shouldAllowProviderCall,
  recordProviderFailure,
  recordProviderSuccess,
  getCircuitBreaker,
  resetAll,
} from '../lib/circuit-breaker-manager.js';
import {
  record,
  ERROR_TYPES,
  PROVIDERS,
  classifyErrorType,
  clear,
  list,
} from '../lib/failure-events.js';
import {
  buildMarketRegime,
  defaultMarketRegime,
  REGIME_LABELS,
} from '../lib/market-regime-engine.js';

clear();
resetAll();

test('fetchIndices is exported from market-engine (canonical source)', () => {
  assert.strictEqual(typeof fetchIndices, 'function');
});

test('market-regime route no longer defines local fetchIndex', async () => {
  const routeContent = await import('fs').then(fs => fs.readFileSync(
    new URL('../app/api/market-regime/route.js', import.meta.url),
    'utf-8'
  ));

  assert.ok(!routeContent.includes('async function fetchIndex('),
    'Local fetchIndex should be removed — reuse fetchIndices from market-engine');
  assert.ok(!routeContent.includes('const INDEXES ='),
    'Local INDEXES array should be removed — reuse INDEX_SYMBOLS from market-engine');
  assert.ok(!routeContent.includes('YAHOO_HEADERS'),
    'Local YAHOO_HEADERS should be removed — reuse yahooHeaders from market-engine');
});

test('market-regime route imports fetchIndices from market-engine', async () => {
  const routeContent = await import('fs').then(fs => fs.readFileSync(
    new URL('../app/api/market-regime/route.js', import.meta.url),
    'utf-8'
  ));

  assert.ok(routeContent.includes("import { fetchIndices } from '@/lib/market-engine.js'"),
    'Route should import fetchIndices from market-engine');
});

test('circuit breaker check prevents Yahoo calls when OPEN', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) {
    recordProviderFailure('yahoo', new Error('HTTP 500'), '/api/market-regime', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');
  const result = shouldAllowProviderCall('yahoo');
  assert.strictEqual(result.allowed, false);
});

test('HTTP_FAILURE from index fetching trips circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 4; i++) {
    recordProviderFailure('yahoo', new Error('Yahoo Finance 500'), '/api/market-regime', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');

  recordProviderFailure('yahoo', new Error('Yahoo Finance 503'), '/api/market-regime', null, false);

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('TIMEOUT trips circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 5; i++) {
    recordProviderFailure('yahoo', new Error('The operation was timed out'), '/api/market-regime', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('RATE_LIMIT trips circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 5; i++) {
    recordProviderFailure('yahoo', new Error('HTTP 429 Too Many Requests'), '/api/market-regime', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('PROVIDER_UNAVAILABLE trips circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 5; i++) {
    recordProviderFailure('yahoo', new Error('fetch failed'), '/api/market-regime', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('EMPTY_RESPONSE does NOT trip circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    record({
      route: '/api/market-regime',
      provider: PROVIDERS.YAHOO,
      errorType: ERROR_TYPES.EMPTY_RESPONSE,
      message: 'Yahoo indices returned incomplete data',
      symbol: null,
      optional: false,
    });
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('MALFORMED_RESPONSE does NOT trip circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    record({
      route: '/api/market-regime',
      provider: PROVIDERS.YAHOO,
      errorType: ERROR_TYPES.MALFORMED_RESPONSE,
      message: 'Source returned non-JSON response',
      symbol: null,
      optional: false,
    });
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('fail-soft: empty indices returns UNAVAILABLE regime (not a crash)', () => {
  const regime = buildMarketRegime([], []);
  assert.strictEqual(regime.regime, REGIME_LABELS.UNAVAILABLE);
  assert.strictEqual(regime.regimeScore, null);
  assert.strictEqual(regime.confidence, 0);
});

test('fail-soft: partial index failure still computes regime from available data', () => {
  const partialIndices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4400, change: 0.4, isUp: true },
    { symbol: '^IXIC', name: 'NASDAQ', value: 13700, change: -0.2, isUp: false },
    { symbol: 'QQQ', name: 'QQQ', value: 372, change: 0.1, isUp: true },
  ];
  const universe = [
    { symbol: 'A', setupScore: 72, relativeVolume: 1.4 },
    { symbol: 'B', setupScore: 68, relativeVolume: 1.2 },
  ];

  const regime = buildMarketRegime(partialIndices, universe);

  assert.ok(regime.componentScores.trend != null, 'trend should have data');
  assert.ok(regime.componentScores.momentum != null, 'momentum should have data');
  assert.strictEqual(regime.componentScores.volatility, null, 'VIX missing - volatility excluded');
  assert.ok(regime.regime !== REGIME_LABELS.UNAVAILABLE, 'should classify with partial data');
  assert.ok(regime.limitations.some(l => l.includes('VIX unavailable')));
});

test('response contract preserved: all required fields present', () => {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4500, change: 1.8, isUp: true },
    { symbol: '^IXIC', name: 'NASDAQ', value: 14000, change: 2.4, isUp: true },
    { symbol: 'QQQ', name: 'QQQ', value: 380, change: 2.1, isUp: true },
    { symbol: '^VIX', name: 'VIX', value: 14.5, change: -1.2, isUp: false },
  ];
  const universe = [
    { symbol: 'A', setupScore: 72, relativeVolume: 1.4 },
  ];

  const regime = buildMarketRegime(indices, universe);

  const required = [
    'regime', 'regimeScore', 'confidence', 'confidenceLevel',
    'components', 'componentScores', 'rawWeights', 'componentWeights', 'totalWeightUsed',
    'reasons', 'warnings', 'risks', 'flags',
    'supportingEvidence',
    'dataAvailability', 'dataCompleteness',
    'provenance',
    'timestamp', 'freshness',
    'limitations', 'disclaimer',
  ];

  for (const field of required) {
    assert.ok(field in regime, 'Missing field: ' + field);
  }

  assert.strictEqual(typeof regime.timestamp, 'string');
  assert.ok(Object.values(REGIME_LABELS).includes(regime.regime));
});

test('BULLISH classification preserved with index data', () => {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4500, change: 1.8, isUp: true },
    { symbol: '^IXIC', name: 'NASDAQ', value: 14000, change: 2.4, isUp: true },
    { symbol: 'QQQ', name: 'QQQ', value: 380, change: 2.1, isUp: true },
    { symbol: '^VIX', name: 'VIX', value: 14.5, change: -1.2, isUp: false },
  ];
  const universe = [
    { symbol: 'A', setupScore: 72, relativeVolume: 1.4 },
    { symbol: 'B', setupScore: 68, relativeVolume: 1.2 },
  ];

  const regime = buildMarketRegime(indices, universe);
  assert.strictEqual(regime.regime, REGIME_LABELS.BULLISH);
});

test('NEUTRAL classification preserved with index data', () => {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4400, change: 0.4, isUp: true },
    { symbol: '^IXIC', name: 'NASDAQ', value: 13700, change: -0.2, isUp: false },
    { symbol: 'QQQ', name: 'QQQ', value: 372, change: 0.1, isUp: true },
    { symbol: '^VIX', name: 'VIX', value: 19.2, change: 0.3, isUp: true },
  ];
  const universe = [
    { symbol: 'A', setupScore: 52, relativeVolume: 1.0 },
  ];

  const regime = buildMarketRegime(indices, universe);
  assert.strictEqual(regime.regime, REGIME_LABELS.NEUTRAL);
});

test('RISK_OFF classification preserved with index data', () => {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4410, change: 0.5, isUp: true },
    { symbol: '^IXIC', name: 'NASDAQ', value: 13650, change: 0.1, isUp: true },
    { symbol: 'QQQ', name: 'QQQ', value: 371, change: 0.2, isUp: true },
    { symbol: '^VIX', name: 'VIX', value: 26.5, change: 10.4, isUp: true },
  ];
  const universe = [
    { symbol: 'A', setupScore: 52, relativeVolume: 1.0 },
  ];

  const regime = buildMarketRegime(indices, universe);
  assert.strictEqual(regime.regime, REGIME_LABELS.RISK_OFF);
});

test('BEARISH classification preserved with index data', () => {
  const indices = [
    { symbol: '^GSPC', name: 'S&P 500', value: 4300, change: -2.8, isUp: false },
    { symbol: '^IXIC', name: 'NASDAQ', value: 13200, change: -3.6, isUp: false },
    { symbol: 'QQQ', name: 'QQQ', value: 360, change: -3.2, isUp: false },
    { symbol: '^VIX', name: 'VIX', value: 26.4, change: 6.8, isUp: true },
  ];
  const universe = [
    { symbol: 'A', setupScore: 32, relativeVolume: 0.7 },
  ];

  const regime = buildMarketRegime(indices, universe);
  assert.strictEqual(regime.regime, REGIME_LABELS.BEARISH);
});

test('UNAVAILABLE when all data missing', () => {
  const regime = buildMarketRegime([], []);
  assert.strictEqual(regime.regime, REGIME_LABELS.UNAVAILABLE);
});

test('classifyErrorType classifies alert-center error messages', () => {
  assert.strictEqual(classifyErrorType('Yahoo Finance 500'), ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(classifyErrorType('Yahoo Finance 503 Service Unavailable'), ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(classifyErrorType('The operation was timed out'), ERROR_TYPES.TIMEOUT);
  assert.strictEqual(classifyErrorType('HTTP 429 Too Many Requests'), ERROR_TYPES.RATE_LIMIT);
  assert.strictEqual(classifyErrorType('fetch failed'), ERROR_TYPES.PROVIDER_UNAVAILABLE);
});

test('success resets failure count', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  recordProviderFailure('yahoo', new Error('HTTP 500'), '/api/market-regime', null, false);
  recordProviderFailure('yahoo', new Error('HTTP 503'), '/api/market-regime', null, false);
  assert.strictEqual(cb.getStatus().failureCount, 2);

  recordProviderSuccess('yahoo', '/api/market-regime', null);
  recordProviderSuccess('yahoo', '/api/market-regime', null);

  assert.strictEqual(cb.getStatus().failureCount, 0);
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
});

test('canonical fetchIndices used instead of local fetchIndex', async () => {
  const routeContent = await import('fs').then(fs => fs.readFileSync(
    new URL('../app/api/market-regime/route.js', import.meta.url),
    'utf-8'
  ));

  assert.ok(routeContent.includes("import { fetchIndices } from '@/lib/market-engine.js'"),
    'Route should import fetchIndices from market-engine');
  assert.ok(!routeContent.includes('async function fetchIndex('),
    'Local fetchIndex should be removed');
});

console.log('\n========================================');
console.log('Market Regime Route Tests — All Passed');
console.log('========================================');

clear();
resetAll();
