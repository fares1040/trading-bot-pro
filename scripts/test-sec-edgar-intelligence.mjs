import {
  buildSecEdgarIntelligence,
  defaultSecEdgarIntelligence,
  classifyFilingType,
  assessFilingSignificance,
  extractAllFilings,
  detectInsiderActivity,
  detectMaterialEvents,
  detectCapitalStructureSignals,
  calculateRecencyScore,
  calculateSignificanceScore,
  calculateInsiderScore,
  calculateMaterialEventScore,
  calculateCapitalStructureScore,
  calculateDataCompletenessScore,
  calculateSecEdgarScore,
  classifySecEdgarQuality,
  buildSecEdgarReasons,
  buildSecEdgarWarnings,
  buildSecEdgarFlags,
  calculateSecDataAvailability,
  rankSecOpportunities,
} from '../lib/sec-edgar-intelligence.js';

console.log('========================================');
console.log('SEC EDGAR Intelligence Tests (A6)');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (e) {
    console.log('FAIL: ' + name);
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

function assertTrue(condition, msg) {
  if (!condition) {
    throw new Error(msg || 'Expected true');
  }
}

function makeFiling(form, filingDate, accessionNumber, primaryDocument, extra) {
  return {
    form,
    filingDate: filingDate || null,
    accessionNumber: accessionNumber || null,
    primaryDocument: primaryDocument || null,
    total: null,
    price: null,
    totalValue: null,
    fileNumber: null,
    transactionType: null,
    ...extra,
  };
}

function makeSecData(opts) {
  return {
    symbol: opts.symbol || 'TEST',
    secDataStatus: opts.secDataStatus || 'ok',
    cik: opts.cik !== undefined ? opts.cik : '00001000000',
    secRiskScore: opts.secRiskScore ?? null,
    secRiskLevel: opts.secRiskLevel || 'unavailable',
    dilutionRisk: opts.dilutionRisk || 'unavailable',
    dilutionReason: opts.dilutionReason || null,
    offeringRisk: opts.offeringRisk || 'unavailable',
    offeringType: opts.offeringType || null,
    offeringDate: opts.offeringDate || null,
    offeringReason: opts.offeringReason || null,
    warrantRisk: opts.warrantRisk || 'unavailable',
    convertibleRisk: opts.convertibleRisk || 'unavailable',
    reverseSplitRisk: opts.reverseSplitRisk || 'unavailable',
    secRiskFlags: opts.secRiskFlags || [],
    secRiskReasons: opts.secRiskReasons || [],
    latestRelevantFilings: opts.latestRelevantFilings || [],
    filings: opts.filings || [],
  };
}

// ===== 1. Empty input =====
test('1. Empty input returns UNAVAILABLE', function() {
  const result = buildSecEdgarIntelligence(null, 'TEST');
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.secEdgarScore);
  assertEqual(result.symbol, 'TEST');
  assertTrue(Array.isArray(result.reasons));
  assertTrue(Array.isArray(result.warnings));
  assertTrue(Array.isArray(result.flags));
  assertTrue(result.warnings.includes('SEC_DATA_UNAVAILABLE'));
});

// ===== 2. Missing SEC data =====
test('2. Missing SEC data returns UNAVAILABLE', function() {
  const result = buildSecEdgarIntelligence(
    { symbol: 'TEST', secDataStatus: 'unavailable', secRiskScore: null,
      dilutionRisk: 'unavailable', offeringRisk: 'unavailable',
      warrantRisk: 'unavailable', convertibleRisk: 'unavailable',
      reverseSplitRisk: 'unavailable', secRiskFlags: [],
      latestRelevantFilings: [], filings: [] },
    'TEST'
  );
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNullish(result.secEdgarScore);
  assertEqual(result.filingCategory, 'OTHER');
  assertNullish(result.latestFiling);
});

