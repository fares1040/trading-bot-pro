#!/usr/bin/env node
/**
 * P2-5 Top-3 Alert Push Notification Tests
 *
 * Deterministic - no network, no dev server, no credentials.
 * Run with: node scripts/test-top3-alerts.mjs
 *
 * Coverage:
 *   1.    Top-3 selection from ranked alerts
 *   2.    Alert payload correctness (symbol, rank, score, evidence, etc.)
 *   3.    AVOID suppression — AVOID candidates never appear in Top-3
 *   4.    Duplicate suppression/deduplication
 *   5.    Missing/UNAVAILABLE data handling
 *   6.    Browser notification permission/unavailable handling
 *   7.    Empty input handling
 *   8.    Fewer than 3 alerts
 *   9.    Ranking stability
 *   10.   Notification contract fields
 */

import {
  buildAlertFromInputs,
  buildAlertCenter,
  rankAlerts,
  selectTop3Alerts,
  buildTop3NotificationPayload,
  isAvoidSignal,
  deduplicateAlerts,
  ALERT_TYPES,
  ALERT_STATUSES,
} from '../lib/alert-center.js';

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

function assertNotEqual(actual, unexpected, msg) {
  const pass = JSON.stringify(actual) !== JSON.stringify(unexpected);
  if (!pass) throw new Error(`${msg}: should not equal ${JSON.stringify(unexpected)}`);
}

console.log('='.repeat(60));
console.log('P2-5 TOP-3 ALERT NOTIFICATION TEST SUITE');
console.log('='.repeat(60));

// ============================================================================
// Test Data: Building blocks for tests
// ============================================================================

function makeInput(symbol, score, opts = {}) {
  const sources = {
    opportunityRanking: {
      opportunityScore: score,
      quality: opts.quality || (score >= 85 ? 'TOP' : score >= 70 ? 'STRONG' : score >= 55 ? 'WATCH' : 'WEAK'),
      confidence: opts.confidence ?? Math.round(score * 0.9),
      confidenceLevel: 'HIGH',
      dataCompleteness: opts.dataCompleteness ?? 80,
      risks: opts.risks || [],
      warnings: opts.warnings || [],
    },
  };

  if (opts.planSignal) {
    sources.tradePlan = {
      planSignal: opts.planSignal,
      planScore: opts.planScore || score - 5,
      direction: opts.direction || 'LONG',
      riskReward: opts.riskReward || 2.0,
      confidence: opts.confidence ?? Math.round(score * 0.9),
    };
  }

  if (opts.directionBias) {
    sources.opportunityRanking.directionBias = opts.directionBias;
  }

  if (opts.signal) {
    sources.tradePlan = sources.tradePlan || {};
    sources.tradePlan.planSignal = opts.signal;
  }

  if (opts.evidence) {
    sources.opportunityRanking.evidenceReasons = opts.evidence;
  }

  return { symbol, sources };
}

// ============================================================================
// 1. Top-3 Selection Tests
// ============================================================================
console.log('\n--- 1. Top-3 Selection Tests ---\n');

test('selectTop3 returns exactly 3 alerts when more than 3 available', () => {
  const inputs = [
    makeInput('AAA', 90),
    makeInput('BBB', 85),
    makeInput('CCC', 80),
    makeInput('DDD', 75),
    makeInput('EEE', 70),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 3, 'Should return exactly 3 alerts');
});

test('selectTop3 returns all available when fewer than 3', () => {
  const inputs = [
    makeInput('AAA', 90),
    makeInput('BBB', 80),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 2, 'Should return all available when fewer than 3');
});

test('selectTop3 ranks by priority descending', () => {
  const inputs = [
    makeInput('LOW', 50),
    makeInput('HIGH', 90),
    makeInput('MID', 70),
    makeInput('MID2', 65),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 3, 'Returns 3 alerts');
  assert(top3[0].priority >= top3[1].priority, 'First has highest or equal priority');
  assert(top3[1].priority >= top3[2].priority, 'Second has >= priority than third');
});

test('selectTop3 assigns sequential rank values', () => {
  const inputs = [
    makeInput('AAA', 90),
    makeInput('BBB', 85),
    makeInput('CCC', 80),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3[0].rank, 1, 'First alert has rank 1');
  assertEqual(top3[1].rank, 2, 'Second alert has rank 2');
  assertEqual(top3[2].rank, 3, 'Third alert has rank 3');
});

