/**
 * Institutional Signal Layer (A3.2)
 *
 * Deterministic signal and conviction layer built on top of A3.1's
 * Institutional Intelligence Core.
 *
 * Signal score (0–100) = activity (60%) + data quality (20%) + freshness (20%)
 * Conviction = confidence in the signal given activity level + data completeness.
 *
 * NO new providers. NO directional claims (BUY/SELL/BULLISH/BEARISH).
 * NO dark-pool / whale / 13F / insider data unless real provider data exists.
 * Missing values remain null/UNAVAILABLE.
 *
 * Independent from:
 *   - Hunter Score (lib/hunter-intelligence.js)
 *   - Penny Intelligence (lib/penny-intelligence.js)
 *   - Options Intelligence (lib/options-intelligence.js)
 *   - HIC
 *
 * Reuses data from existing providers:
 *   - SEC EDGAR filings (sec-filings.js)
 *   - FINRA ATS/OTC weekly summary (institutional-provider.js)
 */

// ============================================================================
// DATA QUALITY
// ============================================================================

/**
 * Score data completeness (0–100).
 *
 *   complete (both SEC + FINRA): 100
 *   partial  (one source only):  60
 *   unavailable:                  0
 *
 * @param {Object} institutionalIntelligence — output of buildInstitutionalIntelligence()
 * @returns {number} 0 | 60 | 100
 */
export function calculateDataQuality(instelligence) {
  const ds = instelligence?.dataStatus;
  if (ds === 'complete') return 100;
  if (ds === 'partial') return 60;
  return 0;
}

// ============================================================================
// FRESHNESS
// ============================================================================

/**
 * Score data freshness (0–100) based on most recent SEC filing date.
 *
 *   < 30 days:  100
 *   30–90:      70
 *   90–180:     40
 *   > 180 or no dates: 0
 *
 * When SEC data is unavailable but FINRA data exists, freshness falls
 * back to FINRA weekStartDate if present.
 *
 * @param {Object} intelligence
 * @returns {number} 0–100
 */
export function calculateFreshness(intelligence) {
  if (!intelligence) return 0;

  const signals = intelligence.filingSignals || [];
  const finraWeekStart = intelligence.finraWeekStartDate || null;

  let mostRecent = null;

  for (const s of signals) {
    if (s?.filingDate) {
      const d = new Date(s.filingDate).getTime();
      if (Number.isFinite(d)) {
        if (mostRecent === null || d > mostRecent) mostRecent = d;
      }
    }
  }

  // If no SEC filing dates, try FINRA weekStartDate
  if (mostRecent === null && finraWeekStart) {
    const d = new Date(finraWeekStart).getTime();
    if (Number.isFinite(d)) mostRecent = d;
  }

  if (mostRecent === null) return 0;

  const daysAgo = (Date.now() - mostRecent) / (1000 * 60 * 60 * 24);

  if (daysAgo < 0) return 0; // future date — suspicious
  if (daysAgo <= 30) return 100;
  if (daysAgo <= 90) return 70;
  if (daysAgo <= 180) return 40;
  return 0;
}

// ============================================================================
// SIGNAL SCORE
// ============================================================================

/**
 * Calculate institutional signal score (0–100) from A3.1 intelligence output.
 *
 *   activity   (60%) — institutionalActivityScore from A3.1
 *   dataQuality (20%) — completeness of data sources
 *   freshness   (20%) — recency of SEC filings / FINRA week
 *
 * Weights are applied unconditionally — when a component is 0,
 * it simply contributes 0 (no fabrication, no imputation).
 *
 * @param {Object} intelligence — output of buildInstitutionalIntelligence()
 * @returns {number|null} 0–100 or null (when no data at all)
 */
