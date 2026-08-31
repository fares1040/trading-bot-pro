const n = (value) => {
  if (value === null || value === undefined) return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
};

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

const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
});

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const ALERT_TYPES = Object.freeze({
  OPPORTUNITY: 'OPPORTUNITY',
  EARLY_EXPLOSION: 'EARLY_EXPLOSION',
  CATALYST: 'CATALYST',
  OPTIONS: 'OPTIONS',
  INSTITUTIONAL: 'INSTITUTIONAL',
  SWING: 'SWING',
  PENNY: 'PENNY',
  TRADE_PLAN: 'TRADE_PLAN',
  MARKET_REGIME: 'MARKET_REGIME',
  RISK: 'RISK',
  DATA_QUALITY: 'DATA_QUALITY',
  SIGNAL_CONFLICT: 'SIGNAL_CONFLICT',
});

const ALERT_STATUSES = Object.freeze({
  NEW: 'NEW',
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  EXPIRED: 'EXPIRED',
});

const DIRECTION_LABELS = Object.freeze({
  LONG: 'LONG',
  SHORT: 'SHORT',
  NEUTRAL: 'NEUTRAL',
  UNAVAILABLE: 'UNAVAILABLE',
});

function classifySeverity(score, riskLevel, dataCompleteness) {
  const s = n(score);
  const completeness = n(dataCompleteness);
  
  if (s == null && completeness == null) return 'INFO';
  
  // CRITICAL: score >= 90
  if (s != null && s >= 90) return SEVERITY_LEVELS.CRITICAL;
  
  // HIGH: score >= 75 OR completeness < 30
  if (s != null && s >= 75) return SEVERITY_LEVELS.HIGH;
  if (completeness != null && completeness < 30) return SEVERITY_LEVELS.HIGH;
  
  // MEDIUM: score >= 55 OR completeness < 50
  if (s != null && s >= 55) return SEVERITY_LEVELS.MEDIUM;
  if (completeness != null && completeness < 50) return SEVERITY_LEVELS.MEDIUM;
  
  // LOW: score >= 40
  if (s != null && s >= 40) return SEVERITY_LEVELS.LOW;
  
  // INFO: score < 40 AND completeness >= 70 AND completeness != null
  if (completeness != null && completeness >= 70) return SEVERITY_LEVELS.INFO;
  
  return SEVERITY_LEVELS.INFO;
}

function calculatePriority(severity, score, confidence, dataCompleteness, riskLevel) {
  const sevIndex = PRIORITY_ORDER.indexOf(severity || 'INFO');
  let basePriority = sevIndex * 20;
  
  if (score != null) {
    basePriority += Math.min(80, Math.max(0, score / 1.25) - 40);
  }
  
  if (confidence != null) {
    basePriority += confidence * 0.3;
  }
  
  if (dataCompleteness != null && dataCompleteness < 50) {
    basePriority -= 15;
  }
  
  const riskPenalty = {
    HIGH: -15,
    MODERATE: -8,
    LOW: -3,
    EXTREME: -25,
    UNAVAILABLE: 0,
  };
  basePriority += riskPenalty[riskLevel] ?? 0;
  
  return clamp(Math.max(1, Math.min(100, Math.round(basePriority))));
}

function generateAlertId(symbol, type, source) {
  const parts = [symbol, type, source];
  return parts.join('|');
}

function extractRawSymbol(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.symbol) return String(item.symbol).toUpperCase();
  return null;
}

function extractScoreFromSource(sourceKey, sourceData) {
  if (!sourceData || typeof sourceData !== 'object') return null;
  
  const scoreFields = [
    'opportunityScore', 'pennyScore', 'setupScore', 'swingScore',
    'explosionScore', 'catalystScore', 'planScore', 'decisionScore',
    'flowScore', 'institutionalScore', 'hunterScore',
  ];
  
  for (const field of scoreFields) {
    const val = n(sourceData[field]);
    if (val != null) return clamp(val);
  }
  
  if (sourceData.score != null) return clamp(n(sourceData.score));
  
  return null;
}

