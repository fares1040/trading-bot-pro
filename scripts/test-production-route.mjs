/**
 * Production Route Probe Tests
 *
 * Verifies that production readiness probes bypass shared circuit breakers
 * and measure actual endpoint health.
 *
 * Run with: node scripts/test-production-route.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { getCircuitBreaker, resetAll } from '../lib/circuit-breaker-manager.js';
import { clear, list } from '../lib/failure-events.js';
import { probe, TIMEOUT_MS } from '../lib/production-probe.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let originalFetch;

function resetState() {
  resetAll();
  clear();
  if (originalFetch) {
    global.fetch = originalFetch;
  }
}

function mockFetch(responseMap) {
  originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const key = url;
    const response = responseMap[key];
    if (response) {
      if (options.signal) {
        if (options.signal.aborted) {
          throw new Error('The user aborted a request.');
        }
        // Race the response against the abort signal
        return new Promise((resolve, reject) => {
          const onAbort = () => {
            options.signal.removeEventListener('abort', onAbort);
            reject(new Error('The user aborted a request.'));
          };
          options.signal.addEventListener('abort', onAbort, { once: true });
          Promise.resolve(response).then(
            (res) => {
              options.signal.removeEventListener('abort', onAbort);
              resolve(res);
            },
            (err) => {
              options.signal.removeEventListener('abort', onAbort);
              reject(err);
            }
          );
        });
      }
      return response;
    }
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'No mock configured' }),
    };
  };
}

function makeFetchResponse({ ok = true, status = 200, jsonBody = { success: true } } = {}) {
  return {
    ok,
    status,
    json: async () => jsonBody,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('OPEN shared circuit does NOT prevent production readiness from probing endpoint (bypass=true)', async () => {
  resetState();

  const provider = 'test_prod_bypass_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  const fetchResponse = makeFetchResponse({ ok: true, status: 200 });
  mockFetch({
    'https://example.com/api/health': fetchResponse,
  });

  const result = await probe('https://example.com/api/health', 'production.health', provider, null, true);

  assert.strictEqual(result.bypassed, true, 'probe should indicate it was bypassed');
  assert.strictEqual(result.circuitBlocked, false, 'probe should not be circuit-blocked');
  assert.strictEqual(result.ok, true, 'probe should succeed when endpoint is healthy');
  assert.strictEqual(result.status, 200, 'HTTP status should be reported');
});

test('healthy endpoint produces ready result even if shared circuit was previously OPEN', async () => {
  resetState();

  const provider = 'test_prod_ready_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  const fetchResponse = makeFetchResponse({ ok: true, status: 200, jsonBody: { success: true } });
  mockFetch({
    'https://example.com/api/indices': fetchResponse,
  });

  const result = await probe('https://example.com/api/indices', 'production.indices', provider, null, true);

  assert.strictEqual(result.ok, true, 'probe should succeed despite OPEN circuit');
  assert.strictEqual(result.circuitBlocked, false, 'should not report circuitBlocked');
});

test('genuinely failing endpoint produces needs-attention result with actual failure', async () => {
  resetState();

  const provider = 'test_prod_fail_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  const fetchResponse = makeFetchResponse({ ok: false, status: 503, jsonBody: { error: 'Service Unavailable' } });
  mockFetch({
    'https://example.com/api/stocks?symbol=SOFI': fetchResponse,
  });

  const result = await probe('https://example.com/api/stocks?symbol=SOFI', 'production.stocks', provider, 'SOFI', true);

  assert.strictEqual(result.ok, false, 'probe should report failure');
  assert.strictEqual(result.status, 503, 'HTTP status should be actual failure code');
  assert.strictEqual(result.circuitBlocked, false, 'should not be blocked by circuit breaker');
  assert.ok(result.error.includes('503') || result.error.includes('Service Unavailable'), 'error should describe actual failure');
});

test('timeout behavior remains correct during readiness probe', async () => {
  resetState();

  const provider = 'test_prod_timeout_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  mockFetch({
    'https://example.com/api/health': new Promise((resolve) => {
      setTimeout(() => resolve(makeFetchResponse({ ok: true, status: 200 })), 20000);
    }),
  });

  const result = await probe('https://example.com/api/health', 'production.health', provider, null, true);

  assert.strictEqual(result.ok, false, 'probe should report timeout as failure');
  assert.ok(result.error.includes('timeout') || result.error.includes('aborted') || result.error.includes('failed'), 'error should indicate timeout/failure');
  assert.strictEqual(result.circuitBlocked, false, 'should not be circuit-blocked');
}, true);

test('failure events remain recorded correctly for readiness probes', async () => {
  resetState();

  const provider = 'test_prod_events_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  const fetchResponse = makeFetchResponse({ ok: false, status: 500, jsonBody: { error: 'Internal Server Error' } });
  mockFetch({
    'https://example.com/api/health': fetchResponse,
  });

  await probe('https://example.com/api/health', 'production.health', provider, null, true);

  const events = list();
  const failureEvent = events.find(e => e.route === 'production.health' && e.provider === provider);
  assert.ok(failureEvent, 'failure event should be recorded');
  assert.strictEqual(failureEvent.errorType, 'HTTP_FAILURE', 'error type should be HTTP_FAILURE');
  assert.ok(failureEvent.message.includes('500'), 'message should include HTTP status');
});

test('normal application traffic continues to respect the circuit breaker (bypass=false)', async () => {
  resetState();

  const provider = 'test_prod_app_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  const fetchResponse = makeFetchResponse({ ok: true, status: 200 });
  mockFetch({
    'https://example.com/api/market-data': fetchResponse,
  });

  const result = await probe('https://example.com/api/market-data', 'market-data', provider, 'AAPL', false);

  assert.strictEqual(result.circuitBlocked, true, 'normal traffic should be blocked by OPEN circuit');
  assert.strictEqual(result.bypassed, false, 'normal traffic should not be bypassed');
  assert.strictEqual(result.ok, false, 'normal traffic should fail fast');
  assert.ok(result.error.includes('Circuit breaker OPEN'), 'error should mention circuit breaker');
});

test('circuit blocker result distinguishes from endpoint failure', async () => {
  resetState();

  const provider = 'test_prod_distinct_yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState('OPEN');

  mockFetch({
    'https://example.com/api/health': makeFetchResponse({ ok: false, status: 503 }),
  });

  const blockedResult = await probe('https://example.com/api/health', 'production.health', provider, null, false);
  const failedResult = await probe('https://example.com/api/health', 'production.health', provider, null, true);

  assert.strictEqual(blockedResult.circuitBlocked, true, 'blocked result should have circuitBlocked=true');
  assert.strictEqual(blockedResult.bypassed, false, 'blocked result should have bypassed=false');
  assert.strictEqual(blockedResult.status, null, 'blocked result should have no HTTP status');

  assert.strictEqual(failedResult.circuitBlocked, false, 'failed result should have circuitBlocked=false');
  assert.strictEqual(failedResult.bypassed, true, 'failed result should have bypassed=true');
  assert.strictEqual(failedResult.status, 503, 'failed result should have actual HTTP status');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('Production Route Probe Tests');
console.log('========================================');
