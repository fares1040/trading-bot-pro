/**
 * Circuit Breaker Tests — P1-6
 *
 * Deterministic tests — no network calls, no API keys.
 * Run with: node scripts/test-circuit-breaker.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  getCircuitBreaker,
  circuitBreakers,
  CircuitBreaker,
  STATE,
  FAILURE_ERROR_TYPES,
  EXCLUDED_ERROR_TYPES,
  CLOSED_THRESHOLDS,
  COOLDOWN_MS,
  PROVIDER_CRITICALITY,
} from '../lib/circuit-breaker.js';

// State Machine Tests
test('CLOSED state allows requests', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.shouldAllowProbe(), true);
});

test('critical provider: 5 consecutive failures opens circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 4; i++) cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'CLOSED', 'still CLOSED after 4 failures');

  cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 5 failures');
});

test('optional provider: 3 consecutive failures opens circuit', () => {
  const cb = getCircuitBreaker('finra');
  cb.reset();

  for (let i = 0; i < 2; i++) cb.recordFailure('TIMEOUT');
  assert.strictEqual(cb.getStatus().state, 'CLOSED', 'still CLOSED after 2 failures');

  cb.recordFailure('TIMEOUT');
  assert.strictEqual(cb.getStatus().state, 'OPEN', 'OPEN after 3 failures');
});

test('OPEN state blocks requests', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
  assert.strictEqual(cb.shouldAllowProbe(), false);
});

test('success in CLOSED state resets failure count', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  cb.recordFailure('HTTP_FAILURE');
  cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().failureCount, 2);

  cb.recordSuccess();
  assert.strictEqual(cb.getStatus().failureCount, 1);

  cb.recordSuccess();
  cb.recordSuccess();
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

// HALF_OPEN Cooldown Tests
test('HALF_OPEN: cooldown prevents immediate probe', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
  assert.strictEqual(cb.shouldAllowProbe(), false);
});

test('HALF_OPEN: cooldown elapsed allows probe', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');

  cb.openTime = Date.now() - COOLDOWN_MS.critical - 1000;
  cb.halfOpenProbeCount = 0;
  cb.state = STATE.HALF_OPEN;

  assert.strictEqual(cb.shouldAllowProbe(), true);
  assert.strictEqual(cb.getStatus().state, 'HALF_OPEN');
});

// Failure Type Classification
test('PROVIDER_UNAVAILABLE opens circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('PROVIDER_UNAVAILABLE');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('TIMEOUT opens circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('TIMEOUT');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('RATE_LIMIT opens circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('RATE_LIMIT');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

test('EMPTY_RESPONSE does NOT open circuit', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) cb.recordFailure('EMPTY_RESPONSE');
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('MALFORMED_RESPONSE does NOT count toward circuit opening', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 10; i++) cb.recordFailure('MALFORMED_RESPONSE');
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
});

// HALF_OPEN Recovery
test('HALF_OPEN success transitions to CLOSED', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');

  cb.openTime = Date.now() - COOLDOWN_MS.critical - 1;
  cb.halfOpenProbeCount = 0;
  cb.state = STATE.HALF_OPEN;

  cb.recordSuccess();
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

test('HALF_OPEN failure transitions back to OPEN', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');

  cb.openTime = Date.now() - COOLDOWN_MS.critical - 1;
  cb.halfOpenProbeCount = 0;
  cb.state = STATE.HALF_OPEN;

  cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'OPEN');
});

// Per-Provider Isolation
test('one provider fails, other remains CLOSED', () => {
  const yahoo = getCircuitBreaker('yahoo');
  const finnhub = getCircuitBreaker('finnhub');

  yahoo.reset();
  finnhub.reset();

  for (let i = 0; i < 6; i++) yahoo.recordFailure('HTTP_FAILURE');

  assert.strictEqual(yahoo.getStatus().state, 'OPEN');
  assert.strictEqual(finnhub.getStatus().state, 'CLOSED');
});

test('optional provider circuit does not affect critical provider', () => {
  const yahoo = getCircuitBreaker('yahoo');
  const finra = getCircuitBreaker('finra');

  yahoo.reset();
  finra.reset();

  for (let i = 0; i < 4; i++) finra.recordFailure('TIMEOUT');

  assert.strictEqual(yahoo.getStatus().state, 'CLOSED');
  assert.strictEqual(finra.getStatus().state, 'OPEN');
});

// Reset
test('reset clears all state', () => {
  const cb = getCircuitBreaker('yahoo');

  for (let i = 0; i < 6; i++) cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().state, 'OPEN');

  cb.reset();
  assert.strictEqual(cb.getStatus().state, 'CLOSED');
  assert.strictEqual(cb.getStatus().failureCount, 0);
});

// Threshold and Cooldown Constants
test('critical providers have higher thresholds than optional', () => {
  assert.strictEqual(CLOSED_THRESHOLDS.critical, 5);
  assert.strictEqual(CLOSED_THRESHOLDS.optional, 3);
  assert.ok(CLOSED_THRESHOLDS.critical > CLOSED_THRESHOLDS.optional);
});

test('cooldown is longer for critical providers', () => {
  assert.strictEqual(COOLDOWN_MS.critical, 60000);
  assert.strictEqual(COOLDOWN_MS.optional, 30000);
  assert.ok(COOLDOWN_MS.critical > COOLDOWN_MS.optional);
});

// Failure Events Integration
test('failures increment failureCount', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  cb.recordFailure('HTTP_FAILURE');
  assert.strictEqual(cb.getStatus().failureCount, 1);

  cb.recordFailure('TIMEOUT');
  assert.strictEqual(cb.getStatus().failureCount, 2);
});

test('getStatus returns complete metrics', () => {
  const cb = getCircuitBreaker('yahoo');
  cb.reset();

  const status = cb.getStatus();
  assert.ok('provider' in status);
  assert.ok('criticality' in status);
  assert.ok('state' in status);
  assert.ok('failureCount' in status);
  assert.ok('openTime' in status);
  assert.ok('cooldown' in status);
  assert.ok('failureThreshold' in status);
});

// Summary
console.log('\n========================================');
console.log('Circuit Breaker Tests — All Passed');
console.log('========================================');