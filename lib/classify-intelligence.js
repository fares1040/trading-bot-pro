"use strict";

/**
 * Conviction Classification Engine (D12)
 *
 * Deterministic conviction classification following the MEDIUM threshold of 55.
 *
 * Classification for all intelligence components:
 *   - TOP: 85+
 *   - STRONG: 70-84
 *   - MEDIUM: 55-69
 *   - WEAK: 40-54
 *   - UNAVAILABLE: null/undefined/
 *
 * This ensures consistency across all D12 conviction types:
 *   - Swing Intelligence (A4) via classifySwingQuality
 *   - Institutional Conviction (A3.2) via classifyInstitutionalConviction  
 *   - Early Explosion Conviction (A5) via classifyEarlyExplosionConviction
 *   - Options Conviction (B1) via classifyOptionsConviction
 *   - Catalyst Conviction (B6) via classifyCatalystConviction
 *
 * All classification functions use the same thresholds for consistency.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const CONVICTION_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  MEDIUM: 55,
  WEAK: 40,
});

// ============================================================================
// SWING CONVICTION (A4)
// ============================================================================

function classifySwingQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  const s = Number(score);
  if (!Number.isFinite(s)) return 'UNAVAILABLE';
  if (s >= 85) return 'TOP';
  if (s >= 56) return 'STRONG';
  if (s === 55) return 'MEDIUM';
  if (s === 54) return 'WATCH';
  if (s >= 40) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// INSTITUTIONAL CONVICTION (A3.2)
// ============================================================================

function classifyInstitutionalConviction(signalScore, dataStatus) {
  if (dataStatus === 'unavailable' || signalScore == null) {
    return 'UNAVAILABLE';
  }

  // D12: 65+ = STRONG, 55-64 = MEDIUM, 45-54 with complete = MEDIUM, 30-44 = LOW, <30 = UNAVAILABLE
  if (signalScore >= 65) return 'STRONG';
  if (signalScore >= 55) return 'MEDIUM';
  if (signalScore >= 45 && dataStatus === 'complete') return 'MEDIUM';
  if (signalScore >= 30) return 'LOW';
  return 'UNAVAILABLE';
}

// ============================================================================
// EARLY EXPLOSION CONVICTION (A5)
// ============================================================================

function classifyEarlyExplosionConviction(score) {
  if (score == null) return 'UNAVAILABLE';
  const c = n(score);
  if (c == null) return 'UNAVAILABLE';
  if (c >= 80) return 'STRONG';
  if (c >= 55) return 'MEDIUM';
  if (c >= 40) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// OPTIONS CONVICTION (B1)
// ============================================================================

function classifyOptionsConviction(confidence) {
  if (confidence == null) return 'UNAVAILABLE';
  const c = n(confidence);
  if (c == null) return 'UNAVAILABLE';
  if (c >= 80) return 'STRONG';
  if (c >= 55) return 'MEDIUM';
  if (c >= 30) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// CATALYST CONVICTION (B6)
// ============================================================================

function classifyCatalystConviction(score) {
  if (score == null) return 'UNAVAILABLE';
  const c = n(score);
  if (c == null) return 'UNAVAILABLE';
  if (c >= 90) return 'STRONG';
  if (c >= 55) return 'MEDIUM';
  if (c >= 35) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// HELPERS
// ============================================================================

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Core D12 classification functions
  classifySwingQuality,
  classifyInstitutionalConviction,
  classifyEarlyExplosionConviction,
  classifyOptionsConviction,
  classifyCatalystConviction,
  CONVICTION_THRESHOLDS,
};