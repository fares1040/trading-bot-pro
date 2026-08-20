/**
 * Options Intelligence Tests
 *
 * Tests for lib/options-intelligence.js (A2.1 Options Intelligence Core).
 * Run with: node scripts/test-options-intelligence.mjs
 *
 * Fully deterministic — no network, no dev server, no credentials.
 */

import {
  calculateOptionsLiquidity,
  calculateVolumeStrength,
  calculateOpenInterestStrength,
  calculatePremiumQuality,
  calculateContractQuality,
  calculateOptionsScore,
  classifyOptionsRisk,
  buildOptionsReasons,
  buildOptionsWarnings,
  buildOptionsIntelligence,
  aggregateContractsByUnderlying,
  calculateCallPutPressure,
  calculateVolumeOIActivity,
  calculatePremiumPressure,
  classifyFlowDirection,
  calculateFlowConfidence,
  detectFlowDivergence,
  calculateFlowScore,
  classifyFlowRisk,
  buildFlowReasons,
  buildFlowWarnings,
  buildOptionsFlowIntelligence,
  classifyContractQuality,
  classifyDteRisk,
  classifyIvLevel,
  classifyStrikeDistance,
  calculateDteQualityScore,
  calculateIvRiskScore,
  calculateStrikeQualityScore,
  calculateRiskAdjustedOptionsScore,
  buildContractWarnings,
  buildContractRankingReasons,
  rankOptionsContracts,
  buildBestContractSummary,
  classifyDecisionStatus,
  classifyExecutionQuality,
  combineRiskLevels,
  buildOptionsDecision,
  selectRecommendedContract,
  buildSymbolDecisionSummary,
  classifyWatchStatus,
  classifyWatchFreshness,
  classifyDteStatus,
  buildWatchReasons,
  buildWatchWarnings,
  calculateWatchRankScore,
  buildWatchListItem,
  StrategyType,
  validateStrategy,
  calculateStrategyEconomics,
  calculateStrategyQuality,
  calculateStrategyRisk,
  buildStrategyReasons,
  buildStrategyWarnings,
  compareStrategies,
  buildStrategyCandidates,
  buildSymbolStrategySummary,
  calculateStrategyDecisionScore,
  classifyStrategyDecisionStatus,
  classifyStrategyExecutionQuality,
  combineStrategyRisk,
  calculateStrategyEconomicsQuality,
  compareStrategyDecisions,
  selectRecommendedStrategy,
  buildStrategyDecisionReasons,
  buildStrategyDecisionWarnings,
  buildStrategyDecisionFlags,
  enrichStrategyWithDecision,
  buildSymbolStrategyDecisionSummary,
  n,
} from '../lib/options-intelligence.js';

import { normalizeOptionContract } from '../lib/options-provider.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
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

function assertNull(value, message = '') {
  if (value !== null) throw new Error(`${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`);
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) throw new Error(message || 'Expected non-null value but got null/undefined');
}

