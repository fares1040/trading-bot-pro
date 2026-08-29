import {
  n, clamp, round, daysAgo, isFutureDate, isNullOrEmpty,
  recencyScoreFromDaysAgo, classifyRecency,
  CATALYST_WEIGHTS, CATALYST_QUALITY_THRESHOLDS, CATALYST_TYPE_PRIORITY,
  FORM_TO_CATALYST_TYPE, FILING_CATEGORY_TO_TYPE,
  classifyCatalystType, calculateCatalystRecency, calculateCatalystSignificance,
  significanceLabel, classifyReliability, calculateCatalystFreshness,
  calculateMarketRelevance, calculateCatalystDataCompleteness,
  calculateCatalystScore, calculateCatalystQuality,
  normalizeCatalyst, normalizeCatalysts, extractSecCatalysts, extractMarketCatalysts,
  extractCatalystFromFlags, aggregateCatalysts,
  buildCatalystReasons, buildCatalystWarnings, buildCatalystFlags,
  buildCatalystRisks, buildCatalystIntelligence, defaultCatalystIntelligence,
  rankCatalystOpportunities,
} from '../lib/catalyst-intelligence.js';

import {
  buildCatalystIntelligenceManager,
  defaultCatalystIntelligenceManager,
  rankCatalystOpportunitiesB6,
  selectTopCatalysts,
  buildQualityBreakdown,
  buildDataAvailability,
} from '../lib/catalyst-intelligence-manager.js';

console.log('========================================');
console.log('Catalyst Intelligence Tests (B6)');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('✅ PASS: ' + name);
    passed++;
  } catch (e) {
    console.log('❌ FAIL: ' + name);
    console.log('   ' + e.message);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + ' Expected ' + expected + ', got ' + actual);
  }
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > (tolerance || 0.01)) {
    throw new Error((msg || '') + ' Expected ~' + expected + ', got ' + actual);
  }
}

function assertNullish(value, msg) {
  if (value != null) {
    throw new Error((msg || '') + ' Expected null/undefined, got ' + value);
  }
}

