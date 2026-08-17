/**
 * Institutional Intelligence Provider Abstraction
 *
 * Phase 5.1 — FINRA ATS/OTC Integration
 *
 * This module provides a clean abstraction for institutional data sources.
 * Currently integrated with FINRA public ATS/OTC weekly summary data.
 *
 * IMPORTANT:
 * - No institutional data is fabricated or generated.
 * - No paid providers are subscribed or integrated.
 * - FINRA ATS/OTC data is delayed/aggregated institutional-market activity.
 * - Do NOT label it as real-time dark-pool flow or options flow.
 * - When no provider is configured, all functions return safe fallback values.
 *
 * Data Source:
 * - FINRA OTCMarket weeklySummary production dataset
 * - https://api.finra.org/data/group/otcMarket/name/weeklySummary
 *
 * Authentication:
 * - FINRA Public API uses OAuth2 client credentials
 * - Requires FINRA_API_CLIENT_ID and FINRA_API_CLIENT_SECRET
 */

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const FINRA_API_CLIENT_ID = process.env.FINRA_API_CLIENT_ID || '';
const FINRA_API_CLIENT_SECRET = process.env.FINRA_API_CLIENT_SECRET || '';

// FINRA API endpoints
const FINRA_TOKEN_URL = 'https://ews.fip.finra.org/fip/rest/ews/oauth2/access_token';
const FINRA_DATA_URL = 'https://api.finra.org/data/group/otcMarket/name/weeklySummary';

// Token cache (in-memory, per-instance)
let finraTokenCache = {
  accessToken: null,
  expiresAt: 0, // Unix timestamp in milliseconds
};

// Data cache (in-memory, per-instance) - caches weekly data per symbol
const finraDataCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache for weekly data

// Verification flag (in-memory, per-instance).
// Set to true ONLY after a real FINRA OAuth + data fetch + normalize + score
// succeeds in the running environment. Used by /api/health to report the
// provider as 'connected' instead of 'configured-awaiting-verification'.
// This does NOT change any trading/scoring logic — it only reflects that a
// real production verification was performed.
let finraVerified = false;
let finraVerifiedAt = 0;

// ============================================================================
// FINRA AUTHENTICATION
// ============================================================================

/**
 * Check if FINRA credentials are configured
 * @returns {boolean}
 */
function isFinraConfigured() {
  return Boolean(FINRA_API_CLIENT_ID && FINRA_API_CLIENT_SECRET);
}

/**
 * Get a valid FINRA access token using OAuth2 client credentials flow
 * 
 * The token is cached in memory until shortly before expiry.
 * 
 * @returns {Promise<string|null>} Access token or null if authentication failed
 */