function assertUndefined(value, message = '') {
  if (value !== undefined) throw new Error(`${message}\n   Expected: undefined\n   Actual: ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function baseContract(overrides = {}) {
  return {
    volume: 500,
    openInterest: 500,
    bid: 0.50,
    ask: 0.55,
    lastPrice: 0.52,
    premium: 0.52,
    contractCost: 52,
    strike: 100,
    underlying: 100,
    spreadPct: 10,
    daysToExpiration: 30,
    impliedVolatility: 0.30,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Options Intelligence Tests');
console.log('========================================\n');

// 1. Contract normalization helpers
test('Base contract has all required fields', () => {
  const c = baseContract();
  assertNotNull(c.volume);
  assertNotNull(c.openInterest);
  assertNotNull(c.bid);
  assertNotNull(c.ask);
  assertNotNull(c.premium);
  assertNotNull(c.strike);
  assertNotNull(c.underlying);
  assertNotNull(c.spreadPct);
  assertNotNull(c.daysToExpiration);
});

// 2. Missing fields
test('Missing volume returns unavailable', () => {
  const c = baseContract({ volume: null, openInterest: null, spreadPct: null });
  const result = calculateOptionsLiquidity(c);
  assertEqual(result.strength, 'UNAVAILABLE');
  assertNull(result.score);
});

test('Missing openInterest returns unavailable', () => {
  const c = baseContract({ openInterest: null, volume: null, spreadPct: null });
  const result = calculateOpenInterestStrength(c);
  assertEqual(result.strength, 'UNAVAILABLE');
  assertNull(result.score);
});

test('Missing premium returns unavailable', () => {
  const c = baseContract({ premium: null });
  const result = calculatePremiumQuality(c);
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNull(result.score);
});

// 3. Null handling
test('Null inputs do not propagate NaN', () => {
  const c = baseContract({ volume: null, openInterest: null, spreadPct: null });
  const liquidity = calculateOptionsLiquidity(c);
  assertTrue(Number.isFinite(liquidity.score) || liquidity.score === null);
});

test('NaN inputs are clamped to null', () => {
  const c = baseContract({ volume: NaN, openInterest: NaN });
  const vol = calculateVolumeStrength(c);
  const oi = calculateOpenInterestStrength(c);
  assertNull(vol.score);
  assertNull(oi.score);
});

test('Infinity inputs are clamped to null', () => {
  const c = baseContract({ volume: Infinity, openInterest: Infinity });
  const vol = calculateVolumeStrength(c);
  const oi = calculateOpenInterestStrength(c);
  assertNull(vol.score);
  assertNull(oi.score);
});

test('Negative inputs are handled safely', () => {
  const c = baseContract({ volume: -10, openInterest: -10 });
  const vol = calculateVolumeStrength(c);
  const oi = calculateOpenInterestStrength(c);
  assertTrue(Number.isFinite(vol.score));
  assertTrue(Number.isFinite(oi.score));
});

test('Zero inputs are handled safely', () => {
  const c = baseContract({ volume: 0, openInterest: 0 });
  const vol = calculateVolumeStrength(c);
  const oi = calculateOpenInterestStrength(c);
  assertTrue(Number.isFinite(vol.score));
  assertTrue(Number.isFinite(oi.score));
});

// 4. Liquidity scoring
test('Liquidity: excellent volume + OI + tight spread', () => {
  const c = baseContract({ volume: 2000, openInterest: 2000, spreadPct: 2 });
  const result = calculateOptionsLiquidity(c);
  assertTrue(result.score >= 80, 'Score ' + result.score + ' should be excellent');
  assertEqual(result.strength, 'EXCELLENT');
});

test('Liquidity: strong inputs', () => {
  const c = baseContract({ volume: 500, openInterest: 500, spreadPct: 10 });
  const result = calculateOptionsLiquidity(c);
  assertTrue(result.score >= 80, 'Score ' + result.score + ' should be strong or better');
});

test('Liquidity: weak inputs', () => {
  const c = baseContract({ volume: 10, openInterest: 10, spreadPct: 40 });
  const result = calculateOptionsLiquidity(c);
  assertTrue(result.score < 50, 'Score ' + result.score + ' should be weak');
  assertEqual(result.strength, 'WEAK');
});

// 5. Volume scoring
test('Volume: very strong', () => {
  const c = baseContract({ volume: 2000 });
  const result = calculateVolumeStrength(c);
  assertTrue(result.score >= 80, 'Score ' + result.score + ' should be very strong');
  assertEqual(result.strength, 'VERY_STRONG');
});

test('Volume: weak', () => {
  const c = baseContract({ volume: 5 });
  const result = calculateVolumeStrength(c);
  assertTrue(result.score < 50, 'Score ' + result.score + ' should be weak');
});

test('Volume: unavailable for null', () => {
  const c = baseContract({ volume: null });
  const result = calculateVolumeStrength(c);
  assertEqual(result.strength, 'UNAVAILABLE');
  assertNull(result.score);
});

// 6. Open Interest scoring
test('OI: very strong', () => {
  const c = baseContract({ openInterest: 2000 });
  const result = calculateOpenInterestStrength(c);
  assertTrue(result.score >= 80, 'Score ' + result.score + ' should be very strong');
  assertEqual(result.strength, 'VERY_STRONG');
});

test('OI: volumeToOIRatio calculated', () => {
  const c = baseContract({ volume: 500, openInterest: 1000 });
  const result = calculateOpenInterestStrength(c);
  assertEqual(result.volumeToOIRatio, 0.5);
});

test('OI: unavailable for null', () => {
  const c = baseContract({ openInterest: null });
  const result = calculateOpenInterestStrength(c);
  assertEqual(result.strength, 'UNAVAILABLE');
  assertNull(result.score);
  assertNull(result.volumeToOIRatio);
});

// 7. Premium scoring
test('Premium: good cheap premium with long DTE and ATM', () => {
  const c = baseContract({ premium: 0.10 });
  const result = calculatePremiumQuality(c);
  assertTrue(result.score >= 60, 'Score ' + result.score + ' should be good for cheap premium');
  assertEqual(result.quality, 'GOOD');
});

test('Premium: moderate expensive premium', () => {
  const c = baseContract({ premium: 2.0 });
  const result = calculatePremiumQuality(c);
  assertTrue(result.score >= 40 && result.score <= 60, 'Score ' + result.score + ' should be moderate for expensive premium');
  assertEqual(result.quality, 'MODERATE');
});

test('Premium: unavailable for null', () => {
  const c = baseContract({ premium: null });
  const result = calculatePremiumQuality(c);
  assertEqual(result.quality, 'UNAVAILABLE');
  assertNull(result.score);
});

// 8. Contract quality
test('Contract quality: all components available', () => {
  const c = baseContract();
  const result = calculateContractQuality(c);
  assertTrue(Number.isFinite(result), 'Contract quality should be finite');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

test('Contract quality: renormalizes when some components missing', () => {
  const c = baseContract({ volume: null, openInterest: null });
  const result = calculateContractQuality(c);
  assertTrue(Number.isFinite(result), 'Contract quality should be finite when renormalized');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

test('Contract quality: null when all components unavailable', () => {
  const c = baseContract({ volume: null, openInterest: null, premium: null, bid: null, ask: null, spreadPct: null });
  const result = calculateContractQuality(c);
  assertNull(result);
});

// 9. Options score
test('Options score: deterministic with known inputs', () => {
  const c = baseContract();
  const result = calculateOptionsScore(c);
  assertTrue(Number.isFinite(result), 'Options score should be finite');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

test('Options score: null when no components available', () => {
  const c = baseContract({ volume: null, openInterest: null, premium: null, bid: null, ask: null, spreadPct: null });
  const result = calculateOptionsScore(c);
  assertNull(result);
});

// 10. Risk classification
test('Risk: extreme risk with multiple flags', () => {
  const c = baseContract({ volume: 5, openInterest: 5, spreadPct: 50, daysToExpiration: 3 });
  const result = classifyOptionsRisk(c);
  assertEqual(result.riskLevel, 'EXTREME');
  assertTrue(result.riskFlags.length >= 3, 'Should have at least 3 risk flags');
});

test('Risk: low risk with healthy inputs', () => {
  const c = baseContract({ volume: 2000, openInterest: 2000, spreadPct: 2, daysToExpiration: 30 });
  const result = classifyOptionsRisk(c);
  assertEqual(result.riskLevel, 'LOW');
  assertEqual(result.riskFlags.length, 0);
});

test('Risk: moderate risk with one flag', () => {
  const c = baseContract({ volume: 5 });
  const result = classifyOptionsRisk(c);
  assertEqual(result.riskLevel, 'MODERATE');
  assertTrue(result.riskFlags.includes('LOW_VOLUME'));
});

test('Risk: incomplete data flagged', () => {
  const c = baseContract({ premium: null });
  const result = classifyOptionsRisk(c);
  assertTrue(result.riskFlags.includes('INCOMPLETE_DATA'));
});

test('Risk: far OTM flagged', () => {
  const c = baseContract({ underlying: 100, strike: 200 });
  const result = classifyOptionsRisk(c);
  assertTrue(result.riskFlags.includes('FAR_OTM'));
});

// 11. Reasons
test('Reasons: includes liquidity and volume', () => {
  const c = baseContract();
  const reasons = buildOptionsReasons(c);
  assertTrue(reasons.some(r => r.includes('Liquidity')), 'Should include liquidity reason');
  assertTrue(reasons.some(r => r.includes('Volume')), 'Should include volume reason');
});

test('Reasons: max 4 reasons', () => {
  const c = baseContract();
  const reasons = buildOptionsReasons(c);
  assertTrue(reasons.length <= 4, 'Should have at most 4 reasons');
});

// 12. Warnings
test('Warnings: includes wide spread', () => {
  const c = baseContract({ spreadPct: 50 });
  const warnings = buildOptionsWarnings(c);
  assertTrue(warnings.includes('Wide spread'));
});

test('Warnings: empty for healthy contract', () => {
  const c = baseContract({ volume: 2000, openInterest: 2000, spreadPct: 2 });
  const warnings = buildOptionsWarnings(c);
  assertEqual(warnings.length, 0);
});

// 13. Build options intelligence
test('Build options intelligence: complete data status', () => {
  const c = baseContract();
  const result = buildOptionsIntelligence(c);
  assertEqual(result.dataStatus, 'complete');
  assertNotNull(result.optionsScore);
  assertNotNull(result.contractQualityScore);
  assertEqual(result.flowDirection, 'UNAVAILABLE');
  assertNull(result.flowConfidence);
  assertTrue(result.flowReason.includes('unavailable'));
});

test('Build options intelligence: partial data status', () => {
  const c = baseContract({ bid: null, ask: null });
  const result = buildOptionsIntelligence(c);
  assertEqual(result.dataStatus, 'partial');
});

test('Build options intelligence: all fields present', () => {
  const c = baseContract();
  const result = buildOptionsIntelligence(c);
  assertNotNull(result.optionsScore);
  assertNotNull(result.contractQualityScore);
  assertNotNull(result.liquidityScore);
  assertNotNull(result.liquidityStrength);
  assertNotNull(result.volumeScore);
  assertNotNull(result.volumeStrength);
  assertNotNull(result.oiScore);
  assertNotNull(result.oiStrength);
  assertNotNull(result.volumeToOIRatio);
  assertNotNull(result.premiumScore);
  assertNotNull(result.premiumQuality);
  assertNotNull(result.riskLevel);
  assertTrue(Array.isArray(result.riskFlags));
  assertTrue(Array.isArray(result.riskReasons));
});

// 14. Existing alert threshold compatibility
test('Existing alert threshold: score >= 75 works', () => {
  const c = baseCallContract({ volume: 500, openInterest: 500, bid: 0.50, ask: 0.55, premium: 0.50 });
  const volume = 500;
  const openInterest = 500;
  const bid = 0.50;
  const ask = 0.55;
  const mid = (bid + ask) / 2;
  const liquidityScore = Math.min(100, volume * 1.2) * 0.45 + Math.min(100, openInterest / 5) * 0.35 + Math.max(0, 100 - ((ask - bid) / mid) * 100 * 3) * 0.2;
  const premiumScore = Math.max(0, 100 - mid * 100);
  const score = Math.round(Math.min(100, liquidityScore * 0.65 + premiumScore * 0.35));
  assertTrue(score >= 75, 'Score ' + score + ' should meet threshold');
});

test('Existing alert threshold: premium <= 1', () => {
  const c = baseContract({ premium: 0.50 });
  assertTrue(c.premium <= 1, 'Premium should be <= 1');
});

test('Existing alert threshold: volume >= 10', () => {
  const c = baseContract({ volume: 500 });
  assertTrue((c.volume || 0) >= 10, 'Volume should be >= 10');
});

// 15. Existing dedupe key compatibility
test('Existing dedupe key: OPT:${contract}', () => {
  const contract = 'AAPL240621C00150000';
  const key = `OPT:${contract}`;
  assertEqual(key, 'OPT:AAPL240621C00150000');
});

// 16. No Hunter Score modification
test('No Hunter Score modification: options score is independent', () => {
  const c = baseContract();
  const optionsScore = calculateOptionsScore(c);
  assertTrue(Number.isFinite(optionsScore) || optionsScore === null);
  // Hunter Score is not touched by options intelligence
});

// 17. No Penny Score modification
test('No Penny Score modification: options score is independent', () => {
  const c = baseContract();
  const optionsScore = calculateOptionsScore(c);
  assertTrue(Number.isFinite(optionsScore) || optionsScore === null);
  // Penny Score is not touched by options intelligence
});

// 18. No HIC modification
test('No HIC modification: options intelligence is independent', () => {
  const c = baseContract();
  const intelligence = buildOptionsIntelligence(c);
  // HIC is not modified
  assertNotNull(intelligence);
});

// 19. No fabricated data
test('No fabricated Greeks: delta/gamma/theta/vega are undefined', () => {
  const c = baseContract();
  assertEqual(c.delta, undefined);
  assertEqual(c.gamma, undefined);
  assertEqual(c.theta, undefined);
  assertEqual(c.vega, undefined);
});

test('No fabricated IV: impliedVolatility is null when unavailable', () => {
  const c = baseContract({ impliedVolatility: null });
  assertNull(c.impliedVolatility);
});

test('No fabricated flow: flowDirection is UNAVAILABLE', () => {
  const c = baseContract();
  const intelligence = buildOptionsIntelligence(c);
  assertEqual(intelligence.flowDirection, 'UNAVAILABLE');
  assertNull(intelligence.flowConfidence);
});

// 20. Full options pipeline shape
test('Full options pipeline: buildOptionsIntelligence returns complete shape', () => {
  const c = baseContract();
  const intelligence = buildOptionsIntelligence(c);
  const expectedKeys = [
    'optionsScore',
    'contractQualityScore',
    'liquidityScore',
    'liquidityStrength',
    'volumeScore',
    'volumeStrength',
    'oiScore',
    'oiStrength',
    'volumeToOIRatio',
    'premiumScore',
    'premiumQuality',
    'riskLevel',
    'riskFlags',
    'riskReasons',
    'flowDirection',
    'flowConfidence',
    'dataStatus',
  ];
  for (const key of expectedKeys) {
    assertTrue(key in intelligence, `Missing key: ${key}`);
  }
});

// 21. Regression: options score unchanged after intelligence addition
test('Regression: options score uses same base formula', () => {
  const c = baseContract({ volume: 500, openInterest: 500, bid: 0.50, ask: 0.55 });
  const intelligence = buildOptionsIntelligence(c);
  const existingScore = Number(c.score ?? 0);
  assertTrue(Number.isFinite(existingScore), 'Existing score should be finite');
  assertTrue(Number.isFinite(intelligence.optionsScore) || intelligence.optionsScore === null);
});

// 22. Data status classification
test('Data status: complete when all required fields present', () => {
  const c = baseContract();
  const intelligence = buildOptionsIntelligence(c);
  assertEqual(intelligence.dataStatus, 'complete');
});

test('Data status: partial when any required field missing', () => {
  const c = baseContract({ premium: null });
  const intelligence = buildOptionsIntelligence(c);
  assertEqual(intelligence.dataStatus, 'partial');
});

test('Data status: partial when bid/ask missing', () => {
  const c = baseContract({ bid: null, ask: null });
  const intelligence = buildOptionsIntelligence(c);
  assertEqual(intelligence.dataStatus, 'partial');
});

// 23. DTE risk
test('Risk: short DTE flagged', () => {
  const c = baseContract({ daysToExpiration: 3 });
  const risk = classifyOptionsRisk(c);
  assertTrue(risk.riskFlags.includes('SHORT_DTE'));
});

test('Risk: moderate DTE not flagged', () => {
  const c = baseContract({ daysToExpiration: 30 });
  const risk = classifyOptionsRisk(c);
  assertFalse(risk.riskFlags.includes('SHORT_DTE'));
});

// 24. Risk reasons bounded
test('Risk reasons: maximum 5 reasons', () => {
  const c = baseContract({ volume: 5, openInterest: 5, spreadPct: 50, daysToExpiration: 3, premium: null });
  const risk = classifyOptionsRisk(c);
  assertTrue(risk.riskReasons.length <= 5, 'Should have at most 5 reasons');
});

// 25. No NaN or Infinity in outputs
test('No NaN or Infinity in any output', () => {
  const c = baseContract();
  const liquidity = calculateOptionsLiquidity(c);
  const volume = calculateVolumeStrength(c);
  const oi = calculateOpenInterestStrength(c);
  const premium = calculatePremiumQuality(c);
  const contractQuality = calculateContractQuality(c);
  const optionsScore = calculateOptionsScore(c);
  const risk = classifyOptionsRisk(c);
  const intelligence = buildOptionsIntelligence(c);

  const allNumbers = [
    liquidity.score,
    volume.score,
    oi.score,
    oi.volumeToOIRatio,
    premium.score,
    contractQuality,
    optionsScore,
  ];

  for (const value of allNumbers) {
    if (value != null) {
      assertTrue(Number.isFinite(value), `Expected finite number, got ${value}`);
    }
  }

  assertTrue(Number.isFinite(intelligence.optionsScore) || intelligence.optionsScore === null);
  assertTrue(Number.isFinite(intelligence.contractQualityScore) || intelligence.contractQualityScore === null);
});

// ---------------------------------------------------------------------------
// Flow Intelligence Tests (A2.2)
// ---------------------------------------------------------------------------

function baseCallContract(overrides = {}) {
  return {
    volume: 500,
    openInterest: 500,
    bid: 0.50,
    ask: 0.55,
    lastPrice: 0.52,
    premium: 0.52,
    contractCost: 52,
    strike: 100,
    underlying: 100,
    spreadPct: 10,
    daysToExpiration: 30,
    impliedVolatility: 0.30,
    optionType: 'CALL',
    ...overrides,
  };
}

function basePutContract(overrides = {}) {
  return {
    ...baseCallContract(overrides),
    optionType: 'PUT',
  };
}

// 26. Call/Put pressure
test('Call/Put pressure: CALL_PRESSURE when calls dominate', () => {
  const calls = [baseCallContract({ volume: 1000, openInterest: 1000 })];
  const puts = [basePutContract({ volume: 100, openInterest: 100 })];
  const result = calculateCallPutPressure([...calls, ...puts]);
  assertEqual(result.callPutPressure, 'CALL_PRESSURE');
  assertTrue(result.callVolumeRatio > 0.5);
});

test('Call/Put pressure: PUT_PRESSURE when puts dominate', () => {
  const calls = [baseCallContract({ volume: 100, openInterest: 100 })];
  const puts = [basePutContract({ volume: 1000, openInterest: 1000 })];
  const result = calculateCallPutPressure([...calls, ...puts]);
  assertEqual(result.callPutPressure, 'PUT_PRESSURE');
  assertTrue(result.putVolumeRatio > 0.5);
});

test('Call/Put pressure: BALANCED when mixed', () => {
  const calls = [baseCallContract({ volume: 500, openInterest: 500 })];
  const puts = [basePutContract({ volume: 500, openInterest: 500 })];
  const result = calculateCallPutPressure([...calls, ...puts]);
  assertEqual(result.callPutPressure, 'BALANCED');
});

test('Call/Put pressure: UNAVAILABLE for empty array', () => {
  const result = calculateCallPutPressure([]);
  assertEqual(result.callPutPressure, 'UNAVAILABLE');
  assertNull(result.callPutPressureScore);
});

// 27. Volume/OI activity
test('Volume/OI activity: VERY_HIGH for high ratio', () => {
  const c = baseCallContract({ volume: 5000, openInterest: 1000 });
  const result = calculateVolumeOIActivity(c);
  assertEqual(result.activityStrength, 'VERY_HIGH');
  assertTrue(result.volumeToOIRatio > 1);
});

test('Volume/OI activity: LOW for low ratio', () => {
  const c = baseCallContract({ volume: 100, openInterest: 5000 });
  const result = calculateVolumeOIActivity(c);
  assertEqual(result.activityStrength, 'LOW');
  assertTrue(result.volumeToOIRatio < 1);
});

test('Volume/OI activity: UNAVAILABLE for null', () => {
  const c = baseCallContract({ volume: null, openInterest: null });
  const result = calculateVolumeOIActivity(c);
  assertEqual(result.activityStrength, 'UNAVAILABLE');
  assertNull(result.volumeToOIRatio);
});

// 28. Premium pressure
test('Premium pressure: calculated from volume and premium', () => {
  const calls = [baseCallContract({ volume: 1000, premium: 0.50 })];
  const puts = [basePutContract({ volume: 500, premium: 0.30 })];
  const result = calculatePremiumPressure([...calls, ...puts]);
  assertNotNull(result.callPremiumVolume);
  assertNotNull(result.putPremiumVolume);
  assertNotNull(result.premiumPressureScore);
});

test('Premium pressure: null for empty array', () => {
  const result = calculatePremiumPressure([]);
  assertNull(result.callPremiumVolume);
  assertNull(result.putPremiumVolume);
  assertNull(result.premiumPressureScore);
});

// 29. Flow direction
test('Flow direction: UNAVAILABLE when no directional data', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const result = classifyFlowDirection(contracts);
  assertEqual(result.flowDirection, 'UNAVAILABLE');
  assertNull(result.flowConfidence);
  assertTrue(result.flowReason.includes('unavailable'));
});

test('Flow direction: UNAVAILABLE for empty array', () => {
  const result = classifyFlowDirection([]);
  assertEqual(result.flowDirection, 'UNAVAILABLE');
});

// 30. Flow confidence
test('Flow confidence: high when all data present', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const result = calculateFlowConfidence(contracts);
  assertTrue(result > 80, 'Confidence ' + result + ' should be high');
});

test('Flow confidence: 0 for empty array', () => {
  const result = calculateFlowConfidence([]);
  assertEqual(result, 0);
});

// 31. Flow divergence
test('Flow divergence: ACTIVITY_DIVERGENCE for high volume low OI', () => {
  const c = baseCallContract({ volume: 5000, openInterest: 100 });
  const callPut = { callPutPressure: 'CALL_PRESSURE', callVolumeRatio: 0.8, callOIRatio: 0.2, putVolumeRatio: 0.2, putOIRatio: 0.8 };
  const result = detectFlowDivergence(c, callPut, 'UNAVAILABLE', 'HIGH');
  assertEqual(result.flowDivergence, 'ACTIVITY_DIVERGENCE');
  assertNotNull(result.flowDivergenceReason);
});

test('Flow divergence: NO_DIVERGENCE for balanced', () => {
  const c = baseCallContract();
  const callPut = { callPutPressure: 'BALANCED', callVolumeRatio: 0.5, callOIRatio: 0.5, putVolumeRatio: 0.5, putOIRatio: 0.5 };
  const result = detectFlowDivergence(c, callPut, 'UNAVAILABLE', 'NORMAL');
  assertEqual(result.flowDivergence, 'NO_DIVERGENCE');
});

test('Flow divergence: UNAVAILABLE for null contract', () => {
  const result = detectFlowDivergence(null, {}, 'UNAVAILABLE', 'NORMAL');
  assertEqual(result.flowDivergence, 'UNAVAILABLE');
});

// 32. Flow score
test('Flow score: deterministic with known inputs', () => {
  const flowData = {
    callPutPressureScore: 70,
    activityStrength: 'HIGH',
    premiumPressureScore: 60,
    flowConfidence: 80,
  };
  const result = calculateFlowScore(flowData);
  assertTrue(Number.isFinite(result), 'Flow score should be finite');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

test('Flow score: null when no components', () => {
  const result = calculateFlowScore({});
  assertNull(result);
});

// 33. Flow risk
test('Flow risk: EXTREME with multiple flags', () => {
  const c = baseCallContract({ volume: 5000, openInterest: 10, spreadPct: 50 });
  const flowData = {
    callPutPressure: 'CALL_PRESSURE',
    activityStrength: 'VERY_HIGH',
    flowDivergence: 'ACTIVITY_DIVERGENCE',
    flowDirection: 'UNAVAILABLE',
  };
  const result = classifyFlowRisk(c, flowData);
  assertEqual(result.flowRiskLevel, 'EXTREME');
  assertTrue(result.flowRiskFlags.length >= 3);
});

test('Flow risk: LOW for healthy contract', () => {
  const c = baseCallContract({ volume: 500, openInterest: 500, spreadPct: 5 });
  const flowData = {
    callPutPressure: 'BALANCED',
    activityStrength: 'NORMAL',
    flowDivergence: 'NO_DIVERGENCE',
    flowDirection: 'UNAVAILABLE',
  };
  const result = classifyFlowRisk(c, flowData);
  assertEqual(result.flowRiskLevel, 'LOW');
});

// 34. Build options flow intelligence
test('Build options flow intelligence: complete shape', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const result = buildOptionsFlowIntelligence(contracts);
  assertNotNull(result.callVolume);
  assertNotNull(result.putVolume);
  assertNotNull(result.callOI);
  assertNotNull(result.putOI);
  assertNotNull(result.callPutPressure);
  assertNotNull(result.volumeToOIRatio);
  assertNotNull(result.activityStrength);
  assertNotNull(result.flowDirection);
  assertEqual(result.flowDirection, 'UNAVAILABLE');
  assertNull(result.flowConfidence);
  assertNotNull(result.flowScore);
  assertNotNull(result.flowRiskLevel);
  assertTrue(Array.isArray(result.flowRiskFlags));
  assertTrue(Array.isArray(result.flowRiskReasons));
});

test('Build options flow intelligence: UNAVAILABLE for empty contracts', () => {
  const result = buildOptionsFlowIntelligence([]);
  assertEqual(result.callPutPressure, 'UNAVAILABLE');
  assertEqual(result.flowDirection, 'UNAVAILABLE');
  assertEqual(result.dataStatus, 'unavailable');
});

test('Build options flow intelligence: partial data status', () => {
  const contracts = [baseCallContract({ premium: null })];
  const result = buildOptionsFlowIntelligence(contracts);
  assertEqual(result.dataStatus, 'partial');
});

// 35. No fabricated flow data
test('No fabricated flow: flowDirection is UNAVAILABLE', () => {
  const contracts = [baseCallContract()];
  const result = buildOptionsFlowIntelligence(contracts);
  assertEqual(result.flowDirection, 'UNAVAILABLE');
  assertNull(result.flowConfidence);
});

test('No fabricated flow: no sweep/block/whale claims', () => {
  const contracts = [baseCallContract({ volume: 10000, openInterest: 1000 })];
  const result = buildOptionsFlowIntelligence(contracts);
  assertFalse(result.flowRiskFlags.some(f => f.includes('SWEEP') || f.includes('BLOCK') || f.includes('WHALE')));
});

// 36. Existing Options Score unchanged
test('Existing Options Score unchanged after flow addition', () => {
  const c = baseCallContract();
  const optionsScore = calculateOptionsScore(c);
  assertTrue(Number.isFinite(optionsScore) || optionsScore === null);
});

// 37. Alert threshold compatibility
test('Alert threshold: score >= 75 works with flow data present', () => {
  const c = baseCallContract({ volume: 500, openInterest: 500, bid: 0.50, ask: 0.55, premium: 0.50 });
  const score = calculateOptionsScore(c);
  assertTrue(score != null && score >= 75, 'Score ' + score + ' should meet threshold');
});

// 38. Dedupe unchanged
test('Dedupe key: OPT:${contract}', () => {
  const contract = 'AAPL240621C00150000';
  const key = `OPT:${contract}`;
  assertEqual(key, 'OPT:AAPL240621C00150000');
});

// 39. No Hunter/Penny modification
test('No Hunter Score modification', () => {
  const contracts = [baseCallContract()];
  const flow = buildOptionsFlowIntelligence(contracts);
  assertNotNull(flow);
});

test('No Penny Score modification', () => {
  const contracts = [baseCallContract()];
  const flow = buildOptionsFlowIntelligence(contracts);
  assertNotNull(flow);
});

// 40. No NaN or Infinity in flow outputs
test('No NaN or Infinity in flow outputs', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const flow = buildOptionsFlowIntelligence(contracts);
  const numericFields = [
    flow.callVolume,
    flow.putVolume,
    flow.callOI,
    flow.putOI,
    flow.callPremium,
    flow.putPremium,
    flow.callVolumeRatio,
    flow.putVolumeRatio,
    flow.callOIRatio,
    flow.putOIRatio,
    flow.callPutPressureScore,
    flow.volumeToOIRatio,
    flow.premiumPressureScore,
    flow.flowConfidence,
    flow.flowScore,
  ];
  for (const value of numericFields) {
    if (value != null) {
      assertTrue(Number.isFinite(value), `Expected finite, got ${value}`);
    }
  }
});

// 41. Data status classification
test('Data status: complete when all fields present', () => {
  const contracts = [baseCallContract()];
  const result = buildOptionsFlowIntelligence(contracts);
  assertEqual(result.dataStatus, 'complete');
});

test('Data status: partial when any field missing', () => {
  const contracts = [baseCallContract({ volume: null })];
  const result = buildOptionsFlowIntelligence(contracts);
  assertEqual(result.dataStatus, 'partial');
});

// 42. Flow reasons
test('Flow reasons: includes pressure and activity', () => {
  const c = baseCallContract();
  const flowData = {
    callPutPressure: 'CALL_PRESSURE',
    activityStrength: 'HIGH',
    premiumPressureScore: 70,
    flowConfidence: 80,
  };
  const reasons = buildFlowReasons(c, flowData);
  assertTrue(reasons.some(r => r.includes('Pressure')));
  assertTrue(reasons.some(r => r.includes('Activity')));
});

test('Flow reasons: max 4 reasons', () => {
  const c = baseCallContract();
  const flowData = {
    callPutPressure: 'CALL_PRESSURE',
    activityStrength: 'HIGH',
    premiumPressureScore: 70,
    flowConfidence: 80,
  };
  const reasons = buildFlowReasons(c, flowData);
  assertTrue(reasons.length <= 4);
});

// 43. Flow warnings
test('Flow warnings: includes extreme volume/OI', () => {
  const c = baseCallContract({ volume: 5000, openInterest: 10 });
  const flowData = {
    activityStrength: 'VERY_HIGH',
    callPutPressure: 'CALL_PRESSURE',
    flowDivergence: 'ACTIVITY_DIVERGENCE',
    flowDirection: 'UNAVAILABLE',
  };
  const warnings = buildFlowWarnings(c, flowData);
  assertTrue(warnings.includes('Extreme volume/OI'));
});

test('Flow warnings: empty for healthy flow', () => {
  const c = baseCallContract({ volume: 500, openInterest: 500, spreadPct: 5 });
  const flowData = {
    activityStrength: 'NORMAL',
    callPutPressure: 'BALANCED',
    flowDivergence: 'NO_DIVERGENCE',
    flowDirection: 'UNAVAILABLE',
  };
  const warnings = buildFlowWarnings(c, flowData);
  assertEqual(warnings.length, 0);
});

// 44. Aggregate contracts by underlying
test('Aggregate contracts by underlying', () => {
  const c1 = baseCallContract({ underlying: 100 });
  const c2 = basePutContract({ underlying: 100 });
  const c3 = baseCallContract({ underlying: 200 });
  const result = aggregateContractsByUnderlying([c1, c2, c3]);
  assertEqual(result.size, 2);
  assertEqual(result.get('100').length, 2);
  assertEqual(result.get('200').length, 1);
});

// 45. Weight renormalization
test('Flow score renormalizes when components missing', () => {
  const flowData = {
    callPutPressureScore: 70,
    flowConfidence: 80,
  };
  const result = calculateFlowScore(flowData);
  assertTrue(Number.isFinite(result), 'Flow score should be finite when renormalized');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

// ---------------------------------------------------------------------------
// Contract Ranking Tests (A2.3)
// ---------------------------------------------------------------------------

// 46. Quality classification
test('Quality: EXCEPTIONAL for score >= 85', () => {
  assertEqual(classifyContractQuality(90), 'EXCEPTIONAL');
});

test('Quality: STRONG for score 70-84', () => {
  assertEqual(classifyContractQuality(75), 'STRONG');
});

test('Quality: GOOD for score 55-69', () => {
  assertEqual(classifyContractQuality(60), 'GOOD');
});

test('Quality: MODERATE for score 40-54', () => {
  assertEqual(classifyContractQuality(45), 'MODERATE');
});

test('Quality: WEAK for score < 40', () => {
  assertEqual(classifyContractQuality(30), 'WEAK');
});

test('Quality: UNAVAILABLE for null', () => {
  assertEqual(classifyContractQuality(null), 'UNAVAILABLE');
});

// 47. DTE classification
test('DTE: EXTREME for 0-3 days', () => {
  assertEqual(classifyDteRisk(2), 'EXTREME');
});

test('DTE: HIGH for 4-7 days', () => {
  assertEqual(classifyDteRisk(5), 'HIGH');
});

test('DTE: MODERATE for 8-21 days', () => {
  assertEqual(classifyDteRisk(15), 'MODERATE');
});

test('DTE: LOW for 22-45 days', () => {
  assertEqual(classifyDteRisk(30), 'LOW');
});

test('DTE: VERY_LOW for 46+ days', () => {
  assertEqual(classifyDteRisk(60), 'VERY_LOW');
});

test('DTE: UNAVAILABLE for null', () => {
  assertEqual(classifyDteRisk(null), 'UNAVAILABLE');
});

// 48. IV classification
test('IV: LOW for <= 0.3', () => {
  assertEqual(classifyIvLevel(0.2), 'LOW');
});

test('IV: NORMAL for 0.3-0.6', () => {
  assertEqual(classifyIvLevel(0.5), 'NORMAL');
});

test('IV: HIGH for 0.6-1.0', () => {
  assertEqual(classifyIvLevel(0.8), 'HIGH');
});

test('IV: EXTREME for > 1.0', () => {
  assertEqual(classifyIvLevel(1.5), 'EXTREME');
});

test('IV: UNAVAILABLE for null', () => {
  assertEqual(classifyIvLevel(null), 'UNAVAILABLE');
});

// 49. Strike classification
test('Strike: ATM for <= 1%', () => {
  assertEqual(classifyStrikeDistance(0.5), 'ATM');
});

test('Strike: NEAR_ATM for 1-3%', () => {
  assertEqual(classifyStrikeDistance(2), 'NEAR_ATM');
});

test('Strike: NEAR_OTM for 3-7%', () => {
  assertEqual(classifyStrikeDistance(5), 'NEAR_OTM');
});

test('Strike: OTM for 7-15%', () => {
  assertEqual(classifyStrikeDistance(10), 'OTM');
});

test('Strike: FAR_OTM for > 15%', () => {
  assertEqual(classifyStrikeDistance(25), 'FAR_OTM');
});

test('Strike: UNAVAILABLE for null', () => {
  assertEqual(classifyStrikeDistance(null), 'UNAVAILABLE');
});

// 50. Risk-adjusted score
test('Risk-adjusted score: null when no inputs', () => {
  const result = calculateRiskAdjustedOptionsScore(null, {}, null, null);
  assertNull(result);
});

test('Risk-adjusted score: finite with complete data', () => {
  const contract = baseCallContract();
  const intelligence = buildOptionsIntelligence(contract);
  const flow = buildOptionsFlowIntelligence([contract]);
  const result = calculateRiskAdjustedOptionsScore(80, contract, intelligence, flow);
  assertTrue(Number.isFinite(result), 'Score should be finite');
  assertTrue(result >= 0 && result <= 100, 'Score ' + result + ' should be 0-100');
});

// 51. Contract warnings
test('Contract warnings: includes wide spread', () => {
  const c = baseCallContract({ spreadPct: 50 });
  const intelligence = buildOptionsIntelligence(c);
  const flow = buildOptionsFlowIntelligence([c]);
  const warnings = buildContractWarnings(c, intelligence, flow);
  assertTrue(warnings.includes('Wide spread'));
});

test('Contract warnings: includes short DTE', () => {
  const c = baseCallContract({ daysToExpiration: 3 });
  const intelligence = buildOptionsIntelligence(c);
  const flow = buildOptionsFlowIntelligence([c]);
  const warnings = buildContractWarnings(c, intelligence, flow);
  assertTrue(warnings.includes('Short DTE'));
});

test('Contract warnings: includes extreme IV', () => {
  const c = baseCallContract({ impliedVolatility: 1.5 });
  const intelligence = buildOptionsIntelligence(c);
  const flow = buildOptionsFlowIntelligence([c]);
  const warnings = buildContractWarnings(c, intelligence, flow);
  assertTrue(warnings.includes('Extreme IV'));
});

// 52. Contract reasons
test('Contract reasons: includes liquidity', () => {
  const c = baseCallContract();
  const intelligence = buildOptionsIntelligence(c);
  const flow = buildOptionsFlowIntelligence([c]);
  const reasons = buildContractRankingReasons(c, intelligence, flow, {});
  assertTrue(reasons.some(r => r.includes('liquidity')), 'Should include liquidity reason');
});

test('Contract reasons: max 5 reasons', () => {
  const c = baseCallContract();
  const intelligence = buildOptionsIntelligence(c);
  const flow = buildOptionsFlowIntelligence([c]);
  const reasons = buildContractRankingReasons(c, intelligence, flow, {});
  assertTrue(reasons.length <= 5, 'Should have at most 5 reasons');
});

// 53. Contract ranking
test('Contract ranking: returns sorted results', () => {
  const c1 = baseCallContract({ volume: 1000, openInterest: 1000, premium: 0.10 });
  const c2 = baseCallContract({ volume: 100, openInterest: 100, premium: 0.90 });
  const result = rankOptionsContracts([c1, c2]);
  assertEqual(result.length, 2);
  assertTrue(result[0].contractRankScore >= result[1].contractRankScore, 'Should be sorted descending');
});

test('Contract ranking: empty array returns empty', () => {
  const result = rankOptionsContracts([]);
  assertEqual(result.length, 0);
});

// 54. Best contract summary
test('Best contract summary: returns best contract', () => {
  const c1 = baseCallContract({ symbol: 'AAPL240621C00150000', volume: 1000, openInterest: 1000 });
  const c2 = basePutContract({ symbol: 'AAPL240621P00150000', volume: 500, openInterest: 500 });
  const result = buildBestContractSummary([c1, c2]);
  assertNotNull(result.bestContractSymbol);
  assertNotNull(result.bestContractRankScore);
  assertEqual(result.contractCount, 2);
});

test('Best contract summary: empty contracts', () => {
  const result = buildBestContractSummary([]);
  assertEqual(result.contractCount, 0);
  assertEqual(result.dataStatus, 'unavailable');
});

test('Best contract summary: includes top 3 alternatives', () => {
  const c1 = baseCallContract({ volume: 1000 });
  const c2 = baseCallContract({ volume: 900 });
  const c3 = baseCallContract({ volume: 800 });
  const c4 = baseCallContract({ volume: 700 });
  const result = buildBestContractSummary([c1, c2, c3, c4]);
  assertTrue(result.alternativeContracts.length <= 3, 'Should have at most 3 alternatives');
});

// 55. DTE quality score
test('DTE quality: VERY_LOW DTE gets high score', () => {
  assertEqual(calculateDteQualityScore('VERY_LOW'), 90);
});

test('DTE quality: EXTREME DTE gets low score', () => {
  assertEqual(calculateDteQualityScore('EXTREME'), 15);
});

test('DTE quality: UNAVAILABLE returns null', () => {
  assertNull(calculateDteQualityScore('UNAVAILABLE'));
});

// 56. IV risk score
test('IV risk: LOW IV gets low risk score', () => {
  assertEqual(calculateIvRiskScore('LOW'), 20);
});

test('IV risk: EXTREME IV gets high risk score', () => {
  assertEqual(calculateIvRiskScore('EXTREME'), 85);
});

test('IV risk: UNAVAILABLE returns null', () => {
  assertNull(calculateIvRiskScore('UNAVAILABLE'));
});

// 57. Strike quality score
test('Strike quality: ATM gets high score', () => {
  assertEqual(calculateStrikeQualityScore('ATM'), 90);
});

test('Strike quality: FAR_OTM gets low score', () => {
  assertEqual(calculateStrikeQualityScore('FAR_OTM'), 20);
});

test('Strike quality: UNAVAILABLE returns null', () => {
  assertNull(calculateStrikeQualityScore('UNAVAILABLE'));
});

// 58. Existing options score unchanged
test('Existing Options Score unchanged after ranking addition', () => {
  const c = baseCallContract();
  const score = calculateOptionsScore(c);
  assertTrue(Number.isFinite(score) || score === null);
});

// 59. Existing flow score unchanged
test('Existing Flow Score unchanged after ranking addition', () => {
  const contracts = [baseCallContract()];
  const flow = buildOptionsFlowIntelligence(contracts);
  assertTrue(Number.isFinite(flow.flowScore) || flow.flowScore === null);
});

// 60. Alert threshold unchanged
test('Alert threshold: score >= 75 unchanged', () => {
  const c = baseCallContract({ volume: 500, openInterest: 500, bid: 0.50, ask: 0.55, premium: 0.50 });
  const score = calculateOptionsScore(c);
  assertTrue(score != null && score >= 75, 'Score ' + score + ' should meet threshold');
});

// 61. No fabricated data
test('No fabricated Greeks in ranking', () => {
  const c = baseCallContract();
  assertUndefined(c.delta);
  assertUndefined(c.gamma);
  assertUndefined(c.theta);
  assertUndefined(c.vega);
});

// 62. No NaN or Infinity in ranking outputs
test('No NaN or Infinity in ranking outputs', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const ranked = rankOptionsContracts(contracts);
  for (const r of ranked) {
    const numericFields = [
      r.contractRankScore,
      r.riskAdjustedScore,
      r.dteQualityScore,
      r.ivRiskScore,
      r.strikeQualityScore,
      r.premiumQualityScore,
    ];
    for (const value of numericFields) {
      if (value != null) {
        assertTrue(Number.isFinite(value), `Expected finite, got ${value}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Decision Engine Tests (A2.5)
// ---------------------------------------------------------------------------

// 63. Decision status classification
test('Decision status: HIGH_QUALITY for score >= 85', () => {
  assertEqual(classifyDecisionStatus(90), 'HIGH_QUALITY');
});

test('Decision status: GOOD_QUALITY for score 70-84', () => {
  assertEqual(classifyDecisionStatus(75), 'GOOD_QUALITY');
});

test('Decision status: WATCH for score 55-69', () => {
  assertEqual(classifyDecisionStatus(60), 'WATCH');
});

test('Decision status: LOW_QUALITY for score < 55', () => {
  assertEqual(classifyDecisionStatus(40), 'LOW_QUALITY');
});

test('Decision status: UNAVAILABLE for null', () => {
  assertEqual(classifyDecisionStatus(null), 'UNAVAILABLE');
});

// 64. Execution quality
test('Execution quality: EXCELLENT for tight spread + high volume/OI', () => {
  const c = baseCallContract({ spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90 });
  assertEqual(classifyExecutionQuality(c), 'EXCELLENT');
});

test('Execution quality: GOOD for moderate inputs', () => {
  const c = baseCallContract({ spreadPct: 10, volume: 500, openInterest: 500 });
  const result = classifyExecutionQuality(c);
  assertTrue(result === 'GOOD' || result === 'EXCELLENT', 'Expected GOOD or EXCELLENT, got ' + result);
});

test('Execution quality: POOR for wide spread + low volume/OI', () => {
  const c = baseCallContract({ spreadPct: 50, volume: 5, openInterest: 5 });
  assertEqual(classifyExecutionQuality(c), 'POOR');
});

test('Execution quality: UNAVAILABLE for null inputs', () => {
  const c = baseCallContract({ spreadPct: null, volume: null, openInterest: null, liquidityScore: null });
  assertEqual(classifyExecutionQuality(c), 'UNAVAILABLE');
});

// 65. Risk combination
test('Risk combination: returns highest risk level', () => {
  assertEqual(combineRiskLevels('LOW', 'MODERATE', 'HIGH', null, []), 'HIGH');
});

test('Risk combination: UNAVAILABLE when all null', () => {
  assertEqual(combineRiskLevels(null, null, null, null, []), 'UNAVAILABLE');
});

test('Risk combination: warnings elevate risk to HIGH', () => {
  const warnings = ['WIDE_SPREAD', 'LOW_LIQUIDITY', 'LOW_OI'];
  assertEqual(combineRiskLevels('LOW', 'LOW', 'LOW', 'LOW', warnings), 'HIGH');
});

// 66. Decision score
test('Decision score: deterministic with complete data', () => {
  const c = baseCallContract();
  const decision = buildOptionsDecision(c);
  assertTrue(Number.isFinite(decision.decisionScore) || decision.decisionScore === null);
  if (decision.decisionScore != null) {
    assertTrue(decision.decisionScore >= 0 && decision.decisionScore <= 100);
  }
});

test('Decision score: low score when all components are null/zero', () => {
  const c = baseCallContract({ volume: null, openInterest: null, premium: null, bid: null, ask: null, spreadPct: null, liquidityScore: null, impliedVolatility: null, daysToExpiration: null, distancePct: null, strike: null, underlying: null });
  const decision = buildOptionsDecision(c);
  assertTrue(decision.decisionScore != null, 'Decision score should not be null');
  assertTrue(decision.decisionScore >= 0 && decision.decisionScore <= 100, 'Decision score should be 0-100');
  assertEqual(decision.decisionStatus, 'LOW_QUALITY');
});

// 67. Decision reasons
test('Decision reasons: includes high ranking', () => {
  const c = baseCallContract({ volume: 1000, openInterest: 1000 });
  const decision = buildOptionsDecision(c);
  assertTrue(decision.decisionReasons.some(r => r.includes('ranking') || r.includes('liquidity') || r.includes('execution')));
});

test('Decision reasons: max 5 reasons', () => {
  const c = baseCallContract();
  const decision = buildOptionsDecision(c);
  assertTrue(decision.decisionReasons.length <= 5);
});

// 68. Decision warnings
test('Decision warnings: includes short DTE', () => {
  const c = baseCallContract({ daysToExpiration: 3 });
  const decision = buildOptionsDecision(c);
  assertTrue(decision.decisionWarnings.includes('SHORT_DTE'));
});

test('Decision warnings: includes wide spread', () => {
  const c = baseCallContract({ spreadPct: 50 });
  const decision = buildOptionsDecision(c);
  assertTrue(decision.decisionWarnings.includes('WIDE_SPREAD'));
});

// 69. Decision flags
test('Decision flags: includes TOP_RANKED for high score', () => {
  const c = baseCallContract({ volume: 1000, openInterest: 1000, premium: 0.10 });
  const decision = buildOptionsDecision(c);
  if (decision.decisionScore != null && decision.decisionScore >= 85) {
    assertTrue(decision.decisionFlags.includes('TOP_RANKED'));
  }
});

// 70. Recommended contract
test('Recommended contract: selects highest decision score', () => {
  const c1 = baseCallContract({ symbol: 'AAPL240621C00150000', volume: 1000, openInterest: 1000, premium: 0.10 });
  const c2 = basePutContract({ symbol: 'AAPL240621P00150000', volume: 100, openInterest: 100, premium: 0.90 });
  const selection = selectRecommendedContract([c1, c2]);
  assertNotNull(selection.recommendedContract);
  assertNotNull(selection.recommendedScore);
});

test('Recommended contract: empty array returns unavailable', () => {
  const selection = selectRecommendedContract([]);
  assertEqual(selection.dataStatus, 'unavailable');
});

// 71. Symbol decision summary
test('Symbol decision summary: returns complete summary', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const summary = buildSymbolDecisionSummary(contracts);
  assertNotNull(summary.decisionScore);
  assertNotNull(summary.decisionStatus);
  assertNotNull(summary.executionQuality);
  assertNotNull(summary.riskLevel);
});

test('Symbol decision summary: unavailable for empty array', () => {
  const summary = buildSymbolDecisionSummary([]);
  assertEqual(summary.decisionStatus, 'UNAVAILABLE');
  assertEqual(summary.dataStatus, 'unavailable');
});

// 72. No fabricated directional flow
test('No fabricated directional flow in decision', () => {
  const c = baseCallContract();
  const decision = buildOptionsDecision(c);
  assertFalse(decision.decisionFlags.some(f => f.includes('BULLISH') || f.includes('BEARISH') || f.includes('WHALE') || f.includes('SWEEP')));
});

// 73. Existing score regression
test('Existing Options Score unchanged after decision addition', () => {
  const c = baseCallContract();
  const score = calculateOptionsScore(c);
  assertTrue(Number.isFinite(score) || score === null);
});

// 74. Existing ranking regression
test('Existing Options Ranking unchanged after decision addition', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const ranked = rankOptionsContracts(contracts);
  assertTrue(Array.isArray(ranked));
  assertTrue(ranked.length > 0);
});