function extractDirectionBias(sources) {
  const candidates = [
    sources.tradePlan, sources.swingIntelligence, sources.earlyExplosion,
    sources.pennyIntelligence, sources.opportunityRanking, sources.institutionalRadar
  ];
  
  for (const c of candidates) {
    if (c && typeof c === 'object' && c.directionBias != null) {
      return String(c.directionBias);
    }
  }
  return null;
}

function normalizeDirection(direction) {
  if (direction == null) return DIRECTION_LABELS.UNAVAILABLE;
  const s = String(direction).toLowerCase();
  if (s.includes('bu') || s.includes('long') || s.includes('صاع') || s.includes('صاعد')) return DIRECTION_LABELS.LONG;
  if (s.includes('se') || s.includes('short') || s.includes('هابط') || s.includes('هاب')) return DIRECTION_LABELS.SHORT;
  if (s.includes('ن') || s.includes('neutral') || s.includes('sideways')) return DIRECTION_LABELS.NEUTRAL;
  return DIRECTION_LABELS.UNAVAILABLE;
}

function extractConfidence(sources) {
  const c7 = sources.opportunityRanking;
  if (c7?.confidence != null) return Math.round(n(c7.confidence));
  
  const b4 = sources.swingIntelligence;
  if (b4?.confidence != null) return Math.round(n(b4.confidence));
  
  const tp = sources.tradePlan;
  if (tp?.confidence != null) return Math.round(n(tp.confidence));
  
  const b1 = sources.pennyIntelligence;
  if (b1?.confidence != null) return Math.round(n(b1.confidence));
  
  return null;
}

function extractEvidence(sources, symbol) {
  const evidence = [];
  
  const score = extractScoreFromSource('opportunityRanking', sources.opportunityRanking) ||
                extractScoreFromSource('swingIntelligence', sources.swingIntelligence) ||
                extractScoreFromSource('pennyIntelligence', sources.pennyIntelligence);
  
  if (score != null) {
    evidence.push(`Score: ${score}/100`);
  }
  
  const c7 = sources.opportunityRanking;
  if (c7?.quality) evidence.push(`Quality: ${c7.quality}`);
  if (c7?.confidenceLevel) evidence.push(`Confidence: ${c7.confidenceLevel}`);
  
  const b4 = sources.swingIntelligence;
  if (b4?.setups && Array.isArray(b4.setups) && b4.setups.length > 0) {
    evidence.push(`Setups: ${b4.setups.map(s => s.type || 'setup').join(', ')}`);
  }
  if (b4?.signal) evidence.push(`Signal: ${b4.signal}`);
  
  const b5 = sources.earlyExplosion;
  if (b5?.setups && Array.isArray(b5.setups) && b5.setups.length > 0) {
    evidence.push(`Explosions: ${b5.setups.map(s => s.type || 'explosion').join(', ')}`);
  }
  if (b5?.signal) evidence.push(`Signal: ${b5.signal}`);
  
  const b6 = sources.catalystIntelligence;
  if (b6?.catalystTypes && Array.isArray(b6.catalystTypes) && b6.catalystTypes.length > 0) {
    evidence.push(`Catalysts: ${b6.catalystTypes.join(', ')}`);
  }
  if (b6?.catalystScore != null) {
    evidence.push(`Catalyst score: ${b6.catalystScore}/100`);
  }
  
  const b2 = sources.optionsIntelligence;
  if (b2?.decision?.decisionScore != null) {
    evidence.push(`Options decision: ${b2.decision.decisionScore}/100`);
  }
  if (b2?.flow?.callPutPressure) {
    evidence.push(`Options pressure: ${b2.flow.callPutPressure}`);
  }
  
  const b3 = sources.institutionalRadar;
  if (b3?.institutionalScore != null) {
    evidence.push(`Institutional score: ${b3.institutionalScore}/100`);
  }
  if (b3?.institutionalActivity) {
    evidence.push(`Activity: ${b3.institutionalActivity}`);
  }
  
  return evidence;
}

