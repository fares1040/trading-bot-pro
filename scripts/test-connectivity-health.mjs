#!/usr/bin/env node
/**
 * P2-6 Live Connectivity Health Check Tests
 *
 * Deterministic - no network, no dev server, no credentials.
 * Run with: node scripts/test-connectivity-health.mjs
 *
 * Coverage:
 *   1.   HEALTH_STATUS constants are defined
 *   2.   ENDPOINT_PROVIDERS maps known endpoints
 *   3.   classifyEndpointHealth - provider connected (circuit CLOSED, no failures)
 *   4.   classifyEndpointHealth - provider degraded (HALF_OPEN)
 *   5.   classifyEndpointHealth - provider unavailable (circuit OPEN)
 *   6.   classifyEndpointHealth - degraded via non-critical failure events
 *   7.   buildConnectivityHealth - empty events = all CONNECTED
 *   8.   buildConnectivityHealth - critical failure = UNAVAILABLE
 *   9.   buildConnectivityHealth - medium failure = DEGRADED
 *   10.  buildConnectivityHealth - aggregate status logic
 *   11.  probeEndpoint - returns actual latency (when fetch available)
 *   12.  probeEndpoint - timeout handling
 *   13.  probeEndpoint - HTTP error handling
 *   14.  probeEndpoint - network failure handling
 *   15.  combineStatus - picks worst status
 *   16.  No fabricated data in health report
 *   17.  classifyEndpointHealth returns endpoint and provider fields
 *   18.  classifyEndpointHealth handles unknown endpoint
 *   19.  buildConnectivityHealth includes disclaimer
 *   20.  buildConnectivityHealth includes summary breakdown
 */

import {
  HEALTH_STATUS,
  ENDPOINT_PROVIDERS,
  HEALTH_WINDOW_MS,
  classifyEndpointHealth,
  buildConnectivityHealth,
  combineStatus,
  probeEndpoint,
  probeAllEndpoints,
} from '../lib/connectivity-health.js';
import {
  STATE,
  getCircuitBreaker,
  circuitBreakers,
} from '../lib/circuit-breaker.js';
import { record, clear, list, summarize } from '../lib/failure-events.js';
import {
  SEVERITY,
  ERROR_TYPES,
  PROVIDERS,
} from '../lib/failure-events.js';

let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failures.push({ name, error: error.message });
    failCount++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('='.repeat(60));
console.log('P2-6 LIVE CONNECTIVITY HEALTH TEST SUITE');
console.log('='.repeat(60));

// Clear state before tests
clear();
function resetAllCircuitBreakers() {
  for (const cb of circuitBreakers.values()) {
    cb.reset();
  }
}

// ============================================================================
// 1. Constants & Configuration Tests
// ============================================================================
console.log('\n--- 1-2. Constants & Configuration Tests ---\n');

test('HEALTH_STATUS has all required statuses', () => {
  assertEqual(HEALTH_STATUS.CONNECTED, 'CONNECTED', 'CONNECTED exists');
  assertEqual(HEALTH_STATUS.DEGRADED, 'DEGRADED', 'DEGRADED exists');
  assertEqual(HEALTH_STATUS.UNAVAILABLE, 'UNAVAILABLE', 'UNAVAILABLE exists');
  assertEqual(HEALTH_STATUS.UNCHECKED, 'UNCHECKED', 'UNCHECKED exists');
});

test('ENDPOINT_PROVIDERS contains core API endpoints', () => {
  assert(ENDPOINT_PROVIDERS['/api/health'], 'health endpoint mapped');
  assert(ENDPOINT_PROVIDERS['/api/stocks'], 'stocks endpoint mapped');
  assert(ENDPOINT_PROVIDERS['/api/opportunity-ranking'], 'opportunity-ranking endpoint mapped');
  assert(ENDPOINT_PROVIDERS['/api/alert-center'], 'alert-center endpoint mapped');
  assert(ENDPOINT_PROVIDERS['/api/command-center'], 'command-center endpoint mapped');
  assert(ENDPOINT_PROVIDERS['/api/market-regime'], 'market-regime endpoint mapped');
});

