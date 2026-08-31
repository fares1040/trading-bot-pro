/**
 * C9 AI Explanation Engine
 *
 * Deterministic EXPLANATION layer — NOT a scoring engine.
 *
 * C9 consumes the normalized outputs of B1-B6, C7, and C8 and produces a
 * human-readable, evidence-traceable explanation of WHY a symbol is notable
 * right now. It never re-derives, replaces, or re-weights any upstream score.
 *
 * Every meaningful explanation string is traceable to an existing source
 * field. Missing evidence stays null / [] / UNAVAILABLE. No price levels,
 * targets, stops, confidence, dates, news, or catalysts are fabricated.
 *
 * Pure functions — no network calls, no look-ahead, no input mutation.
 *
 * Consumes:
 *   B1 Penny Intelligence        (lib/penny-intelligence-manager.js)
 *   B2 Options Intelligence       (lib/options-intelligence-manager.js)
 *   B3 Institutional Radar       (lib/institutional-radar-manager.js)
 *   B4 Swing Intelligence        (lib/swing-intelligence.js)
 *   B5 Early Explosion            (lib/early-explosion-intelligence.js)
 *   B6 Catalyst Intelligence     (lib/catalyst-intelligence.js)
 *   C7 Opportunity Ranking       (lib/opportunity-ranking.js)
 *   C8 Trade Plan Engine         (lib/trade-plan-engine.js)
 *   Horizon Evidence             (lib/opportunity-horizon.js)
 *   Classical Technical Evidence (lib/classical-technical-evidence.js)
 *   Candlestick Patterns         (lib/candlestick-patterns.js)
 *   Gamma Context                (lib/gamma-context.js)
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
function safeLower(value) {
  return value == null ? "" : String(value).trim().toLowerCase();
}
function isArabic(s, tokens) {
  const v = String(s || "").toLowerCase();
  return tokens.some((t) => v.includes(t));
}
function unique(arr) {
  return Array.isArray(arr) ? Array.from(new Set(arr.filter((x) => x != null))) : [];
}

// Neutral directional wording. Weak/neutral evidence never becomes BUY/SELL.
const BULLISH = "bullish evidence";
const BEARISH = "bearish evidence";
const MIXED = "mixed evidence";
const WATCH = "watch";
const RISK_LABEL_NO_INTEL = "NO_INTELLIGENCE_AVAILABLE";
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
// EVIDENCE BLOCK BUILDER
// Every explanation block answers: WHAT? WHY? EVIDENCE? RISK?
// ============================================================================
function block(factor, signal, explanation, evidence, risk) {
  return {
    factor: factor || null,
    signal: signal || null,
    strength: null,
    explanation: explanation || null,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
    risk: risk || null,
  };
}

function withStrength(b, strength) {
  return { ...b, strength: strength == null ? null : clamp(strength) };
}

// ============================================================================
// DIRECTIONAL WORDING HELPERS
// Never fabricate a direction. Only expose what upstream actually reported.
// ============================================================================
function directionWord(direction) {
  switch (direction) {
    case "LONG": return "upside setup";
    case "SHORT": return "downside setup";
    case "NEUTRAL": return "neutral setup";
    case "UNAVAILABLE": return "no directional evidence";
    default: return null;
  }
}

function directionalSignal(value) {
  // Only explicit directional evidence yields bullish/bearish wording.
  const s = safeLower(value);
  if (!s) return null;
  if (isArabic(s, ["sell", "bear", "habel", "هابط", "هاب", "down", "short"])) return BEARISH;
  if (isArabic(s, ["buy", "bull", "صاع", "صاعد", "صاعد", "up", "long"])) return BULLISH;
  if (isArabic(s, ["neutral", "ml", "sideways", "ال المحايد"])) return MIXED;
  return MIXED;
}
/**
 * Normalize an upstream direction bias into one of the canonical C9 values.
 * Weak/neutral evidence stays NEUTRAL — never coerced to LONG/SHORT.
 */
function normalizeDirection(value) {
  const s = safeLower(value);
  if (!s) return DIRECTION.UNAVAILABLE;
  if (isArabic(s, ["sell", "bear", "habel", "هابط", "هاب", "down", "short"])) return DIRECTION.SHORT;
  if (isArabic(s, ["buy", "bull", "صاع", "صاعد", "صاعد", "up", "long"])) return DIRECTION.LONG;
  if (isArabic(s, ["neutral", "ml", "sideways", "ال المحايد"])) return DIRECTION.NEUTRAL;
  // "up" / "down" tokens without directional commitment stay neutral.
  return DIRECTION.NEUTRAL;
}

// ============================================================================
// UPSTREAM SOURCE GUARD
// Defaults carry populated dataAvailability masks but null scores / zero
// completeness. They must NOT be treated as real evidence.
// ============================================================================
function sourceHasData(source) {
  if (!source || typeof source !== "object") return false;
  if (n(source.swingScore) != null || n(source.explosionScore) != null ||
      n(source.catalystScore) != null || n(source.pennyScore) != null ||
      n(source.setupScore) != null || n(source.opportunityScore) != null ||
      n(source.planScore) != null) {
    return true;
  }
  // B2 exposes aggregate scores on decision.decisionScore / flow.flowScore /
  // callScore / putScore.
  if (n(source.callScore) != null || n(source.putScore) != null ||
      n(source.bullishFlowScore) != null || n(source.bearishFlowScore) != null ||
      n(source.unusualActivityScore) != null) {
    return true;
  }
  if (source.decision && typeof source.decision === "object") {
    if (n(source.decision.decisionScore) != null) return true;
  }
  if (source.flow && typeof source.flow === "object") {
    if (n(source.flow.flowScore) != null) return true;
  }
  // B3 exposes institutionalScore / rankScore / decisionScore / accumulationScore.
  if (n(source.institutionalScore) != null || n(source.rankScore) != null ||
      n(source.decisionScore) != null || n(source.accumulationScore) != null ||
      n(source.distributionScore) != null || n(source.finraScore) != null) {
    return true;
  }
  const dc = n(source.dataCompleteness);
  if (dc != null && dc > 0) return true;
  if (Array.isArray(source.setupClassification) && source.setupClassification.length > 0) return true;
  if (Array.isArray(source.setups) && source.setups.length > 0) return true;
  return false;
}

function evidenceStrings(source, keys) {
  if (!source || typeof source !== "object") return [];
  const out = [];
  for (const k of keys) {
    const v = source[k];
    if (v != null && v !== "") out.push(String(v));
  }
  return out;
}

// ============================================================================
// DATA COMPLETENESS (component)
// ============================================================================
function aggregateDataCompleteness(sources) {
  const vals = [];
  for (const key of Object.keys(sources)) {
    // Skip default/empty sources: they carry completeness 0 and would
    // incorrectly drag the aggregate down (and renormalize a score).
    if (!sourceHasData(sources[key])) continue;
    const dc = n(sources[key].dataCompleteness);
    if (dc != null) vals.push(dc);
  }
  if (vals.length === 0) return null;
  return clamp(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
}

// Availability reflects whether a source was actually provided (non-null),
// independent of whether it returned real scores. Real-evidence decisions
// use sourceHasData() separately.
function buildDataAvailability(sources) {
  const present = (src) => src != null && typeof src === "object";
  return {
    pennyIntelligence: present(sources.pennyIntelligence),
    optionsIntelligence: present(sources.optionsIntelligence),
    institutionalRadar: present(sources.institutionalRadar),
    swingIntelligence: present(sources.swingIntelligence),
    earlyExplosion: present(sources.earlyExplosion),
    catalystIntelligence: present(sources.catalystIntelligence),
    opportunityRanking: present(sources.opportunityRanking),
    tradePlan: present(sources.tradePlan),
  };
}

// ============================================================================
// DIRECTION RESOLUTION (evidence-based, neutral wording only)
// ============================================================================
function resolveDirection(sources) {
  const candidates = [
    sources.tradePlan,
    sources.swingIntelligence,
    sources.earlyExplosion,
    sources.pennyIntelligence,
    sources.opportunityRanking,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && c.directionBias != null) {
      return normalizeDirection(c.directionBias);
    }
  }
  return DIRECTION.UNAVAILABLE;
}

function normalizeTimeframe(value) {
  if (value == null) return "UNKNOWN";
  if (value === TIMEFRAME.INTRADAY) return TIMEFRAME.INTRADAY;
  if (value === TIMEFRAME.SWING) return TIMEFRAME.SWING;
  if (value === TIMEFRAME.POSITION) return TIMEFRAME.POSITION;
  const s = safeLower(value);
  if (!s) return "UNKNOWN";
  if (s.includes("intraday") || s.includes("day") || s.includes("scalp")) return TIMEFRAME.INTRADAY;
  if (s.includes("position")) return TIMEFRAME.POSITION;
  if (s.includes("swing")) return TIMEFRAME.SWING;
  return "UNKNOWN";
}
function resolveTimeframe(sources) {
  if (sources.tradePlan && sources.tradePlan.timeframe) return sources.tradePlan.timeframe;
  if (sources.swingIntelligence && typeof sources.swingIntelligence === "object") {
    const v = sources.swingIntelligence.timeframe || sources.swingIntelligence.holdingPeriod;
    if (v != null) return normalizeTimeframe(v);
  }
  if (sources.earlyExplosion && typeof sources.earlyExplosion === "object") {
    const v = sources.earlyExplosion.timeframe || sources.earlyExplosion.holdingPeriod;
    if (v != null) return normalizeTimeframe(v);
  }
  return "UNKNOWN";
}// ============================================================================
// PER-SOURCE EXPLANATION BUILDERS
// Each explains ONLY what the upstream source actually reported.
// ============================================================================

