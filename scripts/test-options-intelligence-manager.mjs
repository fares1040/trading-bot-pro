/**
 * B2 Options Intelligence Manager Tests
 *
 * Tests for lib/options-intelligence-manager.js (B2 Options Intelligence layer).
 * Run with: node scripts/test-options-intelligence-manager.mjs
 *
 * Fully deterministic — no network, no dev server, no credentials.
 *
 * Coverage:
 *   1.  Valid options data
 *   2.  Missing options data (null/undefined contracts)
 *   3.  Empty options chain
 *   4.  Calls-only
 *   5.  Puts-only
 *   6.  Balanced flow
 *   7.  Bullish flow (call pressure)
 *   8.  Bearish flow (put pressure)
 *   9.  Unusual activity
 *   10. High volume / low OI
 *   11. High OI / low volume
 *   12. Volume/OI interpretation
 *   13. IV availability
 *   14. Missing IV
 *   15. Expiration handling
 *   16. Strike handling
 *   17. Moneyness
 *   18. Provenance
 *   19. Data quality
 *   20. Score boundaries 0-100
 *   21. Deterministic output
 *   22. No fabricated values
 *   23. API contract (via defaultOptionsIntelligence)
 *   24. Regression against existing A2 contracts
 */

import {
  buildOptionsIntelligenceResult,
  defaultOptionsIntelligence,
  rankOptionsOpportunities,
  classifyActivityScore,
  classifyConviction,
  classifyQuality,
  classifyAction,
  n,
  clamp,
  buildKeySignals,
  buildRisks,
  buildThesis,
  buildDataQuality,
  buildDefaultCallsPuts,
  buildFlowScores,
} from '../lib/options-intelligence-manager.js';