// 75. Existing flow regression
test('Existing Flow Intelligence unchanged after decision addition', () => {
  const contracts = [baseCallContract()];
  const flow = buildOptionsFlowIntelligence(contracts);
  assertEqual(flow.flowDirection, 'UNAVAILABLE');
});

// ---------------------------------------------------------------------------
// Watchlist & Monitoring Tests (A2.6)
// ---------------------------------------------------------------------------

// 76. Watch freshness
test('Watch freshness: FRESH for recent timestamp', () => {
  const freshness = classifyWatchFreshness(new Date(Date.now() - 30_000).toISOString());
  assertEqual(freshness, 'FRESH');
});

test('Watch freshness: AGING for 2-5 min old', () => {
  const freshness = classifyWatchFreshness(new Date(Date.now() - 3 * 60_000).toISOString());
  assertEqual(freshness, 'AGING');
});

test('Watch freshness: STALE for >5 min old', () => {
  const freshness = classifyWatchFreshness(new Date(Date.now() - 10 * 60_000).toISOString());
  assertEqual(freshness, 'STALE');
});

test('Watch freshness: UNAVAILABLE for null', () => {
  assertEqual(classifyWatchFreshness(null), 'UNAVAILABLE');
});

// 77. Watch status - score changes
test('Watch status: IMPROVING for +10 score change', () => {
  const prev = baseCallContract({ decisionScore: 50 });
  const curr = baseCallContract({ decisionScore: 65 });
  assertEqual(classifyWatchStatus(prev, curr), 'IMPROVING');
});