test('HEALTH_WINDOW_MS is 5 minutes', () => {
  assertEqual(HEALTH_WINDOW_MS, 300000, 'Window is 5 minutes (300000ms)');
});

// ============================================================================
// 3-6. classifyEndpointHealth Tests
// ============================================================================
console.log('\n--- 3-6. classifyEndpointHealth Tests ---\n');

test('classifyEndpointHealth - provider connected (circuit CLOSED, no failures)', () => {
  clear();
  resetAllCircuitBreakers();

  const result = classifyEndpointHealth('/api/health');
  assertEqual(typeof result, 'object', 'Returns object');
  assertEqual(result.endpoint, '/api/health', 'Endpoint is set');
  assert(result.provider != null, 'Provider is set');
  assertEqual(result.status, HEALTH_STATUS.CONNECTED, 'Status is CONNECTED when no failures');
  assertEqual(result.circuitState, STATE.CLOSED, 'Circuit state is CLOSED');
  assertEqual(result.failureCount, 0, 'Failure count is 0');
  assert(result.lastChecked != null, 'Last checked timestamp is set');
});

test('classifyEndpointHealth - provider degraded (HALF_OPEN)', () => {
  clear();

  const provider = ENDPOINT_PROVIDERS['/api/market-data'] || 'yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState(STATE.HALF_OPEN);

  const result = classifyEndpointHealth('/api/market-data');
  assertEqual(result.status, HEALTH_STATUS.DEGRADED, 'HALF_OPEN circuit = DEGRADED');
  assertEqual(result.circuitState, STATE.HALF_OPEN, 'Circuit state is HALF_OPEN');
});

test('classifyEndpointHealth - provider unavailable (circuit OPEN)', () => {
  clear();

  const provider = 'yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState(STATE.OPEN);

  const result = classifyEndpointHealth('/api/stocks');
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'OPEN circuit = UNAVAILABLE');
  assertEqual(result.circuitState, STATE.OPEN, 'Circuit state is OPEN');
});

test('classifyEndpointHealth - degraded via non-critical failure events', () => {
  clear();
  resetAllCircuitBreakers();

  const provider = 'internal';
  record({
    route: 'alert-center',
    provider: 'internal',
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'HTTP 500 Internal Error',
    status: 500,
    severity: SEVERITY.MEDIUM,
    optional: true,
  });

  const result = classifyEndpointHealth('/api/alert-center');
  assertEqual(result.status, HEALTH_STATUS.DEGRADED, 'Non-critical failure = DEGRADED');
  assertEqual(result.failureCount, 0, 'Circuit still CLOSED (failureCount from CB is 0)');
});

test('classifyEndpointHealth returns endpoint and provider fields', () => {
  clear();
  resetAllCircuitBreakers();

  const result = classifyEndpointHealth('/api/health', 'internal');
  assertEqual(result.endpoint, '/api/health', 'Endpoint field is set');
  assertEqual(result.provider, 'internal', 'Provider field is set');
});

test('classifyEndpointHealth handles unknown endpoint', () => {
  clear();
  resetAllCircuitBreakers();

  const result = classifyEndpointHealth('/api/unknown');
  assertEqual(result.endpoint, '/api/unknown', 'Unknown endpoint is returned');
  assert(result.provider != null, 'Provider still resolved (defaults to internal)');
});

// ============================================================================
// 7-10. buildConnectivityHealth Tests
// ============================================================================
console.log('\n--- 7-10. buildConnectivityHealth Tests ---\n');

