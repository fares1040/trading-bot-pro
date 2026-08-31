/**
 * C10 MARKET REGIME ENGINE
 *
 * Deterministic market-environment classification layer.
 * C10 answers: "What kind of market environment are we currently operating in?"
 *
 * Classifications: BULLISH | NEUTRAL | RISK_OFF | BEARISH | UNAVAILABLE
 *
 * Pure functions - no network calls, no fabrication, no look-ahead,
 * no input mutation. Missing evidence stays null - never zero, never fabricated.
 */

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (v === Infinity) return max;
  if (v === -Infinity) return min;
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function nowISO() { return new Date().toISOString(); }

export const REGIME_WEIGHTS = Object.freeze({
  trend: 0.30,
  momentum: 0.18,
  breadth: 0.16,
  volume: 0.12,
  volatility: 0.14,
  data: 0.10,
});

export const REGIME_THRESHOLDS = Object.freeze({
  BULLISH_MIN: 68,
  RISK_OFF_MAX: 42,
  VIX_LOW: 16,
  VIX_MODERATE: 22,
  VIX_ELEVATED: 30,
  VIX_RISE_WARN: 8,
  BREADTH_POSITIVE: 55,
  REL_VOL_FLOOR: 1.0,
});

export const REGIME_LABELS = Object.freeze({
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  RISK_OFF: 'RISK_OFF',
  BEARISH: 'BEARISH',
  UNAVAILABLE: 'UNAVAILABLE',
});
// ============================================================================
// VOLATILITY / RISK-OFF SCORING
// VIX level + VIX rate-of-change. VIX rise is a risk-off trigger.
// ============================================================================

export function scoreVolatility(vix, vixChange) {
  const reasons = [];
  const flags = [];

  if (vix == null) {
    return { score: null, vix: null, vixChange: null, flags, reasons };
  }

  let score = 50;

  if (vix < REGIME_THRESHOLDS.VIX_LOW) {
    score = 82;
    reasons.push('VIX ' + vix.toFixed(2) + ' - low volatility');
  } else if (vix < REGIME_THRESHOLDS.VIX_MODERATE) {
    score = 62;
    reasons.push('VIX ' + vix.toFixed(2) + ' - moderate volatility');
  } else if (vix < REGIME_THRESHOLDS.VIX_ELEVATED) {
    score = 35;
    reasons.push('VIX ' + vix.toFixed(2) + ' - elevated volatility');
    flags.push('ELEVATED_VOLATILITY');
  } else {
    score = 12;
    reasons.push('VIX ' + vix.toFixed(2) + ' - high volatility');
    flags.push('HIGH_VOLATILITY');
  }

  // Rapid VIX rise is a risk-off signal even when the level is not extreme.
  if (vixChange != null && vixChange > REGIME_THRESHOLDS.VIX_RISE_WARN) {
    score = Math.min(score, 30);
    flags.push('VIX_RAPID_RISE');
    reasons.push('VIX rising fast (' + vixChange.toFixed(2) + ') - volatility expanding');
  }

  return { score: clamp(score), vix: round(vix, 2), vixChange: vixChange != null ? round(vixChange, 2) : null, flags, reasons };
}

// ============================================================================
// TREND / MARKET DIRECTION SCORING
// Uses broad-market index price change (S&P 500 + Nasdaq).
// S&P 500 is the primary broad-market gauge.
// ============================================================================

export function scoreTrend(spxChange, qqqChange) {
  const reasons = [];
  const flags = [];
  const factors = [];

  if (spxChange != null) {
    factors.push({ name: 'S&P 500', change: spxChange });
    reasons.push('S&P 500 ' + (spxChange >= 0 ? '+' : '') + spxChange.toFixed(2) + '%');
  }
  if (qqqChange != null) {
    factors.push({ name: 'Nasdaq', change: qqqChange });
    reasons.push('Nasdaq ' + (qqqChange >= 0 ? '+' : '') + qqqChange.toFixed(2) + '%');
  }

  if (factors.length === 0) return { score: null, factors, flags, reasons };

  let raw = 50;
  if (spxChange != null) raw += clamp(spxChange * 8, -40, 40);
  if (qqqChange != null) raw += clamp(qqqChange * 6, -30, 30);

  const score = clamp(raw);

  // Divergence between S&P and Nasdaq is a warning, not fabrication.
  if (spxChange != null && qqqChange != null) {
    const spread = Math.abs(spxChange - qqqChange);
    if (spread > 4) {
      flags.push('INDEX_DIVERGENCE');
      reasons.push('S&P/Nasdaq divergence ' + spread.toFixed(2) + 'pts - mixed leadership');
    }
  }

  return { score, factors, flags, reasons };
}