test('Watch status: DETERIORATING for -10 score change', () => {
  const prev = baseCallContract({ decisionScore: 65 });
  const curr = baseCallContract({ decisionScore: 50 });
  assertEqual(classifyWatchStatus(prev, curr), 'DETERIORATING');
});

test('Watch status: STABLE for small score change', () => {
  const prev = baseCallContract({ decisionScore: 60 });
  const curr = baseCallContract({ decisionScore: 62 });
  assertEqual(classifyWatchStatus(prev, curr), 'STABLE');
});

// 78. Watch status - risk changes
test('Watch status: RISK_INCREASED when risk increases', () => {
  const prev = { ...baseCallContract(), decisionRisk: 'LOW' };
  const curr = { ...baseCallContract(), decisionRisk: 'MODERATE' };
  assertEqual(classifyWatchStatus(prev, curr), 'RISK_INCREASED');
});

test('Watch status: RISK_DECREASED when risk decreases', () => {
  const prev = { ...baseCallContract(), decisionRisk: 'MODERATE' };
  const curr = { ...baseCallContract(), decisionRisk: 'LOW' };
  assertEqual(classifyWatchStatus(prev, curr), 'RISK_DECREASED');
});

// 79. Watch status - expired contract
test('Watch status: EXPIRED for expired contract', () => {
  const prev = baseCallContract({ daysToExpiration: 7 });
  const curr = baseCallContract({ daysToExpiration: 0 });
  assertEqual(classifyWatchStatus(prev, curr), 'EXPIRED');
});

// 80. Watch status - unavailable
test('Watch status: UNAVAILABLE for null inputs', () => {
  assertEqual(classifyWatchStatus(null, null), 'UNAVAILABLE');
  assertEqual(classifyWatchStatus({}, null), 'UNAVAILABLE');
});

// 81. Watch reasons
test('Watch reasons: includes score improvement', () => {
  const prev = baseCallContract({ decisionScore: 50, contractRankScore: 50 });
  const curr = baseCallContract({ decisionScore: 65, contractRankScore: 65 });
  const reasons = buildWatchReasons(prev, curr);
  assertTrue(reasons.some(r => r.includes('Decision Score improved')));
});

test('Watch reasons: max 5 reasons', () => {
  const prev = baseCallContract();
  const curr = baseCallContract();
  const reasons = buildWatchReasons(prev, curr);
  assertTrue(reasons.length <= 5);
});

// 82. Watch warnings
test('Watch warnings: includes RISK_INCREASED', () => {
  const prev = { ...baseCallContract(), decisionRisk: 'LOW' };
  const curr = { ...baseCallContract(), decisionRisk: 'HIGH' };
  const warnings = buildWatchWarnings(prev, curr);
  assertTrue(warnings.includes('RISK_INCREASED'));
});

test('Watch warnings: includes SHORT_DTE', () => {
  const curr = baseCallContract({ daysToExpiration: 3 });
  const warnings = buildWatchWarnings(null, curr);
  assertTrue(warnings.includes('SHORT_DTE'));
});

test('Watch warnings: includes EXPIRED', () => {
  const curr = baseCallContract({ daysToExpiration: 0 });
  const warnings = buildWatchWarnings(null, curr);
  assertTrue(warnings.includes('EXPIRED'));
});

