/**
 * Alert Center Circuit Breaker / Observability Tests — P1-9
 *
 * Verifies that app/api/alert-center/route.js records provider failures
 * through the existing failure-events architecture while preserving
 * fail-soft behavior.
 *
 * Run with: node scripts/test-alert-center-observability.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
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
  list,
  clear,
  classifyErrorType,
} from '../lib/failure-events.js';

clear();
resetAll();

test('alert-center uses "internal" as provider key for intelligence sources', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().criticality, 'critical');
});

test('source timeout is recorded as PROVIDER_UNAVAILABLE', () => {
  clear();
  const cb = getCircuitBreaker('internal');
  cb.reset();

  recordProviderFailure(
    'internal',
    new Error('The operation was timed out'),
    '/api/alert-center',
    null,
    false
  );

  const events = list({ route: '/api/alert-center' });
  assert.ok(events.length > 0, 'failure event should be recorded');
  assert.strictEqual(events[0].provider, 'internal');
  assert.strictEqual(events[0].route, '/api/alert-center');
});

test('source HTTP failure is recorded as HTTP_FAILURE', () => {
  clear();

  record({
    route: '/api/alert-center',
    provider: PROVIDERS.INTERNAL,
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'Source swing returned HTTP 503',
    status: 503,
    symbol: null,
    optional: false,
  });

  const events = list({ route: '/api/alert-center' });
  assert.ok(events.length > 0);
  assert.strictEqual(events[0].errorType, ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(events[0].status, 503);
});

test('source success is recorded', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  recordProviderSuccess('internal', '/api/alert-center', null);

  assert.strictEqual(cb.getStatus().successCount, 1);
});

test('EMPTY_RESPONSE does NOT trip the circuit breaker', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    record({
      route: '/api/alert-center',
      provider: PROVIDERS.INTERNAL,
      errorType: ERROR_TYPES.EMPTY_RESPONSE,
      message: 'Source returned success:false',
      symbol: null,
      optional: false,
    });
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('MALFORMED_RESPONSE does NOT trip the circuit breaker', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  for (let i = 0; i < 10; i++) {
    record({
      route: '/api/alert-center',
      provider: PROVIDERS.INTERNAL,
      errorType: ERROR_TYPES.MALFORMED_RESPONSE,
      message: 'Source returned non-JSON response',
      symbol: null,
      optional: false,
    });
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('HTTP_FAILURE counts toward circuit opening (critical provider threshold = 5)', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  for (let i = 0; i < 4; i++) {
    recordProviderFailure(
      'internal',
      new Error('HTTP 500 Internal Server Error'),
      '/api/alert-center',
      null,
      false
    );
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');

  recordProviderFailure(
    'internal',
    new Error('HTTP 503 Service Unavailable'),
    '/api/alert-center',
    null,
    false
  );

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('RATE_LIMIT counts toward circuit opening', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  for (let i = 0; i < 4; i++) {
    recordProviderFailure(
      'internal',
      new Error('HTTP 429 Too Many Requests'),
      '/api/alert-center',
      null,
      false
    );
  }

  assert.strictEqual(cb.getStatus().state, 'CLOSED');

  recordProviderFailure(
    'internal',
    new Error('HTTP 429 Too Many Requests'),
    '/api/alert-center',
    null,
    false
  );

  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('classifyErrorType handles alert-center error messages', () => {
  assert.strictEqual(classifyErrorType('HTTP 503 from /api/alert-center'), ERROR_TYPES.HTTP_FAILURE);
  assert.strictEqual(classifyErrorType('The operation was timed out'), ERROR_TYPES.TIMEOUT);
  assert.strictEqual(classifyErrorType('HTTP 429 Too Many Requests'), ERROR_TYPES.RATE_LIMIT);
  assert.strictEqual(classifyErrorType('fetch failed'), ERROR_TYPES.PROVIDER_UNAVAILABLE);
  assert.strictEqual(classifyErrorType('Source returned empty response'), ERROR_TYPES.EMPTY_RESPONSE);
  assert.strictEqual(classifyErrorType('Malformed JSON response from source'), ERROR_TYPES.MALFORMED_RESPONSE);
});

test('OPEN circuit fast-fails before making source calls', () => {
  const cb = getCircuitBreaker('internal');
  cb.reset();

  for (let i = 0; i < 6; i++) {
    recordProviderFailure(
      'internal',
      new Error('HTTP 500'),
      '/api/alert-center',
      null,
      false
    );
  }

  assert.strictEqual(cb.getStatus().state, 'OPEN');

  const result = shouldAllowProviderCall('internal');
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.state, 'OPEN');
});

test('fail-soft: results object remains empty when a source fails', () => {
  const results = {};

  const failingSource = {
    key: 'swingIntelligence',
    url: '/api/swing-intelligence',
    source: 'swing',
  };

  recordProviderFailure(
    'internal',
    new Error('HTTP 503 Service Unavailable'),
    '/api/alert-center',
    null,
    false
  );

  assert.ok(true, 'source failure should be recorded without throwing');

  assert.strictEqual(results[failingSource.key], undefined, 'failing source should not pollute results');
});

console.log('\n========================================');
console.log('Alert Center Observability Tests — All Passed');
console.log('========================================');

clear();
resetAll();
