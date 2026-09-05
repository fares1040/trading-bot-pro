/**
 * C8 Trade Plan Engine
 *
 * Deterministic decision-support layer that transforms the ranked opportunity
 * intelligence from C7 + B1-B6 into a structured, CONDITIONAL trade plan.
 *
 * This is NOT a buy/sell recommendation engine. It produces a conditional plan
 * only when sufficient evidence exists. It never fabricates price levels,
 * targets, stop-losses, risk/reward, confidence, or missing market data.
 *
 * Pure functions - no network calls, no fabrication, no look-ahead.
 * Missing data remains null. NaN/Infinity values are sanitized.
 *
 * Consumes:
 *   C7 - Opportunity Ranking (lib/opportunity-ranking.js)
 *   B1 - Penny Intelligence
 *   B2 - Options Intelligence
 *   B3 - Institutional Radar
 *   B4 - Swing Intelligence
 *   B5 - Early Explosion
 *   B6 - Catalyst Intelligence
 */

// ============================================================================
// HELPERS
// ============================================================================
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
function nowISO() {
  return new Date().toISOString();
}
function unique(arr) {
  return Array.isArray(arr) ? Array.from(new Set(arr.filter((x) => x != null))) : [];
}
function safeLower(value) {
  return value == null ? "" : String(value).trim().toLowerCase();
}
function isArabic(s, tokens) {
  const v = String(s || "").toLowerCase();
  return tokens.some((t) => v.includes(t));
}

// ============================================================================
// WEIGHTS & THRESHOLDS
// ============================================================================
const TRADE_PLAN_WEIGHTS = Object.freeze({
  setupQuality: 0.22,
  riskRewardQuality: 0.22,
  technicalReadiness: 0.13,
  opportunityScore: 0.13,
  catalystFlowSupport: 0.10,
  dataCompleteness: 0.10,
  horizonQuality: 0.10,
});
const TRADE_PLAN_QUALITY_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});
const PLAN_SIGNAL_THRESHOLDS = Object.freeze({
  STRONG_PLAN: 85,
  VALID_PLAN: 70,
  WATCH: 55,
});
const DIRECTION = Object.freeze({
  LONG: "LONG",
  SHORT: "SHORT",
  NEUTRAL: "NEUTRAL",
  UNAVAILABLE: "UNAVAILABLE",
});
const TIMEFRAME = Object.freeze({
  INTRADAY: "INTRADAY",
  SWING: "SWING",
  POSITION: "POSITION",
  UNKNOWN: "UNKNOWN",
});

// ============================================================================
// DIRECTION NORMALIZATION
// Evidence-based only. Neutral/incomplete evidence never becomes LONG/SHORT.
// ============================================================================
function normalizeDirection(bias) {
  const s = safeLower(bias);
  if (!s) return DIRECTION.UNAVAILABLE;
  // Bearish evidence tokens (English + Arabic). Only explicit evidence yields SHORT.
  if (isArabic(s, ['sell', 'bear', 'habel', 'هابط', 'هاب', 'down', 'short'])) return DIRECTION.SHORT;
  // Bullish evidence tokens (English + Arabic). Only explicit evidence yields LONG.
  if (isArabic(s, ['buy', 'bull', 'صاع', 'صاعد', 'up', 'long'])) return DIRECTION.LONG;
  // Neutral / no directional evidence stays NEUTRAL - never coerced to LONG/SHORT.
  if (isArabic(s, ['neutral', 'ml', 'sideways', 'ال المحايد'])) return DIRECTION.NEUTRAL;
  return DIRECTION.NEUTRAL;
}
function normalizeTimeframe(value) {
  if (value == null) return TIMEFRAME.UNKNOWN;
  // Explicit normalized values pass straight through.
  if (value === TIMEFRAME.INTRADAY) return TIMEFRAME.INTRADAY;
  if (value === TIMEFRAME.SWING) return TIMEFRAME.SWING;
  if (value === TIMEFRAME.POSITION) return TIMEFRAME.POSITION;
  const s = safeLower(value);
  if (!s) return TIMEFRAME.UNKNOWN;
  if (s.includes("intraday") || s.includes("day") || s.includes("scalp")) return TIMEFRAME.INTRADAY;
  if (s.includes("position")) return TIMEFRAME.POSITION;
  if (s.includes("swing")) return TIMEFRAME.SWING;
  return TIMEFRAME.UNKNOWN;
}

// ============================================================================
// UPSTREAM SCORE EXTRACTION
// Reuses C7 + B1-B6 managers. Does NOT reimplement their scoring logic.
// ============================================================================
function extractOpportunityScore(c7) {
  if (!c7 || typeof c7 !== "object") return null;
  return n(c7.opportunityScore);
}
function extractSwingScore(b4) {
  if (!b4 || typeof b4 !== "object") return null;
  return n(b4.swingScore);
}
function extractExplosionScore(b5) {
  if (!b5 || typeof b5 !== "object") return null;
  return n(b5.explosionScore);
}
function extractOptionsScore(b2) {
  if (!b2 || typeof b2 !== "object") return null;
  // B2 exposes aggregate scores on decision.decisionScore / flow.flowScore /
  // summary.bestContractRankScore / callScore / putScore.
  return n(b2.decision && b2.decision.decisionScore)
    ?? n(b2.flow && b2.flow.flowScore)
    ?? n(b2.summary && b2.summary.bestContractRankScore)
    ?? n(b2.optionsScore)
    ?? n(b2.callScore)
    ?? n(b2.putScore)
    ?? null;
}
function extractInstitutionalScore(b3) {
  if (!b3 || typeof b3 !== "object") return null;
  return n(b3.institutionalScore) ?? n(b3.rankScore) ?? n(b3.decisionScore) ?? null;
}
function extractCatalystScore(b6) {
  if (!b6 || typeof b6 !== "object") return null;
  return n(b6.catalystScore);
}
function extractPennyScore(b1) {
  if (!b1 || typeof b1 !== "object") return null;
  return n(b1.pennyScore) ?? n(b1.setupScore) ?? n(b1.hunterScore) ?? null;
}
function extractDataCompleteness(data) {
  if (!data || typeof data !== "object") return null;
  const dc = n(data.dataCompleteness);
  if (dc != null) return clamp(dc);
  if (data.dataAvailability && typeof data.dataAvailability === "object") {
    const vals = Object.values(data.dataAvailability).filter(Boolean);
    const total = Object.keys(data.dataAvailability).length;
    if (total > 0) return clamp(Math.round((vals.length / total) * 100));
  }
  return null;
}
/**
 * Whether an upstream source carries real analysis (not a default/unavailable
 * placeholder). Defaults carry null scores and zero completeness — they must
 * never contribute evidence to a trade plan.
 */