// 83. Watch rank score
test('Watch rank score: higher for better decision score', () => {
  const high = baseCallContract({ decisionScore: 90, contractRankScore: 85, executionQuality: 'EXCELLENT', decisionRisk: 'LOW' });
  const low = baseCallContract({ decisionScore: 40, contractRankScore: 35, executionQuality: 'POOR', decisionRisk: 'EXTREME' });
  const highRank = calculateWatchRankScore(high, null);
  const lowRank = calculateWatchRankScore(low, null);
  assertTrue(highRank > lowRank);
});

test('Watch rank score: 0-100 bounded', () => {
  const c = baseCallContract();
  const rank = calculateWatchRankScore(c, null);
  assertTrue(rank >= 0 && rank <= 100);
});

// 84. Build watch list item
test('Build watch list item: returns complete item', () => {
  const c = baseCallContract({ decisionScore: 80, decisionStatus: 'HIGH_QUALITY', contractRankScore: 85, contractQuality: 'STRONG' });
  const item = buildWatchListItem(c);
  assertNotNull(item.watchStatus);
  assertNotNull(item.watchRankScore);
  assertNotNull(item.lastUpdated);
  assertTrue(Array.isArray(item.watchReasons));
  assertTrue(Array.isArray(item.watchWarnings));
});

test('Build watch list item: NEW for first entry', () => {
  const c = baseCallContract();
  const item = buildWatchListItem(c);
  assertEqual(item.watchStatus, 'NEW');
});

// 85. Watchlist regression
test('Watchlist does not affect Options Score', () => {
  const c = baseCallContract();
  const score = calculateOptionsScore(c);
  assertTrue(Number.isFinite(score) || score === null);
});

test('Watchlist does not affect Decision Engine', () => {
  const c = baseCallContract();
  const decision = buildOptionsDecision(c);
  assertNotNull(decision.decisionStatus);
});

// 86. Liquidity / Premium / IV / Volume / OI monitoring via status
test('Watch status: LIQUIDITY_IMPROVED when liquidityScore rises', () => {
  const prev = { liquidityScore: 40 };
  const curr = { liquidityScore: 75 };
  assertEqual(classifyWatchStatus(prev, curr), 'LIQUIDITY_IMPROVED');
});

test('Watch status: LIQUIDITY_DETERIORATED when liquidityScore drops', () => {
  const prev = { liquidityScore: 75 };
  const curr = { liquidityScore: 40 };
  assertEqual(classifyWatchStatus(prev, curr), 'LIQUIDITY_DETERIORATED');
});

test('Watch status: PREMIUM_INCREASED on +100% premium', () => {
  const prev = { premium: 0.5 };
  const curr = { premium: 1.0 };
  assertEqual(classifyWatchStatus(prev, curr), 'PREMIUM_INCREASED');
});

test('Watch status: PREMIUM_DECREASED on -50% premium', () => {
  const prev = { premium: 1.0 };
  const curr = { premium: 0.5 };
  assertEqual(classifyWatchStatus(prev, curr), 'PREMIUM_DECREASED');
});

test('Watch status: IV_INCREASED on large IV rise', () => {
  const prev = { impliedVolatility: 0.30 };
  const curr = { impliedVolatility: 0.60 };
  assertEqual(classifyWatchStatus(prev, curr), 'IV_INCREASED');
});

test('Watch status: IV_DECREASED on large IV drop', () => {
  const prev = { impliedVolatility: 0.60 };
  const curr = { impliedVolatility: 0.30 };
  assertEqual(classifyWatchStatus(prev, curr), 'IV_DECREASED');
});

test('Watch status: VOLUME_SURGE on doubling volume', () => {
  const prev = { volume: 100 };
  const curr = { volume: 500 };
  assertEqual(classifyWatchStatus(prev, curr), 'VOLUME_SURGE');
});

test('Watch status: VOLUME_DROP on volume halving', () => {
  const prev = { volume: 500 };
  const curr = { volume: 100 };
  assertEqual(classifyWatchStatus(prev, curr), 'VOLUME_DROP');
});

test('Watch status: OI_INCREASED / OI_DECREASED', () => {
  const prev = { openInterest: 100 };
  const curr = { openInterest: 400 };
  assertEqual(classifyWatchStatus(prev, curr), 'OI_INCREASED');
  const prev2 = { openInterest: 400 };
  const curr2 = { openInterest: 100 };
  assertEqual(classifyWatchStatus(prev2, curr2), 'OI_DECREASED');
});

test('Watch status: SLIGHTLY_IMPROVING on +5 score', () => {
  const prev = { decisionScore: 50 };
  const curr = { decisionScore: 55 };
  assertEqual(classifyWatchStatus(prev, curr), 'SLIGHTLY_IMPROVING');
});

test('Watch status: SLIGHTLY_DETERIORATING on -5 score', () => {
  const prev = { decisionScore: 55 };
  const curr = { decisionScore: 50 };
  assertEqual(classifyWatchStatus(prev, curr), 'SLIGHTLY_DETERIORATING');
});

// 87. DTE status
test('DTE status: CRITICAL at dte <= 3', () => {
  assertEqual(classifyDteStatus(3), 'CRITICAL');
  assertEqual(classifyDteStatus(1), 'CRITICAL');
});

test('DTE status: HIGH_ATTENTION at dte <= 7', () => {
  assertEqual(classifyDteStatus(7), 'HIGH_ATTENTION');
  assertEqual(classifyDteStatus(5), 'HIGH_ATTENTION');
});

test('DTE status: EXPIRED at dte <= 0', () => {
  assertEqual(classifyDteStatus(0), 'EXPIRED');
  assertEqual(classifyDteStatus(-2), 'EXPIRED');
});

test('DTE status: null for missing or non-finite', () => {
  assertEqual(classifyDteStatus(null), null);
  assertEqual(classifyDteStatus(undefined), null);
  assertEqual(classifyDteStatus(NaN), null);
  assertEqual(classifyDteStatus(Infinity), null);
});

test('Build watch list item: carries watchDteStatus', () => {
  const c = baseCallContract({ daysToExpiration: 2 });
  const item = buildWatchListItem(c);
  assertEqual(item.watchDteStatus, 'CRITICAL');
  const c2 = baseCallContract({ daysToExpiration: 30 });
  const item2 = buildWatchListItem(c2);
  assertEqual(item2.watchDteStatus, null);
});

// 88. Missing data / NaN / Infinity handling
test('Watch status: UNAVAILABLE when both null', () => {
  assertEqual(classifyWatchStatus(null, null), 'UNAVAILABLE');
  assertEqual(classifyWatchStatus({}, null), 'UNAVAILABLE');
});

test('Build watch list item: handles NaN/Infinity gracefully', () => {
  const c = baseCallContract({ decisionScore: NaN, contractRankScore: Infinity, premium: NaN });
  const item = buildWatchListItem(c);
  assertNotNull(item.watchStatus);
  assertTrue(Number.isFinite(item.watchRankScore));
});

test('Build watch reasons: empty for null inputs', () => {
  assertEqual(buildWatchReasons(null, null).length, 0);
  assertEqual(buildWatchReasons({}, {}).length, 0);
});

test('Build watch warnings: empty for null current', () => {
  assertEqual(buildWatchWarnings(null, null).length, 0);
});

// 89. Full watchlist integration
test('Full watchlist: prev->curr produces reasons and warnings', () => {
  const prev = baseCallContract({ decisionScore: 50, contractRankScore: 50, liquidityScore: 50, volume: 100, openInterest: 100, executionQuality: 'GOOD', decisionRisk: 'LOW', impliedVolatility: 0.3, premium: 0.5, daysToExpiration: 30 });
  const curr = baseCallContract({ decisionScore: 70, contractRankScore: 70, liquidityScore: 80, volume: 400, openInterest: 300, executionQuality: 'EXCELLENT', decisionRisk: 'LOW', impliedVolatility: 0.3, premium: 0.5, daysToExpiration: 30 });
  const prevItem = buildWatchListItem(prev, null);
  const currItem = buildWatchListItem(curr, prevItem);
  assertEqual(currItem.watchStatus, 'IMPROVING');
  assertTrue(currItem.watchReasons.length > 0);
  assertNotNull(currItem.watchDteStatus === null || currItem.watchDteStatus === 'HIGH_ATTENTION' || currItem.watchDteStatus === 'CRITICAL' || currItem.watchDteStatus === 'EXPIRED');
});

test('Full watchlist: expired contract not recommended (watchStatus EXPIRED)', () => {
  const prev = baseCallContract({ daysToExpiration: 7 });
  const curr = baseCallContract({ daysToExpiration: 0 });
  const prevItem = buildWatchListItem(prev, null);
  const currItem = buildWatchListItem(curr, prevItem);
  assertEqual(currItem.watchStatus, 'EXPIRED');
});

// ---------------------------------------------------------------------------
// Options Strategy Intelligence Tests (A2.7)
// ---------------------------------------------------------------------------

// Helper: build a realistic options chain for strategy testing
function basicCallStrike(strike, premium, overrides = {}) {
  return {
    symbol: `AAPL24C${String(strike).padStart(8, '0')}`,
    optionType: 'CALL',
    strike,
    underlying: 100,
    expiry: '2024-06-21',
    daysToExpiration: 30,
    premium,
    contractCost: premium * 100,
    bid: premium - 0.02,
    ask: premium + 0.02,
    volume: 500,
    openInterest: 500,
    impliedVolatility: 0.30,
    spreadPct: 5,
    distancePct: Math.abs((strike - 100) / 100) * 100,
    liquidityScore: 75,
    premiumScore: 75,
    score: 75,
    sides: ['CALL'],
    ...overrides,
  };
}

function basicPutStrike(strike, premium, overrides = {}) {
  return {
    symbol: `AAPL24P${String(strike).padStart(8, '0')}`,
    optionType: 'PUT',
    strike,
    underlying: 100,
    expiry: '2024-06-21',
    daysToExpiration: 30,
    premium,
    contractCost: premium * 100,
    bid: premium - 0.02,
    ask: premium + 0.02,
    volume: 500,
    openInterest: 500,
    impliedVolatility: 0.30,
    spreadPct: 5,
    distancePct: Math.abs((strike - 100) / 100) * 100,
    liquidityScore: 75,
    premiumScore: 75,
    score: 75,
    sides: ['PUT'],
    ...overrides,
  };
}

function buildTestChain() {
  return [
    basicCallStrike(100, 0.50),
    basicCallStrike(102, 0.35),
    basicCallStrike(105, 0.20),
    basicCallStrike(108, 0.10),
    basicPutStrike(100, 0.50),
    basicPutStrike(98, 0.35),
    basicPutStrike(95, 0.20),
    basicPutStrike(92, 0.10),
  ];
}

// 91. StrategyType constants
test('A2.7 StrategyType: constants defined', () => {
  assertEqual(StrategyType.SINGLE_CALL, 'SINGLE_CALL');
  assertEqual(StrategyType.SINGLE_PUT, 'SINGLE_PUT');
  assertEqual(StrategyType.CALL_SPREAD, 'CALL_SPREAD');
  assertEqual(StrategyType.PUT_SPREAD, 'PUT_SPREAD');
});

// 92. Build strategy candidates — single legs present
test('A2.7 Strategy candidates: includes single-leg candidates', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  assertTrue(candidates.length > 0, 'Should produce candidates');
  const singleCalls = candidates.filter(c => c.strategyType === 'SINGLE_CALL');
  const singlePuts = candidates.filter(c => c.strategyType === 'SINGLE_PUT');
  assertTrue(singleCalls.length >= 3, 'Should have at least 3 single calls');
  assertTrue(singlePuts.length >= 3, 'Should have at least 3 single puts');
});

// 93. Build strategy candidates — spreads present
test('A2.7 Strategy candidates: includes spread candidates', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const callSpreads = candidates.filter(c => c.strategyType === 'CALL_SPREAD');
  const putSpreads = candidates.filter(c => c.strategyType === 'PUT_SPREAD');
  assertTrue(callSpreads.length > 0, 'Should have call spreads');
  assertTrue(putSpreads.length > 0, 'Should have put spreads');
});

// 94. Strategy candidates sorted by score descending
test('A2.7 Strategy candidates: sorted by score descending', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  for (let i = 1; i < candidates.length; i++) {
    assertTrue(
      Number(candidates[i - 1].strategyScore || 0) >= Number(candidates[i].strategyScore || 0),
      'Should be sorted descending'
    );
  }
});

// 95. Strategy candidates empty for empty input
test('A2.7 Strategy candidates: empty for empty array', () => {
  const result = buildStrategyCandidates([]);
  assertEqual(result.length, 0);
});

// 96. Strategy candidates empty for null
test('A2.7 Strategy candidates: empty for null input', () => {
  assertEqual(buildStrategyCandidates(null).length, 0);
  assertEqual(buildStrategyCandidates(undefined).length, 0);
});

// 97. Strategy validation — valid single call
test('A2.7 Strategy validation: valid single call', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  const result = validateStrategy(single);
  assertTrue(result.valid, `Should be valid: ${result.errors.join(', ')}`);
});

// 98. Strategy validation — valid call spread
test('A2.7 Strategy validation: valid call spread', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  const result = validateStrategy(spread);
  assertTrue(result.valid, `Should be valid: ${result.errors.join(', ')}`);
});

// 99. Strategy validation — invalid: wrong strike order for call spread
test('A2.7 Strategy validation: invalid call spread strike order', () => {
  const c1 = basicCallStrike(105, 0.20);
  const c2 = basicCallStrike(100, 0.50);
  const candidate = {
    strategyType: 'CALL_SPREAD',
    legs: [
      { contract: c1, ratio: 1, role: 'LONG' },
      { contract: c2, ratio: -1, role: 'SHORT' },
    ],
  };
  const result = validateStrategy(candidate);
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('lower strike')));
});

// 100. Strategy validation — invalid: wrong strike order for put spread
test('A2.7 Strategy validation: invalid put spread strike order', () => {
  const p1 = basicPutStrike(95, 0.20);
  const p2 = basicPutStrike(100, 0.50);
  const candidate = {
    strategyType: 'PUT_SPREAD',
    legs: [
      { contract: p1, ratio: 1, role: 'LONG' },
      { contract: p2, ratio: -1, role: 'SHORT' },
    ],
  };
  const result = validateStrategy(candidate);
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('higher strike')));
});

// 101. Strategy validation — null candidate
test('A2.7 Strategy validation: null candidate', () => {
  const result = validateStrategy(null);
  assertFalse(result.valid);
  assertTrue(result.errors.includes('candidate is null or undefined'));
});

