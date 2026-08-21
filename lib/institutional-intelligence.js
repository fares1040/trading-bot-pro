/**
 * Institutional Intelligence Core (A3.1)
 *
 * Deterministic scoring of institutional/investor activity using ONLY data
 * already available from existing providers:
 *
 *   - SEC EDGAR filings (sec-filings.js)  → filing activity, dilution/offering risk
 *   - FINRA ATS/OTC weekly summary (institutional-provider.js) → ATS volume proxy
 *
 * NO new providers. NO new paid services. NO dark-pool, whale, or real-time
 * flow data. Missing values remain null/UNAVAILABLE. No BUY/SELL/BULLISH/BEARISH.
 *
 * This module is independent from:
 *   - Hunter Score (lib/hunter-intelligence.js)
 *   - Penny Intelligence (lib/penny-intelligence.js)
 *   - Options Intelligence (lib/options-intelligence.js)
 *   - HIC
 *
 * Data Source:
 *   - SEC EDGAR public submissions
 *   - FINRA public ATS/OTC weekly summary (OAuth2, requires credentials)
 *
 * Authentication:
 *   - SEC: public, no key
 *   - FINRA: OAuth2 client credentials (FINRA_API_CLIENT_ID / FINRA_API_CLIENT_SECRET)
 */

// ============================================================================
// HELPERS
// ============================================================================

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

const SEC_RISK_MAP = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  extreme: 'EXTREME',
  unavailable: 'UNAVAILABLE',
};

function mapSecRiskLevel(secRiskLevel) {
  return SEC_RISK_MAP[secRiskLevel] || 'UNAVAILABLE';
}

