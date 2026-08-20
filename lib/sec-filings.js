const SEC_BASE = 'https://data.sec.gov';
const USER_AGENT = 'Hunter AI contact@hunter-ai.local';
const DEFAULT_TIMEOUT = 10000;
const CACHE_TTL = 5 * 60 * 1000;

const memoryCache = new Map();
let tickersCache = null;
let tickersCacheTs = 0;
const TICKERS_CACHE_TTL = 60 * 60 * 1000;

function getCacheKey(symbol) {
  return `sec:${String(symbol).toUpperCase()}`;
}

function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  memoryCache.set(key, { data, ts: Date.now() });
}

export function clearSecCache() {
  memoryCache.clear();
  tickersCache = null;
  tickersCacheTs = 0;
}

async function fetchWithTimeout(url, options = {}, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getTickersMap(fetchImpl = fetch, timeout = DEFAULT_TIMEOUT) {
  if (tickersCache && Date.now() - tickersCacheTs < TICKERS_CACHE_TTL) {
    return tickersCache;
  }

  try {
    const response = await fetchWithTimeout(`${SEC_BASE}/files/company_tickers.json`, { timeout }, fetchImpl);
    if (response.ok) {
      const data = await response.json();
      tickersCache = data;
      tickersCacheTs = Date.now();
      return data;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function fetchCompanySubmissions(symbolOrCik, fetchImpl = fetch, timeout = DEFAULT_TIMEOUT) {
  const key = String(symbolOrCik).toUpperCase();
  const cacheKey = getCacheKey(key);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let cik = key;
  if (!/^\d+$/.test(key)) {
    const tickers = await getTickersMap(fetchImpl, timeout);
    if (tickers) {
      const entry = Object.values(tickers).find(t => t.ticker === key);
      if (entry) {
        cik = String(entry.cik).padStart(10, '0');
      }
    }
  } else {
    cik = String(key).padStart(10, '0');
  }

  const url = `${SEC_BASE}/submissions/CIK${cik}.json`;

  try {
    const response = await fetchWithTimeout(url, { timeout }, fetchImpl);
    if (!response.ok) {
      const result = { status: 'unavailable', error: `HTTP ${response.status}` };
      setCache(cacheKey, result);
      return result;
    }
    const data = await response.json();
    const result = { status: 'ok', data, cik };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    const result = { status: 'unavailable', error: error.message || 'Network error' };
    setCache(cacheKey, result);
    return result;
  }
}

export function extractImportantFilings(submissions) {
  if (!submissions || submissions.status !== 'ok') return [];

  const filings = [];
  const recent = submissions.data?.filings?.recent || {};
  const forms = recent.form || [];
  const dates = recent.filingDate || [];
  const accessions = recent.accessionNumber || [];
  const primaryDocuments = recent.primaryDocument || [];

  const importantForms = ['8-K', 'S-1', 'S-3', '424B', '10-Q', '10-K', 'DEF 14A'];

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (importantForms.includes(form)) {
      filings.push({
        form,
        filingDate: dates[i] || null,
        accessionNumber: accessions[i] || null,
        primaryDocument: primaryDocuments[i] || null,
      });
    }
  }

  return filings.slice(0, 20);
}

export function detectDilutionRisk(filings) {
  if (!Array.isArray(filings) || filings.length === 0) {
    return { dilutionRisk: 'unavailable', dilutionReason: 'No SEC filings available' };
  }

  const dilutionForms = ['S-1', 'S-3', '424B'];
  const recentDilutionFilings = filings.filter(f => dilutionForms.includes(f.form));

  if (recentDilutionFilings.length === 0) {
    return { dilutionRisk: 'none', dilutionReason: 'No dilution-related filings detected' };
  }

  const shelfFilings = recentDilutionFilings.filter(f => ['S-1', 'S-3'].includes(f.form));
  const prospectusFilings = recentDilutionFilings.filter(f => f.form === '424B');

  if (prospectusFilings.length > 0) {
    return { dilutionRisk: 'high', dilutionReason: 'Prospectus/ATM filing indicates potential share issuance' };
  }

  if (shelfFilings.length >= 2) {
    return { dilutionRisk: 'moderate', dilutionReason: 'Multiple shelf registrations may indicate future dilution' };
  }

  if (shelfFilings.length === 1) {
    return { dilutionRisk: 'low', dilutionReason: 'Single shelf registration detected' };
  }

  return { dilutionRisk: 'none', dilutionReason: 'No dilution filings detected' };
}

export function detectOfferingRisk(filings) {
  if (!Array.isArray(filings) || filings.length === 0) {
    return { offeringRisk: 'unavailable', offeringType: null, offeringDate: null, offeringReason: null };
  }

  const offeringFilings = filings.filter(f => ['S-1', 'S-3', '424B', '8-K'].includes(f.form));

  if (offeringFilings.length === 0) {
    return { offeringRisk: 'none', offeringType: null, offeringDate: null, offeringReason: 'No offering filings detected' };
  }

  const latestOffering = offeringFilings[0];
  let offeringType = 'unknown';
  let offeringRisk = 'low';

  if (latestOffering.form === 'S-1') {
    offeringType = 'registered_offering';
    offeringRisk = 'moderate';
  } else if (latestOffering.form === 'S-3') {
    offeringType = 'shelf_registration';
    offeringRisk = 'moderate';
  } else if (latestOffering.form === '424B') {
    offeringType = 'atm_or_prospectus';
    offeringRisk = 'high';
  } else if (latestOffering.form === '8-K') {
    offeringType = 'corporate_action';
    offeringRisk = 'low';
  }

  return {
    offeringRisk,
    offeringType,
    offeringDate: latestOffering.filingDate,
    offeringReason: `${latestOffering.form} filing detected`,
  };
}

export function detectWarrantConvertibleRisk(filings) {
  if (!Array.isArray(filings) || filings.length === 0) {
    return { warrantRisk: 'unavailable', convertibleRisk: 'unavailable', reasons: [] };
  }

  const reasons = [];
  let warrantRisk = 'none';
  let convertibleRisk = 'none';

  for (const filing of filings) {
    const form = filing.form || '';
    const accession = (filing.accessionNumber || '').toLowerCase();
    const primaryDoc = (filing.primaryDocument || '').toLowerCase();
    const combined = `${form} ${accession} ${primaryDoc}`;

    if (form === '8-K' && /warrant/.test(combined)) {
      warrantRisk = 'moderate';
      reasons.push('8-K warrant-related filing detected');
    }

    if ((form === 'S-1' || form === 'S-3') && /convertible/.test(combined)) {
      convertibleRisk = 'moderate';
      reasons.push('Convertible securities filing detected');
    }
  }

  return { warrantRisk, convertibleRisk, reasons: reasons.slice(0, 5) };
}

export function detectReverseSplitRisk(filings) {
  if (!Array.isArray(filings) || filings.length === 0) {
    return { reverseSplitRisk: 'unavailable', reverseSplitDetected: false, reverseSplitDate: null, reverseSplitRatio: null };
  }

  const reverseSplitKeywords = ['reverse split', 'reverse_split', 'consolidation', '1-for-10', '1-for-5', '1-for-20'];

  for (const filing of filings) {
    const form = filing.form || '';
    const accession = (filing.accessionNumber || '').toLowerCase();
    const primaryDoc = (filing.primaryDocument || '').toLowerCase();
    const combined = `${form} ${accession} ${primaryDoc}`;

    if (reverseSplitKeywords.some(kw => combined.includes(kw))) {
      return {
        reverseSplitRisk: 'high',
        reverseSplitDetected: true,
        reverseSplitDate: filing.filingDate,
        reverseSplitRatio: null,
      };
    }
  }

  return { reverseSplitRisk: 'none', reverseSplitDetected: false, reverseSplitDate: null, reverseSplitRatio: null };
}

export function calculateSecRiskScore({ dilutionRisk, offeringRisk, warrantRisk, convertibleRisk, reverseSplitRisk, filings = [] }) {
  const riskMap = {
    none: 0,
    low: 25,
    moderate: 50,
    high: 75,
    extreme: 100,
    unavailable: null,
  };

  const components = [
    { key: 'dilutionRisk', value: riskMap[dilutionRisk], weight: 0.3 },
    { key: 'offeringRisk', value: riskMap[offeringRisk], weight: 0.25 },
    { key: 'warrantRisk', value: riskMap[warrantRisk], weight: 0.2 },
    { key: 'convertibleRisk', value: riskMap[convertibleRisk], weight: 0.15 },
    { key: 'reverseSplitRisk', value: riskMap[reverseSplitRisk], weight: 0.1 },
  ];

  const available = components.filter(c => c.value != null);

  if (available.length === 0) {
    return {
      secRiskScore: null,
      secRiskLevel: 'unavailable',
      secRiskFlags: [],
      secRiskReasons: ['SEC data unavailable'],
      latestRelevantFilings: [],
      secDataStatus: 'unavailable',
    };
  }

  let totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let weightedSum = available.reduce((sum, c) => sum + c.value * c.weight, 0);

  const score = Math.round(weightedSum / totalWeight);
  const clampedScore = Math.max(0, Math.min(100, score));

  const flags = [];
  const reasons = [];

  if (dilutionRisk === 'high') { flags.push('DILUTION_RISK'); reasons.push('Dilution risk detected'); }
  if (offeringRisk === 'high') { flags.push('OFFERING_RISK'); reasons.push('Offering risk detected'); }
  if (warrantRisk === 'moderate') { flags.push('WARRANT_RISK'); reasons.push('Warrant activity detected'); }
  if (convertibleRisk === 'moderate') { flags.push('CONVERTIBLE_RISK'); reasons.push('Convertible securities detected'); }
  if (reverseSplitRisk === 'high') { flags.push('REVERSE_SPLIT_RISK'); reasons.push('Reverse split detected'); }

  const level = clampedScore <= 39 ? 'low' : clampedScore <= 59 ? 'moderate' : clampedScore <= 79 ? 'high' : 'extreme';

  return {
    secRiskScore: clampedScore,
    secRiskLevel: level,
    secRiskFlags: flags,
    secRiskReasons: reasons.slice(0, 5),
    latestRelevantFilings: Array.isArray(filings) ? filings.slice(0, 10) : [],
    secDataStatus: 'ok',
  };
}

export async function buildSecIntelligence(symbol, fetchImpl = fetch, timeout = DEFAULT_TIMEOUT) {
  const result = {
    secRiskScore: null,
    secRiskLevel: 'unavailable',
    secRiskFlags: [],
    secRiskReasons: ['SEC data unavailable'],
    dilutionRisk: 'unavailable',
    dilutionReason: null,
    offeringRisk: 'unavailable',
    offeringType: null,
    offeringDate: null,
    offeringReason: null,
    warrantRisk: 'unavailable',
    convertibleRisk: 'unavailable',
    warrantReasons: [],
    reverseSplitRisk: 'unavailable',
    reverseSplitDetected: false,
    reverseSplitDate: null,
    reverseSplitRatio: null,
    latestRelevantFilings: [],
    secDataStatus: 'unavailable',
  };

  if (!symbol) return result;

  const submissions = await fetchCompanySubmissions(symbol, fetchImpl, timeout);

  if (submissions.status !== 'ok') {
    result.secDataStatus = 'unavailable';
    result.secRiskReasons = [submissions.error || 'SEC data unavailable'];
    return result;
  }

  const filings = extractImportantFilings(submissions);

  if (filings.length === 0) {
    result.secDataStatus = 'no_filings';
    result.secRiskReasons = ['No recent SEC filings found'];
    return result;
  }

  const dilution = detectDilutionRisk(filings);
  const offering = detectOfferingRisk(filings);
  const warrantConvertible = detectWarrantConvertibleRisk(filings);
  const reverseSplit = detectReverseSplitRisk(filings);

  const secSummary = calculateSecRiskScore({
    dilutionRisk: dilution.dilutionRisk,
    offeringRisk: offering.offeringRisk,
    warrantRisk: warrantConvertible.warrantRisk,
    convertibleRisk: warrantConvertible.convertibleRisk,
    reverseSplitRisk: reverseSplit.reverseSplitRisk,
    filings,
  });

  return {
    ...result,
    ...secSummary,
    dilutionRisk: dilution.dilutionRisk,
    dilutionReason: dilution.dilutionReason,
    offeringRisk: offering.offeringRisk,
    offeringType: offering.offeringType,
    offeringDate: offering.offeringDate,
    offeringReason: offering.offeringReason,
    warrantRisk: warrantConvertible.warrantRisk,
    convertibleRisk: warrantConvertible.convertibleRisk,
    warrantReasons: warrantConvertible.reasons,
    reverseSplitRisk: reverseSplit.reverseSplitRisk,
    reverseSplitDetected: reverseSplit.reverseSplitDetected,
    reverseSplitDate: reverseSplit.reverseSplitDate,
    reverseSplitRatio: reverseSplit.reverseSplitRatio,
    latestRelevantFilings: secSummary.latestRelevantFilings || filings.slice(0, 10),
    secDataStatus: 'ok',
  };
}
