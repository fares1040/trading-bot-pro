/**
 * Opportunity Ranking Engine (C7)
 *
 * Deterministic cross-intelligence opportunity ranking engine that consumes
 * normalized outputs from B1–B6 and produces a unified 0–100 Opportunity Score
 * without double-counting evidence.
 *
 * Pure functions — no network calls, no fabrication, no look-ahead.
 * Missing data remains null. NaN/Infinity values are sanitized.
 * No BUY/SELL guarantees.
 *
 * Consumes:
 *   B1 — Penny Intelligence (lib/penny-intelligence-manager.js)
 *   B2 — Options Intelligence (lib/options-intelligence-manager.js)
 *   B3 — Institutional Radar (lib/institutional-radar-manager.js)
 *   B4 — Swing Intelligence (lib/swing-intelligence-manager.js)
 *   B5 — Early Explosion (lib/early-explosion-intelligence-manager.js)
 *   B6 — Catalyst Intelligence (lib/catalyst-intelligence-manager.js)
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

// ============================================================================
// DATA COMPLETENESS GUIDANCE (P1-3)
// ============================================================================
// Conservative guidance only — does not alter scores, ranking, or decisions.
// Based solely on actual data availability/completeness from B1-B6 sources.

function classifyDataCompleteness(dataCompleteness, availableCount, totalPossible = 6) {
  // Do NOT treat null/undefined/UNAVAILABLE as data presence.
  if (!Number.isFinite(dataCompleteness) || dataCompleteness <= 0 || availableCount <= 0) {
    return 'INSUFFICIENT';
  }
  // Only mark COMPLETE when all expected sources present with meaningful completeness.
  if (dataCompleteness >= 85 && availableCount >= 5) {
    return 'COMPLETE';
  }
  // PARTIAL when some sources contribute but coverage is not full.
  if (dataCompleteness >= 35 || (availableCount >= 2 && availableCount < 5)) {
    return 'PARTIAL';
  }
  return 'INSUFFICIENT';
}

// ============================================================================
// WEIGHTS & THRESHOLDS
// ============================================================================

const OPPORTUNITY_WEIGHTS = Object.freeze({
  pennyIntelligence: 0.15,
  optionsIntelligence: 0.15,
  institutionalRadar: 0.20,
  swingIntelligence: 0.20,
  earlyExplosion: 0.15,
  catalystIntelligence: 0.15,
});

const OPPORTUNITY_QUALITY_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});

const SOURCE_PRIORITY = [
  'institutionalRadar',
  'swingIntelligence',
  'catalystIntelligence',
  'earlyExplosion',
  'optionsIntelligence',
  'pennyIntelligence',
];

// ============================================================================
// SCORE EXTRACTION
// ============================================================================

function extractPennyScore(b1) {
  if (!b1 || typeof b1 !== 'object') return null;
  const score = n(b1.pennyScore) ?? n(b1.setupScore);
  if (score != null) return clamp(score);
  const alt = n(b1.hunterScore) ?? n(b1.hunter?.score) ?? n(b1.conviction?.score) ?? n(b1.unified?.score);
  return alt != null ? clamp(alt) : null;
}

function extractOptionsScore(b2) {
  if (!b2 || typeof b2 !== 'object') return null;
  // B2 (options-intelligence-manager.js) exposes aggregate scores on:
  //   - decision.decisionScore  (symbol-level decision engine, A2.5)
  //   - flow.flowScore           (directional options flow, A2)
  //   - summary.bestContractRankScore (best contract ranking, A2)
  //   - callScore / putScore     (side averages, may be null)
  // Prefer decisionScore (most complete aggregate) then fall back.
  const score = n(b2.decision?.decisionScore)
    ?? n(b2.flow?.flowScore)
    ?? n(b2.summary?.bestContractRankScore)
    ?? n(b2.optionsScore)
    ?? n(b2.callScore)
    ?? n(b2.putScore);
  return score != null ? clamp(score) : null;
}

function extractInstitutionalScore(b3) {
  if (!b3 || typeof b3 !== 'object') return null;
  const score = n(b3.institutionalScore) ?? n(b3.rankScore) ?? n(b3.decisionScore) ?? n(b3.secEdgarScore);
  return score != null ? clamp(score) : null;
}

function extractSwingScore(b4) {
  if (!b4 || typeof b4 !== 'object') return null;
  const score = n(b4.swingScore) ?? n(b4.setupScore);
  return score != null ? clamp(score) : null;
}

function extractExplosionScore(b5) {
  if (!b5 || typeof b5 !== 'object') return null;
  const score = n(b5.explosionScore);
  return score != null ? clamp(score) : null;
}

function extractCatalystScore(b6) {
  if (!b6 || typeof b6 !== 'object') return null;
  const score = n(b6.catalystScore);
  return score != null ? clamp(score) : null;
}

function extractScore(source, data) {
  const extractors = {
    pennyIntelligence: extractPennyScore,
    optionsIntelligence: extractOptionsScore,
    institutionalRadar: extractInstitutionalScore,
    swingIntelligence: extractSwingScore,
    earlyExplosion: extractExplosionScore,
    catalystIntelligence: extractCatalystScore,
  };
  const extractor = extractors[source];
  return extractor ? extractor(data) : null;
}

// ============================================================================
// DATA COMPLETENESS EXTRACTION
// ============================================================================

function extractDataCompleteness(data) {
  if (!data || typeof data !== 'object') return null;
  const dc = n(data.dataCompleteness);
  if (dc != null) return clamp(dc);
  // Try to infer from dataAvailability object
  if (data.dataAvailability && typeof data.dataAvailability === 'object') {
    const values = Object.values(data.dataAvailability).filter(Boolean);
    const total = Object.keys(data.dataAvailability).length;
    if (total > 0) {
      return clamp(Math.round((values.length / total) * 100));
    }
  }
  return null;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

function calculateConfidence(componentScores, dataCompleteness) {
  if (!componentScores || typeof componentScores !== 'object') return 0;
  const available = Object.entries(componentScores)
    .filter(([, v]) => v != null && typeof v === 'number' && Number.isFinite(v));

  const scoreCount = available.length;
  if (scoreCount === 0) return 0;

  // Base confidence on number of contributing sources (max 100)
  const sourceConfidence = clamp((scoreCount / 6) * 100);

  // If dataCompleteness is available, blend with it
  if (dataCompleteness != null) {
    return clamp((sourceConfidence * 0.6 + dataCompleteness * 0.4));
  }

  return sourceConfidence;
}

// ============================================================================
// OPPORTUNITY SCORE
// ============================================================================

function calculateOpportunityScore(sources) {
  const components = {};

  // Collect available scores with their weights
  const available = [];
  for (const [source, data] of Object.entries(sources)) {
    if (data == null) continue;
    const score = extractScore(source, data);
    if (score == null) continue;
    const weight = OPPORTUNITY_WEIGHTS[source];
    if (weight != null) {
      available.push({ score, weight, source });
      components[source + 'Score'] = score;
    }
  }

  if (available.length === 0) {
    return { opportunityScore: null, componentScores: null, availableComponents: [], usedWeights: {} };
  }

  // Renormalize weights
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = available.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.round(clamp(weightedSum / totalWeight));

  const componentScores = {};
  const usedWeights = {};
  const rawWeights = {};
  for (const c of available) {
    componentScores[c.source + 'Score'] = c.score;
    // Renormalized weight: each component's share of the total used weight.
    // These are the effective weights applied in the aggregation (sum to 1.0).
    usedWeights[c.source] = totalWeight > 0 ? round(c.weight / totalWeight, 4) : 0;
    rawWeights[c.source] = c.weight;
  }

  return {
    opportunityScore: score,
    componentScores,
    availableComponents: available.map((c) => c.source),
    usedWeights,
    rawWeights,
    totalWeightUsed: round(totalWeight, 4),
  };
}

// ============================================================================
// QUALITY CLASSIFICATION
// ============================================================================

function calculateOpportunityQuality(score) {
  if (score == null || !Number.isFinite(score)) return 'UNAVAILABLE';
  if (score >= OPPORTUNITY_QUALITY_THRESHOLDS.TOP) return 'TOP';
  if (score >= OPPORTUNITY_QUALITY_THRESHOLDS.STRONG) return 'STRONG';
  if (score >= OPPORTUNITY_QUALITY_THRESHOLDS.WATCH) return 'WATCH';
  if (score >= OPPORTUNITY_QUALITY_THRESHOLDS.WEAK) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// REASONS
// ============================================================================

function buildOpportunityReasons(sources, score, componentScores, confidence, quality) {
  const reasons = [];

  // Primary score
  if (score != null) {
    reasons.push(`Opportunity Score: ${score}/100`);
  } else {
    reasons.push('Insufficient cross-intelligence evidence for opportunity score');
  }

  // Available sources
  const availableSources = [];
  for (const [key, data] of Object.entries(sources)) {
    if (data != null) {
      availableSources.push(key);
      const s = extractScore(key, data);
      if (s != null) {
        reasons.push(`${key}: score ${s}/100`);
      }
    }
  }
  const unavailableSources = Object.keys(sources).filter((k) => !availableSources.includes(k));
  if (unavailableSources.length > 0) {
    reasons.push(`Missing intelligence: ${unavailableSources.join(', ')}`);
  }

  // Quality
  if (quality && quality !== 'UNAVAILABLE') {
    reasons.push(`Quality: ${quality}`);
  }

  // Confidence
  if (confidence != null) {
    const confLabel = confidence >= 80 ? 'High' : confidence >= 60 ? 'Moderate' : confidence >= 40 ? 'Low' : 'Very Low';
    reasons.push(`Confidence: ${confLabel} (${Math.round(confidence)}%)`);
  }

  // Data completeness
  const dc = extractDataCompleteness(sources.swingIntelligence || sources.earlyExplosion || sources.catalystIntelligence || null);
  if (dc != null) {
    reasons.push(`Data completeness: ${dc}%`);
  }

  return reasons.slice(0, 10);
}

// ============================================================================
// WARNINGS
// ============================================================================

function buildOpportunityWarnings(sources, score, quality, conflictingSignals) {
  const warnings = [];

  const available = Object.entries(sources).filter(([, d]) => d != null);
  const unavailable = Object.keys(sources).filter((k) => sources[k] == null);

  if (available.length === 0) {
    warnings.push('NO_INTELLIGENCE_AVAILABLE');
  }

  if (available.length < 6) {
    warnings.push(`PARTIAL_INTELLIGENCE: ${available.length} of 6 sources available`);
  }

  if (unavailable.length > 0) {
    warnings.push(`MISSING_SOURCES: ${unavailable.join(', ')}`);
  }

  if (score == null) {
    warnings.push('NO_OPPORTUNITY_SCORE');
  }

  if (quality === 'UNAVAILABLE' || quality === 'WEAK') {
    warnings.push('LOW_CONFIDENCE_OPPORTUNITY');
  }

  if (conflictingSignals && conflictingSignals.length > 0) {
    warnings.push('CONFLICTING_SIGNALS_DETECTED');
    for (const conflict of conflictingSignals.slice(0, 3)) {
      warnings.push(`CONFLICT: ${conflict}`);
    }
  }

  return warnings;
}

// ============================================================================
// FLAGS
// ============================================================================

function buildOpportunityFlags(sources, score, quality) {
  const flags = [];

  const availableCount = Object.values(sources).filter((d) => d != null).length;
  if (availableCount >= 4) flags.push('MULTI_SOURCE_CONFIRMED');
  if (availableCount >= 6) flags.push('FULL_INTELLIGENCE_COVERAGE');

  if (score != null) {
    if (score >= 85) flags.push('HIGH_OPPORTUNITY_SCORE');
    if (score >= 70) flags.push('STRONG_OPPORTUNITY_SCORE');
  }

  if (quality === 'TOP' || quality === 'STRONG') flags.push('QUALITY_CONFIRMED');

  // Source-specific flags
  for (const [key, data] of Object.entries(sources)) {
    if (data != null) {
      if (key === 'catalystIntelligence' && data.catalystScore != null) flags.push('CATALYST_CONFIRMED');
      if (key === 'earlyExplosion' && data.explosionScore != null) flags.push('VOLUME_CONFIRMED');
      if (key === 'institutionalRadar' && data.institutionalScore != null) flags.push('INSTITUTIONAL_CONFIRMED');
      if (key === 'swingIntelligence' && data.swingScore != null) flags.push('SWING_CONFIRMED');
      if (key === 'optionsIntelligence' && data.optionsScore != null) flags.push('OPTIONS_CONFIRMED');
      if (key === 'pennyIntelligence' && (data.pennyScore != null || data.setupScore != null)) flags.push('PENNY_CONFIRMED');
    }
  }

  return flags;
}

// ============================================================================
// RISK DETECTION
// ============================================================================

function buildOpportunityRisks(sources, score, conflicts) {
  const risks = [];

  // Missing intelligence risk
  const missing = Object.keys(sources).filter((k) => sources[k] == null);
  if (missing.length > 3) {
    risks.push({ label: 'INCOMPLETE_INTELLIGENCE', severity: 'HIGH', description: `Only ${6 - missing.length} of 6 intelligence sources available` });
  } else if (missing.length > 0) {
    risks.push({ label: 'PARTIAL_INTELLIGENCE', severity: 'MEDIUM', description: `Missing: ${missing.join(', ')}` });
  }

  // Conflict risk
  if (conflicts && conflicts.length > 0) {
    risks.push({ label: 'SIGNAL_CONFLICT', severity: 'MEDIUM', description: `${conflicts.length} conflicting signals detected across intelligence sources` });
  }

  // Low score risk
  if (score != null && score < 40) {
    risks.push({ label: 'LOW_OPPORTUNITY_SCORE', severity: 'MEDIUM', description: `Opportunity score ${score} below WEAK threshold` });
  }

  // Data quality risks from individual sources
  for (const [key, data] of Object.entries(sources)) {
    if (data == null) continue;

    if (key === 'earlyExplosion' && data.explosionRisk === 'HIGH') {
      risks.push({ label: 'EXPLOSION_VOLATILITY_RISK', severity: 'HIGH', description: 'Early Explosion intelligence flagged high volatility risk' });
    }

    if (key === 'catalystIntelligence' && data.catalystRisk === 'HIGH') {
      risks.push({ label: 'CATALYST_RISK', severity: 'HIGH', description: 'Catalyst intelligence flagged high catalyst risk' });
    }

    if (key === 'institutionalRadar') {
      if (data.institutionalRisk && data.institutionalRisk !== 'low') {
        risks.push({ label: 'INSTITUTIONAL_RISK', severity: data.institutionalRisk === 'high' ? 'HIGH' : 'MEDIUM', description: `Institutional risk: ${data.institutionalRisk}` });
      }
    }

    if (key === 'pennyIntelligence' && data.riskLabel === 'HIGH VOLATILITY') {
      risks.push({ label: 'PENNY_VOLATILITY_RISK', severity: 'MEDIUM', description: 'Penny intelligence flagged high volatility' });
    }
  }

  if (risks.length === 0) {
    risks.push({ label: 'NO_MAJOR_RISKS_IDENTIFIED', severity: 'LOW', description: 'No significant risk factors detected' });
  }

  return risks;
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Enhanced conflict detection across B1-B6 directional signals.
 * Detects inconsistencies between different intelligence sources and applies
 * a resolution strategy to determine the most reliable signal.
 */
