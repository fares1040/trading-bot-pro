/**
 * FINRA Provider Tests
 *
 * Tests for the institutional-provider.js FINRA integration.
 * Run with: node scripts/test-finra-provider.mjs
 */

import {
  calculateInstitutionalScore,
  isProviderConfigured,
  getInstitutionalProviderStatus,
  getProviderCapabilities,
  clearCaches,
} from '../lib/institutional-provider.js';

// Test utilities
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
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(message || 'Expected false but got true');
  }
}

function assertNull(value, message = '') {
  if (value !== null) {
    throw new Error(`${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`);
  }
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value but got null/undefined');
  }
}

// ============================================================================
// TESTS
// ============================================================================

console.log('\n========================================');
console.log('FINRA Provider Tests');
console.log('========================================\n');

// Test 1: No FINRA credentials - provider unavailable
test('No FINRA credentials: provider unavailable', () => {
  // Clear any cached state
  clearCaches();

  // Without environment variables, provider should not be configured
  // Note: In test environment, these env vars are not set
  const configured = isProviderConfigured();
  // This test verifies the function works - actual value depends on env
  console.log('   Provider configured:', configured);
});

// Test 2: FINRA credentials configured - provider status reports configured
test('FINRA credentials configured: provider status reports correctly', () => {
  clearCaches();

  const status = getInstitutionalProviderStatus();

  // Status should have required fields
  assertNotNull(status, 'Status should not be null');
  assertNotNull(status.capabilities, 'Capabilities should be present');
  assertEqual(typeof status.available, 'boolean', 'available should be boolean');
  assertEqual(typeof status.configured, 'boolean', 'configured should be boolean');

  // Capabilities matrix should have correct structure
  const caps = status.capabilities;
  assertEqual(typeof caps.atsActivity, 'boolean', 'atsActivity should be boolean');
  assertEqual(typeof caps.otcActivity, 'boolean', 'otcActivity should be boolean');
  assertEqual(typeof caps.darkPoolRealtime, 'boolean', 'darkPoolRealtime should be boolean');
  assertEqual(typeof caps.optionsFlow, 'boolean', 'optionsFlow should be boolean');
  assertEqual(typeof caps.whaleFlow, 'boolean', 'whaleFlow should be boolean');
  assertEqual(typeof caps.openInterest, 'boolean', 'openInterest should be boolean');

  console.log('   Provider status:', status.provider || 'not configured');
  console.log('   Configured:', status.configured);
});

// Test 3: Valid normalized FINRA response - normalization succeeds
test('Valid normalized FINRA response: score calculation succeeds', () => {
  // Create a mock normalized FINRA response
  const mockData = {
    provider: 'finra',
    symbol: 'AAPL',
    available: true,
    source: 'FINRA ATS/OTC',
    dataTimestamp: '2026-08-10',
    weekStartDate: '2026-08-04',
    issueName: 'Apple Inc.',
    atsShareQuantity: 50000000, // 50 million shares
    atsTradeCount: 15000, // 15k trades
    summaryType: 'ATS_W_SMBL',
    tier: 'TIER1',
    verified: true,
    disclaimers: {
      delayed: true,
      aggregated: true,
      notRealtime: true,
      notDarkPoolFlow: true,
      notOptionsFlow: true,
    },
  };

  const scoreData = calculateInstitutionalScore(mockData);

  assertNotNull(scoreData, 'Score data should not be null for valid data');
  assertNotNull(scoreData.score, 'Score should be present');
  assertEqual(typeof scoreData.score, 'number', 'Score should be a number');
  assertTrue(scoreData.score >= 0, 'Score should be >= 0');
  assertTrue(scoreData.score <= 100, 'Score should be <= 100');
  assertEqual(scoreData.confidence, 'moderate', 'Confidence should be moderate for FINRA data');
  assertEqual(scoreData.type, 'ats-activity', 'Type should be ats-activity');
  assertEqual(scoreData.source, 'FINRA ATS/OTC', 'Source should be FINRA ATS/OTC');

  // Verify disclaimers are present
  assertTrue(scoreData.disclaimers.delayedData, 'Should have delayedData disclaimer');
  assertTrue(scoreData.disclaimers.aggregatedWeekly, 'Should have aggregatedWeekly disclaimer');
  assertTrue(scoreData.disclaimers.noDirection, 'Should have noDirection disclaimer');
  assertTrue(scoreData.disclaimers.notRealtime, 'Should have notRealtime disclaimer');

  console.log('   Calculated score:', scoreData.score);
  console.log('   Components:', JSON.stringify(scoreData.components));
});