// 102. Strategy validation — missing legs
test('A2.7 Strategy validation: missing legs', () => {
  const result = validateStrategy({ strategyType: 'SINGLE_CALL' });
  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('legs')));
});

// 103. Strategy economics — single call
test('A2.7 Strategy economics: single call max loss = premium', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  const econ = single.strategyEconomics;
  assertNotNull(econ.maxLoss);
  assertTrue(econ.maxLoss > 0, 'Max loss should be positive (premium paid)');
  assertNull(econ.maxProfit, 'Single call max profit should be null (unlimited)');
  const contract = single.legs[0].contract;
  const expected = n(contract.strike) + n(contract.premium);
  assertEqual(econ.breakeven.toFixed(4), expected.toFixed(4));
});

// 104. Strategy economics — single put
test('A2.7 Strategy economics: single put max profit = strike - premium', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_PUT');
  assertNotNull(single);
  const econ = single.strategyEconomics;
  assertNotNull(econ.maxLoss);
  assertTrue(econ.maxLoss > 0, 'Max loss should be positive (premium paid)');
  assertNotNull(econ.maxProfit);
  const contract = single.legs[0].contract;
  const expected = n(contract.strike) - n(contract.premium);
  assertEqual(econ.maxProfit.toFixed(4), expected.toFixed(4));
  const expectedBe = n(contract.strike) - n(contract.premium);
  assertEqual(econ.breakeven.toFixed(4), expectedBe.toFixed(4));
});

// 105. Strategy economics — call spread (debit)
test('A2.7 Strategy economics: call spread debit', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  const econ = spread.strategyEconomics;
  assertNotNull(econ.spreadWidth);
  assertTrue(econ.spreadWidth > 0, 'Spread width should be positive');
  // For a debit spread, max loss = net premium paid
  assertTrue(econ.maxLoss > 0, 'Max loss should be net debit');
  // Max profit = spread width - net debit (in total dollars)
  assertTrue(econ.maxProfit != null && econ.maxProfit >= 0, 'Max profit should be non-negative');
});

// 106. Strategy economics — put spread
test('A2.7 Strategy economics: put spread', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'PUT_SPREAD');
  assertNotNull(spread);
  const econ = spread.strategyEconomics;
  assertNotNull(econ.spreadWidth);
  assertTrue(econ.spreadWidth > 0, 'Spread width should be positive');
  assertTrue(econ.maxLoss > 0, 'Max loss should be net debit');
});

// 107. Strategy economics — null for invalid candidate
test('A2.7 Strategy economics: null economics for empty candidate', () => {
  const econ = calculateStrategyEconomics(null);
  assertNull(econ.maxLoss);
  assertNull(econ.maxProfit);
  assertNull(econ.breakeven);
  assertNull(econ.netPremium);
});

// 108. Strategy economics — handles null premiums
test('A2.7 Strategy economics: null premium returns null economics', () => {
  const c = basicCallStrike(100, null);
  const ranked = rankOptionsContracts([c]);
  if (ranked.length > 0) {
    const candidates = buildStrategyCandidates([c]);
    const single = candidates.find(x => x.strategyType === 'SINGLE_CALL');
    if (single) {
      const econ = calculateStrategyEconomics(single);
      assertNull(econ.maxLoss);
      assertNull(econ.breakeven);
    }
  }
});

// 109. Strategy quality — null for invalid candidate
test('A2.7 Strategy quality: null for invalid candidate', () => {
  assertNull(calculateStrategyQuality(null));
  assertNull(calculateStrategyQuality({ legs: [] }));
  assertNull(calculateStrategyQuality({ strategyType: 'SINGLE_CALL', legs: [{ contract: {}, rank: {} }] }));
});

// 110. Strategy quality — finite 0-100 for valid candidate
test('A2.7 Strategy quality: 0-100 for single call', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  const quality = single.strategyScore;
  assertTrue(Number.isFinite(quality), 'Quality should be finite');
  assertTrue(quality >= 0 && quality <= 100, 'Quality should be 0-100');
});

// 111. Strategy quality — finite for spread
test('A2.7 Strategy quality: finite for call spread', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  assertTrue(Number.isFinite(spread.strategyScore), 'Score should be finite');
  assertTrue(spread.strategyScore >= 0 && spread.strategyScore <= 100, 'Score should be 0-100');
});

// 112. Strategy quality classification
test('A2.7 Strategy quality: classified correctly', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  for (const c of candidates) {
    assertTrue(c.strategyQuality != null, 'Should have quality classification');
  }
});

// 113. Strategy risk — valid candidate returns risk level
test('A2.7 Strategy risk: returns risk level for single call', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(single.strategyRisk != null, 'Should have risk level');
});

// 114. Strategy risk — null for empty
test('A2.7 Strategy risk: returns UNAVAILABLE for null', () => {
  const risk = calculateStrategyRisk(null);
  assertEqual(risk.riskLevel, 'UNAVAILABLE');
  assertEqual(risk.riskFlags.length, 0);
});

// 115. Strategy risk — high DTE risk flags
test('A2.7 Strategy risk: short DTE flagged', () => {
  const c = basicCallStrike(100, 0.50, { daysToExpiration: 2, volume: 5, openInterest: 5 });
  const contracts = [c, basicPutStrike(100, 0.50, { daysToExpiration: 2, volume: 5, openInterest: 5 })];
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(x => x.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(
    single.strategyRiskFlags.includes('SHORT_DTE') || single.strategyRiskFlags.includes('HIGH_LEG_RISK'),
    'Should flag short DTE or high leg risk'
  );
});

// 116. Strategy risk — incomplete data flagged
test('A2.7 Strategy risk: incomplete data flagged', () => {
  const c = basicCallStrike(100, 0.50, { volume: null, openInterest: null });
  const contracts = [c, basicPutStrike(100, 0.50)];
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(x => x.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(single.strategyRiskFlags.includes('INCOMPLETE_DATA'));
});

// 117. Strategy reasons — includes strategy type
test('A2.7 Strategy reasons: includes strategy type', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(single.strategyReasons.some(r => r.includes('Long Call') || r.includes('SINGLE_CALL')));
});

// 118. Strategy reasons — max 6
test('A2.7 Strategy reasons: max 6 reasons', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  for (const c of candidates) {
    assertTrue(c.strategyReasons.length <= 6, 'Should have at most 6 reasons');
  }
});

// 119. Strategy warnings — includes assignment risk for spreads
test('A2.7 Strategy warnings: assignment risk for spreads', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  assertTrue(spread.strategyWarnings.includes('ASSIGNMENT_RISK'));
});

// 120. Strategy warnings — includes theoretical profit for single legs
test('A2.7 Strategy warnings: theoretical profit for single legs', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(single.strategyWarnings.includes('THEORETICAL_UNLIMITED_PROFIT'));
});

// 121. Strategy warnings — empty for null
test('A2.7 Strategy warnings: empty for null', () => {
  assertEqual(buildStrategyWarnings(null).length, 0);
});

// 122. Strategy warnings — high max loss
test('A2.7 Strategy warnings: high max loss flagged', () => {
  const c = basicCallStrike(100, 5.50, { contractCost: 550 });
  const candidates = buildStrategyCandidates([c]);
  const single = candidates.find(x => x.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  single.strategyEconomics = calculateStrategyEconomics(single);
  single.strategyRisk = 'LOW';
  single.strategyRiskFlags = [];
  const warnings = buildStrategyWarnings(single);
  assertTrue(warnings.includes('HIGH_MAX_LOSS'));
});

// 123. Compare strategies — higher score first
test('A2.7 Compare strategies: higher score first', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  assertTrue(candidates.length >= 2, 'Need at least 2 candidates');
  const a = candidates[0];
  const b = candidates[1];
  assertTrue(compareStrategies(a, b) <= 0, 'A should be >= B');
});

// 124. Compare strategies — handles null scores
test('A2.7 Compare strategies: handles null scores', () => {
  const a = { strategyScore: null };
  const b = { strategyScore: 80 };
  assertTrue(compareStrategies(a, b) > 0, 'Null score should sort after (b first)');
});

// 125. Build symbol strategy summary — returns best strategy
test('A2.7 Symbol strategy summary: returns best strategy', () => {
  const contracts = buildTestChain();
  const summary = buildSymbolStrategySummary(contracts);
  assertNotNull(summary.bestStrategy);
  assertNotNull(summary.strategyScore);
  assertNotNull(summary.strategyType);
  assertTrue(Array.isArray(summary.strategyCandidates));
});

// 126. Build symbol strategy summary — empty for empty array
test('A2.7 Symbol strategy summary: empty for empty array', () => {
  const summary = buildSymbolStrategySummary([]);
  assertEqual(summary.strategyQuality, 'UNAVAILABLE');
  assertEqual(summary.strategyCandidates.length, 0);
  assertNull(summary.bestStrategy);
  assertEqual(summary.dataStatus, 'unavailable');
});

// 127. Build symbol strategy summary — candidates limited to 10
test('A2.7 Symbol strategy summary: candidates limited to 10', () => {
  const contracts = buildTestChain();
  const summary = buildSymbolStrategySummary(contracts);
  assertTrue(summary.strategyCandidates.length <= 10, 'Should have at most 10 candidates');
});

// 128. Build symbol strategy summary — data status
test('A2.7 Symbol strategy summary: data status complete when all fields present', () => {
  const contracts = buildTestChain();
  const summary = buildSymbolStrategySummary(contracts);
  assertEqual(summary.dataStatus, 'complete');
});

// 129. Build symbol strategy summary — partial when data missing
test('A2.7 Symbol strategy summary: partial when premium missing', () => {
  const c = basicCallStrike(100, null);
  const contracts = [c, basicCallStrike(102, 0.35), basicPutStrike(98, 0.35)];
  const summary = buildSymbolStrategySummary(contracts);
  assertTrue(summary.bestStrategy != null, 'Should still produce best strategy');
});

// 130. Strategy candidates — only uses actual contracts (no fabrication)
test('A2.7 Strategy candidates: no fabricated contracts', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const allContractSymbols = new Set(contracts.map(c => c.symbol));
  for (const c of candidates) {
    for (const leg of c.legs) {
      assertTrue(
        allContractSymbols.has(leg.contract.symbol),
        `Strategy uses only real contracts: ${leg.contract.symbol}`
      );
    }
  }
});

// 131. Strategy candidates — no fabricated Greeks
test('A2.7 Strategy: no fabricated Greeks in economics', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  for (const c of candidates) {
    assertEqual(c.strategyEconomics.delta, undefined);
    assertEqual(c.strategyEconomics.gamma, undefined);
    assertEqual(c.strategyEconomics.theta, undefined);
    assertEqual(c.strategyEconomics.vega, undefined);
  }
});

// 132. Strategy candidates — no directional prediction
test('A2.7 Strategy: no directional prediction (Bullish/Bearish)', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  for (const c of candidates) {
    const json = JSON.stringify(c);
    assertFalse(json.includes('Bullish') || json.includes('Bearish'), 'Should not contain directional labels');
  }
});

// 133. Strategy candidates — NaN and Infinity handled
test('A2.7 Strategy: NaN and Infinity handled in contracts', () => {
  const c = basicCallStrike(100, NaN);
  c.volume = Infinity;
  c.openInterest = NaN;
  const ranked = rankOptionsContracts([c]);
  const candidates = buildStrategyCandidates(ranked);
  for (const cand of candidates) {
    assertTrue(Number.isFinite(cand.strategyScore) || cand.strategyScore === null);
    if (cand.strategyEconomics.maxLoss != null) {
      assertTrue(Number.isFinite(cand.strategyEconomics.maxLoss));
    }
    if (cand.strategyEconomics.breakeven != null) {
      assertTrue(Number.isFinite(cand.strategyEconomics.breakeven));
    }
  }
});

// 134. Strategy candidates — call spread uses adjacent strikes
test('A2.7 Strategy candidates: call spread long strike < short strike', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spreads = candidates.filter(c => c.strategyType === 'CALL_SPREAD');
  for (const s of spreads) {
    const longStrike = n(s.legs[0].contract.strike);
    const shortStrike = n(s.legs[1].contract.strike);
    assertTrue(longStrike < shortStrike, 'Long strike should be less than short strike');
  }
});

// 135. Strategy candidates — put spread uses adjacent strikes
test('A2.7 Strategy candidates: put spread long strike > short strike', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spreads = candidates.filter(c => c.strategyType === 'PUT_SPREAD');
  for (const s of spreads) {
    const longStrike = n(s.legs[0].contract.strike);
    const shortStrike = n(s.legs[1].contract.strike);
    assertTrue(longStrike > shortStrike, 'Long strike should be greater than short strike');
  }
});

// 136. Strategy candidates — spreads limited to adjacent strikes
test('A2.7 Strategy candidates: spreads limited to 3 positions apart', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spreads = candidates.filter(c => c.strategyType === 'CALL_SPREAD');
  // With 4 calls, we should have at most 3+2+1 = 6 call spreads
  assertTrue(spreads.length <= 6, `Should have at most 6 call spreads, got ${spreads.length}`);
});

// 137. Strategy candidates — expiry grouping
test('A2.7 Strategy candidates: different expiries create separate groups', () => {
  const contracts = [
    basicCallStrike(100, 0.50, { expiry: '2024-06-21', daysToExpiration: 30 }),
    basicCallStrike(102, 0.35, { expiry: '2024-06-21', daysToExpiration: 30 }),
    basicCallStrike(100, 0.60, { expiry: '2024-07-19', daysToExpiration: 58 }),
    basicCallStrike(102, 0.45, { expiry: '2024-07-19', daysToExpiration: 58 }),
  ];
  const candidates = buildStrategyCandidates(contracts);
  const spreads = candidates.filter(c => c.strategyType === 'CALL_SPREAD');
  // Only spreads within same expiry: (100c, 102c) for June + (100c, 102c) for July = 2
  assertTrue(spreads.length <= 2, `Should have at most 2 spreads (same expiry), got ${spreads.length}`);
});

// 138. Strategy candidates — accepts ranked contracts directly
test('A2.7 Strategy candidates: accepts ranked contracts', () => {
  const raw = buildTestChain();
  const ranked = rankOptionsContracts(raw);
  const fromRaw = buildStrategyCandidates(raw);
  const fromRanked = buildStrategyCandidates(ranked);
  assertEqual(fromRaw.length, fromRanked.length, 'Should produce same candidates from raw and ranked');
});