function detectSignalConflicts(sources) {
  const conflicts = [];
  const signals = [];

  // Collect signals from each source
  for (const [key, data] of Object.entries(sources)) {
    if (data == null) continue;

    let signal = null;
    if (key === 'swingIntelligence' && data.signal) signal = data.signal;
    if (key === 'earlyExplosion' && data.signal) signal = data.signal;
    if (key === 'pennyIntelligence' && data.signal) signal = data.signal;

    if (signal) {
      signals.push({ source: key, signal });
    }
  }

  // --- Conflict Types ---

  // Type 1: Buy vs Sell conflict (direction disagreement)
  const buySignals = signals.filter((s) => s.signal && (s.signal.includes('BUY') || s.signal.includes('STRONG_BUY')));
  const sellSignals = signals.filter((s) => s.signal && (s.signal.includes('SELL') || s.signal.includes('STRONG_SELL')));

  if (buySignals.length > 0 && sellSignals.length > 0) {
    conflicts.push({
      type: 'DIRECTIONAL_CONFLICT',
      description: `Buy signal from ${buySignals.map((s) => s.source).join(', ')} vs Sell signal from ${sellSignals.map((s) => s.source).join(', ')}`,
      sources: buySignals.map(s => s.source),
      severity: 'HIGH'
    });
  }

  // Type 2: Confidence mismatch (high confidence vs low confidence)
  const highConfidence = signals.filter(s => s.confidence && s.confidence >= 80);
  const lowConfidence = signals.filter(s => s.confidence && s.confidence < 60);

  if (highConfidence.length > 0 && lowConfidence.length > 0) {
    conflicts.push({
      type: 'CONFIDENCE_CONFLICT',
      description: `High confidence signal from ${highConfidence.map(s => s.source).join(', ')} vs Low confidence signal from ${lowConfidence.map(s => s.source).join(', ')}`,
      sources: highConfidence.map(s => s.source),
      severity: 'MEDIUM'
    });
  }

  // Type 3: Quality disagreement (different quality ratings)
  const qualityMap = {};
  for (const s of signals) {
    if (s.quality && qualityMap[s.quality] === undefined) {
      qualityMap[s.quality] = s;
    }
  }

  // Find signals with different quality ratings
  const qualityGroups = Object.keys(qualityMap).filter(q => qualityMap[q] !== undefined);
  for (let i = 0; i < qualityGroups.length - 1; i++) {
    const current = qualityGroups[i];
    const next = qualityGroups[i + 1];

    if (current !== next) {
      conflicts.push({
        type: 'QUALITY_DISAGREEMENT',
        description: `Quality mismatch between ${current} and ${next} signals`,
        sources: [current, next],
        severity: 'MEDIUM'
      });
    }
  }

  // Type 4: Directional inconsistency (e.g., Bullish B1 but Bearish B3)
  const directionalSignals = signals.filter(s => s.direction === 'bullish' || s.direction === 'bearish');
  if (directionalSignals.length > 1) {
    conflicts.push({
      type: 'DIRECTIONAL_DISAGREEMENT',
      description: `Directional disagreement among signals: ${directionalSignals.map(s => `${s.source}: ${s.direction}`).join(', ')}`,
      sources: directionalSignals.map(s => s.source),
      severity: 'HIGH'
    });
  }

  return conflicts;
}

