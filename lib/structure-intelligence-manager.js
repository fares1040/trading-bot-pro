/**
 * Structure Intelligence Manager
 *
 * Orchestration layer for market structure analysis and price-action context.
 * Pure function module — no network calls, no fabrication, no look-ahead.
 *
 * REUSE: Detection primitives come from lib/classical-technical-evidence.js:
 *   - swingHighs / swingLows  → normalized pivots
 *   - detectMarketStructure    → HH/HL/LH/LL + trend + MSS
 *   - detectBreaker            → breaker detection
 *   - detectFVG                → FVG detection + fill state
 *   - detectLiquiditySweep     → structural liquidity (buy-side / sell-side)
 *   - detectSupportResistance  → supply / demand zones
 *
 * ADDS:
 *   - Normalized pivot classification (HH/HL/LH/LL sequences)
 *   - Equal highs / equal lows detection
 *   - FVG fill-state checking
 *   - Structure Score (0–100, bounded, deterministic)
 *   - Normalized structure state output
 *   - Multi-timeframe provenance
 *
 * No BUY/SELL guarantees. Missing data = null. Never fabricated.
 * Structural liquidity ≠ real-time order-book liquidity.
 */

import {
  detectMarketStructure,
  detectBreaker,
  detectFVG,
  detectLiquiditySweep,
  detectSupportResistance,
  swingHighs,
  swingLows,
} from './classical-technical-evidence.js';

const n = (value) => {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

const clamp = (value, min = 0, max = 100) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
};

const round = (value, decimals = 2) => {
  const v = n(value);
  return v != null ? Number(v.toFixed(decimals)) : null;
};

const nowISO = () => new Date().toISOString();

const TREND_COLORS = {
  BULLISH: '#34D399',
  BEARISH: '#EF4444',
  NEUTRAL: '#FBBF24',
  UNAVAILABLE: '#475569',
};

const STRUCTURE_STATE = {
  BULLISH_CONTINUATION: 'BULLISH_CONTINUATION',
  BEARISH_CONTINUATION: 'BEARISH_CONTINUATION',
  ACCUMULATION: 'ACCUMULATION',
  DISTRIBUTION: 'DISTRIBUTION',
  RANGE: 'RANGE',
  TRANSITION: 'TRANSITION',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
};

const TIME_IN_FORCE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  INTRADAY: 'intraday',
};

// ============================================================================
// PIVOT NORMALIZATION + HH/HL/LH/LL CLASSIFICATION
// ============================================================================

/**
 * Build normalized pivot points from OHLCV arrays.
 * Reuses swingHighs / swingLows from classical-technical-evidence.js.
 *
 * Each pivot preserves: timestamp, price, index, type (HIGH/LOW), strength.
 * Pivots are chronologically ordered (ascending by index).
 *
 * Detection is deterministic: bar is a swing high if it is strictly greater
 * than `lookback` bars on each side (classic fractal pivot).
 * No look-ahead: confirmation requires `lookback` bars after the pivot.
 *
 * @param {Object} params
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {string[]} [timestamps] - ISO strings aligned with highs/lows
 * @param {number} [lookback] - default 5
 * @returns {Array<{timestamp, price, index, type, strength, confirmed}>}
 */
function buildPivots(highs, lows, timestamps = [], lookback = 5) {
  const rawHighs = swingHighs(highs, lookback);
  const rawLows = swingLows(lows, lookback);

  const lastIndex = Math.max(
    (Array.isArray(highs) ? highs.length : 0),
    (Array.isArray(lows) ? lows.length : 0),
    0
  );

  const pivots = [];

  for (const ph of rawHighs) {
    pivots.push({
      timestamp: timestamps[ph.index] || null,
      price: round(ph.value, 4),
      index: ph.index,
      type: 'HIGH',
      strength: clamp((ph.value - Math.min(...rawLows.map(p => p.value).filter(v => v != null))) / (Math.max(...rawHighs.map(p => p.value).filter(v => v != null)) - Math.min(...rawLows.map(p => p.value).filter(v => v != null))) * 100 || 0, 0, 100),
      confirmed: (lastIndex - ph.index) > lookback,
    });
  }

  for (const pl of rawLows) {
    pivots.push({
      timestamp: timestamps[pl.index] || null,
      price: round(pl.value, 4),
      index: pl.index,
      type: 'LOW',
      strength: clamp((Math.max(...rawHighs.map(p => p.value).filter(v => v != null)) - pl.value) / (Math.max(...rawHighs.map(p => p.value).filter(v => v != null)) - Math.min(...rawLows.map(p => p.value).filter(v => v != null))) * 100 || 0, 0, 100),
      confirmed: (lastIndex - pl.index) > lookback,
    });
  }

  pivots.sort((a, b) => a.index - b.index);
  return pivots;
}

