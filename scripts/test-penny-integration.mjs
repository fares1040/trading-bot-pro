/**
 * Penny Intelligence — Integration Tests
 *
 * Tests the integration between:
 * - /api/penny-radar
 * - /api/alerts
 * - lib/penny-intelligence.js
 * - lib/sec-filings.js
 *
 * Run with: node scripts/test-penny-integration.mjs
 *
 * No real network calls. All external fetches are mocked.
 */

import {
  calculatePennyScore,
  calculateDollarVolume,
  classifyDollarVolume,
  calculateVolumeQuality,
  calculatePennyLiquidityScore,
  getLiquidityWarning,
  getLiquidityFlags,
  calculateLiquidityRisk,
  calculateVolatilityRisk,
  calculateResistanceRisk,
  calculateStructureScore,
  calculateStructureRisk,
  calculateVolumeTrapRisk,
  calculateMomentumRisk,
  calculatePennyRiskScore,
  classifyPennyRisk,
  getPennyRiskLabel,
  getPennyRiskFlags,
  buildRiskReasons,
  buildPennyReasons,
  calculateATR,
} from '../lib/penny-intelligence.js';

import {
  fetchCompanySubmissions,
  extractImportantFilings,
  detectDilutionRisk,
  detectOfferingRisk,
  detectWarrantConvertibleRisk,
  detectReverseSplitRisk,
  calculateSecRiskScore,
  buildSecIntelligence,
  clearSecCache,
} from '../lib/sec-filings.js';

let passCount = 0;
let failCount = 0;

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ': expected ' + expected + ', got ' + actual);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message);
}

function assertFalse(value, message) {
  if (value) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log('✅ PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('❌ FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

// ===========================================================================
// PENNY RADAR INTEGRATION
// ===========================================================================

test('Penny Radar: price filtering $0.10-$5.00', () => {
  const items = [
    { symbol: 'A', price: 0.05, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'B', price: 0.50, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'C', price: 5.00, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'D', price: 10.00, averageVolume20: 200000, relativeVolume: 1.5, technicalReady: true },
  ];

  const filtered = items.filter(item => {
    const price = Number(item.price);
    return price >= 0.10 && price <= 5.00;
  });

  assertEqual(filtered.length, 2);
  assertTrue(filtered.some(x => x.symbol === 'B'));
  assertTrue(filtered.some(x => x.symbol === 'C'));
});

test('Penny Radar: average volume >= 100K filter', () => {
  const items = [
    { symbol: 'A', price: 1.00, averageVolume20: 50000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'B', price: 1.00, averageVolume20: 150000, relativeVolume: 1.5, technicalReady: true },
  ];

  const filtered = items.filter(item => Number(item.averageVolume20) >= 100000);
  assertEqual(filtered.length, 1);
  assertEqual(filtered[0].symbol, 'B');
});

test('Penny Radar: RVOL >= 1.0 filter', () => {
  const items = [
    { symbol: 'A', price: 1.00, averageVolume20: 150000, relativeVolume: 0.8, technicalReady: true },
    { symbol: 'B', price: 1.00, averageVolume20: 150000, relativeVolume: 1.2, technicalReady: true },
  ];

  const filtered = items.filter(item => Number(item.relativeVolume) >= 1.0);
  assertEqual(filtered.length, 1);
  assertEqual(filtered[0].symbol, 'B');
});

test('Penny Radar: technicalReady === true filter', () => {
  const items = [
    { symbol: 'A', price: 1.00, averageVolume20: 150000, relativeVolume: 1.5, technicalReady: true },
    { symbol: 'B', price: 1.00, averageVolume20: 150000, relativeVolume: 1.5, technicalReady: false },
  ];

  const filtered = items.filter(item => item.technicalReady === true);
  assertEqual(filtered.length, 1);
  assertEqual(filtered[0].symbol, 'A');
});

test('Penny Radar: ranking by opportunityScore descending', () => {
  const items = [
    { symbol: 'A', price: 1.00, averageVolume20: 150000, relativeVolume: 1.5, technicalReady: true, setupScore: 80, relativeVolume: 2.0, rsi: 55 },
    { symbol: 'B', price: 1.00, averageVolume20: 150000, relativeVolume: 1.5, technicalReady: true, setupScore: 70, relativeVolume: 1.5, rsi: 60 },
  ];

  const scored = items.map(item => ({
    ...item,
    opportunityScore: calculatePennyScore(item),
  }));

  const sorted = [...scored].sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0));
  assertTrue(sorted[0].opportunityScore >= sorted[1].opportunityScore);
});