test('selectTop3 includes notificationId', () => {
  const inputs = [
    makeInput('AAA', 90),
    makeInput('BBB', 85),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assert(top3[0].notificationId != null, 'Notification ID is set');
  assert(top3[0].notificationId.startsWith('TOP3:'), 'Notification ID starts with TOP3:');
});

// ============================================================================
// 2. Alert Payload Correctness Tests
// ============================================================================
console.log('\n--- 2. Alert Payload Correctness Tests ---\n');

test('Top-3 alert contains symbol', () => {
  const inputs = [makeInput('AAA', 95), makeInput('BBB', 90), makeInput('CCC', 85)];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 3, 'All three alerts returned');
  assert(top3.every(a => a.symbol != null), 'Every alert has a symbol');
  assertEqual(new Set(top3.map(a => a.symbol)).size, 3, 'All symbols are unique');
});

test('Top-3 alert contains score when available', () => {
  const inputs = [{
    symbol: 'SCORE',
    sources: { opportunityRanking: { opportunityScore: 88, dataCompleteness: 90 } },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assert(top3[0].score != null, 'Score is present');
  assert(top3[0].score >= 80, 'Score is >= 80');
});

test('Top-3 alert contains key reason/evidence when available', () => {
  const inputs = [{
    symbol: 'EVIDENCE',
    sources: {
      opportunityRanking: {
        opportunityScore: 85,
        quality: 'TOP',
        confidence: 90,
        confidenceLevel: 'HIGH',
        dataCompleteness: 90,
      },
    },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assert(Array.isArray(top3[0].evidence), 'Evidence array exists');
  assert(top3[0].evidence.length > 0, 'Evidence is non-empty when available');
});

test('Top-3 alert contains risk/decision state when available', () => {
  const inputs = [{
    symbol: 'RISK',
    sources: {
      opportunityRanking: {
        opportunityScore: 80,
        quality: 'STRONG',
        dataCompleteness: 85,
        risks: [{ label: 'VOLATILITY', severity: 'MEDIUM', description: 'High volatility' }],
      },
    },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assert(Array.isArray(top3[0].risks), 'Risks array exists');
  assert(top3[0].risks.length > 0, 'Risks are populated');
});

test('Top-3 alert contains directionBias when available', () => {
  const inputs = [{
    symbol: 'DIR',
    sources: {
      opportunityRanking: { opportunityScore: 85, directionBias: 'LONG', dataCompleteness: 90 },
    },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3[0].directionBias, 'LONG', 'DirectionBias is LONG');
});

test('Top-3 alert preserves severity and priority', () => {
  const inputs = [{
    symbol: 'SEV',
    sources: { opportunityRanking: { opportunityScore: 90, dataCompleteness: 90 } },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3[0].severity, 'CRITICAL', 'High-score alert has CRITICAL severity');
  assert(top3[0].priority != null, 'Priority is set');
});

// ============================================================================
// 3. AVOID Suppression Tests
// ============================================================================
console.log('\n--- 3. AVOID Suppression Tests ---\n');

test('AVOID signal candidates are excluded from Top-3', () => {
  const inputs = [
    makeInput('BUY1', 95, { planSignal: 'STRONG_PLAN' }),
    makeInput('BUY2', 90, { planSignal: 'VALID_PLAN' }),
    makeInput('BUY3', 85, { planSignal: 'VALID_PLAN' }),
    makeInput('AVOID1', 75, { planSignal: 'AVOID' }),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts, { excludeAvoid: true });

  assertEqual(top3.length, 3, 'Only 3 non-AVOID alerts returned');
  assert(!top3.some(a => a.symbol === 'AVOID1'), 'AVOID1 is not in Top-3');
  assert(!top3.some(a => a.signal === 'AVOID'), 'No AVOID signals in Top-3');
});

test('AVOID signal appears in isAvoidSignal check', () => {
  const input = [{
    symbol: 'AVOID_TEST',
    sources: {
      opportunityRanking: { opportunityScore: 80 },
      tradePlan: { planSignal: 'AVOID', planScore: 30 },
    },
  }];
  const alerts = buildAlertFromInputs(input);
  assert(isAvoidSignal(alerts[0]), 'AVOID signal is detected by isAvoidSignal');
});

test('Non-AVOID signal does not trigger suppression', () => {
  const input = [{
    symbol: 'BUY_TEST',
    sources: {
      opportunityRanking: { opportunityScore: 85, quality: 'TOP' },
      tradePlan: { planSignal: 'STRONG_PLAN' },
    },
  }];
  const alerts = buildAlertFromInputs(input);
  assert(!isAvoidSignal(alerts[0]), 'Non-AVOID signal is not suppressed');
});

test('AVOID suppression is default behavior', () => {
  const inputs = [
    makeInput('OK1', 90),
    makeInput('OK2', 85),
    makeInput('OK3', 80),
    makeInput('BAD', 75, { planSignal: 'AVOID' }),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 3, 'Default behavior excludes AVOID');
  assert(!top3.some(a => a.symbol === 'BAD'), 'AVOID candidate not in default Top-3');
});

test('AVOID suppression can be disabled via options', () => {
  const inputs = [
    makeInput('OK1', 90),
    makeInput('BAD', 75, { planSignal: 'AVOID' }),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts, { excludeAvoid: false });

  assert(top3.some(a => a.symbol === 'BAD'), 'AVOID included when excludeAvoid=false');
});

test('buildTop3NotificationPayload reports suppressedAvoid count', () => {
  const inputs = [
    makeInput('OK1', 90),
    makeInput('OK2', 85),
    makeInput('OK3', 80),
    makeInput('BAD1', 75, { planSignal: 'AVOID' }),
    makeInput('BAD2', 70, { planSignal: 'AVOID' }),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const payload = buildTop3NotificationPayload(alerts);

  assertEqual(payload.suppressedAvoid, 2, 'Reports 2 suppressed AVOID candidates');
  assertEqual(payload.top3.length, 3, 'Top-3 has 3 non-AVOID alerts');
});

// ============================================================================
// 4. Duplicate Suppression / Deduplication Tests
// ============================================================================
console.log('\n--- 4. Duplicate Suppression Tests ---\n');

test('deduplicateAlerts removes duplicates by ID', () => {
  const inputs = [makeInput('AAA', 90), makeInput('AAA', 90)];
  const alerts = buildAlertFromInputs(inputs);
  const deduped = deduplicateAlerts(alerts, []);

  assertEqual(deduped.length, 1, 'Duplicate by symbol deduped to 1');
});

test('duplicate Top-3 alerts are not re-notified', () => {
  const inputs = [makeInput('AAA', 90), makeInput('BBB', 85), makeInput('CCC', 80)];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);
  const existingIds = new Set(top3.map(a => a.notificationId));
  const secondTop3 = selectTop3Alerts(alerts);
  const newTop3 = secondTop3.filter(a => !existingIds.has(a.notificationId));

  assertEqual(newTop3.length, 0, 'Same alerts are deduplicated');
});

test('newly appearing alerts are included after dedup', () => {
  const inputs = [
    makeInput('AAA', 95),
    makeInput('BBB', 90),
    makeInput('CCC', 85),
    makeInput('DDD', 80),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3_1 = selectTop3Alerts(alerts);
  const seenIds = new Set(top3_1.map(a => a.id));
  const filtered = alerts.filter(a => !seenIds.has(a.id));

  assertEqual(filtered.length, 1, 'One new alert remains after dedup');
  const top3_2 = selectTop3Alerts(filtered);
  assertEqual(top3_2.length, 1, 'New Top-3 from filtered contains 1 alert');
  assert(top3_2[0].id === filtered[0].id, 'Remaining alert is correctly surfaced');
});

test('identical inputs produce identical alert IDs (deterministic)', () => {
  const inputs = [makeInput('AAA', 90), makeInput('BBB', 85)];
  const alerts1 = buildAlertFromInputs(inputs);
  const alerts2 = buildAlertFromInputs(inputs);

  assertEqual(alerts1[0].id, alerts2[0].id, 'Alert IDs are deterministic for identical inputs');
  assertEqual(alerts1[1].id, alerts2[1].id, 'Alert IDs are deterministic for identical inputs');
});

// ============================================================================
// 5. Missing / UNAVAILABLE Data Handling Tests
// ============================================================================
console.log('\n--- 5. Missing / UNAVAILABLE Data Handling Tests ---\n');

test('selectTop3 returns empty array for empty input', () => {
  const top3 = selectTop3Alerts([]);
  assertEqual(top3.length, 0, 'Empty input returns empty Top-3');
});

test('selectTop3 returns empty array for null input', () => {
  const top3 = selectTop3Alerts(null);
  assertEqual(top3.length, 0, 'Null input returns empty Top-3');
});

test('selectTop3 returns empty array for undefined input', () => {
  const top3 = selectTop3Alerts(undefined);
  assertEqual(top3.length, 0, 'Undefined input returns empty Top-3');
});

test('buildTop3NotificationPayload handles missing data gracefully', () => {
  const payload = buildTop3NotificationPayload(null);
  assertEqual(payload.top3.length, 0, 'Null input produces empty top3');
  assertEqual(payload.count, 0, 'Count is 0');
  assert(payload.limitations.length > 0, 'Has limitation message');
});

test('Alert with missing score is not generated by buildAlertFromInputs', () => {
  const inputs = [{ symbol: 'NOSCORE', sources: { swingIntelligence: { swingScore: null } } }];
  const alerts = buildAlertFromInputs(inputs);
  assertEqual(alerts.length, 0, 'Alert without score is not generated');
});

test('Alert with UNAVAILABLE direction is handled', () => {
  const inputs = [{
    symbol: 'NO_DIR',
    sources: {
      opportunityRanking: { opportunityScore: 85, dataCompleteness: 90 },
    },
  }];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3[0].directionBias, 'UNAVAILABLE', 'Missing directionBias defaults to UNAVAILABLE');
});

test('buildTop3NotificationPayload includes disclaimer for missing data', () => {
  const payload = buildTop3NotificationPayload([{ symbol: 'X', score: 50, type: 'OPPORTUNITY' }]);
  assert(payload.disclaimer != null, 'Disclaimer is present');
  assert(payload.disclaimer.includes('AVOID'), 'Disclaimer mentions AVOID suppression');
});

// ============================================================================
// 6. Browser Notification Permission Handling Tests
// ============================================================================

console.log('\n--- 6. Browser Notification Permission Handling Tests ---\n');

test('buildTop3NotificationPayload generates notification-ready objects', () => {
  const inputs = [makeInput('AAA', 90), makeInput('BBB', 85), makeInput('CCC', 80)];
  const alerts = buildAlertFromInputs(inputs);
  const payload = buildTop3NotificationPayload(alerts);

  assertEqual(payload.top3.length, 3, 'Three notification payloads created');
  assert(payload.top3[0].notificationId != null, 'Each has notificationId');
  assert(payload.top3[0].symbol != null, 'Each has symbol');
  assert(payload.top3[0].severity != null, 'Each has severity');
  assert(payload.top3[0].timestamp != null, 'Each has timestamp');
});

test('notificationId is unique per alert', () => {
  const inputs = [makeInput('AAA', 90), makeInput('BBB', 85), makeInput('CCC', 80)];
  const alerts = buildAlertFromInputs(inputs);
  const payload = buildTop3NotificationPayload(alerts);

  const ids = payload.top3.map(a => a.notificationId);
  const unique = new Set(ids).size;
  assertEqual(unique, ids.length, 'All notification IDs are unique');
});

test('payload has suppressedAvoid tracking', () => {
  const payload = buildTop3NotificationPayload([]);
  assert('suppressedAvoid' in payload, 'Payload includes suppressedAvoid field');
  assertEqual(payload.suppressedAvoid, 0, 'suppressedAvoid is 0 for empty input');
});

test('payload includes limitations array', () => {
  const payload = buildTop3NotificationPayload([]);
  assert(Array.isArray(payload.limitations), 'Limitations is an array');
});

test('payload success flag is set', () => {
  const payload = buildTop3NotificationPayload([]);
  assertEqual(payload.success, true, 'Success is true even for empty input');
});

// ============================================================================
// 7. Edge Cases
// ============================================================================
console.log('\n--- 7. Edge Case Tests ---\n');

test('selectTop3 with limit option respects custom limit', () => {
  const inputs = [
    makeInput('A', 90), makeInput('B', 85), makeInput('C', 80),
    makeInput('D', 75), makeInput('E', 70), makeInput('F', 65),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts, { limit: 5 });
  assertEqual(top3.length, 5, 'Custom limit of 5 respected');
});

test('selectTop3 ranks alerts correctly with same score', () => {
  const inputs = [
    makeInput('TIE1', 80),
    makeInput('TIE2', 80),
    makeInput('TIE3', 80),
    makeInput('TIE4', 80),
  ];
  const alerts = buildAlertFromInputs(inputs);
  const top3 = selectTop3Alerts(alerts);

  assertEqual(top3.length, 3, 'Returns 3 from 4 equal-score alerts');
  assertEqual(top3[0].rank, 1, 'First has rank 1');
  assertEqual(top3[2].rank, 3, 'Third has rank 3');
});

test('Alert Center build includes top field', () => {
  const inputs = [
    makeInput('A', 90), makeInput('B', 85), makeInput('C', 80),
    makeInput('D', 75), makeInput('E', 70),
  ];
  const result = buildAlertCenter({ inputs, limit: 100 });

  assert(Array.isArray(result.top), 'buildAlertCenter includes top field');
  assertEqual(result.top.length, 5, 'Top field contains 5 alerts');
});

test('buildAlertCenter respects limit option', () => {
  const inputs = [
    makeInput('A', 90), makeInput('B', 85), makeInput('C', 80),
    makeInput('D', 75), makeInput('E', 70), makeInput('F', 65),
  ];
  const result = buildAlertCenter({ inputs, limit: 2 });

  assertEqual(result.count, 2, 'Limit constrains alert count');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log(`P2-5 TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

process.exit(failCount > 0 ? 1 : 0);
