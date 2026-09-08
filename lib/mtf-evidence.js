/**
 * Multi-Timeframe (MTF) Evidence Engine
 *
 * Produces unified STRUCTURE evidence across available timeframes.
 * Primary principle: higher timeframe provides context, primary timeframe
 * provides the trend, lower timeframe provides timing/confirmation.
 *
 * Uses structure-intelligence-manager.js as the unified structure source.
 * No duplicate detection — each timeframe's structure is independent;
 * MTF assesses alignment, not raw signals.
 *
 * BACKWARD COMPATIBLE: Does not modify structure-intelligence-manager.js
 * output contract. Adds MTF layer on top.
 */

import { buildStructureIntelligence, STRUCTURE_STATE } from './structure-intelligence-manager.js';

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

const nowISO = () => new Date().toISOString();

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMEFRAME_PRIORITY = {
  INTRADAY: 0,
  DAILY: 1,
  WEEKLY: 2,
  MONTHLY: 3,
};

const ALIGNMENT = {
  FULL_ALIGNMENT: 'FULL_ALIGNMENT',
  PARTIAL_ALIGNMENT: 'PARTIAL_ALIGNMENT',
  COUNTER_TREND: 'COUNTER_TREND',
  STRUCTURAL_CONFLICT: 'STRUCTURAL_CONFLICT',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  SINGLE_TIMEFRAME: 'SINGLE_TIMEFRAME',
};

const DIRECTION = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  NEUTRAL: 'NEUTRAL',
  UNAVAILABLE: 'UNAVAILABLE',
};

// ============================================================================
// HELPERS
// ============================================================================

function resolveDirection(structure) {
  if (!structure || structure.structureState === STRUCTURE_STATE.INSUFFICIENT_DATA) return DIRECTION.UNAVAILABLE;
  if (structure.structureState === STRUCTURE_STATE.BULLISH_CONTINUATION) return DIRECTION.BULLISH;
  if (structure.structureState === STRUCTURE_STATE.BEARISH_CONTINUATION) return DIRECTION.BEARISH;
  if (structure.structureState === STRUCTURE_STATE.TRANSITION) return DIRECTION.NEUTRAL;
  if (structure.structureState === STRUCTURE_STATE.RANGE) return DIRECTION.NEUTRAL;
  if (structure.structureState === STRUCTURE_STATE.ACCUMULATION) return DIRECTION.BULLISH;
  if (structure.structureState === STRUCTURE_STATE.DISTRIBUTION) return DIRECTION.BEARISH;
  return DIRECTION.NEUTRAL;
}

function isAvailable(structure) {
  return structure && structure.structureState !== STRUCTURE_STATE.INSUFFICIENT_DATA && structure.structureState !== 'INSUFFICIENT_DATA';
}

function timeframeLabel(tf) {
  if (!tf) return 'unknown';
  const t = String(tf).toLowerCase();
  if (t === 'daily' || t === '1d' || t === 'd') return 'daily';
  if (t === 'weekly' || t === '1w' || t === 'w') return 'weekly';
  if (t === 'monthly' || t === '1m' || t === 'mo') return 'monthly';
  if (t === 'intraday' || t === '1h' || t === '5m' || t === '15m' || t === '30m' || t === 'h' || t === 'm') return 'intraday';
  return t;
}

