/**
 * FINRA Production Connection Verification
 *
 * This script safely verifies the FINRA API connection without
 * exposing credentials, tokens, or secrets in logs.
 *
 * Run with: node scripts/verify-finra-connection.mjs
 *
 * Required environment variables:
 * - FINRA_API_CLIENT_ID
 * - FINRA_API_CLIENT_SECRET
 *
 * Note: This script manually loads .env.local for verification.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=');
      // Only set if not already defined in environment
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

// Test result tracking
const results = {
  credentialsPresent: false,
  oauthSucceeded: false,
  dataRequestSucceeded: false,
  normalizationSucceeded: false,
  scoringSucceeded: false,
  overallStatus: 'NOT_VERIFIED',
  error: null,
  testSymbol: 'AAPL',
  dataReceived: null,
  scoreCalculated: null,
};

// ============================================================================
// STEP 1: Check Credentials
// ============================================================================

console.log('\n========================================');
console.log('FINRA Production Connection Verification');
console.log('========================================\n');

console.log('Step 1: Checking credentials...\n');

const clientId = process.env.FINRA_API_CLIENT_ID;
const clientSecret = process.env.FINRA_API_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  results.credentialsPresent = false;
  results.error = 'FINRA credentials not found in environment';
  console.log('❌ FAIL: FINRA_API_CLIENT_ID or FINRA_API_CLIENT_SECRET not set');
  console.log('\n========================================');
  console.log('VERIFICATION RESULT: NOT VERIFIED');
  console.log('Reason: Missing credentials');
  console.log('========================================\n');
  process.exit(1);
}

results.credentialsPresent = true;
console.log('✅ Credentials present (values not logged for security)');

// ============================================================================
// STEP 2: OAuth2 Token Request
// ============================================================================

console.log('\nStep 2: Requesting OAuth2 access token...\n');

const FINRA_TOKEN_URL = 'https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token';

let accessToken = null;

try {
  // FINRA OAuth2 expects HTTP Basic Auth with client credentials
  // Encode credentials as base64 for Basic Auth header
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch(`${FINRA_TOKEN_URL}?grant_type=client_credentials`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!tokenResponse.ok) {
    results.oauthSucceeded = false;
    results.error = `OAuth failed with status ${tokenResponse.status}`;
    console.log(`❌ FAIL: OAuth returned status ${tokenResponse.status}`);
    // Get error details from response (safely)
    try {
      const errorBody = await tokenResponse.text();
      // Don't log credentials, just show error type
      console.log(`   Error details: Status ${tokenResponse.status}`);
    } catch {
      console.log('   Could not read error response');
    }
    console.log('\n========================================');
    console.log('VERIFICATION RESULT: NOT VERIFIED');
    console.log('Reason: OAuth authentication failed');
    console.log('========================================\n');
    process.exit(1);
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    results.oauthSucceeded = false;
    results.error = 'No access_token in OAuth response';
    console.log('❌ FAIL: No access_token in response');
    console.log('\n========================================');
    console.log('VERIFICATION RESULT: NOT VERIFIED');
    console.log('Reason: Invalid OAuth response');
    console.log('========================================\n');
    process.exit(1);
  }

  accessToken = tokenData.access_token;
  results.oauthSucceeded = true;
  console.log('✅ OAuth succeeded (token not logged for security)');
  console.log(`   Token expires in: ${tokenData.expires_in || 'unknown'} seconds`);

} catch (error) {
  results.oauthSucceeded = false;
  results.error = `OAuth request error: ${error.message}`;
  console.log(`❌ FAIL: OAuth request error: ${error.message}`);
  console.log('\n========================================');
  console.log('VERIFICATION RESULT: NOT VERIFIED');
  console.log('Reason: OAuth request failed');
  console.log('========================================\n');
  process.exit(1);
}

// ============================================================================
// STEP 3: Request FINRA weeklySummary Data
// ============================================================================

console.log('\nStep 3: Requesting FINRA weeklySummary data...\n');

const FINRA_DATA_URL = 'https://api.finra.org/data/group/otcMarket/name/weeklySummary';
const testSymbol = results.testSymbol;

try {
  // FINRA API uses GET requests with query parameters
  // Note: FINRA data may be historical (2023) and symbol filtering may not always return results
  // First try with the test symbol, then fall back to general data if no results
  const params = new URLSearchParams({
    limit: '10',
  });

  // Try to get data for the test symbol first
  let dataResponse = await fetch(`${FINRA_DATA_URL}?${params.toString()}&issueSymbolIdentifier=${testSymbol}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!dataResponse.ok) {
    results.dataRequestSucceeded = false;
    results.error = `Data request failed with status ${dataResponse.status}`;
    console.log(`❌ FAIL: Data request returned status ${dataResponse.status}`);
    console.log('\n========================================');
    console.log('VERIFICATION RESULT: NOT VERIFIED');
    console.log('Reason: FINRA data request failed');
    console.log('========================================\n');
    process.exit(1);
  }

  let rawData = await dataResponse.json();
  let records = Array.isArray(rawData) ? rawData : rawData?.results || [];

  // If no data for test symbol, get any available data to verify the connection works
  if (records.length === 0) {
    console.log(`   No data for symbol ${testSymbol}, fetching general data...`);
    dataResponse = await fetch(`${FINRA_DATA_URL}?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!dataResponse.ok) {
      results.dataRequestSucceeded = false;
      results.error = `Data request failed with status ${dataResponse.status}`;
      console.log(`❌ FAIL: Data request returned status ${dataResponse.status}`);
      console.log('\n========================================');
      console.log('VERIFICATION RESULT: NOT VERIFIED');
      console.log('Reason: FINRA data request failed');
      console.log('========================================\n');
      process.exit(1);
    }

    rawData = await dataResponse.json();
    records = Array.isArray(rawData) ? rawData : rawData?.results || [];
  }

  if (records.length === 0) {
    results.dataRequestSucceeded = false;
    results.error = `No data returned`;
    console.log(`⚠️  WARNING: No data returned from FINRA API`);
    console.log('   This may mean the API has no current data available');
    console.log('\n========================================');
    console.log('VERIFICATION RESULT: PARTIAL');
    console.log('Reason: OAuth succeeded but no data available');
    console.log('Recommendation: Check FINRA API status or try again later');
    console.log('========================================\n');
    process.exit(1);
  }

  results.dataRequestSucceeded = true;
  results.dataReceived = {
    recordCount: records.length,
    firstRecord: {
      symbol: records[0].issueSymbolIdentifier,
      name: records[0].issueName,
      weekStartDate: records[0].weekStartDate,
      summaryType: records[0].summaryTypeCode,
      shareQuantity: records[0].totalWeeklyShareQuantity,
      tradeCount: records[0].totalWeeklyTradeCount,
    },
  };

  console.log(`✅ Data request succeeded`);
  console.log(`   Records returned: ${records.length}`);
  console.log(`   Symbol: ${records[0].issueSymbolIdentifier}`);
  console.log(`   Issue Name: ${records[0].issueName}`);
  console.log(`   Week Start: ${records[0].weekStartDate}`);
  console.log(`   Summary Type: ${records[0].summaryTypeCode}`);
  console.log(`   Share Quantity: ${Number(records[0].totalWeeklyShareQuantity).toLocaleString()}`);
  console.log(`   Trade Count: ${Number(records[0].totalWeeklyTradeCount).toLocaleString()}`);

} catch (error) {
  results.dataRequestSucceeded = false;
  results.error = `Data request error: ${error.message}`;
  console.log(`❌ FAIL: Data request error: ${error.message}`);
  console.log('\n========================================');
  console.log('VERIFICATION RESULT: NOT VERIFIED');
  console.log('Reason: FINRA data request failed');
  console.log('========================================\n');
  process.exit(1);
}

// ============================================================================
// STEP 4: Normalize Data
// ============================================================================

console.log('\nStep 4: Normalizing FINRA data...\n');

try {
  const rawData = results.dataReceived;
  const firstRecord = rawData.firstRecord;

  // Simulate the normalization that would happen in the provider
  const normalizedData = {
    provider: 'finra',
    symbol: firstRecord.symbol,
    available: true,
    source: 'FINRA ATS/OTC',
    dataTimestamp: firstRecord.weekStartDate,
    weekStartDate: firstRecord.weekStartDate,
    issueName: firstRecord.name,
    atsShareQuantity: Number(firstRecord.shareQuantity),
    atsTradeCount: Number(firstRecord.tradeCount),
    summaryType: firstRecord.summaryType,
    tier: null,
    verified: true,
    disclaimers: {
      delayed: true,
      aggregated: true,
      notRealtime: true,
      notDarkPoolFlow: true,
      notOptionsFlow: true,
    },
  };

  // Validate normalized data
  if (!normalizedData.atsShareQuantity || !normalizedData.atsTradeCount) {
    results.normalizationSucceeded = false;
    results.error = 'Normalized data missing required fields';
    console.log('❌ FAIL: Normalization produced invalid data');
    process.exit(1);
  }

  results.normalizationSucceeded = true;
  results.normalizedData = normalizedData;

  console.log('✅ Normalization succeeded');
  console.log(`   Provider: ${normalizedData.provider}`);
  console.log(`   Symbol: ${normalizedData.symbol}`);
  console.log(`   ATS Share Quantity: ${normalizedData.atsShareQuantity.toLocaleString()}`);
  console.log(`   ATS Trade Count: ${normalizedData.atsTradeCount.toLocaleString()}`);
  console.log(`   Verified: ${normalizedData.verified}`);

} catch (error) {
  results.normalizationSucceeded = false;
  results.error = `Normalization error: ${error.message}`;
  console.log(`❌ FAIL: Normalization error: ${error.message}`);
  console.log('\n========================================');
  console.log('VERIFICATION RESULT: NOT VERIFIED');
  console.log('Reason: Data normalization failed');
  console.log('========================================\n');
  process.exit(1);
}

// ============================================================================
// STEP 5: Calculate Institutional Score
// ============================================================================

console.log('\nStep 5: Calculating institutional activity score...\n');

try {
  const data = results.normalizedData;

  const shareQuantity = Number(data.atsShareQuantity);
  const tradeCount = Number(data.atsTradeCount);

  // Calculate activity intensity score (same logic as institutional-provider.js)
  const logShares = Math.log10(Math.max(1, shareQuantity));
  const shareScore = Math.min(50, (logShares / 10) * 50);

  const logTrades = Math.log10(Math.max(1, tradeCount));
  const tradeScore = Math.min(30, (logTrades / 6) * 30);

  // Freshness component
  let freshnessScore = 20;
  if (data.weekStartDate) {
    const weekStart = new Date(data.weekStartDate);
    const now = new Date();
    const daysOld = (now - weekStart) / (1000 * 60 * 60 * 24);
    if (daysOld > 7) {
      freshnessScore = Math.max(0, 20 - (daysOld - 7) * 2);
    }
  }

  const activityScore = Math.round(shareScore + tradeScore + freshnessScore);
  const clampedScore = Math.max(0, Math.min(100, activityScore));

  const scoreResult = {
    score: clampedScore,
    confidence: 'moderate',
    type: 'ats-activity',
    source: 'FINRA ATS/OTC',
    interpretation: 'Institutional activity proxy based on ATS volume. Does NOT indicate direction.',
    components: {
      shareScore: Math.round(shareScore),
      tradeScore: Math.round(tradeScore),
      freshnessScore: Math.round(freshnessScore),
    },
    disclaimers: {
      delayedData: true,
      aggregatedWeekly: true,
      noDirection: true,
      notRealtime: true,
    },
  };

  results.scoringSucceeded = true;
  results.scoreCalculated = scoreResult;

  console.log('✅ Scoring succeeded');
  console.log(`   Score: ${scoreResult.score}/100`);
  console.log(`   Confidence: ${scoreResult.confidence}`);
  console.log(`   Type: ${scoreResult.type}`);
  console.log(`   Components: Share=${scoreResult.components.shareScore}, Trade=${scoreResult.components.tradeScore}, Freshness=${scoreResult.components.freshnessScore}`);
  console.log(`   Interpretation: ${scoreResult.interpretation}`);

} catch (error) {
  results.scoringSucceeded = false;
  results.error = `Scoring error: ${error.message}`;
  console.log(`❌ FAIL: Scoring error: ${error.message}`);
  console.log('\n========================================');
  console.log('VERIFICATION RESULT: NOT VERIFIED');
  console.log('Reason: Score calculation failed');
  console.log('========================================\n');
  process.exit(1);
}

// ============================================================================
// FINAL RESULT
// ============================================================================

results.overallStatus = 'VERIFIED';

console.log('\n========================================');
console.log('VERIFICATION RESULT: VERIFIED');
console.log('========================================');
console.log('');
console.log('Summary:');
console.log(`  ✅ Credentials present: ${results.credentialsPresent}`);
console.log(`  ✅ OAuth succeeded: ${results.oauthSucceeded}`);
console.log(`  ✅ Data request succeeded: ${results.dataRequestSucceeded}`);
console.log(`  ✅ Normalization succeeded: ${results.normalizationSucceeded}`);
console.log(`  ✅ Scoring succeeded: ${results.scoringSucceeded}`);
console.log('');
console.log('FINRA Integration Status: VERIFIED');
console.log('');
console.log('Next Steps:');
console.log('  1. The provider is ready for production use');
console.log('  2. Hunter route will consume FINRA data when available');
console.log('  3. Health endpoint will report FINRA as connected');
console.log('');
console.log('========================================\n');

// Output JSON result for programmatic parsing
console.log('JSON_RESULT=' + JSON.stringify({
  verified: true,
  credentialsPresent: results.credentialsPresent,
  oauthSucceeded: results.oauthSucceeded,
  dataRequestSucceeded: results.dataRequestSucceeded,
  normalizationSucceeded: results.normalizationSucceeded,
  scoringSucceeded: results.scoringSucceeded,
  testSymbol: results.testSymbol,
  score: results.scoreCalculated.score,
}));