import {
  buildOptionsIntelligence,
  buildOptionsFlowIntelligence,
  rankOptionsContracts,
  buildBestContractSummary,
  buildSymbolDecisionSummary,
} from '../lib/options-intelligence.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(
      `${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected true but got false');
}

function assertNull(value, message = '') {
  if (value !== null)
    throw new Error(
      `${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`
    );
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined)
    throw new Error(message || 'Expected non-null value but got null/undefined');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

function assertScore0to100(score, message = '') {
  if (score != null) {
    assertTrue(
      Number.isFinite(score) && score >= 0 && score <= 100,
      `Score ${score} should be 0-100${message ? ' (' + message + ')' : ''}`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCall(overrides = {}) {
  return {
    symbol: 'TEST250117C00050000',
    optionType: 'CALL',
    strike: 50,
    daysToExpiration: 30,
    expiry: '2025-01-17',
    premium: 0.50,
    contractCost: 50,
    bid: 0.48,
    ask: 0.52,
    lastPrice: 0.50,
    volume: 500,
    openInterest: 1000,
    impliedVolatility: 0.45,
    spreadPct: 8,
    underlying: 48,
    distancePct: 4.2,
    liquidityScore: 42,
    premiumScore: 50,
    score: 55,
    riskLabel: 'HIGH RISK / SPECULATIVE',
    source: 'Yahoo Finance options chain',
    ...overrides,
  };
}

function makePut(overrides = {}) {
  return {
    ...makeCall(overrides),
    symbol: 'TEST250117P00050000',
    optionType: 'PUT',
  };
}

function makeContracts(callOverrides, putOverrides) {
  const calls = [makeCall(callOverrides)];
  const puts = [makePut(putOverrides)];
  return [...calls, ...puts];
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('B2 Options Intelligence Manager Tests');
console.log('========================================\n');

// === 1. Valid options data ===
test('1. Valid options data - produces complete intelligence', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.30, bid: 0.28, ask: 0.32, spreadPct: 7, impliedVolatility: 0.40 },
    { volume: 500, openInterest: 1000, premium: 0.40, bid: 0.38, ask: 0.42, spreadPct: 9, impliedVolatility: 0.50 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.ticker, 'TEST');
  assertTrue(result.optionsAvailability === true);
  assertNotNull(result.timestamp);
  assertNotNull(result.callScore);
  assertNotNull(result.putScore);
  assertTrue(result.calls.count === 1);
  assertTrue(result.puts.count === 1);
  assertTrue(Array.isArray(result.keySignals));
  assertTrue(result.keySignals.length > 0);
  assertNotNull(result.thesis);
});

// === 2. Missing options data ===
test('2. Missing options data - null contracts returns default', () => {
  const result = buildOptionsIntelligenceResult('TEST', null);
  assertEqual(result.ticker, 'TEST');
  assertEqual(result.optionsAvailability, false);
  assertNull(result.callScore);
  assertNull(result.putScore);
  assertNull(result.bullishFlowScore);
  assertNull(result.bearishFlowScore);
  assertNull(result.unusualActivityScore);
  assertEqual(result.flowConviction, 'UNAVAILABLE');
  assertEqual(result.optionsQuality, 'UNAVAILABLE');
  assertEqual(result.optionsAction, 'INSUFFICIENT_DATA');
  assertTrue(Array.isArray(result.keySignals));
  assertTrue(Array.isArray(result.risks));
  assertTrue(result.keySignals.length === 0);
});

test('2b. Missing options data - undefined contracts returns default', () => {
  const result = buildOptionsIntelligenceResult('TEST', undefined);
  assertEqual(result.optionsAvailability, false);
  assertEqual(result.calls.count, 0);
  assertEqual(result.puts.count, 0);
});

test('2c. Missing symbol - null symbol returns default with null ticker', () => {
  const result = buildOptionsIntelligenceResult(null, []);
  assertEqual(result.ticker, null);
  assertEqual(result.optionsAvailability, false);
});

// === 3. Empty options chain ===
test('3. Empty options chain - returns default (no contracts)', () => {
  const result = buildOptionsIntelligenceResult('TEST', []);
  assertEqual(result.optionsAvailability, false);
  assertEqual(result.calls.count, 0);
  assertEqual(result.puts.count, 0);
  assertEqual(result.ranking.length, 0);
  assertEqual(result.summary.contractCount, 0);
  assertEqual(result.dataQuality.completeness, 0);
  assertEqual(result.dataQuality.dataStatus, 'unavailable');
});

// === 4. Calls-only ===
test('4. Calls-only - putScore is null, callScore populated', () => {
  const contracts = [makeCall({ volume: 1000, openInterest: 2000 })];
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.callScore);
  assertNull(result.putScore);
  assertEqual(result.calls.count, 1);
  assertEqual(result.puts.count, 0);
  assertTrue(result.calls.contracts.length === 1);
  assertTrue(result.puts.contracts.length === 0);
});

// === 5. Puts-only ===
test('5. Puts-only - callScore is null, putScore populated', () => {
  const contracts = [makePut({ volume: 1000, openInterest: 2000 })];
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.putScore);
  assertNull(result.callScore);
  assertEqual(result.puts.count, 1);
  assertEqual(result.calls.count, 0);
});

// === 6. Balanced flow ===
test('6. Balanced flow - callPutPressure is BALANCED', () => {
  const contracts = makeContracts(
    { volume: 500, openInterest: 500 },
    { volume: 500, openInterest: 500 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.callPutPressure, 'BALANCED');
  assertNull(result.bullishFlowScore);
  assertNull(result.bearishFlowScore);
});

// === 7. Bullish flow (call pressure) ===
test('7. Bullish flow - CALL_PRESSURE gives bullishFlowScore', () => {
  const contracts = makeContracts(
    { volume: 5000, openInterest: 5000, premium: 0.40 },
    { volume: 200, openInterest: 200, premium: 0.30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.callPutPressure, 'CALL_PRESSURE');
  assertNotNull(result.bullishFlowScore);
  assertTrue(result.bullishFlowScore > 0, 'Bullish flow score should be > 0');
  assertScore0to100(result.bullishFlowScore);
});

// === 8. Bearish flow (put pressure) ===
test('8. Bearish flow - PUT_PRESSURE gives bearishFlowScore', () => {
  const contracts = makeContracts(
    { volume: 200, openInterest: 200, premium: 0.40 },
    { volume: 5000, openInterest: 5000, premium: 0.30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.callPutPressure, 'PUT_PRESSURE');
  assertNotNull(result.bearishFlowScore);
  assertTrue(result.bearishFlowScore > 0, 'Bearish flow score should be > 0');
  assertScore0to100(result.bearishFlowScore);
});

// === 9. Unusual activity ===
test('9. Unusual activity - high volume/OI ratio scores high', () => {
  const contracts = makeContracts(
    { volume: 5000, openInterest: 100 },
    { volume: 5000, openInterest: 100 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.unusualActivityScore);
  assertTrue(result.unusualActivityScore >= 80, 'Should be VERY_HIGH activity score >= 80');
  assertScore0to100(result.unusualActivityScore);
  assertTrue(
    result.flow.activityStrength === 'VERY_HIGH',
    `Expected VERY_HIGH activity, got ${result.flow.activityStrength}`
  );
});

// === 10. High volume / low OI ===
test('10. High volume / low OI - volumeToOIRatio > 1', () => {
  const contracts = makeContracts(
    { volume: 500, openInterest: 100 },
    { volume: 500, openInterest: 100 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.flow.volumeToOIRatio);
  assertTrue(result.flow.volumeToOIRatio > 1);
  assertEqual(result.flow.activityStrength, 'VERY_HIGH');
});

// === 11. High OI / low volume ===
test('11. High OI / low volume - volumeToOIRatio < 0.5', () => {
  const contracts = makeContracts(
    { volume: 50, openInterest: 2000 },
    { volume: 30, openInterest: 1500 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.flow.volumeToOIRatio);
  assertTrue(result.flow.volumeToOIRatio < 0.5);
  assertEqual(result.flow.activityStrength, 'LOW');
});

// === 12. Volume/OI interpretation ===
test('12. Volume/OI ratio interpretation - ratio 0.5-2 is NORMAL', () => {
  const contracts = makeContracts(
    { volume: 500, openInterest: 500 },
    { volume: 500, openInterest: 500 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.activityStrength, 'NORMAL');
  assertNotNull(result.flow.volumeToOIRatio);
  assertTrue(result.flow.volumeToOIRatio >= 0.5 && result.flow.volumeToOIRatio <= 2);
});

// === 13. IV availability ===
test('13. IV availability - dataQuality.hasIV is true when IV present', () => {
  const contracts = makeContracts(
    { impliedVolatility: 0.45 },
    { impliedVolatility: 0.50 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.dataQuality.hasIV === true);
  assertTrue(result.dataQuality.completeness > 0);
});

// === 14. Missing IV ===
test('14. Missing IV - IV is null, hasIV is false', () => {
  const contracts = makeContracts(
    { impliedVolatility: null },
    { impliedVolatility: null }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.dataQuality.hasIV === false);
  assertTrue(result.dataQuality.completeness < 100);
});

// === 15. Expiration handling ===
test('15. Expiration handling - short DTE flagged in risks', () => {
  const contracts = makeContracts(
    { daysToExpiration: 2, premium: 0.10 },
    { daysToExpiration: 2, premium: 0.15 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(
    result.risks.some((r) => r.label === 'EXTREME_DECAY'),
    'Should flag extreme time decay risk'
  );
});

test('15b. Expiration handling - long DTE no extreme decay risk', () => {
  const contracts = makeContracts(
    { daysToExpiration: 45, premium: 0.50 },
    { daysToExpiration: 45, premium: 0.60 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertFalse(
    result.risks.some((r) => r.label === 'EXTREME_DECAY'),
    'Should NOT flag extreme time decay for long DTE'
  );
});

// === 16. Strike handling ===
test('16. Strike handling - far OTM strike flagged in risks', () => {
  const contracts = makeContracts(
    { strike: 100, underlying: 50, distancePct: 50, daysToExpiration: 30 },
    { strike: 100, underlying: 50, distancePct: 50, daysToExpiration: 30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(
    result.risks.some((r) => r.label === 'FAR_OTM'),
    'Should flag far OTM risk'
  );
});

test('16b. Strike handling - ATM strike no far OTM risk', () => {
  const contracts = makeContracts(
    { strike: 50, underlying: 50, distancePct: 0, daysToExpiration: 30 },
    { strike: 50, underlying: 50, distancePct: 0, daysToExpiration: 30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertFalse(
    result.risks.some((r) => r.label === 'FAR_OTM'),
    'Should NOT flag far OTM for ATM'
  );
});

// === 17. Moneyness ===
test('17. Moneyness - distancePct used correctly', () => {
  const contracts = makeContracts(
    { strike: 52, underlying: 50, distancePct: 4.0 },
    { strike: 48, underlying: 50, distancePct: 4.0 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.calls.contracts[0].distancePct === 4.0);
  assertTrue(result.puts.contracts[0].distancePct === 4.0);
});

test('17b. Moneyness - null distancePct handled gracefully', () => {
  const contracts = makeContracts(
    { distancePct: null, strike: null, underlying: null },
    { distancePct: null, strike: null, underlying: null }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.dataQuality.available === true);
  assertTrue(result.dataQuality.completeness > 0);
});

// === 18. Provenance ===
test('18. Provenance - tracks source modules', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.provenance);
  assertEqual(result.provenance.contracts, 'A2');
  assertEqual(result.provenance.flow, 'A2');
  assertEqual(result.provenance.ranking, 'A2');
  assertEqual(result.provenance.decision, 'A2');
  assertEqual(result.provenance.strategies, 'A2');
});

test('18b. Provenance - includes SEC when secIntelligence provided', () => {
  const contracts = makeContracts();
  const secIntel = { secRiskScore: 75, secRiskLevel: 'low', secDataStatus: 'ok' };
  const result = buildOptionsIntelligenceResult('TEST', contracts, {
    secIntelligence: secIntel,
  });
  assertEqual(result.provenance.sec, 'A6');
  assertNotNull(result.sec);
  assertEqual(result.sec.secRiskScore, 75);
});

// === 19. Data quality ===
test('19. Data quality - complete when all fields present', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.dataQuality.available === true);
  assertTrue(result.dataQuality.completeness === 100);
  assertTrue(result.dataQuality.hasCalls === true);
  assertTrue(result.dataQuality.hasPuts === true);
  assertTrue(result.dataQuality.hasVolume === true);
  assertTrue(result.dataQuality.hasOI === true);
  assertTrue(result.dataQuality.hasIV === true);
  assertTrue(result.dataQuality.hasPremium === true);
  assertTrue(result.dataQuality.hasBidAsk === true);
});

test('19b. Data quality - partial when some fields missing', () => {
  const contracts = makeContracts(
    { volume: null, openInterest: null, impliedVolatility: null, bid: null, ask: null },
    { volume: null, openInterest: null, impliedVolatility: null, bid: null, ask: null }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.dataQuality.completeness < 100);
  assertTrue(result.dataQuality.dataStatus !== 'complete' || result.dataQuality.dataStatus === 'partial');
});

// === 20. Score boundaries 0-100 ===
test('20. Score boundaries - all numeric scores in 0-100 range', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.30, bid: 0.28, ask: 0.32 },
    { volume: 1000, openInterest: 2000, premium: 0.30, bid: 0.28, ask: 0.32 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertScore0to100(result.callScore);
  assertScore0to100(result.putScore);
  assertScore0to100(result.bullishFlowScore);
  assertScore0to100(result.bearishFlowScore);
  assertScore0to100(result.unusualActivityScore);
  assertScore0to100(result.flow.callPutPressureScore);
  assertScore0to100(result.flow.premiumPressureScore);
});

// === 21. Deterministic output ===
test('21. Deterministic output - same input produces same output', () => {
  const contracts = makeContracts();
  const result1 = buildOptionsIntelligenceResult('TEST', contracts, { timestamp: '2025-01-01T00:00:00Z' });
  const result2 = buildOptionsIntelligenceResult('TEST', contracts, { timestamp: '2025-01-01T00:00:00Z' });

  assertEqual(result1.callScore, result2.callScore);
  assertEqual(result1.putScore, result2.putScore);
  assertEqual(result1.bullishFlowScore, result2.bullishFlowScore);
  assertEqual(result1.bearishFlowScore, result2.bearishFlowScore);
  assertEqual(result1.unusualActivityScore, result2.unusualActivityScore);
  assertEqual(result1.flowConviction, result2.flowConviction);
  assertEqual(result1.optionsQuality, result2.optionsQuality);
  assertEqual(result1.dataQuality.completeness, result2.dataQuality.completeness);
  assertEqual(JSON.stringify(result1.keySignals), JSON.stringify(result2.keySignals));
  assertEqual(JSON.stringify(result1.risks), JSON.stringify(result2.risks));
  assertEqual(JSON.stringify(result1.thesis), JSON.stringify(result2.thesis));
});

// === 22. No fabricated values ===
test('22. No fabricated values - flowDirection stays UNAVAILABLE', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  // Yahoo doesn't provide trade direction data
  assertEqual(result.flow.flowDirection, 'UNAVAILABLE');
  assertNull(result.flow.flowConfidence);
});

test('22b. No fabricated values - no sweep/block/whale claims', () => {
  const contracts = makeContracts({ volume: 10000, openInterest: 1000 });
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  const allFlags = [
    ...(result.flow.flowRiskFlags || []),
    ...(result.risks.map((r) => r.label)),
  ];
  for (const flag of allFlags) {
    assertFalse(
      flag.includes('SWEEP') || flag.includes('BLOCK') || flag.includes('WHALE') || flag.includes('SUPER'),
      `Flag "${flag}" should not claim sweep/block/whale without data`
    );
  }
});

test('22c. No fabricated values - no null treated as bullish/bearish', () => {
  const contracts = makeContracts(
    { volume: 100, openInterest: 500 },
    { volume: 100, openInterest: 500 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  // BALANCED flow should not produce bullish or bearish scores
  if (result.flow.callPutPressure === 'BALANCED') {
    assertNull(result.bullishFlowScore);
    assertNull(result.bearishFlowScore);
  }
});

test('22d. No fabricated values - missing data returns null not zero', () => {
  const result = defaultOptionsIntelligence('TEST');
  assertNull(result.callScore);
  assertNull(result.putScore);
  assertNull(result.bullishFlowScore);
  assertNull(result.bearishFlowScore);
  assertNull(result.unusualActivityScore);
  assertNull(result.underlyingPrice);
  assertNull(result.expiry);
});

// === 23. API contract ===
test('23. API contract - defaultOptionsIntelligence has all required fields', () => {
  const result = defaultOptionsIntelligence('TEST');

  const requiredKeys = [
    'ticker',
    'timestamp',
    'optionsAvailability',
    'callScore',
    'putScore',
    'bullishFlowScore',
    'bearishFlowScore',
    'unusualActivityScore',
    'flowConviction',
    'optionsQuality',
    'optionsAction',
    'thesis',
    'keySignals',
    'risks',
    'provenance',
    'dataQuality',
  ];

  for (const key of requiredKeys) {
    assertTrue(key in result, `Missing required key: ${key}`);
  }

  assertEqual(result.optionsAvailability, false);
  assertEqual(result.optionsAction, 'INSUFFICIENT_DATA');
  assertEqual(result.ticker, 'TEST');
});

test('23b. API contract - valid data has all required fields', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  const requiredKeys = [
    'ticker',
    'timestamp',
    'optionsAvailability',
    'callScore',
    'putScore',
    'bullishFlowScore',
    'bearishFlowScore',
    'unusualActivityScore',
    'flowConviction',
    'optionsQuality',
    'optionsAction',
    'thesis',
    'keySignals',
    'risks',
    'provenance',
    'dataQuality',
  ];

  for (const key of requiredKeys) {
    assertTrue(key in result, `Missing required key: ${key}`);
  }
});

// === 24. Regression against existing A2 contracts ===
test('24. Regression - B2 flows delegate to A2 functions correctly', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000 },
    { volume: 1000, openInterest: 2000 }
  );

  // B2 internally calls buildOptionsFlowIntelligence
  const a2Flow = buildOptionsFlowIntelligence(contracts);
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  // The flow output should match what B2 produces
  assertEqual(result.flow.callVolume, a2Flow.callVolume);
  assertEqual(result.flow.putVolume, a2Flow.putVolume);
  assertEqual(result.flow.callOI, a2Flow.callOI);
  assertEqual(result.flow.putOI, a2Flow.putOI);
  assertEqual(result.flow.callPutPressure, a2Flow.callPutPressure);
  assertEqual(result.flow.activityStrength, a2Flow.activityStrength);
  assertEqual(result.flow.dataStatus, a2Flow.dataStatus);
});

test('24b. Regression - B2 ranking matches A2 ranking', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.10 },
    { volume: 500, openInterest: 1000, premium: 0.50 }
  );

  const a2Ranking = rankOptionsContracts(contracts);
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  // Both should have same length
  assertEqual(result.ranking.length, a2Ranking.length);
  // Top-ranked contract should have same score
  assertEqual(result.ranking[0].contractRankScore, a2Ranking[0].contractRankScore);
});

test('24c. Regression - B2 summary matches A2 summary', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.10 },
    { volume: 500, openInterest: 1000, premium: 0.50 }
  );

  const a2Summary = buildBestContractSummary(contracts);
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  assertEqual(result.summary.bestContractRankScore, a2Summary.bestContractRankScore);
  assertEqual(result.summary.contractCount, a2Summary.contractCount);
  assertEqual(result.summary.dataStatus, a2Summary.dataStatus);
});

test('24d. Regression - B2 decision matches A2 decision', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.10, daysToExpiration: 30 },
    { volume: 500, openInterest: 1000, premium: 0.50, daysToExpiration: 30 }
  );

  const a2Decision = buildSymbolDecisionSummary(contracts);
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  assertEqual(result.decision.decisionScore, a2Decision.decisionScore);
  assertEqual(result.decision.decisionStatus, a2Decision.decisionStatus);
  assertEqual(result.decision.riskLevel, a2Decision.riskLevel);
});

// === Additional deterministic scoring tests ===

test('Flow scores - bullishFlowScore derived from callPutPressureScore', () => {
  const contracts = makeContracts(
    { volume: 10000, openInterest: 10000, premium: 0.50 },
    { volume: 100, openInterest: 100, premium: 0.30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.callPutPressure, 'CALL_PRESSURE');
  assertNotNull(result.bullishFlowScore);
  assertTrue(result.bullishFlowScore === result.flow.callPutPressureScore);
});

test('Flow scores - bearishFlowScore = 100 - callPutPressureScore for PUT_PRESSURE', () => {
  const contracts = makeContracts(
    { volume: 100, openInterest: 100, premium: 0.30 },
    { volume: 10000, openInterest: 10000, premium: 0.50 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.flow.callPutPressure, 'PUT_PRESSURE');
  assertNotNull(result.bearishFlowScore);
  assertEqual(result.bearishFlowScore, 100 - result.flow.callPutPressureScore);
});

test('classifyActivityScore - maps activity strengths correctly', () => {
  assertEqual(classifyActivityScore('VERY_HIGH'), 100);
  assertEqual(classifyActivityScore('HIGH'), 80);
  assertEqual(classifyActivityScore('NORMAL'), 60);
  assertEqual(classifyActivityScore('LOW'), 40);
  assertNull(classifyActivityScore('UNAVAILABLE'));
  assertNull(classifyActivityScore(null));
});

test('classifyConviction - maps flow confidence to conviction levels', () => {
  assertEqual(classifyConviction(85), 'HIGH');
  assertEqual(classifyConviction(80), 'HIGH');
  assertEqual(classifyConviction(65), 'MEDIUM');
  assertEqual(classifyConviction(50), 'LOW');
  assertEqual(classifyConviction(20), 'UNAVAILABLE');
  assertEqual(classifyConviction(null), 'UNAVAILABLE');
});

test('classifyQuality - maps scores to quality levels', () => {
  assertEqual(classifyQuality(90), 'EXCELLENT');
  assertEqual(classifyQuality(70), 'GOOD');
  assertEqual(classifyQuality(55), 'MODERATE');
  assertEqual(classifyQuality(37), 'WEAK');
  assertEqual(classifyQuality(null), 'UNAVAILABLE');
});

test('classifyAction - maps decision + pressure to action', () => {
  assertEqual(classifyAction('HIGH_QUALITY', 'CALL_PRESSURE', null), 'CONSIDER_OPENING');
  assertEqual(classifyAction('GOOD_QUALITY', 'CALL_PRESSURE', null), 'MONITOR');
  assertEqual(classifyAction('WATCH', 'CALL_PRESSURE', null), 'WATCH');
  assertEqual(classifyAction('LOW_QUALITY', 'CALL_PRESSURE', null), 'AVOID');
  assertEqual(classifyAction('UNAVAILABLE', 'CALL_PRESSURE', null), 'INSUFFICIENT_DATA');
});

test('buildFlowScores - balanced flow returns null scores', () => {
  const flow = { callPutPressure: 'BALANCED', callPutPressureScore: 50 };
  const pressure = { callPutPressure: 'BALANCED', callPutPressureScore: 50 };
  const premium = { premiumPressureScore: 50 };
  const result = buildFlowScores(flow, pressure, premium);
  assertNull(result.bullishFlowScore);
  assertNull(result.bearishFlowScore);
});

test('buildFlowScores - unavailable pressure uses premium pressure', () => {
  const flow = { callPutPressure: 'UNAVAILABLE', callPutPressureScore: null };
  const pressure = { callPutPressure: 'UNAVAILABLE', callPutPressureScore: null };
  const premium = { premiumPressureScore: 70 };
  const result = buildFlowScores(flow, pressure, premium);
  assertNotNull(result.bullishFlowScore);
  assertTrue(result.bullishFlowScore === 70);
  assertNull(result.bearishFlowScore);
});

test('buildKeySignals - includes pressure signal', () => {
  const contracts = makeContracts();
  const flow = buildOptionsFlowIntelligence(contracts);
  const pressure = { callPutPressure: 'BALANCED', callPutPressureScore: 50 };
  const premium = { premiumPressureScore: 50 };
  const signals = buildKeySignals(contracts, flow, pressure, premium);
  assertTrue(signals.some((s) => s.toLowerCase().includes('pressure')));
  assertTrue(signals.length > 0);
});

test('buildRisks - empty for healthy contracts', () => {
  const contracts = makeContracts(
    { volume: 2000, openInterest: 2000, spreadPct: 3, daysToExpiration: 30, impliedVolatility: 0.30 },
    { volume: 2000, openInterest: 2000, spreadPct: 3, daysToExpiration: 30, impliedVolatility: 0.30 }
  );
  const flow = buildOptionsFlowIntelligence(contracts);
  const ranking = rankOptionsContracts(contracts);
  const risks = buildRisks(ranking, flow, contracts);
  assertTrue(risks.length === 0, `Expected 0 risks for healthy contracts, got ${risks.length}`);
});

test('buildRisks - flags high IV', () => {
  const contracts = makeContracts(
    { volume: 2000, openInterest: 2000, impliedVolatility: 1.5 },
    { volume: 2000, openInterest: 2000, impliedVolatility: 1.5 }
  );
  const flow = buildOptionsFlowIntelligence(contracts);
  const ranking = rankOptionsContracts(contracts);
  const risks = buildRisks(ranking, flow, contracts);
  assertTrue(risks.some((r) => r.label === 'EXTREME_IV'));
});

test('buildDataQuality - provider field set correctly', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts, {
    providerStatus: { provider: 'yahoo', source: 'Yahoo Finance options chain', available: true },
  });
  assertEqual(result.dataQuality.provider, 'yahoo');
  assertTrue(result.dataQuality.available === true);
});

test('buildDataQuality - default provider when providerStatus missing', () => {
  const contracts = makeContracts({ premium: 0.50, volume: 500, openInterest: 1000, bid: 0.48, ask: 0.52, impliedVolatility: 0.45 });
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertEqual(result.dataQuality.provider, 'yahoo');
});

test('rankOptionsOpportunities - sorts by flow score', () => {
  const contracts1 = makeContracts(
    { volume: 10000, openInterest: 1000 },
    { volume: 10000, openInterest: 1000 }
  );
  const contracts2 = makeContracts(
    { volume: 100, openInterest: 1000 },
    { volume: 100, openInterest: 1000 }
  );
  const r1 = buildOptionsIntelligenceResult('HIGH', contracts1);
  const r2 = buildOptionsIntelligenceResult('LOW', contracts2);
  const { ranked, top, alternatives } = rankOptionsOpportunities([r2, r1]);
  assertTrue(ranked[0].ticker === 'HIGH');
  assertTrue(ranked.length === 2);
  assertTrue(top.length === 2);
  assertTrue(alternatives.length === 0);
});

test('rankOptionsOpportunities - empty input returns empty arrays', () => {
  const { ranked, top, alternatives } = rankOptionsOpportunities([]);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
});

test('rankOptionsOpportunities - null input returns empty arrays', () => {
  const { ranked, top, alternatives } = rankOptionsOpportunities(null);
  assertEqual(ranked.length, 0);
  assertEqual(top.length, 0);
  assertEqual(alternatives.length, 0);
});

test('clamp - clamps values to range', () => {
  assertEqual(clamp(150, 0, 100), 100);
  assertEqual(clamp(-10, 0, 100), 0);
  assertEqual(clamp(50, 0, 100), 50);
});

test('n - number coercion', () => {
  assertEqual(n('42'), 42);
  assertEqual(n(null), null);
  assertEqual(n(undefined), null);
  assertEqual(n(NaN), null);
  assertEqual(n('abc'), null);
});

test('Default intelligence preserves null for all scores', () => {
  const result = defaultOptionsIntelligence('SYMBOL');
  assertEqual(result.ticker, 'SYMBOL');
  assertEqual(result.optionsAvailability, false);
  assertEqual(result.callScore, null);
  assertEqual(result.putScore, null);
  assertEqual(result.bullishFlowScore, null);
  assertEqual(result.bearishFlowScore, null);
  assertEqual(result.unusualActivityScore, null);
  assertEqual(result.flowConviction, 'UNAVAILABLE');
  assertEqual(result.optionsQuality, 'UNAVAILABLE');
  assertEqual(result.optionsAction, 'INSUFFICIENT_DATA');
  assertEqual(result.dataQuality.available, false);
  assertEqual(result.dataQuality.completeness, 0);
  assertTrue(Array.isArray(result.keySignals));
  assertTrue(Array.isArray(result.risks));
  assertTrue(typeof result.provenance === 'object' && result.provenance !== null);
});

test('Options intelligence result has no undefined fields', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) {
      throw new Error(`Field "${key}" is undefined`);
    }
  }
});

test('Options intelligence result sub-objects have no undefined fields', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  const checkObject = (obj, name) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        throw new Error(`Field "${name}.${key}" is undefined`);
      }
    }
  };

  checkObject(result.calls, 'calls');
  checkObject(result.puts, 'calls');
  checkObject(result.flow, 'flow');
  checkObject(result.dataQuality, 'dataQuality');
  checkObject(result.provenance, 'provenance');
});

test('Per-contract intelligence embedded in calls/puts', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.30, optionType: 'CALL' },
    { volume: 1000, openInterest: 2000, premium: 0.30, optionType: 'PUT' }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.calls.intelligence.length === 1);
  assertTrue(result.puts.intelligence.length === 1);
  assertNotNull(result.calls.intelligence[0].optionsScore);
  assertNotNull(result.puts.intelligence[0].optionsScore);
});

test('B2 thesis is a non-empty string for valid data', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(typeof result.thesis === 'string');
  assertTrue(result.thesis.length > 10);
});

test('B2 thesis explains when insufficient data', () => {
  const result = buildOptionsIntelligenceResult('TEST', null);
  assertTrue(result.thesis.includes('No options chain data'));
});

test('No NaN or Infinity in any numeric output', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.30, bid: 0.28, ask: 0.32, impliedVolatility: 0.40 },
    { volume: 500, openInterest: 1000, premium: 0.40, bid: 0.38, ask: 0.42, impliedVolatility: 0.50 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);

  const numericFields = [
    result.callScore,
    result.putScore,
    result.bullishFlowScore,
    result.bearishFlowScore,
    result.unusualActivityScore,
    result.flow.callVolume,
    result.flow.putVolume,
    result.flow.callOI,
    result.flow.putOI,
    result.flow.callVolumeRatio,
    result.flow.putVolumeRatio,
    result.flow.callOIRatio,
    result.flow.putOIRatio,
    result.flow.callPremium,
    result.flow.putPremium,
    result.flow.callPremiumVolume,
    result.flow.putPremiumVolume,
    result.flow.premiumPressureScore,
    result.flow.callPutPressureScore,
    result.flow.volumeToOIRatio,
    result.flow.flowConfidence,
    result.flow.flowScore,
    result.dataQuality.completeness,
    result.underlyingPrice,
  ];

  for (const value of numericFields) {
    if (value != null) {
      assertTrue(
        Number.isFinite(value),
        `Expected finite, got ${value}`
      );
    }
  }

  assertTrue(
    Number.isFinite(result.calls.score) || result.calls.score === null,
    'callScore should be finite or null'
  );
  assertTrue(
    Number.isFinite(result.puts.score) || result.puts.score === null,
    'putScore should be finite or null'
  );
});

test('Provider metadata preserved in output', () => {
  const contracts = makeContracts();
  const result = buildOptionsIntelligenceResult('TEST', contracts, {
    providerStatus: { provider: 'yahoo', source: 'Yahoo Finance options chain', available: true },
    timestamp: '2025-01-15T10:00:00Z',
  });
  assertEqual(result.provider, 'yahoo');
  assertEqual(result.source, 'Yahoo Finance options chain');
  assertEqual(result.timestamp, '2025-01-15T10:00:00Z');
});

test('Strategy candidates built when contracts provided', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.10, daysToExpiration: 30, distancePct: 2, strike: 50, underlying: 50 },
    { volume: 1000, openInterest: 2000, premium: 0.10, daysToExpiration: 30, distancePct: 2, strike: 50, underlying: 50 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertNotNull(result.strategies);
  assertTrue(result.strategies.strategyCandidates !== undefined);
});

test('Strategy decision present in output', () => {
  const contracts = makeContracts(
    { volume: 1000, openInterest: 2000, premium: 0.10, daysToExpiration: 30 },
    { volume: 1000, openInterest: 2000, premium: 0.10, daysToExpiration: 30 }
  );
  const result = buildOptionsIntelligenceResult('TEST', contracts);
  assertTrue(result.strategyDecision !== undefined && result.strategyDecision !== null);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`B2 Options Intelligence Manager Tests: ${passCount} passed, ${failCount} failed`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