// ============================================================================
// MOMENTUM SCORING
// Short-term index momentum derived from 5-day index change.
// Uses the same inputs as trend but weights the rate of change separately.
// ============================================================================

export function scoreMomentum(spxChange, qqqChange) {
  const reasons = [];
  const flags = [];

  if (spxChange == null && qqqChange == null) {
    return { score: null, flags, reasons };
  }

  // Average short-term momentum across available indices.
  let sum = 0;
  let count = 0;
  if (spxChange != null) { sum += spxChange; count++; }
  if (qqqChange != null) { sum += qqqChange; count++; }
  const avg = sum / count;

  // Momentum mapping: 0% => 50; each percent maps to +/- 6, capped.
  const score = clamp(50 + avg * 6, 0, 100);

  if (avg > 0) reasons.push('Index momentum positive (' + avg.toFixed(2) + '% avg)');
  else if (avg < 0) reasons.push('Index momentum negative (' + avg.toFixed(2) + '% avg)');

  if (avg <= -3) flags.push('NEGATIVE_MOMENTUM');
  else if (avg >= 3) flags.push('POSITIVE_MOMENTUM');

  return { score, flags, reasons };
}

// ============================================================================
// BREADTH / PARTICIPATION SCORING
// Proxy derived from the scanned universe: % of symbols with positive
// setupScore and the average setupScore across the scanned universe.
// This is a real breadth proxy computed from available project data.
// ============================================================================

export function scoreBreadth(universe) {
  const reasons = [];
  const flags = [];

  if (!Array.isArray(universe) || universe.length === 0) {
    return { score: null, flags, reasons, sampleSize: 0 };
  }

  const scores = [];
  let positive = 0;
  for (const item of universe) {
    const s = n(item?.setupScore);
    if (s != null) {
      scores.push(s);
      if (s > 50) positive++;
    }
  }

  if (scores.length === 0) return { score: null, flags, reasons, sampleSize: universe.length };

  const positivePct = (positive / scores.length) * 100;
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Breadth score combines participation rate and average strength.
  const score = clamp(positivePct * 0.5 + clamp(avgScore, 0, 100) * 0.5);

  reasons.push('Breadth: ' + positive.toFixed(0) + '/' + scores.length + ' symbols above midpoint (' + positivePct.toFixed(0) + '%)');
  reasons.push('Avg setupScore ' + avgScore.toFixed(1) + ' across ' + scores.length + ' symbols');

  if (positivePct >= REGIME_THRESHOLDS.BREADTH_POSITIVE) flags.push('BROAD_PARTICIPATION');
  else flags.push('NARROW_PARTICIPATION');

  return { score, flags, reasons, sampleSize: scores.length, positivePct: round(positivePct, 1), avgSetupScore: round(avgScore, 1) };
}

// ============================================================================
// VOLUME / CONFIRMATION SCORING
// Average relative volume across the scanned universe. High relative
// volume confirms trend; low relative volume warns of weak conviction.
// ============================================================================