function classifyActivityFromScore(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'LOW';
  return 'UNAVAILABLE';
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Calculate institutional activity score (0–100) from available data.
 *
 * Uses:
 *   - SEC filing activity (50%): presence + recency of relevant filings
 *   - FINRA ATS activity (50%): when available (requires verified provider)
 *
 * Weights are renormalized when only one source is available.
 * No probabilities, win rates, or directional prediction.
 *
 * @param {Object|null} secData — output of buildSecIntelligence()
 * @param {Object|null} finraScore — output of calculateInstitutionalScore()
 * @returns {number|null} 0–100 or null
 */
export function calculateInstitutionalActivityScore(secData, finraScore) {
  const components = [];

  // SEC filing activity (50%)
  if (secData && secData.secDataStatus === 'ok') {
    let secScore = 40;
    const filingCount = secData.latestRelevantFilings?.length || 0;
    secScore += Math.min(30, filingCount * 5);

    const hasRiskyFilings = (secData.secRiskFlags || []).some(
      (f) =>
        f.includes('DILUTION') ||
        f.includes('OFFERING') ||
        f.includes('REVERSE_SPLIT')
    );
    if (hasRiskyFilings) secScore += 10;

    components.push({ score: Math.min(100, secScore), weight: 0.5 });
  }

  // FINRA ATS activity (50%)
  if (finraScore && finraScore.score != null) {
    components.push({ score: finraScore.score, weight: 0.5 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);

  return Math.round(Math.min(100, weightedSum / totalWeight));
}

// ============================================================================
// CLASSIFIERS
// ============================================================================

/**
 * Classify ownership strength from available data.
 *
 * @param {Object|null} secData — output of buildSecIntelligence()
 * @param {Object|null} finraData — output of fetchInstitutionalData() (raw normalized data)
 * @returns {string} STRONG | MODERATE | WEAK | UNAVAILABLE
 */
export function classifyOwnershipStrength(secData, finraData) {
  if (!secData && !finraData) return 'UNAVAILABLE';

  const hasSec = secData?.secDataStatus === 'ok';
  const hasFinra = finraData?.verified === true || finraData?.available === true;

  if (hasSec && hasFinra) {
    const shares = n(finraData?.atsShareQuantity);
    if (shares != null && shares >= 1000000) return 'STRONG';
    const filingCount = secData.latestRelevantFilings?.length || 0;
    if (filingCount >= 3) return 'STRONG';
    return 'MODERATE';
  }

  if (hasSec) {
    const filingCount = secData.latestRelevantFilings?.length || 0;
    if (filingCount >= 3) return 'MODERATE';
    if (filingCount >= 1) return 'WEAK';
    return 'WEAK';
  }

  if (hasFinra) {
    const shares = n(finraData?.atsShareQuantity);
    if (shares != null && shares >= 100000) return 'MODERATE';
    if (shares != null && shares >= 10000) return 'WEAK';
    return 'UNAVAILABLE';
  }

  return 'UNAVAILABLE';
}

/**
 * Classify institutional activity level.
 * @param {number|null} score
 * @returns {string} HIGH | MODERATE | LOW | UNAVAILABLE
 */
export function classifyInstitutionalActivity(score) {
  return classifyActivityFromScore(score);
}

/**
 * Classify institutional risk from SEC risk data.
 * @param {Object|null} secData
 * @returns {string} LOW | MODERATE | HIGH | EXTREME | UNAVAILABLE
 */
export function classifyInstitutionalRisk(secData) {
  if (!secData) return 'UNAVAILABLE';
  if (!secData.secRiskLevel || secData.secRiskLevel === 'unavailable') return 'UNAVAILABLE';
  return mapSecRiskLevel(secData.secRiskLevel);
}

/**
 * Build filing signals from SEC data.
 * @param {Object|null} secData
 * @returns {Array}
 */
export function buildFilingSignals(secData) {
  if (!secData || secData.secDataStatus !== 'ok') return [];

  return (secData.latestRelevantFilings || []).map((f) => ({
    form: f.form || null,
    filingDate: f.filingDate || null,
    riskFlags: secData.secRiskFlags || [],
  }));
}

// ============================================================================
// REASONS / WARNINGS / FLAGS
// ============================================================================

/**
 * Build deterministic reasons from available institutional data.
 * @param {Object|null} secData
 * @param {Object|null} finraScore
 * @param {number|null} activityScore
 * @returns {Array<string>}
 */
export function buildInstitutionalReasons(secData, finraScore, activityScore) {
  const reasons = [];

   if (secData) {
     if (secData.secDataStatus === 'ok') {
       const count = secData.latestRelevantFilings?.length || 0;
       reasons.push(`SEC filings available (${count} recent)`);
     } else if (secData.secDataStatus === 'no_filings') {
       reasons.push('No recent SEC filings');
     } else {
       reasons.push('SEC data unavailable');
     }

     if (
       secData.secRiskLevel &&
       secData.secRiskLevel !== 'unavailable' &&
       secData.secRiskLevel !== 'low'
     ) {
       reasons.push(`SEC risk: ${secData.secRiskLevel}`);
     }
   } else {
     reasons.push('SEC data unavailable');
   }

  if (finraScore) {
    if (finraScore.score != null) {
      reasons.push(`FINRA ATS activity score: ${finraScore.score}/100`);
    }
    if (finraScore.confidence) {
      reasons.push(`FINRA confidence: ${finraScore.confidence}`);
    }
  }

  if (activityScore != null) {
    const level = classifyActivityFromScore(activityScore);
    reasons.push(`Institutional activity: ${level}`);
  }

  return reasons.slice(0, 6);
}

/**
 * Build deterministic warnings from available institutional data.
 * @param {Object|null} secData
 * @param {Object|null} finraScore
 * @returns {Array<string>}
 */
export function buildInstitutionalWarnings(secData, finraScore) {
  const warnings = [];

  if (secData) {
    if (secData.secRiskFlags?.includes('DILUTION_RISK')) {
      warnings.push('SEC_DILUTION_RISK');
    }
    if (secData.secRiskFlags?.includes('OFFERING_RISK')) {
      warnings.push('SEC_OFFERING_RISK');
    }
    if (secData.secRiskFlags?.includes('REVERSE_SPLIT_RISK')) {
      warnings.push('SEC_REVERSE_SPLIT');
    }
  }

   if (finraScore?.disclaimers?.delayedData) {
     warnings.push('FINRA_DATA_DELAYED');
   }

  return warnings;
}

/**
 * Build deterministic flags from available institutional data.
 * @param {Object|null} secData
 * @param {Object|null} finraScore
 * @param {number|null} activityScore
 * @returns {Array<string>}
 */
export function buildInstitutionalFlags(secData, finraScore, activityScore) {
  const flags = [];

  if (activityScore != null && activityScore >= 70) {
    flags.push('HIGH_ACTIVITY');
  }

  if (activityScore != null && activityScore >= 40) {
    flags.push('MODERATE_ACTIVITY');
  }

   if (finraScore && finraScore.score != null) {
     flags.push('FINRA_DATA_AVAILABLE');
   }

  if (secData && secData.secDataStatus === 'ok') {
    flags.push('SEC_DATA_AVAILABLE');
  }

  const risk = classifyInstitutionalRisk(secData);
  if (risk === 'EXTREME' || risk === 'HIGH') {
    flags.push('HIGH_INSTITUTIONAL_RISK');
  }

  return flags;
}

// ============================================================================
// MAIN ENTRY: PURE FUNCTION
// ============================================================================

/**
 * Build complete institutional intelligence from pre-fetched data.
 *
 * Pure function — no network calls. Accepts already-fetched SEC and FINRA
 * data and computes the full institutional intelligence object.
 *
 * @param {string} symbol — Stock ticker
 * @param {Object|null} secData — output of buildSecIntelligence()
 * @param {Object|null} finraData — output of fetchInstitutionalData() (raw normalized data)
 * @param {Object|null} finraScore — output of calculateInstitutionalScore() (when available)
 * @returns {Object} institutional intelligence
 */
export function buildInstitutionalIntelligence(symbol, secData, finraData, finraScore) {
  const activityScore = calculateInstitutionalActivityScore(secData, finraScore);
  const ownershipStrength = classifyOwnershipStrength(secData, finraData);
  const activity = classifyActivityFromScore(activityScore);
  const filingSignals = buildFilingSignals(secData);
  const risk = classifyInstitutionalRisk(secData);
  const reasons = buildInstitutionalReasons(secData, finraScore, activityScore);
  const warnings = buildInstitutionalWarnings(secData, finraScore);
  const flags = buildInstitutionalFlags(secData, finraScore, activityScore);

  const hasSec = secData?.secDataStatus === 'ok';
  const hasFinra = finraScore && finraScore.score != null;

  let dataStatus = 'unavailable';
  if (hasSec && hasFinra) {
    dataStatus = 'complete';
  } else if (hasSec || hasFinra) {
    dataStatus = 'partial';
  }

  return {
    symbol: typeof symbol === 'string' ? symbol : null,
    institutionalActivityScore: activityScore,
    ownershipStrength,
    institutionalActivity: activity,
    filingSignals,
    institutionalRisk: risk,
    reasons,
    warnings,
    flags,
    dataStatus,
    secDataStatus: secData?.secDataStatus || 'unavailable',
    finraAvailable: hasFinra,
    finraWeekStartDate: finraData?.weekStartDate || null,
    provider: hasFinra ? 'finra' : hasSec ? 'sec' : null,
  };
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function defaultInstitutionalIntelligence() {
  return {
    symbol: null,
    institutionalActivityScore: null,
    ownershipStrength: 'UNAVAILABLE',
    institutionalActivity: 'UNAVAILABLE',
    filingSignals: [],
    institutionalRisk: 'UNAVAILABLE',
    reasons: [],
    warnings: [],
    flags: [],
    dataStatus: 'unavailable',
    secDataStatus: 'unavailable',
    finraAvailable: false,
    finraWeekStartDate: null,
    provider: null,
  };
}
