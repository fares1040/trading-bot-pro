/**
 * Institutional Decision Layer (A3 Final)
 *
 * Final decision score combining A3.1 (Intelligence), A3.2 (Signal),
 * and A3.3 (Ranking) into a single Institutional Decision Score (0–100).
 *
 * Decision Score formula:
 *   decisionScore =
 *     rankScore × 0.5       (A3.3: quality-adjusted signal)
 *     + signalScore × 0.3   (A3.2: raw institutional signal)
 *     + executionQuality × 0.2 (data quality + freshness)
 *
 * Where:
 *   executionQuality = (dataQualityScore + freshnessScore) / 2
 *   dataQualityScore = signal.dataQuality (0 | 60 | 100)
 *   freshnessScore   = signal.freshness (0–100)
 *
 * If rankScore or signalScore is null, they contribute 0 (no fabrication).
 *
 * NO new providers. NO directional claims (BUY/SELL/BULLISH/BEARISH).
 * NO fabricated 13F, insider, dark-pool, whale, or real-time flow data.
 *
 * Reuses:
 *   - SEC EDGAR filings (sec-filings.js)
 *   - FINRA ATS/OTC weekly summary (institutional-provider.js)
 *
 * Independent from:
 *   - Hunter Score (lib/hunter-intelligence.js)
 *   - Penny Intelligence (lib/penny-intelligence.js)
 *   - Options Intelligence (lib/options-intelligence.js)
 */

// ============================================================================
// EXECUTION QUALITY
// ============================================================================

/**
 * Calculate execution quality (0–100) from signal layer.
 * Combines data quality score (0/60/100) and freshness score (0–100).
 *
 * @param {Object|null} signal — output of buildInstitutionalSignal()
 * @returns {number|null} 0–100 or null
 */
export function calculateExecutionQuality(signal) {
  if (!signal) return null;

  const dq = signal.dataQuality != null ? signal.dataQuality : 0;
  const fr = signal.freshness != null ? signal.freshness : 0;

  return Math.round(Math.max(0, Math.min(100, (dq + fr) / 2)));
}

// ============================================================================
// DECISION SCORE
// ============================================================================

/**
 * Calculate institutional decision score (0–100).
 *
 * Combines:
 *   - Rank Score (50%): A3.3 quality-adjusted institutional signal
 *   - Signal Score (30%): A3.2 raw institutional signal score
 *   - Execution Quality (20%): data quality + freshness for actionability
 *
 * Null-safe: any null component contributes 0 to the weighted sum.
 * All non-null components are renormalized by the effective weight.
 *
 * @param {Object|null} intelligence — output of buildInstitutionalIntelligence() (A3.1)
 * @param {Object|null} signal — output of buildInstitutionalSignal() (A3.2)
 * @param {Object|null} rank — output of rankInstitutionalSignal() (A3.3)
 * @returns {number|null} 0–100 or null
 */