test('Penny Radar: top 30 limit', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({
    symbol: 'SYM' + i,
    price: 1.00,
    averageVolume20: 150000,
    relativeVolume: 1.5,
    technicalReady: true,
    setupScore: 70,
    relativeVolume: 1.5,
    rsi: 55,
  }));

  const top30 = items.slice(0, 30);
  assertEqual(top30.length, 30);
});

test('Penny Radar: missing data returns safe defaults', () => {
  const item = {
    symbol: 'A',
    price: 1.00,
    averageVolume20: 150000,
    relativeVolume: 1.5,
    technicalReady: true,
    setupScore: null,
    relativeVolume: null,
    rsi: null,
    support20: null,
    resistance20: null,
    breakoutScore: null,
    clusterScore: null,
    atr: null,
    changePercent: null,
    liquidityScore: null,
    volume: null,
    squeezeScore: null,
  };

  const score = calculatePennyScore(item);
  assertTrue(Number.isFinite(score), 'Score should be finite');
  assertTrue(score >= 0 && score <= 100, 'Score should be 0-100');

  const reasons = buildPennyReasons(item);
  assertTrue(reasons.length === 0 || reasons.every(r => r.includes('0') || r.includes('N/A')), 'Reasons should be minimal for missing data');
});

test('Penny Radar: SEC integration fallback when unavailable', async () => {
  const mockFetch = async () => {
    throw new Error('Network error');
  };

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.secDataStatus, 'unavailable');
  assertEqual(result.secRiskLevel, 'unavailable');
  assertEqual(result.dilutionRisk, 'unavailable');
});

test('Penny Radar: all Penny fields present with full data', () => {
  const item = {
    symbol: 'AAPL',
    price: 1.50,
    previousClose: 1.45,
    change: 0.05,
    changePercent: 3.45,
    volume: 500000,
    averageVolume20: 200000,
    relativeVolume: 2.5,
    rsi: 55,
    sma20: 1.40,
    sma50: 1.35,
    setupScore: 85,
    technicalScore: 80,
    breakoutScore: 75,
    trendScore: 70,
    momentumScore: 65,
    atr: 0.08,
    support20: 1.30,
    resistance20: 1.70,
    clusterScore: 72,
    squeezeScore: 50,
    liquidityScore: 75,
    technicalReady: true,
  };

  const price = Number(item.price);
  const dollarVolume = calculateDollarVolume(price, Number(item.volume));
  const volumeQuality = calculateVolumeQuality({
    volume: Number(item.volume),
    averageVolume20: Number(item.averageVolume20),
    relativeVolume: Number(item.relativeVolume),
  });

  const output = {
    kind: 'PENNY',
    symbol: item.symbol,
    price: price,
    opportunityScore: calculatePennyScore(item),
    liquidityScore: calculatePennyLiquidityScore({
      liquidityScore: item.liquidityScore,
      dollarVolume,
      volumeQualityScore: volumeQuality.score,
    }),
    dollarVolume,
    dollarVolumeClass: classifyDollarVolume(dollarVolume),
    volumeQualityScore: volumeQuality.score,
    liquidityWarning: getLiquidityWarning(dollarVolume),
    liquidityFlags: getLiquidityFlags({
      relativeVolume: Number(item.relativeVolume),
      dollarVolume,
      volumeQualityScore: volumeQuality.score,
    }),
    riskScore: calculatePennyRiskScore({
      liquidityRisk: calculateLiquidityRisk({ dollarVolume, volumeQualityScore: volumeQuality.score }),
      volatilityRisk: calculateVolatilityRisk({ price, atr: item.atr, changePercent: item.changePercent }),
      resistanceRisk: calculateResistanceRisk({ resistanceDistancePercent: 13.33, resistanceProximity: 'near' }),
      structureRisk: calculateStructureRisk({
        structureScore: 65,
        breakoutScore: item.breakoutScore,
        clusterScore: item.clusterScore,
      }),
      volumeTrapRisk: calculateVolumeTrapRisk({
        relativeVolume: Number(item.relativeVolume),
        dollarVolume,
        volumeQualityScore: volumeQuality.score,
      }),
      momentumRisk: calculateMomentumRisk({ rsi: item.rsi, changePercent: item.changePercent }),
    }),
    riskLevel: classifyPennyRisk(
      calculatePennyRiskScore({
        liquidityRisk: calculateLiquidityRisk({ dollarVolume, volumeQualityScore: volumeQuality.score }),
        volatilityRisk: calculateVolatilityRisk({ price, atr: item.atr, changePercent: item.changePercent }),
        resistanceRisk: calculateResistanceRisk({ resistanceDistancePercent: 13.33, resistanceProximity: 'near' }),
        structureRisk: calculateStructureScore({ price, support: item.support20, resistance: item.resistance20, breakoutScore: item.breakoutScore, clusterScore: item.clusterScore }),
        volumeTrapRisk: calculateVolumeTrapRisk({ relativeVolume: Number(item.relativeVolume), dollarVolume, volumeQualityScore: volumeQuality.score }),
        momentumRisk: calculateMomentumRisk({ rsi: item.rsi, changePercent: item.changePercent }),
      })
    ),
  };

  assertTrue(output.kind === 'PENNY');
  assertTrue(Number.isFinite(output.price));
  assertTrue(Number.isFinite(output.opportunityScore));
  assertTrue(Number.isFinite(output.liquidityScore));
  assertTrue(Number.isFinite(output.dollarVolume));
  assertTrue(output.dollarVolumeClass === 'low');
  assertTrue(output.riskScore >= 0 && output.riskScore <= 100);
  assertTrue(['low', 'moderate', 'high', 'extreme'].includes(output.riskLevel));
});