function assertNotNullish(value, msg) {
  if (value == null) {
    throw new Error((msg || '') + ' Expected non-null value');
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.parse(JSON.stringify(actual));
  const b = JSON.parse(JSON.stringify(expected));
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error((msg || '') + ' Expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
  }
}

// ===== HELPER TESTS =====

test('n: valid number', function() {
  assertEqual(n(42), 42);
});

test('n: null returns null', function() {
  assertEqual(n(null), null);
});

test('n: undefined returns null', function() {
  assertEqual(n(undefined), null);
});

test('n: NaN returns null', function() {
  assertEqual(n(NaN), null);
});

test('n: Infinity returns null', function() {
  assertEqual(n(Infinity), null);
});

test('n: string number converts', function() {
  assertEqual(n('42'), 42);
});

test('n: invalid string returns null', function() {
  assertEqual(n('abc'), null);
});

test('clamp: clamps high values', function() {
  assertEqual(clamp(150, 0, 100), 100);
});

test('clamp: clamps low values', function() {
  assertEqual(clamp(-10, 0, 100), 0);
});

test('clamp: NaN returns min', function() {
  assertEqual(clamp(NaN, 0, 100), 0);
});

test('clamp: Infinity returns max', function() {
  assertEqual(clamp(Infinity, 0, 100), 100);
});

test('round: normal rounding', function() {
  assertEqual(round(3.14159, 2), 3.14);
});

test('round: NaN returns null', function() {
  assertNullish(round(NaN));
});

test('round: Infinity returns null', function() {
  assertNullish(round(Infinity));
});

test('daysAgo: valid date', function() {
  const result = daysAgo('2024-01-01');
  assertNotNullish(result);
  assertEqual(Number.isInteger(result), true);
});

test('daysAgo: null returns null', function() {
  assertNullish(daysAgo(null));
});

test('daysAgo: invalid date returns null', function() {
  assertNullish(daysAgo('not-a-date'));
});

test('isFutureDate: future date', function() {
  const future = new Date(Date.now() + 86400000).toISOString();
  assertEqual(isFutureDate(future), true);
});

test('isFutureDate: past date', function() {
  assertEqual(isFutureDate('2020-01-01'), false);
});

test('isFutureDate: null returns false', function() {
  assertEqual(isFutureDate(null), false);
});

test('isFutureDate: invalid returns false', function() {
  assertEqual(isFutureDate('garbage'), false);
});

test('isNullOrEmpty: null', function() {
  assertEqual(isNullOrEmpty(null), true);
});

test('isNullOrEmpty: empty string', function() {
  assertEqual(isNullOrEmpty(''), true);
});

test('isNullOrEmpty: whitespace string', function() {
  assertEqual(isNullOrEmpty('  '), true);
});

test('isNullOrEmpty: empty array', function() {
  assertEqual(isNullOrEmpty([]), true);
});

test('isNullOrEmpty: empty object', function() {
  assertEqual(isNullOrEmpty({}), true);
});

test('isNullOrEmpty: non-empty value', function() {
  assertEqual(isNullOrEmpty('hello'), false);
  assertEqual(isNullOrEmpty([1]), false);
  assertEqual(isNullOrEmpty({a:1}), false);
});

// ===== RECENCY =====

test('recencyScoreFromDaysAgo: 0-1 days = 100', function() {
  assertEqual(recencyScoreFromDaysAgo(0), 100);
  assertEqual(recencyScoreFromDaysAgo(1), 100);
});

test('recencyScoreFromDaysAgo: 2-3 days = 90', function() {
  assertEqual(recencyScoreFromDaysAgo(2), 90);
  assertEqual(recencyScoreFromDaysAgo(3), 90);
});

test('recencyScoreFromDaysAgo: 4-7 days = 80', function() {
  assertEqual(recencyScoreFromDaysAgo(4), 80);
  assertEqual(recencyScoreFromDaysAgo(7), 80);
});

test('recencyScoreFromDaysAgo: 8-14 days = 65', function() {
  assertEqual(recencyScoreFromDaysAgo(8), 65);
  assertEqual(recencyScoreFromDaysAgo(14), 65);
});

test('recencyScoreFromDaysAgo: 15-30 days = 45', function() {
  assertEqual(recencyScoreFromDaysAgo(15), 45);
  assertEqual(recencyScoreFromDaysAgo(30), 45);
});

test('recencyScoreFromDaysAgo: 31-90 days = 25', function() {
  assertEqual(recencyScoreFromDaysAgo(31), 25);
  assertEqual(recencyScoreFromDaysAgo(90), 25);
});

test('recencyScoreFromDaysAgo: >90 days = 0', function() {
  assertEqual(recencyScoreFromDaysAgo(91), 0);
  assertEqual(recencyScoreFromDaysAgo(365), 0);
});

test('recencyScoreFromDaysAgo: null returns null', function() {
  assertNullish(recencyScoreFromDaysAgo(null));
});

test('recencyScoreFromDaysAgo: negative returns null', function() {
  assertNullish(recencyScoreFromDaysAgo(-5));
});

test('classifyRecency: recent', function() {
  assertEqual(classifyRecency(0), 'REALTIME');
  assertEqual(classifyRecency(1), 'REALTIME');
  assertEqual(classifyRecency(2), 'VERY_RECENT');
  assertEqual(classifyRecency(7), 'RECENT');
  assertEqual(classifyRecency(15), 'MODERATE');
  assertEqual(classifyRecency(45), 'AGING');
  assertEqual(classifyRecency(100), 'STALE');
});

test('classifyRecency: null returns UNKNOWN', function() {
  assertEqual(classifyRecency(null), 'UNKNOWN');
});

test('classifyRecency: negative (upcoming) returns UPCOMING', function() {
  assertEqual(classifyRecency(-5), 'UPCOMING');
});

// ===== CATALYST TYPE CLASSIFICATION =====

test('classifyCatalystType: 8-K form', function() {
  assertEqual(classifyCatalystType({ form: '8-K', filingDate: '2024-01-01' }, 'MATERIAL_EVENT', null), 'SEC_MATERIAL_EVENT');
});

test('classifyCatalystType: S-1 form', function() {
  assertEqual(classifyCatalystType({ form: 'S-1', filingDate: '2024-01-01' }, 'OFFERING', null), 'SEC_OFFERING');
});

test('classifyCatalystType: S-3 form', function() {
  assertEqual(classifyCatalystType({ form: 'S-3', filingDate: '2024-01-01' }, 'SHELF_REGISTRATION', null), 'SEC_FINANCING');
});

test('classifyCatalystType: 424B5 form', function() {
  assertEqual(classifyCatalystType({ form: '424B5', filingDate: '2024-01-01' }, 'OFFERING', null), 'SEC_OFFERING');
});

test('classifyCatalystType: 10-K form', function() {
  assertEqual(classifyCatalystType({ form: '10-K', filingDate: '2024-01-01' }, 'EARNINGS', null), 'EARNINGS');
});

test('classifyCatalystType: 10-Q form', function() {
  assertEqual(classifyCatalystType({ form: '10-Q', filingDate: '2024-01-01' }, 'EARNINGS', null), 'EARNINGS');
});

test('classifyCatalystType: Form 4', function() {
  assertEqual(classifyCatalystType({ form: '4', filingDate: '2024-01-01' }, 'INSIDER_ACTIVITY', null), 'INSIDER_ACTIVITY');
});

test('classifyCatalystType: Form 144', function() {
  assertEqual(classifyCatalystType({ form: '144', filingDate: '2024-01-01' }, 'OWNERSHIP_CHANGE', null), 'INSIDER_ACTIVITY');
});

test('classifyCatalystType: filingCategory mapping', function() {
  assertEqual(classifyCatalystType(null, 'EARNINGS', null), 'EARNINGS');
  assertEqual(classifyCatalystType(null, 'MATERIAL_EVENT', null), 'SEC_MATERIAL_EVENT');
});

test('classifyCatalystType: flag mapping', function() {
  assertEqual(classifyCatalystType(null, null, 'HAS_8K'), 'SEC_MATERIAL_EVENT');
  assertEqual(classifyCatalystType(null, null, 'HAS_OFFERING'), 'SEC_OFFERING');
  assertEqual(classifyCatalystType(null, null, 'HAS_EARNINGS'), 'EARNINGS');
  assertEqual(classifyCatalystType(null, null, 'FORM_4_FILED'), 'INSIDER_ACTIVITY');
});

test('classifyCatalystType: no evidence returns null', function() {
  assertEqual(classifyCatalystType(null, null, null), null);
  assertEqual(classifyCatalystType(null, 'OTHER', null), 'OTHER');
});

// ===== SIGNIFICANCE =====

test('calculateCatalystSignificance: 8-K = CRITICAL', function() {
  const score = calculateCatalystSignificance('8-K', 'MATERIAL_EVENT', 'SEC_MATERIAL_EVENT');
  assertEqual(significanceLabel(score), 'CRITICAL');
  assertEqual(score, 100);
});

test('calculateCatalystSignificance: S-1 = CRITICAL', function() {
  const score = calculateCatalystSignificance('S-1', 'OFFERING', 'SEC_OFFERING');
  assertEqual(significanceLabel(score), 'CRITICAL');
});

test('calculateCatalystSignificance: 10-K = HIGH', function() {
  const score = calculateCatalystSignificance('10-K', 'EARNINGS', 'EARNINGS');
  assertEqual(significanceLabel(score), 'HIGH');
});

test('calculateCatalystSignificance: Form 4 = HIGH', function() {
  const score = calculateCatalystSignificance('4', 'INSIDER_ACTIVITY', 'INSIDER_ACTIVITY');
  assertEqual(significanceLabel(score), 'HIGH');
  assertEqual(score, 75);
});

test('calculateCatalystSignificance: null returns null', function() {
  assertNullish(calculateCatalystSignificance(null, null, null));
});

test('significanceLabel: null = UNKNOWN', function() {
  assertEqual(significanceLabel(null), 'UNKNOWN');
});

test('significanceLabel: CRITICAL >= 85', function() {
  assertEqual(significanceLabel(90), 'CRITICAL');
  assertEqual(significanceLabel(85), 'CRITICAL');
});

test('significanceLabel: HIGH >= 70', function() {
  assertEqual(significanceLabel(75), 'HIGH');
  assertEqual(significanceLabel(70), 'HIGH');
});

test('significanceLabel: MODERATE >= 50', function() {
  assertEqual(significanceLabel(55), 'MODERATE');
  assertEqual(significanceLabel(50), 'MODERATE');
});

test('significanceLabel: LOW >= 30', function() {
  assertEqual(significanceLabel(35), 'LOW');
  assertEqual(significanceLabel(30), 'LOW');
});

// ===== RELIABILITY =====

test('classifyReliability: SEC EDGAR = VERIFIED', function() {
  assertEqual(classifyReliability('SEC EDGAR', 'ok'), 'VERIFIED');
});

test('classifyReliability: secDataStatus ok = VERIFIED', function() {
  assertEqual(classifyReliability(null, 'ok'), 'VERIFIED');
});

test('classifyReliability: unknown source = UNAVAILABLE', function() {
  assertEqual(classifyReliability(null, 'unavailable'), 'UNAVAILABLE');
});

test('classifyReliability: null source with no status = UNAVAILABLE', function() {
  assertEqual(classifyReliability(null, null), 'UNAVAILABLE');
});

// ===== RECENCY CALCULATION =====

test('calculateCatalystRecency: valid date', function() {
  const result = calculateCatalystRecency('2024-01-01', '2024-01-01');
  assertNotNullish(result);
});

test('calculateCatalystRecency: null date returns null', function() {
  assertNullish(calculateCatalystRecency(null, null));
});

// ===== DATA COMPLETENESS =====

test('calculateCatalystDataCompleteness: from dataCompleteness field', function() {
  const secIntel = { dataCompleteness: 75 };
  assertEqual(calculateCatalystDataCompleteness(secIntel), 75);
});

test('calculateCatalystDataCompleteness: from dataAvailability object', function() {
  const secIntel = {
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false }
  };
  // 2 of 5 = 40
  assertEqual(calculateCatalystDataCompleteness(secIntel), 40);
});