export function scoreVolume(universe) {
  const reasons = [];
  const flags = [];

  if (!Array.isArray(universe) || universe.length === 0) {
    return { score: null, flags, reasons, sampleSize: 0 };
  }

  const rvols = [];
  for (const item of universe) {
    const r = n(item?.relativeVolume);
    if (r != null) rvols.push(r);
  }

  if (rvols.length === 0) return { score: null, flags, reasons, sampleSize: universe.length };

  const avgRvol = rvols.reduce((a, b) => a + b, 0) / rvols.length;

  // Mapping: avg RVOL 1.0 => 50. Each 0.5x above maps to +15, capped.
  const score = clamp(50 + (avgRvol - 1) * 30, 0, 100);

  reasons.push('Avg relative volume ' + avgRvol.toFixed(2) + 'x across ' + rvols.length + ' symbols');

  if (avgRvol >= 1.3) flags.push('VOLUME_CONFIRMATION');
  else if (avgRvol < 0.8) flags.push('LOW_CONFIRMATION');

  return { score, flags, reasons, sampleSize: rvols.length, avgRelativeVolume: round(avgRvol, 2) };
}

// ============================================================================
// DATA COMPLETENESS
// Fraction of requested components that actually returned evidence.
// This is a confidence contribution, NOT a regime signal.
// ============================================================================

export function scoreDataCompleteness(availableCount, totalCount) {
  if (totalCount <= 0) return 0;
  return clamp(Math.round((availableCount / totalCount) * 100));
}

// ============================================================================
// WEIGHT RENORMALIZATION
// Missing components are EXCLUDED, never zeroed.
// Effective weights sum to 1.0 across available components.
// rawWeights preserves the original documented weights for audit.
// totalWeightUsed is the sum of raw weights that contributed.
// Returns null only when NO component is available.
// ============================================================================

export function renormalizeWeights(componentScores) {
  const available = [];
  for (const [key, value] of Object.entries(componentScores || {})) {
    if (value == null) continue;
    if (!Number.isFinite(value)) continue;
    const weight = REGIME_WEIGHTS[key];
    if (weight == null) continue;
    available.push({ key, score: clamp(value), weight });
  }

  if (available.length === 0) {
    return {
      componentScores: {},
      componentWeights: {},
      rawWeights: {},
      totalWeightUsed: 0,
      availableComponents: [],
    };
  }

  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  const outScores = {};
  const componentWeights = {};
  const rawWeights = {};

  for (const c of available) {
    outScores[c.key] = c.score;
    rawWeights[c.key] = c.weight;
    componentWeights[c.key] = totalWeight > 0 ? round(c.weight / totalWeight, 4) : 0;
  }

  return {
    componentScores: outScores,
    componentWeights,
    rawWeights,
    totalWeightUsed: round(totalWeight, 4),
    availableComponents: available.map((c) => c.key),
  };
}

// ============================================================================
// REGIME SCORE AGGREGATION
// Weighted sum over available components, renormalized.
// Returns null when there is insufficient evidence.
// ============================================================================

export function calculateRegimeScore(componentScores) {
  const norm = renormalizeWeights(componentScores);
  if (norm.availableComponents.length === 0) return null;

  const weightedSum = norm.availableComponents.reduce(
    (sum, key) => sum + norm.componentScores[key] * norm.componentWeights[key],
    0
  );

  return Math.round(clamp(weightedSum));
}

// ============================================================================
// REGIME CLASSIFICATION
// Deterministic thresholds. RISK_OFF is distinct from BEARISH:
//   - BEARISH  = strong negative directional evidence
//   - RISK_OFF = deteriorating / risk-sensitive conditions (volatility
//                escalation, rapid VIX rise, weak breadth) even when the
//                directional score is not yet deep BEARISH
// UNAVAILABLE is returned when there is insufficient evidence to make a
// defensible classification.
// ============================================================================

export function classifyRegime(regimeScore, riskFlags) {
  if (regimeScore == null || !Number.isFinite(regimeScore)) {
    return REGIME_LABELS.UNAVAILABLE;
  }

  const flags = Array.isArray(riskFlags) ? riskFlags : [];

  // RISK_OFF triggers: volatility escalation or rapid VIX rise.
  // These override a neutral/weak score into risk-off awareness.
  const riskOffTriggered =
    flags.includes('HIGH_VOLATILITY') ||
    flags.includes('ELEVATED_VOLATILITY') ||
    flags.includes('VIX_RAPID_RISE');

  if (regimeScore >= REGIME_THRESHOLDS.BULLISH_MIN) {
    return riskOffTriggered ? REGIME_LABELS.RISK_OFF : REGIME_LABELS.BULLISH;
  }

  if (regimeScore <= REGIME_THRESHOLDS.RISK_OFF_MAX) {
    return REGIME_LABELS.BEARISH;
  }

  // Middle band: 43-67
  if (riskOffTriggered) return REGIME_LABELS.RISK_OFF;

  return REGIME_LABELS.NEUTRAL;
}

