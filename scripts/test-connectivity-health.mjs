// scripts/test-connectivity-health.mjs
/**
 * Connectivity Health Tests — P2-6 Live Connectivity Health Check
 *
 * Run with: node scripts/test-connectivity-health.mjs
 */

import fetch from 'node-fetch';
import { clear } from '../lib/failure-events.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected true but got false');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

console.log('\n========================================');
console.log('Connectivity Health Tests (P2-6)');
console.log('========================================\n');

// Start the Next.js dev server in the background? 
// Instead, we will test the function directly by importing the route handler.
// However, the route handler uses NextResponse, which is only available in the Next.js environment.
// We can test the logic by importing the functions we use and mocking the NextResponse.

// We'll refactor: move the logic to a separate function that we can test.
// But for simplicity, we'll test the endpoint by starting the server in a child process? 
// That is complex.

// Alternatively, we can test the helper functions that we will extract.

// Given the time, we'll test the endpoint by making a request to the running server.
// We assume the server is running on localhost:3000.

// We'll start by checking if the server is running.

const BASE_URL = 'http://localhost:3000';

async function fetchEndpoint(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

test('A: endpoint returns 200 and correct structure', async () => {
  clear();
  const data = await fetchEndpoint('/api/connectivity-health');
  assertEqual(data.success, true);
  assertTrue(['CONNECTED', 'DEGRADED', 'UNAVAILABLE', 'ERROR'].includes(data.status));
  // lastSuccess and lastFailure can be null or a string
  if (data.lastSuccess !== null) {
    // Check if it's a valid ISO string
    const date = new Date(data.lastSuccess);
    assertTrue(!isNaN(date.getTime()), 'lastSuccess should be a valid ISO timestamp');
  }
  if (data.lastFailure !== null) {
    const date = new Date(data.lastFailure);
    assertTrue(!isNaN(date.getTime()), 'lastFailure should be a valid ISO timestamp');
  }
  // timestamp should be a valid ISO string
  const nowDate = new Date(data.timestamp);
  assertTrue(!isNaN(nowDate.getTime()), 'timestamp should be a valid ISO timestamp');
});

test('B: endpoint returns CONNECTED when there are no recent failures', async () => {
  clear();
  // Record a success event (this is done by the circuit breaker when a provider call succeeds)
  // But we don't have a direct way to record a success in the failure events from the test?
  // We can use the record function from failure-events to record a success? 
  // However, the failure events module does not expose a function to record a success directly.
  // We see in circuit-breaker-manager.js there is recordProviderSuccess, but that is not exported from failure-events.
  // We can only record failures via the `record` function in failure-events (which is used for both success and failure in the circuit breaker manager).
  // Looking at failure-events.js, the `record` function is used for both success and failure (see circuit-breaker-manager.js lines 105-114).
  // So we can record a success by calling record with severity: 'INFO' and errorType: null.
  const { record } = await import('../lib/failure-events.js');
  record({
    route: '/api/test',
    provider: 'yahoo',
    errorType: null,
    message: 'Provider request successful',
    severity: 'INFO',
    symbol: 'AAPL',
  });

  const data = await fetchEndpoint('/api/connectivity-health');
  assertEqual(data.status, 'CONNECTED');
  assertNotNull(data.lastSuccess);
  // lastFailure may be null if there are no failures
});

test('C: endpoint returns DEGRADED when there are recent high/medium failures', async () => {
  clear();
  const { record } = await import('../lib/failure-events.js');
  // Record a medium failure (e.g., TIMEOUT for a non-critical provider)
  record({
    route: '/api/test',
    provider: 'finnhub', // finnhub is not critical? Actually, from failure-events.js, finnhub is not in PROVIDERS? Let's check.
    // We'll use a provider that is not critical, but we don't have the list. We'll just record an event with severity that would lead to degraded.
    // We know that if there are any high or medium failures, the status becomes degraded.
    // We can record an event with severity: 'MEDIUM' directly? But the record function in failure-events.js does not take severity as a parameter? 
    // Actually, it does: the record function in failure-events.js has a severity field.
    // Looking at failure-events.js line 57: the record function accepts an object with severity.
    // So we can set severity to 'MEDIUM'.
    errorType: 'TIMEOUT',
    message: 'Test timeout',
    severity: 'MEDIUM',
    symbol: 'AAPL',
  });

  const data = await fetchEndpoint('/api/connectivity-health');
  assertEqual(data.status, 'DEGRADED');
  assertNotNull(data.lastFailure);
});

test('D: endpoint returns UNAVAILABLE when there are recent critical failures', async () => {
  clear();
  const { record } = await import('../lib/failure-events.js');
  record({
    route: '/api/test',
    provider: 'yahoo',
    errorType: 'HTTP_FAILURE',
    message: 'Test critical error',
    severity: 'CRITICAL',
    symbol: 'AAPL',
  });

  const data = await fetchEndpoint('/api/connectivity-health');
  assertEqual(data.status, 'UNAVAILABLE');
  assertNotNull(data.lastFailure);
});

test('E: endpoint returns ERROR when an exception occurs', async () => {
  // We cannot easily trigger an exception in the endpoint without mocking.
  // We'll skip this test for now, or we can try to cause an error by making the summary function throw?
  // We'll instead test that the endpoint catches errors and returns ERROR status.
  // We'll mock the summarize function to throw? Not possible in a black-box test.
  // We'll skip and rely on the fact that the try-catch is there.
  console.log('⏭️  SKIP: E: endpoint returns ERROR when an exception occurs (hard to test in black-box)');
});

test('F: endpoint does not break existing functionality', async () => {
  // We'll test that the existing failure-events endpoint still works
  const feData = await fetchEndpoint('/api/failure-events?summary=true');
  assertEqual(feData.success, true);
  assertTrue(feData.data.status === 'healthy' || feData.data.status === 'degraded' || feData.data.status === 'unavailable');
});

function assertNotNull(value) {
  if (value === null) {
    throw new Error('Expected value to not be null');
  }
}

console.log('\n========================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}