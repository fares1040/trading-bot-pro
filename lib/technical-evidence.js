/**
 * Technical Evidence Engine
 *
 * Produces unified Technical Evidence across 6 families:
 *   STRUCTURE  — swing pivots, HH/HL/LH/LL, BOS, CHoCH, MTF alignment
 *   TREND      — price vs MA, slope, persistence
 *   MOMENTUM   — RSI, rate of change
 *   VOLUME     — RVOL, expansion, confirmation
 *   VOLATILITY — Bollinger squeeze, ATR, expansion/contraction
 *   PATTERN    — candlestick patterns, structural patterns (FVG, breaker)
 *
 * Each family is ONE evidence block. Observations within a family are grouped
 * to prevent double-counting. Families are independent — no cross-family
 * correlation is assumed.
 *
 * REUSES existing engines:
 *   - structure-intelligence-manager.js → STRUCTURE family
 *   - mtf-evidence.js → MTF alignment within STRUCTURE
 *   - market-engine.js pre-computed indicators → TREND, MOMENTUM, VOLUME, VOLATILITY
 *   - candlestick-patterns.js → PATTERN family
 *   - classical-technical-evidence.js → structural patterns within PATTERN
 *
 * DOES NOT recompute indicators — consumes pre-computed values.
 * DOES NOT modify C7 scoring — produces evidence for C7 to consume.
 */

import {
  n,
  calculateRSI,
  calculateSMA,
  calculateATR,
  calculateBollinger,
  clamp,
  round,
} from './technical-indicators.js';

import {
  buildStructureIntelligence,
  STRUCTURE_STATE,
} from './structure-intelligence-manager.js';

import { buildMTFEvidence, ALIGNMENT, DIRECTION } from './mtf-evidence.js';

import { buildCandlestickPatterns } from './candlestick-patterns.js';

import { buildClassicalTechnicalEvidence } from './classical-technical-evidence.js';

const nowISO = () => new Date().toISOString();

// ============================================================================
// EVIDENCE FAMILIES
// ============================================================================

const EVIDENCE_FAMILY = {
  STRUCTURE: 'STRUCTURE',
  TREND: 'TREND',
  MOMENTUM: 'MOMENTUM',
  VOLUME: 'VOLUME',
  VOLATILITY: 'VOLATILITY',
  PATTERN: 'PATTERN',
};

const DIRECTION_ENUM = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH',
  NEUTRAL: 'NEUTRAL',
  UNAVAILABLE: 'UNAVAILABLE',
};

// ============================================================================
// STRUCTURE FAMILY
// ============================================================================

/**
 * Build STRUCTURE evidence from structure intelligence + MTF.
 *
 * Anti-double-counting: all structure observations (HH, HL, BOS, CHoCH,
 * MTF alignment) are grouped into ONE STRUCTURE family interpretation.
 *
 * @param {Object} structureData - from buildStructureIntelligence
 * @param {Object} mtfData - from buildMTFEvidence (optional)
 * @returns {Object} STRUCTURE evidence family
 */