function classifyAlignment(directions) {
  const available = directions.filter(d => d.direction !== DIRECTION.UNAVAILABLE);
  if (available.length === 0) return { alignment: ALIGNMENT.INSUFFICIENT_DATA, direction: DIRECTION.UNAVAILABLE };
  if (available.length === 1) return { alignment: ALIGNMENT.SINGLE_TIMEFRAME, direction: available[0].direction };

  const bullishCount = available.filter(d => d.direction === DIRECTION.BULLISH).length;
  const bearishCount = available.filter(d => d.direction === DIRECTION.BEARISH).length;
  const neutralCount = available.filter(d => d.direction === DIRECTION.NEUTRAL).length;

  // All same direction
  if (bullishCount === available.length) return { alignment: ALIGNMENT.FULL_ALIGNMENT, direction: DIRECTION.BULLISH };
  if (bearishCount === available.length) return { alignment: ALIGNMENT.FULL_ALIGNMENT, direction: DIRECTION.BEARISH };

  // Majority same direction, some neutral
  if (bullishCount > 0 && bearishCount === 0 && neutralCount > 0) {
    return { alignment: ALIGNMENT.PARTIAL_ALIGNMENT, direction: DIRECTION.BULLISH };
  }
  if (bearishCount > 0 && bullishCount === 0 && neutralCount > 0) {
    return { alignment: ALIGNMENT.PARTIAL_ALIGNMENT, direction: DIRECTION.BEARISH };
  }

  // Mixed bullish and bearish — check if higher TF dominates
  const higherTf = available.find(d => d.priority === Math.max(...available.map(a => a.priority)));
  if (higherTf) {
    if (higherTf.direction === DIRECTION.BULLISH && bearishCount > 0) {
      return { alignment: ALIGNMENT.COUNTER_TREND, direction: DIRECTION.BULLISH };
    }
    if (higherTf.direction === DIRECTION.BEARISH && bullishCount > 0) {
      return { alignment: ALIGNMENT.COUNTER_TREND, direction: DIRECTION.BEARISH };
    }
  }

  return { alignment: ALIGNMENT.STRUCTURAL_CONFLICT, direction: DIRECTION.NEUTRAL };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Build Multi-Timeframe Structure Evidence.
 *
 * Runs Market Structure Engine on each available timeframe, then assesses
 * alignment across timeframes. Produces a single STRUCTURE evidence block
 * suitable for C7 consumption.
 *
 * @param {Object} inputs
 * @param {Object} [inputs.higherTimeframe] - HTF OHLCV data (optional)
 * @param {Object} [inputs.primaryTimeframe] - Primary TF OHLCV data (required for non-empty result)
 * @param {Object} [inputs.executionTimeframe] - Execution/LTF OHLCV data (optional)
 * @param {string} [inputs.symbol]
 * @param {string} [inputs.higherTimeframeLabel] - e.g. 'weekly', 'monthly'
 * @param {string} [inputs.primaryTimeframeLabel] - e.g. 'daily'
 * @param {string} [inputs.executionTimeframeLabel] - e.g. 'intraday', '1h'
 * @returns {Object} MTF Structure Evidence
 */
function buildMTFEvidence(inputs = {}) {
  const {
    higherTimeframe = null,
    primaryTimeframe = null,
    executionTimeframe = null,
    symbol = null,
    higherTimeframeLabel = 'weekly',
    primaryTimeframeLabel = 'daily',
    executionTimeframeLabel = 'intraday',
  } = inputs;

  // --- Run structure on each available timeframe ---
  const htfStructure = higherTimeframe && higherTimeframe.highs && higherTimeframe.lows && higherTimeframe.closes
    ? buildStructureIntelligence({
        highs: higherTimeframe.highs,
        lows: higherTimeframe.lows,
        closes: higherTimeframe.closes,
        volumes: higherTimeframe.volumes || [],
        timestamps: higherTimeframe.timestamps || [],
        symbol,
        timeframe: higherTimeframeLabel,
      })
    : null;

  const primaryStructure = primaryTimeframe && primaryTimeframe.highs && primaryTimeframe.lows && primaryTimeframe.closes
    ? buildStructureIntelligence({
        highs: primaryTimeframe.highs,
        lows: primaryTimeframe.lows,
        closes: primaryTimeframe.closes,
        volumes: primaryTimeframe.volumes || [],
        timestamps: primaryTimeframe.timestamps || [],
        symbol,
        timeframe: primaryTimeframeLabel,
      })
    : null;

  const execStructure = executionTimeframe && executionTimeframe.highs && executionTimeframe.lows && executionTimeframe.closes
    ? buildStructureIntelligence({
        highs: executionTimeframe.highs,
        lows: executionTimeframe.lows,
        closes: executionTimeframe.closes,
        volumes: executionTimeframe.volumes || [],
        timestamps: executionTimeframe.timestamps || [],
        symbol,
        timeframe: executionTimeframeLabel,
      })
    : null;

  // --- Assess alignment ---
  const tfEntries = [
    { label: 'higherTimeframe', structure: htfStructure, direction: resolveDirection(htfStructure), priority: TIMEFRAME_PRIORITY.WEEKLY, available: isAvailable(htfStructure) },
    { label: 'primaryTimeframe', structure: primaryStructure, direction: resolveDirection(primaryStructure), priority: TIMEFRAME_PRIORITY.DAILY, available: isAvailable(primaryStructure) },
    { label: 'executionTimeframe', structure: execStructure, direction: resolveDirection(execStructure), priority: TIMEFRAME_PRIORITY.INTRADAY, available: isAvailable(execStructure) },
  ];

  const availableTFs = tfEntries.filter(t => t.available);
  const allDirections = tfEntries.map(t => ({ label: t.label, direction: t.direction, priority: t.priority }));
  const { alignment, direction: overallDirection } = classifyAlignment(allDirections);

  // --- Supporting events (BOS/CHoCH from each timeframe) ---
  const supportingEvents = [];
  const conflicts = [];

  for (const tf of availableTFs) {
    const s = tf.structure;
    if (s.bos && s.bos.detected) {
      supportingEvents.push({
        type: 'BOS',
        timeframe: tf.label,
        timeframeLabel: tf.label === 'higherTimeframe' ? higherTimeframeLabel : tf.label === 'primaryTimeframe' ? primaryTimeframeLabel : executionTimeframeLabel,
        direction: s.bos.direction,
        level: s.bos.level,
        confidence: s.bos.confidence,
      });
    }
    if (s.choch && s.choch.detected) {
      supportingEvents.push({
        type: 'CHoCH',
        timeframe: tf.label,
        timeframeLabel: tf.label === 'higherTimeframe' ? higherTimeframeLabel : tf.label === 'primaryTimeframe' ? primaryTimeframeLabel : executionTimeframeLabel,
        direction: s.choch.direction,
        level: s.choch.level,
        confidence: s.choch.confidence,
      });
    }
  }

  // Detect conflicts between timeframes
  if (availableTFs.length >= 2) {
    const primaryDir = tfEntries.find(t => t.label === 'primaryTimeframe')?.direction;
    const higherDir = tfEntries.find(t => t.label === 'higherTimeframe')?.direction;
    const execDir = tfEntries.find(t => t.label === 'executionTimeframe')?.direction;

    if (higherDir && primaryDir && higherDir !== DIRECTION.UNAVAILABLE && primaryDir !== DIRECTION.UNAVAILABLE && higherDir !== primaryDir) {
      conflicts.push({
        type: 'HIGHER_PRIMARY_CONFLICT',
        higherDirection: higherDir,
        primaryDirection: primaryDir,
        description: `${higherTimeframeLabel} ${higherDir} vs ${primaryTimeframeLabel} ${primaryDir}`,
      });
    }
    if (primaryDir && execDir && primaryDir !== DIRECTION.UNAVAILABLE && execDir !== DIRECTION.UNAVAILABLE && primaryDir !== execDir) {
      conflicts.push({
        type: 'COUNTER_TREND_EXECUTION',
        primaryDirection: primaryDir,
        executionDirection: execDir,
        description: `${primaryTimeframeLabel} ${primaryDir} but execution ${execDir}`,
      });
    }
  }

  // --- Confidence ---
  const availableConfidences = availableTFs.map(t => t.structure.confidence).filter(c => c != null);
  const alignmentMultiplier = alignment === ALIGNMENT.FULL_ALIGNMENT ? 1.0
    : alignment === ALIGNMENT.PARTIAL_ALIGNMENT ? 0.85
    : alignment === ALIGNMENT.COUNTER_TREND ? 0.7
    : alignment === ALIGNMENT.STRUCTURAL_CONFLICT ? 0.5
    : 0.6;
  const rawConfidence = availableConfidences.length > 0
    ? availableConfidences.reduce((a, b) => a + b, 0) / availableConfidences.length
    : null;
  const mtfConfidence = rawConfidence != null ? clamp(Math.round(rawConfidence * alignmentMultiplier)) : null;

  // --- Limitations ---
  const limitations = [];
  if (!htfStructure || !isAvailable(htfStructure)) limitations.push(`${higherTimeframeLabel} data unavailable — alignment assessment limited`);
  if (!execStructure || !isAvailable(execStructure)) limitations.push(`${executionTimeframeLabel} data unavailable — execution timing limited`);
  if (availableTFs.length < 2) limitations.push('Single timeframe — MTF alignment not assessable');
  if (availableTFs.length === 0) limitations.push('No timeframe data available');

  // --- Data quality ---
  const dataQuality = {
    htfAvailable: higherTimeframe != null && isAvailable(htfStructure),
    primaryAvailable: primaryTimeframe != null && isAvailable(primaryStructure),
    execAvailable: executionTimeframe != null && isAvailable(execStructure),
    availableTimeframeCount: availableTFs.length,
    hasConflicts: conflicts.length > 0,
  };

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    family: 'STRUCTURE',
    type: 'MULTI_TIMEFRAME',
    alignment,
    direction: overallDirection,
    higherTimeframe: htfStructure ? {
      label: higherTimeframeLabel,
      structureState: htfStructure.structureState,
      direction: resolveDirection(htfStructure),
      bos: htfStructure.bos,
      choch: htfStructure.choch,
      confidence: htfStructure.confidence,
      lastSwingHigh: htfStructure.lastSwingHigh,
      lastSwingLow: htfStructure.lastSwingLow,
    } : null,
    primaryTimeframe: primaryStructure ? {
      label: primaryTimeframeLabel,
      structureState: primaryStructure.structureState,
      direction: resolveDirection(primaryStructure),
      bos: primaryStructure.bos,
      choch: primaryStructure.choch,
      confidence: primaryStructure.confidence,
      lastSwingHigh: primaryStructure.lastSwingHigh,
      lastSwingLow: primaryStructure.lastSwingLow,
    } : null,
    executionTimeframe: execStructure ? {
      label: executionTimeframeLabel,
      structureState: execStructure.structureState,
      direction: resolveDirection(execStructure),
      bos: execStructure.bos,
      choch: execStructure.choch,
      confidence: execStructure.confidence,
      lastSwingHigh: execStructure.lastSwingHigh,
      lastSwingLow: execStructure.lastSwingLow,
    } : null,
    supportingEvents,
    conflicts,
    confidence: mtfConfidence,
    limitations,
    dataQuality,
    disclaimer:
      'Multi-Timeframe Evidence provides structural context across timeframes — not a buy/sell signal. ' +
      'Alignment assessment is deterministic based on available data. ' +
      'Missing timeframes reduce alignment confidence but do not produce false signals.',
  };
}

// ============================================================================
// DEFAULT
// ============================================================================

function defaultMTFEvidence(symbol = null) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    family: 'STRUCTURE',
    type: 'MULTI_TIMEFRAME',
    alignment: ALIGNMENT.INSUFFICIENT_DATA,
    direction: DIRECTION.UNAVAILABLE,
    higherTimeframe: null,
    primaryTimeframe: null,
    executionTimeframe: null,
    supportingEvents: [],
    conflicts: [],
    confidence: null,
    limitations: ['No timeframe data available'],
    dataQuality: {
      htfAvailable: false,
      primaryAvailable: false,
      execAvailable: false,
      availableTimeframeCount: 0,
      hasConflicts: false,
    },
    disclaimer:
      'Multi-Timeframe Evidence provides structural context across timeframes — not a buy/sell signal. ' +
      'Alignment assessment is deterministic based on available data. ' +
      'Missing timeframes reduce alignment confidence but do not produce false signals.',
  };
}

export {
  buildMTFEvidence,
  defaultMTFEvidence,
  ALIGNMENT,
  DIRECTION,
  TIMEFRAME_PRIORITY,
  resolveDirection,
  classifyAlignment,
};
