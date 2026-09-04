/**
 * Failure Events Tests — P1-4 Production Failure Alerting
 *
 * Run with: node scripts/test-failure-events.mjs
 */

import {
  SEVERITY,
  ERROR_TYPES,
  PROVIDERS,
  record,
  list,
  summarize,
  clear,
  lastCritical,
} from '../lib/failure-events.js';

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
console.log('Failure Events Tests (P1-4)');
console.log('========================================\n');

import fs from 'node:fs';
import path from 'node:path';

// A. record a basic failure event
test('A: record a basic failure event', () => {
  clear();
  const result = record({
    route: '/api/test',
    provider: PROVIDERS.YAHOO,
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'Test error',
    status: 500,
    symbol: 'AAPL',
  });
  assertEqual(result.deduplicated, false);
  assertTrue(result.event);
  assertEqual(result.event.route, '/api/test');
  assertEqual(result.event.provider, PROVIDERS.YAHOO);
  assertEqual(result.event.errorType, ERROR_TYPES.HTTP_FAILURE);
  assertEqual(result.event.message, 'Test error');
  assertEqual(result.event.status, 500);
  assertEqual(result.event.symbol, 'AAPL');
  assertEqual(result.event.severity, SEVERITY.CRITICAL);
  assertEqual(result.event.optional, false);
});

// B. deduplicate identical failures
test('B: deduplicate identical failures within cooldown', () => {
  clear();
  const first = record({
    route: '/api/test',
    provider: PROVIDERS.YAHOO,
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'Test error',
    symbol: 'AAPL',
  });
  const second = record({
    route: '/api/test',
    provider: PROVIDERS.YAHOO,
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'Test error',
    symbol: 'AAPL',
  });
  assertEqual(first.deduplicated, false);
  assertEqual(second.deduplicated, true);
  const events = list();
  assertEqual(events.length, 1);
});

// C. different error types are not deduplicated
test('C: different error types are not deduplicated', () => {
  clear();
  record({
    route: '/api/test',
    provider: PROVIDERS.YAHOO,
    errorType: ERROR_TYPES.HTTP_FAILURE,
    message: 'HTTP 500',
    symbol: 'AAPL',
  });
  record({
    route: '/api/test',
    provider: PROVIDERS.YAHOO,
    errorType: ERROR_TYPES.TIMEOUT,
    message: 'Request timeout',
    symbol: 'AAPL',
  });
  const events = list();
  assertEqual(events.length, 2);
});