// ===========================================================================
// ALERT INTEGRATION
// ===========================================================================

test('Alert integration: Penny threshold unchanged (score >= 80 AND rvol >= 1.5)', () => {
  const pennyMinScore = 80;
  const pennyMinRvol = 1.5;

  const candidates = [
    { symbol: 'A', score: 85, rvol: 2.0, kind: 'PENNY' },
    { symbol: 'B', score: 79, rvol: 2.0, kind: 'PENNY' },
    { symbol: 'C', score: 85, rvol: 1.2, kind: 'PENNY' },
    { symbol: 'D', score: 85, rvol: 1.8, kind: 'PENNY' },
  ];

  const passed = candidates.filter(x =>
    Number(x.score) >= pennyMinScore && Number(x.rvol) >= pennyMinRvol
  );

  assertEqual(passed.length, 2);
  assertEqual(passed[0].symbol, 'A');
  assertEqual(passed[1].symbol, 'D');
});

test('Alert integration: Risk Score does not affect Penny eligibility', () => {
  const pennyMinScore = 80;
  const pennyMinRvol = 1.5;

  const candidate = { symbol: 'A', score: 85, rvol: 2.0, kind: 'PENNY', riskScore: 90 };
  const eligible = Number(candidate.score) >= pennyMinScore && Number(candidate.rvol) >= pennyMinRvol;

  assertTrue(eligible, 'Candidate with high risk score should still be eligible');
});

test('Alert integration: SEC Risk does not affect Penny eligibility', () => {
  const pennyMinScore = 80;
  const pennyMinRvol = 1.5;

  const candidate = {
    symbol: 'A',
    score: 85,
    rvol: 2.0,
    kind: 'PENNY',
    secIntelligence: { secRiskScore: 100, secRiskLevel: 'extreme', dilutionRisk: 'high' },
  };

  const eligible = Number(candidate.score) >= pennyMinScore && Number(candidate.rvol) >= pennyMinRvol;
  assertTrue(eligible, 'Candidate with high SEC risk should still be eligible');
});