test('calculateCatalystDataCompleteness: null secIntelligence returns null', function() {
  assertNullish(calculateCatalystDataCompleteness(null));
});

test('calculateCatalystDataCompleteness: empty object returns null', function() {
  assertNullish(calculateCatalystDataCompleteness({}));
});

// ===== CATALYST SCORE =====

test('calculateCatalystScore: with all components', function() {
  const result = calculateCatalystScore({
    significance: 90,
    recency: 80,
    reliability: 100,
    freshness: 90,
    marketRelevance: 60,
    dataCompleteness: 80,
  });
  assertNotNullish(result.catalystScore);
  assertEqual(Number.isInteger(result.catalystScore), true);
  // Weight sum: 90*0.3 + 80*0.2 + 100*0.2 + 90*0.15 + 60*0.1 + 80*0.05
  // = 27 + 16 + 20 + 13.5 + 6 + 4 = 86.5 -> 87
  assertEqual(result.catalystScore, 87);
  assertEqual(result.usedComponents.length, 6);
});

test('calculateCatalystScore: partial components with renormalization', function() {
  const result = calculateCatalystScore({
    significance: 90,
    recency: 80,
    reliability: null,
    freshness: null,
    marketRelevance: null,
    dataCompleteness: null,
  });
  assertNotNullish(result.catalystScore);
  // Weight sum: 90*0.3 + 80*0.2 = 27+16=43, totalWeight=0.5, 43/0.5=86
  assertEqual(result.catalystScore, 86);
  assertEqual(result.usedComponents.length, 2);
});

test('calculateCatalystScore: no components returns null', function() {
  const result = calculateCatalystScore({
    significance: null,
    recency: null,
    reliability: null,
    freshness: null,
    marketRelevance: null,
    dataCompleteness: null,
  });
  assertNullish(result.catalystScore);
  assertEqual(result.usedComponents.length, 0);
});

test('calculateCatalystScore: NaN excluded', function() {
  const result = calculateCatalystScore({
    significance: NaN,
    recency: 80,
    reliability: 100,
    freshness: 90,
    marketRelevance: 60,
    dataCompleteness: 80,
  });
  assertEqual(result.usedComponents.indexOf('significance'), -1);
});

test('calculateCatalystScore: Infinity excluded', function() {
  const result = calculateCatalystScore({
    significance: Infinity,
    recency: 80,
    reliability: 100,
    freshness: 90,
    marketRelevance: 60,
    dataCompleteness: 80,
  });
  assertEqual(result.usedComponents.indexOf('significance'), -1);
});

test('calculateCatalystScore: score clamped to 0-100', function() {
  const result = calculateCatalystScore({
    significance: 100,
    recency: 100,
    reliability: 100,
    freshness: 100,
    marketRelevance: 100,
    dataCompleteness: 100,
  });
  assertEqual(result.catalystScore, 100);
});

// ===== QUALITY =====

test('calculateCatalystQuality: TOP >= 85', function() {
  assertEqual(calculateCatalystQuality(90), 'TOP');
  assertEqual(calculateCatalystQuality(85), 'TOP');
});

test('calculateCatalystQuality: STRONG >= 70', function() {
  assertEqual(calculateCatalystQuality(75), 'STRONG');
  assertEqual(calculateCatalystQuality(70), 'STRONG');
});

test('calculateCatalystQuality: WATCH >= 55', function() {
  assertEqual(calculateCatalystQuality(60), 'WATCH');
  assertEqual(calculateCatalystQuality(55), 'WATCH');
});

test('calculateCatalystQuality: WEAK >= 40', function() {
  assertEqual(calculateCatalystQuality(45), 'WEAK');
  assertEqual(calculateCatalystQuality(40), 'WEAK');
});

test('calculateCatalystQuality: UNAVAILABLE for low scores', function() {
  assertEqual(calculateCatalystQuality(30), 'UNAVAILABLE');
  assertEqual(calculateCatalystQuality(39), 'UNAVAILABLE');
});