function sourceHasData(source) {
  if (!source || typeof source !== "object") return false;
  const dc = extractDataCompleteness(source);
  if (dc != null && dc > 0) return true;
  const score = n(source.swingScore) ?? n(source.explosionScore) ??
    n(source.catalystScore) ?? n(source.pennyScore) ??
    n(source.setupScore) ?? n(source.opportunityScore);
  return score != null;
}
/**
 * Detect BUY-vs-SELL conflicts directly from upstream signals, independent
 * of C7's warning list. Evidence-based only.
 */
function detectDirectSignalConflicts(sources) {
  const conflicts = [];
  const signals = [];
  for (const key of ["swingIntelligence", "earlyExplosion", "pennyIntelligence"]) {
    const data = sources[key];
    if (!sourceHasData(data) || !data || !data.signal) continue;
    const signal = String(data.signal).toUpperCase();
    if (signal.includes("BUY") || signal.includes("STRONG_BUY")) signals.push({ key, side: "BUY" });
    else if (signal.includes("SELL") || signal.includes("STRONG_SELL")) signals.push({ key, side: "SELL" });
  }
  const buys = signals.filter((s) => s.side === "BUY");
  const sells = signals.filter((s) => s.side === "SELL");
  if (buys.length > 0 && sells.length > 0) {
    conflicts.push(
      "Buy signal from " + buys.map((s) => s.key).join(", ") +
      " vs Sell signal from " + sells.map((s) => s.key).join(", ")
    );
  }
  return conflicts;
}

// ============================================================================
// ZONE / LEVEL EXTRACTION (prefer existing B4/B5 zones, never fabricated)
// ============================================================================
function firstZone(b4, b5) {
  // Prefer swing (B4) zones, fall back to early explosion (B5) zones.
  const src = b4 || b5;
  if (!src || typeof src !== "object") return null;
  return {
    entryZone: src.entryZone != null ? src.entryZone : null,
    entryPrice: src.entryPrice != null ? n(src.entryPrice) : null,
    target1: src.target1 != null ? n(src.target1) : null,
    target2: src.target2 != null ? n(src.target2) : null,
    invalidation: src.invalidation != null ? n(src.invalidation) : null,
    stopLoss: src.stopLoss != null ? n(src.stopLoss) : null,
    riskPercent: src.riskPercent != null ? n(src.riskPercent) : null,
    rewardPercent: src.rewardPercent != null ? n(src.rewardPercent) : null,
    riskReward: src.riskReward != null ? n(src.riskReward) : null,
  };
}
function extractPrice(c7, b4, b5, b1) {
  // Underlying price from upstream intelligence, never fabricated.
  for (const src of [b4, b5, b1, c7]) {
    if (src && typeof src === "object") {
      const p = n(src.price) || n(src.underlyingPrice) || n(src.underlying);
      if (p != null) return p;
    }
  }
  return null;
}

// ============================================================================
// DIRECTION / TIMEFRAME INTEGRATION
// Evidence-based. Neutral/incomplete evidence never becomes LONG/SHORT.
// ============================================================================
function resolveDirection(sources) {
  // Direction must be inherited from upstream evidence. Prefer swing (B4),
  // then early explosion (B5), then penny (B1). Never coerce neutral to directional.
  const candidates = [sources.swingIntelligence, sources.earlyExplosion, sources.pennyIntelligence];
  for (const c of candidates) {
    if (c && typeof c === "object" && c.directionBias != null) {
      return normalizeDirection(c.directionBias);
    }
  }
  return DIRECTION.UNAVAILABLE;
}
function resolveTimeframe(sources) {
  // B4 is the Swing Intelligence Manager => SWING by construction.
  if (sources.swingIntelligence && typeof sources.swingIntelligence === "object") {
    const v = sources.swingIntelligence.timeframe || sources.swingIntelligence.holdingPeriod;
    return normalizeTimeframe(v) !== TIMEFRAME.UNKNOWN ? normalizeTimeframe(v) : TIMEFRAME.SWING;
  }
  // B5 is the Early Explosion Manager => INTRADAY by construction.
  if (sources.earlyExplosion && typeof sources.earlyExplosion === "object") {
    const v = sources.earlyExplosion.timeframe || sources.earlyExplosion.holdingPeriod;
    return normalizeTimeframe(v) !== TIMEFRAME.UNKNOWN ? normalizeTimeframe(v) : TIMEFRAME.INTRADAY;
  }
  // B1 penny may carry an explicit timeframe.
  if (sources.pennyIntelligence && typeof sources.pennyIntelligence === "object") {
    const v = sources.pennyIntelligence.timeframe || sources.pennyIntelligence.holdingPeriod;
    if (v != null) return normalizeTimeframe(v);
  }
  return TIMEFRAME.UNKNOWN;
}