// ---- B1 Penny Intelligence -------------------------------------------------
function explainPenny(b1) {
  if (!sourceHasData(b1)) return null;
  const score = n(b1.pennyScore) ?? n(b1.setupScore) ?? n(b1.unified && b1.unified.score);
  const quality = b1.quality || (b1.penny && b1.penny.quality) || null;
  const setupType = (b1.setup && b1.setup.setupType) || null;
  const signal = b1.signal || (b1.setup && b1.setup.signal) || null;
  const direction = directionalSignal(b1.directionBias);

  const evidence = [];
  if (score != null) evidence.push("Penny score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (setupType) evidence.push("Setup type: " + setupType);
  if (signal) evidence.push("Signal: " + signal);
  if (direction) evidence.push(direction);

  let explanation = "";
  if (score != null && score >= 70) {
    explanation = "Penny intelligence shows a " + (score >= 85 ? "strong" : "constructive") +
      " sub-$10 opportunity setup with " + (direction || "no clear directional evidence") + ".";
  } else if (score != null) {
    explanation = "Penny intelligence scores " + score + "/100 — " +
      (direction || "no clear directional evidence") + ".";
  } else if (setupType) {
    explanation = "Penny setup classified as " + setupType + ".";
  }

  const risk = (b1.risk && b1.risk.label) ||
    (b1.liquidity && typeof b1.liquidity.liquidityRisk === "string" && b1.liquidity.liquidityRisk !== "LOW" ? b1.liquidity.liquidityRisk : null) ||
    (b1.volatility && b1.volatility.volatilityRisk) || null;

  return block("B1 Penny Intelligence", signal || quality || null,
    explanation, evidence, risk);
}

// ---- B2 Options Intelligence ------------------------------------------------
function explainOptions(b2) {
  if (!sourceHasData(b2)) return null;
  const decisionScore = n(b2.decision && b2.decision.decisionScore);
  const flowScore = n(b2.flow && b2.flow.flowScore);
  const callScore = n(b2.callScore);
  const putScore = n(b2.putScore);
  const pressure = b2.flow && b2.flow.callPutPressure;
  const conviction = n(b2.flowConviction);
  const unusual = n(b2.unusualActivityScore);
  const thesis = b2.thesis || null;
  const action = b2.optionsAction || (b2.decision && b2.decision.decisionStatus) || null;
  const direction = directionalSignal(b2.directionBias);

  const evidence = [];
  if (decisionScore != null) evidence.push("Decision score " + decisionScore + "/100");
  if (flowScore != null) evidence.push("Flow score " + flowScore + "/100");
  if (callScore != null) evidence.push("Call score " + callScore + "/100");
  if (putScore != null) evidence.push("Put score " + putScore + "/100");
  if (pressure) evidence.push("Call/put pressure: " + pressure);
  if (conviction != null) evidence.push("Flow conviction " + conviction + "/100");
  if (unusual != null) evidence.push("Unusual activity " + unusual + "/100");
  if (thesis) evidence.push("Thesis: " + thesis);
  if (direction) evidence.push(direction);

  let explanation = "";
  if (decisionScore != null && decisionScore >= 60) {
    explanation = "Options decision engine shows " +
      (decisionScore >= 75 ? "strong" : "constructive") + " directional conviction from flow and contract data.";
  } else if (pressure) {
    explanation = "Options flow shows " + pressure + " pressure across calls and puts.";
  } else if (thesis) {
    explanation = thesis;
  }

  let risk = null;
  if (b2.risks && Array.isArray(b2.risks) && b2.risks.length > 0) {
    risk = b2.risks.map((r) => r.label).join(", ");
  } else if (b2.flow && b2.flow.flowRiskLevel === "HIGH") {
    risk = "Elevated options flow risk";
  }

  return block("B2 Options Intelligence", action || pressure || null,
    explanation, evidence, risk);
}

// ---- B3 Institutional Radar -------------------------------------------------
function explainInstitutional(b3) {
  if (!sourceHasData(b3)) return null;
  const score = n(b3.institutionalScore) ?? n(b3.decisionScore) ?? n(b3.rankScore);
  const quality = b3.institutionalQuality || null;
  const activity = b3.institutionalActivity || null;
  const bias = b3.smartMoneyBias || null;
  const conviction = n(b3.conviction);
  const action = b3.institutionalAction || (b3.decisionStatus) || null;
  const direction = directionalSignal(b3.directionBias);

  const evidence = [];
  if (score != null) evidence.push("Institutional score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (activity) evidence.push("Institutional activity: " + activity);
  if (bias) evidence.push("Smart-money bias: " + bias);
  if (conviction != null) evidence.push("Conviction " + conviction + "/100");
  if (action) evidence.push("Action: " + action);
  if (direction) evidence.push(direction);

  let explanation = "";
  if (score != null && score >= 60) {
    explanation = "Institutional radar shows " +
      (score >= 75 ? "strong" : "constructive") + " institutional participation" +
      (activity ? " (" + activity + ")" : "") + ".";
  } else if (bias) {
    explanation = "Institutional smart-money bias: " + bias + ".";
  } else if (activity) {
    explanation = "Institutional activity detected: " + activity + ".";
  }

  let risk = null;
  if (b3.institutionalRisk && b3.institutionalRisk !== "low" && b3.institutionalRisk !== "UNAVAILABLE") {
    risk = "Institutional risk: " + b3.institutionalRisk;
  } else if (Array.isArray(b3.risks) && b3.risks.length > 0) {
    risk = b3.risks.map((r) => r.label).join(", ");
  }

  return block("B3 Institutional Radar", action || bias || null,
    explanation, evidence, risk);
}
// ---- B4 Swing Intelligence -------------------------------------------------
function explainSwing(b4) {
  if (!sourceHasData(b4)) return null;
  const score = n(b4.swingScore) ?? n(b4.setupScore);
  const quality = b4.quality || null;
  const signal = b4.signal || null;
  const strength = n(b4.signalStrength);
  const setups = Array.isArray(b4.setupClassification) ? b4.setupClassification : [];
  const setupType = setups.length > 0 ? setups[0].type : null;
  const direction = directionalSignal(b4.directionBias);
  const riskLevel = b4.riskLevel || null;
  const rr = n(b4.riskReward);
  const atr = n(b4.atr);
  const sma200 = n(b4.sma200);

  const evidence = [];
  if (score != null) evidence.push("Swing score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (signal) evidence.push("Signal: " + signal);
  if (strength != null) evidence.push("Signal strength " + strength + "/100");
  if (setupType) evidence.push("Setup type: " + setupType);
  if (setups.length > 0) evidence.push(setups.length + " setup(s) classified");
  if (direction) evidence.push(direction);
  if (rr != null) evidence.push("Risk/reward " + rr);
  if (atr != null) evidence.push("ATR " + atr);
  if (sma200 != null) evidence.push("SMA200 " + sma200);

  let explanation = "";
  if (score != null && score >= 60) {
    explanation = "Swing intelligence shows a " +
      (score >= 75 ? "strong" : "constructive") + " multi-week setup" +
      (setupType ? " (" + setupType + ")" : "") + ".";
  } else if (setups.length > 0) {
    explanation = setups.length + " swing setup(s) identified" +
      (setupType ? ", first is " + setupType : "") + ".";
  } else if (signal) {
    explanation = "Swing signal: " + signal + ".";
  }

  let risk = riskLevel || null;
  if (b4.risks && Array.isArray(b4.risks) && b4.risks.length > 0) {
    risk = (risk ? risk + "; " : "") + b4.risks.map((r) => r.label).join(", ");
  }

  return block("B4 Swing Intelligence", signal || quality || null,
    explanation, evidence, risk);
}

// ---- B5 Early Explosion -----------------------------------------------------
function explainExplosion(b5) {
  if (!sourceHasData(b5)) return null;
  const score = n(b5.explosionScore);
  const quality = b5.quality || null;
  const signal = b5.signal || null;
  const setups = Array.isArray(b5.setupClassification) ? b5.setupClassification : [];
  const setupType = setups.length > 0 ? setups[0].type : null;
  const direction = directionalSignal(b5.directionBias);
  const explosionRisk = b5.explosionRisk || null;
  const liquidityRisk = b5.liquidityRisk || null;
  const relVol = n(b5.relativeVolume);
  const atrExp = n(b5.atrExpansion);
  const priceExp = n(b5.priceExpansion);

  const evidence = [];
  if (score != null) evidence.push("Explosion score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (signal) evidence.push("Signal: " + signal);
  if (setupType) evidence.push("Setup type: " + setupType);
  if (setups.length > 0) evidence.push(setups.length + " setup(s) classified");
  if (direction) evidence.push(direction);
  if (relVol != null) evidence.push("Relative volume " + relVol + "x");
  if (atrExp != null) evidence.push("ATR expansion " + atrExp);
  if (priceExp != null) evidence.push("Price expansion " + priceExp);

  let explanation = "";
  if (score != null && score >= 60) {
    explanation = "Early Explosion conditions are " +
      (score >= 75 ? "strong" : "constructive") + " — volume/price/ATR expansion is elevated" +
      (setupType ? " with a " + setupType + " setup" : "") + ".";
  } else if (setups.length > 0) {
    explanation = setups.length + " early-explosion setup(s) identified" +
      (setupType ? ", first is " + setupType : "") + ".";
  } else if (relVol != null) {
    explanation = "Relative volume at " + relVol + "x signals notable liquidity interest.";
  }

  let risk = null;
  if (explosionRisk && explosionRisk !== "LOW" && explosionRisk !== "UNKNOWN") {
    risk = "Explosion risk: " + explosionRisk;
  }
  if (liquidityRisk && liquidityRisk !== "LOW" && liquidityRisk !== "UNKNOWN") {
    risk = (risk ? risk + "; " : "") + "Liquidity risk: " + liquidityRisk;
  }

  return block("B5 Early Explosion", signal || quality || null,
    explanation, evidence, risk);
}

// ---- B6 Catalyst Intelligence ---------------------------------------------
function explainCatalyst(b6) {
  if (!sourceHasData(b6)) return null;
  const score = n(b6.catalystScore);
  const quality = b6.quality || null;
  const types = Array.isArray(b6.catalystTypes) ? b6.catalystTypes : [];
  const count = n(b6.catalystCount);
  const risk = b6.catalystRisk || null;
  const recency = b6.recency || (b6.catalysts && b6.catalysts[0] && b6.catalysts[0].recency) || null;
  // A catalyst marked upcoming/future must NEVER be described as a confirmed
  // current event (no-look-ahead / data-honesty). Surface the flag explicitly.
  const upcoming = !!(b6.upcoming ||
    (Array.isArray(b6.catalysts) && b6.catalysts.some((c) => c && c.upcoming === true)));

  const evidence = [];
  if (score != null) evidence.push("Catalyst score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (types.length > 0) evidence.push("Catalyst types: " + types.join(", "));
  if (count != null) evidence.push("Catalyst count: " + count);
  if (recency) evidence.push("Recency: " + recency);
  if (upcoming) evidence.push("Status: UPCOMING (future-dated, not yet realized)");

  let explanation = "";
  if (score != null && score >= 60) {
    if (upcoming) {
      explanation = "Catalyst intelligence flags " +
        (score >= 75 ? "strong" : "constructive") +
        " upcoming catalyst evidence" +
        (types.length > 0 ? " (" + types.join(", ") + ")" : "") +
        " — event is future-dated and not yet confirmed as a current event.";
    } else {
      explanation = "Catalyst intelligence shows " +
        (score >= 75 ? "strong" : "constructive") + " verified catalyst evidence" +
        (types.length > 0 ? " (" + types.join(", ") + ")" : "") + ".";
    }
  } else if (upcoming) {
    explanation = "Upcoming catalyst" +
      (types.length > 0 ? " (" + types.join(", ") + ")" : "") +
      " detected — future-dated and not yet confirmed as a current event.";
  } else if (types.length > 0) {
    explanation = "Catalyst types present: " + types.join(", ") + ".";
  }

  let riskOut = null;
  if (upcoming) {
    riskOut = "Catalyst is upcoming — treat as unconfirmed future event";
  } else if (risk && risk !== "LOW" && risk !== "UNKNOWN") {
    riskOut = "Catalyst risk: " + risk;
  }

  return block("B6 Catalyst Intelligence", quality || (types.length > 0 ? types.join(", ") : null),
    explanation, evidence, riskOut);
}

// ---- Horizon Evidence -------------------------------------------------------
function explainHorizon(horizon) {
  if (!horizon || typeof horizon !== "object") return null;
  const h = horizon.horizon;
  const score = n(horizon.horizonScore);
  const confidence = n(horizon.confidence);
  const dc = n(horizon.dataCompleteness);
  const domains = horizon.domains || {};
  const riskFragility = horizon.riskFragility || {};

  if (!h || h === "UNAVAILABLE") return null;

  const evidence = [];
  if (score != null) evidence.push("Horizon score " + score + "/100");
  evidence.push("Classification: " + h);
  if (confidence != null) evidence.push("Confidence " + confidence + "/100");
  if (dc != null) evidence.push("Data completeness " + dc + "%");
  const strongDomains = Object.entries(domains).filter(([, v]) => v != null && v >= 60).length;
  evidence.push(strongDomains + " of " + Object.keys(domains).length + " domains scored >= 60");

  let explanation = "";
  if (h === "HIGHEST_QUALITY") {
    explanation = "1–3 month horizon evaluation classifies this as highest-quality: available evidence strongly supports a credible medium-term opportunity.";
  } else if (h === "HIGH_RISK_REWARD") {
    explanation = "1–3 month horizon evaluation flags high risk/reward: evidence is constructive but carries elevated uncertainty — suitable only for risk-aware review.";
  } else if (h === "EARLY_WATCHLIST") {
    explanation = "1–3 month horizon evaluation places this on the early watchlist: some evidence is present but not yet sufficient for a high-conviction medium-term read.";
  } else if (h === "NOT_READY") {
    explanation = "1–3 month horizon evaluation marks this as not ready: evidence is insufficient, too fragile, or conflicting to support a credible 1–3 month opportunity.";
  }

  let risk = null;
  if (riskFragility.factors && riskFragility.factors.length > 0) {
    risk = "Fragility: " + riskFragility.factors.slice(0, 3).join(", ");
  }

  return block("Horizon Evidence (1–3M)", h,
    explanation, evidence, risk);
}

// ---- Classical Technical Evidence -------------------------------------------
function explainClassical(classical) {
  if (!classical || typeof classical !== "object") return null;
  const ms = classical.marketStructure || {};
  const br = classical.breaker || {};
  const fvg = classical.fvg || {};
  const ls = classical.liquiditySweep || {};
  const crt = classical.crt || {};
  const sr = classical.supportResistance || {};

  const evidence = [];
  if (ms.mssDetected) evidence.push("MSS: " + (ms.lastStructureShift || "detected"));
  if (ms.trend && ms.trend !== "UNAVAILABLE") evidence.push("Structure trend: " + ms.trend);
  if (br.detected) evidence.push("Breaker at " + (br.transformedLevel || "unknown"));
  if (fvg.detected) evidence.push(fvg.gaps.length + " FVG(s) detected");
  if (ls.detected) evidence.push("Liquidity sweep: " + ls.sweepType + (ls.sweptLevel ? " at " + ls.sweptLevel : ""));
  if (crt.available && crt.confirmationState && crt.confirmationState !== "UNAVAILABLE") evidence.push("CRT: " + crt.confirmationState);
  if (sr.support != null && sr.resistance != null) evidence.push("S/R " + sr.support + " / " + sr.resistance);

  if (evidence.length === 0) return null;

  let explanation = "Classical technical structures detected: " + evidence.slice(0, 4).join(", ") + ".";

  let risk = null;
  if (ms.trend === "BEARISH" && ms.mssDetected) risk = "Bearish market structure shift detected";
  else if (ls.detected && ls.sweepType === "SIMPLE_BREAKOUT") risk = "Liquidity sweep without return — potential false breakout";

  return block("Classical Technical Evidence", ms.trend || null,
    explanation, evidence, risk);
}

// ---- Candlestick Patterns ---------------------------------------------------
function explainCandlestick(candlestick) {
  if (!candlestick || typeof candlestick !== "object" || !Array.isArray(candlestick.patterns) || candlestick.patterns.length === 0) return null;
  const patterns = candlestick.patterns;
  const ctx = candlestick.context || {};

  const evidence = patterns.map((p) => p.name + " (" + p.type + ", " + p.strength + ")");
  if (ctx.bodyStrength != null) evidence.push("Body strength " + ctx.bodyStrength + "%");
  if (ctx.upperWickRejection != null) evidence.push("Upper wick rejection " + ctx.upperWickRejection + "%");
  if (ctx.lowerWickRejection != null) evidence.push("Lower wick rejection " + ctx.lowerWickRejection + "%");
  if (ctx.buyerPressure != null && ctx.sellerPressure != null) {
    evidence.push("Buyer/seller pressure " + ctx.buyerPressure + "% / " + ctx.sellerPressure + "%");
  }

  const bullish = patterns.filter((p) => p.type === "BULLISH").length;
  const bearish = patterns.filter((p) => p.type === "BEARISH").length;

  let explanation = "";
  if (bullish > 0 && bearish === 0) {
    explanation = bullish + " bullish candlestick pattern(s) detected — contextual reversal evidence only, not a standalone signal.";
  } else if (bearish > 0 && bullish === 0) {
    explanation = bearish + " bearish candlestick pattern(s) detected — contextual reversal evidence only, not a standalone signal.";
  } else if (bullish > 0 && bearish > 0) {
    explanation = "Mixed candlestick patterns (" + bullish + " bullish, " + bearish + " bearish) — conflicting short-term signals.";
  }

  let risk = null;
  if (ctx.reversalContext) risk = "Reversal context — patterns alone do not confirm direction";
  else if (patterns.length >= 3) risk = "Multiple overlapping patterns — confirm with structure before acting";

  return block("Candlestick Patterns", bullish > bearish ? "BULLISH_CONTEXT" : bearish > bullish ? "BEARISH_CONTEXT" : "MIXED_CONTEXT",
    explanation, evidence, risk);
}

// ---- Gamma Context ----------------------------------------------------------
function explainGamma(gamma) {
  if (!gamma || typeof gamma !== "object") return null;
  if (gamma.gammaAvailability !== "AVAILABLE") return null;

  const evidence = [];
  if (gamma.gamma != null) evidence.push("Gamma: " + gamma.gamma);
  if (gamma.gex != null) evidence.push("GEX: " + gamma.gex);
  if (gamma.gammaConcentration) evidence.push("Concentration: " + gamma.gammaConcentration);
  if (gamma.dealerPositioning) evidence.push("Dealer positioning: " + gamma.dealerPositioning);
  if (gamma.profile) evidence.push("Profile: " + gamma.profile);

  if (evidence.length === 0) return null;

  let explanation = "Gamma context available: " + evidence.slice(0, 3).join(", ") + ". " +
    "Concentrated gamma can create price magnets; dispersed gamma indicates uncertainty.";

  let risk = null;
  if (gamma.profile === "CONCENTRATED") risk = "Concentrated gamma — watch for gamma squeeze dynamics";
  else if (gamma.profile === "DISPERSED") risk = "Dispersed gamma — unclear dealer positioning";

  return block("Gamma / GEX Context", gamma.profile || null,
    explanation, evidence, risk);
}

// ---- C7 Opportunity Ranking ----------------------------------------------
function explainOpportunity(c7) {
  if (!sourceHasData(c7)) return null;
  const score = n(c7.opportunityScore);
  const quality = c7.quality || null;
  const rank = n(c7.rank);
  const confidence = n(c7.confidence);
  const dc = n(c7.dataCompleteness);
  const components = c7.componentScores || {};
  const compCount = Object.values(components).filter((v) => v != null).length;
  const flags = Array.isArray(c7.flags) ? c7.flags : [];
  const direction = directionalSignal(c7.directionBias);

  const evidence = [];
  if (score != null) evidence.push("Opportunity score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (rank != null) evidence.push("Rank #" + rank);
  if (compCount > 0) evidence.push(compCount + " of 6 intelligence sources contributed");
  if (confidence != null) evidence.push("Confidence " + confidence + "/100");
  if (dc != null) evidence.push("Data completeness " + dc + "%");
  if (direction) evidence.push(direction);

  let explanation = "";
  if (score != null && score >= 70) {
    explanation = "C7 Opportunity Ranking scores " + score + "/100 (" + quality +
      ") — cross-intelligence evidence is " +
      (score >= 85 ? "strong" : "constructive") + ".";
  } else if (score != null) {
    explanation = "C7 Opportunity Ranking scores " + score + "/100 (" + quality + ").";
  } else if (compCount > 0) {
    explanation = compCount + " intelligence source(s) contributed but no aggregate score was produced.";
  }

  let risk = null;
  if (Array.isArray(c7.warnings) && c7.warnings.some((w) => w.indexOf("CONFLICTING_SIGNALS_DETECTED") === 0)) {
    risk = "Conflicting signals across intelligence sources";
  } else if (Array.isArray(c7.risks) && c7.risks.length > 0) {
    risk = c7.risks.map((r) => r.label).join(", ");
  }

  return block("C7 Opportunity Ranking", quality || (score != null ? score + "/100" : null),
    explanation, evidence, risk);
}

// ---- C8 Trade Plan --------------------------------------------------------
function explainTradePlan(tp) {
  if (!sourceHasData(tp)) return null;
  const score = n(tp.planScore);
  const quality = tp.planQuality || null;
  const signal = tp.planSignal || null;
  const direction = tp.direction || null;
  const timeframe = tp.timeframe || null;
  const setup = tp.setup || null;
  const rr = n(tp.riskReward);
  const entryZone = tp.entryZone || null;
  const stop = n(tp.stopLoss);
  const target1 = n(tp.target1);
  const confidence = n(tp.confidence);
  const dc = n(tp.dataCompleteness);
  const flags = Array.isArray(tp.flags) ? tp.flags : [];

  const evidence = [];
  if (score != null) evidence.push("Trade plan score " + score + "/100");
  if (quality) evidence.push("Quality: " + quality);
  if (signal) evidence.push("Plan signal: " + signal);
  if (direction) evidence.push("Direction: " + direction);
  if (timeframe) evidence.push("Timeframe: " + timeframe);
  if (setup) evidence.push("Setup: " + setup);
  if (entryZone) evidence.push("Entry zone: " + entryZone);
  if (stop != null) evidence.push("Stop: " + stop);
  if (target1 != null) evidence.push("Target 1: " + target1);
  if (rr != null) evidence.push("Risk/reward " + rr);
  if (confidence != null) evidence.push("Confidence " + confidence + "/100");
  if (dc != null) evidence.push("Data completeness " + dc + "%");
  flags.slice(0, 4).forEach((f) => evidence.push("Flag: " + f));

  let explanation = "";
  if (score != null && score >= 70) {
    explanation = "C8 Trade Plan produces a " + (score >= 85 ? "strong" : "valid") +
      " conditional plan (" + signal + ") with score " + score + "/100" +
      (direction ? ", " + direction.toLowerCase() + " bias" : "") +
      (setup ? " and a " + setup + " setup" : "") + ".";
  } else if (score != null) {
    explanation = "C8 Trade Plan scores " + score + "/100 (" + quality + ").";
  } else if (signal) {
    explanation = "Plan signal: " + signal + ".";
  }

  let risk = null;
  if (Array.isArray(tp.warnings) && tp.warnings.length > 0) {
    risk = tp.warnings.slice(0, 4).join("; ");
  } else if (Array.isArray(tp.risks) && tp.risks.length > 0) {
    risk = tp.risks.map((r) => r.label).join(", ");
  }

  return block("C8 Trade Plan", signal || quality || null,
    explanation, evidence, risk);
}
// ============================================================================
// WHY-NOW
// Structured explanation of why a symbol is currently notable.
// Every factor must be traceable to an existing source. No generic filler.
// Null when no meaningful current evidence exists.
// ============================================================================
function buildWhyNow(sources, explanations) {
  const factors = [];

  // Strong opportunity score (C7)
  const c7 = sources.opportunityRanking;
  if (sourceHasData(c7)) {
    const score = n(c7.opportunityScore);
    if (score != null && score >= 70) {
      factors.push({
        factor: "C7 Opportunity Ranking",
        signal: score >= 85 ? "STRONG" : "CONSTRUCTIVE",
        strength: score,
        explanation: "Cross-intelligence opportunity score is " + score + "/100 — " +
          (score >= 85 ? "strong multi-source confirmation" : "constructive evidence across intelligence layers") + ".",
        evidence: ["Opportunity score " + score + "/100", "Quality: " + (c7.quality || "UNAVAILABLE")],
        risk: (c7.warnings && c7.warnings.some((w) => w.indexOf("CONFLICTING_SIGNALS_DETECTED") === 0))
          ? "Conflicting signals present" : null,
      });
    }
  }

  // Strong setup (B4/B5)
  for (const [key, src] of Object.entries(sources)) {
    if ((key !== "swingIntelligence" && key !== "earlyExplosion") || !sourceHasData(src)) continue;
    const setups = Array.isArray(src.setupClassification) ? src.setupClassification : [];
    if (setups.length > 0) {
      const first = setups[0];
      factors.push({
        factor: key === "swingIntelligence" ? "B4 Swing Intelligence" : "B5 Early Explosion",
        signal: first.type || "SETUP",
        strength: n(first.confidence),
        explanation: (key === "swingIntelligence" ? "Swing" : "Early explosion") +
          " setup classified as " + (first.type || "UNKNOWN") +
          (first.label ? " (" + first.label + ")" : "") + ".",
        evidence: setups.map((s) => s.type + (s.label ? ": " + s.label : "")).slice(0, 3),
        risk: null,
      });
    }
  }

  // Catalyst (B6)
  const b6 = sources.catalystIntelligence;
  if (sourceHasData(b6)) {
    const score = n(b6.catalystScore);
    const types = Array.isArray(b6.catalystTypes) ? b6.catalystTypes : [];
    // Upcoming catalysts are future-dated — NOT current confirmed evidence.
    const upcoming = !!(b6.upcoming ||
      (Array.isArray(b6.catalysts) && b6.catalysts.some((c) => c && c.upcoming === true)));
    if ((score != null && score >= 60) || types.length > 0) {
      const desc = upcoming
        ? "Upcoming catalyst" +
          (types.length > 0 ? " (" + types.join(", ") + ")" : "") +
          " — future-dated and not yet a confirmed current event."
        : "Verified catalyst evidence" +
          (types.length > 0 ? " (" + types.join(", ") + ")" : "") + " supports current notability.";
      factors.push({
        factor: "B6 Catalyst Intelligence",
        signal: score != null && score >= 75 ? "STRONG" : "PRESENT",
        strength: score,
        explanation: desc,
        evidence: types.length > 0 ? ["Catalyst types: " + types.join(", ")] : [],
        risk: upcoming
          ? "Upcoming catalyst — not yet realized"
          : (b6.catalystRisk && b6.catalystRisk !== "LOW") ? "Catalyst risk: " + b6.catalystRisk : null,
      });
    }
  }

  // Options evidence (B2)
  const b2 = sources.optionsIntelligence;
  if (sourceHasData(b2)) {
    const decisionScore = n(b2.decision && b2.decision.decisionScore);
    const flowScore = n(b2.flow && b2.flow.flowScore);
    const pressure = b2.flow && b2.flow.callPutPressure;
    if ((decisionScore != null && decisionScore >= 60) || (flowScore != null && flowScore >= 60) || pressure) {
      factors.push({
        factor: "B2 Options Intelligence",
        signal: (decisionScore != null && decisionScore >= 75) || (flowScore != null && flowScore >= 75)
          ? "STRONG" : "PRESENT",
        strength: decisionScore ?? flowScore,
        explanation: "Options flow and contract data show " +
          (pressure ? pressure + " pressure" : "notable directional conviction") + ".",
        evidence: [
          decisionScore != null ? "Decision score " + decisionScore + "/100" : null,
          flowScore != null ? "Flow score " + flowScore + "/100" : null,
          pressure ? "Call/put pressure: " + pressure : null,
        ].filter(Boolean),
        risk: (b2.flow && b2.flow.flowRiskLevel === "HIGH") ? "Elevated options flow risk" : null,
      });
    }
  }

  // Institutional evidence (B3)
  const b3 = sources.institutionalRadar;
  if (sourceHasData(b3)) {
    const score = n(b3.institutionalScore) ?? n(b3.decisionScore);
    const activity = b3.institutionalActivity;
    const bias = b3.smartMoneyBias;
    if ((score != null && score >= 60) || activity || bias) {
      factors.push({
        factor: "B3 Institutional Radar",
        signal: (score != null && score >= 75) ? "STRONG" : "PRESENT",
        strength: score,
        explanation: "Institutional participation" +
          (activity ? " (" + activity + ")" : "") +
          (bias ? " — smart-money bias: " + bias : "") + ".",
        evidence: [
          score != null ? "Institutional score " + score + "/100" : null,
          activity ? "Activity: " + activity : null,
          bias ? "Bias: " + bias : null,
        ].filter(Boolean),
        risk: (b3.institutionalRisk && b3.institutionalRisk !== "low" && b3.institutionalRisk !== "UNAVAILABLE")
          ? "Institutional risk: " + b3.institutionalRisk : null,
      });
    }
  }

  // Momentum/technical evidence (B1)
  const b1 = sources.pennyIntelligence;
  if (sourceHasData(b1)) {
    const score = n(b1.pennyScore) ?? n(b1.setupScore);
    const rsi = n(b1.rsi);
    const relVol = n(b1.relativeVolume);
    if (score != null && score >= 60) {
      factors.push({
        factor: "B1 Penny Intelligence",
        signal: score >= 75 ? "STRONG" : "CONSTRUCTIVE",
        strength: score,
        explanation: "Penny/technical layer scores " + score + "/100" +
          (rsi != null ? ", RSI " + rsi : "") +
          (relVol != null ? ", relative volume " + relVol + "x" : "") + ".",
        evidence: [
          score != null ? "Setup score " + score + "/100" : null,
          rsi != null ? "RSI " + rsi : null,
          relVol != null ? "Relative volume " + relVol + "x" : null,
        ].filter(Boolean),
        risk: (b1.liquidity && b1.liquidity.liquidityRisk && b1.liquidity.liquidityRisk !== "LOW")
          ? "Liquidity risk: " + b1.liquidity.liquidityRisk : null,
      });
    }
  }

  // Valid trade plan (C8)
  const tp = sources.tradePlan;
  if (sourceHasData(tp)) {
    const planScore = n(tp.planScore);
    const signal = tp.planSignal;
    if (planScore != null && planScore >= 70) {
      factors.push({
        factor: "C8 Trade Plan",
        signal: signal || "VALID",
        strength: planScore,
        explanation: "A conditional trade plan is available (" + signal +
          ", score " + planScore + "/100)" +
          (tp.direction ? " with " + tp.direction.toLowerCase() + " bias" : "") + ".",
        evidence: [
          "Plan score " + planScore + "/100",
          "Quality: " + (tp.planQuality || "UNAVAILABLE"),
          tp.riskReward != null ? "Risk/reward " + tp.riskReward : null,
        ].filter(Boolean),
        risk: (tp.riskReward != null && tp.riskReward < 1) ? "Risk/reward below 1.0" : null,
      });
    }
  }

  return factors.length > 0 ? factors : null;
}// ============================================================================
// CONFLICTS
// Explicitly state when sources disagree. Never force a directional conclusion.
// ============================================================================
function detectConflicts(sources) {
  const conflicts = [];
  const signals = [];
  for (const key of ["swingIntelligence", "earlyExplosion", "pennyIntelligence"]) {
    const data = sources[key];
    if (!sourceHasData(data) || !data || !data.signal) continue;
    const s = String(data.signal).toUpperCase();
    if (s.includes("BUY") || s.includes("STRONG_BUY")) signals.push({ key, side: "BUY" });
    else if (s.includes("SELL") || s.includes("STRONG_SELL")) signals.push({ key, side: "SELL" });
  }
  const buys = signals.filter((s) => s.side === "BUY");
  const sells = signals.filter((s) => s.side === "SELL");
  if (buys.length > 0 && sells.length > 0) {
    conflicts.push({
      type: "DIRECTIONAL_CONFLICT",
      severity: "HIGH",
      description: "Buy signal from " + buys.map((s) => s.key).join(", ") +
        " vs Sell signal from " + sells.map((s) => s.key).join(", "),
      sources: buys.map((s) => s.key).concat(sells.map((s) => s.key)),
    });
  }

  // C7-level conflicts
  const c7 = sources.opportunityRanking;
  if (sourceHasData(c7) && Array.isArray(c7.warnings) &&
      c7.warnings.some((w) => w.indexOf("CONFLICTING_SIGNALS_DETECTED") === 0)) {
    conflicts.push({
      type: "SIGNAL_CONFLICT",
      severity: "HIGH",
      description: "Conflicting signals detected across intelligence sources",
      sources: ["opportunityRanking"],
    });
  }

  return conflicts;
}

// ============================================================================
// RISK AGGREGATION
// Aggregate evidence-based risks from C7 + B1-B6. Never fabricate.
// ============================================================================
function aggregateRisks(sources, explanations) {
  const risks = [];
  const add = (label, severity, description) => {
    risks.push({ label, severity, description });
  };

  const c7 = sources.opportunityRanking;
  const b4 = sources.swingIntelligence;
  const b5 = sources.earlyExplosion;
  const b2 = sources.optionsIntelligence;
  const b3 = sources.institutionalRadar;
  const b6 = sources.catalystIntelligence;

  if (sourceHasData(c7)) {
    if (Array.isArray(c7.warnings) && c7.warnings.some((w) => w.indexOf("CONFLICTING_SIGNALS_DETECTED") === 0)) {
      add("SIGNAL_CONFLICT", "HIGH", "Conflicting signals detected across intelligence sources");
    }
    if (Array.isArray(c7.risks)) {
      for (const r of c7.risks) {
        if (r && r.label && r.severity) add(r.label, r.severity, r.description || r.label);
      }
    }
  }

  if (sourceHasData(b4)) {
    if (b4.explosionRisk === "HIGH") add("EXPLOSION_VOLATILITY_RISK", "HIGH", "Swing intelligence flagged high volatility risk");
    if (b4.liquidityRisk === "HIGH") add("LIQUIDITY_RISK", "HIGH", "Swing intelligence flagged liquidity risk");
    if (Array.isArray(b4.risks)) {
      for (const r of b4.risks) {
        if (r && r.label === "NEGATIVE_RR" && r.severity === "HIGH") add("NEGATIVE_RR", "HIGH", "Swing risk/reward below 1.0");
        if (r && r.label === "LOW_DATA" && r.severity === "MEDIUM") add("LOW_DATA", "MEDIUM", "Swing data completeness below 50%");
      }
    }
  }

  if (sourceHasData(b5)) {
    if (b5.explosionRisk && b5.explosionRisk !== "LOW" && b5.explosionRisk !== "UNKNOWN") {
      add("EXPLOSION_VOLATILITY_RISK", b5.explosionRisk === "HIGH" ? "HIGH" : "MEDIUM",
        "Early Explosion intelligence flagged " + b5.explosionRisk.toLowerCase() + " volatility risk");
    }
    if (b5.liquidityRisk && b5.liquidityRisk !== "LOW" && b5.liquidityRisk !== "UNKNOWN") {
      add("LIQUIDITY_RISK", b5.liquidityRisk === "HIGH" ? "HIGH" : "MEDIUM",
        "Early Explosion intelligence flagged " + b5.liquidityRisk.toLowerCase() + " liquidity risk");
    }
  }

  if (sourceHasData(b2)) {
    if (b2.flow && b2.flow.flowRiskLevel === "HIGH") add("OPTIONS_RISK", "MEDIUM", "Options flow risk level elevated");
  }

  if (sourceHasData(b3)) {
    if (b3.institutionalRisk && b3.institutionalRisk !== "low" && b3.institutionalRisk !== "UNAVAILABLE") {
      add("DILUTION_RISK", b3.institutionalRisk === "high" ? "HIGH" : "MEDIUM",
        "Institutional risk: " + b3.institutionalRisk);
    }
  }

  if (sourceHasData(b6)) {
    if (b6.catalystRisk === "HIGH") add("CATALYST_RISK", "HIGH", "Catalyst intelligence flagged high catalyst risk");
    // Upcoming/future-dated catalysts must not be presented as confirmed current
    // evidence — surface the caveat as an explicit risk.
    if (b6.upcoming || (Array.isArray(b6.catalysts) && b6.catalysts.some((c) => c && c.upcoming === true))) {
      add("UPCOMING_CATALYST", "MEDIUM", "Upstream catalyst is upcoming/future-dated — not yet a confirmed current event");
    }
  }

  // Missing-evidence risks
  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  if (availableCount === 0) {
    add(RISK_LABEL_NO_INTEL, "HIGH", "No intelligence sources available for explanation");
  } else if (availableCount < 3) {
    add("LOW_DATA", "MEDIUM", "Only " + availableCount + " of 8 sources available");
  }

  if (risks.length === 0) {
    add("NO_MAJOR_RISKS_IDENTIFIED", "LOW", "No significant risk factors detected");
  }
  return risks;
}

// ============================================================================
// WARNINGS
// ============================================================================
function buildWarnings(sources, explanations, conflicts) {
  const warnings = [];
  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  const totalCount = Object.keys(sources).length;

  if (availableCount === 0) warnings.push("NO_INTELLIGENCE_AVAILABLE");
  if (availableCount < totalCount) warnings.push("PARTIAL_INTELLIGENCE: " + availableCount + " of " + totalCount + " sources available");
  if (conflicts.length > 0) warnings.push("CONFLICTING_SIGNALS_DETECTED");
  for (const c of conflicts.slice(0, 3)) warnings.push("CONFLICT: " + c.description);
  return warnings;
}// ============================================================================
// KEY LEVELS / EXPLANATIONS
// Preserve upstream levels; explain only what exists. Never fabricate.
// ============================================================================
function buildKeyLevels(sources) {
  const tp = sources.tradePlan;
  const b4 = sources.swingIntelligence;
  const b5 = sources.earlyExplosion;
  const b1 = sources.pennyIntelligence;

  const levels = {
    entryZone: null,
    entryPrice: null,
    stopLoss: null,
    target1: null,
    target2: null,
    target3: null,
    invalidation: null,
    riskReward: null,
  };

  if (sourceHasData(tp)) {
    levels.entryZone = tp.entryZone || null;
    levels.entryPrice = n(tp.entryPrice);
    levels.stopLoss = n(tp.stopLoss);
    levels.target1 = n(tp.target1);
    levels.target2 = n(tp.target2);
    levels.target3 = n(tp.target3);
    levels.invalidation = n(tp.invalidation);
    levels.riskReward = n(tp.riskReward);
  } else if (sourceHasData(b4) || sourceHasData(b5)) {
    const src = sourceHasData(b4) ? b4 : b5;
    levels.entryZone = src.entryZone || null;
    // B4/B5 expose invalidation at top level (stopLoss lives only inside the
    // upstream zones object). Derive stopLoss from invalidation — never
    // fabricate a level that the upstream did not provide.
    levels.stopLoss = n(src.stopLoss) != null ? n(src.stopLoss) : n(src.invalidation);
    levels.target1 = n(src.target1);
    levels.target2 = n(src.target2);
    levels.invalidation = n(src.invalidation);
    levels.riskReward = n(src.riskReward);
  } else if (sourceHasData(b1) && b1.zones) {
    levels.entryZone = b1.zones.entryZone || null;
  }

  return levels;
}

function explainEntry(levels, direction) {
  if (levels.entryZone == null && levels.entryPrice == null) return null;
  if (levels.entryPrice != null) {
    return "Entry reference " + levels.entryPrice + " comes from upstream zone data" +
      (direction ? " for a " + directionWord(direction) : "") + ".";
  }
  return "Entry zone '" + levels.entryZone + "' comes from upstream zone data" +
    (direction ? " for a " + directionWord(direction) : "") + ".";
}

function explainStop(levels) {
  if (levels.stopLoss == null) return null;
  return "Stop loss " + levels.stopLoss + " comes from upstream zone data" +
    (levels.invalidation != null ? "; invalidation " + levels.invalidation : "") + ".";
}

function explainTargets(levels) {
  const parts = [];
  if (levels.target1 != null) parts.push("Target 1 " + levels.target1);
  if (levels.target2 != null) parts.push("Target 2 " + levels.target2);
  if (levels.target3 != null) parts.push("Target 3 " + levels.target3);
  if (parts.length === 0) return null;
  return parts.join(", ") + " come from upstream zone data.";
}

function explainRiskReward(levels, direction) {
  if (levels.riskReward == null) return null;
  return "Risk/reward " + levels.riskReward + " comes from upstream zone derivation" +
    (direction ? " (" + directionWord(direction) + ")" : "") + ".";
}

// ============================================================================
// HEADLINE / SUMMARY / THESIS
// ============================================================================
function buildHeadline(sources, direction, whyNow) {
  const c7 = sources.opportunityRanking;
  const tp = sources.tradePlan;

  let opener = "Analysis";
  if (sourceHasData(tp) && tp.planSignal && tp.planSignal !== "UNAVAILABLE") {
    opener = tp.planSignal === "STRONG_PLAN" ? "Strong plan" :
      tp.planSignal === "VALID_PLAN" ? "Valid plan" : "Watch-level plan";
  } else if (sourceHasData(c7) && c7.opportunityScore != null) {
    const s = c7.opportunityScore;
    opener = s >= 85 ? "Strong opportunity" : s >= 70 ? "Constructive opportunity" :
      s >= 55 ? "Watch-level opportunity" : "Weak opportunity";
  }

  const dirPart = direction && direction !== "UNAVAILABLE" ? " — " + directionWord(direction) : "";
  const whyPart = whyNow && whyNow.length > 0 ? " with " + whyNow.length + " active factor(s)" : "";
  return opener + dirPart + whyPart + ".";
}

function buildSummary(sources, explanations, direction) {
  const present = explanations.filter(Boolean);
  if (present.length === 0) return "Insufficient intelligence evidence to summarize this symbol.";

  const parts = present.map((e) => {
    const label = e.factor;
    const text = e.explanation || "";
    return label ? label + ": " + text : text;
  });

  const head = parts.slice(0, 3).join(" ");
  const tail = parts.length > 3 ? " " + (parts.length - 3) + " additional source(s) also contributed." : "";
  const dir = direction && direction !== "UNAVAILABLE"
    ? " Overall directional evidence points to " + directionWord(direction) + "."
    : "";
  return head + tail + dir;
}

function buildThesis(sources, direction, whyNow) {
  const c7 = sources.opportunityRanking;
  const tp = sources.tradePlan;

  let core = "This symbol is currently analyzed across multiple intelligence layers";
  if (sourceHasData(c7) && c7.opportunityScore != null) {
    core = "Cross-intelligence opportunity score is " + c7.opportunityScore + "/100";
  }
  if (sourceHasData(tp) && tp.planScore != null) {
    core += ", with a conditional trade plan score of " + tp.planScore + "/100";
  }

  let qualifier = "";
  if (sourceHasData(tp) && tp.planSignal && tp.planSignal !== "UNAVAILABLE") {
    qualifier = " producing a " + tp.planSignal.replace("_", " ").toLowerCase();
  } else {
    qualifier = " but no valid trade plan is currently available";
  }

  const why = whyNow && whyNow.length > 0
    ? " Current notability is driven by " + whyNow.length + " active factor(s)."
    : "";

  const dir = direction && direction !== "UNAVAILABLE"
    ? " Evidence supports a " + directionWord(direction) + "."
    : " No directional evidence is currently available.";

  return core + qualifier + "." + why + dir;
}
// ============================================================================
// POSITIVE / NEGATIVE EVIDENCE
// Split the evidence blocks into supportive and cautionary sets.
// Missing data is NEVER interpreted as negative evidence.
// ============================================================================
function splitEvidence(explanations) {
  const positive = [];
  const negative = [];
  for (const e of explanations) {
    if (!e) continue;
    const text = (e.explanation || "") + " " + (e.signal || "") + " " + (e.risk || "");
    const riskText = String(e.risk || "").toLowerCase();
    const highRisk = e.risk && (riskText.includes("high") || riskText.includes("elevated")) &&
      !riskText.includes("no major risks");
    const isNegative = (e.signal && (e.signal.includes("SELL") || e.signal.includes("BEARISH"))) ||
      highRisk;

    if (isNegative) {
      negative.push({
        factor: e.factor,
        signal: e.signal,
        explanation: e.explanation,
        evidence: e.evidence,
        risk: e.risk,
      });
    } else {
      positive.push({
        factor: e.factor,
        signal: e.signal,
        explanation: e.explanation,
        evidence: e.evidence,
        risk: e.risk,
      });
    }
  }
  return { positive, negative };
}

// ============================================================================
// TECHNICAL / MOMENTUM EXPLANATION (B1 + B4 + B5)
// ============================================================================
function explainTechnical(sources, b1explanation, b4explanation, b5explanation) {
  const parts = [];
  const evidence = [];

  if (sourceHasData(sources.pennyIntelligence)) {
    const b1 = sources.pennyIntelligence;
    const rsi = n(b1.rsi);
    const sma20 = n(b1.sma20 ?? (b1.structure && b1.structure.sma20));
    const sma50 = n(b1.sma50 ?? (b1.structure && b1.structure.sma50));
    const sma200 = n(b1.sma200);
    const relVol = n(b1.relativeVolume);
    const price = n(b1.price);

    const tech = [];
    if (price != null) tech.push("price " + price);
    if (rsi != null) tech.push("RSI " + rsi);
    if (sma20 != null) tech.push("SMA20 " + sma20);
    if (sma50 != null) tech.push("SMA50 " + sma50);
    if (sma200 != null) tech.push("SMA200 " + sma200);
    if (relVol != null) tech.push("relative volume " + relVol + "x");

    if (tech.length > 0) {
      parts.push("Technical indicators: " + tech.join(", ") + ".");
      evidence.push("B1 technical: " + tech.join(", "));
    }
  }

  if (sourceHasData(sources.swingIntelligence)) {
    const b4 = sources.swingIntelligence;
    const sma20 = n(b4.sma20);
    const sma50 = n(b4.sma50);
    const sma200 = n(b4.sma200);
    const atr = n(b4.atr);
    const vwap = n(b4.vwap);
    const support = n(b4.support);
    const resistance = n(b4.resistance);
    const relVol = n(b4.relativeVolume);

    const tech = [];
    if (sma20 != null) tech.push("SMA20 " + sma20);
    if (sma50 != null) tech.push("SMA50 " + sma50);
    if (sma200 != null) tech.push("SMA200 " + sma200);
    if (atr != null) tech.push("ATR " + atr);
    if (vwap != null) tech.push("VWAP " + vwap);
    if (support != null) tech.push("support " + support);
    if (resistance != null) tech.push("resistance " + resistance);
    if (relVol != null) tech.push("relative volume " + relVol + "x");

    if (tech.length > 0) {
      parts.push("Swing structure: " + tech.join(", ") + ".");
      evidence.push("B4 structure: " + tech.join(", "));
    }
  }

  if (sourceHasData(sources.earlyExplosion)) {
    const b5 = sources.earlyExplosion;
    const atrExp = n(b5.atrExpansion);
    const priceExp = n(b5.priceExpansion);
    const rangeComp = n(b5.rangeCompression);
    const relVol = n(b5.relativeVolume);

    const tech = [];
    if (atrExp != null) tech.push("ATR expansion " + atrExp);
    if (priceExp != null) tech.push("price expansion " + priceExp);
    if (rangeComp != null) tech.push("range compression " + rangeComp);
    if (relVol != null) tech.push("relative volume " + relVol + "x");

    if (tech.length > 0) {
      parts.push("Expansion conditions: " + tech.join(", ") + ".");
      evidence.push("B5 expansion: " + tech.join(", "));
    }
  }

  if (parts.length === 0) return null;
  return {
    explanation: parts.join(" "),
    evidence: evidence,
  };
}

function explainMomentum(sources, b1explanation, b4explanation, b5explanation) {
  const parts = [];
  const evidence = [];

  if (sourceHasData(sources.pennyIntelligence)) {
    const b1 = sources.pennyIntelligence;
    const rsi = n(b1.rsi);
    const changePercent = n(b1.changePercent);
    const setupScore = n(b1.setupScore);
    const mom = [];
    if (rsi != null) mom.push("RSI " + rsi);
    if (changePercent != null) mom.push("change " + changePercent + "%");
    if (setupScore != null) mom.push("setup score " + setupScore);
    if (mom.length > 0) {
      parts.push("Penny momentum: " + mom.join(", ") + ".");
      evidence.push("B1 momentum: " + mom.join(", "));
    }
  }

  if (sourceHasData(sources.swingIntelligence)) {
    const b4 = sources.swingIntelligence;
    const signal = b4.signal;
    const strength = n(b4.signalStrength);
    const changePercent = n(b4.changePercent);
    const mom = [];
    if (signal) mom.push("signal " + signal);
    if (strength != null) mom.push("strength " + strength + "/100");
    if (changePercent != null) mom.push("change " + changePercent + "%");
    if (mom.length > 0) {
      parts.push("Swing momentum: " + mom.join(", ") + ".");
      evidence.push("B4 momentum: " + mom.join(", "));
    }
  }

  if (sourceHasData(sources.earlyExplosion)) {
    const b5 = sources.earlyExplosion;
    const momAcc = n(b5.momentumAcceleration);
    const volAcc = n(b5.volumeAcceleration);
    const priceExp = n(b5.priceExpansion);
    const mom = [];
    if (momAcc != null) mom.push("momentum acceleration " + momAcc);
    if (volAcc != null) mom.push("volume acceleration " + volAcc);
    if (priceExp != null) mom.push("price expansion " + priceExp);
    if (mom.length > 0) {
      parts.push("Expansion momentum: " + mom.join(", ") + ".");
      evidence.push("B5 momentum: " + mom.join(", "));
    }
  }

  if (parts.length === 0) return null;
  return { explanation: parts.join(" "), evidence: evidence };
}
// ============================================================================
// PROVENANCE
// Preserve upstream provenance. Never claim REAL when upstream is proxy.
// ============================================================================
function buildProvenance(sources) {
  const known = {
    opportunityRanking: "C7",
    tradePlan: "C8",
    pennyIntelligence: "B1",
    optionsIntelligence: "B2",
    institutionalRadar: "B3",
    swingIntelligence: "B4",
    earlyExplosion: "B5",
    catalystIntelligence: "B6",
  };
  // Initialise every known key to null so an absent source reports null
  // (not undefined) for audit consistency.
  const p = {
    intelligence: "C9",
    engine: "C9 AI Explanation",
    ...Object.fromEntries(Object.keys(known).map((k) => [k, null])),
  };

  if (sources.opportunityRanking && typeof sources.opportunityRanking === "object" &&
      sources.opportunityRanking.provenance) {
    p.opportunityRanking = sources.opportunityRanking.provenance.engine ||
      sources.opportunityRanking.provenance.intelligence || "C7";
  }
  if (sources.tradePlan && typeof sources.tradePlan === "object" && sources.tradePlan.provenance) {
    p.tradePlan = sources.tradePlan.provenance.engine || sources.tradePlan.provenance.intelligence || "C8";
  }

  for (const [key, src] of Object.entries(sources)) {
    if (key === "opportunityRanking" || key === "tradePlan") continue;
    if (src != null && typeof src === "object") {
      if (src.provenance) {
        p[key] = src.provenance.manager || src.provenance.intelligence || known[key] || key;
      } else {
        p[key] = known[key] || key;
      }
    }
    // else: stays null from the initialisation above.
  }
  return p;
}

// ============================================================================
// CONFIDENCE PRESERVATION
// C9 explains upstream confidence. It does NOT manufacture a new score.
// ============================================================================
function preserveConfidence(sources) {
  // Prefer C8's confidence (most complete decision-layer view), then C7's.
  const c8 = sources.tradePlan;
  const c7 = sources.opportunityRanking;

  if (sourceHasData(c8) && n(c8.confidence) != null) {
    return {
      score: n(c8.confidence),
      level: c8.confidenceLevel || null,
      source: "C8 Trade Plan",
    };
  }
  if (sourceHasData(c7) && n(c7.confidence) != null) {
    return {
      score: n(c7.confidence),
      level: c7.confidenceLevel || null,
      source: "C7 Opportunity Ranking",
    };
  }
  return { score: null, level: "UNAVAILABLE", source: null };
}

function explainConfidence(confidence) {
  if (!confidence || confidence.score == null) return null;
  const score = confidence.score;
  let basis = "";
  switch (confidence.source) {
    case "C8 Trade Plan":
      basis = "derived from the availability and agreement of C8's six trade-plan components";
      break;
    case "C7 Opportunity Ranking":
      basis = "derived from the number of contributing intelligence sources and data completeness";
      break;
    default:
      basis = "derived from upstream confidence evidence";
  }
  return "Confidence " + score + "/100 (" + (confidence.level || "UNKNOWN") + ") is " + basis + ".";
}

// ============================================================================
// LIMITATIONS
// ============================================================================
function buildLimitations(sources) {
  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  const parts = [
    "C9 AI Explanation composes B1-B6, C7, and C8 outputs. It is an explanation layer — not a scoring engine and not a buy/sell recommendation.",
    "No price levels, targets, stops, confidence, catalysts, options flow, or institutional activity are fabricated.",
  ];
  if (availableCount < 8) {
    parts.push(availableCount + " of 8 intelligence sources are available. Missing sources remain null.");
  }
  parts.push("Explanation is derived only from supplied/current analysis objects — no look-ahead.");
  return parts.join(" ");
}

function defaultExplanation(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    available: false,

    headline: null,
    summary: "Insufficient intelligence evidence to explain this symbol.",
    thesis: null,

    whyNow: null,
    whyItMatters: null,

    supportingEvidence: [],
    positiveEvidence: [],
    negativeEvidence: [],

    technicalExplanation: null,
    momentumExplanation: null,
    optionsExplanation: null,
    institutionalExplanation: null,
    catalystExplanation: null,
    explosionExplanation: null,
    opportunityExplanation: null,
    tradePlanExplanation: null,

    directionBias: "UNAVAILABLE",
    direction: "UNAVAILABLE",
    directionWord: null,
    setup: null,
    timeframe: "UNKNOWN",

    keyLevels: {
      entryZone: null,
      entryPrice: null,
      stopLoss: null,
      target1: null,
      target2: null,
      target3: null,
      invalidation: null,
      riskReward: null,
    },
    entryExplanation: null,
    stopExplanation: null,
    targetExplanation: null,
    riskRewardExplanation: null,

    risks: [{ label: RISK_LABEL_NO_INTEL, severity: "HIGH", description: "No intelligence sources available for explanation" }],
    warnings: ["NO_INTELLIGENCE_AVAILABLE"],
    conflicts: [],

    confidence: { score: null, level: "UNAVAILABLE", source: null },
    confidenceExplanation: null,

    dataAvailability: {
      pennyIntelligence: false,
      optionsIntelligence: false,
      institutionalRadar: false,
      swingIntelligence: false,
      earlyExplosion: false,
      catalystIntelligence: false,
      opportunityRanking: false,
      tradePlan: false,
    },
    dataCompleteness: 0,

    provenance: { intelligence: "C9", engine: "C9 AI Explanation" },
    limitations: "C9 composes B1-B6, C7, and C8. No intelligence sources available.",
    disclaimer: "C9 AI Explanation is derived only from existing B1-B6, C7, and C8 outputs — not a buy/sell recommendation. No price levels, targets, or confidence values are fabricated. Missing evidence remains null.",
  };
}

// ============================================================================
// MAIN ENTRY
// ============================================================================
function buildAIExplanation(symbol, sources, opts = {}) {
  const defaultResult = defaultExplanation(symbol || null);
  if (!symbol) {
    return defaultResult;
  }
  if (!sources || typeof sources !== "object") {
    return { ...defaultResult, symbol };
  }

  const c7 = sources.opportunityRanking || null;
  const b4 = sources.swingIntelligence || null;
  const b5 = sources.earlyExplosion || null;
  const b2 = sources.optionsIntelligence || null;
  const b3 = sources.institutionalRadar || null;
  const b6 = sources.catalystIntelligence || null;
  const b1 = sources.pennyIntelligence || null;
  const tp = sources.tradePlan || null;

  const availableCount = Object.values(sources).filter((v) => sourceHasData(v)).length;
  if (availableCount === 0) {
    return {
      ...defaultResult,
      symbol,
      reasons: ["No intelligence sources provided for explanation"],
    };
  }

  // Per-source explanations (only what upstream actually reported)
  const pennyEx = explainPenny(b1);
  const optionsEx = explainOptions(b2);
  const institutionalEx = explainInstitutional(b3);
  const swingEx = explainSwing(b4);
  const explosionEx = explainExplosion(b5);
  const catalystEx = explainCatalyst(b6);
  const opportunityEx = explainOpportunity(c7);
  const tradePlanEx = explainTradePlan(tp);

  const explanations = [
    pennyEx, optionsEx, institutionalEx, swingEx,
    explosionEx, catalystEx, opportunityEx, tradePlanEx,
  ];

  // Direction & timeframe (evidence-based, neutral wording only)
  const directionBias = resolveDirection(sources);
  const direction = directionBias;
  const timeframe = resolveTimeframe(sources);

  // Setup label
  const setup = (swingEx && swingEx.evidence && swingEx.evidence.find((e) => e.includes("Setup type: ")))
    ? swingEx.evidence.find((e) => e.includes("Setup type: ")).replace("Setup type: ", "")
    : (explosionEx && explosionEx.evidence && explosionEx.evidence.find((e) => e.includes("Setup type: ")))
      ? explosionEx.evidence.find((e) => e.includes("Setup type: ")).replace("Setup type: ", "")
      : null;

  // Why-now factors
  const whyNow = buildWhyNow(sources, explanations);

  // Conflicts (never force a directional conclusion)
  const conflicts = detectConflicts(sources);

  // Key levels
  const levels = buildKeyLevels(sources);

  // Evidence split (missing data is NEVER negative evidence)
  const { positive, negative } = splitEvidence(explanations);

  // Risks & warnings
  const risks = aggregateRisks(sources, explanations);
  const warnings = buildWarnings(sources, explanations, conflicts);

  // Confidence preservation (no new score)
  const confidence = preserveConfidence(sources);
  const confidenceExplanation = explainConfidence(confidence);

  // Data completeness
  const dataCompleteness = aggregateDataCompleteness(sources);

  // Provenance
  const provenance = buildProvenance(sources);

  // Headline / summary / thesis
  const headline = buildHeadline(sources, direction, whyNow);
  const summary = buildSummary(sources, explanations, direction);
  const thesis = buildThesis(sources, direction, whyNow);

  // Per-domain explanations
  const technical = explainTechnical(sources, pennyEx, swingEx, explosionEx);
  const momentum = explainMomentum(sources, pennyEx, swingEx, explosionEx);

  const supportingEvidence = explanations
    .filter(Boolean)
    .flatMap((e) => (e.evidence || []).map((ev) => ({ source: e.factor, evidence: ev })));

  return {
    symbol,
    timestamp: nowISO(),
    available: true,

    headline,
    summary,
    thesis,

    whyNow,
    whyItMatters: whyNow ? whyNow.length + " active factor(s) drive current notability." : null,

    supportingEvidence,
    positiveEvidence: positive,
    negativeEvidence: negative,

    technicalExplanation: technical ? technical.explanation : null,
    momentumExplanation: momentum ? momentum.explanation : null,
    optionsExplanation: optionsEx ? optionsEx.explanation : null,
    institutionalExplanation: institutionalEx ? institutionalEx.explanation : null,
    catalystExplanation: catalystEx ? catalystEx.explanation : null,
    explosionExplanation: explosionEx ? explosionEx.explanation : null,
    opportunityExplanation: opportunityEx ? opportunityEx.explanation : null,
    tradePlanExplanation: tradePlanEx ? tradePlanEx.explanation : null,

    directionBias,
    direction,
    directionWord: directionWord(direction),
    setup,
    timeframe,

    keyLevels: levels,
    entryExplanation: explainEntry(levels, direction),
    stopExplanation: explainStop(levels),
    targetExplanation: explainTargets(levels),
    riskRewardExplanation: explainRiskReward(levels, direction),

    risks,
    warnings,
    conflicts,

    confidence,
    confidenceExplanation,

    dataAvailability: buildDataAvailability(sources),
    dataCompleteness: dataCompleteness != null ? dataCompleteness : 0,

    provenance,
    limitations: buildLimitations(sources),
    disclaimer: "C9 AI Explanation is derived only from existing B1-B6, C7, and C8 outputs — not a buy/sell recommendation. No price levels, targets, or confidence values are fabricated. Missing evidence remains null.",
  };
}

// ============================================================================
// RANKING
// Deterministic: score DESC -> dataCompleteness DESC -> confidence DESC -> symbol ASC.
// Uses C7/C8 scores when present; explanation-only ranking otherwise.
// ============================================================================
function rankExplanations(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [], ranking: { method: "explanation_score", total: 0 } };
  }
  const sorted = [...results].sort((a, b) => {
    const sa = n(a.opportunityScore ?? a.planScore ?? a.score) ?? -1;
    const sb = n(b.opportunityScore ?? b.planScore ?? b.score) ?? -1;
    if (sa === -1 && sb !== -1) return 1;
    if (sb === -1 && sa !== -1) return -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    const ca = n(a.confidence && a.confidence.score) ?? 0;
    const cb = n(b.confidence && b.confidence.score) ?? 0;
    if (cb !== ca) return cb - ca;
    const symA = (a.symbol || "").toString();
    const symB = (b.symbol || "").toString();
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
      method: "opportunity_or_plan_score_desc_then_dataCompleteness_confidence_alpha",
      total: ranked.length,
      topCount: top.length,
      alternativesCount: alternatives.length,
    },
  };
}

function buildExplanationQualityBreakdown(results) {
  const breakdown = { TOP: 0, STRONG: 0, WATCH: 0, WEAK: 0, UNAVAILABLE: 0 };
  if (!Array.isArray(results)) return breakdown;
  for (const r of results) {
    const q = r && (r.quality || "UNAVAILABLE");
    if (breakdown[q] != null) breakdown[q]++;
    else breakdown.UNAVAILABLE++;
  }
  return breakdown;
}

function buildExplanationDataAvailability(results) {
  const availability = {
    pennyIntelligence: false,
    optionsIntelligence: false,
    institutionalRadar: false,
    swingIntelligence: false,
    earlyExplosion: false,
    catalystIntelligence: false,
    opportunityRanking: false,
    tradePlan: false,
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
  BULLISH,
  BEARISH,
  MIXED,
  WATCH,
  block,
  withStrength,
  directionWord,
  directionalSignal,
  sourceHasData,
  evidenceStrings,
  aggregateDataCompleteness,
  buildDataAvailability,
  resolveDirection,
  resolveTimeframe,
  normalizeTimeframe,
  normalizeDirection,
  explainPenny,
  explainOptions,
  explainInstitutional,
  explainSwing,
  explainExplosion,
  explainCatalyst,
  explainOpportunity,
  explainTradePlan,
  buildWhyNow,
  detectConflicts,
  aggregateRisks,
  buildWarnings,
  buildKeyLevels,
  explainEntry,
  explainStop,
  explainTargets,
  explainRiskReward,
  buildHeadline,
  buildSummary,
  buildThesis,
  splitEvidence,
  explainTechnical,
  explainMomentum,
  buildProvenance,
  preserveConfidence,
  explainConfidence,
  buildLimitations,
  defaultExplanation,
  buildAIExplanation,
  rankExplanations,
  buildExplanationQualityBreakdown,
  buildExplanationDataAvailability,
};

export default buildAIExplanation;