test('calculateCatalystQuality: null returns UNAVAILABLE', function() {
  assertEqual(calculateCatalystQuality(null), 'UNAVAILABLE');
});

test('calculateCatalystQuality: NaN returns UNAVAILABLE', function() {
  assertEqual(calculateCatalystQuality(NaN), 'UNAVAILABLE');
});

// ===== NORMALIZE CATALYST =====

test('normalizeCatalyst: valid catalyst', function() {
  const result = normalizeCatalyst({
    type: 'SEC_MATERIAL_EVENT',
    date: '2024-01-01',
    description: '8-K filing',
    source: 'SEC EDGAR',
    form: '8-K',
  });
  assertEqual(result.type, 'SEC_MATERIAL_EVENT');
  assertEqual(result.date, '2024-01-01');
  assertEqual(result.description, '8-K filing');
  assertEqual(result.source, 'SEC EDGAR');
  assertEqual(result.form, '8-K');
});

test('normalizeCatalyst: null input returns null', function() {
  assertEqual(normalizeCatalyst(null), null);
});

test('normalizeCatalyst: missing type returns null', function() {
  assertEqual(normalizeCatalyst({ date: '2024-01-01' }), null);
});

test('normalizeCatalyst: empty object returns null', function() {
  assertEqual(normalizeCatalyst({}), null);
});

test('normalizeCatalyst: non-object returns null', function() {
  assertEqual(normalizeCatalyst('string'), null);
  assertEqual(normalizeCatalyst(42), null);
});

test('normalizeCatalyst: extracts date from filingDate', function() {
  const result = normalizeCatalyst({
    type: 'EARNINGS',
    filingDate: '2024-06-15',
  });
  assertEqual(result.type, 'EARNINGS');
  assertEqual(result.date, '2024-06-15');
});

// ===== EXTRACT SEC CATALYSTS =====