export function calculateInstitutionalDecisionScore(intelligence, signal, rank) {
  if (!intelligence && !signal && !rank) return null;

  const rankScore = rank?.institutionalRankScore ?? signal?.institutionalSignalScore ?? null;
  const signalScore = signal?.institutionalSignalScore ?? null;
  const execQuality = calculateExecutionQuality(signal);

  // If both rank and signal scores are null, there's no institutional signal
  if (rankScore == null && signalScore == null) {
    return null;
  }

  // Normalize each component to 0–100, null → 0
  const r = Number.isFinite(rankScore) ? rankScore : 0;
  const s = Number.isFinite(signalScore) ? signalScore : 0;
  const eq = Number.isFinite(execQuality) ? execQuality : 0;

  const score = r * 0.5 + s * 0.3 + eq * 0.2;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// STATUS CLASSIFICATION
// ============================================================================

/**
 * Final institutional status classification from decision score.
 *
 *   DECISION_TOP    — >= 80 (strong signal, high execution quality)
 *   DECISION_STRONG — >= 60
 *   DECISION_WATCH  — >= 40
 *   DECISION_MONITOR— >= 20
 *   DECISION_OBSERVE— >= 5  (some data, weak signal)
 *   UNAVAILABLE     — < 5 or null
 *
 * @param {number|null} decisionScore
 * @returns {string}
 */
export function classifyInstitutionalStatus(decisionScore) {
  if (decisionScore == null || Number.isNaN(decisionScore)) return 'UNAVAILABLE';
  if (decisionScore >= 80) return 'DECISION_TOP';
  if (decisionScore >= 60) return 'DECISION_STRONG';
  if (decisionScore >= 40) return 'DECISION_WATCH';
  if (decisionScore >= 20) return 'DECISION_MONITOR';
  if (decisionScore >= 5) return 'DECISION_OBSERVE';
  return 'UNAVAILABLE';
}

// ============================================================================
// REASONS / WARNINGS / FLAGS
// ============================================================================

/**
 * Build deterministic reasons combining all A3 layers.
 * Capped at 10.
 */
export function buildDecisionReasons(intelligence, signal, rank, decisionScore, status) {
  const reasons = [];

  // A3.1 reasons
  if (Array.isArray(intelligence?.reasons)) {
    reasons.push(...intelligence.reasons);
  }

  // A3.2 reasons
  if (Array.isArray(signal?.reasons)) {
    reasons.push(...signal.reasons);
  }

  // A3.3 reasons
  if (Array.isArray(rank?.reasons)) {
    reasons.push(...rank.reasons);
  }

  // Decision-specific
  if (decisionScore != null) {
    reasons.push(`Institutional decision score: ${decisionScore}/100`);
  }
  reasons.push(`Institutional status: ${status}`);

  const execQuality = calculateExecutionQuality(signal);
  if (execQuality != null) {
    reasons.push(`Execution quality: ${execQuality}/100`);
  }

  const ownership = intelligence?.ownershipStrength;
  if (ownership && ownership !== 'UNAVAILABLE') {
    reasons.push(`Ownership strength: ${ownership}`);
  }

  const finra = intelligence?.finraAvailable;
  if (finra === true) {
    reasons.push('FINRA ATS data available');
  } else if (intelligence?.secDataStatus === 'ok') {
    reasons.push('SEC EDGAR data only (FINRA unavailable)');
  }

  return reasons.slice(0, 10);
}

/**
 * Build decision-specific warnings combining all A3 layers.
 */
export function buildDecisionWarnings(intelligence, signal, rank, decisionScore) {
  const warnings = [];

  // A3.1 warnings
  if (Array.isArray(intelligence?.warnings)) {
    warnings.push(...intelligence.warnings);
  }

  // A3.2 warnings
  if (Array.isArray(signal?.warnings)) {
    warnings.push(...signal.warnings);
  }

  // A3.3 warnings
  if (Array.isArray(rank?.warnings)) {
    warnings.push(...rank.warnings);
  }

  // Decision-specific
  if (decisionScore == null) {
    warnings.push('INSTITUTIONAL_DECISION_NO_DATA');
  }

  if (signal?.dataStatus === 'partial') {
    warnings.push('INSTITUTIONAL_DECISION_PARTIAL_DATA');
  }

  if (decisionScore != null && decisionScore < 20) {
    warnings.push('INSTITUTIONAL_DECISION_WEAK_SIGNAL');
  }

  // Deduplicate
  return [...new Set(warnings)];
}

/**
 * Build decision-specific flags combining all A3 layers.
 */
export function buildDecisionFlags(intelligence, signal, rank, decisionScore, status) {
  const flags = [];

  // A3.1 flags
  if (Array.isArray(intelligence?.flags)) {
    flags.push(...intelligence.flags);
  }

  // A3.2 flags
  if (Array.isArray(signal?.flags)) {
    flags.push(...signal.flags);
  }

  // A3.3 flags
  if (Array.isArray(rank?.flags)) {
    flags.push(...rank.flags);
  }

  // Decision-specific
  if (decisionScore != null && decisionScore >= 80) {
    flags.push('INSTITUTIONAL_DECISION_TOP');
  }
  if (decisionScore != null && decisionScore >= 60) {
    flags.push('INSTITUTIONAL_DECISION_RECOMMENDED');
  }
  if (status === 'DECISION_TOP' || status === 'DECISION_STRONG') {
    flags.push('INSTITUTIONAL_DECISION_WATCHLIST');
  }

  return [...new Set(flags)];
}

// ============================================================================
// MAIN ENTRY: BUILD DECISION
// ============================================================================

/**
 * Build complete institutional decision by combining A3.1–A3.3.
 *
 * @param {Object|null} intelligence — output of buildInstitutionalIntelligence() (A3.1)
 * @param {Object|null} signal — output of buildInstitutionalSignal() (A3.2)
 * @param {Object|null} rank — output of rankInstitutionalSignal() (A3.3)
 * @param {string} symbol
 * @returns {Object} institutional decision object
 */
export function buildInstitutionalDecision(intelligence, signal, rank, symbol) {
  const decisionScore = calculateInstitutionalDecisionScore(intelligence, signal, rank);
  const status = classifyInstitutionalStatus(decisionScore);
  const execQuality = calculateExecutionQuality(signal);

  return {
    symbol: rank?.symbol || signal?.symbol || intelligence?.symbol || symbol || null,
    institutionalDecisionScore: decisionScore,
    institutionalStatus: status,
    institutionDecisionClass: status,

    reasons: buildDecisionReasons(intelligence, signal, rank, decisionScore, status),
    warnings: buildDecisionWarnings(intelligence, signal, rank, decisionScore),
    flags: buildDecisionFlags(intelligence, signal, rank, decisionScore, status),

    executionQuality: execQuality,

    rankScore: rank?.institutionalRankScore ?? null,
    rankClass: rank?.institutionalRankClass ?? 'UNAVAILABLE',
    signalScore: signal?.institutionalSignalScore ?? null,
    conviction: signal?.institutionalConviction ?? 'UNAVAILABLE',
    activity: signal?.institutionalActivity ?? intelligence?.institutionalActivity ?? 'UNAVAILABLE',
    risk: signal?.institutionalRisk ?? intelligence?.institutionalRisk ?? 'UNAVAILABLE',
    dataStatus: signal?.dataStatus ?? intelligence?.dataStatus ?? 'unavailable',

    activityScore: signal?.activityScore ?? intelligence?.institutionalActivityScore ?? null,
    dataQuality: signal?.dataQuality != null ? signal.dataQuality : 0,
    freshness: signal?.freshness != null ? signal.freshness : 0,
  };
}

// ============================================================================
// RANK OPPORTUNITIES WITH DECISION LAYER
// ============================================================================

/**
 * Rank institutional opportunities enriched with decision scores.
 *
 * @param {Array} opportunities — array of rank objects (from selectTopInstitutional or rankInstitutionalOpportunities)
 * @param {Object} signalMap — symbol → signal object
 * @param {Object} intelMap — symbol → intelligence object
 * @param {number} limit — max results
 * @returns {Array} enriched ranking sorted by decision score desc
 */
export function rankInstitutionalDecisions(opportunities, signalMap, intelMap, limit = 10) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return [];
  }

  const scored = opportunities.map((item) => {
    const symbol = item.symbol;
    const signal = signalMap?.[symbol] || null;
    const intel = intelMap?.[symbol] || null;

    if (!item.institutionalDecisionScore) {
      const decision = buildInstitutionalDecision(intel, signal, item, symbol);
      return { ...item, ...decision };
    }

    return item;
  });

  const sorted = scored
    .filter((x) => x.institutionalDecisionScore != null)
    .sort((a, b) => {
      const sa = a.institutionalDecisionScore ?? -1;
      const sb = b.institutionalDecisionScore ?? -1;
      if (sa !== sb) return sb - sa;
      return (a.symbol || '').localeCompare(b.symbol || '');
    });

  return limit ? sorted.slice(0, limit) : sorted;
}

// ============================================================================
// DEFAULT
// ============================================================================

export function defaultInstitutionalDecision(symbol) {
  return {
    symbol: typeof symbol === 'string' ? symbol : null,
    institutionalDecisionScore: null,
    institutionalStatus: 'UNAVAILABLE',
    institutionDecisionClass: 'UNAVAILABLE',
    reasons: [],
    warnings: ['INSTITUTIONAL_DECISION_NO_DATA'],
    flags: [],
    executionQuality: null,
    rankScore: null,
    rankClass: 'UNAVAILABLE',
    signalScore: null,
    conviction: 'UNAVAILABLE',
    activity: 'UNAVAILABLE',
    risk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
    activityScore: null,
    dataQuality: 0,
    freshness: 0,
  };
}