function extractRisks(sources) {
  const risks = [];
  
  const c7 = sources.opportunityRanking;
  if (Array.isArray(c7?.risks)) {
    for (const r of c7.risks) {
      if (r?.label && r?.severity) {
        risks.push({
          label: r.label,
          severity: r.severity,
          description: r.description || r.label,
        });
      }
    }
  }
  
  const tp = sources.tradePlan;
  if (Array.isArray(tp?.risks)) {
    for (const r of tp.risks) {
      if (r?.label && r?.severity && !risks.some(x => x.label === r.label)) {
        risks.push({
          label: r.label,
          severity: r.severity,
          description: r.description || r.label,
        });
      }
    }
  }
  
  const b4 = sources.swingIntelligence;
  if (Array.isArray(b4?.risks)) {
    for (const r of b4.risks) {
      if (r?.label && r?.severity && !risks.some(x => x.label === r.label)) {
        risks.push({
          label: r.label,
          severity: r.severity,
          description: r.description || r.label,
        });
      }
    }
  }
  
  if (sources.tradePlan?.warnings?.includes('CONFLICTING_SIGNALS_DETECTED') ||
      sources.opportunityRanking?.warnings?.includes('CONFLICTING_SIGNALS_DETECTED')) {
    if (!risks.some(x => x.label === 'SIGNAL_CONFLICT')) {
      risks.push({
        label: 'SIGNAL_CONFLICT',
        severity: 'HIGH',
        description: 'Conflicting signals detected across intelligence sources',
      });
    }
  }
  
  return risks;
}

function extractWarnings(sources) {
  const warnings = [];
  
  const c7 = sources.opportunityRanking;
  if (Array.isArray(c7?.warnings)) {
    warnings.push(...c7.warnings.filter(w => typeof w === 'string'));
  }
  
  const tp = sources.tradePlan;
  if (Array.isArray(tp?.warnings)) {
    warnings.push(...tp.warnings.filter(w => typeof w === 'string'));
  }
  
  const b4 = sources.swingIntelligence;
  if (Array.isArray(b4?.warnings)) {
    warnings.push(...b4.warnings.filter(w => typeof w === 'string'));
  }
  
  const b5 = sources.earlyExplosion;
  if (Array.isArray(b5?.warnings)) {
    warnings.push(...b5.warnings.filter(w => typeof w === 'string'));
  }
  
  return [...new Set(warnings)];
}

function extractDataAvailability(sources) {
  const availability = {
    pennyIntelligence: false,
    optionsIntelligence: false,
    institutionalRadar: false,
    swingIntelligence: false,
    earlyExplosion: false,
    catalystIntelligence: false,
    opportunityRanking: false,
    tradePlan: false,
    marketRegime: false,
  };
  
  const keys = Object.keys(sources);
  if (keys.includes('pennyIntelligence')) availability.pennyIntelligence = true;
  if (keys.includes('optionsIntelligence')) availability.optionsIntelligence = true;
  if (keys.includes('institutionalRadar')) availability.institutionalRadar = true;
  if (keys.includes('swingIntelligence')) availability.swingIntelligence = true;
  if (keys.includes('earlyExplosion')) availability.earlyExplosion = true;
  if (keys.includes('catalystIntelligence')) availability.catalystIntelligence = true;
  if (keys.includes('opportunityRanking')) availability.opportunityRanking = true;
  if (keys.includes('tradePlan')) availability.tradePlan = true;
  if (keys.includes('marketRegime')) availability.marketRegime = true;
  
  return availability;
}