function buildStructureEvidence(structureData, mtfData = null) {
  const unavailable = {
    family: EVIDENCE_FAMILY.STRUCTURE,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Structure data unavailable'],
  };

  if (!structureData) return unavailable;

  const state = structureData.structureState;
  if (state === STRUCTURE_STATE.INSUFFICIENT_DATA || state === 'INSUFFICIENT_DATA') {
    return {
      ...unavailable,
      limitations: ['Insufficient data for structure analysis'],
    };
  }

  // Determine direction from structure state
  let direction = DIRECTION_ENUM.NEUTRAL;
  if (state === STRUCTURE_STATE.BULLISH_CONTINUATION || state === STRUCTURE_STATE.ACCUMULATION) {
    direction = DIRECTION_ENUM.BULLISH;
  } else if (state === STRUCTURE_STATE.BEARISH_CONTINUATION || state === STRUCTURE_STATE.DISTRIBUTION) {
    direction = DIRECTION_ENUM.BEARISH;
  } else if (state === STRUCTURE_STATE.TRANSITION) {
    direction = DIRECTION_ENUM.NEUTRAL;
  }

  // Group observations — each is a structural observation, NOT an independent score
  const observations = [];

  // Swing structure observations
  if (structureData.structureClassification) {
    const sc = structureData.structureClassification;
    if (sc.higherHighs) observations.push({ type: 'HH', description: 'Higher High detected' });
    if (sc.higherLows) observations.push({ type: 'HL', description: 'Higher Low detected' });
    if (sc.lowerHighs) observations.push({ type: 'LH', description: 'Lower High detected' });
    if (sc.lowerLows) observations.push({ type: 'LL', description: 'Lower Low detected' });
  }

  // BOS observation
  if (structureData.bos && structureData.bos.detected) {
    observations.push({
      type: 'BOS',
      direction: structureData.bos.direction,
      level: structureData.bos.level,
      description: structureData.bos.description,
    });
  }

  // CHoCH observation
  if (structureData.choch && structureData.choch.detected) {
    observations.push({
      type: 'CHoCH',
      direction: structureData.choch.direction,
      level: structureData.choch.level,
      description: structureData.choch.description,
    });
  }

  // MSS observation
  if (structureData.marketStructure && structureData.marketStructure.mssDetected) {
    observations.push({
      type: 'MSS',
      description: `Market structure shift: ${structureData.marketStructure.lastStructureShift}`,
    });
  }

  // MTF alignment (from mtf-evidence.js)
  let mtfAlignment = null;
  if (mtfData && mtfData.alignment) {
    mtfAlignment = {
      alignment: mtfData.alignment,
      direction: mtfData.direction,
      conflicts: mtfData.conflicts || [],
    };
    if (mtfData.alignment === ALIGNMENT.FULL_ALIGNMENT) {
      observations.push({ type: 'MTF_ALIGNMENT', alignment: mtfData.alignment, direction: mtfData.direction });
    } else if (mtfData.alignment === ALIGNMENT.STRUCTURAL_CONFLICT) {
      observations.push({ type: 'MTF_CONFLICT', alignment: mtfData.alignment, conflicts: mtfData.conflicts });
    }
  }

  // Strength: based on number of confirming observations and confidence
  const bullishObs = observations.filter(o => o.direction === 'BULLISH').length;
  const bearishObs = observations.filter(o => o.direction === 'BEARISH').length;
  const totalObs = observations.length;
  const confirmingObs = direction === DIRECTION_ENUM.BULLISH ? bullishObs
    : direction === DIRECTION_ENUM.BEARISH ? bearishObs
    : 0;
  const strength = totalObs > 0 ? clamp(Math.round((confirmingObs / Math.max(totalObs, 1)) * 100)) : null;

  const limitations = [];
  if (!mtfData) limitations.push('Multi-timeframe data not provided');
  if (structureData.confidence != null && structureData.confidence < 50) limitations.push('Low structure confidence');

  return {
    family: EVIDENCE_FAMILY.STRUCTURE,
    direction,
    strength,
    observations,
    mtfAlignment,
    confidence: structureData.confidence,
    structureState: state,
    limitations,
  };
}

// ============================================================================
// TREND FAMILY
// ============================================================================

/**
 * Build TREND evidence from market data.
 *
 * Anti-double-counting: price vs MA and slope are ONE trend observation,
 * not separate bullish signals. HH/HL belongs to STRUCTURE, not TREND.
 *
 * @param {Object} marketData - pre-computed from market-engine.js
 * @returns {Object} TREND evidence family
 */