// ============================================================================
// CONFIDENCE
// Based on number of contributing components and data completeness.
// ============================================================================

export function calculateRegimeConfidence(componentScores, dataCompleteness) {
  const norm = renormalizeWeights(componentScores);
  const count = norm.availableComponents.length;
  if (count === 0) return 0;

  const totalPossible = Object.keys(REGIME_WEIGHTS).length;
  const sourceConfidence = clamp((count / totalPossible) * 100);

  if (dataCompleteness != null) {
    return clamp(sourceConfidence * 0.6 + dataCompleteness * 0.4);
  }
  return sourceConfidence;
}

export function classifyRegimeConfidence(confidence) {
  if (confidence == null) return 'UNKNOWN';
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 60) return 'MODERATE';
  if (confidence >= 40) return 'LOW';
  return 'VERY_LOW';
}

// ============================================================================
// REASONS / WARNINGS / RISKS / FLAGS
// Every reason is traceable to actual input data. No generic filler.
// ============================================================================

export function buildRegimeReasons(components, regimeScore, label) {
  const reasons = [];

  if (label === REGIME_LABELS.UNAVAILABLE) {
    reasons.push('Insufficient evidence to classify market regime');
    return reasons;
  }

  if (components.trend?.reasons) reasons.push(...components.trend.reasons);
  if (components.momentum?.reasons) reasons.push(...components.momentum.reasons);
  if (components.breadth?.reasons) reasons.push(...components.breadth.reasons);
  if (components.volume?.reasons) reasons.push(...components.volume.reasons);
  if (components.volatility?.reasons) reasons.push(...components.volatility.reasons);

  if (regimeScore != null) {
    reasons.push('Regime score ' + regimeScore + '/100');
  }

  return reasons.slice(0, 12);
}

export function buildRegimeWarnings(components, label) {
  const warnings = [];
  const flags = collectFlags(components);

  if (label === REGIME_LABELS.UNAVAILABLE) {
    warnings.push('REGIME_UNAVAILABLE');
    return warnings;
  }

  if (flags.includes('VIX_RAPID_RISE')) warnings.push('VIX_RISING_FAST');
  if (flags.includes('HIGH_VOLATILITY')) warnings.push('HIGH_VOLATILITY');
  if (flags.includes('ELEVATED_VOLATILITY')) warnings.push('ELEVATED_VOLATILITY');
  if (flags.includes('INDEX_DIVERGENCE')) warnings.push('INDEX_DIVERGENCE');
  if (flags.includes('NARROW_PARTICIPATION')) warnings.push('NARROW_PARTICIPATION');
  if (flags.includes('LOW_CONFIRMATION')) warnings.push('LOW_VOLUME_CONFIRMATION');
  if (flags.includes('NEGATIVE_MOMENTUM')) warnings.push('NEGATIVE_MOMENTUM');

  if (label === REGIME_LABELS.RISK_OFF) warnings.push('RISK_OFF_ENVIRONMENT');
  if (label === REGIME_LABELS.BEARISH) warnings.push('BEARISH_ENVIRONMENT');

  return warnings;
}