function calculateDataCompleteness(sources) {
  const avail = extractDataAvailability(sources);
  const count = Object.values(avail).filter(Boolean).length;
  const total = Object.keys(avail).length;
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function buildAlertFromInputs(inputs, timestamp = nowISO()) {
  const alerts = [];
  const seenIds = new Set();
  
  if (!Array.isArray(inputs)) {
    return alerts;
  }
  
  const sourceMap = {
    'swingIntelligence': 'B4',
    'earlyExplosion': 'B5',
    'catalystIntelligence': 'B6',
    'optionsIntelligence': 'B2',
    'institutionalRadar': 'B3',
    'pennyIntelligence': 'B1',
    'opportunityRanking': 'C7',
    'tradePlan': 'C8',
  };
  
  for (const item of inputs) {
    if (!item || typeof item !== 'object') continue;
    if (!item.symbol) continue;
    
    const symbol = extractRawSymbol(item);
    if (!symbol) continue;
    
    const sources = item.sources || {};
    
    const score = extractScoreFromSource('opportunityRanking', sources.opportunityRanking) ||
                  extractScoreFromSource('swingIntelligence', sources.swingIntelligence) ||
                  extractScoreFromSource('pennyIntelligence', sources.pennyIntelligence) ||
                  extractScoreFromSource('tradePlan', sources.tradePlan);
    
    if (score == null) continue;
    
    const dataCompleteness = calculateDataCompleteness(sources);
    const directionBias = normalizeDirection(extractDirectionBias(sources));
    const confidence = extractConfidence(sources);
    
    const primarySource = Object.keys(sources).find(k => sources[k] != null) || 'aggregation';
    const severity = classifySeverity(score, sources.tradePlan?.riskLevel || sources.opportunityRanking?.risks?.[0]?.severity, dataCompleteness);
    const priority = calculatePriority(severity, score, confidence, dataCompleteness, sources.tradePlan?.riskLevel);
    
    const evidence = extractEvidence(sources, symbol);
    const risks = extractRisks(sources);
    const warnings = extractWarnings(sources);
    
    const signal = sources.tradePlan?.planSignal || sources.opportunityRanking?.quality ||
                   sources.swingIntelligence?.signal || sources.earlyExplosion?.signal || null;
    
    let alertType = ALERT_TYPES.OPPORTUNITY;
    if (sources.opportunityRanking) alertType = ALERT_TYPES.OPPORTUNITY;
    else if (sources.tradePlan) alertType = ALERT_TYPES.TRADE_PLAN;
    else if (sources.catalystIntelligence) alertType = ALERT_TYPES.CATALYST;
    else if (sources.earlyExplosion) alertType = ALERT_TYPES.EARLY_EXPLOSION;
    else if (sources.optionsIntelligence) alertType = ALERT_TYPES.OPTIONS;
    else if (sources.institutionalRadar) alertType = ALERT_TYPES.INSTITUTIONAL;
    else if (sources.swingIntelligence) alertType = ALERT_TYPES.SWING;
    else if (sources.pennyIntelligence) alertType = ALERT_TYPES.PENNY;
    
    const alertId = generateAlertId(symbol, alertType, primarySource);
    
    if (seenIds.has(alertId)) continue;
    seenIds.add(alertId);
    
    const alert = {
      id: alertId,
      symbol: symbol,
      type: alertType,
      category: alertType,
      severity,
      priority,
      title: `${symbol} — ${alertType.replace('_', ' ')}`,
      message: evidence.slice(0, 3).join(' • ') || 'No evidence available',
      directionBias,
      signal,
      score,
      confidence,
      timestamp,
      freshness: {
        evaluatedAt: timestamp,
        age: 0,
        status: 'FRESH',
      },
      source: `C${primarySource}`,
      provenance: {
        intelligence: 'D12',
        engine: 'Alert Center',
        sources: Object.keys(sources).filter(k => sources[k] != null),
      },
      evidence,
      risks,
      warnings,
      dataAvailability: extractDataAvailability(sources),
      actionable: priority >= 50 && directionBias !== 'UNAVAILABLE',
      status: ALERT_STATUSES.NEW,
      disclaimer: 'Alert Center aggregates evidence from B1-B6, C7-C10 — not a trade recommendation. Missing evidence remains null.',
    };
    
    alerts.push(alert);
  }
  
  return alerts;
}

function normalizeAlert(alert) {
  if (!alert || typeof alert !== 'object') return null;
  
  return {
    id: alert.id || generateAlertId(alert.symbol, alert.type || ALERT_TYPES.OPPORTUNITY, 'normalize'),
    symbol: alert.symbol,
    type: alert.type || ALERT_TYPES.OPPORTUNITY,
    category: alert.category || alert.type,
    severity: alert.severity || 'INFO',
    priority: typeof alert.priority === 'number' ? clamp(alert.priority) : 50,
    title: alert.title || `${alert.symbol} Alert`,
    message: alert.message,
    directionBias: alert.directionBias || DIRECTION_LABELS.UNAVAILABLE,
    signal: alert.signal,
    score: typeof alert.score === 'number' ? clamp(alert.score) : null,
    confidence: typeof alert.confidence === 'number' ? clamp(alert.confidence) : null,
    timestamp: alert.timestamp || nowISO(),
    freshness: alert.freshness || { evaluatedAt: nowISO(), age: 0, status: 'FRESH' },
    source: alert.source || 'C7-C8',
    provenance: alert.provenance || { intelligence: 'D12', engine: 'Alert Center' },
    evidence: Array.isArray(alert.evidence) ? alert.evidence : [],
    risks: Array.isArray(alert.risks) ? alert.risks : [],
    warnings: Array.isArray(alert.warnings) ? alert.warnings : [],
    dataAvailability: typeof alert.dataAvailability === 'object' ? alert.dataAvailability : {},
    actionable: Boolean(alert.actionable),
    status: alert.status || ALERT_STATUSES.NEW,
    disclaimer: alert.disclaimer || 'Alert Center is analytical only.',
  };
}

function filterAlerts(alerts, filters = {}) {
  if (!Array.isArray(alerts)) return [];
  if (!alerts.length) return [];
  
  const result = alerts.filter(alert => {
    if (alert.type) {
      return true;
    }
    const inferred = alert.category || ALERT_TYPES.OPPORTUNITY;
    alert.type = inferred;
    return true;
    if (filters.status && alert.status !== filters.status) return false;
    if (filters.source) {
      if (!alert.provenance?.sources?.includes(filters.source)) return false;
    }
    return true;
  });
  
  return result;
}

function rankAlerts(alerts, sortBy = 'priority', sortDir = 'desc') {
  if (!Array.isArray(alerts)) return [];
  if (!alerts.length) return [];
  
  const direction = sortDir === 'asc' ? 1 : -1;
  
  const ranker = (a, b) => {
    switch (sortBy) {
      case 'priority':
        return direction * (a.priority - b.priority);
      case 'severity':
        return direction * (PRIORITY_ORDER.indexOf(a.severity) - PRIORITY_ORDER.indexOf(b.severity));
      case 'score':
        return direction * ((a.score || 0) - (b.score || 0));
      case 'confidence':
        return direction * ((a.confidence || 0) - (b.confidence || 0));
      case 'freshness':
        return direction * (new Date(a.timestamp) - new Date(b.timestamp));
      case 'timestamp':
        return direction * (new Date(a.timestamp) - new Date(b.timestamp));
      case 'symbol':
        return direction * (a.symbol?.localeCompare(b.symbol) || 0);
      default:
        return 0;
    }
  };
  
  return [...alerts].sort(ranker);
}

function buildAlertSummary(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return {
      total: 0,
      byType: {},
      bySeverity: {},
      byStatus: {},
      bySymbol: {},
      dataCompleteness: 0,
    };
  }
  
  const byType = {};
  const bySeverity = {};
  const byStatus = {};
  const bySymbol = {};
  let totalCompleteness = 0;
  
  for (const alert of alerts) {
    const type = alert.type || 'UNKNOWN';
    byType[type] = (byType[type] || 0) + 1;
    
    const severity = alert.severity || 'INFO';
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    
    const status = alert.status || 'NEW';
    byStatus[status] = (byStatus[status] || 0) + 1;
    
    const symbol = alert.symbol;
    bySymbol[symbol] = (bySymbol[symbol] || 0) + 1;
    
    totalCompleteness += alert.dataAvailability || 0;
  }
  
  return {
    total: alerts.length,
    byType,
    bySeverity,
    byStatus,
    bySymbol,
    dataCompleteness: Math.round(totalCompleteness / alerts.length),
  };
}