// D. list events with filters
test('D: list events with filters', () => {
  clear();
  record({ route: '/api/indices', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Indices error', symbol: '^GSPC' });
  record({ route: '/api/stocks', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Stocks error', symbol: 'AAPL' });
  record({ route: '/api/market-data', provider: PROVIDERS.FINNHUB, errorType: ERROR_TYPES.TIMEOUT, message: 'Finnhub timeout', symbol: 'MSFT' });

  const indicesEvents = list({ route: '/api/indices' });
  assertEqual(indicesEvents.length, 1);
  assertEqual(indicesEvents[0].route, '/api/indices');

  const yahooEvents = list({ provider: PROVIDERS.YAHOO });
  assertEqual(yahooEvents.length, 2);

  const criticalEvents = list({ severity: SEVERITY.CRITICAL });
  // yahoo http_failure = CRITICAL, yahoo http_failure = CRITICAL, finnhub timeout = MEDIUM
  assertEqual(criticalEvents.length, 2);
});

// E. summarize: healthy when no failures
test('E: summarize returns healthy when no failures', () => {
  clear();
  const summary = summarize();
  assertEqual(summary.status, 'healthy');
  assertEqual(summary.counts.total, 0);
});

// F. summarize: unavailable when critical failures
test('F: summarize returns unavailable when critical failures', () => {
  clear();
  record({ route: '/api/indices', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Critical error', symbol: '^GSPC' });
  const summary = summarize();
  assertEqual(summary.status, 'unavailable');
  assertTrue(summary.counts.critical > 0);
});

// G. summarize: degraded when only high/medium failures
test('G: summarize returns degraded when only high/medium failures', () => {
  clear();
  record({ route: '/api/market-data', provider: PROVIDERS.FINNHUB, errorType: ERROR_TYPES.MALFORMED_RESPONSE, message: 'Malformed', symbol: 'AAPL' });
  // finnhub MALFORMED_RESPONSE = HIGH severity (critical provider, malformed = HIGH)
  const summary = summarize();
  // Note: finnhub is critical provider, so malformed_response becomes HIGH severity
  // That would be 'degraded' (high > 0, critical === 0)
  // Actually let me use a clear medium case
  clear();
  record({ route: '/api/market-data', provider: PROVIDERS.FINNHUB, errorType: ERROR_TYPES.TIMEOUT, message: 'Timeout', symbol: 'AAPL' });
  const s2 = summarize();
  // finnhub TIMEOUT = MEDIUM severity -> degraded
  assertEqual(s2.status, 'degraded');
  assertTrue(s2.counts.medium > 0);
});

// H. summarize: counts by provider
test('H: summarize counts by provider correctly', () => {
  clear();
  record({ route: '/api/indices', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'yahoo 1' });
  record({ route: '/api/stocks', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'yahoo 2' });
  record({ route: '/api/market-data', provider: PROVIDERS.FINNHUB, errorType: ERROR_TYPES.TIMEOUT, message: 'finnhub 1' });
  const summary = summarize();
  assertEqual(summary.counts.byProvider.yahoo, 2);
  assertEqual(summary.counts.byProvider.finnhub, 1);
  assertEqual(summary.counts.total, 3);
});

// I. optional provider failure does not cause unavailable
test('I: optional provider failure does not make system unavailable', () => {
  clear();
  // gemini is optional - a failure there should be optional, not critical
  record({ route: '/api/ai-explanation', provider: PROVIDERS.GEMINI, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Gemini down' });
  const summary = summarize();
  // Gemini is optional, so the event is marked optional
  // But severity is still CRITICAL (since gemini http_failure maps to severityForProvider)
  // Actually severityForProvider: gemini is optional, http_failure -> not specifically mapped, falls through to criticality check -> optional -> MEDIUM
  // So status should be 'degraded' not 'unavailable'
  assertEqual(summary.status, 'degraded');
  assertEqual(summary.counts.critical, 0);
  assertTrue(summary.counts.medium > 0);
});

// J. lastCritical returns most recent critical/high failure (excluding optional)
test('J: lastCritical returns most recent critical failure', () => {
  clear();
  record({ route: '/api/ai-explanation', provider: PROVIDERS.GEMINI, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Optional error' });
  record({ route: '/api/indices', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Critical error', symbol: '^GSPC' });
  const last = lastCritical({ ignoreOptional: true });
  assertTrue(last);
  assertEqual(last.route, '/api/indices');
});

// K. sanitize secrets from error messages
test('K: sanitize secrets from error messages', () => {
  clear();
  const result = record({
    route: '/api/test',
    provider: PROVIDERS.INTERNAL,
    errorType: ERROR_TYPES.AUTH_FAILURE,
    message: 'Failed with api_key=secret1234567890 and Bearer abc123def456',
    symbol: 'TEST',
  });
  assertTrue(result.event.message.includes('[REDACTED]'));
  assertFalse(result.event.message.includes('secret1234567890'));
  assertFalse(result.event.message.includes('abc123def456'));
});

// L. clear removes all events
test('L: clear removes all events', () => {
  record({ route: '/api/test', provider: PROVIDERS.YAHOO, errorType: ERROR_TYPES.HTTP_FAILURE, message: 'Test' });
  assertTrue(list().length > 0);
  clear();
  assertEqual(list().length, 0);
});

// M. no secrets in response output
test('M: listed events do not contain secrets', () => {
  clear();
  record({
    route: '/api/test',
    provider: PROVIDERS.INTERNAL,
    errorType: ERROR_TYPES.AUTH_FAILURE,
    message: 'Authorization: Bearer mySecretToken12345',
  });
  const events = list();
  assertEqual(events.length, 1);
  const serialized = JSON.stringify(events);
  assertFalse(serialized.includes('mySecretToken12345'));
  assertTrue(serialized.includes('[REDACTED]'));
});

// N. failure-events module does not import scoring modules
test('N: failure-events module does not import scoring modules', async () => {
  const source = await fs.promises.readFile(
    path.join(process.cwd(), 'lib/failure-events.js'),
    'utf8'
  );
  assertFalse(source.includes('hunter-intelligence'));
  assertFalse(source.includes('opportunity-ranking'));
  assertFalse(source.includes('trade-plan-engine'));
  assertFalse(source.includes('market-regime-engine'));
});

// O. health route does not change behavior when no failures
test('O: health route preserves existing structure', async () => {
  const source = await fs.promises.readFile(
    path.join(process.cwd(), 'app/api/health/route.js'),
    'utf8'
  );
  assertTrue(source.includes("from '@/lib/failure-events'"));
  assertTrue(source.includes("getInstitutionalProviderStatus"));
  assertTrue(source.includes("HIC_THRESHOLDS"));
});

// P. failure-events endpoint exists with correct structure
test('P: failure-events endpoint exists with correct structure', async () => {
  const endpointPath = path.join(process.cwd(), 'app/api/failure-events/route.js');
  assertTrue((await fs.promises.stat(endpointPath)).isFile(), 'failure-events endpoint should exist');

  const source = await fs.promises.readFile(endpointPath, 'utf8');
  assertTrue(source.includes('export async function GET'));
  assertTrue(source.includes('list'));
  assertTrue(source.includes('summarize'));
  assertTrue(source.includes('Cache-Control'));
});

console.log('\n========================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('========================================');

if (failCount > 0) {
  process.exit(1);
}