/**
 * Classify consecutive swing pivots into HH/HL/LH/LL sequences.
 *
 * Uses only confirmed pivots (those with `lookback` bars after them).
 * A pivot is classified relative to its previous pivot of the same type:
 *   - Higher High:  pivot price > previous HIGH pivot price
 *   - Lower High:   pivot price < previous HIGH pivot price
 *   - Higher Low:   pivot price > previous LOW pivot price
 *   - Lower Low:    pivot price < previous LOW pivot price
 *
 * No classification for isolated pivots without a previous pivot of the same type.
 *
 * @param {Array} pivots
 * @returns {Array<{index, type, classification, price, timestamp}>}
 */
function classifyPivotSequences(pivots) {
  const classified = [];
  const lastHigh = { index: -Infinity, price: null };
  const lastLow = { index: -Infinity, price: null };

  for (const p of pivots) {
    if (!p.confirmed) continue;

    let classification = null;

    if (p.type === 'HIGH') {
      if (lastHigh.price != null) {
        classification = p.price > lastHigh.price ? 'HH' : p.price < lastHigh.price ? 'LH' : null;
      }
      lastHigh.index = p.index;
      lastHigh.price = p.price;
    } else if (p.type === 'LOW') {
      if (lastLow.price != null) {
        classification = p.price > lastLow.price ? 'HL' : p.price < lastLow.price ? 'LL' : null;
      }
      lastLow.index = p.index;
      lastLow.price = p.price;
    }

    classified.push({
      index: p.index,
      type: p.type,
      classification,
      price: p.price,
      timestamp: p.timestamp,
    });
  }

  return classified;
}

// ============================================================================
// EQUAL HIGHS / EQUAL LOWS
// ============================================================================

/**
 * Detect equal highs and equal lows — swings at approximately the same price level.
 *
 * Equal highs: multiple swing highs within a tolerance band (default 0.5%).
 * Equal lows:  multiple swing lows within a tolerance band (default 0.5%).
 *
 * These are structural liquidity reference levels, not order-book snapshots.
 *
 * @param {Array} pivots - output from buildPivots
 * @param {number} [tolerancePct] - percentage tolerance, default 0.5
 * @returns {{equalHighs: Array, equalLows: Array}}
 */
function detectEqualHighsLows(pivots, tolerancePct = 0.5) {
  const confirmedHighs = pivots.filter(p => p.type === 'HIGH' && p.confirmed && p.price != null);
  const confirmedLows = pivots.filter(p => p.type === 'LOW' && p.confirmed && p.price != null);

  function findClusters(points, tolerance) {
    if (points.length < 2) return [];
    const sorted = [...points].sort((a, b) => a.price - b.price);
    const clusters = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const refPrice = current[0].price;
      const toleranceAbs = refPrice * (tolerance / 100);
      if (Math.abs(sorted[i].price - refPrice) <= toleranceAbs) {
        current.push(sorted[i]);
      } else {
        if (current.length >= 2) clusters.push(current);
        current = [sorted[i]];
      }
    }
    if (current.length >= 2) clusters.push(current);

    return clusters.map(cluster => ({
      price: round(cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length, 4),
      touchCount: cluster.length,
      touches: cluster.map(p => ({ index: p.index, price: p.price, timestamp: p.timestamp })),
    }));
  }

  return {
    equalHighs: findClusters(confirmedHighs, tolerancePct),
    equalLows: findClusters(confirmedLows, tolerancePct),
  };
}

