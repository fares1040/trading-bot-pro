/**
 * SEC EDGAR Intelligence Engine (A6)
 *
 * Deterministic SEC filing analysis built on top of existing lib/sec-filings.js.
 * Converts SEC EDGAR submission data into structured, explainable trading intelligence.
 *
 * Pure function — no network calls.
 * Reuses lib/sec-filings.js for raw data fetching and risk detection.
 *
 * NO fabricated data. Missing information remains null.
 * No BUY/SELL guarantees. SEC data is informational only.
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
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function daysAgo(filingDate) {
  if (!filingDate) return null;
  const parsed = new Date(filingDate);
  if (!Number.isFinite(parsed.getTime())) return null;
  const now = new Date();
  const diff = now - parsed;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ============================================================================
// WEIGHTS & THRESHOLDS
// ============================================================================

const SEC_EDGAR_WEIGHTS = Object.freeze({
  filingSignificance: 0.25,
  filingRecency: 0.20,
  insiderSignal: 0.15,
  materialEvent: 0.15,
  capitalStructure: 0.15,
  dataCompleteness: 0.10,
});

const SEC_EDGAR_QUALITY_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});

// ============================================================================
// FILING CLASSIFICATION
// ============================================================================

const FILING_CATEGORIES = {
  '8-K': 'MATERIAL_EVENT',
  'S-1': 'OFFERING',
  'S-3': 'SHELF_REGISTRATION',
  '424B5': 'ATM_CAPITAL_RAISE',
  '424B': 'OFFERING',
  '10-K': 'EARNINGS',
  '10-Q': 'EARNINGS',
  '6-K': 'CORPORATE_UPDATE',
  '20-F': 'EARNINGS',
  '4': 'INSIDER_ACTIVITY',
  '144': 'OWNERSHIP_CHANGE',
  'DEF 14A': 'REGULATORY_EVENT',
};

const FILING_SIGNIFICANCE = {
  '8-K': 100,
  'S-1': 95,
  '424B5': 90,
  '424B': 85,
  'S-3': 80,
  '4': 75,
  '10-K': 70,
  '144': 65,
  '10-Q': 60,
  '20-F': 55,
  '6-K': 50,
  'DEF 14A': 45,
};

function classifyFilingType(form) {
  if (!form) return 'OTHER';
  const normalized = form.trim().toUpperCase();
  const exact = FILING_CATEGORIES[normalized];
  if (exact) return exact;

  if (normalized.startsWith('424B')) return 'OFFERING';
  if (normalized.startsWith('S-1')) return 'OFFERING';
  if (normalized.startsWith('S-3')) return 'SHELF_REGISTRATION';
  if (normalized.startsWith('10-K')) return 'EARNINGS';
  if (normalized.startsWith('10-Q')) return 'EARNINGS';
  if (normalized === '4') return 'INSIDER_ACTIVITY';
  if (normalized === '144') return 'OWNERSHIP_CHANGE';
  return 'OTHER';
}

function assessFilingSignificance(form) {
  if (!form) return null;
  const normalized = form.trim().toUpperCase();
  const score = FILING_SIGNIFICANCE[normalized];
  if (score != null) return score;
  if (normalized.startsWith('424B')) return 85;
  if (normalized.startsWith('S-1')) return 90;
  if (normalized.startsWith('S-3')) return 75;
  if (normalized.startsWith('10-K')) return 70;
  if (normalized.startsWith('10-Q')) return 60;
  if (normalized === '4') return 65;
  if (normalized === '144') return 60;
  return 30;
}

// ============================================================================
// FILING EXTRACTION
// ============================================================================

const ALL_RELEVANT_FORMS = [
  '8-K', 'S-1', 'S-3', '424B5', '424B', '10-Q', '10-K',
  '6-K', '20-F', '4', '144', 'DEF 14A',
  'S-1/A', 'S-3/A', '424B5/A', '424B/A',
];

function extractAllFilings(submissions) {
  if (!submissions || typeof submissions !== 'object' || !submissions.data) return [];

  const recent = submissions.data?.filings?.recent || {};
  const forms = recent.form || [];
  const dates = recent.filingDate || [];
  const accessions = recent.accessionNumber || [];
  const primaryDocs = recent.primaryDocument || [];
  const totals = recent.total || [];
  const prices = recent.price || [];
  const totalValues = recent.totalValue || [];
  const fileNumbers = recent.fileNumber || [];
  const transactionTypes = recent.transactionType || [];

  const filings = [];
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (!form) continue;

    const normalized = form.trim().toUpperCase();
    const isRelevant = ALL_RELEVANT_FORMS.some(f =>
      normalized === f || normalized.startsWith(f.replace(/\/A$/, ''))
    );

    if (!isRelevant) continue;

    filings.push({
      form,
      filingDate: dates[i] || null,
      accessionNumber: accessions[i] || null,
      primaryDocument: primaryDocs[i] || null,
      total: totals[i] != null ? Number(totals[i]) : null,
      price: prices[i] != null ? Number(prices[i]) : null,
      totalValue: totalValues[i] != null ? Number(totalValues[i]) : null,
      fileNumber: fileNumbers[i] || null,
      transactionType: transactionTypes[i] || null,
    });
  }

  return filings.slice(0, 50);
}

function extractFilingsFromData(secData) {
  if (secData?.filings && Array.isArray(secData.filings)) return secData.filings;
  if (secData?.submissions) return extractAllFilings(secData.submissions);
  if (secData?.rawFilings && Array.isArray(secData.rawFilings)) return secData.rawFilings;
  return [];
}

// ============================================================================
// INSIDER ACTIVITY DETECTION
// ============================================================================

function detectInsiderActivity(filings) {
  const form4Filings = filings.filter(f => {
    const form = (f.form || '').trim().toUpperCase();
    return form === '4' || form.startsWith('4/');
  });

  if (form4Filings.length === 0) return null;

  const mostRecent = form4Filings[0];

  let direction = null;
  if (mostRecent.transactionType) {
    const tt = String(mostRecent.transactionType).toUpperCase().trim();
    if (tt === 'P' || tt.includes('PURCHASE') || tt === 'BUY') {
      direction = 'BUY';
    } else if (tt === 'S' || tt.includes('SALE') || tt === 'SELL' || tt === 'D') {
      direction = 'SELL';
    }
  }

  const result = {
    form4Detected: true,
    filingDate: mostRecent.filingDate,
    daysAgo: daysAgo(mostRecent.filingDate),
    transactionShares: mostRecent.total != null ? Number(mostRecent.total) : null,
    transactionPrice: mostRecent.price != null ? Number(mostRecent.price) : null,
    transactionValue: mostRecent.totalValue != null ? Number(mostRecent.totalValue) : null,
    filingCount: form4Filings.length,
    direction,
  };

  if (result.transactionValue != null && result.transactionValue > 0) {
    result.transactionValue = round(result.transactionValue);
  }

  return result;
}

// ============================================================================
// MATERIAL EVENT DETECTION
// ============================================================================

function detectMaterialEvents(filings) {
  const materialForms = ['8-K'];
  const materialFilings = filings.filter(f => {
    const form = (f.form || '').trim().toUpperCase();
    return materialForms.some(mf => form === mf || form.startsWith(mf + '/'));
  });

  if (materialFilings.length === 0) return null;

  const latest = materialFilings[0];
  return {
    materialEventDetected: true,
    filingDate: latest.filingDate,
    daysAgo: daysAgo(latest.filingDate),
    form: latest.form,
    filingCount: materialFilings.length,
  };
}

// ============================================================================
// CAPITAL STRUCTURE / FINANCING DETECTION
// ============================================================================

function detectCapitalStructureSignals(filings) {
  const signals = [];

  const offeringFilings = filings.filter(f => {
    const form = (f.form || '').trim().toUpperCase();
    return form === 'S-1' || form === 'S-3' || form.startsWith('424B') || form === 'S-1/A' || form === 'S-3/A';
  });

  if (offeringFilings.length > 0) {
    const latest = offeringFilings[0];
    let offeringType = 'OFFERING';
    if (latest.form === 'S-3' || latest.form === 'S-3/A') offeringType = 'SHELF_REGISTRATION';
    if (latest.form === '424B5') offeringType = 'ATM';
    if (latest.form === 'S-1' || latest.form === 'S-1/A') offeringType = 'REGISTERED_OFFERING';

    signals.push({
      type: 'OFFERING',
      form: latest.form,
      filingDate: latest.filingDate,
      daysAgo: daysAgo(latest.filingDate),
      offeringType,
    });
  }

  const form144Filings = filings.filter(f => {
    const form = (f.form || '').trim().toUpperCase();
    return form === '144' || form.startsWith('144/');
  });

  if (form144Filings.length > 0) {
    const latest = form144Filings[0];
    signals.push({
      type: 'OWNERSHIP_CHANGE',
      form: latest.form,
      filingDate: latest.filingDate,
      daysAgo: daysAgo(latest.filingDate),
    });
  }

  return signals.length > 0 ? signals : null;
}

// ============================================================================
// SCORING HELPERS
// ============================================================================

function calculateRecencyScore(filingDate) {
  if (!filingDate) return null;
  const ago = daysAgo(filingDate);
  if (ago == null) return null;
  if (ago <= 1) return 100;
  if (ago <= 3) return 90;
  if (ago <= 7) return 80;
  if (ago <= 14) return 70;
  if (ago <= 30) return 60;
  if (ago <= 60) return 45;
  if (ago <= 90) return 30;
  if (ago <= 180) return 20;
  return 10;
}

function calculateSignificanceScore(filings) {
  if (!filings || filings.length === 0) return null;
  const maxSig = Math.max(...filings.map(f => assessFilingSignificance(f.form) || 0));
  const count = Math.min(filings.length, 5);
  const countBoost = count >= 3 ? 10 : count >= 2 ? 5 : 0;
  return clamp(maxSig + countBoost);
}

function calculateInsiderScore(insiderInfo) {
  if (!insiderInfo || !insiderInfo.form4Detected) return null;
  let score = 50;
  if (insiderInfo.daysAgo != null) {
    if (insiderInfo.daysAgo <= 3) score += 30;
    else if (insiderInfo.daysAgo <= 7) score += 20;
    else if (insiderInfo.daysAgo <= 30) score += 10;
  }
  if (insiderInfo.transactionValue != null) score += 10;
  return clamp(score);
}

function calculateMaterialEventScore(materialInfo) {
  if (!materialInfo || !materialInfo.materialEventDetected) return null;
  let score = 60;
  if (materialInfo.daysAgo != null) {
    if (materialInfo.daysAgo <= 3) score += 25;
    else if (materialInfo.daysAgo <= 7) score += 15;
    else if (materialInfo.daysAgo <= 30) score += 5;
  }
  return clamp(score);
}

function calculateCapitalStructureScore(signals, secRiskScore) {
  if (signals && signals.length > 0) {
    let maxScore = 50;
    for (const s of signals) {
      if (s.daysAgo != null) {
        const recencyScore = calculateRecencyScore(s.filingDate) || 50;
        maxScore = Math.max(maxScore, recencyScore + 20);
      }
    }
    return clamp(maxScore);
  }
  if (secRiskScore != null) {
    return clamp(50 - Math.abs(secRiskScore - 50) / 2);
  }
  return null;
}

// ============================================================================
// SCORING
// ============================================================================

function calculateDataCompletenessScore(filings) {
  if (!filings || filings.length === 0) return null;

  let complete = 0;
  const total = filings.length;
  const requiredFields = ['form', 'filingDate', 'accessionNumber'];

  for (const f of filings) {
    const hasAll = requiredFields.every(field => f[field] != null && f[field] !== '');
    if (hasAll) complete++;
  }

  return Math.round((complete / total) * 100);
}

function calculateSecEdgarScore(secData) {
  const filings = extractFilingsFromData(secData);
  const insiderInfo = detectInsiderActivity(filings);
  const materialInfo = detectMaterialEvents(filings);
  const capitalSignals = detectCapitalStructureSignals(filings);

  const scoringData = {
    filings,
    insiderInfo,
    materialInfo,
    capitalSignals,
    secRiskScore: secData?.secRiskScore ?? null,
    secDataStatus: secData?.secDataStatus ?? 'unavailable',
  };

  const componentScores = {
    filingSignificance: calculateSignificanceScore(filings),
    filingRecency: null,
    insiderSignal: calculateInsiderScore(insiderInfo),
    materialEvent: calculateMaterialEventScore(materialInfo),
    capitalStructure: calculateCapitalStructureScore(capitalSignals, secData?.secRiskScore),
    dataCompleteness: null,
  };

  if (filings.length > 0) {
    const latestFiling = filings[0];
    componentScores.filingRecency = calculateRecencyScore(latestFiling.filingDate);
  }
  componentScores.dataCompleteness = calculateDataCompletenessScore(filings);

  const components = [
    { score: componentScores.filingSignificance, weight: SEC_EDGAR_WEIGHTS.filingSignificance },
    { score: componentScores.filingRecency, weight: SEC_EDGAR_WEIGHTS.filingRecency },
    { score: componentScores.insiderSignal, weight: SEC_EDGAR_WEIGHTS.insiderSignal },
    { score: componentScores.materialEvent, weight: SEC_EDGAR_WEIGHTS.materialEvent },
    { score: componentScores.capitalStructure, weight: SEC_EDGAR_WEIGHTS.capitalStructure },
    { score: componentScores.dataCompleteness, weight: SEC_EDGAR_WEIGHTS.dataCompleteness },
  ];

  const available = components.filter(c => c.score != null);
  let secEdgarScore = null;
  if (available.length > 0) {
    const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = available.reduce((sum, c) => sum + c.score * c.weight, 0);
    secEdgarScore = Math.round(clamp(weightedSum / totalWeight));
  }

  return {
    secEdgarScore,
    componentScores,
    scoringData,
    filings,
    insiderInfo,
    materialInfo,
    capitalSignals,
  };
}

function classifySecEdgarQuality(score) {
  if (score == null) return 'UNAVAILABLE';
  if (score >= SEC_EDGAR_QUALITY_THRESHOLDS.TOP) return 'TOP';
  if (score >= SEC_EDGAR_QUALITY_THRESHOLDS.STRONG) return 'STRONG';
  if (score >= SEC_EDGAR_QUALITY_THRESHOLDS.WATCH) return 'WATCH';
  if (score >= SEC_EDGAR_QUALITY_THRESHOLDS.WEAK) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// EXPLAINABILITY
// ============================================================================

function buildSecEdgarReasons(scoringData, secData) {
  const reasons = [];
  const { filings, insiderInfo, materialInfo, capitalSignals } = scoringData;

  if (filings.length > 0) {
    const latest = filings[0];
    reasons.push(`Latest filing: ${latest.form} on ${latest.filingDate || '—'}`);
  }

  if (materialInfo?.materialEventDetected) {
    reasons.push(`8-K material event detected (${materialInfo.daysAgo != null ? materialInfo.daysAgo + ' days ago' : 'recently'})`);
  }

  if (insiderInfo?.form4Detected) {
    reasons.push(`Form 4 insider transaction detected (${insiderInfo.filingCount} filing(s))`);
  }

  if (capitalSignals && capitalSignals.length > 0) {
    for (const signal of capitalSignals.slice(0, 2)) {
      if (signal.type === 'OFFERING') {
        reasons.push(`${signal.offeringType} detected via ${signal.form} (${signal.daysAgo != null ? signal.daysAgo + ' days ago' : 'recently'})`);
      } else if (signal.type === 'OWNERSHIP_CHANGE') {
        reasons.push(`Form 144 ownership change detected (${signal.daysAgo != null ? signal.daysAgo + ' days ago' : 'recently'})`);
      }
    }
  }

  if (secData?.dilutionRisk && secData.dilutionRisk !== 'unavailable' && secData.dilutionRisk !== 'none') {
    reasons.push(`Dilution risk: ${secData.dilutionRisk} - ${secData.dilutionReason || ''}`);
  }

  if (secData?.offeringRisk && secData.offeringRisk !== 'unavailable' && secData.offeringRisk !== 'none') {
    reasons.push(`Offering risk: ${secData.offeringRisk}`);
  }

  if (filings.length === 0 && secData?.secDataStatus === 'no_filings') {
    reasons.push('No recent SEC filings found');
  }

  if (filings.length === 0 && secData?.secDataStatus === 'unavailable') {
    reasons.push('SEC data unavailable');
  }

  if (filings.length === 0 && secData?.secDataStatus === 'ok') {
    reasons.push('SEC data available but no relevant filings matched');
  }

  return reasons.slice(0, 6);
}

function buildSecEdgarWarnings(scoringData, secData) {
  const warnings = [];
  const { filings, insiderInfo, materialInfo } = scoringData;

  if (secData?.secDataStatus === 'unavailable') {
    warnings.push('SEC_DATA_UNAVAILABLE');
  }

  if (secData?.secDataStatus === 'no_filings') {
    warnings.push('NO_FILINGS');
  }

  if (insiderInfo?.form4Detected && insiderInfo.transactionValue == null) {
    warnings.push('INSUFFICIENT_FILING_DETAIL');
  }

  if (filings.length > 0) {
    const latest = filings[0];
    const filingDaysAgo = daysAgo(latest.filingDate);
    if (filingDaysAgo == null || filingDaysAgo > 90) {
      warnings.push('STALE_FILING_DATA');
    }

    if (latest.form === '8-K' && filingDaysAgo != null && filingDaysAgo > 30) {
      warnings.push('MATERIAL_EVENT_OLD');
    }
  }

  if (insiderInfo?.form4Detected && insiderInfo.direction === null) {
    warnings.push('INSUFFICIENT_INSIDER_DIRECTION');
  }

  if (filings.length === 0) {
    warnings.push('NO_RECENT_FILINGS');
  }

  return warnings;
}

function buildSecEdgarFlags(scoringData, secData) {
  const flags = [];
  const { filings, insiderInfo, materialInfo, capitalSignals } = scoringData;

  if (materialInfo?.materialEventDetected) flags.push('MATERIAL_EVENT');
  if (insiderInfo?.form4Detected) flags.push('INSIDER_ACTIVITY');
  if (capitalSignals && capitalSignals.length > 0) flags.push('CAPITAL_STRUCTURE_EVENT');

  if (secData?.dilutionRisk && secData.dilutionRisk !== 'unavailable' && secData.dilutionRisk !== 'none') {
    flags.push('DILUTION_RISK');
  }
  if (secData?.offeringRisk && secData.offeringRisk !== 'unavailable' && secData.offeringRisk !== 'none') {
    flags.push('OFFERING_RISK');
  }
  if (secData?.warrantRisk && secData.warrantRisk !== 'unavailable' && secData.warrantRisk !== 'none') {
    flags.push('WARRANT_RISK');
  }
  if (secData?.convertibleRisk && secData.convertibleRisk !== 'unavailable' && secData.convertibleRisk !== 'none') {
    flags.push('CONVERTIBLE_RISK');
  }
  if (secData?.reverseSplitRisk && secData.reverseSplitRisk !== 'unavailable' && secData.reverseSplitRisk !== 'none') {
    flags.push('REVERSE_SPLIT');
  }

  const form4Count = filings.filter(f => f.form === '4').length;
  if (form4Count > 0) flags.push('FORM_4_FILED');

  const has8K = filings.some(f => (f.form || '') === '8-K');
  if (has8K) flags.push('HAS_8K');

  const hasOffering = filings.some(f => {
    const form = (f.form || '').trim().toUpperCase();
    return form === 'S-1' || form === 'S-3' || form.startsWith('424B');
  });
  if (hasOffering) flags.push('HAS_OFFERING');

  const hasEarnings = filings.some(f => f.form === '10-K' || f.form === '10-Q' || f.form === '20-F');
  if (hasEarnings) flags.push('HAS_EARNINGS');

  if (insiderInfo?.transactionValue != null && insiderInfo.transactionValue >= 100000) {
    flags.push('HIGH_VALUE_INSIDER_TXN');
  }

  return flags;
}

// ============================================================================
// DATA AVAILABILITY
// ============================================================================

function calculateSecDataAvailability(secData, filings, insiderInfo, materialInfo) {
  const availability = {
    filings: filings && filings.length > 0,
    insiderActivity: insiderInfo?.form4Detected === true,
    materialEvents: materialInfo?.materialEventDetected === true,
    dilutionRisk: secData?.dilutionRisk != null && secData.dilutionRisk !== 'unavailable',
    offeringRisk: secData?.offeringRisk != null && secData.offeringRisk !== 'unavailable',
    warrantRisk: secData?.warrantRisk != null && secData.warrantRisk !== 'unavailable',
    reverseSplitRisk: secData?.reverseSplitRisk != null && secData.reverseSplitRisk !== 'unavailable',
    secRiskScore: secData?.secRiskScore != null,
    cik: !!secData?.cik,
  };

  const availableCount = Object.values(availability).filter(Boolean).length;
  const totalCount = Object.keys(availability).length;
  const dataCompleteness = Math.round((availableCount / totalCount) * 100);

  return { availability, dataCompleteness };
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

function defaultSecEdgarIntelligence(symbol) {
  return {
    symbol: symbol || null,
    secEdgarScore: null,
    quality: 'UNAVAILABLE',
    componentScores: {
      filingSignificance: null,
      filingRecency: null,
      insiderSignal: null,
      materialEvent: null,
      capitalStructure: null,
      dataCompleteness: null,
    },
    filingCategory: 'OTHER',
    latestFiling: null,
    filingHistory: [],
    insiderActivity: null,
    materialEventInfo: null,
    capitalStructureSignals: null,
    secRiskScore: null,
    secRiskLevel: 'unavailable',
    dilutionRisk: 'unavailable',
    dilutionReason: null,
    offeringRisk: 'unavailable',
    offeringType: null,
    warrantRisk: 'unavailable',
    convertibleRisk: 'unavailable',
    reverseSplitRisk: 'unavailable',
    reasons: [],
    warnings: ['SEC_DATA_UNAVAILABLE'],
    flags: [],
    dataAvailability: {
      filings: false,
      insiderActivity: false,
      materialEvents: false,
      dilutionRisk: false,
      offeringRisk: false,
      warrantRisk: false,
      reverseSplitRisk: false,
      secRiskScore: false,
      cik: false,
    },
    dataCompleteness: 0,
    secDataStatus: 'unavailable',
    disclaimer: 'SEC EDGAR Intelligence is analytical only. Not a buy/sell recommendation. Data from SEC EDGAR.',
  };
}

function buildSecEdgarIntelligence(secData, symbol) {
  if (!secData) {
    return defaultSecEdgarIntelligence(symbol);
  }

  const scoringResult = calculateSecEdgarScore(secData);
  const { filings, insiderInfo, materialInfo, capitalSignals, secEdgarScore, componentScores } = scoringResult;

  const quality = classifySecEdgarQuality(secEdgarScore);

  let filingCategory = filings.length > 0 ? classifyFilingType(filings[0].form) : 'OTHER';

  if (insiderInfo?.form4Detected && insiderInfo?.direction) {
    if (insiderInfo.direction === 'BUY') filingCategory = 'INSIDER_BUYING';
    else if (insiderInfo.direction === 'SELL') filingCategory = 'INSIDER_SELLING';
  }

  const latestFiling = filings.length > 0
    ? {
        form: filings[0].form,
        filingDate: filings[0].filingDate,
        accessionNumber: filings[0].accessionNumber,
        primaryDocument: filings[0].primaryDocument,
        total: filings[0].total,
        price: filings[0].price,
        totalValue: filings[0].totalValue,
        daysAgo: daysAgo(filings[0].filingDate),
      }
    : null;

  const filingHistory = filings.map(f => ({
    form: f.form,
    filingDate: f.filingDate,
    accessionNumber: f.accessionNumber,
    daysAgo: daysAgo(f.filingDate),
  })).slice(0, 20);

  const reasons = buildSecEdgarReasons(
    { filings, insiderInfo, materialInfo, capitalSignals },
    secData
  );
  const warnings = buildSecEdgarWarnings(
    { filings, insiderInfo, materialInfo },
    secData
  );
  const flags = buildSecEdgarFlags(
    { filings, insiderInfo, materialInfo, capitalSignals },
    secData
  );

  const { availability, dataCompleteness: dcScore } = calculateSecDataAvailability(
    secData, filings, insiderInfo, materialInfo
  );

  return {
    symbol: symbol || secData?.symbol || null,
    secEdgarScore,
    quality,
    componentScores,
    filingCategory,
    latestFiling,
    filingHistory,
    insiderActivity: insiderInfo,
    materialEventInfo: materialInfo,
    capitalStructureSignals: capitalSignals,
    secRiskScore: secData?.secRiskScore ?? null,
    secRiskLevel: secData?.secRiskLevel ?? 'unavailable',
    dilutionRisk: secData?.dilutionRisk ?? 'unavailable',
    dilutionReason: secData?.dilutionReason ?? null,
    offeringRisk: secData?.offeringRisk ?? 'unavailable',
    offeringType: secData?.offeringType ?? null,
    offeringDate: secData?.offeringDate ?? null,
    warrantRisk: secData?.warrantRisk ?? 'unavailable',
    convertibleRisk: secData?.convertibleRisk ?? 'unavailable',
    reverseSplitRisk: secData?.reverseSplitRisk ?? 'unavailable',
    reasons,
    warnings,
    flags,
    dataAvailability: availability,
    dataCompleteness: dcScore,
    secDataStatus: secData?.secDataStatus ?? 'unavailable',
    cik: secData?.cik ?? null,
    disclaimer: 'SEC EDGAR Intelligence is analytical only. Not a buy/sell recommendation. Data from SEC EDGAR.',
  };
}

// ============================================================================
// RANKING
// ============================================================================

function rankSecOpportunities(results) {
  if (!Array.isArray(results)) return { ranked: [], top: [], alternatives: [] };

  const sorted = [...results].sort((a, b) => {
    const sa = a.secEdgarScore ?? -1;
    const sb = b.secEdgarScore ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;
    const la = a.latestFiling?.daysAgo ?? 9999;
    const lb = b.latestFiling?.daysAgo ?? 9999;
    return la - lb;
  });

  const ranked = sorted.slice(0, 20);
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  return { ranked, top, alternatives };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  n,
  clamp,
  round,
  daysAgo,
  classifyFilingType,
  assessFilingSignificance,
  extractAllFilings,
  detectInsiderActivity,
  detectMaterialEvents,
  detectCapitalStructureSignals,
  calculateRecencyScore,
  calculateSignificanceScore,
  calculateInsiderScore,
  calculateMaterialEventScore,
  calculateCapitalStructureScore,
  calculateDataCompletenessScore,
  calculateSecEdgarScore,
  classifySecEdgarQuality,
  buildSecEdgarReasons,
  buildSecEdgarWarnings,
  buildSecEdgarFlags,
  calculateSecDataAvailability,
  buildSecEdgarIntelligence,
  defaultSecEdgarIntelligence,
  rankSecOpportunities,
  SEC_EDGAR_WEIGHTS,
  SEC_EDGAR_QUALITY_THRESHOLDS,
};

export default buildSecEdgarIntelligence;
