/**
 * Swing Horizon Engine — 1-3 Month Opportunity Engine
 *
 * Deterministic, pure-function engine that classifies whether a stock has a
 * credible 1-3 month swing opportunity.
 *
 * NO NEW data providers. NO fabricated data. NO look-ahead.
 *
 * REUSES existing project layers:
 *   B4  — Swing Intelligence Manager (lib/swing-intelligence-manager.js)
 *   📐 Structure Intelligence (lib/structure-intelligence-manager.js)
 *   B6  — Catalyst Intelligence Manager (lib/catalyst-intelligence-manager.js)
 *   C10 — Market Regime Engine (lib/market-regime-engine.js)
 *   C8  — Trade Plan Engine (lib/trade-plan-engine.js)
 *
 * The engine consumes pre-built intelligence objects and synthesizes them into
 * a 1-3 month swing horizon evaluation. It does NOT recalculate technical
 * indicators or re-run provider calls.
 *
 * HORIZON METHODOLOGY:
 *   1-3 months ≈ 21-63 trading days. The engine favors:
 *     - Developing trends with healthy MA alignment
 *     - Structural continuation (HH/HL, LH/LL)
 *     - Constructive pullbacks to demand/support
 *     - Breakouts with measured upside room
 *     - Catalysts with sufficient time horizon (not same-day events)
 *     - Favorable risk/reward (R/R >= 1.5)
 *
 * Anti-pattern protection:
 *     - Same-day momentum spikes are NOT 1-3 month setups
 *     - Intraday noise does not override daily structure
 *     - Missing evidence ≠ bullish evidence
 */

import {
  buildSwingIntelligence,
  defaultSwingIntelligence,
  rankSwingOpportunities,
} from './swing-intelligence.js';
import {
  buildStructureIntelligence,
  defaultStructureIntelligence,
  STRUCTURE_STATE,
} from './structure-intelligence-manager.js';
import {
  buildCatalystIntelligence,
  defaultCatalystIntelligence,
} from './catalyst-intelligence.js';
import {
  buildMarketRegime,
  defaultMarketRegime,
  classifyRegime,
  classifyRegimeConfidence,
} from './market-regime-engine.js';
import {
  buildOpportunityRanking,
  defaultOpportunityRanking,
  extractSwingScore,
  extractDataCompleteness,
  calculateConfidence,
  classifyConfidence,
  calculateOpportunityScore,
} from './opportunity-ranking.js';

const HORIZON = Object.freeze({
  SWING: 'SWING',
  SHORT: 'SHORT',
  POSITION: 'POSITION',
});

const SWING_HORIZON_LABEL = '1_3_MONTHS';