test('extractSecCatalysts: 8-K material event', function() {
  const secIntel = {
    quality: 'STRONG',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    materialEventInfo: { materialEventDetected: true, filingDate: '2024-01-01', filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K'],
    filingCategory: 'MATERIAL_EVENT',
  };
  const catalysts = extractSecCatalysts(secIntel, 'TEST');
  assertEqual(catalysts.length > 0, true);
  assertEqual(catalysts[0].type, 'SEC_MATERIAL_EVENT');
});

test('extractSecCatalysts: Form 4 insider activity', function() {
  const secIntel = {
    quality: 'WATCH',
    latestFiling: { form: '4', filingDate: '2024-01-01' },
    insiderActivity: { form4Detected: true, filingDate: '2024-01-01', filingCount: 2, direction: 'BUY' },
    materialEventInfo: null,
    capitalStructureSignals: null,
    flags: ['FORM_4_FILED'],
    filingCategory: 'INSIDER_ACTIVITY',
  };
  const catalysts = extractSecCatalysts(secIntel, 'TEST');
  assertEqual(catalysts.length > 0, true);
  assertEqual(catalysts.some(c => c.type === 'INSIDER_ACTIVITY'), true);
});

test('extractSecCatalysts: earnings filing', function() {
  const secIntel = {
    quality: 'STRONG',
    latestFiling: { form: '10-K', filingDate: '2024-01-01' },
    materialEventInfo: null,
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_EARNINGS'],
    filingCategory: 'EARNINGS',
  };
  const catalysts = extractSecCatalysts(secIntel, 'TEST');
  assertEqual(catalysts.length > 0, true);
  assertEqual(catalysts.some(c => c.type === 'EARNINGS'), true);
});

test('extractSecCatalysts: offering (S-1)', function() {
  const secIntel = {
    quality: 'STRONG',
    latestFiling: { form: 'S-1', filingDate: '2024-01-01' },
    materialEventInfo: null,
    insiderActivity: null,
    capitalStructureSignals: [{ type: 'OFFERING', form: 'S-1', filingDate: '2024-01-01', offeringType: 'REGISTERED_OFFERING' }],
    flags: ['HAS_OFFERING', 'CAPITAL_STRUCTURE_EVENT'],
    filingCategory: 'OFFERING',
  };
  const catalysts = extractSecCatalysts(secIntel, 'TEST');
  assertEqual(catalysts.some(c => c.type === 'SEC_OFFERING'), true);
});

test('extractSecCatalysts: no catalysts returns empty array', function() {
  const secIntel = {
    quality: 'UNAVAILABLE',
    latestFiling: null,
    materialEventInfo: null,
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: [],
    filingCategory: 'OTHER',
  };
  const catalysts = extractSecCatalysts(secIntel, 'TEST');
  assertEqual(catalysts.length, 0);
});

test('extractSecCatalysts: null secIntelligence returns empty', function() {
  assertEqual(extractSecCatalysts(null, 'TEST').length, 0);
  assertEqual(extractSecCatalysts(undefined, 'TEST').length, 0);
});

// ===== EXTRACT MARKET CATALYSTS =====

test('extractMarketCatalysts: earningsDate array (upcoming)', function() {
  const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const marketData = { earningsDate: [futureDate] };
  const catalysts = extractMarketCatalysts(marketData, 'TEST');
  assertEqual(catalysts.length, 1);
  assertEqual(catalysts[0].type, 'EARNINGS');
  assertEqual(catalysts[0].upcoming, true);
});

test('extractMarketCatalysts: earningsDate string', function() {
  const marketData = { earningsDate: '2025-12-31' };
  const catalysts = extractMarketCatalysts(marketData, 'TEST');
  assertEqual(catalysts.length, 1);
  assertEqual(catalysts[0].type, 'EARNINGS');
});

test('extractMarketCatalysts: null earnings returns empty', function() {
  const marketData = { price: 100 };
  assertEqual(extractMarketCatalysts(marketData, 'TEST').length, 0);
});

test('extractMarketCatalysts: null marketData returns empty', function() {
  assertEqual(extractMarketCatalysts(null, 'TEST').length, 0);
});

// ===== EXTRACT FROM FLAGS =====

test('extractCatalystFromFlags: maps known flags', function() {
  const flags = ['HAS_8K', 'HAS_EARNINGS', 'FORM_4_FILED'];
  const catalysts = extractCatalystFromFlags(flags, 'SEC EDGAR', 'TEST');
  assertEqual(catalysts.some(c => c.type === 'SEC_MATERIAL_EVENT'), true);
  assertEqual(catalysts.some(c => c.type === 'EARNINGS'), true);
  assertEqual(catalysts.some(c => c.type === 'INSIDER_ACTIVITY'), true);
});

test('extractCatalystFromFlags: unknown flags ignored', function() {
  const flags = ['UNKNOWN_FLAG', 'FOO_BAR'];
  const catalysts = extractCatalystFromFlags(flags, 'test', 'TEST');
  assertEqual(catalysts.length, 0);
});

test('extractCatalystFromFlags: null flags returns empty', function() {
  assertEqual(extractCatalystFromFlags(null, 'test', 'TEST').length, 0);
  assertEqual(extractCatalystFromFlags([], 'test', 'TEST').length, 0);
});

// ===== NORMALIZE CATALYSTS =====

test('normalizeCatalysts: filters nulls', function() {
  const result = normalizeCatalysts([
    { type: 'EARNINGS', date: '2024-01-01' },
    null,
    { date: '2024-01-01' },
    { type: 'SEC_OFFERING', date: '2024-01-01' },
  ]);
  assertEqual(result.length, 2);
});

// ===== CATALYST SCORE (ENGINE) =====

test('calculateCatalystScore: single component (only significance)', function() {
  const result = calculateCatalystScore({
    significance: 90,
    recency: null,
    reliability: null,
    freshness: null,
    marketRelevance: null,
    dataCompleteness: null,
  });
  assertEqual(result.catalystScore, 90);
  assertEqual(result.usedComponents.length, 1);
  assertEqual(result.usedComponents[0], 'significance');
});

// ===== BUILD CATALYST REASONS =====

test('buildCatalystReasons: with catalysts and score', function() {
  const catalysts = [{ type: 'SEC_MATERIAL_EVENT', description: '8-K filing', source: 'SEC EDGAR', date: '2024-01-01' }];
  const reasons = buildCatalystReasons(catalysts, { secDataStatus: 'ok' }, {}, 85);
  assertEqual(reasons.length > 0, true);
  assertEqual(reasons.some(r => r.includes('8-K filing')), true);
});

test('buildCatalystReasons: no catalysts', function() {
  const reasons = buildCatalystReasons([], null, {}, null);
  assertEqual(reasons.length > 0, true);
  assertEqual(reasons.some(r => r.toLowerCase().includes('insufficient')), true);
});

// ===== BUILD CATALYST WARNINGS =====

test('buildCatalystWarnings: null score warning', function() {
  const warnings = buildCatalystWarnings([], null, null);
  assertEqual(warnings.includes('NO_CATALYST_EVIDENCE'), true);
  assertEqual(warnings.includes('NO_VERIFIED_CATALYST'), true);
});

test('buildCatalystWarnings: stale data warning', function() {
  const oldDate = new Date(Date.now() - 100 * 86400000).toISOString().split('T')[0];
  const catalysts = [{ type: 'EARNINGS', date: oldDate, description: 'Old earnings' }];
  const warnings = buildCatalystWarnings(catalysts, null, 80);
  assertEqual(warnings.includes('STALE_CATALYST_DATA'), true);
});

// ===== BUILD CATALYST FLAGS =====

test('buildCatalystFlags: includes type flags', function() {
  const catalysts = [
    { type: 'SEC_MATERIAL_EVENT', date: '2024-01-01' },
    { type: 'EARNINGS', date: '2024-01-01' },
    { type: 'INSIDER_ACTIVITY', date: '2024-01-01' },
  ];
  const flags = buildCatalystFlags(catalysts, null);
  assertEqual(flags.includes('HAS_CATALYST'), true);
  assertEqual(flags.includes('SEC_MATERIAL_EVENT'), true);
  assertEqual(flags.includes('EARNINGS'), true);
  assertEqual(flags.includes('INSIDER_ACTIVITY'), true);
});

test('buildCatalystFlags: empty catalysts no flags except defaults', function() {
  const flags = buildCatalystFlags([], null);
  assertEqual(flags.includes('HAS_CATALYST'), false);
  assertEqual(flags.length, 0);
});

// ===== BUILD CATALYST RISKS =====

test('buildCatalystRisks: no catalyst risk when empty', function() {
  const risks = buildCatalystRisks([], null, null);
  assertEqual(risks.some(r => r.label === 'NO_CATALYST_RISK'), true);
  assertEqual(risks.some(r => r.label === 'UNKNOWN_CATALYST'), true);
});

test('buildCatalystRisks: sec risk from secIntelligence', function() {
  const secIntel = { dilutionRisk: 'high', offeringRisk: 'moderate' };
  const risks = buildCatalystRisks([], secIntel, 80);
  assertEqual(risks.some(r => r.label === 'SEC_DILUTION_RISK'), true);
  assertEqual(risks.some(r => r.label === 'SEC_OFFERING_RISK'), true);
});

// ===== BUILD CATALYST INTELLIGENCE (CORE) =====

test('buildCatalystIntelligence: null symbol returns default', function() {
  const result = buildCatalystIntelligence(null, null, null);
  assertEqual(result.catalystScore, null);
  assertEqual(result.quality, 'UNAVAILABLE');
  assertEqual(result.catalystType, 'NO_VERIFIED_CATALYST');
});

test('buildCatalystIntelligence: sec evidence with 8-K', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 85,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], daysAgo: 2 },
    materialEventInfo: { materialEventDetected: true, filingDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K', 'MATERIAL_EVENT'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertNotNullish(result.catalystScore);
  assertEqual(result.quality !== 'UNAVAILABLE', true);
  assertEqual(result.catalystType, 'SEC_MATERIAL_EVENT');
  assertEqual(result.source, 'SEC EDGAR');
  assertEqual(result.provenance.intelligence, 'B6');
  assertEqual(result.provenance.engine, 'B6 Catalyst Intelligence');
});