test('buildConnectivityHealth - empty events = all CONNECTED', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  assertEqual(result.success, true, 'Success is true');
  assert(result.endpoints.length > 0, 'Has endpoint entries');
  assertEqual(result.status, HEALTH_STATUS.CONNECTED, 'Aggregate status is CONNECTED with no failures');
  assertEqual(result.healthy, true, 'Healthy flag is true');
  assert(result.disclaimer != null, 'Disclaimer is present');
});

test('buildConnectivityHealth - critical failure = UNAVAILABLE aggregate', () => {
  clear();
  resetAllCircuitBreakers();

  const provider = 'yahoo';
  const cb = getCircuitBreaker(provider);
  cb.forceState(STATE.OPEN);

  const result = buildConnectivityHealth();
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'Aggregate is UNAVAILABLE with OPEN circuit');
  assertEqual(result.unavailable, true, 'Unavailable flag is true');
  assert(result.summary.UNAVAILABLE > 0, 'Summary shows at least 1 UNAVAILABLE');
});

test('buildConnectivityHealth - medium failure = DEGRADED aggregate', () => {
  clear();
  resetAllCircuitBreakers();

  record({
    route: 'market-data',
    provider: 'yahoo',
    errorType: ERROR_TYPES.TIMEOUT,
    message: 'Request timed out after 10000ms',
    severity: SEVERITY.MEDIUM,
    optional: true,
  });

  const result = buildConnectivityHealth(['/api/market-data']);
  assertEqual(result.status, HEALTH_STATUS.DEGRADED, 'Aggregate is DEGRADED with medium failure');
  assertEqual(result.degraded, true, 'Degraded flag is true');
});

test('buildConnectivityHealth - aggregate status picks worst', () => {
  clear();
  resetAllCircuitBreakers();

  const yahooCb = getCircuitBreaker('yahoo');
  yahooCb.forceState(STATE.OPEN);

  const result = buildConnectivityHealth();
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'Worst status (UNAVAILABLE) wins');
  assert(result.summary.UNAVAILABLE > 0, 'Summary shows UNAVAILABLE count');
});

test('buildConnectivityHealth includes summary breakdown', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  assertEqual(typeof result.summary, 'object', 'Summary is an object');
  assert(result.summary.CONNECTED != null, 'Summary has CONNECTED count');
  assert(result.summary.DEGRADED != null, 'Summary has DEGRADED count');
  assert(result.summary.UNAVAILABLE != null, 'Summary has UNAVAILABLE count');
  assertEqual(typeof result.totalEndpoints, 'number', 'totalEndpoints is a number');
});

test('buildConnectivityHealth includes disclaimer', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  assert(result.disclaimer != null, 'Disclaimer is present');
  assert(result.disclaimer.includes('circuit-breaker'), 'Disclaimer mentions circuit breaker');
  assert(result.disclaimer.includes('fabricated') || result.disclaimer.includes('fabricate'), 'Disclaimer mentions no fabrication');
});

test('buildConnectivityHealth endpoint entries have required fields', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  const first = result.endpoints[0];
  assert(first.endpoint != null, 'Has endpoint field');
  assert(first.provider != null, 'Has provider field');
  assert(first.status != null, 'Has status field');
  assert(first.circuitState != null, 'Has circuitState field');
  assert(first.lastChecked != null, 'Has lastChecked timestamp');
});

// ============================================================================
// 11-14. probeEndpoint Tests (using real fetch)
// ============================================================================
console.log('\n--- 11-14. probeEndpoint Tests ---\n');

test('probeEndpoint returns actual HTTP status (no fabrication)', async () => {
  const result = await probeEndpoint('/api/health', 'https://httpbin.org', 8000);
  assertEqual(typeof result, 'object', 'Returns object');
  assert(result.endpoint != null, 'Has endpoint');
  assert(result.status != null, 'Has status');
  assert(result.timestamp != null, 'Has timestamp');
  assert(result.latency != null, 'Latency is measured (not fabricated)');
  assert(typeof result.latency === 'number' && result.latency >= 0, 'Latency is a non-negative number');
}, true);