// ===== 3. Invalid filing data =====
test('3. Invalid filing data does not crash', function() {
  const result = buildSecEdgarIntelligence(
    makeSecData({ filings: [{ form: null, filingDate: null, accessionNumber: null }] }),
    'TEST'
  );
  assertEqual(result.quality, 'UNAVAILABLE');
  assertEqual(result.filingHistory.length, 1);
  assertEqual(result.filingHistory[0].form, null);
});

// ===== 4. Filing classification =====
test('4. Filing classification is correct', function() {
  assertEqual(classifyFilingType('8-K'), 'MATERIAL_EVENT');
  assertEqual(classifyFilingType('S-1'), 'OFFERING');
  assertEqual(classifyFilingType('S-3'), 'SHELF_REGISTRATION');
  assertEqual(classifyFilingType('424B5'), 'ATM_CAPITAL_RAISE');
  assertEqual(classifyFilingType('424B'), 'OFFERING');
  assertEqual(classifyFilingType('10-K'), 'EARNINGS');
  assertEqual(classifyFilingType('10-Q'), 'EARNINGS');
  assertEqual(classifyFilingType('6-K'), 'CORPORATE_UPDATE');
  assertEqual(classifyFilingType('20-F'), 'EARNINGS');
  assertEqual(classifyFilingType('4'), 'INSIDER_ACTIVITY');
  assertEqual(classifyFilingType('144'), 'OWNERSHIP_CHANGE');
  assertEqual(classifyFilingType('DEF 14A'), 'REGULATORY_EVENT');
  assertEqual(classifyFilingType('XYZ'), 'OTHER');
  assertEqual(classifyFilingType(null), 'OTHER');
  assertEqual(classifyFilingType('S-1/A'), 'OFFERING');
});

test('4b. Filing significance scores', function() {
  assertEqual(assessFilingSignificance('8-K'), 100);
  assertEqual(assessFilingSignificance('S-1'), 95);
  assertEqual(assessFilingSignificance('S-3'), 80);
  assertEqual(assessFilingSignificance('10-K'), 70);
  assertEqual(assessFilingSignificance('10-Q'), 60);
  assertEqual(assessFilingSignificance('4'), 75);
  assertEqual(assessFilingSignificance('144'), 65);
  assertEqual(assessFilingSignificance('DEF 14A'), 45);
  assertEqual(assessFilingSignificance(null), null);
});

// ===== 5. 8-K detection =====
test('5. 8-K detection', function() {
  const filings = [
    makeFiling('10-Q', '2024-06-01', '0001-1', '10q.htm'),
    makeFiling('8-K', '2024-08-15', '0001-2', '8k.htm'),
  ];
  const materialInfo = detectMaterialEvents(filings);
  assertNotNullish(materialInfo);
  assertTrue(materialInfo.materialEventDetected);
  assertEqual(materialInfo.form, '8-K');
  assertEqual(materialInfo.filingCount, 1);
});

test('5b. No 8-K returns null', function() {
  const filings = [makeFiling('10-Q', '2024-06-01', '0001-1', '10q.htm')];
  const materialInfo = detectMaterialEvents(filings);
  assertNullish(materialInfo);
});

// ===== 6. S-3 detection =====
test('6. S-3 detection', function() {
  const filings = [makeFiling('S-3', '2024-07-01', '0001-3', 's3.htm')];
  const signals = detectCapitalStructureSignals(filings);
  assertNotNullish(signals);
  assertEqual(signals[0].type, 'OFFERING');
  assertEqual(signals[0].offeringType, 'SHELF_REGISTRATION');
  assertEqual(signals[0].form, 'S-3');
});

// ===== 7. 424B5 detection =====
test('7. 424B5 detection', function() {
  const filings = [makeFiling('424B5', '2024-07-15', '0001-4', '424b5.htm')];
  const signals = detectCapitalStructureSignals(filings);
  assertNotNullish(signals);
  assertEqual(signals[0].type, 'OFFERING');
  assertEqual(signals[0].offeringType, 'ATM');
  assertEqual(signals[0].form, '424B5');
});