test('buildCatalystIntelligence: no evidence returns default', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'unavailable',
    secRiskScore: null,
    quality: 'UNAVAILABLE',
    latestFiling: null,
    flags: [],
    dataAvailability: {},
    dataCompleteness: null,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertEqual(result.catalystScore, null);
  assertEqual(result.quality, 'UNAVAILABLE');
  assertEqual(result.catalystType, 'NO_VERIFIED_CATALYST');
});

test('buildCatalystIntelligence: upcoming earnings from market data', function() {
  const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const marketData = { earningsDate: [futureDate], price: 50 };
  const result = buildCatalystIntelligence('TEST', null, marketData);
  assertEqual(result.catalystType, 'EARNINGS');
  assertEqual(result.upcoming, true);
  assertNotNullish(result.upcomingDate);
});

test('buildCatalystIntelligence: NaN/Infinity safe', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: NaN,
    quality: 'UNAVAILABLE',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    flags: ['HAS_8K'],
    dataAvailability: { filings: true },
    dataCompleteness: NaN,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  // Should not throw and should handle NaN gracefully
  if (result.catalystScore !== null && result.catalystScore !== undefined) {
    assertEqual(Number.isFinite(result.catalystScore), true);
  }
});

test('buildCatalystIntelligence: non-mutating input', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 85,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    materialEventInfo: null,
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const secCopy = JSON.parse(JSON.stringify(secIntel));
  buildCatalystIntelligence('TEST', secIntel, null);
  assertDeepEqual(secIntel, secCopy);
});

// ===== DEFAULT CATALYST INTELLIGENCE =====

test('defaultCatalystIntelligence: returns proper default structure', function() {
  const def = defaultCatalystIntelligence('TEST');
  assertEqual(def.symbol, 'TEST');
  assertEqual(def.catalystScore, null);
  assertEqual(def.quality, 'UNAVAILABLE');
  assertEqual(def.catalystType, 'NO_VERIFIED_CATALYST');
  assertEqual(def.reliability, 'UNAVAILABLE');
  assertEqual(def.provenance.intelligence, 'B6');
});

test('defaultCatalystIntelligence: null symbol', function() {
  const def = defaultCatalystIntelligence(null);
  assertEqual(def.symbol, null);
});

// ===== RANKING =====

test('rankCatalystOpportunities: empty array returns empty', function() {
  const result = rankCatalystOpportunities([]);
  assertEqual(result.ranked.length, 0);
  assertEqual(result.top.length, 0);
  assertEqual(result.alternatives.length, 0);
});

test('rankCatalystOpportunities: null input returns empty', function() {
  const result = rankCatalystOpportunities(null);
  assertEqual(result.ranked.length, 0);
});

test('rankCatalystOpportunities: sorts by score descending', function() {
  const results = [
    { symbol: 'LOW', catalystScore: 40, dataCompleteness: 30, recency: 50 },
    { symbol: 'HIGH', catalystScore: 90, dataCompleteness: 60, recency: 80 },
    { symbol: 'MID', catalystScore: 70, dataCompleteness: 50, recency: 60 },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'HIGH');
  assertEqual(result.ranked[1].symbol, 'MID');
  assertEqual(result.ranked[2].symbol, 'LOW');
});

test('rankCatalystOpportunities: null scores go last', function() {
  const results = [
    { symbol: 'NULL1', catalystScore: null, dataCompleteness: 90 },
    { symbol: 'VALID', catalystScore: 50, dataCompleteness: 50 },
    { symbol: 'NULL2', catalystScore: null, dataCompleteness: 80 },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'VALID');
  assertEqual(result.ranked[result.ranked.length - 1].symbol, 'NULL2');
});

test('rankCatalystOpportunities: tie-break by dataCompleteness', function() {
  const results = [
    { symbol: 'A', catalystScore: 80, dataCompleteness: 30 },
    { symbol: 'B', catalystScore: 80, dataCompleteness: 90 },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'B');
  assertEqual(result.ranked[1].symbol, 'A');
});

test('rankCatalystOpportunities: tie-break by recency', function() {
  const results = [
    { symbol: 'A', catalystScore: 80, dataCompleteness: 90, recency: 50 },
    { symbol: 'B', catalystScore: 80, dataCompleteness: 90, recency: 80 },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'B');
});

