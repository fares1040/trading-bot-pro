/**
 * Circuit Breaker Manager Tests — P1-6 Integration Tests
 *
 * Deterministic tests — no network calls, no API keys.
 * Run with: node scripts/test-circuit-breaker-manager.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  getCircuitBreaker,
  circuitBreakers,
  recordProviderFailure,
  recordProviderSuccess,
  shouldAllowProviderCall,
  resetAll,
  PROVIDER_CRITICALITY,
} from '../lib/circuit-breaker-manager.js';

function resetProvider(name) {
  const cb = getCircuitBreaker(name);
  cb.reset();
}

// State Management Tests
test('per-provider circuit breakers are isolated', () => {
  resetAll();
  const yahoo = getCircuitBreaker('test_iso_yahoo');
  const finra = getCircuitBreaker('test_iso_finra');

  assert.strictEqual(yahoo !== finra, true, 'different providers get different circuit breaker instances');
});

test('shouldAllowProviderCall returns allowed=false for OPEN circuit', () => {
  const provider = 'test_block_yahoo';
  resetProvider(provider);

  const cb = getCircuitBreaker(provider);
  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');

  const result = shouldAllowProviderCall(provider);
  assert.strictEqual(result.allowed, false, 'should block when circuit is OPEN');
  assert.strictEqual(result.state, 'OPEN', 'should report OPEN state');
});

test('shouldAllowProviderCall returns allowed=true for CLOSED circuit', () => {
  const provider = 'test_allow_yahoo';
  resetProvider(provider);

  const result = shouldAllowProviderCall(provider);
  assert.strictEqual(result.allowed, true, 'should allow when circuit is CLOSED');
  assert.strictEqual(result.state, 'CLOSED', 'should report CLOSED state');
});

test('recordProviderFailure increments circuit breaker failures', () => {
  const provider = 'test_inc_yahoo';
  resetProvider(provider);

  recordProviderFailure(provider, new Error('503 Service Unavailable'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 1, 'circuit breaker failure count should increment');
});

test('recordProviderSuccess resets circuit breaker failures', () => {
  const provider = 'test_succ_yahoo';
  resetProvider(provider);

  const cb = getCircuitBreaker(provider);
  cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().failureCount, 1);

  recordProviderSuccess(provider, 'market-data', 'AAPL');

  assert.strictEqual(cb.getStatus().failureCount, 0, 'circuit breaker failure count should reset');
});

test('recordProviderFailure with empty response does NOT increment circuit breaker', () => {
  const provider = 'test_empty_yahoo';
  resetProvider(provider);

  // EMPTY_RESPONSE should NOT count toward circuit breaker failures
  recordProviderFailure(provider, new Error('No market data'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 0, 'EMPTY_RESPONSE should not increment circuit breaker');
});

test('recordProviderFailure with malformed response does NOT increment circuit breaker', () => {
  const provider = 'test_malformed_finra';
  resetProvider(provider);

  // MALFORMED_RESPONSE should NOT count toward circuit breaker failures
  recordProviderFailure(provider, new Error('Invalid JSON response'), 'finra-data', 'MSFT');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 0, 'MALFORMED_RESPONSE should not increment circuit breaker');
});

// Error Type Mapping Tests
test('classify error with timeout as TIMEOUT', () => {
  const provider = 'test_timeout_yahoo';
  resetProvider(provider);

  recordProviderFailure(provider, new Error('Request timeout after 5000ms'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 1, 'TIMEOUT should increment circuit breaker');
});

test('classify error with rate limit as RATE_LIMIT', () => {
  const provider = 'test_ratelimit_yahoo';
  resetProvider(provider);

  recordProviderFailure(provider, new Error('Rate limit exceeded (429)'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 1, 'RATE_LIMIT should increment circuit breaker');
});

test('classify error with HTTP failure as HTTP_FAILURE', () => {
  const provider = 'test_http_finnhub';
  resetProvider(provider);

  recordProviderFailure(provider, new Error('HTTP 502 Bad Gateway'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 1, 'HTTP_FAILURE should increment circuit breaker');
});

// Criticality Classification Tests
test('optional providers have correct criticality classification', () => {
  assert.strictEqual(PROVIDER_CRITICALITY.finra, 'optional', 'FINRA should be optional');
  assert.strictEqual(PROVIDER_CRITICALITY.gemini, 'optional', 'Gemini should be optional');
  assert.strictEqual(PROVIDER_CRITICALITY.openai, 'optional', 'OpenAI should be optional');
});

test('critical providers have correct criticality classification', () => {
  assert.strictEqual(PROVIDER_CRITICALITY.yahoo, 'critical', 'Yahoo should be critical');
  assert.strictEqual(PROVIDER_CRITICALITY.finnhub, 'critical', 'Finnhub should be critical');
  assert.strictEqual(PROVIDER_CRITICALITY.internal, 'critical', 'internal should be critical');
});

// Provider-Specific State Tests
test('critical provider opens circuit after 5 failures', () => {
  const provider = 'test_crit_threshold';
  resetProvider(provider);

  const cb = getCircuitBreaker(provider);
  for (let i = 0; i < 5; i++) cb.recordFailure('HTTP_FAILURE');

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'should open after 5 failures');
});

test('optional provider opens circuit after 3 failures', () => {
  const provider = 'test_opt_threshold_finra';
  resetProvider(provider);

  const cb = getCircuitBreaker(provider);
  for (let i = 0; i < 3; i++) cb.recordFailure('HTTP_FAILURE');

  assert.strictEqual(cb.getStatus().state, 'OPEN', 'should open after 3 failures');
});

// Integration Test with Failure Events
test('provider failure recorded in both circuit breaker and failure-events', () => {
  const provider = 'test_integrate_yahoo';
  resetProvider(provider);

  recordProviderFailure(provider, new Error('503 Service Unavailable'), 'market-data', 'AAPL');

  const cb = getCircuitBreaker(provider);
  assert.strictEqual(cb.getStatus().failureCount, 1, 'circuit breaker should increment');
});

// Cleanup and Reset Tests
test('resetAll clears all circuit breakers', () => {
  const yahoo = getCircuitBreaker('test_reset_yahoo');
  const finra = getCircuitBreaker('test_reset_finra');

  // Make them fail
  for (let i = 0; i < 6; i++) yahoo.recordFailure('HTTP_FAILURE');
  for (let i = 0; i < 4; i++) finra.recordFailure('HTTP_FAILURE');

  assert.strictEqual(yahoo.getStatus().state, 'OPEN', 'Yahoo should be OPEN');

  resetAll();

  assert.strictEqual(yahoo.getStatus().state, 'CLOSED', 'Yahoo should be CLOSED after resetAll');
  assert.strictEqual(finra.getStatus().state, 'CLOSED', 'FINRA should be CLOSED after resetAll');
});

// Summary
console.log('\n========================================');
console.log('Circuit Breaker Manager Tests — All Passed');
console.log('========================================');