export function buildRegimeRisks(components, label) {
  const risks = [];
  const flags = collectFlags(components);

  if (label === REGIME_LABELS.UNAVAILABLE) {
    risks.push({ label: 'INSUFFICIENT_EVIDENCE', severity: 'HIGH', description: 'Not enough market data to classify the current regime' });
    return risks;
  }

  if (flags.includes('HIGH_VOLATILITY') || flags.includes('VIX_RAPID_RISE')) {
    risks.push({ label: 'VOLATILITY_RISK', severity: 'HIGH', description: 'Elevated or rapidly rising VIX increases drawdown risk' });
  }
  if (flags.includes('INDEX_DIVERGENCE')) {
    risks.push({ label: 'INDEX_DIVERGENCE', severity: 'MEDIUM', description: 'S&P and Nasdaq are diverging - mixed market leadership' });
  }
  if (flags.includes('NARROW_PARTICIPATION')) {
    risks.push({ label: 'NARROW_BREADTH', severity: 'MEDIUM', description: 'Fewer symbols are participating in the move' });
  }
  if (flags.includes('LOW_CONFIRMATION')) {
    risks.push({ label: 'LOW_VOLUME_CONFIRMATION', severity: 'MEDIUM', description: 'Relative volume is below average - weak conviction' });
  }
  if (flags.includes('NEGATIVE_MOMENTUM')) {
    risks.push({ label: 'NEGATIVE_MOMENTUM', severity: 'MEDIUM', description: 'Broad index momentum is negative' });
  }

  if (risks.length === 0) {
    risks.push({ label: 'NO_MAJOR_RISKS_IDENTIFIED', severity: 'LOW', description: 'No significant risk factors detected' });
  }

  return risks;
}

export function buildRegimeFlags(components, label) {
  const flags = collectFlags(components);

  if (label === REGIME_LABELS.BULLISH) flags.push('BULLISH_REGIME');
  if (label === REGIME_LABELS.BEARISH) flags.push('BEARISH_REGIME');
  if (label === REGIME_LABELS.RISK_OFF) flags.push('RISK_OFF_REGIME');
  if (label === REGIME_LABELS.NEUTRAL) flags.push('NEUTRAL_REGIME');

  return flags;
}

function collectFlags(components) {
  const flags = [];
  for (const key of ['trend', 'momentum', 'breadth', 'volume', 'volatility']) {
    const c = components[key];
    if (c && Array.isArray(c.flags)) {
      for (const f of c.flags) if (f && !flags.includes(f)) flags.push(f);
    }
  }
  return flags;
}

// ============================================================================
// SUPPORTING EVIDENCE
// One entry per contributing component, traceable to raw inputs.
// ============================================================================

export function buildSupportingEvidence(components, componentWeights) {
  const evidence = [];
  const labels = {
    trend: 'Market trend (S&P 500 + Nasdaq)',
    momentum: 'Index momentum',
    breadth: 'Market breadth',
    volume: 'Volume confirmation',
    volatility: 'Volatility / risk',
  };

  for (const [key, comp] of Object.entries(components)) {
    if (!comp || comp.score == null) continue;
    evidence.push({
      component: key,
      label: labels[key] || key,
      score: comp.score,
      weight: componentWeights ? componentWeights[key] ?? null : null,
      factors: comp.factors || null,
    });
  }

  return evidence;
}

// ============================================================================
// PROVENANCE
// Tracks the source of every contributing component. Missing provenance
// stays null - never fabricated.
// ============================================================================

export function buildProvenance(components) {
  const provenance = {
    intelligence: 'C10',
    engine: 'C10 Market Regime Engine',
    regime: 'C10',
  };

  const known = {
    trend: 'app/api/indices (Yahoo Finance Chart)',
    momentum: 'app/api/indices (Yahoo Finance Chart)',
    breadth: 'app/api/stocks (universe setupScore)',
    volume: 'app/api/stocks (universe relativeVolume)',
    volatility: 'app/api/indices (^VIX)',
    data: 'C10 computed',
  };

  for (const key of Object.keys(REGIME_WEIGHTS)) {
    const comp = components[key];
    if (comp && comp.score != null) {
      provenance[key] = known[key] || key;
    } else {
      provenance[key] = null;
    }
  }

  return provenance;
}

// ============================================================================
// DATA AVAILABILITY MASK
// ============================================================================

export function buildRegimeDataAvailability(components) {
  const mask = {};
  for (const key of Object.keys(REGIME_WEIGHTS)) {
    const comp = components[key];
    mask[key] = !!(comp && comp.score != null);
  }
  return mask;
}

// ============================================================================
// DEFAULT RESULT
// Used when no evidence is available at all.
// ============================================================================