function buildTrendEvidence(marketData) {
  const unavailable = {
    family: EVIDENCE_FAMILY.TREND,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Market data unavailable for trend analysis'],
  };

  if (!marketData) return unavailable;

  const price = n(marketData.price);
  const sma20 = n(marketData.sma20);
  const sma50 = n(marketData.sma50);
  const closes = Array.isArray(marketData.closes) ? marketData.closes : [];

  if (price == null) return unavailable;

  const observations = [];
  let direction = DIRECTION_ENUM.NEUTRAL;

  // Price vs SMA50 — primary trend signal
  if (sma50 != null) {
    if (price > sma50) {
      observations.push({ type: 'PRICE_ABOVE_SMA50', description: `Price ${price} above SMA50 ${sma50}` });
      direction = DIRECTION_ENUM.BULLISH;
    } else if (price < sma50) {
      observations.push({ type: 'PRICE_BELOW_SMA50', description: `Price ${price} below SMA50 ${sma50}` });
      direction = DIRECTION_ENUM.BEARISH;
    } else {
      observations.push({ type: 'PRICE_AT_SMA50', description: `Price at SMA50 ${sma50}` });
    }
  }

  // Price vs SMA20 — short-term trend confirmation
  if (sma20 != null) {
    if (price > sma20) {
      observations.push({ type: 'PRICE_ABOVE_SMA20', description: `Price above SMA20` });
    } else if (price < sma20) {
      observations.push({ type: 'PRICE_BELOW_SMA20', description: `Price below SMA20` });
    }
  }

  // SMA slope (if enough closes)
  if (closes.length >= 55 && sma50 != null) {
    const prevSma50 = calculateSMA(closes.slice(0, -5), 50);
    if (prevSma50 != null) {
      const slope = sma50 - prevSma50;
      const slopePct = prevSma50 > 0 ? (slope / prevSma50) * 100 : 0;
      if (slopePct > 0.5) {
        observations.push({ type: 'SMA50_RISING', slope: round(slopePct), description: `SMA50 rising (+${round(slopePct)}%)` });
      } else if (slopePct < -0.5) {
        observations.push({ type: 'SMA50_FALLING', slope: round(slopePct), description: `SMA50 falling (${round(slopePct)}%)` });
      }
    }
  }

  // Market-engine trend score (pre-computed)
  const trendScore = n(marketData.trendScore);

  // Strength: use market-engine trendScore if available, else derive from observations
  const strength = trendScore != null ? clamp(Math.round(trendScore)) : null;

  const limitations = [];
  if (sma50 == null) limitations.push('SMA50 unavailable');
  if (closes.length < 55) limitations.push('Insufficient closes for slope analysis');

  return {
    family: EVIDENCE_FAMILY.TREND,
    direction,
    strength,
    observations,
    confidence: strength,
    limitations,
  };
}

// ============================================================================
// MOMENTUM FAMILY
// ============================================================================

/**
 * Build MOMENTUM evidence from market data.
 *
 * Anti-double-counting: RSI is ONE momentum indicator. If RSI is used
 * in B4/B5/A7, that's consumption of the same underlying signal, not
 * independent evidence.
 *
 * @param {Object} marketData - pre-computed from market-engine.js
 * @returns {Object} MOMENTUM evidence family
 */
