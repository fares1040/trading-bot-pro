/**
 * Institutional Ranking & Conviction Engine (A3.3)
 *
 * Deterministic ranking layer built on top of A3.1 (Institutional Intelligence)
 * and A3.2 (Institutional Signal & Conviction).
 *
 * Ranks symbols by combining institutionalSignalScore, activity, conviction,
 * risk, and data quality into a single rank score (0–100).
 *
 * Rank classes:
 *   TOP         — rankScore >= 70 (strongest institutional signal)
 *   STRONG      — rankScore >= 50
 *   WATCH       — rankScore >= 30
 *   WEAK        — rankScore >= 10
 *   UNAVAILABLE — rankScore < 10 or null
 *
 * NO new providers. NO directional claims (BUY/SELL/BULLISH/BEARISH).
 * NO fabricated 13F, insider, dark-pool, whale, or real-time flow data.
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

import { buildInstitutionalSignal } from './institutional-signal.js';
import { defaultInstitutionalSignal } from './institutional-signal.js';

// ============================================================================
// COMPONENT MAPPINGS
// ============================================================================

const ACTIVITY_SCORE_MAP = {
  HIGH: 100,
  MODERATE: 70,
  LOW: 40,
  UNAVAILABLE: 0,
};

const CONVICTION_SCORE_MAP = {
  HIGH: 100,
  MEDIUM: 70,
  LOW: 40,
  UNAVAILABLE: 0,
};

const RISK_INVERSE_MAP = {
  LOW: 100,
  MODERATE: 80,
  HIGH: 50,
  EXTREME: 20,
  UNAVAILABLE: 50,
};

const DATA_QUALITY_RANK_MAP = {
  complete: 100,
  partial: 60,
  unavailable: 0,
};

// ============================================================================
// RANK SCORE
// ============================================================================

/**
 * Calculate institutional rank score (0–100) from A3.2 signal.
 *
 * Formula:
 *   signalScore (40%) × qualityMultiplier
 *
 * Where qualityMultiplier = average of:
 *   activity score (20%)
 *   conviction score (20%)
 *   risk inverse score (10%)
 *   data quality score (10%)
 *
 * This means a high signal score alone is not enough — the data must
 * also be complete, the activity must be real, and the conviction must be high.
 *
 * If signalScore is null, rankScore is null (no data).
 *
 * @param {Object|null} signal — output of buildInstitutionalSignal()
 * @returns {number|null} 0–100 or null
 */
export function calculateInstitutionalRankScore(signal) {
  if (!signal || signal.institutionalSignalScore == null || Number.isNaN(signal.institutionalSignalScore)) {
    return null;
  }

  const signalScore = signal.institutionalSignalScore;

  const activityScore = ACTIVITY_SCORE_MAP[signal.institutionalActivity] || 0;
  const convictionScore = CONVICTION_SCORE_MAP[signal.institutionalConviction] || 0;
  const riskInverse = RISK_INVERSE_MAP[signal.institutionalRisk] || 50;
  const dqScore = DATA_QUALITY_RANK_MAP[signal.dataStatus] || 0;

  // Quality multiplier: average of the four quality dimensions
  // If all dimensions are 0, multiplier is 0 (no quality)
  const qualityMultiplier = (activityScore + convictionScore + riskInverse + dqScore) / 400;

  const rankScore = signalScore * qualityMultiplier;

  return Math.round(Math.max(0, Math.min(100, rankScore)));
}

// ============================================================================
// CLASSIFICATION
// ============================================================================

/**
 * Classify institutional rank from rank score.
 *
 *   TOP         — >= 70
 *   STRONG      — >= 50
 *   WATCH       — >= 30
 *   WEAK        — >= 10
 *   UNAVAILABLE — < 10 or null
 *
 * @param {number|null} rankScore
 * @returns {string} TOP | STRONG | WATCH | WEAK | UNAVAILABLE
 */