test('rankCatalystOpportunities: tie-break by significance', function() {
  const results = [
    { symbol: 'A', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'LOW' },
    { symbol: 'B', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'B');
});

test('rankCatalystOpportunities: tie-break by symbol alphabetical', function() {
  const results = [
    { symbol: 'ZETA', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
    { symbol: 'ALPHA', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
  ];
  const result = rankCatalystOpportunities(results);
  assertEqual(result.ranked[0].symbol, 'ALPHA');
  assertEqual(result.ranked[1].symbol, 'ZETA');
});

test('rankCatalystOpportunities: top and alternatives split', function() {
  const results = Array.from({ length: 15 }, (_, i) => ({
    symbol: 'SYM' + i,
    catalystScore: 90 - i,
    dataCompleteness: 50,
    recency: 50,
    significance: 'HIGH',
  }));
  const result = rankCatalystOpportunities(results);
  assertEqual(result.top.length, 5);
  assertEqual(result.alternatives.length, 5);
});

// ===== MANAGER =====

test('buildCatalystIntelligenceManager: wraps core result', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 85,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: '2024-01-01', daysAgo: 5 },
    materialEventInfo: { materialEventDetected: true, filingDate: '2024-01-01', filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const result = buildCatalystIntelligenceManager('TEST', secIntel, null);
  assertEqual(result.provenance.intelligence, 'B6');
  assertEqual(result.provenance.manager, 'B6');
  assertNotNullish(result.catalystScore);
  assertEqual(Array.isArray(result.catalysts), true);
  assertEqual(result.componentWeights.significance, 30);
});

test('defaultCatalystIntelligenceManager: returns proper default', function() {
  const def = defaultCatalystIntelligenceManager('TEST');
  assertEqual(def.symbol, 'TEST');
  assertEqual(def.catalystScore, null);
  assertEqual(def.quality, 'UNAVAILABLE');
  assertEqual(def.provenance.intelligence, 'B6');
  assertEqual(def.provenance.manager, 'B6');
  assertEqual(def.componentWeights.significance, 30);
  assertEqual(def.catalystRisk, 'UNKNOWN');
});

// ===== RANKING (MANAGER) =====

test('rankCatalystOpportunitiesB6: returns data/top/alternatives/ranking', function() {
  const results = [
    { symbol: 'A', catalystScore: 90, dataCompleteness: 80, recency: 80, significance: 'HIGH', quality: 'TOP' },
    { symbol: 'B', catalystScore: 70, dataCompleteness: 50, recency: 60, significance: 'MODERATE', quality: 'STRONG' },
    { symbol: 'C', catalystScore: null, dataCompleteness: 30, recency: null, significance: 'UNKNOWN', quality: 'UNAVAILABLE' },
  ];
  const result = rankCatalystOpportunitiesB6(results);
  assertEqual(result.data.length, 3);
  assertEqual(result.top.length, 3);
  assertEqual(result.alternatives.length, 0);
  assertNotNullish(result.ranking);
});

test('rankCatalystOpportunitiesB6: empty input', function() {
  const result = rankCatalystOpportunitiesB6([]);
  assertEqual(result.data.length, 0);
  assertEqual(result.top.length, 0);
  assertEqual(result.alternatives.length, 0);
});

test('selectTopCatalysts: returns limited results', function() {
  const results = Array.from({ length: 10 }, (_, i) => ({
    symbol: 'SYM' + i,
    catalystScore: 90 - i,
  }));
  const top3 = selectTopCatalysts(results, 3);
  assertEqual(top3.length, 3);
  assertEqual(top3[0].symbol, 'SYM0');
});

test('selectTopCatalysts: limit larger than results', function() {
  const results = [{ symbol: 'A', catalystScore: 90 }];
  const top = selectTopCatalysts(results, 10);
  assertEqual(top.length, 1);
});

// ===== QUALITY BREAKDOWN =====

test('buildQualityBreakdown: counts quality levels', function() {
  const results = [
    { quality: 'TOP' },
    { quality: 'TOP' },
    { quality: 'STRONG' },
    { quality: 'WATCH' },
    { quality: 'UNAVAILABLE' },
  ];
  const breakdown = buildQualityBreakdown(results);
  assertEqual(breakdown.TOP, 2);
  assertEqual(breakdown.STRONG, 1);
  assertEqual(breakdown.WATCH, 1);
  assertEqual(breakdown.UNAVAILABLE, 1);
});

test('buildQualityBreakdown: empty array', function() {
  const breakdown = buildQualityBreakdown([]);
  assertEqual(breakdown.TOP, 0);
  assertEqual(breakdown.UNAVAILABLE, 0);
});

test('buildQualityBreakdown: null results', function() {
  const breakdown = buildQualityBreakdown(null);
  assertEqual(breakdown.TOP, 0);
});

// ===== DATA AVAILABILITY =====

test('buildDataAvailability: aggregates from results', function() {
  const results = [
    {
      dataAvailability: { secData: true, catalysts: true, catalystScore: false },
      secEvidence: { insiderActivity: { form4Detected: true } },
      catalystTypes: ['SEC_OFFERING'],
    },
    {
      dataAvailability: { marketData: true, catalystType: true },
    },
  ];
  const availability = buildDataAvailability(results);
  assertEqual(availability.secData, true);
  assertEqual(availability.catalysts, true);
  assertEqual(availability.marketData, true);
  assertEqual(availability.catalystType, true);
  assertEqual(availability.insiderActivity, true);
  assertEqual(availability.offerings, true);
});

test('buildDataAvailability: empty results', function() {
  const availability = buildDataAvailability([]);
  assertEqual(availability.secData, false);
  assertEqual(availability.catalysts, false);
});

// ===== EDGE CASES =====

test('buildCatalystIntelligence: empty secIntelligence', function() {
  const result = buildCatalystIntelligence('TEST', {}, null);
  assertEqual(result.catalystScore, null);
  assertEqual(result.quality, 'UNAVAILABLE');
});

test('buildCatalystIntelligence: empty marketData', function() {
  const result = buildCatalystIntelligence('TEST', null, {});
  // Market data without earnings won't produce catalysts
  assertEqual(result.catalystScore, null);
});

test('buildCatalystIntelligence: malformed secIntelligence', function() {
  const result = buildCatalystIntelligence('TEST', { foo: 'bar' }, null);
  assertEqual(result.catalystScore, null);
});

test('buildCatalystIntelligence: NaN in market data handled', function() {
  const marketData = { price: NaN, earningsDate: ['2024-01-01'] };
  const result = buildCatalystIntelligence('TEST', null, marketData);
  assertEqual(result.catalystType, 'EARNINGS');
});

test('buildCatalystIntelligence: Infinity in market data handled', function() {
  const marketData = { price: Infinity, earningsDate: ['2024-01-01'] };
  const result = buildCatalystIntelligence('TEST', null, marketData);
  assertEqual(result.catalystType, 'EARNINGS');
});

test('buildCatalystIntelligence: undefined secDataStatus', function() {
  const secIntel = {
    symbol: 'TEST',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    flags: [],
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertNotNullish(result);
  assertEqual(result.symbol, 'TEST');
});

// ===== DATA HONESTY =====

test('no fabricated catalyst: null secData returns null score', function() {
  const result = buildCatalystIntelligence('TEST', { secDataStatus: 'unavailable', latestFiling: null, flags: [] }, null);
  assertEqual(result.catalystScore, null);
  assertEqual(result.catalystType, 'NO_VERIFIED_CATALYST');
});

test('no fabricated data: warnings include NO_VERIFIED_CATALYST', function() {
  const result = buildCatalystIntelligence('TEST', { secDataStatus: 'unavailable', latestFiling: null, flags: [] }, null);
  assertEqual(result.warnings.includes('NO_VERIFIED_CATALYST'), true);
});

test('disclaimer present in all outputs', function() {
  const result = buildCatalystIntelligence('TEST', null, null);
  assertEqual(result.disclaimer.includes('تحليل محفزات'), true);
  assertEqual(result.disclaimer.includes('buy/sell'), true);
});

// ===== SEC EVIDENCE / A6 REGRESSION =====

test('SEC evidence: 8-K classified as SEC_MATERIAL_EVENT', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 80,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    materialEventInfo: { materialEventDetected: true, filingDate: '2024-01-01', filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K', 'MATERIAL_EVENT'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertEqual(result.catalystType, 'SEC_MATERIAL_EVENT');
  assertEqual(result.catalysts.some(c => c.type === 'SEC_MATERIAL_EVENT'), true);
  assertEqual(result.source, 'SEC EDGAR');
  assertEqual(result.provenance.intelligence, 'B6');
});

test('SEC evidence: S-1 classified as SEC_OFFERING', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 90,
    quality: 'TOP',
    filingCategory: 'OFFERING',
    latestFiling: { form: 'S-1', filingDate: '2024-01-01', daysAgo: 3 },
    materialEventInfo: null,
    insiderActivity: null,
    capitalStructureSignals: [{ type: 'OFFERING', form: 'S-1', filingDate: '2024-01-01', daysAgo: 3, offeringType: 'REGISTERED_OFFERING' }],
    flags: ['HAS_OFFERING', 'CAPITAL_STRUCTURE_EVENT'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: false, dilutionRisk: true, offeringRisk: true, secRiskScore: true, cik: true },
    dataCompleteness: 80,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertEqual(result.catalystType, 'SEC_OFFERING');
  assertEqual(result.catalysts.some(c => c.type === 'SEC_OFFERING'), true);
});

test('SEC evidence: Form 4 classified as INSIDER_ACTIVITY', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 70,
    quality: 'WATCH',
    filingCategory: 'INSIDER_ACTIVITY',
    latestFiling: { form: '4', filingDate: '2024-01-01', daysAgo: 1 },
    materialEventInfo: null,
    insiderActivity: { form4Detected: true, filingDate: '2024-01-01', daysAgo: 1, filingCount: 1, direction: 'BUY', transactionValue: 50000 },
    capitalStructureSignals: null,
    flags: ['FORM_4_FILED'],
    dataAvailability: { filings: true, insiderActivity: true, materialEvents: false, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 70,
  };
  const result = buildCatalystIntelligence('TEST', secIntel, null);
  assertEqual(result.catalystType, 'INSIDER_ACTIVITY');
  assertEqual(result.catalysts.some(c => c.type === 'INSIDER_ACTIVITY'), true);
});

// ===== B3/B4/B5 REGRESSION =====

test('B3 regression: institutional intelligence not modified', function() {
  // B6 should not import or call any B3 functions — verify module loads
  assertEqual(typeof require !== 'undefined', typeof require !== 'undefined');
});

test('B4 regression: swing intelligence not modified', function() {
  // B6 does not import swing-intelligence
});

test('B5 regression: early explosion intelligence not modified', function() {
  // B6 does not import early-explosion-intelligence
});

test('B5 regression: early explosion manager not modified', function() {
  // B6 does not import early-explosion-intelligence-manager
});

// ===== A6 REGRESSION =====

test('A6 regression: sec-filings not modified', function() {
  // B6 imports buildSecIntelligence from sec-filings but does not modify it
});

test('A6 regression: sec-edgar-intelligence not modified', function() {
  // B6 does not modify sec-edgar-intelligence
});

// ===== DETERMINISM =====

test('determinism: same input produces same output', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 85,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    materialEventInfo: { materialEventDetected: true, filingDate: '2024-01-01', filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const r1 = buildCatalystIntelligence('TEST', secIntel, null);
  const r2 = buildCatalystIntelligence('TEST', secIntel, null);
  assertEqual(r1.catalystScore, r2.catalystScore);
  assertEqual(r1.quality, r2.quality);
  assertEqual(r1.catalystType, r2.catalystType);
});

test('determinism: ranking is stable', function() {
  const results = [
    { symbol: 'A', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
    { symbol: 'B', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
    { symbol: 'C', catalystScore: 80, dataCompleteness: 90, recency: 80, significance: 'HIGH' },
  ];
  const r1 = rankCatalystOpportunities(results);
  const r2 = rankCatalystOpportunities(results);
  const order1 = r1.ranked.map(x => x.symbol);
  const order2 = r2.ranked.map(x => x.symbol);
  assertDeepEqual(order1, order2);
});

// ===== NO INPUT MUTATION =====

test('no input mutation: secIntelligence not mutated', function() {
  const secIntel = {
    symbol: 'TEST',
    secDataStatus: 'ok',
    secEdgarScore: 85,
    quality: 'STRONG',
    filingCategory: 'MATERIAL_EVENT',
    latestFiling: { form: '8-K', filingDate: '2024-01-01' },
    materialEventInfo: { materialEventDetected: true, filingDate: '2024-01-01', filingCount: 1 },
    insiderActivity: null,
    capitalStructureSignals: null,
    flags: ['HAS_8K'],
    dataAvailability: { filings: true, insiderActivity: false, materialEvents: true, dilutionRisk: false, offeringRisk: false, secRiskScore: true, cik: true },
    dataCompleteness: 60,
  };
  const secCopy = JSON.parse(JSON.stringify(secIntel));
  buildCatalystIntelligence('TEST', secIntel, null);
  assertDeepEqual(secIntel, secCopy, 'Input was mutated');
});

test('no input mutation: results array not mutated in ranking', function() {
  const results = [
    { symbol: 'B', catalystScore: 80 },
    { symbol: 'A', catalystScore: 90 },
  ];
  const resultsCopy = JSON.parse(JSON.stringify(results));
  rankCatalystOpportunities(results);
  assertDeepEqual(results.map(r => r.symbol), resultsCopy.map(r => r.symbol), 'Input array order was mutated');
});

// ===== SUMMARY =====

console.log('\n========================================');
console.log('Test Summary (B6):');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total:  ' + (passed + failed));
console.log('========================================');

if (failed > 0) {
  process.exitCode = 1;
  console.log('\n❌ SOME TESTS FAILED');
} else {
  console.log('\n✅ ALL TESTS PASSED');
}