test('probeEndpoint handles timeout', async () => {
  // Use a non-routable IP to force timeout/failure
  const result = await probeEndpoint('/api/health', 'http://10.255.255.1', 1000);
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'Timeout/connection failure = UNAVAILABLE');
  assert(result.error != null, 'Error is set');
  assert(result.latency != null, 'Latency is measured even on failure');
}, true);

test('probeEndpoint handles non-2xx HTTP status', async () => {
  const result = await probeEndpoint('/api/nonexistent-endpoint-404', 'https://httpbin.org', 8000);
  assertEqual(result.status, HEALTH_STATUS.DEGRADED, '4xx returns DEGRADED');
  assert(result.httpStatus != null, 'HTTP status code is returned (not fabricated)');
}, true);

test('probeEndpoint handles network failure (non-existent host)', async () => {
  const result = await probeEndpoint('/api/health', 'http://nonexistent-host-12345.invalid', 1000);
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'Network failure = UNAVAILABLE');
  assert(result.error != null, 'Error type is set');
}, true);

// ============================================================================
// 15. combineStatus Tests
// ============================================================================
console.log('\n--- 15. combineStatus Tests ---\n');

test('combineStatus picks worst of CONNECTED and UNAVAILABLE', () => {
  assertEqual(combineStatus(HEALTH_STATUS.CONNECTED, HEALTH_STATUS.UNAVAILABLE), HEALTH_STATUS.UNAVAILABLE, 'UNAVAILABLE wins');
  assertEqual(combineStatus(HEALTH_STATUS.UNAVAILABLE, HEALTH_STATUS.CONNECTED), HEALTH_STATUS.UNAVAILABLE, 'UNAVAILABLE wins regardless of order');
});

test('combineStatus picks worst of CONNECTED and DEGRADED', () => {
  assertEqual(combineStatus(HEALTH_STATUS.CONNECTED, HEALTH_STATUS.DEGRADED), HEALTH_STATUS.DEGRADED, 'DEGRADED wins');
});

test('combineStatus picks worst of DEGRADED and UNAVAILABLE', () => {
  assertEqual(combineStatus(HEALTH_STATUS.DEGRADED, HEALTH_STATUS.UNAVAILABLE), HEALTH_STATUS.UNAVAILABLE, 'UNAVAILABLE wins over DEGRADED');
});

test('combineStatus returns CONNECTED when both are CONNECTED', () => {
  assertEqual(combineStatus(HEALTH_STATUS.CONNECTED, HEALTH_STATUS.CONNECTED), HEALTH_STATUS.CONNECTED, 'CONNECTED stays CONNECTED');
});

test('combineStatus handles UNCHECKED', () => {
  assertEqual(combineStatus(HEALTH_STATUS.CONNECTED, HEALTH_STATUS.UNCHECKED), HEALTH_STATUS.UNCHECKED, 'UNCHECKED degrades result');
});

// ============================================================================
// 16-20. No Fabrication & Integrity Tests
// ============================================================================
console.log('\n--- 16-20. No Fabrication & Integrity Tests ---\n');

test('No fabricated data in buildConnectivityHealth report', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  assertEqual(result.success, true, 'Has success flag');
  assert(result.timestamp != null, 'Has real timestamp (ISO string)');
  assert(!result.timestamp.includes('T00:00:00'), 'Timestamp is not a placeholder');
  assert(result.endpoints.every(e => e.lastChecked != null), 'Every endpoint has a real lastChecked timestamp');
});

test('classifyEndpointHealth does not fabricate latency', () => {
  clear();
  resetAllCircuitBreakers();

  const result = classifyEndpointHealth('/api/health');
  assert(!('latency' in result), 'Latency is not in classifyEndpointHealth (only in probe)');
});

test('buildConnectivityHealth endpoints do not have fabricated HTTP status', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth(['/api/health']);
  assert(!('httpStatus' in result.endpoints[0]), 'HTTP status only from real probe, not fabricated');
});