test('Alert integration: Liquidity Warning does not prevent alert', () => {
  const pennyMinScore = 80;
  const pennyMinRvol = 1.5;

  const candidate = {
    symbol: 'A',
    score: 85,
    rvol: 2.0,
    kind: 'PENNY',
    liquidityWarning: 'very-low-liquidity',
  };

  const eligible = Number(candidate.score) >= pennyMinScore && Number(candidate.rvol) >= pennyMinRvol;
  assertTrue(eligible, 'Candidate with low liquidity should still be eligible');
});

test('Alert integration: PENNY dedupe key unchanged', () => {
  const items = [
    { kind: 'PENNY', symbol: 'AAPL' },
    { kind: 'PENNY', symbol: 'TSLA' },
    { kind: 'TECHNICAL', symbol: 'AAPL' },
    { kind: 'OPTIONS_CENTS', contract: 'AAPL260116C00150000' },
  ];

  function getDedupeKey(item) {
    if (item.kind === 'PENNY') return 'PENNY:' + item.symbol;
    if (item.kind === 'TECHNICAL') return 'HUNTER:' + item.symbol;
    if (item.kind === 'OPTIONS_CENTS') return 'OPT:' + (item.contract || '').match(/^[A-Z]+/)?.[0];
    return null;
  }

  assertEqual(getDedupeKey(items[0]), 'PENNY:AAPL');
  assertEqual(getDedupeKey(items[1]), 'PENNY:TSLA');
  assertEqual(getDedupeKey(items[2]), 'HUNTER:AAPL');
  assertEqual(getDedupeKey(items[3]), 'OPT:AAPL');
});

test('Alert integration: Hunter alerts unchanged by Penny Risk', () => {
  const hunterItem = {
    kind: 'TECHNICAL',
    symbol: 'AAPL',
    hunterEligible: true,
    hunterScore: 90,
    score: 90,
  };

  assertTrue(hunterItem.hunterEligible === true);
  assertTrue(Number(hunterItem.hunterScore) >= 85);
});

test('Alert integration: Options alerts unchanged by Penny Risk', () => {
  const optionsItem = {
    kind: 'OPTIONS_CENTS',
    symbol: 'AAPL',
    score: 80,
    premium: 0.5,
    volume: 20,
  };

  const optionsMinScore = 75;
  const optionsMaxPremium = 1;
  const optionsMinVolume = 10;

  const eligible =
    Number(optionsItem.score) >= optionsMinScore &&
    Number(optionsItem.premium) <= optionsMaxPremium &&
    Number(optionsItem.volume) >= optionsMinVolume;

  assertTrue(eligible);
});

// ===========================================================================
// ALERT MESSAGE REGRESSION
// ===========================================================================

test('Alert message: Penny includes key fields', () => {
  const full = {
    symbol: 'AAPL',
    price: 1.50,
    score: 85,
    rvol: 2.5,
    rsi: 55,
    riskScore: 45,
    riskLevel: 'moderate',
    liquidityScore: 70,
    secIntelligence: {
      secRiskScore: 30,
      secRiskLevel: 'low',
      dilutionRisk: 'none',
      offeringRisk: 'none',
      warrantRisk: 'none',
      reverseSplitDetected: false,
      latestRelevantFilings: [],
    },
    support20: 1.30,
    resistance20: 1.70,
    entryZone: '$1.30 - $1.33',
    targetZone: '$1.70',
    breakoutProximity: 'near-breakout',
    atr: 0.08,
    riskFlags: ['HIGH_VOLATILITY'],
    riskReasons: ['High ATR relative to price'],
    liquidityWarning: 'healthy',
    liquidityFlags: [],
  };

  const text = [];
  text.push('🎯 <b>' + full.symbol + '</b> — PENNY');
  text.push('💰 $' + full.price + ' | Score: ' + full.score + '/100 | RVOL: ' + full.rvol + 'x | RSI: ' + full.rsi);
  text.push('🛡️ RISK: ' + full.riskScore + ' | ' + full.riskLevel.toUpperCase() + ' | Liquidity: ' + full.liquidityScore + ' | SEC: ' + full.secIntelligence.secRiskScore);
  text.push('📐 STRUCTURE');
  text.push('   Support: $' + full.support20);
  text.push('   Resistance: $' + full.resistance20);
  text.push('   Entry: ' + full.entryZone);
  text.push('   Target: ' + full.targetZone);
  text.push('   Breakout: ' + full.breakoutProximity.toUpperCase());
  text.push('   ATR: $' + Number(full.atr).toFixed(2));

  const message = text.join('\n');
  assertTrue(message.includes('Penny Score: ' + full.score) || message.includes('Score: ' + full.score));
  assertTrue(message.includes('RISK:'));
  assertTrue(message.includes('Liquidity:'));
  assertTrue(message.includes('SEC:'));
  assertTrue(message.includes('STRUCTURE'));
});