/**
 * Resolve conflicts between B1-B6 signals using a tiered priority system.
 * Higher priority sources are given precedence when conflicts arise.
 */
function resolveConflicts(sources, conflicts) {
  // Priority order: Institutional Radar, Options, Swing, Early Explosion, Penny
  const priorityOrder = [
    'institutionalRadar',
    'optionsIntelligence',
    'swingIntelligence',
    'earlyExplosion',
    'pennyIntelligence'
  ];

  // Group signals by source
  const signalsBySource = {};
  for (const [key, data] of Object.entries(sources)) {
    if (data != null) {
      signalsBySource[key] = signalsBySource[key] || [];
      signalsBySource[key].push(data);
    }
  }

  // For each conflict, apply resolution logic
  const resolvedConflicts = [];

  for (const conflict of conflicts) {
    const { type, description, sources } = conflict;

    // Determine resolution based on priority
    let resolved = false;
    let winningSource = null;

    for (const priority of priorityOrder) {
      if (signalsBySource[priority] && signalsBySource[priority].length > 0) {
        resolved = true;
        winningSource = priority;
        break;
      }
    }

    if (resolved && winningSource) {
      resolvedConflicts.push({
        ...conflict,
        resolved: true,
        resolution: `Prioritized ${winningSource} source signal over others`,
        winningSource: winningSource
      });
    } else {
      resolvedConflicts.push({
        ...conflict,
        resolved: false,
        reason: 'No clear priority source available - requires human review',
        suggestedAction: 'Flag for manual review by trader'
      });
    }
  }

  return resolvedConflicts;
}