// ============================================================================
// SETUP QUALITY (component 1)
// Aggregated from B4 setup classification strength + B1 setup score.
// ============================================================================
function setupStrengthScore(b1, b4, b5) {
  const scores = [];
  // Only sources carrying real analysis contribute. Defaults (null scores,
  // zero completeness) must not manufacture setup evidence.
  if (sourceHasData(b1) && b1 && typeof b1 === "object") {
    const s = n(b1.setupScore) ?? n(b1.setup && b1.setup.setupScore);
    if (s != null) scores.push(clamp(s));
  }
  if (sourceHasData(b4) && b4 && typeof b4 === "object") {
    const setups = Array.isArray(b4.setupClassification) ? b4.setupClassification : [];
    const strong = setups.filter((s) => s && (s.type === "BREAKOUT" || s.type === "PULLBACK" || s.type === "REVERSAL"));
    if (setups.length > 0) {
      const ratio = strong.length / setups.length;
      scores.push(clamp(ratio * 70 + setups.length * 6));
    }
  }
  if (sourceHasData(b5) && b5 && typeof b5 === "object") {
    const setups = Array.isArray(b5.setupClassification) ? b5.setupClassification : [];
    const strong = setups.filter((s) => s && (s.type === "BREAKOUT" || s.type === "PULLBACK"));
    if (setups.length > 0) {
      const ratio = strong.length / setups.length;
      scores.push(clamp(ratio * 70 + setups.length * 6));
    }
  }
  if (scores.length === 0) return null;
  return clamp(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ============================================================================
// RISK / REWARD (component 2) - mathematically derived only.
// Never return negative or fabricated R/R as valid.
// ============================================================================
function calculateRR(entry, stop, target, direction) {
  // Long:  reward = target - entry, risk = entry - stop
  // Short: reward = entry - target, risk = stop - entry
  const e = n(entry);
  const s = n(stop);
  const t = n(target);
  if (e == null || s == null || t == null) return null;
  let risk, reward;
  if (direction === DIRECTION.SHORT) {
    risk = s - e;
    reward = e - t;
  } else {
    risk = e - s;
    reward = t - e;
  }
  // Risk must be strictly positive for a valid plan.
  if (risk == null || !Number.isFinite(risk) || risk <= 0) return null;
  if (reward == null || !Number.isFinite(reward)) return null;
  // Negative reward (target on wrong side) => invalid R/R.
  if (reward <= 0) return null;
  return round(reward / risk, 2);
}
function riskRewardQualityScore(rr) {
  if (rr == null) return null;
  if (!Number.isFinite(rr)) return null;
  // >= 3 excellent, >= 2 good, >= 1 acceptable, < 1 invalid
  if (rr >= 3) return 100;
  if (rr >= 2) return 80;
  if (rr >= 1.5) return 65;
  if (rr >= 1) return 50;
  return 20;
}
function derivePlanLevels(zones, price, direction) {
  // Prefer B4/B5 zones. Fall back to price-relative derivation ONLY when
  // the upstream zone is a valid number. Never fabricate levels.
  const result = {
    entryZone: null,
    entryPrice: null,
    stopLoss: null,
    target1: null,
    target2: null,
    target3: null,
    invalidation: null,
    riskAmount: null,
    rewardAmount: null,
    riskReward: null,
    riskPercent: null,
    rewardPercent: null,
  };
  if (!zones) return result;
  result.entryZone = zones.entryZone != null ? zones.entryZone : null;
  result.entryPrice = zones.entryPrice != null ? zones.entryPrice : null;
  result.stopLoss = zones.stopLoss != null ? zones.stopLoss : (zones.invalidation != null ? zones.invalidation : null);
  result.target1 = zones.target1 != null ? zones.target1 : null;
  result.target2 = zones.target2 != null ? zones.target2 : null;
  result.invalidation = zones.invalidation != null ? zones.invalidation : null;
  result.riskPercent = zones.riskPercent;
  result.rewardPercent = zones.rewardPercent;
  // When the upstream zone is a range string (no explicit entry price),
  // fall back to the underlying price as the reference entry for R/R math.
  // The raw entryZone string is preserved for display.
  const entry = result.entryPrice != null ? result.entryPrice : price;
  const stop = result.stopLoss;
  const target = result.target1;

  // Prefer the upstream riskReward (B4/B5 already derived it). Only derive
  // from levels when upstream did not provide one.
  if (zones.riskReward != null) {
    result.riskReward = zones.riskReward;
  } else if (entry != null && stop != null && target != null) {
    const rr = calculateRR(entry, stop, target, direction);
    if (rr != null) {
      result.riskReward = rr;
      result.entryPrice = entry;
      if (direction === DIRECTION.SHORT) {
        result.riskAmount = round(stop - entry, 2);
        result.rewardAmount = round(entry - target, 2);
      } else {
        result.riskAmount = round(entry - stop, 2);
        result.rewardAmount = round(target - entry, 2);
      }
    }
  }
  return result;
}

// ============================================================================
// TECHNICAL READINESS (component 3)
// ============================================================================
function technicalReadinessScore(b1, b4, b5) {
  const checks = [];
  // Only sources with real analysis contribute. Defaults carry populated
  // dataAvailability masks but zero completeness — they must not manufacture
  // readiness evidence.
  if (sourceHasData(b1) && b1 && typeof b1 === "object" && b1.dataAvailability) {
    const vals = Object.values(b1.dataAvailability).filter(Boolean).length;
    const total = Object.keys(b1.dataAvailability).length;
    checks.push(total > 0 ? (vals / total) * 100 : 0);
  }
  if (sourceHasData(b4) && b4 && typeof b4 === "object" && b4.dataAvailability) {
    const vals = Object.values(b4.dataAvailability).filter(Boolean).length;
    const total = Object.keys(b4.dataAvailability).length;
    checks.push(total > 0 ? (vals / total) * 100 : 0);
  }
  if (sourceHasData(b5) && b5 && typeof b5 === "object" && b5.dataAvailability) {
    const vals = Object.values(b5.dataAvailability).filter(Boolean).length;
    const total = Object.keys(b5.dataAvailability).length;
    checks.push(total > 0 ? (vals / total) * 100 : 0);
  }
  if (checks.length === 0) return null;
  return clamp(checks.reduce((a, b) => a + b, 0) / checks.length);
}

// ============================================================================
// CATALYST / FLOW SUPPORT (component 5)
// ============================================================================
function catalystFlowSupportScore(b6, b2, b3) {
  const scores = [];
  // Catalyst strength: higher catalystScore => more support.
  if (b6 && typeof b6 === "object") {
    const cs = n(b6.catalystScore);
    if (cs != null) scores.push(clamp(cs));
  }
  // Options flow conviction: call/put pressure supports direction.
  if (b2 && typeof b2 === "object") {
    const fs = n(b2.decision && b2.decision.decisionScore) ?? n(b2.flow && b2.flow.flowScore);
    if (fs != null) scores.push(clamp(fs));
  }
  // Institutional activity supports conviction.
  if (b3 && typeof b3 === "object") {
    const is = n(b3.institutionalScore) ?? n(b3.accumulationScore);
    if (is != null) scores.push(clamp(is));
  }
  if (scores.length === 0) return null;
  return clamp(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ============================================================================
// DATA COMPLETENESS (component 6)
// ============================================================================
function aggregateDataCompleteness(sources) {
  const vals = [];
  for (const key of Object.keys(sources)) {
    // Only real analysis contributes. Defaults carry completeness 0 — they
    // must not drag the aggregate down to a fabricated 0 that then renormalizes
    // into a score. Missing data stays null.
    if (!sourceHasData(sources[key])) continue;
    const dc = extractDataCompleteness(sources[key]);
    if (dc != null) vals.push(dc);
  }
  if (vals.length === 0) return null;
  return clamp(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
}

// ============================================================================
// SCORE AGGREGATION
// Renormalizes when components are missing. Missing never becomes zero.
// ============================================================================
function calculateTradePlanScore(components) {
  const available = [];
  for (const [key, value] of Object.entries(components)) {
    if (value == null) continue;
    const weight = TRADE_PLAN_WEIGHTS[key];
    if (weight != null && Number.isFinite(value)) {
      available.push({ score: clamp(value), weight, key });
    }
  }
  if (available.length === 0) {
    return { planScore: null, componentScores: {}, usedWeights: {}, totalWeightUsed: 0, availableComponents: [] };
  }
  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  const weightedSum = available.reduce((s, c) => s + c.score * c.weight, 0);
  const planScore = Math.round(clamp(weightedSum / totalWeight));
  const componentScores = {};
  const usedWeights = {};
  const rawWeights = {};
  for (const c of available) {
    componentScores[c.key] = c.score;
    usedWeights[c.key] = totalWeight > 0 ? round(c.weight / totalWeight, 4) : 0;
    rawWeights[c.key] = c.weight;
  }
  return {
    planScore,
    componentScores,
    usedWeights,
    rawWeights,
    totalWeightUsed: round(totalWeight, 4),
    availableComponents: available.map((c) => c.key),
  };
}

// ============================================================================
// QUALITY & PLAN SIGNAL
// ============================================================================
function classifyPlanQuality(score) {
  if (score == null || !Number.isFinite(score)) return "UNAVAILABLE";
  if (score >= TRADE_PLAN_QUALITY_THRESHOLDS.TOP) return "TOP";
  if (score >= TRADE_PLAN_QUALITY_THRESHOLDS.STRONG) return "STRONG";
  if (score >= TRADE_PLAN_QUALITY_THRESHOLDS.WATCH) return "WATCH";
  if (score >= TRADE_PLAN_QUALITY_THRESHOLDS.WEAK) return "WEAK";
  return "UNAVAILABLE";
}
function classifyPlanSignal(score) {
  if (score == null || !Number.isFinite(score)) return "UNAVAILABLE";
  if (score >= PLAN_SIGNAL_THRESHOLDS.STRONG_PLAN) return "STRONG_PLAN";
  if (score >= PLAN_SIGNAL_THRESHOLDS.VALID_PLAN) return "VALID_PLAN";
  if (score >= PLAN_SIGNAL_THRESHOLDS.WATCH) return "WATCH";
  return "AVOID";
}

// ============================================================================
// RISK AGGREGATION
// Aggregate evidence-based risks from C7 + B1-B6.
// ============================================================================
function aggregateRisks(sources, c7, levels, direction) {
  const risks = [];
  const add = (label, severity, description) => {
    risks.push({ label, severity, description });
  };
  const b4 = sources.swingIntelligence;
  const b5 = sources.earlyExplosion;
  const b2 = sources.optionsIntelligence;
  const b3 = sources.institutionalRadar;
  const b6 = sources.catalystIntelligence;
  const b1 = sources.pennyIntelligence;

  // C7 conflicts
  if (c7 && Array.isArray(c7.warnings) && c7.warnings.some((w) => w.indexOf("CONFLICTING_SIGNALS_DETECTED") === 0)) {
    add("SIGNAL_CONFLICT", "HIGH", "Conflicting signals detected across intelligence sources");
  }
  // Direct upstream signal conflicts (B4/B5/B1) — independent of C7's warning list.
  const directConflicts = detectDirectSignalConflicts(sources);
  if (directConflicts.length > 0) {
    add("SIGNAL_CONFLICT", "HIGH", directConflicts.join("; "));
  }
  // B4 swing risks
  if (b4 && Array.isArray(b4.risks)) {
    for (const r of b4.risks) {
      if (r && r.label === "NEGATIVE_RR" && r.severity === "HIGH") add("NEGATIVE_RR", "HIGH", "Swing risk/reward below 1.0");
      if (r && r.label === "LOW_DATA" && r.severity === "MEDIUM") add("LOW_DATA", "MEDIUM", "Swing data completeness below 50%");
    }
  }
  // B5 explosion / liquidity risks
  if (b5 && b5.explosionRisk === "HIGH") {
    add("EXPLOSION_VOLATILITY_RISK", "HIGH", "Early Explosion intelligence flagged high volatility risk");
  }
  if (b5 && b5.liquidityRisk === "HIGH") {
    add("LIQUIDITY_RISK", "HIGH", "Early Explosion intelligence flagged liquidity risk");
  }
  // B2 options risks
  if (b2 && b2.flow && b2.flow.flowRiskLevel === "HIGH") {
    add("OPTIONS_RISK", "MEDIUM", "Options flow risk level elevated");
  }
  // B3 institutional distribution / financing risks
  if (b3 && b3.institutionalRisk && b3.institutionalRisk !== "UNAVAILABLE" && b3.institutionalRisk !== "low") {
    add("DILUTION_RISK", b3.institutionalRisk === "high" ? "HIGH" : "MEDIUM", "Institutional risk: " + b3.institutionalRisk);
  }
  // B6 catalyst risks
  if (b6 && b6.catalystRisk === "HIGH") {
    add("CATALYST_RISK", "HIGH", "Catalyst intelligence flagged high catalyst risk");
  }
  // Plan-level structural risks
  if (levels.stopLoss == null) {
    add("MISSING_STOP", "HIGH", "No valid stop-loss level available from upstream zones");
  }
  if (levels.target1 == null) {
    add("MISSING_TARGET", "MEDIUM", "No valid target level available from upstream zones");
  }
  const hasEntry = levels.entryZone != null || levels.entryPrice != null;
  if (!hasEntry) {
    add("MISSING_ENTRY", "MEDIUM", "No valid entry zone available from upstream zones");
  }
  if (levels.riskReward != null && levels.riskReward < 1.0) {
    add("LOW_RR", "HIGH", "Risk/reward " + levels.riskReward + " below 1.0");
  }
  if (levels.invalidation == null) {
    add("MISSING_INVALIDATION", "MEDIUM", "No invalidation level available");
  }
  // Insufficient data — count only sources carrying real analysis.
  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  if (availableCount === 0) {
    add("NO_INTELLIGENCE_AVAILABLE", "HIGH", "No intelligence sources available for trade plan");
  } else if (availableCount < 3) {
    add("LOW_DATA", "MEDIUM", "Only " + availableCount + " of 6 intelligence sources available");
  }
  if (risks.length === 0) {
    add("NO_MAJOR_RISKS_IDENTIFIED", "LOW", "No significant risk factors detected");
  }
  return risks;
}

// ============================================================================
// FLAGS
// ============================================================================
function buildTradePlanFlags(sources, direction, levels, score, quality, signal) {
  const flags = [];
  const availableCount = Object.values(sources).filter((v) => v != null).length;
  if (availableCount >= 6) flags.push("FULL_INTELLIGENCE_COVERAGE");
  if (availableCount >= 4) flags.push("MULTI_SOURCE_CONFIRMED");
  if (direction === DIRECTION.LONG) flags.push("LONG-setup");
  if (direction === DIRECTION.SHORT) flags.push("SHORT-setup");
  if (levels.riskReward != null && levels.riskReward >= 2) flags.push("FAVORABLE_RR");
  if (levels.riskReward != null && levels.riskReward < 1) flags.push("UNFAVORABLE_RR");
  if (levels.stopLoss != null) flags.push("STOP_DEFINED");
  if (levels.target1 != null) flags.push("TARGET_DEFINED");
  if (score != null && score >= 85) flags.push("HIGH_PLAN_SCORE");
  if (quality === "TOP" || quality === "STRONG") flags.push("QUALITY_CONFIRMED");
  if (signal === "STRONG_PLAN") flags.push("STRONG_PLAN");
  return flags;
}

// ============================================================================
// POSITION SIZING
// If account capital is NOT provided: do NOT fabricate account size.
// If explicitly received: deterministic size using the available stop distance.
// Never expose a position size when stop-loss is unavailable.
// ============================================================================
function calculatePositionSizing(levels, capital, maxRiskPercent) {
  const result = {
    accountCapital: null,
    maxRiskPercent: null,
    riskAmount: null,
    positionSize: null,
    positionValue: null,
    shares: null,
    available: false,
  };
  const cap = n(capital);
  const riskPct = n(maxRiskPercent);
  if (cap == null || riskPct == null) return result;
  result.accountCapital = round(cap, 2);
  result.maxRiskPercent = round(clamp(riskPct, 0, 100), 2);
  // Risk amount based on account capital and risk percent.
  result.riskAmount = round((cap * riskPct) / 100, 2);
  // Stop distance required for position sizing.
  const entry = levels.entryPrice;
  const stop = levels.stopLoss;
  if (entry == null || stop == null) {
    result.available = false;
    return result;
  }
  const stopDistance = Math.abs(entry - stop);
  if (stopDistance <= 0 || !Number.isFinite(stopDistance)) {
    result.available = false;
    return result;
  }
  const size = result.riskAmount / stopDistance;
  if (!Number.isFinite(size) || size <= 0) {
    result.available = false;
    return result;
  }
  result.positionSize = round(size, 4);
  result.positionValue = round(size * entry, 2);
  result.shares = round(size, 4);
  result.available = true;
  return result;
}

// ============================================================================
// WARNINGS
// ============================================================================
function buildPlanWarnings(sources, levels, score, direction, dataCompleteness) {
  const warnings = [];
  // Availability counts only sources carrying real analysis. Default
  // placeholders are non-null objects but carry no evidence — they must not
  // be reported as "available" intelligence.
  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  const totalCount = Object.keys(sources).length;
  if (availableCount === 0) {
    warnings.push("NO_INTELLIGENCE_AVAILABLE");
  }
  if (availableCount < 6) {
    warnings.push("PARTIAL_INTELLIGENCE: " + availableCount + " of 6 sources available");
  }
  if (score == null) {
    warnings.push("NO_PLAN_SCORE");
  }
  if (direction === DIRECTION.UNAVAILABLE) {
    warnings.push("DIRECTION_UNAVAILABLE");
  }
  if (direction === DIRECTION.NEUTRAL) {
    warnings.push("NEUTRAL_DIRECTION");
  }
  if (levels.stopLoss == null) {
    warnings.push("MISSING_STOP");
  }
  if (levels.target1 == null) {
    warnings.push("MISSING_TARGET");
  }
  const hasEntryWarn = levels.entryZone != null || levels.entryPrice != null;
  if (!hasEntryWarn) {
    warnings.push("MISSING_ENTRY");
  }
  if (levels.riskReward != null && levels.riskReward < 1) {
    warnings.push("LOW_RISK_REWARD");
  }
  if (dataCompleteness != null && dataCompleteness < 50) {
    warnings.push("LOW_DATA_COMPLETENESS");
  }
  if (levels.riskReward == null) {
    warnings.push("RISK_REWARD_UNAVAILABLE");
  }
  // Direct upstream conflicts (B4/B5/B1) independent of C7's warning list.
  const directConflicts = detectDirectSignalConflicts(sources);
  if (directConflicts.length > 0) {
    warnings.push("CONFLICTING_SIGNALS_DETECTED");
    for (const c of directConflicts.slice(0, 3)) {
      warnings.push("CONFLICT: " + c);
    }
  }
  return warnings;
}

// ============================================================================
// PROVENANCE
// Every inherited component retains provenance. Never claim REAL data when
// upstream data is inferred/proxy.
// ============================================================================
function buildProvenance(sources, c7) {
  const p = {
    intelligence: "C8",
    engine: "C8 Trade Plan Engine",
    opportunityRanking: "C7",
  };
  if (c7 && typeof c7 === "object") {
    p.opportunityRanking = c7.provenance && c7.provenance.engine ? c7.provenance.engine : "C7";
  }
  const known = {
    opportunityRanking: "C7",
    swingIntelligence: "B4",
    earlyExplosion: "B5",
    optionsIntelligence: "B2",
    institutionalRadar: "B3",
    catalystIntelligence: "B6",
    pennyIntelligence: "B1",
  };
  for (const [key, src] of Object.entries(sources)) {
    if (src && typeof src === "object" && src.provenance) {
      p[key] = src.provenance.manager || src.provenance.intelligence || known[key] || key;
    } else if (src != null) {
      p[key] = known[key] || key;
    } else {
      p[key] = null;
    }
  }
  return p;
}

// ============================================================================
// DEFAULT RESULT
// ============================================================================
function defaultTradePlan(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    available: false,
    planQuality: "UNAVAILABLE",
    planScore: null,
    planSignal: "UNAVAILABLE",

    expectedTimeframe: 'UNKNOWN',

    setup: null,
    directionBias: "UNAVAILABLE",
    direction: DIRECTION.UNAVAILABLE,
    timeframe: TIMEFRAME.UNKNOWN,

    entryZone: null,
    entryPrice: null,
    stopLoss: null,
    target1: null,
    target2: null,
    target3: null,
    invalidation: null,
    riskReward: null,
    riskAmount: null,
    rewardAmount: null,
    riskPercent: null,
    rewardPercent: null,

    positionSizing: { accountCapital: null, maxRiskPercent: null, riskAmount: null, positionSize: null, positionValue: null, shares: null, available: false },
    maxRiskPercent: null,

    confidence: 0,
    confidenceLevel: "UNKNOWN",
    supportingEvidence: [],
    risks: [{ label: "NO_INTELLIGENCE_AVAILABLE", severity: "HIGH", description: "No intelligence sources available for trade plan" }],
    warnings: ["NO_INTELLIGENCE_AVAILABLE", "NO_PLAN_SCORE", "MISSING_STOP", "MISSING_TARGET", "MISSING_ENTRY", "DIRECTION_UNAVAILABLE", "RISK_REWARD_UNAVAILABLE"],
    flags: [],
    componentScores: {},
    componentWeights: {},
    dataAvailability: { opportunityRanking: false, swingIntelligence: false, earlyExplosion: false, optionsIntelligence: false, institutionalRadar: false, catalystIntelligence: false, pennyIntelligence: false },

    horizonEvidence: null,
    confirmation: [],
    invalidation: [],
    watchItems: [],

    provenance: { intelligence: "C8", engine: "C8 Trade Plan Engine" },
    limitations: "C8 composes C7 + B1-B6. Levels come only from upstream zone engines (B4/B5) - never fabricated.",
    disclaimer: "Trade Plan (C8) is conditional only - not a buy/sell recommendation. Levels without trustworthy data remain unavailable. Missing levels remain null - never fabricated.",
  };
}

// ============================================================================
// CONFIDENCE
// ============================================================================
function calculatePlanConfidence(componentScores, dataCompleteness) {
  if (!componentScores || typeof componentScores !== "object") return 0;
  const available = Object.entries(componentScores).filter(([, v]) => v != null && typeof v === "number" && Number.isFinite(v));
  const count = available.length;
  if (count === 0) return 0;
  const sourceConf = clamp((count / 6) * 100);
  if (dataCompleteness != null) {
    return clamp(sourceConf * 0.6 + dataCompleteness * 0.4);
  }
  return sourceConf;
}
function classifyPlanConfidence(conf) {
  if (conf == null) return "UNKNOWN";
  if (conf >= 80) return "HIGH";
  if (conf >= 60) return "MODERATE";
  if (conf >= 40) return "LOW";
  return "VERY_LOW";
}

// ============================================================================
// SUPPORTING EVIDENCE
// ============================================================================
function buildSupportingEvidence(sources, components) {
  const evidence = [];
  const labels = {
    setupQuality: "Setup quality",
    riskRewardQuality: "Risk/reward quality",
    technicalReadiness: "Technical readiness",
    opportunityScore: "Opportunity score (C7)",
    catalystFlowSupport: "Catalyst/flow support",
    dataCompleteness: "Data completeness",
  };
  for (const [key, value] of Object.entries(components.componentScores || {})) {
    if (value == null) continue;
    const weight = components.usedWeights ? components.usedWeights[key] : null;
    evidence.push({
      source: key,
      label: labels[key] || key,
      score: value,
      weight: weight != null ? weight : null,
    });
  }
  return evidence;
}

// ============================================================================
// MAIN ENTRY
// ============================================================================
function buildTradePlan(symbol, sources, opts = {}) {
  const defaultResult = defaultTradePlan(symbol || null);
  if (!symbol) {
    return defaultResult;
  }
  if (!sources || typeof sources !== "object") {
    return { ...defaultResult, symbol };
  }

  const c7 = sources.opportunityRanking || null;
  const horizonEvidence = c7 && c7.horizonEvidence ? c7.horizonEvidence : null;
  const b4 = sources.swingIntelligence || null;
  const b5 = sources.earlyExplosion || null;
  const b2 = sources.optionsIntelligence || null;
  const b3 = sources.institutionalRadar || null;
  const b6 = sources.catalystIntelligence || null;
  const b1 = sources.pennyIntelligence || null;

  const availableCount = Object.values(sources).filter((v) => v != null).length;
  if (availableCount === 0) {
    return {
      ...defaultResult,
      symbol,
      reasons: ["No intelligence sources provided for trade plan"],
    };
  }

  // Direction (evidence-based, never coerced)
  const direction = resolveDirection(sources);
  const timeframe = resolveTimeframe(sources);

  // Setup
  const setupScore = setupStrengthScore(b1, b4, b5);
  const setupType = (b4 && b4.setupClassification && b4.setupClassification[0] && b4.setupClassification[0].type) || (b5 && b5.setupClassification && b5.setupClassification[0] && b5.setupClassification[0].type) || (b1 && b1.setup && b1.setup.setupType) || null;

  // Zones / levels (prefer B4/B5, never fabricated)
  const zones = firstZone(b4, b5);
  const price = extractPrice(c7, b4, b5, b1);
  const levels = derivePlanLevels(zones, price, direction);

  // Risk/reward
  const rr = levels.riskReward;
  const rrScore = riskRewardQualityScore(rr);

  // Technical readiness
  const techScore = technicalReadinessScore(b1, b4, b5);

  // Opportunity score (C7)
  const oppScore = extractOpportunityScore(c7);

  // Horizon quality (from C7 horizonEvidence)
  const horizonScore = horizonEvidence ? n(horizonEvidence.horizonScore) : null;
  const horizonQualityScore = horizonScore != null ? clamp(horizonScore) : null;

  // Catalyst / flow support
  const catalystScore = catalystFlowSupportScore(b6, b2, b3);

  // Data completeness
  const dataCompleteness = aggregateDataCompleteness(sources);

  // Component map for scoring (missing excluded, renormalized)
  const components = {
    setupQuality: setupScore,
    riskRewardQuality: rrScore,
    technicalReadiness: techScore,
    opportunityScore: oppScore,
    catalystFlowSupport: catalystScore,
    dataCompleteness: dataCompleteness,
    horizonQuality: horizonQualityScore,
  };
  const scoreResult = calculateTradePlanScore(components);
  const planScore = scoreResult.planScore;
  const quality = classifyPlanQuality(planScore);
  const signal = classifyPlanSignal(planScore);

  // Confidence
  const confidence = calculatePlanConfidence(scoreResult.componentScores, dataCompleteness);
  const confidenceLevel = classifyPlanConfidence(confidence);

  // Risks
  const risks = aggregateRisks(sources, c7, levels, direction);

  // Warnings
  const warnings = buildPlanWarnings(sources, levels, planScore, direction, dataCompleteness);

  // Flags
  const flags = buildTradePlanFlags(sources, direction, levels, planScore, quality, signal);

  // Position sizing (only if capital explicitly provided)
  const positionSizing = calculatePositionSizing(levels, opts.capital, opts.maxRiskPercent);

  // Provenance
  const provenance = buildProvenance(sources, c7);

  // Data availability
  const dataAvailability = {
    opportunityRanking: c7 != null,
    swingIntelligence: b4 != null,
    earlyExplosion: b5 != null,
    optionsIntelligence: b2 != null,
    institutionalRadar: b3 != null,
    catalystIntelligence: b6 != null,
    pennyIntelligence: b1 != null,
    horizonEvidence: horizonEvidence != null,
  };

  // Supporting evidence
  const supportingEvidence = buildSupportingEvidence(sources, scoreResult);

  // Reasons
  const reasons = [];
  if (planScore != null) {
    reasons.push("Trade Plan Score: " + planScore + "/100");
  } else {
    reasons.push("Insufficient evidence for a trade plan score");
  }
  reasons.push("Quality: " + quality);
  reasons.push("Signal: " + signal);
  reasons.push("Direction: " + direction);
  if (setupType) reasons.push("Setup: " + setupType);
  if (levels.riskReward != null) reasons.push("Risk/Reward: " + levels.riskReward);
  if (levels.stopLoss != null) reasons.push("Stop: " + levels.stopLoss);
  if (levels.target1 != null) reasons.push("Target 1: " + levels.target1);
  reasons.push("Confidence: " + confidenceLevel + " (" + Math.round(confidence) + "%)");
  if (dataCompleteness != null) reasons.push("Data completeness: " + dataCompleteness + "%");
  if (horizonEvidence && horizonEvidence.horizon) {
    reasons.push("Horizon: " + horizonEvidence.horizon + " (" + (horizonEvidence.horizonScore != null ? horizonEvidence.horizonScore + "/100" : "no score") + ")");
  }

  // Confirmation / invalidation / watch from horizon
  const confirmation = horizonEvidence && Array.isArray(horizonEvidence.confirmation) ? horizonEvidence.confirmation.slice(0, 4) : [];
  const invalidation = horizonEvidence && Array.isArray(horizonEvidence.invalidation) ? horizonEvidence.invalidation.slice(0, 4) : [];
  const watchItems = horizonEvidence && Array.isArray(horizonEvidence.watchItems) ? horizonEvidence.watchItems.slice(0, 4) : [];

  return {
    symbol,
    timestamp: nowISO(),
    available: planScore != null,
    planQuality: quality,
    planScore,
    planSignal: signal,

    setup: setupType,
    directionBias: direction,
    direction,
    timeframe,
    expectedTimeframe: c7 && c7.expectedTimeframe ? c7.expectedTimeframe : 'UNKNOWN',

    entryZone: levels.entryZone,
    entryPrice: levels.entryPrice,
    stopLoss: levels.stopLoss,
    target1: levels.target1,
    target2: levels.target2,
    target3: levels.target3,
    invalidation: levels.invalidation,
    riskReward: levels.riskReward,
    riskAmount: levels.riskAmount,
    rewardAmount: levels.rewardAmount,
    riskPercent: levels.riskPercent,
    rewardPercent: levels.rewardPercent,

    positionSizing,
    maxRiskPercent: positionSizing.maxRiskPercent,

    confidence: round(confidence, 1),
    confidenceLevel,
    supportingEvidence,
    risks,
    warnings,
    flags,
    componentScores: scoreResult.componentScores,
    componentWeights: scoreResult.usedWeights,
    dataAvailability,
    dataCompleteness: dataCompleteness != null ? dataCompleteness : 0,

    horizonEvidence,
    confirmation,
    invalidation,
    watchItems,

    provenance,
    limitations: "C8 composes C7 + B1-B6. Levels come only from upstream zone engines (B4/B5) - never fabricated. Missing components are excluded and weights renormalized.",
    disclaimer: "Trade Plan (C8) is conditional only - not a buy/sell recommendation. Levels without trustworthy data remain unavailable. Missing levels remain null - never fabricated.",
    reasons,
  };
}

// ============================================================================
// RANKING
// Deterministic: score DESC -> dataCompleteness DESC -> riskReward DESC
// -> confidence DESC -> symbol ASC. No unstable sorting.
// ============================================================================
function rankTradePlans(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [], ranking: { method: "trade_plan_score", total: 0 } };
  }
  const sorted = [...results].sort((a, b) => {
    const sa = a.planScore ?? -1;
    const sb = b.planScore ?? -1;
    if (sa === -1 && sb !== -1) return 1;
    if (sb === -1 && sa !== -1) return -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    const ra = a.riskReward ?? -1;
    const rb = b.riskReward ?? -1;
    if (rb !== ra) return rb - ra;
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (cb !== ca) return cb - ca;
    const symA = (a.symbol || "").toString();
    const symB = (b.symbol || "").toString();
    return symA < symB ? -1 : symA > symB ? 1 : 0;
  });
  const ranked = sorted.map((item, index) => ({ ...item, rank: index + 1 }));
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  const ranking = {
    method: "plan_score_desc_then_dataCompleteness_riskReward_confidence_alpha",
    total: ranked.length,
    topCount: top.length,
    alternativesCount: alternatives.length,
  };
  return { ranked, top, alternatives, ranking };
}
function buildTradePlanQualityBreakdown(results) {
  const breakdown = { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 };
  if (!Array.isArray(results)) return breakdown;
  for (const r of results) {
    const q = r && (r.planQuality || "UNAVAILABLE");
    if (breakdown[q] != null) breakdown[q]++;
    else breakdown.UNAVAILABLE++;
  }
  return breakdown;
}
function buildTradePlanDataAvailability(results) {
  const availability = {
    opportunityRanking: false,
    swingIntelligence: false,
    earlyExplosion: false,
    optionsIntelligence: false,
    institutionalRadar: false,
    catalystIntelligence: false,
    pennyIntelligence: false,
  };
  if (!Array.isArray(results)) return availability;
  for (const r of results) {
    if (r && r.dataAvailability) {
      for (const [key, val] of Object.entries(r.dataAvailability)) {
        if (val && availability.hasOwnProperty(key)) availability[key] = true;
      }
    }
  }
  return availability;
}

// ============================================================================
// EXPORTS
// ============================================================================
export {
  n,
  clamp,
  round,
  nowISO,
  TRADE_PLAN_WEIGHTS,
  TRADE_PLAN_QUALITY_THRESHOLDS,
  PLAN_SIGNAL_THRESHOLDS,
  DIRECTION,
  TIMEFRAME,
  normalizeDirection,
  normalizeTimeframe,
  extractOpportunityScore,
  extractSwingScore,
  extractExplosionScore,
  extractOptionsScore,
  extractInstitutionalScore,
  extractCatalystScore,
  extractPennyScore,
  extractDataCompleteness,
  setupStrengthScore,
  calculateRR,
  riskRewardQualityScore,
  derivePlanLevels,
  technicalReadinessScore,
  catalystFlowSupportScore,
  aggregateDataCompleteness,
  calculateTradePlanScore,
  classifyPlanQuality,
  classifyPlanSignal,
  aggregateRisks,
  buildTradePlanFlags,
  calculatePositionSizing,
  buildPlanWarnings,
  buildProvenance,
  defaultTradePlan,
  calculatePlanConfidence,
  classifyPlanConfidence,
  buildSupportingEvidence,
  buildTradePlan,
  rankTradePlans,
  buildTradePlanQualityBreakdown,
  buildTradePlanDataAvailability,
};

export default buildTradePlan;