export function defaultMarketRegime(symbol = null) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),

    regime: REGIME_LABELS.UNAVAILABLE,
    regimeScore: null,
    confidence: 0,
    confidenceLevel: 'UNKNOWN',

    components: {},
    componentScores: {},
    rawWeights: {},
    componentWeights: {},
    totalWeightUsed: 0,

    reasons: ['Insufficient evidence to classify market regime'],
    warnings: ['REGIME_UNAVAILABLE'],
    risks: [{ label: 'INSUFFICIENT_EVIDENCE', severity: 'HIGH', description: 'Not enough market data to classify the current regime' }],
    flags: [],

    supportingEvidence: [],

    dataAvailability: {
      trend: false,
      momentum: false,
      breadth: false,
      volume: false,
      volatility: false,
      data: false,
    },
    dataCompleteness: 0,

    provenance: {
      intelligence: 'C10',
      engine: 'C10 Market Regime Engine',
      trend: null,
      momentum: null,
      breadth: null,
      volume: null,
      volatility: null,
      data: null,
    },

    freshness: null,
    limitations: 'No market evidence provided. Regime is UNAVAILABLE.',
    disclaimer: 'Market Regime (C10) is context only - not a buy/sell signal. Missing evidence stays null - never fabricated. No look-ahead.',
  };
}

// ============================================================================
// MAIN ENTRY
// buildMarketRegime(indices, universe)
//
// indices:  array of { symbol, name, value, change, isUp } from /api/indices
//            expected keys: ^GSPC, ^IXIC, QQQ, ^VIX
// universe: array of per-symbol objects from /api/stocks
//            expected keys: setupScore, relativeVolume
//
// No look-ahead. No fabrication. No input mutation.
// Missing evidence stays null.
// ============================================================================

export function buildMarketRegime(indices, universe) {
  const defaultResult = defaultMarketRegime(null);

  // ---- Normalize inputs safely ----
  const idxArr = Array.isArray(indices) ? indices : [];
  const uniArr = Array.isArray(universe) ? universe : [];

  const bySymbol = {};
  for (const item of idxArr) {
    if (item && typeof item === 'object' && item.symbol) {
      bySymbol[item.symbol] = item;
    }
  }

  const spxItem = bySymbol['^GSPC'] || null;
  const qqqItem = bySymbol['QQQ'] || null;
  const vixItem = bySymbol['^VIX'] || null;

  const spxChange = n(spxItem?.change);
  const qqqChange = n(qqqItem?.change);
  const vix = n(vixItem?.value);
  const vixChange = n(vixItem?.change);

  // ---- Compute each component independently ----
  const volatility = scoreVolatility(vix, vixChange);
  const trend = scoreTrend(spxChange, qqqChange);
  const momentum = scoreMomentum(spxChange, qqqChange);
  const breadth = scoreBreadth(uniArr);
  const volume = scoreVolume(uniArr);

  const componentMap = {
    trend,
    momentum,
    breadth,
    volume,
    volatility,
    data: { score: null, flags: [], reasons: [] },
  };

  // ---- Component scores object (null where unavailable) ----
  const componentScores = {};
  for (const key of Object.keys(REGIME_WEIGHTS)) {
    const comp = componentMap[key];
    componentScores[key] = comp && comp.score != null ? comp.score : null;
  }

  // ---- Aggregate (renormalized over available components) ----
  const regimeScore = calculateRegimeScore(componentScores);

  // ---- Data completeness (fraction of requested components with evidence) ----
  const availableCount = Object.values(componentScores).filter((v) => v != null).length;
  const totalCount = Object.keys(REGIME_WEIGHTS).length;
  const dataCompleteness = scoreDataCompleteness(availableCount, totalCount);

  // ---- Confidence ----
  const confidence = calculateRegimeConfidence(componentScores, dataCompleteness);
  const confidenceLevel = classifyRegimeConfidence(confidence);

  // ---- Classification ----
  const allFlags = collectFlags(componentMap);
  const label = classifyRegime(regimeScore, allFlags);

  // ---- Reasons / warnings / risks / flags ----
  const reasons = buildRegimeReasons(componentMap, regimeScore, label);
  const warnings = buildRegimeWarnings(componentMap, label);
  const risks = buildRegimeRisks(componentMap, label);
  const flags = buildRegimeFlags(componentMap, label);

  // ---- Renormalized weights (for audit) ----
  const norm = renormalizeWeights(componentScores);

  // ---- Supporting evidence ----
  const supportingEvidence = buildSupportingEvidence(componentMap, norm.componentWeights);

  // ---- Provenance ----
  const provenance = buildProvenance(componentMap);

  // ---- Data availability mask ----
  const dataAvailability = buildRegimeDataAvailability(componentMap);

  // ---- Freshness ----
  const freshness = {
    evaluatedAt: nowISO(),
    indexTimestamp: vixItem?.timestamp || spxItem?.timestamp || qqqItem?.timestamp || null,
    universeSize: uniArr.length,
    indexCount: idxArr.length,
  };

  // ---- Limitations ----
  const limitations = [];
  if (vix == null) limitations.push('VIX unavailable - volatility component excluded');
  if (spxChange == null && qqqChange == null) limitations.push('Index changes unavailable - trend and momentum excluded');
  if (uniArr.length === 0) limitations.push('Universe unavailable - breadth and volume excluded');
  if (limitations.length === 0) limitations.push('All requested components had available evidence');

  return {
    symbol: null,
    timestamp: nowISO(),

    regime: label,
    regimeScore,
    confidence: round(confidence, 1),
    confidenceLevel,

    components: componentMap,
    componentScores,
    rawWeights: norm.rawWeights,
    componentWeights: norm.componentWeights,
    totalWeightUsed: norm.totalWeightUsed,

    reasons,
    warnings,
    risks,
    flags,

    supportingEvidence,

    dataAvailability,
    dataCompleteness,

    provenance,

    freshness,

    limitations,
    disclaimer: 'Market Regime (C10) is context only - not a buy/sell signal. ' +
      'Missing evidence stays null - never fabricated. No look-ahead. ' +
      'RISK_OFF is a risk-sensitive environment, NOT the same as BEARISH.',
  };
}