// ============================================================================
// DATA AVAILABILITY
// ============================================================================

function buildQualityBreakdown(results) {
  const breakdown = {
    TOP: 0,
    STRONG: 0,
    WATCH: 0,
    WEAK: 0,
    UNAVAILABLE: 0,
  };
  if (!Array.isArray(results)) return breakdown;
  for (const r of results) {
    const q = r && (r.quality || 'UNAVAILABLE');
    if (breakdown[q] != null) breakdown[q]++;
    else breakdown.UNAVAILABLE++;
  }
  return breakdown;
}

function buildOpportunityDataAvailability(sources) {
  const availability = {
    pennyIntelligence: false,
    optionsIntelligence: false,
    institutionalRadar: false,
    swingIntelligence: false,
    earlyExplosion: false,
    catalystIntelligence: false,
  };

  for (const [key, data] of Object.entries(sources)) {
    if (data != null && availability.hasOwnProperty(key)) {
      availability[key] = true;
    }
  }

  return availability;
}

// ============================================================================
// CONFIDENCE LEVEL
// ============================================================================

function classifyConfidence(confidence) {
  if (confidence == null) return 'UNKNOWN';
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 60) return 'MODERATE';
  if (confidence >= 40) return 'LOW';
  return 'VERY_LOW';
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