function buildMomentumEvidence(marketData) {
  const unavailable = {
    family: EVIDENCE_FAMILY.MOMENTUM,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Market data unavailable for momentum analysis'],
  };

  if (!marketData) return unavailable;

  const rsi = n(marketData.rsi);
  const closes = Array.isArray(marketData.closes) ? marketData.closes : [];

  if (rsi == null && closes.length < 15) {
    return { ...unavailable, limitations: ['Insufficient data for RSI calculation'] };
  }

  // Calculate RSI if not pre-computed
  const rsiValue = rsi != null ? rsi : calculateRSI(closes);

  const observations = [];
  let direction = DIRECTION_ENUM.NEUTRAL;

  if (rsiValue != null) {
    // RSI classification — single observation
    if (rsiValue >= 70) {
      observations.push({ type: 'RSI_OVERBOUGHT', value: round(rsiValue), description: `RSI ${round(rsiValue)} — overbought territory` });
      direction = DIRECTION_ENUM.BEARISH;
    } else if (rsiValue <= 30) {
      observations.push({ type: 'RSI_OVERSOLD', value: round(rsiValue), description: `RSI ${round(rsiValue)} — oversold territory` });
      direction = DIRECTION_ENUM.BULLISH;
    } else if (rsiValue >= 55) {
      observations.push({ type: 'RSI_BULLISH', value: round(rsiValue), description: `RSI ${round(rsiValue)} — bullish zone` });
      direction = DIRECTION_ENUM.BULLISH;
    } else if (rsiValue <= 45) {
      observations.push({ type: 'RSI_BEARISH', value: round(rsiValue), description: `RSI ${round(rsiValue)} — bearish zone` });
      direction = DIRECTION_ENUM.BEARISH;
    } else {
      observations.push({ type: 'RSI_NEUTRAL', value: round(rsiValue), description: `RSI ${round(rsiValue)} — neutral zone` });
    }
  }

  // Momentum from market-engine (pre-computed)
  const momentumScore = n(marketData.momentumScore);
  const momentumPct = n(marketData.momentumPercent);

  if (momentumPct != null) {
    if (momentumPct > 2) {
      observations.push({ type: 'POSITIVE_MOMENTUM', value: round(momentumPct), description: `Positive momentum +${round(momentumPct)}%` });
    } else if (momentumPct < -2) {
      observations.push({ type: 'NEGATIVE_MOMENTUM', value: round(momentumPct), description: `Negative momentum ${round(momentumPct)}%` });
    }
  }

  // Strength: primarily from RSI, adjusted by momentum
  const rsiStrength = rsiValue != null ? clamp(Math.round(rsiValue)) : null;
  const strength = rsiStrength != null && momentumScore != null
    ? clamp(Math.round((rsiStrength + momentumScore) / 2))
    : rsiStrength;

  const limitations = [];
  if (rsiValue == null) limitations.push('RSI unavailable');
  if (momentumPct == null) limitations.push('Momentum data unavailable');

  return {
    family: EVIDENCE_FAMILY.MOMENTUM,
    direction,
    strength,
    observations,
    confidence: strength,
    limitations,
  };
}

// ============================================================================
// VOLUME FAMILY
// ============================================================================

/**
 * Build VOLUME evidence from market data.
 *
 * Anti-double-counting: RVOL and volume expansion are observations of the
 * SAME volume phenomenon. They are grouped, not counted as independent.
 *
 * @param {Object} marketData - pre-computed from market-engine.js
 * @returns {Object} VOLUME evidence family
 */
function buildVolumeEvidence(marketData) {
  const unavailable = {
    family: EVIDENCE_FAMILY.VOLUME,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Market data unavailable for volume analysis'],
  };

  if (!marketData) return unavailable;

  const rvol = n(marketData.relativeVolume);
  const volumeScore = n(marketData.volumeScore);
  const price = n(marketData.price);
  const resistance = n(marketData.resistance20);

  if (rvol == null && volumeScore == null) {
    return { ...unavailable, limitations: ['Volume data unavailable'] };
  }

  const observations = [];
  let direction = DIRECTION_ENUM.NEUTRAL;

  // RVOL — primary volume observation
  if (rvol != null) {
    if (rvol >= 2.0) {
      observations.push({ type: 'HIGH_RVOL', value: round(rvol), description: `RVOL ${round(rvol)}x — significantly elevated` });
      direction = price != null && resistance != null && price > resistance
        ? DIRECTION_ENUM.BULLISH
        : DIRECTION_ENUM.NEUTRAL;
    } else if (rvol >= 1.5) {
      observations.push({ type: 'ELEVATED_RVOL', value: round(rvol), description: `RVOL ${round(rvol)}x — elevated` });
    } else if (rvol >= 1.0) {
      observations.push({ type: 'NORMAL_RVOL', value: round(rvol), description: `RVOL ${round(rvol)}x — normal` });
    } else {
      observations.push({ type: 'LOW_RVOL', value: round(rvol), description: `RVOL ${round(rvol)}x — below average` });
    }
  }

  // Breakout volume confirmation (if near resistance)
  if (rvol != null && price != null && resistance != null) {
    const distPct = resistance > 0 ? ((resistance - price) / resistance) * 100 : 100;
    if (distPct < 2 && rvol >= 1.5) {
      observations.push({ type: 'BREAKOUT_VOLUME', description: 'Volume confirming near-resistance proximity' });
    }
  }

  const strength = volumeScore != null ? clamp(Math.round(volumeScore)) : null;

  const limitations = [];
  if (rvol == null) limitations.push('RVOL unavailable');
  if (volumeScore == null) limitations.push('Volume score unavailable');

  return {
    family: EVIDENCE_FAMILY.VOLUME,
    direction,
    strength,
    observations,
    confidence: strength,
    limitations,
  };
}

