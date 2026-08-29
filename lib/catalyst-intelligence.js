/**
 * Catalyst Intelligence Engine (B6)
 *
 * Deterministic, pure-function catalyst intelligence that normalizes evidence
 * from existing providers (SEC EDGAR A6, market-engine, etc.) into a unified
 * Catalyst Score + classification without fabricating any events.
 *
 * Pure functions — no network calls. No BUY/SELL guarantees.
 * Missing data preserved as null. Never fabricated.
 *
 * Reuses:
 *   A6 — SEC EDGAR Intelligence (lib/sec-edgar-intelligence.js)
 *   — market-engine.js for market data
 *
 * Catalyst types are mapped from SEC filing categories and existing intelligence
 * flags. If no verified evidence exists, output is NO_VERIFIED_CATALYST / UNAVAILABLE.
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

function daysAgo(dateOrString) {
  if (!dateOrString) return null;
  const parsed = new Date(dateOrString);
  if (!Number.isFinite(parsed.getTime())) return null;
  const now = new Date();
  const diff = now - parsed;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isFutureDate(dateOrString) {
  if (!dateOrString) return false;
  const parsed = new Date(dateOrString);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.getTime() > Date.now();
}

function isNullOrEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

function getCatalystDaysAgo(date) {
  if (!date) return null;
  return daysAgo(date);
}

function normalizeCatalysts(catalysts) {
  if (!Array.isArray(catalysts)) return [];
  return catalysts
    .map(normalizeCatalyst)
    .filter((c) => c !== null);
}

// ============================================================================
// WEIGHTS & THRESHOLDS
// ============================================================================

const CATALYST_WEIGHTS = Object.freeze({
  significance: 0.30,
  recency: 0.20,
  reliability: 0.20,
  freshness: 0.15,
  marketRelevance: 0.10,
  dataCompleteness: 0.05,
});

const CATALYST_QUALITY_THRESHOLDS = Object.freeze({
  TOP: 85,
  STRONG: 70,
  WATCH: 55,
  WEAK: 40,
});

const CATALYST_TYPE_PRIORITY = [
  'SEC_MATERIAL_EVENT',
  'EARNINGS',
  'SEC_OFFERING',
  'SEC_DILUTION',
  'SEC_FINANCING',
  'FDA_REGULATORY',
  'CONTRACT_DEAL',
  'PARTNERSHIP',
  'PRODUCT_LAUNCH',
  'ANALYST_ACTION',
  'INSIDER_ACTIVITY',
  'CORPORATE_EVENT',
  'MACRO_SECTOR_EVENT',
  'OTHER',
  'UNAVAILABLE',
];

const RECENCY_MAP = [
  { max: 1, score: 100 },
  { max: 3, score: 90 },
  { max: 7, score: 80 },
  { max: 14, score: 65 },
  { max: 30, score: 45 },
  { max: 90, score: 25 },
];

function recencyScoreFromDaysAgo(daysAgo) {
  if (daysAgo == null || !Number.isFinite(daysAgo)) return null;
  if (daysAgo < 0) return null;
  for (const band of RECENCY_MAP) {
    if (daysAgo <= band.max) return band.score;
  }
  return 0;
}

function classifyRecency(daysAgo) {
  if (daysAgo == null) return 'UNKNOWN';
  if (daysAgo < 0) return 'UPCOMING';
  if (daysAgo <= 1) return 'REALTIME';
  if (daysAgo <= 3) return 'VERY_RECENT';
  if (daysAgo <= 7) return 'RECENT';
  if (daysAgo <= 30) return 'MODERATE';
  if (daysAgo <= 90) return 'AGING';
  return 'STALE';
}

// ============================================================================
// CATALYST TYPE CLASSIFICATION
// ============================================================================

const FORM_TO_CATALYST_TYPE = {
  '8-K': 'SEC_MATERIAL_EVENT',
  'S-1': 'SEC_OFFERING',
  'S-3': 'SEC_FINANCING',
  '424B5': 'SEC_OFFERING',
  '424B': 'SEC_OFFERING',
  '10-K': 'EARNINGS',
  '10-Q': 'EARNINGS',
  '20-F': 'EARNINGS',
  '6-K': 'CORPORATE_EVENT',
  '4': 'INSIDER_ACTIVITY',
  '144': 'INSIDER_ACTIVITY',
  'DEF 14A': 'CORPORATE_EVENT',
  'S-1/A': 'SEC_OFFERING',
  'S-3/A': 'SEC_FINANCING',
  '424B5/A': 'SEC_OFFERING',
  '424B/A': 'SEC_OFFERING',
};

const FILING_CATEGORY_TO_TYPE = {
  MATERIAL_EVENT: 'SEC_MATERIAL_EVENT',
  OFFERING: 'SEC_OFFERING',
  SHELF_REGISTRATION: 'SEC_FINANCING',
  ATM_CAPITAL_RAISE: 'SEC_OFFERING',
  EARNINGS: 'EARNINGS',
  CORPORATE_UPDATE: 'CORPORATE_EVENT',
  INSIDER_ACTIVITY: 'INSIDER_ACTIVITY',
  OWNERSHIP_CHANGE: 'INSIDER_ACTIVITY',
  REGULATORY_EVENT: 'FDA_REGULATORY',
  OTHER: 'OTHER',
  INSIDER_BUYING: 'INSIDER_ACTIVITY',
  INSIDER_SELLING: 'INSIDER_ACTIVITY',
  DILUTION_RISK: 'SEC_DILUTION',
  FINANCING: 'SEC_FINANCING',
};

function classifyCatalystType(secFiling, filingCategory, flag) {
  if (secFiling && typeof secFiling === 'object') {
    const form = (secFiling.form || '').trim().toUpperCase();
    if (form && FORM_TO_CATALYST_TYPE[form]) {
      return FORM_TO_CATALYST_TYPE[form];
    }
  }

  if (filingCategory && typeof filingCategory === 'string') {
    const mapped = FILING_CATEGORY_TO_TYPE[filingCategory];
    if (mapped) return mapped;
  }

  if (flag && typeof flag === 'string') {
    const flagTypeMap = {
      HAS_8K: 'SEC_MATERIAL_EVENT',
      HAS_OFFERING: 'SEC_OFFERING',
      HAS_EARNINGS: 'EARNINGS',
      FORM_4_FILED: 'INSIDER_ACTIVITY',
      MATERIAL_EVENT: 'SEC_MATERIAL_EVENT',
      INSIDER_ACTIVITY: 'INSIDER_ACTIVITY',
      CAPITAL_STRUCTURE_EVENT: 'SEC_OFFERING',
      DILUTION_RISK: 'SEC_DILUTION',
      OFFERING_RISK: 'SEC_OFFERING',
      HIGH_VALUE_INSIDER_TXN: 'INSIDER_ACTIVITY',
    };
    if (flagTypeMap[flag]) return flagTypeMap[flag];
  }

  return null;
}

// ============================================================================
// CATALYST RECENCY
// ============================================================================

function calculateCatalystRecency(date, filingDate) {
  const refDate = date || filingDate;
  if (!refDate) return null;
  return recencyScoreFromDaysAgo(daysAgo(refDate));
}

// ============================================================================
// CATALYST SIGNIFICANCE
// ============================================================================

const FORM_SIGNIFICANCE = {
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

function assessFormSignificance(form) {
  if (!form) return null;
  const normalized = form.trim().toUpperCase();
  const score = FORM_SIGNIFICANCE[normalized];
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

function calculateCatalystSignificance(form, filingCategory, flag) {
  if (form && typeof form === 'string') {
    const formScore = assessFormSignificance(form);
    if (formScore != null) return formScore;
  }

  const SIGNIFICANCE_BY_CATEGORY = {
    SEC_MATERIAL_EVENT: 90,
    EARNINGS: 70,
    SEC_OFFERING: 85,
    SEC_FINANCING: 80,
    SEC_DILUTION: 75,
    FDA_REGULATORY: 80,
    CONTRACT_DEAL: 70,
    PARTNERSHIP: 65,
    PRODUCT_LAUNCH: 60,
    ANALYST_ACTION: 50,
    INSIDER_ACTIVITY: 55,
    CORPORATE_EVENT: 50,
    MACRO_SECTOR_EVENT: 40,
    OTHER: 30,
  };

  if (filingCategory && typeof filingCategory === 'string') {
    const mapped = FILING_CATEGORY_TO_TYPE[filingCategory];
    if (mapped && SIGNIFICANCE_BY_CATEGORY[mapped]) {
      return SIGNIFICANCE_BY_CATEGORY[mapped];
    }
  }

  const SIGNIFICANCE_BY_FLAG = {
    HAS_8K: 90,
    HAS_EARNINGS: 70,
    MATERIAL_EVENT: 90,
    HAS_OFFERING: 85,
    FORM_4_FILED: 55,
    HIGH_VALUE_INSIDER_TXN: 65,
    INSIDER_ACTIVITY: 55,
    CAPITAL_STRUCTURE_EVENT: 85,
    DILUTION_RISK: 75,
    OFFERING_RISK: 80,
  };

  if (flag && typeof flag === 'string' && SIGNIFICANCE_BY_FLAG[flag]) {
    return SIGNIFICANCE_BY_FLAG[flag];
  }

  return null;
}

function significanceLabel(score) {
  if (score == null) return 'UNKNOWN';
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 30) return 'LOW';
  return 'UNKNOWN';
}

// ============================================================================
// CATALYST RELIABILITY
// ============================================================================

function classifyReliability(source, secDataStatus) {
  if (source === 'SEC EDGAR' || source === 'sec-edgar-intelligence') return 'VERIFIED';
  if (secDataStatus === 'ok') return 'VERIFIED';
  if (source === null || source === undefined) return 'UNAVAILABLE';
  return 'MODERATE';
}

// ============================================================================
// CATALYST FRESHNESS
// ============================================================================

// Freshness = how recent the source intelligence refresh is (based on filing recency).
// Reuses the same recency logic — if the latest filing is fresh, the intelligence is fresh.
function calculateCatalystFreshness(latestFilingDate) {
  if (!latestFilingDate) return null;
  const days = daysAgo(latestFilingDate);
  if (days == null) return null;
  return recencyScoreFromDaysAgo(days);
}

// ============================================================================
// MARKET RELEVANCE
// ============================================================================

function calculateMarketRelevance(symbol, marketData, catalystDate) {
  if (!symbol) return null;

  let score = 0;
  let components = 0;

  if (marketData) {
    components++;
    if (marketData.price != null) {
      score += 20;
    }
    if (marketData.relativeVolume != null && marketData.relativeVolume > 1.0) {
      score += 30;
    }
    if (marketData.rsi != null) {
      score += 20;
    }
  }

  components++;
  if (catalystDate && !isFutureDate(catalystDate)) {
    const days = daysAgo(catalystDate);
    if (days != null && days <= 30) {
      score += 30;
    }
  }

  if (components === 0) return null;
  return clamp(score);
}

// ============================================================================
// DATA COMPLETENESS
// ============================================================================

function calculateCatalystDataCompleteness(secIntelligence) {
  if (!secIntelligence || typeof secIntelligence !== 'object') return null;

  const dc = secIntelligence.dataCompleteness;
  if (dc != null) {
    const num = Number(dc);
    return Number.isFinite(num) ? clamp(num) : null;
  }

  const da = secIntelligence.dataAvailability;
  if (da && typeof da === 'object') {
    const values = Object.values(da).filter(Boolean);
    const total = Object.keys(da).length;
    if (total > 0) {
      return clamp(Math.round((values.length / total) * 100));
    }
  }

  return null;
}

// ============================================================================
// CATALYST SCORE
// ============================================================================

function calculateCatalystScore(components) {
  const weighted = [];
  const available = [];

  const componentMap = {
    significance: { score: components.significance, weight: CATALYST_WEIGHTS.significance },
    recency: { score: components.recency, weight: CATALYST_WEIGHTS.recency },
    reliability: { score: components.reliability, weight: CATALYST_WEIGHTS.reliability },
    freshness: { score: components.freshness, weight: CATALYST_WEIGHTS.freshness },
    marketRelevance: { score: components.marketRelevance, weight: CATALYST_WEIGHTS.marketRelevance },
    dataCompleteness: { score: components.dataCompleteness, weight: CATALYST_WEIGHTS.dataCompleteness },
  };

  for (const [key, entry] of Object.entries(componentMap)) {
    if (entry.score != null && Number.isFinite(entry.score)) {
      weighted.push(entry);
      available.push(key);
    }
  }

  if (weighted.length === 0) {
    return { catalystScore: null, componentScores: null, usedComponents: [] };
  }

  const totalWeight = weighted.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return { catalystScore: null, componentScores: null, usedComponents: [] };

  const weightedSum = weighted.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.round(clamp(weightedSum / totalWeight));

  const componentScores = {};
  for (const [key, entry] of Object.entries(componentMap)) {
    componentScores[key] = entry.score != null && Number.isFinite(entry.score) ? entry.score : null;
  }

  return { catalystScore: score, componentScores, usedComponents: available };
}

// ============================================================================
// QUALITY CLASSIFICATION
// ============================================================================

function calculateCatalystQuality(score) {
  if (score == null || !Number.isFinite(score)) return 'UNAVAILABLE';
  if (score >= CATALYST_QUALITY_THRESHOLDS.TOP) return 'TOP';
  if (score >= CATALYST_QUALITY_THRESHOLDS.STRONG) return 'STRONG';
  if (score >= CATALYST_QUALITY_THRESHOLDS.WATCH) return 'WATCH';
  if (score >= CATALYST_QUALITY_THRESHOLDS.WEAK) return 'WEAK';
  return 'UNAVAILABLE';
}

// ============================================================================
// NORMALIZE CATALYST
// ============================================================================

function normalizeCatalyst(rawCatalyst) {
  if (!rawCatalyst || typeof rawCatalyst !== 'object') return null;

  const type = rawCatalyst.type || rawCatalyst.catalystType || null;
  if (!type) return null;

  const date = rawCatalyst.date || rawCatalyst.filingDate || rawCatalyst.catalystDate || null;
  const daysAgo = date ? getCatalystDaysAgo(date) : null;

  return {
    type: type,
    date: date,
    daysAgo: daysAgo,
    upcoming: date ? isFutureDate(date) : false,
    description: rawCatalyst.description || rawCatalyst.event || null,
    source: rawCatalyst.source || 'unknown',
    form: rawCatalyst.form || null,
    filingDate: rawCatalyst.filingDate || null,
    transactionValue: rawCatalyst.transactionValue || null,
    direction: rawCatalyst.direction || null,
  };
}

// ============================================================================
// EXTRACT CATALYSTS FROM SEC INTELLIGENCE
// ============================================================================

function extractSecCatalysts(secIntelligence, symbol) {
  if (!secIntelligence || typeof secIntelligence !== 'object') return [];
  if (secIntelligence.quality === 'UNAVAILABLE' && !secIntelligence.latestFiling) return [];

  const catalysts = [];
  const seen = new Set();

  // Latest filing as a catalyst
  const latestFiling = secIntelligence.latestFiling;
  if (latestFiling && latestFiling.form) {
    const key = `${symbol}:${latestFiling.form}:${latestFiling.filingDate || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      const catalystType = classifyCatalystType(latestFiling, secIntelligence.filingCategory, null);
      if (catalystType) {
        catalysts.push({
          type: catalystType,
          date: latestFiling.filingDate,
          description: `Latest SEC filing: ${latestFiling.form}`,
          source: 'SEC EDGAR',
          form: latestFiling.form,
          filingDate: latestFiling.filingDate,
        });
      }
    }
  }

  // Material events (8-K)
  const materialInfo = secIntelligence.materialEventInfo;
  if (materialInfo && materialInfo.materialEventDetected) {
    const key = `${symbol}:SEC_MATERIAL_EVENT:${materialInfo.filingDate || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      catalysts.push({
        type: 'SEC_MATERIAL_EVENT',
        date: materialInfo.filingDate,
        description: `8-K material event detected (${materialInfo.filingCount} filing(s))`,
        source: 'SEC EDGAR',
        form: materialInfo.form || '8-K',
        filingDate: materialInfo.filingDate,
      });
    }
  }

  // Insider activity (Form 4)
  const insiderInfo = secIntelligence.insiderActivity;
  if (insiderInfo && insiderInfo.form4Detected) {
    const key = `${symbol}:INSIDER_ACTIVITY:${insiderInfo.filingDate || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      catalysts.push({
        type: 'INSIDER_ACTIVITY',
        date: insiderInfo.filingDate,
        description: `Form 4 insider transaction detected (${insiderInfo.filingCount} filing(s))`,
        source: 'SEC EDGAR',
        form: '4',
        filingDate: insiderInfo.filingDate,
        transactionValue: insiderInfo.transactionValue,
        direction: insiderInfo.direction,
      });
    }
  }

  // Capital structure signals (offerings, etc.)
  const capitalSignals = secIntelligence.capitalStructureSignals;
  if (capitalSignals && Array.isArray(capitalSignals)) {
    for (const signal of capitalSignals) {
      if (signal && signal.type && signal.filingDate) {
        const sigType = signal.type === 'OFFERING' ? classifyCatalystType(null, signal.offeringType || 'OFFERING', 'HAS_OFFERING') :
                        signal.type === 'OWNERSHIP_CHANGE' ? 'INSIDER_ACTIVITY' :
                        signal.type || null;
        if (sigType) {
          const key = `${symbol}:${sigType}:${signal.filingDate}`;
          if (!seen.has(key)) {
            seen.add(key);
            catalysts.push({
              type: sigType,
              date: signal.filingDate,
              description: `${signal.offeringType || signal.type} detected via ${signal.form || 'SEC filing'}`,
              source: 'SEC EDGAR',
              form: signal.form || null,
              filingDate: signal.filingDate,
            });
          }
        }
      }
    }
  }

  // Flags as additional catalyst evidence
  const flags = secIntelligence.flags;
  if (Array.isArray(flags)) {
    const flagToCatalyst = {
      HAS_8K: { type: 'SEC_MATERIAL_EVENT', desc: '8-K filing detected' },
      HAS_EARNINGS: { type: 'EARNINGS', desc: 'Earnings filing detected' },
      HAS_OFFERING: { type: 'SEC_OFFERING', desc: 'Offering filing detected' },
      FORM_4_FILED: { type: 'INSIDER_ACTIVITY', desc: 'Form 4 filed' },
      HIGH_VALUE_INSIDER_TXN: { type: 'INSIDER_ACTIVITY', desc: 'High-value insider transaction' },
      MATERIAL_EVENT: { type: 'SEC_MATERIAL_EVENT', desc: 'Material event flag' },
    };

    for (const flagName of flags) {
      const mapping = flagToCatalyst[flagName];
      if (mapping) {
        const catalystDate = latestFiling?.filingDate || null;
        const key = `${symbol}:${mapping.type}:${catalystDate || ''}:${flagName}`;
        if (!seen.has(key)) {
          seen.add(key);
          catalysts.push({
            type: mapping.type,
            date: catalystDate,
            description: mapping.desc,
            source: 'SEC EDGAR',
            form: latestFiling?.form || null,
            filingDate: catalystDate,
          });
        }
      }
    }
  }

  return catalysts;
}

// ============================================================================
// EXTRACT CATALYSTS FROM MARKET DATA
// ============================================================================

function extractMarketCatalysts(marketData, symbol) {
  if (!marketData || typeof marketData !== 'object') return [];
  const catalysts = [];
  const seen = new Set();

  // Check for upcoming earnings date in market data
  if (marketData.earningsDate) {
    const ed = marketData.earningsDate;
    if (Array.isArray(ed) && ed.length > 0) {
      const firstDate = ed[0];
      if (firstDate) {
        const key = `${symbol}:EARNINGS:${firstDate}`;
        if (!seen.has(key)) {
          seen.add(key);
          catalysts.push({
            type: 'EARNINGS',
            date: null,
            upcomingDate: firstDate,
            upcoming: isFutureDate(firstDate),
            description: 'Upcoming earnings date from market data',
            source: 'Yahoo Finance via market-engine.js',
          });
        }
      }
    } else if (typeof ed === 'string' && ed) {
      const key = `${symbol}:EARNINGS:${ed}`;
      if (!seen.has(key)) {
        seen.add(key);
        catalysts.push({
          type: 'EARNINGS',
          date: null,
          upcomingDate: ed,
          upcoming: isFutureDate(ed),
          description: 'Upcoming earnings date from market data',
          source: 'Yahoo Finance via market-engine.js',
        });
      }
    }
  }

  return catalysts;
}

// ============================================================================
// EXTRACT CATALYSTS FROM FLAGS (cross-evidence)
// ============================================================================

function extractCatalystFromFlags(flags, source, symbol) {
  if (!Array.isArray(flags) || flags.length === 0) return [];
  const catalysts = [];
  const seen = new Set();

  const flagTypeMap = {
    SEC_MATERIAL_EVENT: 'SEC_MATERIAL_EVENT',
    MATERIAL_EVENT: 'SEC_MATERIAL_EVENT',
    HAS_8K: 'SEC_MATERIAL_EVENT',
    EARNINGS: 'EARNINGS',
    HAS_EARNINGS: 'EARNINGS',
    OFFERING: 'SEC_OFFERING',
    SEC_OFFERING: 'SEC_OFFERING',
    HAS_OFFERING: 'SEC_OFFERING',
    FINANCING: 'SEC_FINANCING',
    SEC_FINANCING: 'SEC_FINANCING',
    DILUTION: 'SEC_DILUTION',
    SEC_DILUTION: 'SEC_DILUTION',
    INSIDER_ACTIVITY: 'INSIDER_ACTIVITY',
    FORM_4_FILED: 'INSIDER_ACTIVITY',
    HIGH_VALUE_INSIDER_TXN: 'INSIDER_ACTIVITY',
    FDA: 'FDA_REGULATORY',
    REGULATORY: 'FDA_REGULATORY',
    CONTRACT: 'CONTRACT_DEAL',
    PARTNERSHIP: 'PARTNERSHIP',
    PRODUCT_LAUNCH: 'PRODUCT_LAUNCH',
    ANALYST_ACTION: 'ANALYST_ACTION',
    CORPORATE_EVENT: 'CORPORATE_EVENT',
    MACRO: 'MACRO_SECTOR_EVENT',
  };

  for (const flag of flags) {
    if (typeof flag !== 'string') continue;
    const normalized = flag.toUpperCase().trim();
    const mappedType = flagTypeMap[normalized];
    if (mappedType) {
      const key = `${symbol}:${mappedType}:${source}`;
      if (!seen.has(key)) {
        seen.add(key);
        catalysts.push({
          type: mappedType,
          date: null,
          description: `Flag '${flag}' from ${source}`,
          source: source,
          form: null,
          filingDate: null,
        });
      }
    }
  }

  return catalysts;
}

// ============================================================================
// AGGREGATE CATALYSTS
// ============================================================================

function aggregateCatalysts(symbol, secIntelligence, marketData) {
  const catalysts = [];
  const sources = [];
  const risks = [];

  // SEC catalysts
  if (secIntelligence) {
    const secCatalysts = extractSecCatalysts(secIntelligence, symbol);
    catalysts.push(...secCatalysts);
    if (secCatalysts.length > 0) {
      sources.push('SEC EDGAR');
    }
  }

  // Market data catalysts (e.g., upcoming earnings)
  if (marketData) {
    const marketCatalysts = extractMarketCatalysts(marketData, symbol);
    catalysts.push(...marketCatalysts);
    if (marketCatalysts.length > 0) {
      sources.push('Yahoo Finance via market-engine.js');
    }
  }

  return { catalysts, sources, risks };
}

// ============================================================================
// BUILD REASONS
// ============================================================================

function buildCatalystReasons(catalysts, secIntelligence, components, score) {
  const reasons = [];

  if (catalysts.length > 0) {
    const typeCounts = {};
    for (const c of catalysts) {
      typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts)) {
      reasons.push(`${count} ${type} catalyst(s) detected`);
    }

    const primary = catalysts[0];
    if (primary && primary.description) {
      reasons.push(`Primary catalyst: ${primary.description}`);
    }
    if (primary && primary.source) {
      reasons.push(`Evidence source: ${primary.source}`);
    }
    if (primary && primary.date) {
      const da = getCatalystDaysAgo(primary.date);
      if (da != null) {
        reasons.push(`Catalyst ${da} days ago`);
      }
    }
  }

  if (score != null) {
    reasons.push(`Catalyst score: ${score}/100`);
  } else {
    reasons.push('Insufficient evidence for catalyst score');
  }

  if (secIntelligence) {
    if (secIntelligence.dataStatus === 'no_filings') {
      reasons.push('No recent SEC filings found');
    }
    if (secIntelligence.dataStatus === 'unavailable') {
      reasons.push('SEC data unavailable');
    }
  }

  return reasons.slice(0, 8);
}

// ============================================================================
// BUILD WARNINGS
// ============================================================================

function buildCatalystWarnings(catalysts, secIntelligence, score) {
  const warnings = [];

  if (score == null) {
    warnings.push('NO_CATALYST_EVIDENCE');
  }

  if (secIntelligence) {
    if (secIntelligence.secDataStatus === 'unavailable') {
      warnings.push('SEC_DATA_UNAVAILABLE');
    }
    if (secIntelligence.secDataStatus === 'no_filings') {
      warnings.push('NO_FILINGS');
    }
  }

  if (catalysts.length === 0) {
    warnings.push('NO_VERIFIED_CATALYST');
  }

  const upcoming = catalysts.filter(c => c.upcoming === true);
  if (upcoming.length > 0) {
    warnings.push('UPCOMING_CATALYST_ONLY');
  }

  const stale = catalysts.filter(c => {
    if (!c.date) return false;
    const da = getCatalystDaysAgo(c.date);
    return da != null && da > 90;
  });
  if (stale.length > 0) {
    warnings.push('STALE_CATALYST_DATA');
  }

  return warnings;
}

// ============================================================================
// BUILD FLAGS
// ============================================================================

function buildCatalystFlags(catalysts, secIntelligence) {
  const flags = [];

  if (catalysts.length > 0) {
    flags.push('HAS_CATALYST');
  }

  for (const c of catalysts) {
    if (c.type === 'SEC_MATERIAL_EVENT') {
      flags.push('SEC_MATERIAL_EVENT');
      break;
    }
  }

  for (const c of catalysts) {
    if (c.type === 'EARNINGS') {
      flags.push('EARNINGS');
      break;
    }
  }

  for (const c of catalysts) {
    if (c.type === 'SEC_OFFERING' || c.type === 'SEC_DILUTION' || c.type === 'SEC_FINANCING') {
      flags.push('SEC_FINANCING');
      break;
    }
  }

  for (const c of catalysts) {
    if (c.type === 'INSIDER_ACTIVITY') {
      flags.push('INSIDER_ACTIVITY');
      break;
    }
  }

  for (const c of catalysts) {
    if (c.type === 'FDA_REGULATORY') {
      flags.push('FDA_REGULATORY');
      break;
    }
  }

  const hasUpcoming = catalysts.some(c => c.upcoming === true);
  if (hasUpcoming) {
    flags.push('UPCOMING');
  }

  if (secIntelligence && secIntelligence.flags) {
    for (const sf of secIntelligence.flags) {
      if (!flags.includes(sf)) {
        flags.push(sf);
      }
    }
  }

  return flags;
}

// ============================================================================
// BUILD RISKS
// ============================================================================

function buildCatalystRisks(catalysts, secIntelligence, score) {
  const risks = [];

  if (catalysts.length === 0) {
    risks.push({ label: 'NO_CATALYST_RISK', severity: 'LOW', description: 'No verified catalyst evidence for symbol' });
  }

  if (score == null) {
    risks.push({ label: 'UNKNOWN_CATALYST', severity: 'LOW', description: 'Catalyst score unavailable — insufficient evidence' });
  }

  if (secIntelligence) {
    if (secIntelligence.dilutionRisk && secIntelligence.dilutionRisk !== 'unavailable' && secIntelligence.dilutionRisk !== 'none') {
      risks.push({ label: 'SEC_DILUTION_RISK', severity: 'HIGH', description: `Dilution risk: ${secIntelligence.dilutionRisk}` });
    }
    if (secIntelligence.offeringRisk && secIntelligence.offeringRisk !== 'unavailable' && secIntelligence.offeringRisk !== 'none') {
      risks.push({ label: 'SEC_OFFERING_RISK', severity: 'HIGH', description: `Offering risk: ${secIntelligence.offeringRisk}` });
    }
    if (secIntelligence.warrantRisk && secIntelligence.warrantRisk !== 'unavailable' && secIntelligence.warrantRisk !== 'none') {
      risks.push({ label: 'SEC_WARRANT_RISK', severity: 'MEDIUM', description: `Warrant risk: ${secIntelligence.warrantRisk}` });
    }
    if (secIntelligence.convertibleRisk && secIntelligence.convertibleRisk !== 'unavailable' && secIntelligence.convertibleRisk !== 'none') {
      risks.push({ label: 'SEC_CONVERTIBLE_RISK', severity: 'MEDIUM', description: `Convertible risk: ${secIntelligence.convertibleRisk}` });
    }
    if (secIntelligence.reverseSplitRisk && secIntelligence.reverseSplitRisk !== 'unavailable' && secIntelligence.reverseSplitRisk !== 'none') {
      risks.push({ label: 'SEC_REVERSE_SPLIT_RISK', severity: 'MEDIUM', description: 'Reverse split risk detected' });
    }
  }

  const stale = catalysts.filter(c => {
    if (!c.date || isFutureDate(c.date)) return false;
    const da = getCatalystDaysAgo(c.date);
    return da != null && da > 90;
  });
  if (stale.length > 0) {
    risks.push({ label: 'STALE_CATALYST_DATA', severity: 'MEDIUM', description: 'Catalyst evidence older than 90 days' });
  }

  return risks;
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

function defaultCatalystIntelligence(symbol) {
  return {
    symbol: symbol || null,
    catalystScore: null,
    quality: 'UNAVAILABLE',
    catalystType: 'NO_VERIFIED_CATALYST',
    catalystTypes: [],
    reliability: 'UNAVAILABLE',
    significance: 'UNKNOWN',
    recency: null,
    catalystDate: null,
    daysAgo: null,
    upcoming: false,
    upcomingDate: null,
    event: null,
    source: null,
    provenance: {
      intelligence: 'B6',
      engine: 'B6 Catalyst Intelligence',
    },
    dataAvailability: {
      secData: false,
      marketData: false,
      catalysts: false,
      catalystScore: false,
      catalystType: false,
      reliability: false,
      significance: false,
      recency: false,
    },
    dataCompleteness: 0,
    reasons: ['No catalyst evidence available for symbol'],
    warnings: ['NO_CATALYST_EVIDENCE', 'NO_VERIFIED_CATALYST'],
    flags: [],
    catalysts: [],
    risks: [{ label: 'NO_CATALYST_RISK', severity: 'LOW', description: 'No verified catalyst evidence for symbol' }],
    disclaimer:
      'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Catalyst Intelligence (B6) is analytical only — not a buy/sell recommendation. ' +
      'Missing data is explicitly nulled — never fabricated. ' +
      'Data from SEC EDGAR and Yahoo Finance.',
  };
}

function buildCatalystIntelligence(symbol, secIntelligence, marketData) {
  const defaultResult = defaultCatalystIntelligence(symbol);

  if (!symbol) {
    return defaultResult;
  }

  if (!secIntelligence && !marketData) {
    return { ...defaultResult, symbol };
  }

  const { catalysts, sources, risks: secRisks } = aggregateCatalysts(
    symbol,
    secIntelligence,
    marketData
  );

  // If no catalysts found, return default
  if (catalysts.length === 0) {
    const result = { ...defaultResult, symbol };
    if (secIntelligence) {
      result.dataAvailability.secData = secIntelligence.dataAvailability
        ? Object.values(secIntelligence.dataAvailability).some(Boolean)
        : false;
      result.dataCompleteness = calculateCatalystDataCompleteness(secIntelligence) || 0;
    }
    if (marketData && marketData.price != null) {
      result.dataAvailability.marketData = true;
    }
    return result;
  }

  // Determine primary catalyst (highest priority type)
  const primary = [...catalysts].sort((a, b) => {
    const ai = CATALYST_TYPE_PRIORITY.indexOf(a.type);
    const bi = CATALYST_TYPE_PRIORITY.indexOf(b.type);
    return ai - bi;
  })[0];

  const primaryType = primary.type;
  const primaryDate = primary.date || primary.filingDate || null;
  const primaryDaysAgo = primaryDate ? getCatalystDaysAgo(primaryDate) : null;

  // Determine upcoming
  const upcomingCatalysts = catalysts.filter(c => c.upcoming === true || (c.upcomingDate && isFutureDate(c.upcomingDate)));
  const primaryUpcoming = upcomingCatalysts.length > 0 ? upcomingCatalysts[0] : null;
  const upcomingDate = primaryUpcoming?.upcomingDate || primaryUpcoming?.date || null;

  // Classify values
  const catalystTypes = [...new Set(catalysts.map(c => c.type))];
  const reliability = classifyReliability(
    primary.source,
    secIntelligence?.secDataStatus
  );

  const significanceScore = calculateCatalystSignificance(
    primary.form,
    secIntelligence?.filingCategory,
    primary.type
  );
  const significance = significanceLabel(significanceScore);

  const recency = calculateCatalystRecency(primaryDate, primary.filingDate);
  const daysAgo = primaryDaysAgo;

  const freshness = calculateCatalystFreshness(
    primaryDate || secIntelligence?.latestFiling?.filingDate || null
  );

  const marketRelevance = calculateMarketRelevance(symbol, marketData, primaryDate);
  const dataCompleteness = calculateCatalystDataCompleteness(secIntelligence);

  // Reliability score (0-100) for weighting
  const reliabilityScores = { VERIFIED: 100, HIGH: 80, MODERATE: 50, LOW: 25, UNAVAILABLE: 0 };
  const reliabilityScore = reliabilityScores[reliability] ?? null;

  const componentScoresInput = {
    significance: significanceScore,
    recency: recency,
    reliability: reliabilityScore,
    freshness: freshness,
    marketRelevance: marketRelevance,
    dataCompleteness: dataCompleteness,
  };

  const { catalystScore, componentScores, usedComponents } = calculateCatalystScore(componentScoresInput);

  const quality = calculateCatalystQuality(catalystScore);

  // If no valid score, quality is UNAVAILABLE
  if (catalystScore == null) {
    return {
      ...defaultResult,
      symbol,
      catalystTypes,
      catalysts,
      dataAvailability: {
        secData: sources.includes('SEC EDGAR'),
        marketData: sources.includes('Yahoo Finance via market-engine.js'),
        catalysts: catalysts.length > 0,
        catalystScore: false,
        catalystType: catalysts.length > 0,
        reliability: reliability !== 'UNAVAILABLE',
        significance: significanceScore != null,
        recency: recency != null,
      },
      dataCompleteness: dataCompleteness || 0,
      reasons: buildCatalystReasons(catalysts, secIntelligence, componentScoresInput, null),
      warnings: buildCatalystWarnings(catalysts, secIntelligence, null),
      flags: buildCatalystFlags(catalysts, secIntelligence),
      risks: [...secRisks, ...buildCatalystRisks(catalysts, secIntelligence, null)],
      source: sources.length > 0 ? sources[0] : null,
      provenance: {
        intelligence: 'B6',
        engine: 'B6 Catalyst Intelligence',
        ...(sources.includes('SEC EDGAR') ? { secSource: 'SEC EDGAR' } : {}),
        ...(sources.includes('Yahoo Finance via market-engine.js') ? { marketSource: 'Yahoo Finance via market-engine.js' } : {}),
      },
    };
  }

  // Build full result with score
  const reasons = buildCatalystReasons(catalysts, secIntelligence, componentScoresInput, catalystScore);
  const warnings = buildCatalystWarnings(catalysts, secIntelligence, catalystScore);
  const flags = buildCatalystFlags(catalysts, secIntelligence);
  const allRisks = [...secRisks, ...buildCatalystRisks(catalysts, secIntelligence, catalystScore)];

  return {
    symbol,
    catalystScore,
    quality,
    catalystType: primaryType,
    catalystTypes,
    reliability,
    significance,
    recency,
    catalystDate: primaryDate,
    daysAgo,
    upcoming: !!upcomingDate,
    upcomingDate,
    event: primary.description || null,
    source: sources.length > 0 ? sources[0] : null,
    provenance: {
      intelligence: 'B6',
      engine: 'B6 Catalyst Intelligence',
      ...(sources.includes('SEC EDGAR') ? { secSource: 'SEC EDGAR' } : {}),
      ...(sources.includes('Yahoo Finance via market-engine.js') ? { marketSource: 'Yahoo Finance via market-engine.js' } : {}),
    },
    dataAvailability: {
      secData: sources.includes('SEC EDGAR'),
      marketData: sources.includes('Yahoo Finance via market-engine.js'),
      catalysts: catalysts.length > 0,
      catalystScore: true,
      catalystType: primaryType != null,
      reliability: reliability !== 'UNAVAILABLE',
      significance: significanceScore != null,
      recency: recency != null,
    },
    dataCompleteness: dataCompleteness != null ? dataCompleteness : 0,
    componentScores,
    usedComponents,
    reasons,
    warnings,
    flags,
    catalysts,
    risks: allRisks,
    disclaimer:
      'تحليل محفزات مبني على البيانات المتاحة فقط — لا يمثل توصية شراء أو بيع ولا يضمن حركة السعر. ' +
      'Catalyst Intelligence (B6) is analytical only — not a buy/sell recommendation. ' +
      'Missing data is explicitly nulled — never fabricated. ' +
      'Data from SEC EDGAR and Yahoo Finance.',
  };
}

// ============================================================================
// RANKING
// ============================================================================

const SIGNIFICANCE_ORDER = {
  CRITICAL: 5,
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
  UNKNOWN: 1,
};

const RELIABILITY_ORDER = {
  VERIFIED: 5,
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
  UNAVAILABLE: 1,
};

function rankCatalystOpportunities(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return { ranked: [], top: [], alternatives: [], ranking: { method: 'catalyst_score', total: 0 } };
  }

  const sorted = [...results].sort((a, b) => {
    // Null scores go to the bottom
    const sa = a.catalystScore ?? -1;
    const sb = b.catalystScore ?? -1;
    if (sa === -1 && sb !== -1) return 1;
    if (sb === -1 && sa !== -1) return -1;
    if (sb !== sa) return sb - sa;

    const da = a.dataCompleteness ?? 0;
    const db = b.dataCompleteness ?? 0;
    if (db !== da) return db - da;

    const ra = a.recency ?? -1;
    const rb = b.recency ?? -1;
    if (ra === -1 && rb !== -1) return 1;
    if (rb === -1 && ra !== -1) return -1;
    if (rb !== ra) return rb - ra;

    const sigA = SIGNIFICANCE_ORDER[a.significance] || 0;
    const sigB = SIGNIFICANCE_ORDER[b.significance] || 0;
    if (sigB !== sigA) return sigB - sigA;

    const symA = (a.symbol || '').toString();
    const symB = (b.symbol || '').toString();
    return symA < symB ? -1 : symA > symB ? 1 : 0;
  });

  const ranked = sorted.slice(0, 20);
  const top = ranked.slice(0, 5);
  const alternatives = ranked.slice(5, 10);
  const ranking = {
    method: 'catalyst_score_desc_then_data_completeness_recency_significance_alpha',
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
  daysAgo,
  isFutureDate,
   isNullOrEmpty,
   getCatalystDaysAgo,
   normalizeCatalysts,
   recencyScoreFromDaysAgo,
  classifyRecency,
  CATALYST_WEIGHTS,
  CATALYST_QUALITY_THRESHOLDS,
  CATALYST_TYPE_PRIORITY,
  RECENCY_MAP,
  FORM_TO_CATALYST_TYPE,
  FILING_CATEGORY_TO_TYPE,
  classifyCatalystType,
  calculateCatalystRecency,
  calculateCatalystSignificance,
  significanceLabel,
  classifyReliability,
  calculateCatalystFreshness,
  calculateMarketRelevance,
  calculateCatalystDataCompleteness,
  calculateCatalystScore,
  calculateCatalystQuality,
  normalizeCatalyst,
  extractSecCatalysts,
  extractMarketCatalysts,
  extractCatalystFromFlags,
  aggregateCatalysts,
  buildCatalystReasons,
  buildCatalystWarnings,
  buildCatalystFlags,
  buildCatalystRisks,
  buildCatalystIntelligence,
  defaultCatalystIntelligence,
  rankCatalystOpportunities,
};

export default buildCatalystIntelligence;
