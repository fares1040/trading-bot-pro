/**
 * Stocks API Circuit Breaker Integration Tests — P1-8
 *
 * Verifies that app/api/stocks/route.js integrates with the circuit-breaker
 * architecture correctly. Tests the fetchChart function's circuit breaker
 * behavior without making real network calls.
 *
 * Run with: node scripts/test-stocks-circuit-breaker.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  shouldAllowProviderCall,
  recordProviderFailure,
  recordProviderSuccess,
  resetAll,
} from '../lib/circuit-breaker-manager.js';
import {
  ERROR_TYPES,
  PROVIDERS,
  classifyErrorType,
} from '../lib/failure-events.js';
import { getCircuitBreaker } from '../lib/circuit-breaker-manager.js';

resetAll();

test('yahoo circuit starts CLOSED and allows provider calls', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();
  assert.strictEqual(cb.getStatus().state, 'CLOSED');

  const result = shouldAllowProviderCall('yahoo');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.state, 'CLOSED');
});

test('HTTP_FAILURE in stocks fetchChart counts toward circuit opening', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 4; i++) {
    recordProviderFailure('yahoo', new Error('HTTP 500 Server Error'), '/api/stocks.chart', 'AAPL', false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED', 'still CLOSED after 4 HTTP_FAILUREs');

  recordProviderFailure('yahoo', new Error('HTTP 503 Service Unavailable'), '/api/stocks.chart', 'AAPL', false);

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 5 HTTP_FAILUREs from stocks route');
});

test('EMPTY_RESPONSE does NOT trip the circuit breaker in stocks route', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    recordProviderFailure('yahoo', new Error('No market data in Yahoo response for TEST'), '/api/stocks.chart', 'TEST', false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('MALFORMED_RESPONSE does NOT trip the circuit breaker in stocks route', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    recordProviderFailure('yahoo', new Error('Malformed JSON response for TEST'), '/api/stocks.chart', 'TEST', false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('RATE_LIMIT trips the circuit breaker in stocks route', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 4; i++) {
    recordProviderFailure('yahoo', new Error('429 Too Many Requests'), '/api/stocks.chart', 'AAPL', false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED', 'still CLOSED after 4 RATE_LIMIT errors');

  recordProviderFailure('yahoo', new Error('429 Too Many Requests'), '/api/stocks.chart', 'AAPL', false);

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 5 RATE_LIMIT errors from stocks route');
});

test('TIMEOUT trips the circuit breaker in stocks route', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 5; i++) {
    recordProviderFailure('yahoo', new Error('Request timeout'), '/api/stocks.chart', 'AAPL', false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 5 TIMEOUT errors from stocks route');
});

test('network error (PROVIDER_UNAVAILABLE) trips the circuit breaker', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 5; i++) {
    recordProviderFailure('yahoo', new Error('fetch failed'), '/api/stocks.chart', 'AAPL', false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 5 network errors from stocks route');
});

test('OPEN circuit fast-fails before making Yahoo calls', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) {
    recordProviderFailure('yahoo', new Error('HTTP 500'), '/api/stocks.chart', 'AAPL', false);
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');

  const result = shouldAllowProviderCall('yahoo');
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.state, 'OPEN');
});

test('success resets failure count in stocks route', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  recordProviderFailure('yahoo', new Error('HTTP 500'), '/api/stocks.chart', 'AAPL', false);
  recordProviderFailure('yahoo', new Error('HTTP 503'), '/api/stocks.chart', 'AAPL', false);

  assert.strictEqual(cb.getStatus().failureCount, 2);

  recordProviderSuccess('yahoo', '/api/stocks.chart', 'AAPL');
  recordProviderSuccess('yahoo', '/api/stocks.chart', 'AAPL');

  assert.strictEqual(cb.getStatus().failureCount, 0);
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
});

test('EMPTY_RESPONSE in trending fetch does NOT trip circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    recordProviderFailure('yahoo', new Error('Yahoo trending returned no quotes'), '/api/stocks.trending', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('MALFORMED_RESPONSE in trending fetch does NOT trip circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    recordProviderFailure('yahoo', new Error('Malformed JSON in Yahoo trending response'), '/api/stocks.trending', null, false);
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('stocks route error record uses correct provider and route labels', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  recordProviderFailure('yahoo', new Error('HTTP 503'), '/api/stocks.chart', 'SOFI', false);

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 1);

  recordProviderSuccess('yahoo', '/api/stocks.chart', 'SOFI');

  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('classifyErrorType maps stocks errors correctly', () => {
  assert.strictEqual(classifyErrorType('Yahoo Finance 500 for AAPL'), ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(classifyErrorType('Yahoo Finance 503 Service Unavailable'), ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(classifyErrorType('fetch failed'), ERROR_TYPES.PROVIDER_UNAVAILABLE);
  assert.strictEqual(classifyErrorType('Request timeout'), ERROR_TYPES.TIMEOUT);
  assert.strictEqual(classifyErrorType('HTTP 429 Too Many Requests'), ERROR_TYPES.RATE_LIMIT);
  assert.strictEqual(classifyErrorType('No market data for AAPL'), ERROR_TYPES.EMPTY_RESPONSE);
  assert.strictEqual(classifyErrorType('Malformed JSON response for AAPL'), ERROR_TYPES.MALFORMED_RESPONSE);
});

console.log('\n========================================');
console.log('Stocks Circuit Breaker Integration Tests — All Passed');
console.log('========================================');

resetAll();