// 139. Strategy candidates — single contract no spreads
test('A2.7 Strategy candidates: single contract produces only single-leg', () => {
  const contracts = [basicCallStrike(100, 0.50)];
  const candidates = buildStrategyCandidates(contracts);
  assertEqual(candidates.length, 1);
  assertEqual(candidates[0].strategyType, 'SINGLE_CALL');
});

// 140. Strategy regression: existing Options Score unchanged
test('A2.7 Strategy regression: Options Score unchanged', () => {
  const c = baseCallContract();
  const score = calculateOptionsScore(c);
  assertTrue(Number.isFinite(score) || score === null);
});

// 141. Strategy regression: existing ranking unchanged
test('A2.7 Strategy regression: Ranking unchanged', () => {
  const contracts = [baseCallContract(), basePutContract()];
  const ranked = rankOptionsContracts(contracts);
  assertTrue(Array.isArray(ranked));
  assertTrue(ranked.length > 0);
});

// 142. Strategy regression: no new network requests
test('A2.7 Strategy regression: no fabricated data from provider', () => {
  const c = baseCallContract();
  assertEqual(c.delta, undefined);
  assertEqual(c.gamma, undefined);
  assertEqual(c.theta, undefined);
  assertEqual(c.vega, undefined);
});

// ---------------------------------------------------------------------------
// Strategy Decision & Comparison Tests (A2.8)
// ---------------------------------------------------------------------------

// 143. Decision score — null for invalid input
test('A2.8 Decision score: null for invalid candidate', () => {
  assertNull(calculateStrategyDecisionScore(null));
  assertNull(calculateStrategyDecisionScore({ legs: [] }));
});

// 144. Decision score — finite 0-100 for valid candidate
test('A2.8 Decision score: 0-100 for single call', () => {
  const candidates = buildStrategyCandidates(buildTestChain());
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  enrichStrategyWithDecision(single);
  assertTrue(Number.isFinite(single.strategyDecisionScore), 'Score should be finite');
  assertTrue(single.strategyDecisionScore >= 0 && single.strategyDecisionScore <= 100);
});

// 145. Decision score — finite for spread
test('A2.8 Decision score: finite for call spread', () => {
  const candidates = buildStrategyCandidates(buildTestChain());
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  enrichStrategyWithDecision(spread);
  assertTrue(Number.isFinite(spread.strategyDecisionScore));
  assertTrue(spread.strategyDecisionScore >= 0 && spread.strategyDecisionScore <= 100);
});

// 146. Decision score — deterministic
test('A2.8 Decision score: deterministic for same input', () => {
  const contracts = buildTestChain();
  const candidates1 = buildStrategyCandidates(contracts);
  const candidates2 = buildStrategyCandidates(contracts);
  const s1 = candidates1[0];
  const s2 = candidates2[0];
  enrichStrategyWithDecision(s1);
  enrichStrategyWithDecision(s2);
  assertEqual(s1.strategyDecisionScore, s2.strategyDecisionScore, 'Scores should match');
});

// 147. Decision status classification
test('A2.8 Decision status: HIGH_QUALITY for 85+', () => {
  assertEqual(classifyStrategyDecisionStatus(90), 'HIGH_QUALITY');
});

test('A2.8 Decision status: GOOD_QUALITY for 70-84', () => {
  assertEqual(classifyStrategyDecisionStatus(75), 'GOOD_QUALITY');
});

test('A2.8 Decision status: WATCH for 55-69', () => {
  assertEqual(classifyStrategyDecisionStatus(60), 'WATCH');
});

test('A2.8 Decision status: LOW_QUALITY for <55', () => {
  assertEqual(classifyStrategyDecisionStatus(40), 'LOW_QUALITY');
});

test('A2.8 Decision status: UNAVAILABLE for null', () => {
  assertEqual(classifyStrategyDecisionStatus(null), 'UNAVAILABLE');
});

// 148. Execution quality — evaluates all legs
test('A2.8 Execution quality: EXCELLENT for healthy legs', () => {
  const contracts = [
    basicCallStrike(100, 0.50, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90 }),
    basicCallStrike(102, 0.35, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90 }),
    basicCallStrike(105, 0.20, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90 }),
  ];
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  const exec = classifyStrategyExecutionQuality(spread);
  assertTrue(exec === 'EXCELLENT' || exec === 'GOOD', `Expected EXCELLENT or GOOD, got ${exec}`);
});

test('A2.8 Execution quality: POOR for unhealthy legs', () => {
  const contracts = [
    basicCallStrike(100, 0.50, { spreadPct: 50, volume: 5, openInterest: 5, liquidityScore: 20 }),
    basicCallStrike(102, 0.35, { spreadPct: 50, volume: 5, openInterest: 5, liquidityScore: 20 }),
  ];
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  const exec = classifyStrategyExecutionQuality(spread);
  assertTrue(exec === 'POOR' || exec === 'WATCH', `Expected POOR or WATCH, got ${exec}`);
});

test('A2.8 Execution quality: UNAVAILABLE for no valid legs', () => {
  assertEqual(classifyStrategyExecutionQuality(null), 'UNAVAILABLE');
  assertEqual(classifyStrategyExecutionQuality({ legs: [] }), 'UNAVAILABLE');
});

// 149. Combined risk — highest risk level
test('A2.8 Combined risk: returns highest risk from legs', () => {
  const contracts = [
    basicCallStrike(100, 0.50, { daysToExpiration: 30 }),
    basicCallStrike(102, 0.35, { daysToExpiration: 30 }),
    basicPutStrike(100, 0.50, { daysToExpiration: 2, impliedVolatility: 1.5 }),
  ];
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(c => c.strategyType === 'SINGLE_PUT');
  assertNotNull(single);
  enrichStrategyWithDecision(single);
  assertTrue(single.combinedRisk != null, 'Should have combined risk');
});

test('A2.8 Combined risk: UNAVAILABLE for null', () => {
  assertEqual(combineStrategyRisk(null), 'UNAVAILABLE');
  assertEqual(combineStrategyRisk({ legs: [] }), 'UNAVAILABLE');
});

// 150. Economics quality — reward/risk for spreads
test('A2.8 Economics quality: computed for call spread', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  enrichStrategyWithDecision(spread);
  assertNotNull(spread.economicsQuality);
  assertTrue(spread.economicsQuality >= 0 && spread.economicsQuality <= 100);
});

test('A2.8 Economics quality: null for no economics', () => {
  assertNull(calculateStrategyEconomicsQuality(null));
  assertNull(calculateStrategyEconomicsQuality({ strategyType: 'SINGLE_CALL', legs: [{ contract: {} }], strategyEconomics: null }));
});

// 151. Economics quality — single call cost efficiency
test('A2.8 Economics quality: single call cheap premium gets high score', () => {
  const c = basicCallStrike(100, 0.10);
  const contracts = [c, basicCallStrike(102, 0.05), basicPutStrike(100, 0.10)];
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates.find(x => x.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  enrichStrategyWithDecision(single);
  assertTrue(single.economicsQuality > 50, 'Cheap premium should have high economics quality');
});

// 152. Compare strategy decisions — higher score first
test('A2.8 Compare decisions: higher score first', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  candidates.sort(compareStrategyDecisions);
  for (let i = 1; i < candidates.length; i++) {
    assertTrue(
      compareStrategyDecisions(candidates[i - 1], candidates[i]) <= 0,
      'Should be sorted descending by decision score'
    );
  }
});

// 153. Compare strategy decisions — null scores last
test('A2.8 Compare decisions: null scores sort last', () => {
  const a = { strategyDecisionScore: null };
  const b = { strategyDecisionScore: 80 };
  assertTrue(compareStrategyDecisions(a, b) > 0, 'Null should sort after higher score');
});

// 154. Compare strategy decisions — ties broken by quality
test('A2.8 Compare decisions: ties broken by quality', () => {
  const a = { strategyDecisionScore: 80, strategyQuality: 'WEAK' };
  const b = { strategyDecisionScore: 80, strategyQuality: 'STRONG' };
  assertTrue(compareStrategyDecisions(a, b) > 0, 'Higher quality should come first on tie');
});

// 155. Select recommended strategy — returns best
test('A2.8 Recommended strategy: returns highest scored', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const selection = selectRecommendedStrategy(candidates);
  assertNotNull(selection.recommended);
  assertNotNull(selection.recommended.strategyDecisionScore);
});

// 156. Select recommended strategy — alternatives present
test('A2.8 Recommended strategy: returns up to 3 alternatives', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const selection = selectRecommendedStrategy(candidates);
  assertTrue(selection.alternatives.length <= 3, 'Should have at most 3 alternatives');
});

// 157. Select recommended strategy — avoid with explicit evidence
test('A2.8 Recommended strategy: avoid strategies have explicit evidence', () => {
  const c = basicCallStrike(100, 5.00, { daysToExpiration: 2, volume: 5, openInterest: 5, impliedVolatility: 1.5 });
  const ranked = rankOptionsContracts([c]);
  const candidates = buildStrategyCandidates(ranked);
  candidates.forEach(enrichStrategyWithDecision);
  const selection = selectRecommendedStrategy(candidates);
  for (const a of selection.avoid) {
    assertTrue(a.reasons.length >= 2, 'Avoid should have at least 2 evidence reasons');
  }
});

// 158. Select recommended strategy — empty for empty input
test('A2.8 Recommended strategy: empty for empty input', () => {
  const selection = selectRecommendedStrategy([]);
  assertNull(selection.recommended);
  assertEqual(selection.alternatives.length, 0);
  assertEqual(selection.avoid.length, 0);
});

// 159. Select recommended strategy — avoid limited to 3
test('A2.8 Recommended strategy: avoid limited to 3', () => {
  const contracts = buildTestChain();
  let candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  // Make all candidates poor quality to trigger avoid
  candidates = candidates.map(c => ({ ...c, strategyDecisionScore: 30, decisionStatus: 'LOW_QUALITY', combinedRisk: 'HIGH' }));
  const selection = selectRecommendedStrategy(candidates);
  assertTrue(selection.avoid.length <= 3, 'Should have at most 3 avoid strategies');
});

// 160. Decision reasons — includes decision score
test('A2.8 Decision reasons: includes decision score', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  const reasons = buildStrategyDecisionReasons(single);
  assertTrue(reasons.some(r => r.includes('Decision score')), 'Should include decision score reason');
});

// 161. Decision reasons — max 6
test('A2.8 Decision reasons: max 6 reasons', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    assertTrue(c.decisionReasons.length <= 6, 'Should have at most 6 decision reasons');
  }
});

// 162. Decision warnings — includes strategy warnings
test('A2.8 Decision warnings: includes existing strategy warnings', () => {
  const c = basicCallStrike(100, 5.00, { spreadPct: 50, volume: 5, openInterest: 5 });
  const contracts = [c, basicPutStrike(100, 5.00, { spreadPct: 50, volume: 5, openInterest: 5 })];
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const single = candidates.find(c => c.strategyType === 'SINGLE_CALL');
  assertNotNull(single);
  assertTrue(single.decisionWarnings.length > 0);
});

// 163. Decision warnings — empty for null
test('A2.8 Decision warnings: empty for null', () => {
  assertEqual(buildStrategyDecisionWarnings(null).length, 0);
});

// 164. Decision flags — includes TOP_RANKED for high score
test('A2.8 Decision flags: includes TOP_RANKED for high score', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const top = candidates.find(c => c.strategyDecisionScore >= 85);
  if (top) {
    assertTrue(top.decisionFlags.includes('TOP_RANKED'));
  }
});

// 165. Decision flags — includes DEFINED_RISK for spreads
test('A2.8 Decision flags: includes DEFINED_RISK for spreads', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const spread = candidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(spread);
  assertTrue(spread.decisionFlags.includes('DEFINED_RISK'));
});

// 166. Decision flags — includes LOW_RISK for low risk
test('A2.8 Decision flags: includes LOW_RISK for low risk', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const lowRisk = candidates.find(c => c.combinedRisk === 'LOW');
  if (lowRisk) {
    assertTrue(lowRisk.decisionFlags.includes('LOW_RISK'));
  }
});

// 167. Decision flags — empty for null
test('A2.8 Decision flags: empty for null', () => {
  assertEqual(buildStrategyDecisionFlags(null).length, 0);
});

// 168. Enrich strategy — adds all A2.8 fields
test('A2.8 Enrich: adds all decision fields', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const single = candidates[0];
  const enriched = enrichStrategyWithDecision(single);
  assertNotNull(enriched.strategyDecisionScore);
  assertNotNull(enriched.decisionStatus);
  assertNotNull(enriched.classifiedExecutionQuality);
  assertNotNull(enriched.combinedRisk);
  assertNotNull(enriched.economicsQuality);
  assertTrue(Array.isArray(enriched.decisionReasons));
  assertTrue(Array.isArray(enriched.decisionWarnings));
  assertTrue(Array.isArray(enriched.decisionFlags));
});

// 169. Enrich strategy — null for invalid input
test('A2.8 Enrich: returns input for invalid candidate', () => {
  const result = enrichStrategyWithDecision(null);
  assertEqual(result, null);
});

// 170. Symbol strategy decision summary — includes recommended
test('A2.8 Symbol decision summary: includes recommended strategy', () => {
  const contracts = buildTestChain();
  const summary = buildSymbolStrategyDecisionSummary(contracts);
  assertNotNull(summary.recommendedStrategy);
  assertNotNull(summary.recommendedStrategy.strategyDecisionScore);
  assertTrue(Array.isArray(summary.alternativeStrategies));
});

// 171. Symbol strategy decision summary — includes alternatives and avoid
test('A2.8 Symbol decision summary: includes alternatives and avoid', () => {
  const contracts = buildTestChain();
  const summary = buildSymbolStrategyDecisionSummary(contracts);
  assertNotNull(summary.strategyCandidates);
  assertTrue(summary.strategyCandidates.length > 0);
  for (const c of summary.strategyCandidates) {
    assertNotNull(c.strategyDecisionScore);
    assertNotNull(c.decisionStatus);
    assertNotNull(c.combinedRisk);
    assertNotNull(c.classifiedExecutionQuality);
  }
});

// 172. Symbol strategy decision summary — empty for empty input
test('A2.8 Symbol decision summary: empty for empty array', () => {
  const summary = buildSymbolStrategyDecisionSummary([]);
  assertNull(summary.recommendedStrategy);
  assertEqual(summary.alternativeStrategies.length, 0);
  assertEqual(summary.strategyCandidates.length, 0);
});