function defaultOpportunityRanking(symbol) {
  return {
    symbol: symbol || null,
    timestamp: nowISO(),

    opportunityScore: null,
    quality: 'UNAVAILABLE',
    rank: null,
    confidence: 0,
    confidenceLevel: 'UNKNOWN',

    componentScores: {
      pennyIntelligenceScore: null,
      optionsIntelligenceScore: null,
      institutionalRadarScore: null,
      swingIntelligenceScore: null,
      earlyExplosionScore: null,
      catalystIntelligenceScore: null,
    },

    availableComponents: [],
    usedWeights: {},
    rawWeights: {},
    totalWeightUsed: 0,

    dataCompleteness: 0,
    dataAvailability: {
      pennyIntelligence: false,
      optionsIntelligence: false,
      institutionalRadar: false,
      swingIntelligence: false,
      earlyExplosion: false,
      catalystIntelligence: false,
    },

    evidenceAdjustment: null,
    evidenceReasons: null,
    reasons: ['No intelligence sources available for ranking'],
    warnings: ['NO_INTELLIGENCE_AVAILABLE', 'NO_OPPORTUNITY_SCORE', 'LOW_CONFIDENCE_OPPORTUNITY'],
    flags: [],
    risks: [{ label: 'NO_INTELLIGENCE_AVAILABLE', severity: 'HIGH', description: 'No intelligence sources available for analysis' }],

    sourceIntelligence: {},
    sourceScores: {},

    horizonEvidence: null,
    classicalEvidence: null,
    candlestickEvidence: null,
    gammaContext: null,

    provenance: {
      intelligence: 'C7',
      engine: 'C7 Opportunity Ranking',
    },

    disclaimer:
      'تحليل فرصة التداول مبني على بيانات مصادر ذكاء متاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Opportunity Ranking (C7) is analytical only — not a buy/sell recommendation. ' +
      'Missing intelligence sources remain null — never fabricated. ' +
      'Scores are evidence-weighted aggregations of B1–B6 outputs. ' +
      'Horizon, classical, candlestick, and gamma evidence are included when available.',
  };
}