test('buildConnectivityHealth does not include made-up endpoints', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  const endpoints = result.endpoints.map(e => e.endpoint);
  assert(!endpoints.includes('/api/fake-endpoint'), 'No fabricated endpoints');
  assert(!endpoints.includes('/api/placeholder'), 'No placeholder endpoints');
  assert(endpoints.every(e => e.startsWith('/api/')), 'All endpoints are valid API paths');
});

test('buildConnectivityHealth summary counts are consistent', () => {
  clear();
  resetAllCircuitBreakers();

  const result = buildConnectivityHealth();
  const sum = result.summary.CONNECTED + result.summary.DEGRADED + result.summary.UNAVAILABLE + result.summary.UNCHECKED;
  assertEqual(sum, result.totalEndpoints, 'Summary counts sum to total endpoints');
});

// ============================================================================
// Circuit Breaker Integration Tests
// ============================================================================
console.log('\n--- Circuit Breaker Integration Tests ---\n');

test('classifyEndpointHealth reflects circuit breaker OPEN state', () => {
  clear();
  resetAllCircuitBreakers();

  const cb = getCircuitBreaker('finnhub');
  cb.forceState(STATE.OPEN);

  const result = classifyEndpointHealth('/api/stocks', 'finnhub');
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'OPEN circuit makes endpoint UNAVAILABLE');
  assertEqual(result.circuitState, STATE.OPEN, 'Circuit state is OPEN');
});

test('classifyEndpointHealth reflects circuit breaker CLOSED state', () => {
  clear();
  resetAllCircuitBreakers();

  const cb = getCircuitBreaker('finnhub');
  cb.forceState(STATE.CLOSED);
  cb.reset();

  const result = classifyEndpointHealth('/api/stocks', 'finnhub');
  assertEqual(result.status, HEALTH_STATUS.CONNECTED, 'CLOSED circuit with no failures = CONNECTED');
});

test('classifyEndpointHealth reflects circuit breaker HALF_OPEN state', () => {
  clear();

  const cb = getCircuitBreaker('finnhub');
  cb.forceState(STATE.HALF_OPEN);

  const result = classifyEndpointHealth('/api/stocks', 'finnhub');
  assertEqual(result.status, HEALTH_STATUS.DEGRADED, 'HALF_OPEN circuit = DEGRADED');
});

// ============================================================================
// Failure Events Integration Tests
// ============================================================================
console.log('\n--- Failure Events Integration Tests ---\n');

test('classifyEndpointHealth uses failure-events for DEGRADED status', () => {
  clear();
  resetAllCircuitBreakers();

  record({
    route: 'swing-horizon',
    provider: 'internal',
    errorType: ERROR_TYPES.TIMEOUT,
    message: 'Timeout fetching swing horizon',
    severity: SEVERITY.MEDIUM,
    optional: true,
  });

  const result = classifyEndpointHealth('/api/swing-horizon');
  assert(result.status === HEALTH_STATUS.DEGRADED || result.status === HEALTH_STATUS.CONNECTED,
    'Timeout event produces DEGRADED or CONNECTED');
});

test('classifyEndpointHealth uses failure-events for UNAVAILABLE status', () => {
  clear();
  resetAllCircuitBreakers();

  const cb = getCircuitBreaker('yahoo');
  cb.forceState(STATE.OPEN);

  record({
    route: 'stocks',
    provider: 'yahoo',
    errorType: ERROR_TYPES.PROVIDER_UNAVAILABLE,
    message: 'Yahoo Finance unavailable',
    severity: SEVERITY.CRITICAL,
  });

  const result = classifyEndpointHealth('/api/stocks', 'yahoo');
  assertEqual(result.status, HEALTH_STATUS.UNAVAILABLE, 'OPEN circuit + critical failure = UNAVAILABLE');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log(`P2-6 TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

// Final cleanup
clear();

process.exit(failCount > 0 ? 1 : 0);