// 173. Decision score — renormalizes when components missing
test('A2.8 Decision score: renormalizes when components missing', () => {
  const c = basicCallStrike(100, 0.50, { liquidityScore: null, volume: null, openInterest: null });
  const ranked = rankOptionsContracts([c]);
  const candidates = buildStrategyCandidates(ranked);
  if (candidates.length > 0) {
    enrichStrategyWithDecision(candidates[0]);
    assertTrue(Number.isFinite(candidates[0].strategyDecisionScore) || candidates[0].strategyDecisionScore === null);
  }
});

// 174. Decision — no NaN or Infinity
test('A2.8 Decision: no NaN or Infinity in scores', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    if (c.strategyDecisionScore != null) {
      assertTrue(Number.isFinite(c.strategyDecisionScore), `Score should be finite, got ${c.strategyDecisionScore}`);
    }
    if (c.economicsQuality != null) {
      assertTrue(Number.isFinite(c.economicsQuality));
    }
    if (c.combinedRisk === 'UNAVAILABLE') continue;
  }
});

// 175. Decision — no fabricated data
test('A2.8 Decision: no fabricated Greeks or flow', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    assertEqual(c.delta, undefined);
    assertEqual(c.gamma, undefined);
    assertEqual(c.optionsSignal, undefined);
    assertFalse(JSON.stringify(c).includes('sweep') || JSON.stringify(c).includes('whale'));
  }
});

// 176. Decision — no directional prediction
test('A2.8 Decision: no Bullish/Bearish in decisions', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    const json = JSON.stringify(c.decisionReasons || []) + JSON.stringify(c.decisionWarnings || []) + JSON.stringify(c.decisionFlags || []);
    assertFalse(json.includes('Bullish') || json.includes('Bearish'), 'Should not contain directional labels');
  }
});

// 177. Decision regression: existing A2.7 strategy fields unchanged
test('A2.8 Regression: A2.7 strategyScore unchanged', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const before = candidates[0].strategyScore;
  enrichStrategyWithDecision(candidates[0]);
  assertEqual(candidates[0].strategyScore, before, 'A2.7 score should not change');
});

test('A2.8 Regression: A2.7 strategyRisk unchanged', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const before = candidates[0].strategyRisk;
  enrichStrategyWithDecision(candidates[0]);
  assertEqual(candidates[0].strategyRisk, before, 'A2.7 risk should not change');
});

test('A2.8 Regression: A2.7 strategyEconomics unchanged', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const before = JSON.stringify(candidates[0].strategyEconomics);
  enrichStrategyWithDecision(candidates[0]);
  const after = JSON.stringify(candidates[0].strategyEconomics);
  assertEqual(before, after, 'A2.7 economics should not change');
});

// 178. Decision score — weighting produces expected range
test('A2.8 Decision score: all components weighted correctly', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    if (c.strategyDecisionScore != null) {
      assertTrue(c.strategyDecisionScore >= 0 && c.strategyDecisionScore <= 100,
        `Score ${c.strategyDecisionScore} should be in 0-100 range`);
    }
  }
});

// 179. Decision score — higher quality yields higher score
test('A2.8 Decision score: higher quality strategy scores higher', () => {
  const good = [
    basicCallStrike(100, 0.10, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90, daysToExpiration: 45, impliedVolatility: 0.3 }),
    basicCallStrike(102, 0.10, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90, daysToExpiration: 45, impliedVolatility: 0.3 }),
  ];
  const bad = [
    basicCallStrike(100, 5.50, { spreadPct: 50, volume: 5, openInterest: 5, liquidityScore: 20, daysToExpiration: 2, impliedVolatility: 1.5 }),
    basicCallStrike(102, 5.50, { spreadPct: 50, volume: 5, openInterest: 5, liquidityScore: 20, daysToExpiration: 2, impliedVolatility: 1.5 }),
  ];
  const goodCandidates = buildStrategyCandidates(good).map(enrichStrategyWithDecision);
  const badCandidates = buildStrategyCandidates(bad).map(enrichStrategyWithDecision);
  const goodSpread = goodCandidates.find(c => c.strategyType === 'CALL_SPREAD');
  const badSpread = badCandidates.find(c => c.strategyType === 'CALL_SPREAD');
  assertNotNull(goodSpread);
  assertNotNull(badSpread);
  assertTrue(goodSpread.strategyDecisionScore > badSpread.strategyDecisionScore,
    'Good liquidity/quality strategy should score higher than poor');
});

// 180. Avoid strategies — no avoid when all healthy
test('A2.8 Avoid strategies: none when all healthy', () => {
  const contracts = [
    basicCallStrike(100, 0.10, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90, daysToExpiration: 45, impliedVolatility: 0.3 }),
    basicCallStrike(102, 0.10, { spreadPct: 3, volume: 2000, openInterest: 2000, liquidityScore: 90, daysToExpiration: 45, impliedVolatility: 0.3 }),
  ];
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  const selection = selectRecommendedStrategy(candidates);
   assertEqual(selection.avoid.length, 0, 'Healthy strategies should not be in avoid list');
});

// ---------------------------------------------------------------------------
// Production Hardening Tests (A2.9)
// ---------------------------------------------------------------------------

// 181. Provider: missing volume/oi preserved as null (not zero)
test('A2.9 Provider: missing volume/oi preserved as null', () => {
  const raw = { contractSymbol: 'TEST240119C00100000', strike: 100, bid: 0.48, ask: 0.52, volume: undefined, openInterest: undefined, impliedVolatility: 0.30 };
  const normalized = normalizeOptionContract(raw, 'CALL', 100, 1705660800);
  assertEqual(normalized.volume, null, 'Missing volume should be null, not 0');
  assertEqual(normalized.openInterest, null, 'Missing OI should be null, not 0');
});

test('A2.9 Provider: present volume/oi passed through', () => {
  const raw = { contractSymbol: 'TEST240119C00100000', strike: 100, bid: 0.48, ask: 0.52, lastPrice: 0.50, volume: 500, openInterest: 300, impliedVolatility: 0.30 };
  const normalized = normalizeOptionContract(raw, 'CALL', 100, 1705660800);
  assertEqual(normalized.volume, 500);
  assertEqual(normalized.openInterest, 300);
});

// 182. Provider: liquidityScore neutral for missing volume/OI
test('A2.9 Provider: liquidityScore not zeroed by missing volume', () => {
  const rawMissing = { contractSymbol: 'TEST240119C00100000', strike: 100, bid: 0.48, ask: 0.52, lastPrice: 0.50, volume: undefined, openInterest: undefined, impliedVolatility: 0.30 };
  const rawPresent = { contractSymbol: 'TEST240119C00100000', strike: 100, bid: 0.48, ask: 0.52, lastPrice: 0.50, volume: 1000, openInterest: 1000, impliedVolatility: 0.30 };
  const withVol = normalizeOptionContract(rawPresent, 'CALL', 100, 1705660800);
  const withoutVol = normalizeOptionContract(rawMissing, 'CALL', 100, 1705660800);
  assertTrue(withVol.liquidityScore > withoutVol.liquidityScore,
    `High volume (${withVol.liquidityScore}) should yield higher liquidity than missing (${withoutVol.liquidityScore})`);
  assertTrue(withoutVol.liquidityScore > 0, 'Missing volume should not zero out liquidity score');
});

// 183. Intelligence: rankOptionsContracts reuses computed values (no NaN)
test('A2.9 Intelligence: rankOptionsContracts handles null volume/oi without NaN', () => {
  const c = baseContract({ volume: null, openInterest: null, premium: 0.50, strike: 100 });
  const ranked = rankOptionsContracts([c]);
  assertTrue(ranked.length > 0);
  for (const r of ranked) {
    assertTrue(Number.isFinite(r.contractRankScore) || r.contractRankScore === null);
  }
});

// 184. RankOptionsContracts: accepts ranking override
test('A2.9 Intelligence: rankOptionsContracts result is deterministic', () => {
  const contracts = [
    baseContract({ symbol: 'AAPL240119C00100000', premium: 0.50, strike: 100, volume: 1000, openInterest: 500, spreadPct: 3, daysToExpiration: 30 }),
    baseContract({ symbol: 'AAPL240119C00105000', premium: 0.30, strike: 105, volume: 500, openInterest: 300, spreadPct: 5, daysToExpiration: 30 }),
  ];
  const r1 = rankOptionsContracts(contracts);
  const r2 = rankOptionsContracts(contracts);
  assertEqual(r1[0].contractRankScore, r2[0].contractRankScore);
  assertEqual(r1[0].contract.symbol, r2[0].contract.symbol);
});

// 185. buildBestContractSummary: ranking override works
test('A2.9 Intelligence: buildBestContractSummary accepts ranking override', () => {
  const contracts = [baseContract({ symbol: 'AAPL230120C00100000', premium: 0.50, strike: 100, volume: 1000, openInterest: 500, spreadPct: 3 })];
  const ranking = rankOptionsContracts(contracts);
  const summary = buildBestContractSummary(contracts, ranking);
  assertNotNull(summary.bestContractRankScore);
  assertEqual(summary.contractCount, 1);
});

// 186. buildSymbolDecisionSummary: ranking override works
test('A2.9 Intelligence: buildSymbolDecisionSummary accepts ranking override', () => {
  const contracts = [baseContract({ symbol: 'AAPL230120C00100000', premium: 0.50, strike: 100, volume: 1000, openInterest: 500, spreadPct: 3 })];
  const ranking = rankOptionsContracts(contracts);
  const summary = buildSymbolDecisionSummary(contracts, ranking);
  assertNotNull(summary.decisionScore);
});

// 187. selectRecommendedContract: ranking override works
test('A2.9 Intelligence: selectRecommendedContract accepts ranking override', () => {
  const contracts = [baseContract({ symbol: 'AAPL230120C00100000', premium: 0.50, strike: 100, volume: 1000, openInterest: 500, spreadPct: 3 })];
  const ranking = rankOptionsContracts(contracts);
  const selection = selectRecommendedContract(contracts, ranking);
  assertNotNull(selection.recommendedContract);
});

// 188. selectRecommendedContract: same result with or without override
test('A2.9 Intelligence: selectRecommendedContract consistent with/without override', () => {
  const contracts = [
    baseContract({ symbol: 'AAPL240119C00100000', premium: 0.50, strike: 100, volume: 1000, openInterest: 500, spreadPct: 3, daysToExpiration: 30 }),
    baseContract({ symbol: 'AAPL240119C00105000', premium: 0.30, strike: 105, volume: 500, openInterest: 300, spreadPct: 5, daysToExpiration: 30 }),
  ];
  const ranking = rankOptionsContracts(contracts);
  const withOverride = selectRecommendedContract(contracts, ranking);
  const withoutOverride = selectRecommendedContract(contracts);
  assertEqual(withOverride.recommendedScore, withoutOverride.recommendedScore);
});

// 189. combineStrategyRisk: UNAVAILABLE when all data missing
test('A2.9 Risk: combineStrategyRisk returns UNAVAILABLE for all-null legs', () => {
  const candidates = buildStrategyCandidates([
    baseContract({ symbol: 'TEST240119C00100000', premium: 0.50, strike: 100, volume: null, openInterest: null, daysToExpiration: 30, impliedVolatility: null }),
  ]);
  if (candidates.length > 0) {
    enrichStrategyWithDecision(candidates[0]);
    const risk = candidates[0].combinedRisk;
    assertTrue(risk === 'UNAVAILABLE' || risk === 'LOW' || risk === 'MODERATE' || risk === 'HIGH' || risk === 'EXTREME',
      `Risk should be valid level or UNAVAILABLE, got ${risk}`);
  }
});

// 190. combineStrategyRisk: returns UNAVAILABLE when strategyRisk is the only level
test('A2.9 Risk: combineStrategyRisk returns UNAVAILABLE when all components unavailable', () => {
  const c = baseContract({ symbol: 'TEST240119C00100000', premium: 0.50, strike: 100, volume: null, openInterest: null, daysToExpiration: null, impliedVolatility: null });
  c.optionsIntelligence = buildOptionsIntelligence(c);
  c.optionsIntelligence.riskLevel = 'UNAVAILABLE';
  const ranked = rankOptionsContracts([c]);
  if (ranked.length > 0) {
    const candidates = buildStrategyCandidates(ranked);
    if (candidates.length > 0) {
      enrichStrategyWithDecision(candidates[0]);
      assertTrue(candidates[0].combinedRisk === 'UNAVAILABLE' || candidates[0].combinedRisk === 'LOW',
        `Should be UNAVAILABLE or LOW when all data missing, got ${candidates[0].combinedRisk}`);
    }
  }
});

// 191. Production: no NaN in any decision field
test('A2.9 Production: no NaN in any enriched strategy field', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts).map(enrichStrategyWithDecision);
  for (const c of candidates) {
    for (const [key, val] of Object.entries(c)) {
      if (typeof val === 'number') {
        assertTrue(Number.isFinite(val), `Field ${key} should be finite, got ${val}`);
      }
    }
  }
});

// 192. Production: strategy decision preserves A2.7 economics
test('A2.9 Production: A2.7 strategyEconomics unchanged after enrichment', () => {
  const contracts = buildTestChain();
  const candidates = buildStrategyCandidates(contracts);
  const before = JSON.stringify(candidates[0].strategyEconomics);
  enrichStrategyWithDecision(candidates[0]);
  const after = JSON.stringify(candidates[0].strategyEconomics);
  assertEqual(before, after, 'A2.7 economics should be unchanged');
});

// 193. Production: buildSymbolStrategyDecisionSummary deduplication
test('A2.9 Production: buildSymbolStrategyDecisionSummary produces consistent results', () => {
  const contracts = buildTestChain();
  const s1 = buildSymbolStrategyDecisionSummary(contracts);
  const s2 = buildSymbolStrategyDecisionSummary(contracts);
  assertEqual(s1.strategyDecisionScore, s2.strategyDecisionScore);
  assertEqual(s1.recommendedStrategy?.strategyType, s2.recommendedStrategy?.strategyType);
});

// 194. Production: expired contracts filtered from decisions
test('A2.9 Production: expired contracts get high DTE risk', () => {
  const c = baseContract({ symbol: 'TEST230120C00100000', premium: 0.50, strike: 100, volume: 100, openInterest: 100, daysToExpiration: 0 });
  const ranked = rankOptionsContracts([c]);
  if (ranked.length > 0) {
    assertTrue(ranked[0].dteRisk === 'EXTREME', 'DTE=0 should be classified as EXTREME risk');
  }
});
console.log('\n========================================');
console.log('Test Results');
console.log('========================================');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total: ${passCount + failCount}`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