export function calculateInstitutionalSignalScore(intelligence) {
  if (
    !intelligence ||
    intelligence.dataStatus === 'unavailable' ||
    intelligence.institutionalActivityScore == null
  ) {
    return null;
  }

  const activity = intelligence.institutionalActivityScore;
  const quality = calculateDataQuality(intelligence);
  const freshness = calculateFreshness(intelligence);

  const score = activity * 0.6 + quality * 0.2 + freshness * 0.2;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// CONVICTION
// ============================================================================

/**
 * Classify institutional conviction.
 *
 *   HIGH:       signalScore >= 70 AND dataStatus === 'complete'
 *   MEDIUM:     signalScore >= 50 AND dataStatus !== 'unavailable'
 *   LOW:        signalScore >= 30 AND dataStatus !== 'unavailable'
 *   UNAVAILABLE: otherwise
 *
 * @param {number|null} signalScore
 * @param {string} dataStatus — 'complete' | 'partial' | 'unavailable'
 * @returns {string} HIGH | MEDIUM | LOW | UNAVAILABLE
 */
export function classifyInstitutionalConviction(signalScore, dataStatus) {
  if (dataStatus === 'unavailable' || signalScore == null) {
    return 'UNAVAILABLE';
  }

  if (signalScore >= 70 && dataStatus === 'complete') return 'HIGH';
  if (signalScore >= 50 && dataStatus !== 'unavailable') return 'MEDIUM';
  if (signalScore >= 30 && dataStatus !== 'unavailable') return 'LOW';
  return 'UNAVAILABLE';
}

// ============================================================================
// SIGNAL REASONS / WARNINGS / FLAGS
// ============================================================================

/**
 * Build deterministic signal reasons, extending A3.1 reasons.
 * Capped at 8.
 */
export function buildSignalReasons(intelligence, signalScore, conviction) {
  const reasons = [];

  // Inherit A3.1 reasons
  if (Array.isArray(intelligence?.reasons)) {
    reasons.push(...intelligence.reasons);
  }

  // Signal-specific
  if (signalScore != null) {
    reasons.push(`Institutional signal score: ${signalScore}/100`);
  }
  reasons.push(`Institutional conviction: ${conviction}`);

  const dq = calculateDataQuality(intelligence);
  if (dq === 100) {
    reasons.push('Data sources complete (SEC + FINRA)');
  } else if (dq === 60) {
    reasons.push('Data sources partial (one provider)');
  }

  const f = calculateFreshness(intelligence);
  if (f === 100) {
    reasons.push('Recent institutional activity (< 30 days)');
  } else if (f === 70) {
    reasons.push('Moderate institutional activity (30-90 days)');
  } else if (f === 40) {
    reasons.push('Stale institutional activity (90-180 days)');
  } else if (f === 0 && dq > 0) {
    reasons.push('No filing dates available for freshness assessment');
  }

  return reasons.slice(0, 8);
}

/**
 * Build signal-specific warnings, extending A3.1 warnings.
 */
export function buildSignalWarnings(intelligence, signalScore) {
  const warnings = [];

  // Inherit A3.1 warnings
  if (Array.isArray(intelligence?.warnings)) {
    warnings.push(...intelligence.warnings);
  }

  // Signal-specific
  if (signalScore == null) {
    warnings.push('INSTITUTIONAL_SIGNAL_NO_DATA');
  } else {
    const dq = calculateDataQuality(intelligence);
    if (dq < 100) {
      warnings.push('INSTITUTIONAL_DATA_PARTIAL');
    }
    if (calculateFreshness(intelligence) === 0 && dq > 0) {
      warnings.push('INSTITUTIONAL_FRESHNESS_STALE');
    }
  }

  return warnings;
}

/**
 * Build signal-specific flags, extending A3.1 flags.
 */
export function buildSignalFlags(intelligence, signalScore, conviction) {
  const flags = [];

  // Inherit A3.1 flags
  if (Array.isArray(intelligence?.flags)) {
    flags.push(...intelligence.flags);
  }

  if (signalScore != null && signalScore >= 60) {
    flags.push('INSTITUTIONAL_SIGNAL_STRONG');
  }
  if (conviction !== 'UNAVAILABLE') {
    flags.push('INSTITUTIONAL_SIGNAL_ACTIVE');
  }
  if (calculateDataQuality(intelligence) === 100) {
    flags.push('INSTITUTIONAL_DATA_COMPLETE');
  }

  return flags;
}

// ============================================================================
// MAIN ENTRY: PURE FUNCTION
// ============================================================================

/**
 * Build complete institutional signal from A3.1 institutional intelligence.
 *
 * Pure function — no network calls. Takes the already-computed A3.1
 * intelligence object and produces the A3.2 signal layer.
 *
 * @param {Object|null} intelligence — output of buildInstitutionalIntelligence()
 * @returns {Object} institutional signal
 */
export function buildInstitutionalSignal(intelligence) {
  if (
    !intelligence ||
    intelligence.dataStatus === 'unavailable' ||
    intelligence.institutionalActivityScore == null
  ) {
    return defaultInstitutionalSignal();
  }

  const activityScore = intelligence.institutionalActivityScore;
  const signalScore = calculateInstitutionalSignalScore(intelligence);
  const conviction = classifyInstitutionalConviction(signalScore, intelligence.dataStatus);
  const activity = intelligence.institutionalActivity;
  const risk = intelligence.institutionalRisk;
  const dataQuality = calculateDataQuality(intelligence);
  const freshness = calculateFreshness(intelligence);

  return {
    symbol: intelligence?.symbol || null,
    institutionalSignalScore: signalScore,
    institutionalConviction: conviction,
    institutionalActivity: activity,
    institutionalRisk: risk,
    reasons: buildSignalReasons(intelligence, signalScore, conviction),
    warnings: buildSignalWarnings(intelligence, signalScore),
    flags: buildSignalFlags(intelligence, signalScore, conviction),
    dataStatus: intelligence.dataStatus,
    // Extended context
    activityScore,
    dataQuality,
    freshness,
  };
}

// ============================================================================
// DEFAULT
// ============================================================================

export function defaultInstitutionalSignal() {
  return {
    symbol: null,
    institutionalSignalScore: null,
    institutionalConviction: 'UNAVAILABLE',
    institutionalActivity: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    reasons: [],
    warnings: ['INSTITUTIONAL_SIGNAL_NO_DATA'],
    flags: [],
    dataStatus: 'unavailable',
    activityScore: null,
    dataQuality: 0,
    freshness: 0,
  };
}