function buildOpportunityRanking(symbol, sources, options = {}) {
  const defaultResult = defaultOpportunityRanking(symbol || null);

  if (!symbol) {
    return defaultResult;
  }

  if (!sources || typeof sources !== 'object') {
    return { ...defaultResult, symbol };
  }

  const availableCount = Object.keys(sources).filter((k) => sources[k] != null).length;
  if (availableCount === 0) {
    return {
      ...defaultResult,
      symbol,
      reasons: ['No intelligence sources provided for symbol'],
    };
  }

  // Extract scores from each source
  const b1 = sources.pennyIntelligence || null;
  const b2 = sources.optionsIntelligence || null;
  const b3 = sources.institutionalRadar || null;
  const b4 = sources.swingIntelligence || null;
  const b5 = sources.earlyExplosion || null;
  const b6 = sources.catalystIntelligence || null;

  // Extract optional methodology evidence (must come before evidence adjustment)
  const horizonEvidence = options.horizonEvidence || null;
  const classicalEvidence = options.classicalEvidence || null;
  const candlestickEvidence = options.candlestickEvidence || null;
  const gammaContext = options.gammaContext || null;

  const pennyScore = extractPennyScore(b1);
  const optionsScore = extractOptionsScore(b2);
  const institutionalScore = extractInstitutionalScore(b3);
  const swingScore = extractSwingScore(b4);
  const explosionScore = extractExplosionScore(b5);
  const catalystScore = extractCatalystScore(b6);

  // Data completeness from available sources
  const completenesses = [
    extractDataCompleteness(b1),
    extractDataCompleteness(b2),
    extractDataCompleteness(b3),
    extractDataCompleteness(b4),
    extractDataCompleteness(b5),
    extractDataCompleteness(b6),
  ].filter((dc) => dc != null);

  const avgDataCompleteness = completenesses.length > 0
    ? clamp(Math.round(completenesses.reduce((a, b) => a + b, 0) / completenesses.length))
    : 0;

  // Source scores object (only non-null)
  const sourceScores = {};
  if (pennyScore != null) sourceScores.pennyIntelligence = pennyScore;
  if (optionsScore != null) sourceScores.optionsIntelligence = optionsScore;
  if (institutionalScore != null) sourceScores.institutionalRadar = institutionalScore;
  if (swingScore != null) sourceScores.swingIntelligence = swingScore;
  if (explosionScore != null) sourceScores.earlyExplosion = explosionScore;
  if (catalystScore != null) sourceScores.catalystIntelligence = catalystScore;

  // Opportunity score
  const scoreResult = calculateOpportunityScore({
    pennyIntelligence: b1,
    optionsIntelligence: b2,
    institutionalRadar: b3,
    swingIntelligence: b4,
    earlyExplosion: b5,
    catalystIntelligence: b6,
  });

  let opportunityScore = scoreResult.opportunityScore;
  const qualityBeforeAdjustment = calculateOpportunityQuality(opportunityScore);

  // --- Classical / Candlestick evidence contribution (P1-5) ---
  // Available evidence can add limited, bounded support to the ranking.
  // Missing evidence does not penalize automatically.
  // adjustment is deterministic, bounded, and explainable.

  let evidenceAdjustment = 0;
  const evidenceReasons = [];

  // Classical evidence contribution
  if (classicalEvidence && typeof classicalEvidence === 'object') {
    const ms = classicalEvidence.marketStructure;
    const br = classicalEvidence.breaker;
    const fvg = classicalEvidence.fvg;
    const ls = classicalEvidence.liquiditySweep;
    const crt = classicalEvidence.crt;

    let classicalAdd = 0;
    if (ms && ms.mssDetected) classicalAdd += 1;
    if (br && br.detected) classicalAdd += 1;
    if (fvg && fvg.detected) classicalAdd += 1;
    if (ls && ls.detected && ls.sweepType === 'TURTLE_SOUP') classicalAdd += 1;
    if (crt && crt.confirmationState === 'CONFIRMED') classicalAdd += 1;
    if (classicalAdd > 0) {
      evidenceAdjustment = Math.min(evidenceAdjustment + classicalAdd, 2);
      if (classicalAdd === 1) evidenceReasons.push('Classical structure detected');
      else if (classicalAdd > 1) evidenceReasons.push('Multiple classical structures detected');
    }
  }

  // Candlestick evidence contribution
  if (candlestickEvidence && typeof candlestickEvidence === 'object' && candlestickEvidence.patterns) {
    const patternCount = candlestickEvidence.patterns.length;
    if (patternCount > 0) {
      evidenceAdjustment = Math.min(evidenceAdjustment + 1, 2);
      evidenceReasons.push(`${patternCount} candlestick pattern(s) detected`);
    }
  }

  // Apply bounded adjustment (max +2 total, never pushes score out of 0-100)
  if (evidenceAdjustment > 0 && opportunityScore != null) {
    const newScore = clamp(opportunityScore + evidenceAdjustment, 0, 100);
    // Only apply adjustment if it doesn't change quality classification
    const qualityAfterAdjustment = calculateOpportunityQuality(newScore);
    if (qualityAfterAdjustment === qualityBeforeAdjustment) {
      opportunityScore = newScore;
    }
  }

  const quality = calculateOpportunityQuality(opportunityScore);

  // Confidence
  const confidence = calculateConfidence(scoreResult.componentScores, avgDataCompleteness);
  const confidenceLevel = classifyConfidence(confidence);

  // Conflict detection
  const conflicts = detectSignalConflicts({
    pennyIntelligence: b1,
    optionsIntelligence: b2,
    institutionalRadar: b3,
    swingIntelligence: b4,
    earlyExplosion: b5,
    catalystIntelligence: b6,
  });

  // Conflict resolution
  const resolvedConflicts = resolveConflicts({
    pennyIntelligence: b1,
    optionsIntelligence: b2,
    institutionalRadar: b3,
    swingIntelligence: b4,
    earlyExplosion: b5,
    catalystIntelligence: b6,
  }, conflicts);

  // Build component scores object
  const componentScores = {
    pennyIntelligenceScore: pennyScore,
    optionsIntelligenceScore: optionsScore,
    institutionalRadarScore: institutionalScore,
    swingIntelligenceScore: swingScore,
    earlyExplosionScore: explosionScore,
    catalystIntelligenceScore: catalystScore,
  };

  // Available components (only those with non-null scores)
  const availableComponents = [];
  if (pennyScore != null) availableComponents.push('pennyIntelligence');
  if (optionsScore != null) availableComponents.push('optionsIntelligence');
  if (institutionalScore != null) availableComponents.push('institutionalRadar');
  if (swingScore != null) availableComponents.push('swingIntelligence');
  if (explosionScore != null) availableComponents.push('earlyExplosion');
  if (catalystScore != null) availableComponents.push('catalystIntelligence');

  // Data availability
  const dataAvailability = buildOpportunityDataAvailability(sources);

  // Provenance for each source
  const sourceIntelligence = {};
  for (const [key, data] of Object.entries(sources)) {
    if (data != null) {
      sourceIntelligence[key] = data.provenance || { intelligence: key, manager: key };
    }
  }

  // Reasons
  const reasons = buildOpportunityReasons(
    { pennyIntelligence: b1, optionsIntelligence: b2, institutionalRadar: b3, swingIntelligence: b4, earlyExplosion: b5, catalystIntelligence: b6 },
    opportunityScore,
    componentScores,
    confidence,
    quality
  );

  if (evidenceReasons.length > 0) {
    reasons.push('Evidence adjustment: ' + evidenceReasons.join('; '));
  }

  // Warnings
  const warnings = buildOpportunityWarnings(
    { pennyIntelligence: b1, optionsIntelligence: b2, institutionalRadar: b3, swingIntelligence: b4, earlyExplosion: b5, catalystIntelligence: b6 },
    opportunityScore,
    quality,
    conflicts
  );

  if (horizonEvidence && horizonEvidence.horizon === 'NOT_READY') {
    warnings.push('HORIZON_NOT_READY');
  } else if (horizonEvidence && horizonEvidence.horizon === 'UNAVAILABLE') {
    warnings.push('HORIZON_UNAVAILABLE');
  }

  if (classicalEvidence && classicalEvidence.marketStructure && classicalEvidence.marketStructure.mssDetected) {
    warnings.push('MARKET_STRUCTURE_SHIFT_DETECTED');
  }

  if (gammaContext && gammaContext.gammaAvailability === 'UNAVAILABLE') {
    warnings.push('GAMMA_DATA_UNAVAILABLE');
  }

  // Flags
  const flags = buildOpportunityFlags(
    { pennyIntelligence: b1, optionsIntelligence: b2, institutionalRadar: b3, swingIntelligence: b4, earlyExplosion: b5, catalystIntelligence: b6 },
    opportunityScore,
    quality
  );

  if (horizonEvidence) {
    if (horizonEvidence.horizon === 'HIGHEST_QUALITY') flags.push('HIGHEST_QUALITY_HORIZON');
    else if (horizonEvidence.horizon === 'HIGH_RISK_REWARD') flags.push('HIGH_RISK_REWARD_HORIZON');
    else if (horizonEvidence.horizon === 'EARLY_WATCHLIST') flags.push('EARLY_WATCHLIST_HORIZON');
    else if (horizonEvidence.horizon === 'NOT_READY') flags.push('NOT_READY_HORIZON');
  }

  if (classicalEvidence) {
    if (classicalEvidence.marketStructure && classicalEvidence.marketStructure.mssDetected) flags.push('MSS_DETECTED');
    if (classicalEvidence.breaker && classicalEvidence.breaker.detected) flags.push('BREAKER_DETECTED');
    if (classicalEvidence.fvg && classicalEvidence.fvg.detected) flags.push('FVG_DETECTED');
    if (classicalEvidence.liquiditySweep && classicalEvidence.liquiditySweep.detected && classicalEvidence.liquiditySweep.sweepType === 'TURTLE_SOUP') flags.push('TURTLE_SOUP_DETECTED');
    if (classicalEvidence.crt && classicalEvidence.crt.confirmationState === 'CONFIRMED') flags.push('CRT_CONFIRMED');
  }

  if (candlestickEvidence && candlestickEvidence.patterns && candlestickEvidence.patterns.length > 0) {
    flags.push('CANDLESTICK_PATTERNS_DETECTED');
  }

  if (gammaContext && gammaContext.gammaAvailability === 'AVAILABLE') {
    flags.push('GAMMA_DATA_AVAILABLE');
  }

  // Risks
  const risks = buildOpportunityRisks(
    { pennyIntelligence: b1, optionsIntelligence: b2, institutionalRadar: b3, swingIntelligence: b4, earlyExplosion: b5, catalystIntelligence: b6 },
    opportunityScore,
    conflicts
  );

  if (horizonEvidence && horizonEvidence.riskFragility && horizonEvidence.riskFragility.factors && horizonEvidence.riskFragility.factors.length > 0) {
    for (const f of horizonEvidence.riskFragility.factors) {
      if (f.includes('HIGH') || f.includes('FRAGILE') || f.includes('NO_INTELLIGENCE')) {
        risks.push({ label: f, severity: 'MEDIUM', description: `Horizon fragility factor: ${f}` });
      }
    }
  }

  return {
    symbol,
    timestamp: nowISO(),

    opportunityScore,
    quality,
    rank: null,
    confidence: round(confidence, 1),
    confidenceLevel,

    componentScores,
    availableComponents,
    usedWeights: scoreResult.usedWeights,
    rawWeights: scoreResult.rawWeights,
    totalWeightUsed: scoreResult.totalWeightUsed,

    dataCompleteness: avgDataCompleteness,
    dataAvailability,
    dataCompletenessGuidance: classifyDataCompleteness(avgDataCompleteness, availableComponents.length),

    evidenceAdjustment: evidenceAdjustment > 0 ? evidenceAdjustment : null,
    evidenceReasons: evidenceReasons.length > 0 ? evidenceReasons : null,
    reasons,
    warnings,
    flags,
    risks,

    sourceIntelligence,
    sourceScores,

    horizonEvidence,
    classicalEvidence,
    candlestickEvidence,
    gammaContext,

    provenance: {
      intelligence: 'C7',
      engine: 'C7 Opportunity Ranking',
      sources: {
        pennyIntelligence: b1?.provenance || null,
        optionsIntelligence: b2?.provenance || null,
        institutionalRadar: b3?.provenance || null,
        swingIntelligence: b4?.provenance || null,
        earlyExplosion: b5?.provenance || null,
        catalystIntelligence: b6?.provenance || null,
      },
    },

    disclaimer:
      'تحليل فرصة التداول مبني على بيانات مصادر ذكاء متاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Opportunity Ranking (C7) is analytical only — not a buy/sell recommendation. ' +
      'Missing intelligence sources remain null — never fabricated. ' +
      'Scores are evidence-weighted aggregations of B1–B6 outputs. ' +
      'No BUY/SELL guarantee. Not financial advice.',
  };
}