const TREND_DIRECTION = Object.freeze({
  BULLISH: 'BULLISH',
  EARLY_BULLISH: 'EARLY_BULLISH',
  NEUTRAL: 'NEUTRAL',
  EARLY_BEARISH: 'EARLY_BEARISH',
  BEARISH: 'BEARISH',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

const SWING_STATUS = Object.freeze({
  FAVORABLE: 'FAVORABLE',
  WATCH: 'WATCH',
  EXTENDED: 'EXTENDED',
  HIGH_RISK: 'HIGH_RISK',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

const SWING_QUALITY = Object.freeze({
  EXCEPTIONAL: 'EXCEPTIONAL',
  STRONG: 'STRONG',
  GOOD: 'GOOD',
  WATCH: 'WATCH',
  WEAK: 'WEAK',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

const SETUP_CLASSIFICATION = Object.freeze({
  EARLY_TREND: 'EARLY_TREND',
  TREND_CONTINUATION: 'TREND_CONTINUATION',
  PULLBACK_TO_DEMAND: 'PULLBACK_TO_DEMAND',
  BREAKOUT_SETUP: 'BREAKOUT_SETUP',
  BREAKOUT_CONFIRMED: 'BREAKOUT_CONFIRMED',
  ACCUMULATION: 'ACCUMULATION',
  REACCUMULATION: 'REACCUMULATION',
  RANGE_BREAK: 'RANGE_BREAK',
  EXTENDED: 'EXTENDED',
  HIGH_RISK: 'HIGH_RISK',
  INVALID: 'INVALID',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

const SWING_WEIGHTS = Object.freeze({
  trend: 0.20,
  structure: 0.15,
  momentum: 0.15,
  supplyDemand: 0.15,
  catalyst: 0.10,
  riskReward: 0.10,
  marketRegime: 0.05,
  dataQuality: 0.10,
});

const SWING_QUALITY_THRESHOLDS = Object.freeze({
  EXCEPTIONAL: 85,
  STRONG: 70,
  GOOD: 55,
  WATCH: 40,
  WEAK: 25,
});

const SWING_STATUS_THRESHOLDS = Object.freeze({
  FAVORABLE: 70,
  WATCH: 45,
  EXTENDED: 25,
});

function n(value) {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function clamp(value, min = 0, max = 100) {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  const v = n(value);
  return v != null ? Number(v.toFixed(decimals)) : null;
}

function nowISO() {
  return new Date().toISOString();
}

function pctChange(current, base) {
  const c = n(current);
  const b = n(base);
  if (c == null || b == null || b === 0) return null;
  return ((c - b) / b) * 100;
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

// ============================================================================
// TREND INTELLIGENCE — 1-3 month horizon specific
// ============================================================================

/**
 * Assess trend direction and maturity for a 1-3 month horizon.
 *
 * Reuses daily SMA20/50/200 from existing Swing Intelligence.
 * If weekly closes are available, incorporates weekly context.
 *
 * Classification:
 *   - BULLISH: price > SMA50 > SMA200, confirmed higher highs/lows
 *   - EARLY_BULLISH: price > SMA50 but SMA50 not yet > SMA200, or recent reversal
 *   - NEUTRAL: mixed / sideways
 *   - EARLY_BEARISH: price < SMA50 but SMA50 not yet < SMA200
 *   - BEARISH: price < SMA50 < SMA200, confirmed lower highs/lows
 *   - INSUFFICIENT_DATA: < 50 bars or missing MAs
 */
function assessTrend(swingData, structureData, weeklyData = null) {
  const price = n(swingData?.price);
  const sma20 = n(swingData?.sma20);
  const sma50 = n(swingData?.sma50);
  const sma200 = n(swingData?.sma200);

  if (price == null || sma50 == null) {
    return {
      direction: TREND_DIRECTION.INSUFFICIENT_DATA,
      strength: null,
      maturity: 'UNKNOWN',
      maAlignment: null,
      reasons: ['Insufficient MA data for trend assessment'],
    };
  }

  const reasons = [];
  const aboveSMA20 = sma20 != null && price > sma20;
  const aboveSMA50 = price > sma50;
  const aboveSMA200 = sma200 != null && price > sma200;
  const sma20AboveSMA50 = sma20 != null && sma50 != null && sma20 > sma50;
  const sma50AboveSMA200 = sma50 != null && sma200 != null && sma50 > sma200;
  const smaStackAligned = aboveSMA20 && aboveSMA50 && (sma200 == null || aboveSMA200) && sma20AboveSMA50 && sma50AboveSMA200;

  const structureBias = structureData?.structureBias;
  const higherHighs = structureData?.marketStructure?.higherHighs || false;
  const higherLows = structureData?.marketStructure?.higherLows || false;
  const lowerHighs = structureData?.marketStructure?.lowerHighs || false;
  const lowerLows = structureData?.marketStructure?.lowerLows || false;

  let direction;
  let maturity;

  if (aboveSMA50 && sma50AboveSMA200 && higherHighs && higherLows) {
    direction = TREND_DIRECTION.BULLISH;
    maturity = 'ESTABLISHED';
    reasons.push('Price above SMA50/SMA200 with HH/HL structure');
    if (smaStackAligned) reasons.push('Full MA stack aligned bullish');
  } else if (aboveSMA50 && sma50AboveSMA200 && !lowerHighs && !lowerLows) {
    direction = TREND_DIRECTION.BULLISH;
    maturity = 'ESTABLISHED';
    reasons.push('Price above SMA50/SMA200');
  } else if (aboveSMA50 && sma200 != null && !sma50AboveSMA200) {
    direction = TREND_DIRECTION.EARLY_BULLISH;
    maturity = 'EMERGING';
    reasons.push('Price above SMA50 but SMA50 not yet above SMA200');
  } else if (aboveSMA50 && sma50AboveSMA200 && (lowerHighs || lowerLows)) {
    direction = TREND_DIRECTION.EARLY_BEARISH;
    maturity = 'TRANSITIONAL';
    reasons.push('Uptrend showing structural weakness');
  } else if (!aboveSMA50 && sma200 != null && price > sma200) {
    direction = TREND_DIRECTION.NEUTRAL;
    maturity = 'SIDEWAYS';
    reasons.push('Price above SMA200 but below SMA50 — mixed trend signals');
  } else if (!aboveSMA50 && sma200 != null && price < sma200 && lowerHighs && lowerLows) {
    direction = TREND_DIRECTION.BEARISH;
    maturity = 'ESTABLISHED';
    reasons.push('Price below SMA50/SMA200 with LH/LL structure');
  } else if (!aboveSMA50 && sma200 != null && price < sma200 && !higherHighs && !higherLows) {
    direction = TREND_DIRECTION.EARLY_BEARISH;
    maturity = 'EMERGING';
    reasons.push('Price below SMA50 but recent downtrend structure');
  } else if (!aboveSMA50 && sma200 != null) {
    direction = TREND_DIRECTION.BEARISH;
    maturity = 'ESTABLISHED';
    reasons.push('Price below SMA50 below SMA200');
  } else if (!aboveSMA50 && sma200 == null) {
    direction = TREND_DIRECTION.EARLY_BEARISH;
    maturity = 'EMERGING';
    reasons.push('Price below SMA50 (SMA200 unavailable)');
  } else {
    direction = TREND_DIRECTION.NEUTRAL;
    maturity = 'SIDEWAYS';
    reasons.push('Mixed trend signals');
  }

  let strength = 50;
  if (direction === TREND_DIRECTION.BULLISH && maturity === 'ESTABLISHED') strength = 75;
  else if (direction === TREND_DIRECTION.BULLISH && maturity === 'EMERGING') strength = 60;
  else if (direction === TREND_DIRECTION.BEARISH && maturity === 'ESTABLISHED') strength = 75;
  else if (direction === TREND_DIRECTION.BEARISH && maturity === 'EMERGING') strength = 60;
  else if (direction === TREND_DIRECTION.EARLY_BULLISH) strength = 55;
  else if (direction === TREND_DIRECTION.EARLY_BEARISH) strength = 55;
  else strength = 40;

  const maAlignment = smaStackAligned
    ? 'FULLY_ALIGNED'
    : aboveSMA50 && sma50AboveSMA200
    ? 'BULLISH_ALIGNED'
    : !aboveSMA50 && sma200 != null && price < sma200
    ? 'BEARISH_ALIGNED'
    : 'MIXED';

  if (weeklyData && weeklyData.closes && weeklyData.closes.length >= 10) {
    const weeklyCloses = safeArray(weeklyData.closes).map(n).filter(v => v != null);
    if (weeklyCloses.length >= 5) {
      const weeklySma50 = sma(weeklyCloses, 5);
      const weeklyPrice = weeklyCloses[weeklyCloses.length - 1];
      if (weeklySma50 != null && weeklyPrice > weeklySma50) {
        if (direction === TREND_DIRECTION.BULLISH) strength = clamp(strength + 10);
        reasons.push('Weekly trend confirms daily bullish');
      } else if (weeklySma50 != null && weeklyPrice < weeklySma50) {
        if (direction === TREND_DIRECTION.BEARISH) strength = clamp(strength + 10);
        reasons.push('Weekly trend confirms daily bearish');
      }
    }
  }

  return {
    direction,
    strength: clamp(strength),
    maturity,
    maAlignment,
    reasons,
  };
}

// ============================================================================
// MOMENTUM INTELLIGENCE
// ============================================================================

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const valid = values.slice(-period).map(n).filter(v => v != null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function rsiFromCloses(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  const valid = closes.slice(-period - 1).map(n).filter(v => v != null);
  if (valid.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = valid[i] - valid[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < valid.length; i++) {
    const delta = valid[i] - valid[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

/**
 * Assess momentum for a 1-3 month horizon.
 *
 * For a 1-3 month horizon, we look at ~20-50 day momentum context.
 * Short-term spikes are not weighted heavily.
 */
function assessMomentum(swingData, marketData = null) {
  const rsi = n(swingData?.rsi);
  const momentumPercent = n(swingData?.momentumPercent);
  const relativeVolume = n(swingData?.relativeVolume);
  const momentumScore = n(swingData?.momentumScore);

  const reasons = [];
  const risks = [];

  let score = 50;
  let direction = 'NEUTRAL';

  if (rsi != null) {
    if (rsi >= 45 && rsi <= 65) {
      score += 20;
      direction = momentumPercent != null && momentumPercent > 0 ? 'UPTREND' : 'NEUTRAL';
      reasons.push(`RSI ${round(rsi)} in healthy neutral range`);
    } else if (rsi >= 65 && rsi <= 75) {
      score += 10;
      direction = 'UPTREND';
      reasons.push(`RSI ${round(rsi)} elevated but not overbought`);
    } else if (rsi > 75 && rsi <= 80) {
      score = clamp(score - 5);
      direction = 'UPTREND';
      risks.push('RSI overbought');
      reasons.push(`RSI ${round(rsi)} overbought`);
    } else if (rsi > 80) {
      score = clamp(score - 20);
      direction = 'EXTENDED';
      risks.push('RSI severely overbought');
      reasons.push(`RSI ${round(rsi)} severely overbought`);
    } else if (rsi >= 30 && rsi < 45) {
      score -= 10;
      direction = 'DOWNTREND';
      reasons.push(`RSI ${round(rsi)} in oversold-adjacent zone`);
    } else if (rsi < 30 && rsi >= 20) {
      score -= 20;
      direction = 'OVERSOLD';
      risks.push('RSI oversold');
      reasons.push(`RSI ${round(rsi)} oversold`);
    } else {
      score = clamp(score - 30);
      direction = 'OVERSOLD';
      risks.push('RSI deeply oversold');
      reasons.push(`RSI ${round(rsi)} deeply oversold`);
    }
  }

  if (momentumPercent != null && momentumPercent > 5) {
    score += 10;
    reasons.push(`30-day momentum ${round(momentumPercent)}% positive`);
  } else if (momentumPercent != null && momentumPercent < -5) {
    score -= 10;
    reasons.push(`30-day momentum ${round(momentumPercent)}% negative`);
  }

  if (relativeVolume != null && relativeVolume >= 1.2) {
    score += 10;
    reasons.push(`Relative volume ${round(relativeVolume)}x confirms momentum`);
  } else if (relativeVolume != null && relativeVolume < 0.8) {
    score -= 10;
    risks.push('Low relative volume');
    reasons.push(`Relative volume ${round(relativeVolume)}x weak`);
  }

  if (momentumScore != null) {
    score = clamp((score + momentumScore) / 2);
  }

  const strength = rsi >= 45 && rsi <= 65 ? 'HEALTHY' : rsi > 75 ? 'EXTENDED' : rsi < 30 ? 'WEAK' : 'MODERATE';

  return {
    direction,
    strength,
    score: round(clamp(score)),
    rsi,
    momentumPercent,
    relativeVolume,
    reasons,
    risks,
  };
}

// ============================================================================
// SUPPLY / DEMAND INTEGRATION
// ============================================================================

/**
 * Consume Structure Intelligence zones + Swing Intelligence support/resistance.
 * Calculate distance from current price to nearest supply/demand.
 */
function assessSupplyDemand(structureData, swingData) {
  const price = n(swingData?.price);

  const supplyZones = structureData?.supplyZones || [];
  const demandZones = structureData?.demandZones || [];

  const swingResistance = n(swingData?.resistance);
  const swingSupport = n(swingData?.support);
  const srr = n(swingData?.riskReward);

  const reasons = [];
  const risks = [];

  const supplyLevels = supplyZones.map(z => n(z.level)).filter(v => v != null);
  if (swingResistance != null) supplyLevels.push(swingResistance);
  const uniqueSupply = [...new Set(supplyLevels)].sort((a, b) => a - b);
  const nearestSupply = price != null && uniqueSupply.length > 0
    ? uniqueSupply.find(s => s > price) || (uniqueSupply[uniqueSupply.length - 1] > price ? null : uniqueSupply[uniqueSupply.length - 1])
    : null;

  const demandLevels = demandZones.map(z => n(z.level)).filter(v => v != null);
  if (swingSupport != null) demandLevels.push(swingSupport);
  const uniqueDemand = [...new Set(demandLevels)].sort((a, b) => a - b);
  const nearestDemand = price != null && uniqueDemand.length > 0
    ? uniqueDemand.findLast(d => d < price) || (uniqueDemand[0] < price ? null : uniqueDemand[0])
    : null;

  const distanceToSupply = price != null && nearestSupply != null
    ? pctChange(nearestSupply, price)
    : null;
  const distanceToDemand = price != null && nearestDemand != null
    ? pctChange(price, nearestDemand)
    : null;

  if (distanceToSupply != null && distanceToSupply > 0) {
    const pct = Math.abs(distanceToSupply);
    if (pct < 3) {
      risks.push(`Close to supply (${round(pct)}%)`);
      reasons.push(`Near supply zone (${round(pct)}% to resistance)`);
    } else if (pct >= 3 && pct <= 10) {
      reasons.push(`Reasonable room to supply (${round(pct)}%)`);
    } else if (pct > 10) {
      reasons.push(`Significant upside room (${round(pct)}% to supply)`);
    }
  }

  if (distanceToDemand != null && distanceToDemand >= 0) {
    const pct = distanceToDemand;
    if (pct < 2) {
      reasons.push(`Supported by demand (${round(pct)}% above support)`);
    } else if (pct >= 2 && pct <= 8) {
      reasons.push(`Above demand zone (${round(pct)}%)`);
    }
  }

  if (srr != null) {
    if (srr >= 3) reasons.push(`Favorable risk/reward (R/R ${round(srr)})`);
    else if (srr < 1.5) {
      risks.push(`Suboptimal risk/reward (R/R ${round(srr)})`);
    }
  }

  return {
    supplyZones,
    demandZones,
    nearestSupply,
    nearestDemand,
    distanceToSupply: distanceToSupply != null ? round(Math.abs(distanceToSupply)) : null,
    distanceToDemand: distanceToDemand != null ? round(distanceToDemand) : null,
    riskReward: srr != null ? round(srr) : null,
    reasons,
    risks,
  };
}

// ============================================================================
// CATALYST TIMING ANALYSIS — 1-3 Month Horizon
// ============================================================================

/**
 * Evaluate catalyst relevance for 1-3 month horizon.
 * A catalyst is relevant if its timing window overlaps 1-3 months.
 *
 * Reuses existing B6 Catalyst Intelligence.
 */
function assessCatalysts(catalystData) {
  if (!catalystData || catalystData.quality === 'UNAVAILABLE') {
    return {
      available: false,
      relevant: false,
      score: null,
      timing: 'UNKNOWN',
      strength: null,
      reasons: ['No catalyst evidence available'],
      risks: ['No verified catalysts — thesis not catalyst-supported'],
    };
  }

  const catalysts = catalystData.catalysts || [];
  const catalystScore = n(catalystData.catalystScore);
  const quality = catalystData.quality;

  const now = Date.now();
  const relevantCatalysts = catalysts.filter(c => {
    const d = c.daysToEvent;
    return d != null && d >= -30 && d <= 90;
  });

  const reasons = [];
  const risks = [];

  if (catalysts.length === 0) {
    risks.push('No catalysts detected');
    return {
      available: false,
      relevant: false,
      score: null,
      timing: 'NONE',
      strength: null,
      reasons: ['No catalyst evidence available'],
      risks,
    };
  }

  if (relevantCatalysts.length > 0) {
    reasons.push(`${relevantCatalysts.length} catalysts within 1-3 month window`);
  }

  if (catalystScore != null) {
    if (catalystScore >= 70) {
      reasons.push(`Strong catalyst score (${catalystScore})`);
    } else if (catalystScore >= 40) {
      reasons.push(`Moderate catalyst score (${catalystScore})`);
    } else {
      risks.push(`Weak catalyst score (${catalystScore})`);
    }
  }

  const timing = relevantCatalysts.length > 0
    ? relevantCatalysts[0].daysToEvent >= 0 ? 'UPCOMING' : 'RECENT'
    : 'NONE';

  return {
    available: catalysts.length > 0,
    relevant: relevantCatalysts.length > 0,
    score: catalystScore,
    quality,
    catalystCount: catalysts.length,
    relevantCount: relevantCatalysts.length,
    timing,
    strength: catalystScore != null ? (catalystScore >= 70 ? 'STRONG' : catalystScore >= 40 ? 'MODERATE' : 'WEAK') : null,
    reasons,
    risks,
  };
}

// ============================================================================
// RISK / REWARD
// ============================================================================

/**
 * Synthesize risk/reward for 1-3 month horizon.
 *
 * Reuses entry/stop/target from Swing Intelligence + zones from
 * Structure Intelligence. If either is missing, returns insufficient.
 */
function assessRiskReward(swingData, structureData) {
  const entryZone = swingData?.zones?.entryZone || swingData?.entryZone;
  const target1 = n(swingData?.zones?.target1 || swingData?.target1);
  const target2 = n(swingData?.zones?.target2);
  const invalidation = n(swingData?.zones?.invalidation || swingData?.invalidation);
  const riskReward = n(swingData?.riskReward);
  const riskPercent = n(swingData?.zones?.riskPercent || swingData?.riskPercent);
  const rewardPercent = n(swingData?.zones?.rewardPercent || swingData?.rewardPercent);

  const price = n(swingData?.price);

  if (price == null || price <= 0) {
    return {
      entry: null,
      stop: null,
      target: target1,
      upsidePct: null,
      downsidePct: null,
      rewardRisk: null,
      reasons: ['Insufficient price data for risk/reward'],
      risks: ['No price for R/R calculation'],
    };
  }

  const reasons = [];
  const risks = [];

  let rr = riskReward;
  if (rr == null && target1 != null && invalidation != null && price > invalidation) {
    const reward = target1 - price;
    const risk = price - invalidation;
    rr = risk > 0 ? reward / risk : null;
  }

  if (rr != null) {
    if (rr >= 3) reasons.push(`Excellent R/R (${round(rr)}x)`);
    else if (rr >= 2) reasons.push(`Good R/R (${round(rr)}x)`);
    else if (rr >= 1.5) reasons.push(`Adequate R/R (${round(rr)}x)`);
    else {
      risks.push(`Suboptimal R/R (${round(rr)}x)`);
      reasons.push(`Low R/R (${round(rr)}x)`);
    }
  } else {
    risks.push('No risk/reward available');
  }

  const upsidePct = target1 != null ? pctChange(target1, price) : null;
  const downsidePct = invalidation != null ? pctChange(invalidation, price) : null;

  if (upsidePct != null && upsidePct < 5) {
    risks.push('Limited upside (< 5%)');
  }

  return {
    entry: entryZone || null,
    stop: invalidation != null ? round(invalidation) : null,
    target: target1,
    target2: target2 != null ? round(target2) : null,
    upsidePct: upsidePct != null ? round(upsidePct) : null,
    downsidePct: downsidePct != null ? round(Math.abs(downsidePct)) : null,
    rewardRisk: rr != null ? round(rr, 1) : null,
    riskPercent: riskPercent != null ? round(riskPercent) : null,
    rewardPercent: rewardPercent != null ? round(rewardPercent) : null,
    reasons,
    risks,
  };
}

// ============================================================================
// SETUP CLASSIFICATION
// ============================================================================

/**
 * Classify the 1-3 month swing setup.
 */
function classifySetup(trendResult, momentumResult, supplyDemandResult, structureData, swingData) {
  const { direction, maturity, strength } = trendResult;
  const momentumScore = n(momentumResult?.score);
  const supplyDemand = supplyDemandResult;
  const structureState = structureData?.structureState;
  const mssDetected = structureData?.marketStructure?.mssDetected;
  const rr = n(supplyDemandResult?.rewardRisk);
  const relativeVolume = n(swingData?.relativeVolume);

  const reasons = [];

  if (direction === TREND_DIRECTION.INSUFFICIENT_DATA) {
    return { classification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA, reasons: ['Insufficient trend data'] };
  }

  const bullishTrend = direction === TREND_DIRECTION.BULLISH || direction === TREND_DIRECTION.EARLY_BULLISH;
  const bearishTrend = direction === TREND_DIRECTION.BEARISH || direction === TREND_DIRECTION.EARLY_BEARISH;

  if (mssDetected) {
    if (bullishTrend) {
      reasons.push('Bullish MSS detected in uptrend');
      return {
        classification: SETUP_CLASSIFICATION.BREAKOUT_SETUP,
        reasons,
      };
    }
    if (bearishTrend) {
      reasons.push('Bearish MSS detected in downtrend');
      return {
        classification: SETUP_CLASSIFICATION.BREAKOUT_SETUP,
        reasons,
      };
    }
  }

  if (structureState === STRUCTURE_STATE.BULLISH_CONTINUATION && bullishTrend) {
    if (maturity === 'ESTABLISHED') {
      if (relativeVolume != null && relativeVolume < 0.8) {
        reasons.push('Established uptrend with lower volume');
        return { classification: SETUP_CLASSIFICATION.HIGH_RISK, reasons };
      }
      reasons.push('Bullish trend continuation with HH/HL structure');
      if (rr != null && rr >= 2) {
        reasons.push('Favorable risk/reward in continuation setup');
        return { classification: SETUP_CLASSIFICATION.TREND_CONTINUATION, reasons };
      }
      return { classification: SETUP_CLASSIFICATION.TREND_CONTINUATION, reasons };
    }
  }

  if (structureState === STRUCTURE_STATE.BEARISH_CONTINUATION && bearishTrend) {
    if (maturity === 'ESTABLISHED') {
      reasons.push('Bearish trend continuation with LH/LL structure');
      return { classification: SETUP_CLASSIFICATION.TREND_CONTINUATION, reasons };
    }
  }

  if (maturity === 'EMERGING') {
    if (bullishTrend) {
      if (momentumScore != null && momentumScore >= 50) {
        reasons.push('Early bullish trend with constructive momentum');
        return { classification: SETUP_CLASSIFICATION.EARLY_TREND, reasons };
      }
    }
    if (bearishTrend) {
      reasons.push('Early bearish trend');
      return { classification: SETUP_CLASSIFICATION.EARLY_TREND, reasons };
    }
  }

  if (bullishTrend && maturity === 'ESTABLISHED' && rr != null && rr >= 2) {
    const distToSupply = supplyDemand?.distanceToSupply;
    if (distToSupply != null && distToSupply > 5) {
      reasons.push('Pullback in uptrend with room to supply');
      return { classification: SETUP_CLASSIFICATION.PULLBACK_TO_DEMAND, reasons };
    }
  }

  if (structureState === STRUCTURE_STATE.RANGE || structureState === STRUCTURE_STATE.ACCUMULATION) {
    if (mssDetected) {
      reasons.push('Range breakout potential');
      return { classification: SETUP_CLASSIFICATION.RANGE_BREAK, reasons };
    }
    if (bullishTrend) {
      reasons.push('Accumulation phase in uptrend');
      return { classification: SETUP_CLASSIFICATION.ACCUMULATION, reasons };
    }
    if (bearishTrend) {
      reasons.push('Reaccumulation in downtrend');
      return { classification: SETUP_CLASSIFICATION.REACCUMULATION, reasons };
    }
    reasons.push('Range-bound consolidation');
    return { classification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA, reasons };
  }

  if (structureState === STRUCTURE_STATE.BULLISH_CONTINUATION && bullishTrend && maturity === 'ESTABLISHED') {
    if (rr != null && rr >= 2.5) {
      reasons.push('Confirmed bullish breakout with strong R/R');
      return { classification: SETUP_CLASSIFICATION.BREAKOUT_CONFIRMED, reasons };
    }
  }

  if (maturity === 'TRANSITIONAL' || structureState === STRUCTURE_STATE.TRANSITION) {
    reasons.push('Structure in transition');
    return { classification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA, reasons };
  }

  if (strength != null && strength < 40) {
    reasons.push('Weak trend strength');
    return { classification: SETUP_CLASSIFICATION.INVALID, reasons };
  }

  reasons.push('Mixed signals — setup unclear');
  return { classification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA, reasons };
}

// ============================================================================
// SWING SCORE
// ============================================================================

function calculateSwingHorizonScore(inputs) {
  const components = [];

  const trendStrength = n(inputs.trendStrength);
  if (trendStrength != null) {
    components.push({ score: trendStrength, weight: SWING_WEIGHTS.trend });
  }

  const structureScore = n(inputs.structureScore);
  if (structureScore != null) {
    components.push({ score: structureScore, weight: SWING_WEIGHTS.structure });
  }

  const momentumScoreVal = n(inputs.momentumScore);
  if (momentumScoreVal != null) {
    components.push({ score: momentumScoreVal, weight: SWING_WEIGHTS.momentum });
  }

  const supplyDemandScore = n(inputs.supplyDemandScore);
  if (supplyDemandScore != null) {
    components.push({ score: supplyDemandScore, weight: SWING_WEIGHTS.supplyDemand });
  }

  const catalystScore = n(inputs.catalystScore);
  if (catalystScore != null) {
    components.push({ score: catalystScore, weight: SWING_WEIGHTS.catalyst });
  }

  const rr = n(inputs.rewardRisk);
  if (rr != null) {
    const rrScore = clamp(rr * 25, 0, 100);
    components.push({ score: rrScore, weight: SWING_WEIGHTS.riskReward });
  }

  const regimeAlignment = n(inputs.regimeAlignment);
  if (regimeAlignment != null) {
    components.push({ score: regimeAlignment, weight: SWING_WEIGHTS.marketRegime });
  }

  const dataCompleteness = n(inputs.dataCompleteness);
  if (dataCompleteness != null) {
    components.push({ score: dataCompleteness, weight: SWING_WEIGHTS.dataQuality });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

function classifySwingQuality(score) {
  if (score == null) return SWING_QUALITY.INSUFFICIENT_DATA;
  if (score >= SWING_QUALITY_THRESHOLDS.EXCEPTIONAL) return SWING_QUALITY.EXCEPTIONAL;
  if (score >= SWING_QUALITY_THRESHOLDS.STRONG) return SWING_QUALITY.STRONG;
  if (score >= SWING_QUALITY_THRESHOLDS.GOOD) return SWING_QUALITY.GOOD;
  if (score >= SWING_QUALITY_THRESHOLDS.WATCH) return SWING_QUALITY.WATCH;
  if (score >= SWING_QUALITY_THRESHOLDS.WEAK) return SWING_QUALITY.WEAK;
  return SWING_QUALITY.WEAK;
}

function classifySwingStatus(score) {
  if (score == null) return SWING_STATUS.INSUFFICIENT_DATA;
  if (score >= SWING_STATUS_THRESHOLDS.FAVORABLE) return SWING_STATUS.FAVORABLE;
  if (score >= SWING_STATUS_THRESHOLDS.WATCH) return SWING_STATUS.WATCH;
  if (score >= SWING_STATUS_THRESHOLDS.EXTENDED) return SWING_STATUS.EXTENDED;
  return SWING_STATUS.HIGH_RISK;
}

// ============================================================================
// REGIME ALIGNMENT
// ============================================================================

function assessRegimeAlignment(marketRegime, trendDirection) {
  if (!marketRegime || marketRegime.regimeType === 'UNAVAILABLE') {
    return {
      alignment: 'UNAVAILABLE',
      score: null,
      reasons: ['Market regime unavailable'],
    };
  }

  const regime = marketRegime.regimeType;
  const reasons = [];
  let score = 50;
  let alignment = 'NEUTRAL';

  if (trendDirection === TREND_DIRECTION.BULLISH || trendDirection === TREND_DIRECTION.EARLY_BULLISH) {
    if (regime === 'BULLISH' || regime === 'NEUTRAL') {
      alignment = 'FAVORABLE';
      score = 75;
      reasons.push(`Bullish setup in ${regime} regime`);
    } else if (regime === 'RISK_OFF' || regime === 'BEARISH') {
      alignment = 'UNFAVORABLE';
      score = 25;
      reasons.push(`Bullish setup conflicts with ${regime} regime`);
    }
  } else if (trendDirection === TREND_DIRECTION.BEARISH || trendDirection === TREND_DIRECTION.EARLY_BEARISH) {
    if (regime === 'BEARISH' || regime === 'RISK_OFF') {
      alignment = 'FAVORABLE';
      score = 75;
      reasons.push(`Bearish setup in ${regime} regime`);
    } else if (regime === 'BULLISH') {
      alignment = 'UNFAVORABLE';
      score = 25;
      reasons.push(`Bearish setup conflicts with BULLISH regime`);
    }
  }

  return { alignment, score, reasons };
}

// ============================================================================
// THESIS GENERATION
// ============================================================================

function generateThesis(trendResult, momentumResult, supplyDemandResult, setupResult, catalystResult) {
  const parts = [];
  const { direction, maturity, strength } = trendResult;

  if (direction === TREND_DIRECTION.BULLISH) {
    parts.push(`Daily trend is bullish (${maturity}),`);
  } else if (direction === TREND_DIRECTION.EARLY_BULLISH) {
    parts.push(`Early bullish trend emerging,`);
  } else if (direction === TREND_DIRECTION.BEARISH) {
    parts.push(`Daily trend is bearish (${maturity}),`);
  } else if (direction === TREND_DIRECTION.EARLY_BEARISH) {
    parts.push(`Early bearish trend emerging,`);
  } else if (direction === TREND_DIRECTION.NEUTRAL) {
    parts.push(`Trend is neutral/sideways,`);
  } else {
    parts.push(`Trend data insufficient,`);
  }

  parts.push(`setup classified as ${setupResult.classification},`);

  if (momentumResult.score != null) {
    if (momentumResult.score >= 60) parts.push('momentum is constructive,');
    else if (momentumResult.score <= 40) parts.push('momentum is weak,');
    else parts.push('momentum is moderate,');
  }

  const rr = supplyDemandResult.rewardRisk;
  if (rr != null) {
    if (rr >= 2.5) parts.push(`risk/reward is favorable (${round(rr)}x),`);
    else if (rr >= 1.5) parts.push(`risk/reward is acceptable (${round(rr)}x),`);
    else parts.push(`risk/reward is suboptimal (${round(rr)}x),`);
  }

  if (catalystResult.available) {
    if (catalystResult.relevant) {
      parts.push(`catalysts support the 1-3 month thesis.`);
    } else {
      parts.push(`catalysts within range but no direct 1-3 month drivers.`);
    }
  } else {
    parts.push('no catalysts — thesis not event-driven.');
  }

  return parts.join(' ').replace(/,\s*$/, '.');
}

// ============================================================================
// INVALIDATION
// ============================================================================

function generateInvalidation(trendResult, structureData, riskRewardResult, setupResult) {
  const conditions = [];

  if (trendResult.direction === TREND_DIRECTION.BULLISH) {
    if (structureData?.structureState) {
      conditions.push(`Loss of bullish structure (transition from ${structureData.structureState})`);
    }
    conditions.push('Close below key moving average (SMA50)');
  } else if (trendResult.direction === TREND_DIRECTION.BEARISH) {
    conditions.push('Close above key moving average (SMA50)');
  }

  if (structureData?.marketStructure?.mssDetected !== undefined && structureData.marketStructure.mssDetected) {
    conditions.push('Bearish market structure shift (MSS)');
  }

  if (riskRewardResult.stop != null) {
    conditions.push(`Close below stop (${riskRewardResult.stop})`);
  }

  if (setupResult.classification === SETUP_CLASSIFICATION.BREAKOUT_SETUP) {
    conditions.push('Failure to hold above breakout level');
  }

  if (conditions.length === 0) {
    conditions.push('Insufficient evidence to define invalidation');
  }

  return conditions;
}

// ============================================================================
// KEY SIGNALS
// ============================================================================

function buildKeySignals(trendResult, momentumResult, structureData, setupResult, supplyDemandResult) {
  const signals = [];

  if (trendResult.direction !== TREND_DIRECTION.INSUFFICIENT_DATA) {
    signals.push({
      type: 'TREND',
      direction: trendResult.direction,
      strength: trendResult.strength,
      maturity: trendResult.maturity,
      source: 'swing-horizon',
    });
  }

  if (structureData?.signals && structureData.signals.length > 0) {
    for (const s of structureData.signals) {
      signals.push({ ...s, source: 'structure-intelligence' });
    }
  }

  if (momentumResult.score != null) {
    signals.push({
      type: 'MOMENTUM',
      score: momentumResult.score,
      direction: momentumResult.direction,
      rsi: momentumResult.rsi,
      source: 'swing-horizon',
    });
  }

  if (setupResult.classification !== SETUP_CLASSIFICATION.INSUFFICIENT_DATA
      && setupResult.classification !== SETUP_CLASSIFICATION.INVALID) {
    signals.push({
      type: 'SETUP',
      classification: setupResult.classification,
      source: 'swing-horizon',
    });
  }

  if (supplyDemandResult.riskReward != null) {
    signals.push({
      type: 'RISK_REWARD',
      rewardRisk: supplyDemandResult.riskReward,
      source: 'swing-horizon',
    });
  }

  return signals;
}

// ============================================================================
// RISK AGGREGATION
// ============================================================================

function aggregateRisks(trendResult, momentumResult, supplyDemandResult, catalystResult, regimeResult, setupResult) {
  const risks = [];

  if (momentumResult.risks) risks.push(...momentumResult.risks);
  if (supplyDemandResult.risks) risks.push(...supplyDemandResult.risks);
  if (catalystResult.risks) risks.push(...catalystResult.risks);
  if (regimeResult.risks) risks.push(...regimeResult.risks);

  if (setupResult.classification === SETUP_CLASSIFICATION.INVALID) {
    risks.push('Setup classified as invalid');
  }
  if (setupResult.classification === SETUP_CLASSIFICATION.HIGH_RISK) {
    risks.push('High-risk setup pattern');
  }

  return [...new Set(risks)];
}

// ============================================================================
// DEFAULT OUTPUTS
// ============================================================================

function defaultSwingHorizon(symbol = null) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    horizon: SWING_HORIZON_LABEL,
    swingScore: null,
    quality: SWING_QUALITY.INSUFFICIENT_DATA,
    setupClassification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA,
    swingStatus: SWING_STATUS.INSUFFICIENT_DATA,
    trend: {
      direction: TREND_DIRECTION.INSUFFICIENT_DATA,
      strength: null,
      maturity: 'UNKNOWN',
      maAlignment: null,
      reasons: [],
    },
    momentum: {
      direction: 'NEUTRAL',
      strength: null,
      score: null,
      rsi: null,
      momentumPercent: null,
      relativeVolume: null,
      reasons: [],
      risks: [],
    },
    structure: null,
    supplyDemand: {
      supplyZones: [],
      demandZones: [],
      nearestSupply: null,
      nearestDemand: null,
      distanceToSupply: null,
      distanceToDemand: null,
      riskReward: null,
      reasons: [],
      risks: [],
    },
    catalyst: {
      available: false,
      relevant: false,
      score: null,
      timing: 'NONE',
      strength: null,
      reasons: ['No catalyst evidence available'],
      risks: ['No verified catalysts — thesis not catalyst-supported'],
    },
    marketRegime: null,
    regimeAlignment: {
      alignment: 'UNAVAILABLE',
      score: null,
      reasons: ['Market regime unavailable'],
    },
    riskReward: {
      entry: null,
      stop: null,
      target: null,
      target2: null,
      upsidePct: null,
      downsidePct: null,
      rewardRisk: null,
      riskPercent: null,
      rewardPercent: null,
      reasons: [],
      risks: [],
    },
    setup: {
      classification: SETUP_CLASSIFICATION.INSUFFICIENT_DATA,
      reasons: [],
    },
    keySignals: [],
    invalidation: ['Insufficient evidence to define invalidation'],
    risks: ['No verified catalyst evidence'],
    thesis: 'Insufficient data to construct swing horizon thesis.',
    confidence: null,
    dataQuality: {
      completeness: 0,
      barCount: 0,
      hasSwingData: false,
      hasStructure: false,
      hasCatalyst: false,
      hasRegime: false,
      hasRiskReward: false,
    },
    dataStatus: 'unavailable',
    provenance: {
      swingIntelligence: 'B4 (swing-intelligence-manager.js)',
      structureIntelligence: '📐 Structure Intelligence (structure-intelligence-manager.js)',
      catalystIntelligence: 'B6 (catalyst-intelligence-manager.js)',
      marketRegime: 'C10 (market-regime-engine.js)',
      trend: 'swing-horizon.js',
      momentum: 'swing-horizon.js',
      supplyDemand: 'swing-horizon.js',
      riskReward: 'swing-horizon.js',
      score: 'swing-horizon.js',
      thesis: 'swing-horizon.js',
    },
    disclaimer:
      'Swing Horizon is a deterministic, evidence-based 1-3 month opportunity classification. ' +
      'It does NOT provide buy/sell recommendations. ' +
      'Structural liquidity and catalyst evidence are derived from price action and SEC EDGAR data. ' +
      'Missing data remains null — never fabricated. ' +
      'The Decision Engine (C7) remains the sole authority for HUNT_NOW/WATCH/IGNORE.',
  };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Build Swing Horizon Intelligence — 1-3 Month Opportunity Engine.
 *
 * Consumes pre-built intelligence objects (no network calls in this function).
 *
 * @param {Object} inputs
 * @param {Object} inputs.swingData — Output from swing-intelligence-manager.js (normalizeSwingIntelligence)
 * @param {Object} inputs.structureData — Output from structure-intelligence-manager.js (buildStructureIntelligence)
 * @param {Object} inputs.catalystData — Output from catalyst-intelligence-manager.js (buildCatalystIntelligenceManager)
 * @param {Object} inputs.marketRegime — Output from market-regime-engine.js (buildMarketRegime)
 * @param {Object} [inputs.marketData] — Raw market-data object from market-engine.js (for OHLCV arrays)
 * @param {Object} [inputs.weeklyData] — Optional weekly OHLCV for multi-timeframe context
 * @param {string} [inputs.symbol]
 * @param {string} [inputs.timeframe]
 * @returns {Object} Swing Horizon result
 */
function buildSwingHorizon(inputs = {}) {
  const {
    swingData = null,
    structureData = null,
    catalystData = null,
    marketRegime = null,
    marketData = null,
    weeklyData = null,
    symbol = null,
    timeframe = 'daily',
  } = inputs;

  const defaultResult = defaultSwingHorizon(symbol);
  if (!swingData && !structureData && !catalystData && !marketRegime && !marketData) {
    return defaultResult;
  }

  if (!swingData && !marketData) {
    return {
      ...defaultResult,
      symbol: symbol || null,
    };
  }

  let swing = swingData;
  if (!swing && marketData) {
    swing = buildSwingIntelligence(marketData);
  }

  if (!swing) {
    return {
      ...defaultResult,
      symbol: symbol || null,
    };
  }

  let structure = structureData;
  if (!structure && marketData && marketData.highs && marketData.lows && marketData.closes) {
    structure = buildStructureIntelligence({
      highs: marketData.highs || [],
      lows: marketData.lows || [],
      closes: marketData.closes || [],
      volumes: marketData.volumes || [],
      timestamps: marketData.timestamps || [],
      existingSupport: marketData.support20 || null,
      existingResistance: marketData.resistance20 || null,
      symbol: symbol || marketData.ticker || marketData.symbol,
      timeframe,
    });
  }

  if (!structure) {
    structure = defaultStructureIntelligence(symbol);
  }

  let catalyst = catalystData;
  if (!catalyst) {
    catalyst = defaultCatalystIntelligence(symbol);
  }

  let regime = marketRegime;
  let regimeAlignment = assessRegimeAlignment(regime, TREND_DIRECTION.INSUFFICIENT_DATA);

  // --- Trend ---
  const trend = assessTrend(swing, structure, weeklyData);

  // --- Update regime alignment with actual trend ---
  regimeAlignment = assessRegimeAlignment(regime, trend.direction);

  // --- Momentum ---
  const momentum = assessMomentum(swing, marketData);

  // --- Supply/Demand ---
  const supplyDemand = assessSupplyDemand(structure, swing);

  // --- Risk/Reward ---
  const riskReward = assessRiskReward(swing, structure);

  // --- Setup Classification ---
  const setup = classifySetup(trend, momentum, supplyDemand, structure, swing);

  // --- Catalyst Assessment ---
  const catalystAssessment = assessCatalysts(catalyst);

  // --- Key Signals ---
  const keySignals = buildKeySignals(trend, momentum, structure, setup, supplyDemand);

  // --- Risks ---
  const risks = aggregateRisks(trend, momentum, supplyDemand, catalystAssessment, regimeAlignment, setup);

  // --- Invalidation ---
  const invalidation = generateInvalidation(trend, structure, riskReward, setup);

  // --- Thesis ---
  const thesis = generateThesis(trend, momentum, supplyDemand, setup, catalystAssessment);

  // --- Scores for swing horizon score ---
  const structureScore = structure?.structureScore || structure?.confidence || null;
  const momentumScore = momentum.score;
  const supplyDemandScore = supplyDemand.riskReward != null
    ? clamp((supplyDemand.riskReward / 4) * 100, 0, 100)
    : null;
  const catalystScoreForHorizon = catalystAssessment.score;

  // --- Compute swing score ---
  const swingScore = calculateSwingHorizonScore({
    trendStrength: trend.strength,
    structureScore: structureScore != null ? clamp(structureScore) : null,
    momentumScore: momentumScore != null ? clamp(momentumScore) : null,
    supplyDemandScore,
    catalystScore: catalystScoreForHorizon != null ? clamp(catalystScoreForHorizon) : null,
    rewardRisk: riskReward.rewardRisk,
    regimeAlignment: regimeAlignment.score,
    dataCompleteness: null,
  });

  // --- Data Quality ---
  const dataCompleteness = Math.round(
    ([swing != null, structure != null, catalyst != null, regime != null, marketData != null]
      .filter(Boolean).length / 5) * 100
  );

  // Add to score if we have enough data
  let finalScore = swingScore;
  if (finalScore != null) {
    finalScore = clamp(Math.round((finalScore * 0.9 + dataCompleteness * 0.1)));
  }

  const quality = classifySwingQuality(finalScore);
  const swingStatus = classifySwingStatus(finalScore);

  // --- Confidence ---
  const confidenceScore = calculateSwingHorizonConfidence(
    trend.strength,
    structure?.confidence,
    momentumScore,
    supplyDemand.riskReward,
    catalystAssessment.score,
    dataCompleteness
  );
  const confidence = classifyConfidence(confidenceScore);

  return {
    symbol: symbol || swing?.symbol || null,
    timestamp: nowISO(),
    horizon: SWING_HORIZON_LABEL,
    swingScore: finalScore,
    quality,
    setupClassification: setup.classification,
    swingStatus,
    trend,
    momentum,
    structure,
    supplyDemand,
    catalyst: catalystAssessment,
    marketRegime: regime ? {
      regime: regime.regime,
      regimeScore: regime.regimeScore,
      confidence: regime.confidence,
      label: regime.regime,
    } : null,
    regimeAlignment,
    riskReward,
    setup,
    keySignals,
    invalidation,
    risks,
    thesis,
    confidence,
    dataQuality: {
      completeness: dataCompleteness,
      barCount: n(swing?.price != null ? 0 : null) || 0,
      hasSwingData: swing != null,
      hasStructure: structure != null,
      hasCatalyst: catalyst != null && catalyst.catalysts && catalyst.catalysts.length > 0,
      hasRegime: regime != null,
      hasRiskReward: riskReward.rewardRisk != null,
    },
    dataStatus: quality === SWING_QUALITY.INSUFFICIENT_DATA ? 'partial' : 'complete',
    componentWeights: {
      trend: SWING_WEIGHTS.trend * 100,
      structure: SWING_WEIGHTS.structure * 100,
      momentum: SWING_WEIGHTS.momentum * 100,
      supplyDemand: SWING_WEIGHTS.supplyDemand * 100,
      catalyst: SWING_WEIGHTS.catalyst * 100,
      riskReward: SWING_WEIGHTS.riskReward * 100,
      marketRegime: SWING_WEIGHTS.marketRegime * 100,
      dataQuality: SWING_WEIGHTS.dataQuality * 100,
    },
    provenance: {
      swingIntelligence: 'B4 (swing-intelligence-manager.js)',
      structureIntelligence: '📐 Structure Intelligence (structure-intelligence-manager.js)',
      catalystIntelligence: 'B6 (catalyst-intelligence-manager.js)',
      marketRegime: 'C10 (market-regime-engine.js)',
      trend: 'swing-horizon.js',
      momentum: 'swing-horizon.js',
      supplyDemand: 'swing-horizon.js',
      riskReward: 'swing-horizon.js',
      score: 'swing-horizon.js',
      thesis: 'swing-horizon.js',
    },
    disclaimer:
      'Swing Horizon is a deterministic, evidence-based 1-3 month opportunity classification. ' +
      'It does NOT provide buy/sell recommendations. ' +
      'Structural liquidity and catalyst evidence are derived from price action and SEC EDGAR data. ' +
      'Missing data remains null — never fabricated. ' +
      'The Decision Engine (C7) remains the sole authority for HUNT_NOW/WATCH/IGNORE.',
  };
}

function calculateSwingHorizonConfidence(trendStrength, structureConfidence, momentumScore, rr, catalystScore, dataCompleteness) {
  const components = [];
  if (trendStrength != null) components.push(trendStrength);
  if (structureConfidence != null) components.push(clamp(structureConfidence));
  if (momentumScore != null) components.push(clamp(momentumScore));
  if (rr != null) components.push(clamp(rr * 25, 0, 100));
  if (catalystScore != null) components.push(clamp(catalystScore));

  if (components.length === 0) return null;
  const avg = components.reduce((a, b) => a + b, 0) / components.length;
  return clamp(Math.round(avg));
}

// ============================================================================
// RANKING
// ============================================================================

function rankSwingHorizonOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };
  const sorted = [...results].sort((a, b) => {
    const sa = a.swingScore ?? -1;
    const sb = b.swingScore ?? -1;
    if (sb !== sa) return sb - sa;
    const ca = a.dataQuality?.completeness ?? 0;
    const cb = b.dataQuality?.completeness ?? 0;
    return cb - ca;
  });
  return {
    ranked: sorted.slice(0, 20),
    top: sorted.slice(0, 5),
    alternatives: sorted.slice(5, 10),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  HORIZON,
  SWING_HORIZON_LABEL,
  TREND_DIRECTION,
  SWING_STATUS,
  SWING_QUALITY,
  SETUP_CLASSIFICATION,
  SWING_WEIGHTS,
  SWING_QUALITY_THRESHOLDS,
  SWING_STATUS_THRESHOLDS,
  assessTrend,
  assessMomentum,
  assessSupplyDemand,
  assessCatalysts,
  assessRiskReward,
  classifySetup,
  calculateSwingHorizonScore,
  classifySwingQuality,
  classifySwingStatus,
  assessRegimeAlignment,
  generateThesis,
  generateInvalidation,
  buildKeySignals,
  aggregateRisks,
  calculateSwingHorizonConfidence,
  buildSwingHorizon,
  defaultSwingHorizon,
  rankSwingHorizonOpportunities,
};

export default buildSwingHorizon;