// ============================================================================
// FVG FILL-STATE
// ============================================================================

/**
 * Annotate FVG gaps with fill state.
 *
 * An FVG is "filled" when a subsequent candle's body overlaps any part of
 * the gap range. This is deterministic — only past candles are checked.
 *
 * @param {Object} fvgResult - output from detectFVG
 * @param {Array} highs - full highs array
 * @param {Array} lows - full lows array
 * @returns {Object} augmented FVG result with filled/unfilled state
 */
function annotateFVFFillState(fvgResult, highs, lows) {
  if (!fvgResult || !fvgResult.detected) return fvgResult;

  const annotatedGaps = (fvgResult.gaps || []).map(gap => {
    const filled = checkGapFilled(gap, highs, lows, gap.index);
    return {
      ...gap,
      filled,
      fillStatus: filled ? 'FILLED' : 'UNFILLED',
    };
  });

  return {
    ...fvgResult,
    gaps: annotatedGaps,
  };
}

function checkGapFilled(gap, highs, lows, gapIndex) {
  if (!gapIndex || gapIndex >= highs.length) return false;
  for (let i = gapIndex + 1; i < highs.length; i++) {
    const h = n(highs[i]);
    const l = n(lows[i]);
    if (h == null || l == null) continue;
    if (h >= gap.start && l <= gap.end) return true;
    if (l <= gap.end && h >= gap.start) return true;
  }
  return false;
}

// ============================================================================
// SUPPLY / DEMAND ZONES
// ============================================================================

/**
 * Derive supply and demand zones from structural evidence.
 *
 * Demand zone: area where buying emerged (swing low + confluence with
 * structural support). Uses existing support resistance + swing lows.
 *
 * Supply zone: area where selling emerged (swing high + confluence with
 * structural resistance). Uses existing support resistance + swing highs.
 *
 * Zones are only created when OHLCV data objectively supports them.
 * No institutional order-block claims — purely price-derived.
 *
 * @param {Object} inputs
 * @param {Array} swings
 * @param {Object} supportResistance
 * @returns {{supplyZones: Array, demandZones: Array}}
 */
function buildSupplyDemandZones(swings, supportResistance) {
  const zones = { supplyZones: [], demandZones: [] };

  if (!swings || !swings.confirmedHighs || !swings.confirmedLows) return zones;

  const threshold = supportResistance.strength !== 'UNAVAILABLE'
    ? (supportResistance.resistance - supportResistance.support) * 0.02
    : null;

  // Supply zones: recent swing highs that coincide with resistance
  const supplyLevel = supportResistance.resistance;
  if (supplyLevel != null && swings.confirmedHighs.length > 0) {
    const matchingHighs = swings.confirmedHighs.filter(h => threshold == null || Math.abs(h - supplyLevel) / supplyLevel <= 0.02);
    if (matchingHighs.length > 0) {
      zones.supplyZones.push({
        level: round(supplyLevel, 4),
        type: 'SUPPLY',
        strength: supportResistance.strength,
        confidence: clamp(matchingHighs.length * 20, 0, 100),
        touches: matchingHighs.length,
      });
    }
  }

  // Demand zones: recent swing lows that coincide with support
  const demandLevel = supportResistance.support;
  if (demandLevel != null && swings.confirmedLows.length > 0) {
    const matchingLows = swings.confirmedLows.filter(l => threshold == null || Math.abs(l - demandLevel) / demandLevel <= 0.02);
    if (matchingLows.length > 0) {
      zones.demandZones.push({
        level: round(demandLevel, 4),
        type: 'DEMAND',
        strength: supportResistance.strength,
        confidence: clamp(matchingLows.length * 20, 0, 100),
        touches: matchingLows.length,
      });
    }
  }

  return zones;
}

// ============================================================================
// STRUCTURE SCORE
// ============================================================================