// ============================================================================
// VOLATILITY FAMILY
// ============================================================================

/**
 * Build VOLATILITY evidence from market data.
 *
 * Anti-double-counting: Bollinger squeeze, bandwidth, and ATR are
 * observations of the SAME volatility context. Grouped as one family.
 *
 * @param {Object} marketData - pre-computed from market-engine.js
 * @returns {Object} VOLATILITY evidence family
 */
function buildVolatilityEvidence(marketData) {
  const unavailable = {
    family: EVIDENCE_FAMILY.VOLATILITY,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Market data unavailable for volatility analysis'],
  };

  if (!marketData) return unavailable;

  const squeeze = marketData.squeeze === true;
  const bandwidth = n(marketData.bollingerBandwidth);
  const closes = Array.isArray(marketData.closes) ? marketData.closes : [];
  const highs = Array.isArray(marketData.highs) ? marketData.highs : [];
  const lows = Array.isArray(marketData.lows) ? marketData.lows : [];

  if (bandwidth == null && closes.length < 20) {
    return { ...unavailable, limitations: ['Insufficient data for volatility analysis'] };
  }

  // Calculate Bollinger if not pre-computed
  const bollinger = bandwidth != null
    ? { bandwidth, squeeze, score: squeeze ? 100 : bandwidth < 7 ? 90 : bandwidth < 9 ? 75 : 50 }
    : calculateBollinger(closes);

  const observations = [];

  // Bollinger squeeze observation
  if (bollinger && bollinger.squeeze) {
    observations.push({
      type: 'BOLLINGER_SQUEEZE',
      bandwidth: bollinger.bandwidth,
      description: `Bollinger bandwidth ${bollinger.bandwidth}% — squeeze detected`,
    });
  }

  // Bandwidth observation
  if (bollinger && bollinger.bandwidth != null) {
    if (bollinger.bandwidth < 5) {
      observations.push({ type: 'EXTREME_COMRESSION', description: 'Extreme volatility compression' });
    } else if (bollinger.bandwidth > 15) {
      observations.push({ type: 'HIGH_VOLATILITY', description: 'High volatility expansion' });
    }
  }

  // ATR observation
  const atr = calculateATR(highs, lows, closes);
  if (atr != null) {
    const price = n(marketData.price);
    const atrPct = price > 0 ? (atr / price) * 100 : null;
    if (atrPct != null) {
      if (atrPct > 5) {
        observations.push({ type: 'HIGH_ATR', value: atr, atrPct: round(atrPct), description: `ATR ${round(atrPct)}% — high volatility` });
      } else if (atrPct < 1.5) {
        observations.push({ type: 'LOW_ATR', value: atr, atrPct: round(atrPct), description: `ATR ${round(atrPct)}% — low volatility` });
      }
    }
  }

  // Strength from squeeze score
  const strength = bollinger && bollinger.score != null ? clamp(Math.round(bollinger.score)) : null;

  const limitations = [];
  if (bandwidth == null && closes.length < 20) limitations.push('Insufficient closes for Bollinger');
  if (atr == null) limitations.push('ATR unavailable');

  return {
    family: EVIDENCE_FAMILY.VOLATILITY,
    direction: DIRECTION_ENUM.NEUTRAL, // Volatility is not directional
    strength,
    observations,
    confidence: strength,
    limitations,
  };
}

// ============================================================================
// PATTERN FAMILY
// ============================================================================

/**
 * Build PATTERN evidence from candlestick + classical structural patterns.
 *
 * Anti-double-counting: candlestick patterns and structural patterns (FVG,
 * breaker, liquidity sweep) are ONE pattern family, not independent.
 *
 * @param {Object} marketData - raw OHLCV arrays
 * @param {Object} candlestickData - from buildCandlestickPatterns (optional)
 * @param {Object} classicalData - from buildClassicalTechnicalEvidence (optional)
 * @returns {Object} PATTERN evidence family
 */