function deduplicateAlerts(newAlerts, existingAlerts = []) {
  const seenKeys = new Set(existingAlerts.map(a => a.id));
  const deduplicated = [];
  
  for (const alert of newAlerts) {
    if (seenKeys.has(alert.id)) continue;
    seenKeys.add(alert.id);
    deduplicated.push(alert);
  }
  
  return deduplicated;
}

function buildAlertCenter(options = {}) {
  const inputs = options.inputs || [];
  const timestamp = options.timestamp || nowISO();
  const limit = options.limit || 100;
  const filters = options.filters || {};
  const sortBy = options.sortBy || 'priority';
  const sortDir = options.sortDir || 'desc';
  
  let alerts = buildAlertFromInputs(inputs, timestamp);
  
  alerts = filterAlerts(alerts, filters);
  alerts = rankAlerts(alerts, sortBy, sortDir);
  alerts = alerts.slice(0, limit);
  
  const summary = buildAlertSummary(alerts);
  
  const dataAvailability = {
    price: alerts.some(a => a.score != null),
    volume: alerts.some(a => a.dataAvailability?.pennyIntelligence),
    technicals: alerts.some(a => a.dataAvailability?.swingIntelligence),
    options: alerts.some(a => a.dataAvailability?.optionsIntelligence),
    institutional: alerts.some(a => a.dataAvailability?.institutionalRadar),
    catalyst: alerts.some(a => a.dataAvailability?.catalystIntelligence),
  };
  
  const qualityBreakdown = {
    TOP: 0,
    STRONG: 0,
    WATCH: 0,
    WEAK: 0,
    UNAVAILABLE: 0,
  };
  
  for (const alert of alerts) {
    if (alert.score >= 85) qualityBreakdown.TOP++;
    else if (alert.score >= 70) qualityBreakdown.STRONG++;
    else if (alert.score >= 55) qualityBreakdown.WATCH++;
    else if (alert.score >= 40) qualityBreakdown.WEAK++;
    else if (alert.score != null) qualityBreakdown.UNAVAILABLE++;
  }
  
  return {
    success: true,
    timestamp,
    count: alerts.length,
    alerts,
    top: alerts.slice(0, 5),
    summary,
    filters,
    dataAvailability,
    qualityBreakdown,
    limitations: alerts.length === 0 ? ['No alerts generated from available intelligence'] : [],
    disclaimer: 'Alert Center aggregates evidence from B1-B6, C7-C10. Alerts are analytical indicators only. Trade with proper risk management.',
  };
}

export {
  n,
  clamp,
  round,
  nowISO,
  SEVERITY_LEVELS,
  PRIORITY_ORDER,
  ALERT_TYPES,
  ALERT_STATUSES,
  DIRECTION_LABELS,
  buildAlertCenter,
  buildAlertFromInputs,
  normalizeAlert,
  classifySeverity,
  calculatePriority,
  filterAlerts,
  rankAlerts,
  buildAlertSummary,
  deduplicateAlerts,
  extractScoreFromSource,
  extractRawSymbol,
  generateAlertId,
  extractDirectionBias,
  normalizeDirection,
  extractConfidence,
  extractEvidence,
  extractRisks,
  extractWarnings,
  extractDataAvailability,
  calculateDataCompleteness,
};

export default buildAlertCenter;