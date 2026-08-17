import { NextResponse } from 'next/server';
import {
  calculateInstitutionalScore,
  fetchInstitutionalData,
  getInstitutionalProviderStatus,
  recordFinraVerificationSuccess,
  clearCaches,
} from '@/lib/institutional-provider';
import { calculateHunterScore } from '@/lib/hunter-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * FINRA Production Verification (Phase 5.5)
 *
 * Isolated, dependency-free verification path that performs a REAL FINRA
 * API request from the running production environment and reports the
 * exact result. It does NOT change Hunter scoring, HIC, Technical Score,
 * Risk Engine, or Market Regime. It only verifies the institutional
 * provider end-to-end.
 *
 * Steps:
 *   1. Only runs when FINRA credentials are configured in this environment.
 *   2. Performs a real OAuth2 client-credentials token request.
 *   3. Performs a real weeklySummary data request for a liquid test symbol.
 *   4. Normalizes the returned FINRA records.
 *   5. Calculates the institutional activity score on the REAL data.
 *   6. Verifies Hunter can consume the score via calculateHunterScore().
 *   7. On full success, records the verification so /api/health reports
 *      the provider as 'connected' (in-memory, per-instance).
 *
 * No credentials, tokens, or secrets are ever returned or logged.
 * No market data is fabricated. No trading logic is modified.
 *
 * GET /api/finra-verify?symbol=NVDA
 */
export async function GET(request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || 'NVDA').toUpperCase();

  // Only run when FINRA is configured in the current environment.
  const status = getInstitutionalProviderStatus();
  if (!status.configured) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        reason: 'FINRA credentials not configured in this environment.',
        steps: {
          credentialsPresent: false,
          oauthSucceeded: false,
          dataRequestSucceeded: false,
          normalizationSucceeded: false,
          scoringSucceeded: false,
          hunterConsumptionSucceeded: false,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const result = {
    success: false,
    verified: false,
    symbol,
    timestamp: new Date().toISOString(),
    steps: {},
    dataSummary: null,
    scoreSummary: null,
    hunterCalculation: null,
    errors: [],
  };

  // ------------------------------------------------------------------
  // Step 1: Real OAuth2 token request + Real data fetch (single path)
  // ------------------------------------------------------------------
  // fetchInstitutionalData performs the real token request and the real
  // weeklySummary data request, then normalizes. We use it so the
  // verification exercises the exact production code path Hunter uses.
  try {
    clearCaches(); // Force a fresh real request; do not reuse cached tokens/data
  } catch {
    // cache reset is best-effort
  }

  let institutionalData = null;
  try {
    institutionalData = await fetchInstitutionalData(symbol);
  } catch (error) {
    result.steps.oauthSucceeded = false;
    result.steps.dataRequestSucceeded = false;
    result.errors.push(`request-chain-error: ${error?.message || 'unknown'}`);
  }

  if (!institutionalData) {
    result.steps.oauthSucceeded = false;
    result.steps.dataRequestSucceeded = false;
    result.errors.push('no-institutional-data-returned');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  // Distinguish auth failure from no-data without exposing token details.
  if (institutionalData.reason === 'finra-auth-failed') {
    result.steps.oauthSucceeded = false;
    result.errors.push('finra-oauth-failed');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  if (institutionalData.reason === 'no-finra-ats-data') {
    result.steps.oauthSucceeded = true;
    result.steps.dataRequestSucceeded = false;
    result.errors.push('finra-authenticated-but-no-weekly-summary-data');
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  if (institutionalData.reason === 'finra-request-error') {
    result.steps.oauthSucceeded = false;
    result.steps.dataRequestSucceeded = false;
    result.errors.push(`finra-request-error: ${institutionalData.error || 'unknown'}`);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  // OAuth succeeded (a valid token was required to get data) and real data was fetched.
  result.steps.oauthSucceeded = !institutionalData.reason;
  result.steps.dataRequestSucceeded = institutionalData.available === true && !institutionalData.reason;

  // Step 2: Normalization succeeded (institutionalData is the normalized object).
  result.steps.normalizationSucceeded = institutionalData.available === true;

  result.dataSummary = {
    available: institutionalData.available === true,
    source: institutionalData.source || null,
    weekStartDate: institutionalData.weekStartDate || null,
    issueName: institutionalData.issueName || null,
    atsShareQuantity: institutionalData.atsShareQuantity ?? null,
    atsTradeCount: institutionalData.atsTradeCount ?? null,
    summaryType: institutionalData.summaryType || null,
  };

  // Step 3: Scoring on REAL normalized data.
  const scoreData = calculateInstitutionalScore(institutionalData);
  result.steps.scoringSucceeded = Boolean(scoreData);

  if (scoreData) {
    result.scoreSummary = {
      score: scoreData.score,
      confidence: scoreData.confidence,
      type: scoreData.type,
      components: scoreData.components,
      interpretation: scoreData.interpretation,
    };

    // Step 4: Verify Hunter can consume the score (scoring function only,
    // no change to Hunter logic or thresholds).
    const hunter = calculateHunterScore({
      setupScore: 75,
      convictionScore: 70,
      regimeScore: 60,
      hicEligible: true,
      institutionalAvailable: true,
      institutionalScore: scoreData.score,
    });
    result.steps.hunterConsumptionSucceeded = Boolean(hunter && Number.isFinite(hunter.score));
    result.hunterCalculation = hunter;
  }

  // Step 5: If every step passed, record the verification so /api/health
  // reports 'connected' in this instance.
  const verified =
    result.steps.oauthSucceeded &&
    result.steps.dataRequestSucceeded &&
    result.steps.normalizationSucceeded &&
    result.steps.scoringSucceeded &&
    result.steps.hunterConsumptionSucceeded;

  result.success = verified;
  result.verified = verified;

  if (verified) {
    recordFinraVerificationSuccess();
    result.reason = 'FINRA verified end-to-end in this environment: OAuth + weeklySummary data + normalization + scoring + Hunter consumption all succeeded on real data.';
  } else {
    result.reason = 'FINRA verification did not fully succeed on real data. See steps and errors.';
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}