// ===== 8. Offering/dilution detection =====
test('8. Offering and dilution detection', function() {
  const secData = makeSecData({
    filings: [makeFiling('S-1', '2024-08-01', '0001-5', 's1.htm')],
    dilutionRisk: 'low',
    dilutionReason: 'Single shelf registration detected',
    offeringRisk: 'moderate',
    offeringType: 'registered_offering',
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertTrue(result.dilutionRisk === 'low');
  assertTrue(result.offeringRisk === 'moderate');
  assertTrue(result.flags.includes('HAS_OFFERING'));
  assertTrue(result.flags.includes('DILUTION_RISK') || result.flags.includes('OFFERING_RISK'));
});

test('8b. No offering/dilution returns none', function() {
  const secData = makeSecData({
    filings: [makeFiling('10-Q', '2024-08-01', '0001-1', '10q.htm')],
    dilutionRisk: 'none',
    offeringRisk: 'none',
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertEqual(result.dilutionRisk, 'none');
  assertEqual(result.offeringRisk, 'none');
  assertEqual(result.filingCategory, 'EARNINGS');
});

// ===== 9. Form 4 insider purchase =====
test('9. Form 4 insider purchase detection', function() {
  const filings = [
    makeFiling('4', '2024-08-20', '0001-6', '4', {
      total: 1000,
      price: 50.00,
      totalValue: 50000,
      transactionType: 'P',
    }),
  ];
  const insider = detectInsiderActivity(filings);
  assertNotNullish(insider);
  assertTrue(insider.form4Detected);
  assertEqual(insider.direction, 'BUY');
  assertEqual(insider.transactionShares, 1000);
  assertEqual(insider.transactionPrice, 50);
  assertEqual(insider.transactionValue, 50000);

  const result = buildSecEdgarIntelligence(makeSecData({ filings }), 'TEST');
  assertEqual(result.filingCategory, 'INSIDER_BUYING');
  assertTrue(result.flags.includes('FORM_4_FILED'));
  assertTrue(result.flags.includes('INSIDER_ACTIVITY'));
});

// ===== 10. Form 4 insider sale =====
test('10. Form 4 insider sale detection', function() {
  const filings = [
    makeFiling('4', '2024-08-20', '0001-7', '4', {
      total: 5000,
      price: 75.00,
      totalValue: 375000,
      transactionType: 'S',
    }),
  ];
  const insider = detectInsiderActivity(filings);
  assertNotNullish(insider);
  assertTrue(insider.form4Detected);
  assertEqual(insider.direction, 'SELL');
  assertEqual(insider.transactionShares, 5000);
  assertEqual(insider.transactionValue, 375000);

  const result = buildSecEdgarIntelligence(makeSecData({ filings }), 'TEST');
  assertEqual(result.filingCategory, 'INSIDER_SELLING');
  assertTrue(result.flags.includes('HIGH_VALUE_INSIDER_TXN'));
});

// ===== 10b. Form 4 without direction =====
test('10b. Form 4 without direction returns INSIDER_ACTIVITY', function() {
  const filings = [makeFiling('4', '2024-08-20', '0001-8', '4', {
    total: 1000,
    transactionType: null,
  })];
  const result = buildSecEdgarIntelligence(makeSecData({ filings }), 'TEST');
  assertEqual(result.filingCategory, 'INSIDER_ACTIVITY');
  assertNullish(result.insiderActivity.direction);
  assertTrue(result.warnings.includes('INSUFFICIENT_INSIDER_DIRECTION'));
});

// ===== 11. Recency scoring =====
test('11. Recency scoring', function() {
  const now = new Date().toISOString().split('T')[0];
  assertEqual(calculateRecencyScore(now), 100);
  assertEqual(calculateRecencyScore(null), null);

  const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  assertEqual(calculateRecencyScore(old), 10);
});

// ===== 12. Component scoring =====
test('12. Component scoring is present', function() {
  const secData = makeSecData({
    filings: [makeFiling('8-K', new Date().toISOString().split('T')[0], '0001-2', '8k.htm')],
    secRiskScore: 50,
    dilutionRisk: 'none',
    offeringRisk: 'none',
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertNotNullish(result.componentScores);
  assertNotNullish(result.componentScores.filingSignificance);
  assertNotNullish(result.componentScores.filingRecency);
  assertNotNullish(result.componentScores.dataCompleteness);
  assertNotNullish(result.componentScores.materialEvent);
});

test('12b. Component scoring returns null for unavailable', function() {
  const result = buildSecEdgarIntelligence(makeSecData({ filings: [] }), 'TEST');
  assertEqual(result.componentScores.insiderSignal, null);
  assertEqual(result.componentScores.materialEvent, null);
  assertEqual(result.componentScores.capitalStructure, null);
  assertEqual(result.componentScores.filingSignificance, null);
});

// ===== 13. Missing-component renormalization =====
test('13. Missing-component renormalization', function() {
  const secDataWithOneComponent = makeSecData({
    filings: [makeFiling('8-K', new Date().toISOString().split('T')[0], '0001-2', '8k.htm')],
  });
  const result = buildSecEdgarIntelligence(secDataWithOneComponent, 'TEST');
  assertNotNullish(result.secEdgarScore);
  assertTrue(result.secEdgarScore >= 0 && result.secEdgarScore <= 100);

  const secDataWithTwo = makeSecData({
    filings: [
      makeFiling('8-K', new Date().toISOString().split('T')[0], '0001-2', '8k.htm'),
      makeFiling('10-Q', '2024-07-01', '0001-1', '10q.htm'),
    ],
  });
  const result2 = buildSecEdgarIntelligence(secDataWithTwo, 'TEST');
  assertNotNullish(result2.secEdgarScore);
  assertTrue(result2.secEdgarScore >= 0 && result2.secEdgarScore <= 100);
});

// ===== 14. Quality classification =====
test('14. Quality classification', function() {
  assertEqual(classifySecEdgarQuality(90), 'TOP');
  assertEqual(classifySecEdgarQuality(85), 'TOP');
  assertEqual(classifySecEdgarQuality(75), 'STRONG');
  assertEqual(classifySecEdgarQuality(70), 'STRONG');
  assertEqual(classifySecEdgarQuality(60), 'WATCH');
  assertEqual(classifySecEdgarQuality(55), 'WATCH');
  assertEqual(classifySecEdgarQuality(45), 'WEAK');
  assertEqual(classifySecEdgarQuality(40), 'WEAK');
  assertEqual(classifySecEdgarQuality(30), 'UNAVAILABLE');
  assertEqual(classifySecEdgarQuality(null), 'UNAVAILABLE');
  assertEqual(classifySecEdgarQuality(0), 'UNAVAILABLE');
  assertEqual(classifySecEdgarQuality(100), 'TOP');
});

test('14b. Quality classification from full result', function() {
  const recentDate = new Date().toISOString().split('T')[0];
  const secData = makeSecData({
    filings: [makeFiling('8-K', recentDate, '0001-2', '8k.htm')],
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
});

// ===== 15. Reasons =====
test('15. Reasons are deterministic and explainable', function() {
  const recentDate = new Date().toISOString().split('T')[0];
  const secData = makeSecData({
    filings: [makeFiling('8-K', recentDate, '0001-2', '8k.htm')],
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertTrue(result.reasons.length > 0);
  assertTrue(result.reasons[0].includes('8-K') || result.reasons[0].includes('Latest filing'));

  const result2 = buildSecEdgarIntelligence(makeSecData({ filings: [], secDataStatus: 'no_filings' }), 'TEST');
  assertTrue(result2.reasons.includes('No recent SEC filings found'));
});

// ===== 16. Warnings =====
test('16. Warnings detect issues', function() {
  const result = buildSecEdgarIntelligence(makeSecData({
    filings: [],
    secDataStatus: 'unavailable',
  }), 'TEST');
  assertTrue(result.warnings.includes('SEC_DATA_UNAVAILABLE'));

  const result2 = buildSecEdgarIntelligence(makeSecData({
    secDataStatus: 'no_filings',
    filings: [],
  }), 'TEST');
  assertTrue(result2.warnings.includes('NO_RECENT_FILINGS'));
});

// ===== 17. Flags =====
test('17. Flags identify important conditions', function() {
  const recentDate = new Date().toISOString().split('T')[0];
  const secData = makeSecData({
    filings: [
      makeFiling('8-K', recentDate, '0001-2', '8k.htm'),
      makeFiling('4', recentDate, '0001-3', '4', { transactionType: 'P' }),
    ],
    dilutionRisk: 'low',
    offeringRisk: 'none',
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertTrue(result.flags.includes('MATERIAL_EVENT'));
  assertTrue(result.flags.includes('FORM_4_FILED'));
  assertTrue(result.flags.includes('INSIDER_ACTIVITY'));
  assertTrue(result.flags.includes('HAS_8K'));
  assertTrue(result.flags.includes('DILUTION_RISK'));
});

// ===== 18. Data completeness =====
test('18. Data completeness', function() {
  const secData = makeSecData({
    filings: [makeFiling('8-K', '2024-08-15', '0001-2', '8k.htm')],
  });
  const result = buildSecEdgarIntelligence(secData, 'TEST');
  assertTrue(result.dataCompleteness > 0);
  assertTrue(result.dataCompleteness <= 100);
  assertTrue(typeof result.dataAvailability === 'object');
  assertTrue(result.dataAvailability.filings === true);
});

test('18b. Data completeness zero for no filings', function() {
  const result = buildSecEdgarIntelligence(makeSecData({ filings: [], cik: null }), 'TEST');
  assertEqual(result.dataCompleteness, 0);
});

// ===== 19. Ranking =====
test('19. Ranking sorts by score descending', function() {
  const results = [
    buildSecEdgarIntelligence(makeSecData({
      symbol: 'A',
      filings: [makeFiling('8-K', new Date().toISOString().split('T')[0], '0001-1', '8k.htm')],
    }), 'A'),
    buildSecEdgarIntelligence(makeSecData({
      symbol: 'B',
      filings: [],
      secDataStatus: 'no_filings',
    }), 'B'),
    buildSecEdgarIntelligence(makeSecData({
      symbol: 'C',
      filings: [makeFiling('S-3', new Date().toISOString().split('T')[0], '0001-2', 's3.htm')],
      offeringRisk: 'low',
      offeringType: 'shelf_registration',
    }), 'C'),
  ];
  const ranked = rankSecOpportunities(results);
  assertNotNullish(ranked.top);
  assertNotNullish(ranked.alternatives);
  assertTrue(ranked.ranked.length === 3);
  assertTrue(ranked.top.length >= 1);
  assertTrue(ranked.ranked[0].secEdgarScore >= ranked.ranked[2].secEdgarScore);
});

// ===== 20. Stable deterministic output =====
test('20. Stable deterministic output', function() {
  const recentDate = new Date().toISOString().split('T')[0];
  const secData = makeSecData({
    symbol: 'STABLE',
    filings: [makeFiling('8-K', recentDate, '000001-1', '8k.htm')],
    dilutionRisk: 'none',
    offeringRisk: 'none',
  });
  const result1 = buildSecEdgarIntelligence(secData, 'STABLE');
  const result2 = buildSecEdgarIntelligence(secData, 'STABLE');
  assertEqual(result1.secEdgarScore, result2.secEdgarScore);
  assertEqual(result1.quality, result2.quality);
  assertEqual(JSON.stringify(result1.reasons), JSON.stringify(result2.reasons));
  assertEqual(JSON.stringify(result1.flags), JSON.stringify(result2.flags));
  assertEqual(JSON.stringify(result1.warnings), JSON.stringify(result2.warnings));
});

// ===== EXTRA: extractAllFilings from raw SEC data =====
test('Extra: extractAllFilings from raw SEC submissions', function() {
  const mockSubmissions = {
    status: 'ok',
    cik: '0000320193',
    data: {
      filings: {
        recent: {
          form: ['8-K', '10-Q', '4', 'S-3', 'DEF 14A'],
          filingDate: ['2024-08-15', '2024-07-25', '2024-07-01', '2024-06-15', '2024-04-01'],
          accessionNumber: ['0001-1', '0001-2', '0001-3', '0001-4', '0001-5'],
          primaryDocument: ['8k.htm', '10q.htm', '4', 's3.htm', 'def14a.htm'],
          total: [null, null, 5000, null, null],
          price: [null, null, 150.00, null, null],
          totalValue: [null, null, 750000, null, null],
          transactionType: [null, null, 'P', null, null],
        },
      },
    },
  };
  const filings = extractAllFilings(mockSubmissions);
  assertEqual(filings.length, 5);
  assertEqual(filings[0].form, '8-K');
  assertEqual(filings[2].form, '4');
  assertNotNullish(filings[2].total);
  assertEquals(filings[2].transactionType, 'P');
});

function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || '') + ' Expected ' + expected + ', got ' + actual);
  }
}

// ===== EXTRA: Full integration test =====
test('Extra: Full integration - 8-K + Form 4 buy + S-3', function() {
  const recentDate = new Date().toISOString().split('T')[0];
  const secData = makeSecData({
    symbol: 'AAPL',
    cik: '0000320193',
    secDataStatus: 'ok',
    filings: [
      makeFiling('4', recentDate, '0001-1', '4', { total: 1000, price: 200, totalValue: 200000, transactionType: 'P' }),
      makeFiling('8-K', recentDate, '0001-2', '8k.htm'),
      makeFiling('S-3', '2024-07-01', '0001-3', 's3.htm'),
    ],
    secRiskScore: 50,
    secRiskLevel: 'moderate',
    dilutionRisk: 'low',
    dilutionReason: 'Single shelf registration detected',
    offeringRisk: 'moderate',
    offeringType: 'shelf_registration',
    secRiskFlags: ['DILUTION_RISK'],
    secRiskReasons: ['Dilution risk detected'],
  });
  const result = buildSecEdgarIntelligence(secData, 'AAPL');
  assertNotNullish(result.secEdgarScore);
  assertTrue(result.secEdgarScore >= 0 && result.secEdgarScore <= 100);
  assertEqual(result.symbol, 'AAPL');
  assertTrue(['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'].includes(result.quality));
  assertNotNullish(result.latestFiling);
  assertEqual(result.latestFiling.form, '4');
  assertTrue(result.flags.includes('FORM_4_FILED'));
  assertTrue(result.flags.includes('MATERIAL_EVENT'));
  assertTrue(result.flags.includes('HAS_OFFERING'));
  assertTrue(result.insiderActivity?.direction === 'BUY');
  assertTrue(result.filingCategory === 'INSIDER_BUYING');
  assertTrue(result.reasons.length > 0);
  assertTrue(result.disclaimer.includes('analytical only'));
});

// ===== EXTRA: defaultSecEdgarIntelligence =====
test('Extra: defaultSecEdgarIntelligence', function() {
  const def = defaultSecEdgarIntelligence('DEFAULT');
  assertEqual(def.secEdgarScore, null);
  assertEqual(def.quality, 'UNAVAILABLE');
  assertEqual(def.filingCategory, 'OTHER');
  assertEqual(def.filingHistory.length, 0);
  assertTrue(def.warnings.includes('SEC_DATA_UNAVAILABLE'));
  assertTrue(def.disclaimer.includes('analytical only'));
});

console.log('\n========================================');
console.log('SEC EDGAR Intelligence Tests: ' + passed + ' Passed, ' + failed + ' Failed, ' + (passed + failed) + ' Total');
console.log('========================================');
if (failed > 0) process.exit(1);