function buildPatternEvidence(marketData, candlestickData = null, classicalData = null) {
  const unavailable = {
    family: EVIDENCE_FAMILY.PATTERN,
    direction: DIRECTION_ENUM.UNAVAILABLE,
    strength: null,
    observations: [],
    confidence: null,
    limitations: ['Insufficient data for pattern analysis'],
  };

  if (!marketData) return unavailable;

  const closes = Array.isArray(marketData.closes) ? marketData.closes : [];
  const highs = Array.isArray(marketData.highs) ? marketData.highs : [];
  const lows = Array.isArray(marketData.lows) ? marketData.lows : [];
  const volumes = Array.isArray(marketData.volumes) ? marketData.volumes : [];

  if (closes.length < 5) return unavailable;

  // Build candlestick patterns if not provided
  let csPatterns = candlestickData;
  if (!csPatterns && closes.length >= 5) {
    try {
      csPatterns = buildCandlestickPatterns({ closes, highs, lows, volumes });
    } catch {
      csPatterns = null;
    }
  }

  // Build classical evidence if not provided
  let classical = classicalData;
  if (!classical && closes.length >= 10) {
    try {
      classical = buildClassicalTechnicalEvidence({ closes, highs, lows, volumes });
    } catch {
      classical = null;
    }
  }

  const observations = [];
  let direction = DIRECTION_ENUM.NEUTRAL;
  let bullishPatterns = 0;
  let bearishPatterns = 0;

  // Candlestick patterns
  if (csPatterns && csPatterns.patterns) {
    for (const p of csPatterns.patterns) {
      if (p.type === 'BULLISH' || p.type === 'bullish') {
        bullishPatterns++;
        observations.push({ type: 'CANDLESTICK', subtype: p.name || p.type, direction: 'BULLISH', description: p.description || `${p.name} pattern detected` });
      } else if (p.type === 'BEARISH' || p.type === 'bearish') {
        bearishPatterns++;
        observations.push({ type: 'CANDLESTICK', subtype: p.name || p.type, direction: 'BEARISH', description: p.description || `${p.name} pattern detected` });
      }
    }
  }

  // Structural patterns (FVG, breaker, liquidity sweep, CRT)
  if (classical) {
    if (classical.fvg && classical.fvg.detected) {
      observations.push({ type: 'FVG', description: 'Fair Value Gap detected' });
    }
    if (classical.breaker && classical.breaker.detected) {
      observations.push({ type: 'BREAKER', description: 'Breaker pattern detected' });
    }
    if (classical.liquiditySweep && classical.liquiditySweep.detected) {
      observations.push({ type: 'LIQUIDITY_SWEEP', description: `Liquidity sweep: ${classical.liquiditySweep.sweepType}` });
    }
    if (classical.crt && classical.crt.available && classical.crt.confirmationState !== 'NONE') {
      observations.push({ type: 'CRT', confirmationState: classical.crt.confirmationState, description: `CRT confirmation: ${classical.crt.confirmationState}` });
    }
  }

  // Direction from pattern balance
  if (bullishPatterns > bearishPatterns) direction = DIRECTION_ENUM.BULLISH;
  else if (bearishPatterns > bullishPatterns) direction = DIRECTION_ENUM.BEARISH;

  // Strength: based on pattern count and confirmation
  const totalPatterns = bullishPatterns + bearishPatterns;
  const strength = totalPatterns > 0 ? clamp(totalPatterns * 20, 0, 100) : null;

  const limitations = [];
  if (!csPatterns) limitations.push('Candlestick pattern data unavailable');
  if (!classical) limitations.push('Classical structural pattern data unavailable');

  return {
    family: EVIDENCE_FAMILY.PATTERN,
    direction,
    strength,
    observations,
    confidence: strength,
    limitations,
  };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Build complete Technical Evidence across all 6 families.
 *
 * @param {Object} inputs
 * @param {Object} [inputs.marketData] - pre-computed from market-engine.js
 * @param {Object} [inputs.structureData] - from buildStructureIntelligence
 * @param {Object} [inputs.mtfData] - from buildMTFEvidence
 * @param {Object} [inputs.candlestickData] - from buildCandlestickPatterns
 * @param {Object} [inputs.classicalData] - from buildClassicalTechnicalEvidence
 * @param {string} [inputs.symbol]
 * @returns {Object} Technical Evidence with 6 families
 */
function buildTechnicalEvidence(inputs = {}) {
  const {
    marketData = null,
    structureData = null,
    mtfData = null,
    candlestickData = null,
    classicalData = null,
    symbol = null,
  } = inputs;

  const structure = buildStructureEvidence(structureData, mtfData);
  const trend = buildTrendEvidence(marketData);
  const momentum = buildMomentumEvidence(marketData);
  const volume = buildVolumeEvidence(marketData);
  const volatility = buildVolatilityEvidence(marketData);
  const pattern = buildPatternEvidence(marketData, candlestickData, classicalData);

  const families = [structure, trend, momentum, volume, volatility, pattern];

  // Overall confidence: average of available family confidences
  const confidences = families.map(f => f.confidence).filter(c => c != null);
  const overallConfidence = confidences.length > 0
    ? clamp(Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length))
    : null;

  // Overall direction: majority vote of directional families (not VOLATILITY)
  const directionalFamilies = families.filter(f => f.family !== EVIDENCE_FAMILY.VOLATILITY && f.direction !== DIRECTION_ENUM.UNAVAILABLE);
  let overallDirection = DIRECTION_ENUM.UNAVAILABLE;
  if (directionalFamilies.length > 0) {
    const bullishFamilies = directionalFamilies.filter(f => f.direction === DIRECTION_ENUM.BULLISH).length;
    const bearishFamilies = directionalFamilies.filter(f => f.direction === DIRECTION_ENUM.BEARISH).length;
    if (bullishFamilies > bearishFamilies) overallDirection = DIRECTION_ENUM.BULLISH;
    else if (bearishFamilies > bullishFamilies) overallDirection = DIRECTION_ENUM.BEARISH;
    else overallDirection = DIRECTION_ENUM.NEUTRAL;
  }

  // All limitations
  const allLimitations = families.flatMap(f => f.limitations || []);

  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    families: {
      structure,
      trend,
      momentum,
      volume,
      volatility,
      pattern,
    },
    overallDirection,
    overallConfidence,
    familyCount: families.length,
    availableFamilies: families.filter(f => f.direction !== DIRECTION_ENUM.UNAVAILABLE).length,
    limitations: allLimitations,
    disclaimer:
      'Technical Evidence provides structural context across 6 evidence families — not a buy/sell signal. ' +
      'Each family is an independent evidence block. Observations within a family are grouped to prevent double-counting. ' +
      'Missing data produces limitations, not false signals.',
  };
}