/**
 * Compute a bounded 0–100 Structure Score.
 *
 * Deterministic, reproducible — same inputs always yield same output.
 * Missing data is not treated as bullish or bearish.
 *
 * Components (renormalized to available components):
 *   - structuralConsistency (40%): HH/HL or LH/LL sequence count
 *   - trendClarity          (25%): confidence from market structure detection
 *   - mssPresence           (15%): MSS detected adds clarity
 *   - breakerPresence       (10%): confirmed breaker
 *   - fvgPresence           (10%): unfilled FVGs as structural context
 *
 * @param {Object} inputs
 * @returns {number|null}
 */
function calculateStructureScore(inputs) {
  const components = [];

  const seqCount = inputs.hhhllhCount || 0;
  if (seqCount > 0) {
    components.push({ score: clamp(seqCount * 10, 0, 100), weight: 0.40 });
  }

  const trendConf = inputs.trendConfidence;
  if (trendConf != null) {
    components.push({ score: trendConf, weight: 0.25 });
  }

  if (inputs.mssDetected) {
    components.push({ score: 75, weight: 0.15 });
  }

  if (inputs.breakerDetected) {
    components.push({ score: 60, weight: 0.10 });
  }

  const unfilledFVG = inputs.unfilledFvgCount || 0;
  if (unfilledFVG > 0) {
    components.push({ score: clamp(unfilledFVG * 15, 0, 100), weight: 0.10 });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

// ============================================================================
// STRUCTURE STATE CLASSIFICATION
// ============================================================================

/**
 * Classify the current market structure state.
 *
 * @param {Object} inputs
 * @returns {string} one of STRUCTURE_STATE values
 */
function classifyStructureState(inputs) {
  const { trend, higherHighs, higherLows, lowerHighs, lowerLows, mssDetected } = inputs;

  if (trend === 'UNAVAILABLE') return STRUCTURE_STATE.INSUFFICIENT_DATA;
  if (trend === 'BULLISH' && higherHighs && higherLows) return STRUCTURE_STATE.BULLISH_CONTINUATION;
  if (trend === 'BEARISH' && lowerHighs && lowerLows) return STRUCTURE_STATE.BEARISH_CONTINUATION;
  if (mssDetected) {
    if (trend === 'BULLISH') return STRUCTURE_STATE.TRANSITION;
    if (trend === 'BEARISH') return STRUCTURE_STATE.TRANSITION;
  }
  if (trend === 'NEUTRAL' || (!higherHighs && !lowerHighs && !higherLows && !lowerLows)) {
    return STRUCTURE_STATE.RANGE;
  }
  if (higherHighs && !higherLows) return STRUCTURE_STATE.ACCUMULATION;
  if (lowerLows && !lowerHighs) return STRUCTURE_STATE.DISTRIBUTION;
  if (higherHighs || higherLows) return STRUCTURE_STATE.BULLISH_CONTINUATION;
  if (lowerHighs || lowerLows) return STRUCTURE_STATE.BEARISH_CONTINUATION;
  return STRUCTURE_STATE.INSUFFICIENT_DATA;
}

// ============================================================================
// SIGNALS
// ============================================================================

/**
 * Build a list of structural signals from detected patterns.
 *
 * Each signal is a deterministic, evidence-backed observation — never
 * a buy/sell recommendation.
 */
function buildStructureSignals(inputs) {
  const signals = [];

  if (inputs.mssDetected) {
    signals.push({
      type: 'MSS',
      direction: inputs.lastStructureShift === 'BULLISH_TO_BEARISH' ? 'BEARISH' : 'BULLISH',
      level: null,
      timestamp: inputs.mssTimestamp || null,
      confidence: inputs.mssConfidence,
      description: `Market structure shift: ${inputs.lastStructureShift || 'detected'}`,
    });
  }

  if (inputs.breakerDetected) {
    signals.push({
      type: 'BREAKER',
      level: inputs.breakerLevel,
      timestamp: null,
      confidence: inputs.breakerConfidence,
      description: 'Breaker: previous support/resistance transformed and retested',
    });
  }

  for (const gap of inputs.fvgGaps || []) {
    if (!gap.filled) {
      signals.push({
        type: 'FVG_UNFILLED',
        level: (gap.start + gap.end) / 2,
        upperBound: gap.end,
        lowerBound: gap.start,
        type_direction: gap.type,
        confidence: 65,
        description: `${gap.type} Fair Value Gap unfilled`,
      });
    }
  }

  if (inputs.liquiditySweepDetected) {
    signals.push({
      type: 'LIQUIDITY_SWEEP',
      direction: inputs.sweepType === 'TURTLE_SOUP' ? 'BEARISH' : 'BULLISH',
      level: inputs.sweptLevel,
      confidence: inputs.sweepConfidence,
      description: `Structural liquidity sweep: ${inputs.sweepType}`,
    });
  }

  if (inputs.supplyZoneCount > 0) {
    signals.push({
      type: 'SUPPLY_ZONE',
      level: inputs.supplyZoneLevel,
      confidence: inputs.supplyZoneConfidence,
      description: 'Supply zone detected from structural high + resistance confluence',
    });
  }

  if (inputs.demandZoneCount > 0) {
    signals.push({
      type: 'DEMAND_ZONE',
      level: inputs.demandZoneIdemandLevel || inputs.demandZoneLevel,
      confidence: inputs.demandZoneConfidence,
      description: 'Demand zone detected from structural low + support confluence',
    });
  }

  return signals;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Build Structure Intelligence from OHLCV data.
 *
 * Reuses detection primitives from classical-technical-evidence.js.
 * Produces a normalized structure state suitable for:
 *   - Command Center
 *   - Opportunity Detail
 *   - Swing Horizon
 *   - Trade Plan Engine
 *   - AI Explanation / Evidence
 *
 * @param {Object} inputs
 * @param {number[]} inputs.highs
 * @param {number[]} inputs.lows
 * @param {number[]} inputs.closes
 * @param {number[]} [inputs.volumes]
 * @param {string[]} [inputs.timestamps]
 * @param {number} [inputs.existingSupport]
 * @param {number} [inputs.existingResistance]
 * @param {string} [inputs.symbol]
 * @param {string} [inputs.timeframe]
 * @param {number} [inputs.lookback]
 * @param {number} [options.htfCloses]
 * @param {number[]} [options.htfHighs]
 * @param {number[]} [options.htfLows]
 * @param {number[]} [options.ltfCloses]
 * @param {number[]} [options.ltfHighs]
 * @param {number[]} [options.ltfLows]
 * @param {number[]} [options.ltfVolumes]
 * @param {string} [options.htfTimeframe]
 * @param {string} [options.ltfTimeframe]
 * @returns {Object} Structure Intelligence result
 */
function buildStructureIntelligence(inputs = {}) {
  const {
    highs = [],
    lows = [],
    closes = [],
    volumes = [],
    timestamps = [],
    existingSupport = null,
    existingResistance = null,
    symbol = null,
    timeframe = TIME_IN_FORCE.DAILY,
    lookback = 5,
    ...htfOptions
  } = inputs;

  const h = Array.isArray(highs) ? highs.map(n).filter(v => v != null) : [];
  const l = Array.isArray(lows) ? lows.map(n).filter(v => v != null) : [];
  const c = Array.isArray(closes) ? closes.map(n).filter(v => v != null) : [];

  if (h.length === 0 && l.length === 0 && c.length === 0) {
    return defaultStructureIntelligence(symbol, timeframe);
  }

  if (h.length < 10 || l.length < 10 || c.length < 10) {
    return {
      ...defaultStructureIntelligence(symbol, timeframe),
      symbol: symbol || null,
      timestamp: nowISO(),
      structureState: STRUCTURE_STATE.INSUFFICIENT_DATA,
      structureScore: null,
      pivots: [],
      classifiedPivots: [],
      signals: [],
      dataQuality: {
        ...defaultStructureIntelligence(symbol, timeframe).dataQuality,
        completeness: rounds((h.length + l.length + c.length) / 3 / 10 * 100, 0),
        barCount: c.length,
      },
      dataStatus: 'partial',
    };
  }

  // --- Reuse detection primitives ---
  const marketStructure = detectMarketStructure(highs, lows, closes);
  const breaker = detectBreaker(highs, lows, closes, existingSupport, existingResistance);
  const fvgRaw = detectFVG(highs, lows, closes);
  const fvg = annotateFVFFillState(fvgRaw, highs, lows);
  const liquiditySweep = detectLiquiditySweep(
    highs, lows, closes, volumes,
    [existingSupport, existingResistance].filter(Boolean)
  );
  const supportResistance = detectSupportResistance(
    highs, lows, closes, existingSupport, existingResistance
  );

  // --- Build pivots ---
  const pivots = buildPivots(highs, lows, timestamps, lookback);
  const classifiedPivots = classifyPivotSequences(pivots);

  // --- Equal highs / equal lows ---
  const equalHL = detectEqualHighsLows(pivots);

  // --- Supply / demand zones ---
  const swings = {
    confirmedHighs: pivots.filter(p => p.type === 'HIGH' && p.confirmed).map(p => p.price).filter(v => v != null),
    confirmedLows: pivots.filter(p => p.type === 'LOW' && p.confirmed).map(p => p.price).filter(v => v != null),
  };
  const { supplyZones, demandZones } = buildSupplyDemandZones(swings, supportResistance);

  // --- Sequence classification for scoring ---
  const hhhllhCount = classifiedPivots.filter(p => p.classification).length;
  const bullishSequences = classifiedPivots.filter(p => p.classification === 'HH' || p.classification === 'HL').length;
  const bearishSequences = classifiedPivots.filter(p => p.classification === 'LH' || p.classification === 'LL').length;

  // --- FVG fill state ---
  const unfilledFvgCount = (fvg.gaps || []).filter(g => !g.filled).length;

  // --- Last swing points ---
  const lastSwingHigh = pivots.filter(p => p.type === 'HIGH').slice(-1)[0] || null;
  const lastSwingLow = pivots.filter(p => p.type === 'LOW').slice(-1)[0] || null;
  const previousSwingHigh = pivots.filter(p => p.type === 'HIGH').slice(-2)[0] || lastSwingHigh;
  const previousSwingLow = pivots.filter(p => p.type === 'LOW').slice(-2)[0] || lastSwingLow;

  // --- Structure state ---
  const structureState = classifyStructureState({
    trend: marketStructure.trend,
    higherHighs: marketStructure.higherHighs,
    higherLows: marketStructure.higherLows,
    lowerHighs: marketStructure.lowerHighs,
    lowerLows: marketStructure.lowerLows,
    mssDetected: marketStructure.mssDetected,
    lastStructureShift: marketStructure.lastStructureShift,
  });

  const structureBias =
    marketStructure.trend === 'BULLISH' ? 'BULLISH' :
    marketStructure.trend === 'BEARISH' ? 'BEARISH' :
    marketStructure.trend === 'NEUTRAL' ? 'NEUTRAL' :
    'UNAVAILABLE';

  // --- Structure score ---
  const structureScore = calculateStructureScore({
    hhhllhCount,
    trendConfidence: marketStructure.confidence,
    mssDetected: marketStructure.mssDetected,
    breakerDetected: breaker.detected,
    unfilledFvgCount,
  });

  // --- Signals ---
  const signals = buildStructureSignals({
    mssDetected: marketStructure.mssDetected,
    lastStructureShift: marketStructure.lastStructureShift,
    mssTimestamp: null,
    mssConfidence: marketStructure.confidence,
    breakerDetected: breaker.detected,
    breakerLevel: breaker.transformedLevel,
    breakerConfidence: breaker.confidence,
    fvgGaps: fvg.gaps,
    liquiditySweepDetected: liquiditySweep.detected,
    sweepType: liquiditySweep.sweepType,
    sweptLevel: liquiditySweep.sweptLevel,
    sweepConfidence: liquiditySweep.confidence,
    supplyZoneCount: supplyZones.length,
    supplyZoneLevel: supplyZones[0]?.level,
    supplyZoneConfidence: supplyZones[0]?.confidence,
    demandZoneCount: demandZones.length,
    demandZoneLevel: demandZones[0]?.level,
    demandZoneConfidence: demandZones[0]?.confidence,
  });

  // --- Confidence ---
  const componentConfidences = [
    marketStructure.confidence,
    breaker.confidence,
    fvg.confidence,
    liquiditySweep.confidence,
  ].filter(v => v != null);
  const confidence = componentConfidences.length > 0
    ? clamp(componentConfidences.reduce((a, b) => a + b, 0) / componentConfidences.length)
    : null;

  // --- Data quality ---
  const completenessChecks = [
    h.length >= 10,
    l.length >= 10,
    c.length >= 10,
    volumes.length > 0,
    marketStructure.confidence != null,
    breaker.confidence != null,
    fvg.confidence != null,
  ];
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100);

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    timeframe,
    structureBias,
    structureState,
    lastSwingHigh: lastSwingHigh
      ? { price: lastSwingHigh.price, index: lastSwingHigh.index, timestamp: lastSwingHigh.timestamp }
      : null,
    lastSwingLow: lastSwingLow
      ? { price: lastSwingLow.price, index: lastSwingLow.index, timestamp: lastSwingLow.timestamp }
      : null,
    previousSwingHigh: previousSwingHigh
      ? { price: previousSwingHigh.price, index: previousSwingHigh.index, timestamp: previousSwingHigh.timestamp }
      : null,
    previousSwingLow: previousSwingLow
      ? { price: previousSwingLow.price, index: previousSwingLow.index, timestamp: previousSwingLow.timestamp }
      : null,
    latestPattern:
      marketStructure.mssDetected ? 'MSS_DETECTED' :
      fvg.detected ? 'FVG_DETECTED' :
      breaker.detected ? 'BREAKER_DETECTED' :
      liquiditySweep.detected ? 'LIQUIDITY_SWEEP' :
      'NO_PATTERN',
    trendStrength: clamp((bullishSequences + bearishSequences) / Math.max(hhhllhCount, 1) * 60, 0, 100) || 0,
    pivots: pivots.slice(-50),
    classifiedPivots: classifiedPivots.slice(-50),
    structureClassification: {
      bullishSequenceCount: bullishSequences,
      bearishSequenceCount: bearishSequences,
      totalClassified: hhhllhCount,
      higherHighs: marketStructure.higherHighs,
      higherLows: marketStructure.higherLows,
      lowerHighs: marketStructure.lowerHighs,
      lowerLows: marketStructure.lowerLows,
    },
    equalHighs: equalHL.equalHighs,
    equalLows: equalHL.equalLows,
    signals,
    marketStructure,
    breaker,
    fvg,
    liquiditySweep,
    supportResistance,
    supplyZones,
    demandZones,
    structureScore,
    trendStrength: structureState === STRUCTURE_STATE.INSUFFICIENT_DATA ? null : clamp((bullishSequences + bearishSequences) / Math.max(hhhllhCount, 1) * 60, 0, 100) || 0,
    confidence: clamp(confidence),
    dataQuality: {
      completeness,
      barCount: c.length,
      highs: h.length,
      lows: l.length,
      closes: c.length,
      volumes: volumes.length,
      hasSwingPoints: pivots.length > 0,
      hasMSS: marketStructure.mssDetected,
      hasFVG: fvg.detected,
      hasBreaker: breaker.detected,
      hasLiquiditySweep: liquiditySweep.detected,
      hasSupplyZones: supplyZones.length > 0,
      hasDemandZones: demandZones.length > 0,
    },
    dataStatus: 'complete',
    provenance: {
      pivots: 'structure-intelligence-manager',
      classification: 'structure-intelligence-manager',
      mss: 'classical-technical-evidence',
      fvg: 'classical-technical-evidence',
      breaker: 'classical-technical-evidence',
      liquidity: 'classical-technical-evidence',
      supplyDemand: 'structure-intelligence-manager',
      score: 'structure-intelligence-manager',
    },
    disclaimer:
      'Structure Intelligence provides structural context only — not a buy/sell signal. ' +
      'Structural liquidity is derived from price action, not order book data. ' +
      'Patterns are only reported when OHLC data objectively supports them. ' +
      'Missing data remains null — never fabricated.',
  };
}

/**
 * Default/empty Structure Intelligence.
 */
function defaultStructureIntelligence(symbol = null, timeframe = TIME_IN_FORCE.DAILY) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    timeframe,
    structureBias: 'UNAVAILABLE',
    structureState: STRUCTURE_STATE.INSUFFICIENT_DATA,
    lastSwingHigh: null,
    lastSwingLow: null,
    previousSwingHigh: null,
    previousSwingLow: null,
    latestPattern: 'NO_PATTERN',
    trendStrength: null,
    pivots: [],
    classifiedPivots: [],
    structureClassification: {
      bullishSequenceCount: 0,
      bearishSequenceCount: 0,
      totalClassified: 0,
      higherHighs: false,
      higherLows: false,
      lowerHighs: false,
      lowerLows: false,
    },
    equalHighs: [],
    equalLows: [],
    signals: [],
    marketStructure: {
      trend: 'UNAVAILABLE',
      higherHighs: false,
      higherLows: false,
      lowerHighs: false,
      lowerLows: false,
      lastStructureShift: null,
      mssDetected: false,
      confidence: null,
    },
    breaker: {
      detected: false,
      previousSupport: null,
      previousResistance: null,
      transformedLevel: null,
      confidence: null,
    },
    fvg: {
      detected: false,
      gaps: [],
      confidence: null,
    },
    liquiditySweep: {
      detected: false,
      sweepType: 'NONE',
      sweptLevel: null,
      returnConfirmed: false,
      confidence: null,
    },
    supportResistance: {
      support: null,
      resistance: null,
      strength: 'UNAVAILABLE',
      touches: null,
    },
    supplyZones: [],
    demandZones: [],
    structureScore: null,
    confidence: null,
    dataQuality: {
      completeness: 0,
      barCount: 0,
      highs: 0,
      lows: 0,
      closes: 0,
      volumes: 0,
      hasSwingPoints: false,
      hasMSS: false,
      hasFVG: false,
      hasBreaker: false,
      hasLiquiditySweep: false,
      hasSupplyZones: false,
      hasDemandZones: false,
    },
    dataStatus: 'unavailable',
    provenance: {
      pivots: 'structure-intelligence-manager',
      classification: 'structure-intelligence-manager',
      mss: 'classical-technical-evidence',
      fvg: 'classical-technical-evidence',
      breaker: 'classical-technical-evidence',
      liquidity: 'classical-technical-evidence',
      supplyDemand: 'structure-intelligence-manager',
      score: 'structure-intelligence-manager',
    },
    disclaimer:
      'Structure Intelligence provides structural context only — not a buy/sell signal. ' +
      'Structural liquidity is derived from price action, not order book data. ' +
      'Patterns are only reported when OHLC data objectively supports them. ' +
      'Missing data remains null — never fabricated.',
  };
}

function rounds(value, decimals = 0) {
  const v = n(value);
  return v != null ? Number(v.toFixed(decimals)) : 0;
}

// ============================================================================
// RANKING / OPPORTUNITIES
// ============================================================================

/**
 * Rank symbols by structural opportunity.
 * Symbols with MSS, unfilled FVG, or confirmed breaker rank higher.
 */
function rankStructureOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.structureScore ?? -1;
    const sb = b.structureScore ?? -1;
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

export {
  n,
  clamp,
  round,
  nowISO,
  buildPivots,
  classifyPivotSequences,
  detectEqualHighsLows,
  annotateFVFFillState,
  buildSupplyDemandZones,
  calculateStructureScore,
  classifyStructureState,
  buildStructureSignals,
  rankStructureOpportunities,
  TREND_COLORS,
  STRUCTURE_STATE,
  TIME_IN_FORCE,
};

export {
  buildStructureIntelligence,
  defaultStructureIntelligence,
};

export default buildStructureIntelligence;