export function classifyInstitutionalRank(rankScore) {
  if (rankScore == null) return 'UNAVAILABLE';
  if (rankScore >= 70) return 'TOP';
  if (rankScore >= 50) return 'STRONG';
  if (rankScore >= 30) return 'WATCH';
  if (rankScore >= 10) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// RANK SINGLE SIGNAL
// ============================================================================

/**
 * Rank a single institutional signal.
 * Pure function — builds on A3.2 signal output.
 *
 * @param {Object|null} signal — output of buildInstitutionalSignal()
 * @param {string} symbol — symbol override
 * @returns {Object} rank object
 */
export function rankInstitutionalSignal(signal, symbol) {
  if (!signal || signal.institutionalSignalScore == null) {
    return defaultInstitutionalRank(symbol);
  }

  const rankScore = calculateInstitutionalRankScore(signal);
  const rankClass = classifyInstitutionalRank(rankScore);

  return {
    symbol: signal.symbol || symbol || null,
    institutionalRankScore: rankScore,
    institutionalRankClass: rankClass,
    institutionalSignalScore: signal.institutionalSignalScore,
    institutionalConviction: signal.institutionalConviction,
    institutionalActivity: signal.institutionalActivity,
    institutionalRisk: signal.institutionalRisk,
    dataStatus: signal.dataStatus,
    reasons: buildRankReasons(signal, rankScore, rankClass),
    warnings: buildRankWarnings(signal, rankScore),
    flags: buildRankFlags(signal, rankScore, rankClass),
    dataStatus: signal.dataStatus,
  };
}

// ============================================================================
// REASONS / WARNINGS / FLAGS
// ============================================================================

/**
 * Build deterministic rank reasons.
 * Capped at 6.
 */
function buildRankReasons(signal, rankScore, rankClass) {
  const reasons = [];

  // Inherit signal-level reasons
  if (Array.isArray(signal?.reasons)) {
    reasons.push(...signal.reasons.slice(0, 3));
  }

  // Rank-specific
  if (rankScore != null) {
    reasons.push(`Institutional rank score: ${rankScore}/100`);
  }
  reasons.push(`Institutional rank class: ${rankClass}`);

  const activity = signal?.institutionalActivity;
  if (activity && activity !== 'UNAVAILABLE') {
    reasons.push(`Activity level: ${activity}`);
  }

  const conviction = signal?.institutionalConviction;
  if (conviction && conviction !== 'UNAVAILABLE') {
    reasons.push(`Conviction: ${conviction}`);
  }

  return reasons.slice(0, 6);
}

/**
 * Build deterministic rank warnings.
 */
function buildRankWarnings(signal, rankScore) {
  const warnings = [];

  // Inherit signal warnings
  if (Array.isArray(signal?.warnings)) {
    warnings.push(...signal.warnings);
  }

  if (rankScore == null) {
    warnings.push('INSTITUTIONAL_RANK_NO_DATA');
  }

  if (signal?.institutionalRisk === 'HIGH' || signal?.institutionalRisk === 'EXTREME') {
    warnings.push('INSTITUTIONAL_HIGH_RISK');
  }

  if (signal?.dataStatus === 'partial') {
    warnings.push('INSTITUTIONAL_RANK_PARTIAL_DATA');
  }

  return warnings;
}

/**
 * Build deterministic rank flags.
 */
function buildRankFlags(signal, rankScore, rankClass) {
  const flags = [];

  // Inherit signal flags
  if (Array.isArray(signal?.flags)) {
    flags.push(...signal.flags);
  }

  if (rankScore != null && rankScore >= 70) {
    flags.push('INSTITUTIONAL_RANK_TOP');
  }

  if (rankScore != null && rankScore >= 50) {
    flags.push('INSTITUTIONAL_RANK_SELECTED');
  }

  if (rankClass === 'TOP' || rankClass === 'STRONG') {
    flags.push('INSTITUTIONAL_RANK_WATCHLIST');
  }

  return flags;
}

// ============================================================================
// RANK MULTIPLE SYMBOLS
// ============================================================================

/**
 * Rank multiple institutional signals, returning a sorted ranking.
 *
 * @param {Array} signals — array of signal objects (from buildInstitutionalSignal)
 * @param {string} symbolKey — property name containing the symbol (default: 'symbol')
 * @returns {Array} sorted ranking (highest score first), each with rank index
 */
export function rankInstitutionalOpportunities(signals, symbolKey = 'symbol') {
  if (!Array.isArray(signals) || signals.length === 0) {
    return [];
  }

  const ranked = signals
    .map((signal) => rankInstitutionalSignal(signal, signal?.[symbolKey]))
    .sort((a, b) => {
      // Sort by rankScore descending; null scores go last
      const sa = a.institutionalRankScore ?? -1;
      const sb = b.institutionalRankScore ?? -1;
      if (sa !== sb) return sb - sa;
      // Tie-break by symbol
      const symA = a.symbol || '';
      const symB = b.symbol || '';
      return symA.localeCompare(symB);
    });

  // Assign rank index
  return ranked.map((item, index) => ({
    ...item,
    institutionalRankIndex: index,
  }));
}

// ============================================================================
// SELECT TOP + ALTERNATIVES
// ============================================================================

/**
 * Select top institutional opportunities and alternatives.
 *
 * @param {Array} signals — array of signal objects
 * @param {number} topLimit — max TOP class to return
 * @returns {{ top: Array, alternatives: Array }}
 */
export function selectTopInstitutional(signals, topLimit = 5) {
  const ranked = rankInstitutionalOpportunities(signals);

  const top = ranked
    .filter((r) => r.institutionalRankClass === 'TOP')
    .slice(0, topLimit);

  const alternatives = ranked
    .filter((r) => r.institutionalRankClass === 'STRONG' || r.institutionalRankClass === 'WATCH')
    .slice(0, topLimit);

  return { top, alternatives, fullRanking: ranked };
}

// ============================================================================
// DEFAULT
// ============================================================================

export function defaultInstitutionalRank(symbol) {
  return {
    symbol: typeof symbol === 'string' ? symbol : null,
    institutionalRankScore: null,
    institutionalRankClass: 'UNAVAILABLE',
    institutionalSignalScore: null,
    institutionalConviction: 'UNAVAILABLE',
    institutionalActivity: 'UNAVAILABLE',
    institutionalRisk: 'UNAVAILABLE',
    dataStatus: 'unavailable',
    reasons: [],
    warnings: ['INSTITUTIONAL_RANK_NO_DATA'],
    flags: [],
    institutionalRankIndex: null,
  };
}

// ============================================================================
// HELPER: Build rank from intelligence (one-step convenience)
// ============================================================================

/**
 * Convenience: build institutional signal from intelligence, then rank.
 *
 * @param {Object|null} intelligence — output of buildInstitutionalIntelligence()
 * @param {string} symbol
 * @returns {Object} rank object
 */
export function rankFromIntelligence(intelligence, symbol) {
  const signal = intelligence ? buildInstitutionalSignal(intelligence) : defaultInstitutionalSignal();
  return rankInstitutionalSignal(signal, symbol);
}