// ============================================================================
// RANKING
// ============================================================================

const QUALITY_ORDER = {
  TOP: 6,
  STRONG: 5,
  WATCH: 4,
  WEAK: 3,
  UNAVAILABLE: 1,
};

function rankOpportunities(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [], ranking: { method: 'opportunity_score', total: 0 } };
  }

  const sorted = [...results].sort((a, b) => {
    // Null scores go to the bottom
    const sa = a.opportunityScore ?? -1;
    const sb = b.opportunityScore ?? -1;
    if (sa === -1 && sb !== -1) return 1;
    if (sb === -1 && sa !== -1) return -1;
    if (sb !== sa) return sb - sa;

    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;

    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (cb !== ca) return cb - ca;

    const qa = QUALITY_ORDER[a.quality] || 0;
    const qb = QUALITY_ORDER[b.quality] || 0;
    if (qb !== qa) return qb - qa;

    const symA = (a.symbol || '').toString();
    const symB = (b.symbol || '').toString();
    return symA < symB ? -1 : symA > symB ? 1 : 0;
  });

  // Assign ranks
  const ranked = sorted.map((item, index) => ({ ...item, rank: index + 1 }));
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  const ranking = {
    method: 'opportunity_score_desc_then_data_completeness_confidence_quality_alpha',
    total: ranked.length,
    topCount: top.length,
    alternativesCount: alternatives.length,
  };

  return { ranked, top, alternatives, ranking };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  n,
  clamp,
  round,
  nowISO,
  OPPORTUNITY_WEIGHTS,
  OPPORTUNITY_QUALITY_THRESHOLDS,
  SOURCE_PRIORITY,
  extractPennyScore,
  extractOptionsScore,
  extractInstitutionalScore,
  extractSwingScore,
  extractExplosionScore,
  extractCatalystScore,
  extractScore,
  extractDataCompleteness,
  calculateConfidence,
  classifyConfidence,
  calculateOpportunityScore,
  calculateOpportunityQuality,
  buildOpportunityReasons,
  buildOpportunityWarnings,
  buildOpportunityFlags,
  buildOpportunityRisks,
  detectSignalConflicts,
  resolveConflicts,
  classifyDataCompleteness,
  buildOpportunityDataAvailability,
  buildQualityBreakdown,
  defaultOpportunityRanking,
  buildOpportunityRanking,
  rankOpportunities,
};

export default buildOpportunityRanking;