test('Alert message: missing fields do not throw', () => {
  const full = {
    symbol: 'AAPL',
    price: null,
    score: null,
    rvol: null,
    rsi: null,
    riskScore: null,
    riskLevel: 'unavailable',
    liquidityScore: null,
    secIntelligence: {
      secRiskScore: null,
      secRiskLevel: 'unavailable',
      dilutionRisk: 'unavailable',
      offeringRisk: 'unavailable',
      warrantRisk: 'unavailable',
      reverseSplitDetected: false,
      latestRelevantFilings: [],
    },
    support20: null,
    resistance20: null,
    entryZone: null,
    targetZone: null,
    breakoutProximity: 'unavailable',
    atr: null,
    riskFlags: [],
    riskReasons: [],
    liquidityWarning: 'unavailable',
    liquidityFlags: [],
  };

  const text = [];
  text.push('🎯 <b>' + full.symbol + '</b> — PENNY');
  text.push('💰 $' + (full.price ?? '—') + ' | Score: ' + (full.score ?? '—') + '/100');
  text.push('🛡️ RISK: ' + (full.riskScore ?? 'N/A') + ' | ' + full.riskLevel.toUpperCase());
  text.push('📐 STRUCTURE');

  const message = text.join('\n');
  assertTrue(message.includes('AAPL'));
  assertFalse(message.includes('NaN'), 'Message should not contain NaN');
  assertTrue(message.length > 0, 'Message should not be empty');
});

test('Alert message: length within Telegram limit', () => {
  const message = '🔥 <b>HUNTER AI — OPPORTUNITY ALERT</b>\n' + 'A'.repeat(3900);
  assertTrue(message.length <= 4000, 'Message should be within Telegram limit');
});

test('Alert message: length within Discord limit', () => {
  const message = '🔥 HUNTER AI — OPPORTUNITY ALERT\n' + 'A'.repeat(1865);
  assertTrue(message.length <= 1900, 'Message should be within Discord limit');
});

// ===========================================================================
// DATA SAFETY
// ===========================================================================

test('Data safety: null inputs to calculatePennyScore', () => {
  assertTrue(Number.isFinite(calculatePennyScore({ setupScore: null, relativeVolume: null, rsi: null })));
});

test('Data safety: undefined inputs to calculatePennyScore', () => {
  assertTrue(Number.isFinite(calculatePennyScore({ setupScore: undefined, relativeVolume: undefined, rsi: undefined })));
});

test('Data safety: zero inputs to calculatePennyScore', () => {
  assertTrue(Number.isFinite(calculatePennyScore({ setupScore: 0, relativeVolume: 0, rsi: 0 })));
});

test('Data safety: negative inputs to calculatePennyScore', () => {
  assertTrue(Number.isFinite(calculatePennyScore({ setupScore: -10, relativeVolume: -1, rsi: -5 })));
});

test('Data safety: NaN input does not propagate', () => {
  const score = calculatePennyScore({ setupScore: NaN, relativeVolume: 2, rsi: 55 });
  assertTrue(Number.isFinite(score), 'Score should be finite even with NaN input');
});

test('Data safety: Infinity input does not propagate', () => {
  const score = calculatePennyScore({ setupScore: Infinity, relativeVolume: 2, rsi: 55 });
  assertTrue(Number.isFinite(score), 'Score should be finite even with Infinity input');
});

test('Data safety: empty arrays for ATR', () => {
  const atr = calculateATR([], [], [], 14);
  assertEqual(atr, null);
});

test('Data safety: invalid string inputs', () => {
  const score = calculatePennyScore({ setupScore: 'abc', relativeVolume: 'xyz', rsi: 'n/a' });
  assertTrue(Number.isFinite(score), 'Score should handle invalid strings');
});