// ============================================================================
// RANKING (for multi-symbol radar display)
// Deterministic: regimeScore DESC -> dataCompleteness DESC -> confidence DESC
// -> symbol ASC. Null scores sort last.
// ============================================================================

export function rankMarketRegimes(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [], ranking: { method: 'regime_score', total: 0 } };
  }

  const sorted = [...results].sort((a, b) => {
    const sa = a.regimeScore ?? -1;
    const sb = b.regimeScore ?? -1;
    if (sa === -1 && sb !== -1) return 1;
    if (sb === -1 && sa !== -1) return -1;
    if (sb !== sa) return sb - sa;

    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;

    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (cb !== ca) return cb - ca;

    const symA = (a.symbol || '').toString();
    const symB = (b.symbol || '').toString();
    return symA < symB ? -1 : symA > symB ? 1 : 0;
  });

  const ranked = sorted.map((item, index) => ({ ...item, rank: index + 1 }));
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);

  return {
    ranked,
    top,
    alternatives,
    ranking: {
      method: 'regime_score_desc_then_dataCompleteness_confidence_alpha',
      total: ranked.length,
      topCount: top.length,
      alternativesCount: alternatives.length,
    },
  };
}

export function buildRegimeQualityBreakdown(results) {
  const breakdown = {};
  for (const label of Object.values(REGIME_LABELS)) {
    breakdown[label] = 0;
  }
  if (!Array.isArray(results)) return breakdown;
  for (const r of results) {
    const q = r && r.regime ? r.regime : REGIME_LABELS.UNAVAILABLE;
    if (breakdown[q] != null) breakdown[q]++;
    else breakdown[REGIME_LABELS.UNAVAILABLE]++;
  }
  return breakdown;
}

// ============================================================================
// EXPORTS
// All public functions are exported inline via `export function`.
// The default export is buildMarketRegime.
// ============================================================================

export default buildMarketRegime;