// ============================================================================
// DEFAULT
// ============================================================================

function defaultTechnicalEvidence(symbol = null) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),
    families: {
      structure: { family: EVIDENCE_FAMILY.STRUCTURE, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
      trend: { family: EVIDENCE_FAMILY.TREND, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
      momentum: { family: EVIDENCE_FAMILY.MOMENTUM, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
      volume: { family: EVIDENCE_FAMILY.VOLUME, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
      volatility: { family: EVIDENCE_FAMILY.VOLATILITY, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
      pattern: { family: EVIDENCE_FAMILY.PATTERN, direction: DIRECTION_ENUM.UNAVAILABLE, strength: null, observations: [], confidence: null, limitations: ['No data'] },
    },
    overallDirection: DIRECTION_ENUM.UNAVAILABLE,
    overallConfidence: null,
    familyCount: 6,
    availableFamilies: 0,
    limitations: ['No market data provided'],
    disclaimer:
      'Technical Evidence provides structural context across 6 evidence families — not a buy/sell signal. ' +
      'Each family is an independent evidence block. Observations within a family are grouped to prevent double-counting. ' +
      'Missing data produces limitations, not false signals.',
  };
}

export {
  buildTechnicalEvidence,
  defaultTechnicalEvidence,
  buildStructureEvidence,
  buildTrendEvidence,
  buildMomentumEvidence,
  buildVolumeEvidence,
  buildVolatilityEvidence,
  buildPatternEvidence,
  EVIDENCE_FAMILY,
  DIRECTION_ENUM,
};