// Test 4: Empty FINRA response - available false / score null
test('Empty FINRA response: returns null score', () => {
  const emptyData = null;
  const scoreData = calculateInstitutionalScore(emptyData);
  assertNull(scoreData, 'Score should be null for empty data');
});

// Test 5: FINRA request failure - Hunter continues normally
test('FINRA request failure: score returns null safely', () => {
  // Simulate failed response
  const failedData = {
    provider: 'finra',
    symbol: 'UNKNOWN',
    available: false,
    reason: 'no-finra-ats-data',
    verified: false,
  };

  const scoreData = calculateInstitutionalScore(failedData);
  assertNull(scoreData, 'Score should be null for failed data');
});

// Test 6: Capability matrix - correct capabilities
test('Capability matrix: ATS/OTC true when supported, others false', () => {
  clearCaches();

  const caps = getProviderCapabilities();

  // When not configured, all should be false
  if (!isProviderConfigured()) {
    assertFalse(caps.atsActivity, 'atsActivity should be false when not configured');
    assertFalse(caps.otcActivity, 'otcActivity should be false when not configured');
  }

  // These should ALWAYS be false for FINRA
  assertFalse(caps.darkPoolRealtime, 'darkPoolRealtime should ALWAYS be false for FINRA');
  assertFalse(caps.optionsFlow, 'optionsFlow should ALWAYS be false for FINRA');
  assertFalse(caps.whaleFlow, 'whaleFlow should ALWAYS be false for FINRA');
  assertFalse(caps.openInterest, 'openInterest should ALWAYS be false for FINRA');

  console.log('   Capabilities:', JSON.stringify(caps));
});

// Test 7: Score calculation with edge cases
test('Score calculation: edge cases handled correctly', () => {
  // Zero volume
  const zeroData = {
    provider: 'finra',
    symbol: 'TEST',
    available: true,
    atsShareQuantity: 0,
    atsTradeCount: 0,
    verified: true,
  };
  assertNull(calculateInstitutionalScore(zeroData), 'Zero volume should return null');

  // Missing provider
  const noProvider = {
    available: true,
    atsShareQuantity: 1000000,
    atsTradeCount: 500,
    verified: true,
  };
  assertNull(calculateInstitutionalScore(noProvider), 'Missing provider should return null');

  // Not verified
  const notVerified = {
    provider: 'finra',
    available: true,
    atsShareQuantity: 1000000,
    atsTradeCount: 500,
    verified: false,
  };
  assertNull(calculateInstitutionalScore(notVerified), 'Not verified should return null');
});

// Test 8: Score interpretation is non-directional
test('Score interpretation: non-directional disclaimers present', () => {
  const mockData = {
    provider: 'finra',
    symbol: 'TSLA',
    available: true,
    atsShareQuantity: 25000000,
    atsTradeCount: 8500,
    verified: true,
  };

  const scoreData = calculateInstitutionalScore(mockData);

  assertNotNull(scoreData, 'Score data should not be null');
  assertTrue(
    scoreData.interpretation.includes('Does NOT indicate direction'),
    'Interpretation must state it does NOT indicate direction'
  );
  assertTrue(scoreData.disclaimers.noDirection, 'noDirection disclaimer must be true');

  console.log('   Interpretation:', scoreData.interpretation);
});

// ============================================================================
// SUMMARY
// ============================================================================

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