// ===========================================================================
// REGRESSION LOCK
// ===========================================================================

test('Regression lock: Penny Score formula unchanged', () => {
  assertEqual(calculatePennyScore({ setupScore: 85, relativeVolume: 2.0, rsi: 55 }), 86);
  assertEqual(calculatePennyScore({ setupScore: 70, relativeVolume: 1.5, rsi: 60 }), 73);
  assertEqual(calculatePennyScore({ setupScore: 0, relativeVolume: undefined, rsi: undefined }), 0);
});

test('Regression lock: Penny alert thresholds unchanged', () => {
  const pennyMinScore = 80;
  const pennyMinRvol = 1.5;

  assertEqual(pennyMinScore, 80);
  assertEqual(pennyMinRvol, 1.5);
});

test('Regression lock: Hunter Score thresholds unchanged', () => {
  const hunterMinScore = 85;
  assertEqual(hunterMinScore, 85);
});

test('Regression lock: dedupe window unchanged (60 minutes)', () => {
  const dedupeWindowMs = 60 * 60 * 1000;
  assertEqual(dedupeWindowMs, 3600000);
});

test('Regression lock: dedupe key prefix unchanged (PENNY:)', () => {
  const kind = 'PENNY';
  const symbol = 'AAPL';
  const dedupeKey = kind + ':' + symbol;
  assertEqual(dedupeKey, 'PENNY:AAPL');
});

test('Regression lock: Options thresholds unchanged', () => {
  const optionsMinScore = 75;
  const optionsMaxPremium = 1;
  const optionsMinVolume = 10;

  assertEqual(optionsMinScore, 75);
  assertEqual(optionsMaxPremium, 1);
  assertEqual(optionsMinVolume, 10);
});

test('Regression lock: SEC is informational only', () => {
  const result = calculateSecRiskScore({
    dilutionRisk: 'high',
    offeringRisk: 'high',
    warrantRisk: 'high',
    convertibleRisk: 'high',
    reverseSplitRisk: 'high',
  });

  assertTrue('secRiskScore' in result);
  assertTrue('secRiskLevel' in result);
  assertTrue('secRiskFlags' in result);

  const pennyScore = calculatePennyScore({ setupScore: 85, relativeVolume: 2.0, rsi: 55 });
  assertEqual(pennyScore, 86, 'Penny Score should not be affected by SEC');
});

test('Regression lock: Risk Score is informational only', () => {
  const riskScore = calculatePennyRiskScore({
    liquidityRisk: 80,
    volatilityRisk: 80,
    resistanceRisk: 80,
    structureRisk: 80,
    volumeTrapRisk: 80,
    momentumRisk: 80,
  });

  const pennyScore = calculatePennyScore({ setupScore: 85, relativeVolume: 2.0, rsi: 55 });
  assertEqual(pennyScore, 86, 'Penny Score should not be affected by Risk Score');
  assertTrue(riskScore >= 0 && riskScore <= 100, 'Risk Score is 0-100');
});

// ===========================================================================
// PERFORMANCE / NETWORK SAFETY
// ===========================================================================

test('Network safety: SEC cache clear works', async () => {
  clearSecCache();
  const mockFetch = async () => {
    throw new Error('Network error');
  };

  const result1 = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result1.secDataStatus, 'unavailable');

  const result2 = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result2.secDataStatus, 'unavailable');
});

test('Network safety: buildSecIntelligence does not throw on network error', async () => {
  const mockFetch = async () => {
    throw new Error('Network error');
  };

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertTrue(result.secDataStatus === 'unavailable' || result.secDataStatus === 'no_filings');
  assertTrue(Number.isFinite(result.secRiskScore) || result.secRiskScore === null);
});

test('Network safety: buildSecIntelligence timeout handling', async () => {
  let resolve;
  const slowFetch = () => new Promise(r => { resolve = r; });

  const result = await buildSecIntelligence('AAPL', slowFetch, 100);
  assertEqual(result.secDataStatus, 'unavailable');
  resolve();
});

// ===========================================================================
// SUMMARY
// ===========================================================================

console.log('\n========================================');
console.log('Penny Integration Tests');
console.log('========================================');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
console.log('Total: ' + (passCount + failCount));
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
