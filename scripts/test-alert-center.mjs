#!/usr/bin/env node

import {
  buildAlertCenter,
  buildAlertFromInputs,
  normalizeAlert,
  filterAlerts,
  rankAlerts,
  buildAlertSummary,
  deduplicateAlerts,
  ALERT_TYPES,
  ALERT_STATUSES,
  SEVERITY_LEVELS,
  PRIORITY_ORDER,
  n,
  clamp,
  round,
} from '../lib/alert-center.js';

const tests = { passed: 0, failed: 0, errors: [] };

function assert(condition, message) {
  if (condition) {
    tests.passed++;
  } else {
    tests.failed++;
    tests.errors.push(message);
  }
}

function assertEqual(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    tests.passed++;
  } else {
    tests.failed++;
    tests.errors.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('='.repeat(60));
console.log('D12 ALERT CENTER TEST SUITE');
console.log('='.repeat(60));

console.log('\n--- Helper Functions Tests ---\n');

assertEqual(n(null), null, 'n(null) returns null');
assertEqual(n(undefined), null, 'n(undefined) returns null');
assertEqual(n(NaN), null, 'n(NaN) returns null');
assertEqual(n(Infinity), null, 'n(Infinity) returns null');
assertEqual(n('123'), 123, 'n(string number) parses correctly');
assertEqual(n(123), 123, 'n(number) returns same number');

assertEqual(clamp(-10), 0, 'clamp negative returns 0');
assertEqual(clamp(150), 100, 'clamp over 100 returns 100');
assertEqual(clamp(50), 50, 'clamp normal returns same');
assertEqual(clamp(Infinity), 100, 'clamp Infinity returns 100');

assertEqual(round(123.456, 2), 123.46, 'round to 2 decimals');
assertEqual(round(null), null, 'round null returns null');
assertEqual(round(NaN), null, 'round NaN returns null');

console.log('\n--- Alert Generation Tests ---\n');

const input1 = [{
  symbol: 'AAPL',
  sources: {
    swingIntelligence: {
      swingScore: 85,
      signal: 'STRONG_BUY',
      directionBias: 'LONG',
      confidence: 85,
      setups: [{ type: 'BREAKOUT', label: 'Breakout Setup' }],
      dataCompleteness: 90,
      risks: [],
      warnings: [],
    },
    opportunityRanking: {
      opportunityScore: 88,
      quality: 'TOP',
      confidence: 90,
      confidenceLevel: 'HIGH',
      warnings: [],
      risks: [],
      dataCompleteness: 90,
    },
    tradePlan: {
      planScore: 82,
      planSignal: 'STRONG_PLAN',
      direction: 'LONG',
      riskReward: 2.5,
      confidence: 85,
    },
  },
}];

const alerts1 = buildAlertFromInputs(input1);

assert(alerts1.length === 1, 'buildAlertFromInputs generates 1 alert for valid input');
assertEqual(alerts1[0]?.symbol, 'AAPL', 'Alert symbol is AAPL');
assert(alerts1[0]?.score >= 80, 'Alert score is high (>= 80)');

console.log('\n--- Null/Empty Input Tests ---\n');

const emptyAlerts = buildAlertFromInputs([]);
assertEqual(emptyAlerts.length, 0, 'Empty inputs generate no alerts');

const nullAlerts = buildAlertFromInputs(null);
assertEqual(nullAlerts.length, 0, 'Null inputs generate no alerts');

const undefinedAlerts = buildAlertFromInputs(undefined);
assertEqual(undefinedAlerts.length, 0, 'Undefined inputs generate no alerts');

console.log('\n--- Malformed Input Tests ---\n');

const malformedInputs = [{ symbol: null }, { symbol: 12345 }, { symbol: '' }];
const malformedAlerts = buildAlertFromInputs(malformedInputs);
assertEqual(malformedAlerts.length, 0, 'Malformed inputs generate no alerts');

const sourceNullInput = [{ symbol: 'TEST', sources: null }];
const sourceNullAlerts = buildAlertFromInputs(sourceNullInput);
assertEqual(sourceNullAlerts.length, 0, 'Null sources generate no alerts');

const sourceEmptyInput = [{ symbol: 'EMPTY', sources: {} }];
const sourceEmptyAlerts = buildAlertFromInputs(sourceEmptyInput);
assertEqual(sourceEmptyAlerts.length, 0, 'Empty sources generate no alerts');

console.log('\n--- NaN/Infinity Tests ---\n');

const nanInputs = [{
  symbol: 'NANTEST',
  sources: {
    swingIntelligence: { swingScore: NaN },
    opportunityRanking: { opportunityScore: Infinity, dataCompleteness: 80 },
  },
}];

const nanAlerts = buildAlertFromInputs(nanInputs);
assertEqual(nanAlerts.length, 0, 'NaN/Infinity inputs are sanitized (no alert generated)');

console.log('\n--- Severity Tests ---\n');

const lowScoreInput = [{
  symbol: 'LOW',
  sources: { opportunityRanking: { opportunityScore: 30, dataCompleteness: 90 } },
}];
const lowAlerts = buildAlertFromInputs(lowScoreInput);
assert(lowAlerts[0]?.severity === 'INFO' || lowAlerts[0]?.severity === 'MEDIUM', 'Low score gets appropriate severity');

const midScoreInput = [{
  symbol: 'MID',
  sources: { opportunityRanking: { opportunityScore: 55, dataCompleteness: 80 } },
}];
const midAlerts = buildAlertFromInputs(midScoreInput);
assert(midAlerts[0]?.severity === 'MEDIUM', 'Mid score gets MEDIUM severity');

const highScoreInput = [{
  symbol: 'HIGH',
  sources: { opportunityRanking: { opportunityScore: 90 } },
}];
const highAlerts = buildAlertFromInputs(highScoreInput);
assertEqual(highAlerts[0]?.severity, 'CRITICAL', 'High score gets CRITICAL severity');

console.log('\n--- Priority Ranking Tests ---\n');

const priorityTest = [{
  symbol: 'P1',
  sources: { opportunityRanking: { opportunityScore: 85 } },
}, {
  symbol: 'P2',
  sources: { opportunityRanking: { opportunityScore: 70 } },
}, {
  symbol: 'P3',
  sources: { opportunityRanking: { opportunityScore: 60 } },
}];

const ranked = rankAlerts(buildAlertFromInputs(priorityTest), 'priority', 'desc');
assertEqual(ranked[0]?.symbol, 'P1', 'Highest score gets highest priority');

console.log('\n--- Deterministic Ranking Test ---\n');

const detTest1 = [{
  symbol: 'DET1',
  sources: { opportunityRanking: { opportunityScore: 85 } },
}];
const detTest2 = [{
  symbol: 'DET1',
  sources: { opportunityRanking: { opportunityScore: 85 } },
}];

const det1 = buildAlertFromInputs(detTest1);
const det2 = buildAlertFromInputs(detTest2);
assertEqual(det1[0]?.id, det2[0]?.id, 'Alert IDs are deterministic');

console.log('\n--- Tie-Break Stability Test ---\n');

const tieInput = [{
  symbol: 'TIE1',
  sources: { opportunityRanking: { opportunityScore: 70 } },
}, {
  symbol: 'TIE2',
  sources: { opportunityRanking: { opportunityScore: 70 } },
}, {
  symbol: 'TIE3',
  sources: { opportunityRanking: { opportunityScore: 70 } },
}];

const tieRanked = rankAlerts(buildAlertFromInputs(tieInput), 'priority', 'desc');
assertEqual(tieRanked[0]?.symbol, 'TIE1', 'Tie-break is stable (alphabetical)');

console.log('\n--- Deduplication Tests ---\n');

const dupInput1 = [{
  symbol: 'DUP',
  sources: { opportunityRanking: { opportunityScore: 85 } },
}];

const dupAlerts1 = buildAlertFromInputs(dupInput1);
const existing = buildAlertFromInputs(dupInput1);
const deduped = deduplicateAlerts(dupAlerts1, existing);
assertEqual(deduped.length, 0, 'Identical alerts are deduplicated');

console.log('\n--- Conflict Detection Tests ---\n');

const conflictSource = {
  swingIntelligence: { signal: 'STRONG_BUY' },
  tradePlan: { warnings: ['CONFLICTING_SIGNALS_DETECTED'] },
};

const conflictAlerts = buildAlertFromInputs([{ symbol: 'CONFLICT', sources: conflictSource, opportunityRanking: { opportunityScore: 70 } }]);
assert(Array.isArray(conflictAlerts[0]?.warnings), 'Warnings array exists');

console.log('\n--- Risk Propagation Tests ---\n');

const riskSource = {
  tradePlan: {
    planScore: 88,
    risks: [{ label: 'SIGNAL_CONFLICT', severity: 'HIGH', description: 'Conflicting signals' }],
  },
  opportunityRanking: { opportunityScore: 80 },
};

const riskAlerts = buildAlertFromInputs([{ symbol: 'RISK', sources: riskSource }]);
assert(riskAlerts[0]?.risks?.length > 0, 'Risks are propagated');
assert(riskAlerts[0]?.risks?.some(r => r.label === 'SIGNAL_CONFLICT'), 'Signal conflict is detected');

console.log('\n--- Data Availability Tests ---\n');

const dataAvailAlerts = buildAlertFromInputs([{
  symbol: 'DATA',
  sources: {
    opportunityRanking: { opportunityScore: 75, quality: 'TOP' },
    swingIntelligence: { swingScore: 70 },
  },
}]);

assertEqual(dataAvailAlerts[0]?.dataAvailability?.swingIntelligence, true, 'Present source shows as available');

console.log('\n--- Provenance Tests ---\n');

const provAlerts = buildAlertFromInputs([{
  symbol: 'PROV',
  sources: { opportunityRanking: { opportunityScore: 80 } },
}]);

assertEqual(typeof provAlerts[0]?.provenance?.sources, 'object', 'Provenance includes sources');

console.log('\n--- API Contract Tests ---\n');

const apiResult = buildAlertCenter({
  inputs: [{
    symbol: 'API',
    sources: { opportunityRanking: { opportunityScore: 82 } },
  }],
  limit: 10,
});

assertEqual(typeof apiResult, 'object', 'buildAlertCenter returns object');
assertEqual(Array.isArray(apiResult.alerts), true, 'Alerts is an array');
assertEqual(typeof apiResult.count, 'number', 'Count is a number');
assertEqual(typeof apiResult.filters, 'object', 'Filters is an object');
assertEqual(typeof apiResult.dataAvailability, 'object', 'Data availability is an object');
assertEqual(typeof apiResult.qualityBreakdown, 'object', 'Quality breakdown is an object');
assertEqual(Array.isArray(apiResult.limitations), true, 'Limitations is an array');
assertEqual(typeof apiResult.disclaimer, 'string', 'Disclaimer is a string');

console.log('\n--- Filter Tests ---\n');

const filterTestData = buildAlertFromInputs([{
  symbol: 'FILT1',
  sources: { opportunityRanking: { opportunityScore: 90, dataCompleteness: 85 } },
}, {
  symbol: 'FILT2',
  sources: { opportunityRanking: { opportunityScore: 30, dataCompleteness: 20 } },
}]);

const symbolFiltered = filterAlerts(filterTestData, { symbols: ['FILT1'] });
assertEqual(symbolFiltered[0]?.symbol, 'FILT1', 'Symbol filter returns correct');

const typeFiltered = filterAlerts([{
  symbol: 'T1',
  sources: { opportunityRanking: { opportunityScore: 80 } },
}], { type: 'OPPORTUNITY' });
assertEqual(typeFiltered[0]?.type, 'OPPORTUNITY', 'Type filter works');

console.log('\n--- Status Handling Tests ---\n');

const statusAlerts = buildAlertFromInputs([{
  symbol: 'STATUS',
  sources: { opportunityRanking: { opportunityScore: 75 } },
}]);

assertEqual(typeof statusAlerts[0]?.status, 'string', 'Status is a string');
assert(Object.values(ALERT_STATUSES).includes(statusAlerts[0]?.status), 'Status is valid');

console.log('\n--- B1-B6 Regression Tests ---\n');

const b1Test = buildAlertFromInputs([{ symbol: 'B1', sources: { pennyIntelligence: { pennyScore: 85 } } }]);
assertEqual(b1Test[0]?.type, 'PENNY', 'B1 generates PENNY alert');

const b4Test = buildAlertFromInputs([{ symbol: 'B4', sources: { swingIntelligence: { swingScore: 75 } } }]);
assertEqual(b4Test[0]?.type, 'SWING', 'B4 generates SWING alert');

console.log('\n--- C7-C10 Regression Tests ---\n');

const c7Input = [{ symbol: 'C7REG', sources: { opportunityRanking: { opportunityScore: 88, quality: 'TOP' } } }];
const c7Alerts = buildAlertFromInputs(c7Input);
assertEqual(c7Alerts[0]?.type, 'OPPORTUNITY', 'C7 generates OPPORTUNITY alert');

const c8Input = [{ symbol: 'C8REG', sources: { tradePlan: { planScore: 82, planSignal: 'STRONG_PLAN' } } }];
const c8Alerts = buildAlertFromInputs(c8Input);
assertEqual(c8Alerts[0]?.type, 'TRADE_PLAN', 'C8 generates TRADE_PLAN alert');

console.log('\n--- Normalization Tests ---\n');

const original = { symbol: 'NORM', sources: { opportunityRanking: { opportunityScore: 90 } } };
const built = buildAlertFromInputs([original]);
const normalized = normalizeAlert(built[0]);
assertEqual(typeof normalized, 'object', 'Normalization returns object');
assertEqual(normalized.id != null, true, 'Normalized alert has ID');

console.log('\n' + '='.repeat(60));
console.log(`TEST RESULTS: ${tests.passed} passed, ${tests.failed} failed`);
console.log('='.repeat(60));

if (tests.errors.length > 0) {
  console.log('\nErrors:');
  tests.errors.forEach(e => console.log(`  - ${e}`));
}

process.exit(tests.failed > 0 ? 1 : 0);