async function getFinraAccessToken() {
  // Check if we have a valid cached token
  const now = Date.now();
  if (finraTokenCache.accessToken && finraTokenCache.expiresAt > now + 60000) {
    // Token is valid for at least 1 more minute
    return finraTokenCache.accessToken;
  }

  // Request new token
  try {
    // FINRA OAuth2 expects HTTP Basic Auth with client credentials
    // Encode credentials as base64 for Basic Auth header
    const credentials = Buffer.from(`${FINRA_API_CLIENT_ID}:${FINRA_API_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${FINRA_TOKEN_URL}?grant_type=client_credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('[FINRA] Token request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('[FINRA] No access_token in response');
      return null;
    }

    // Cache the token
    const expiresIn = Number(data.expires_in) || 3600; // Default 1 hour
    finraTokenCache = {
      accessToken: data.access_token,
      expiresAt: now + expiresIn * 1000,
    };

    return data.access_token;
  } catch (error) {
    console.error('[FINRA] Token request error:', error.message);
    return null;
  }
}

// ============================================================================
// FINRA DATA FETCHING
// ============================================================================

/**
 * Fetch FINRA ATS/OTC weekly summary data for a symbol
 * 
 * Uses GET request with query parameters.
 * FINRA API prefers GET requests with Accept: application/json header.
 *
 * @param {string} symbol - Stock ticker symbol
 * @param {string} accessToken - Valid FINRA access token
 * @returns {Promise<Object|null>} Raw FINRA response or null
 */
async function fetchFinraWeeklySummary(symbol, accessToken) {
  try {
    // Check cache first
    const cacheKey = symbol.toUpperCase();
    const cached = finraDataCache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - CACHE_TTL_MS) {
      return cached.data;
    }

    // FINRA API uses GET requests with query parameters
    // Build the URL with limit parameter
    const params = new URLSearchParams({
      limit: '20',
    });

    // Add symbol filter if provided
    const url = `${FINRA_DATA_URL}?${params.toString()}&issueSymbolIdentifier=${symbol.toUpperCase()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No data for this symbol - not an error, just no data
        return null;
      }
      console.error('[FINRA] Data request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // FINRA returns data as an array
    // Filter to records matching the requested symbol
    let records = Array.isArray(data) ? data : data?.results || [];
    
    // Filter to only records matching the symbol
    records = records.filter(r => 
      r.issueSymbolIdentifier && 
      r.issueSymbolIdentifier.toUpperCase() === symbol.toUpperCase()
    );

    // Also filter to prefer ATS records (ATS_W_SMBL, ATS_W_VOL_STATS)
    // But include all record types if no ATS records exist
    const atsRecords = records.filter(r => 
      r.summaryTypeCode && r.summaryTypeCode.startsWith('ATS_W')
    );
    
    if (atsRecords.length > 0) {
      records = atsRecords;
    }

    if (records.length === 0) {
      return null;
    }

    // Cache the result
    finraDataCache.set(cacheKey, {
      data: records,
      timestamp: Date.now(),
    });

    return records;
  } catch (error) {
    console.error('[FINRA] Data request error for', symbol, ':', error.message);
    return null;
  }
}

/**
 * Normalize FINRA ATS/OTC data into internal structure
 *
 * Prefers ATS summary records (ATS_W_SMBL) when available.
 * Falls back to OTC summary records if no ATS data.
 *
 * @param {Array} records - Raw FINRA records
 * @param {string} symbol - Requested symbol
 * @returns {Object|null} Normalized data or null
 */
function normalizeFinraData(records, symbol) {
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  // Prefer ATS records
  let atsRecord = records.find(r => r.summaryTypeCode === 'ATS_W_SMBL');

  // Fall back to first record if no ATS record
  const record = atsRecord || records[0];

  if (!record) {
    return null;
  }

  // Extract and validate numeric values
  const shareQuantity = Number(record.totalWeeklyShareQuantity);
  const tradeCount = Number(record.totalWeeklyTradeCount);

  // Validate we have meaningful data
  if (!Number.isFinite(shareQuantity) || !Number.isFinite(tradeCount)) {
    return null;
  }

  return {
    provider: 'finra',
    symbol: symbol.toUpperCase(),
    available: true,
    source: 'FINRA ATS/OTC',
    dataTimestamp: record.lastUpdateDate || null,
    weekStartDate: record.weekStartDate || null,
    issueName: record.issueName || null,
    atsShareQuantity: shareQuantity,
    atsTradeCount: tradeCount,
    summaryType: record.summaryTypeCode || 'UNKNOWN',
    tier: record.tierIdentifier || null,
    verified: true,
    // Important disclaimers
    disclaimers: {
      delayed: true,
      aggregated: true,
      notRealtime: true,
      notDarkPoolFlow: true,
      notOptionsFlow: true,
    },
  };
}

// ============================================================================
// INSTITUTIONAL SCORING
// ============================================================================

/**
 * Calculate institutional activity score from FINRA data
 *
 * IMPORTANT: This score measures ATS/OTC activity intensity only.
 * It does NOT indicate institutional buying or selling direction.
 * FINRA ATS/OTC data is delayed/aggregated and cannot determine direction.
 *
 * Score is derived from:
 * - Normalized ATS share quantity (log scale for magnitude)
 * - Normalized ATS trade count
 * - Data freshness (more recent = higher weight)
 *
 * @param {Object} data - Normalized FINRA data
 * @returns {Object|null} Score object or null if insufficient data
 */
export function calculateInstitutionalScore(data) {
  if (!data || !data.verified || data.available !== true) {
    return null;
  }

  // Must have FINRA data
  if (data.provider !== 'finra') {
    return null;
  }

  const shareQuantity = Number(data.atsShareQuantity);
  const tradeCount = Number(data.atsTradeCount);

  // Validate numeric values
  if (!Number.isFinite(shareQuantity) || !Number.isFinite(tradeCount)) {
    return null;
  }

  // Must have meaningful activity
  if (shareQuantity <= 0 || tradeCount <= 0) {
    return null;
  }

  // Calculate activity intensity score
  // Using log scale to handle wide range of volumes
  // Score ranges from 0-100

  // Share quantity component (log scale, max ~50 points)
  // Typical ATS volumes range from thousands to billions
  // log10(1,000,000) = 6, log10(10,000,000,000) = 10
  const logShares = Math.log10(Math.max(1, shareQuantity));
  const shareScore = Math.min(50, (logShares / 10) * 50);

  // Trade count component (log scale, max ~30 points)
  const logTrades = Math.log10(Math.max(1, tradeCount));
  const tradeScore = Math.min(30, (logTrades / 6) * 30);

  // Freshness component (max 20 points)
  // More recent data = higher score
  let freshnessScore = 20;
  if (data.weekStartDate) {
    const weekStart = new Date(data.weekStartDate);
    const now = new Date();
    const daysOld = (now - weekStart) / (1000 * 60 * 60 * 24);
    // Reduce score for older data (weekly data, so anything > 7 days is stale)
    if (daysOld > 7) {
      freshnessScore = Math.max(0, 20 - (daysOld - 7) * 2);
    }
  }

  const activityScore = Math.round(shareScore + tradeScore + freshnessScore);

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, activityScore));

  return {
    score: clampedScore,
    confidence: 'moderate', // FINRA data is verified but delayed
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
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a verified institutional provider is configured
 * @returns {boolean}
 */
export function isProviderConfigured() {
  return isFinraConfigured();
}

/**
 * Get the current institutional provider configuration status
 * @returns {Object} Provider status object
 */
export function getInstitutionalProviderStatus() {
  if (!isFinraConfigured()) {
    return {
      available: false,
      score: null,
      provider: null,
      confidence: null,
      capabilities: {
        atsActivity: false,
        otcActivity: false,
        darkPoolRealtime: false,
        optionsFlow: false,
        whaleFlow: false,
        openInterest: false,
      },
      reason: 'FINRA credentials not configured. Set FINRA_API_CLIENT_ID and FINRA_API_CLIENT_SECRET.',
      configured: false,
    };
  }

    // FINRA is configured
    return {
      available: finraVerified, // true only after a real verification succeeds
      verified: finraVerified,
      score: null,
    provider: 'finra',
    confidence: null,
    capabilities: {
      atsActivity: true, // FINRA provides ATS data
      otcActivity: true, // FINRA provides OTC data
      darkPoolRealtime: false, // NOT real-time dark pool
      optionsFlow: false, // FINRA does NOT provide options flow
      whaleFlow: false, // FINRA does NOT provide whale flow
      openInterest: false, // FINRA does NOT provide open interest
    },
    reason: 'FINRA credentials configured. Provider ready for data requests.',
    configured: true,
  };
}

/**
 * Fetch institutional data for a given symbol
 *
 * When no provider is configured or verified, returns null.
 * This function is designed to be called from API routes and Hunter aggregation.
 *
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object|null>} Institutional data or null if unavailable
 */
export async function fetchInstitutionalData(symbol) {
  if (!isFinraConfigured()) {
    return null;
  }

  if (!symbol || typeof symbol !== 'string') {
    return null;
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    // Get access token
    const accessToken = await getFinraAccessToken();
    if (!accessToken) {
      console.error('[FINRA] Could not obtain access token for', upperSymbol);
      return {
        provider: 'finra',
        symbol: upperSymbol,
        available: false,
        reason: 'finra-auth-failed',
        verified: false,
      };
    }

    // Fetch weekly summary data
    const records = await fetchFinraWeeklySummary(upperSymbol, accessToken);
    if (!records) {
      return {
        provider: 'finra',
        symbol: upperSymbol,
        available: false,
        reason: 'no-finra-ats-data',
        verified: false,
      };
    }

    // Normalize the data
    const normalized = normalizeFinraData(records, upperSymbol);
    return normalized;
  } catch (error) {
    console.error('[FINRA] Error fetching data for', upperSymbol, ':', error.message);
    return {
      provider: 'finra',
      symbol: upperSymbol,
      available: false,
      reason: 'finra-request-error',
      error: error.message,
      verified: false,
    };
  }
}

/**
 * Get provider capabilities
 * @returns {Object} Capabilities matrix for current provider
 */
export function getProviderCapabilities() {
  const status = getInstitutionalProviderStatus();
  return status.capabilities;
}

/**
 * Validate provider connection
 *
 * Tests FINRA API connectivity by attempting to authenticate.
 *
 * @returns {Promise<Object>} Validation result
 */
export async function validateProviderConnection() {
  if (!isFinraConfigured()) {
    return {
      valid: false,
      reason: 'FINRA credentials not configured.',
    };
  }

  try {
    const accessToken = await getFinraAccessToken();
    if (!accessToken) {
      return {
        valid: false,
        reason: 'FINRA authentication failed. Check FINRA_API_CLIENT_ID and FINRA_API_CLIENT_SECRET.',
      };
    }

    return {
      valid: true,
      reason: 'FINRA authentication successful.',
      provider: 'finra',
    };
  } catch (error) {
    return {
      valid: false,
      reason: `FINRA connection error: ${error.message}`,
    };
  }
}

/**
 * Record a successful real FINRA verification in the running environment.
 *
 * Called by the isolated /api/finra-verify route after a real OAuth +
 * data fetch + normalize + score chain succeeds. This flips the in-memory
 * verification flag so /api/health reports the provider as 'connected'.
 *
 * It does NOT change trading logic, scoring, HIC, or market regime.
 */
export function recordFinraVerificationSuccess() {
  finraVerified = true;
  finraVerifiedAt = Date.now();
}

/**
 * Check whether a real FINRA verification has succeeded in this instance.
 * @returns {boolean}
 */
export function isFinraVerified() {
  return finraVerified;
}

/**
 * Build institutional context for Hunter Score
 *
 * This function is used by the Hunter aggregation layer.
 * It returns the institutional status that should be passed to calculateHunterScore().
 *
 * @returns {Object} Institutional context for scoring
 */
export function buildInstitutionalContext() {
  const status = getInstitutionalProviderStatus();

  return {
    available: status.available,
    score: status.score,
    provider: status.provider,
    confidence: status.confidence,
    reason: status.reason,
  };
}

/**
 * Clear internal caches (useful for testing)
 */
export function clearCaches() {
  finraTokenCache = {
    accessToken: null,
    expiresAt: 0,
  };
  finraDataCache.clear();
}