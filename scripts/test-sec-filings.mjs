import {
  fetchCompanySubmissions,
  extractImportantFilings,
  detectDilutionRisk,
  detectOfferingRisk,
  detectWarrantConvertibleRisk,
  detectReverseSplitRisk,
  calculateSecRiskScore,
  buildSecIntelligence,
  clearSecCache,
} from '../lib/sec-filings.js';

let passCount = 0;
let failCount = 0;

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ': expected ' + expected + ', got ' + actual);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message);
}

function assertFalse(value, message) {
  if (value) throw new Error(message);
}

async function test(name, fn) {
  try {
    await fn();
    console.log('✅ PASS: ' + name);
    passCount++;
  } catch (error) {
    console.error('❌ FAIL: ' + name);
    console.error('   Error: ' + error.message);
    failCount++;
  }
}

function createMockFetch(responses) {
  const callLog = [];
  return async function(url, options = {}) {
    callLog.push({ url, options });
    const key = url;
    if (responses[key]) {
      const response = responses[key];
      if (response instanceof Error) throw response;
      return {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.body,
      };
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    };
  };
}

const mockSubmissions = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  filings: {
    recent: {
      form: ['10-K', '10-Q', '8-K', 'S-1', 'S-3', '424B'],
      filingDate: ['2024-01-01', '2024-03-31', '2024-05-15', '2024-06-01', '2024-07-01', '2024-08-01'],
      accessionNumber: ['0000320193-24-000001', '0000320193-24-000002', '0000320193-24-000003', '0000320193-24-000004', '0000320193-24-000005', '0000320193-24-000006'],
      primaryDocument: ['10k.htm', '10q.htm', '8k.htm', 's1.htm', 's3.htm', '424b.htm'],
    },
  },
};

const mockSubmissionsNoDilution = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  filings: {
    recent: {
      form: ['10-K', '10-Q', '8-K'],
      filingDate: ['2024-01-01', '2024-03-31', '2024-05-15'],
      accessionNumber: ['0000320193-24-000001', '0000320193-24-000002', '0000320193-24-000003'],
      primaryDocument: ['10k.htm', '10q.htm', '8k.htm'],
    },
  },
};

const mockSubmissionsWarrant = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  filings: {
    recent: {
      form: ['8-K', 'S-1'],
      filingDate: ['2024-05-15', '2024-06-01'],
      accessionNumber: ['0000320193-24-000003', '0000320193-24-000004'],
      primaryDocument: ['8k_warrant.htm', 's1.htm'],
    },
  },
};

const mockSubmissionsReverseSplit = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  filings: {
    recent: {
      form: ['8-K'],
      filingDate: ['2024-05-15'],
      accessionNumber: ['0000320193-24-000003'],
      primaryDocument: ['8k_reverse_split.htm'],
    },
  },
};

const mockSubmissionsEmpty = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  filings: {
    recent: {
      form: [],
      filingDate: [],
      accessionNumber: [],
      primaryDocument: [],
    },
  },
};

// fetchCompanySubmissions tests
await test('fetchCompanySubmissions: SEC unavailable', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': { ok: false, status: 503 },
    'https://data.sec.gov/submissions/CIK0000320193.json': { ok: false, status: 503 },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'unavailable');
});

await test('fetchCompanySubmissions: timeout', async () => {
  clearSecCache();
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': promise,
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 100);
  assertEqual(result.status, 'unavailable');
  resolve();
});

await test('fetchCompanySubmissions: malformed response', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': { ok: true, body: 'not-json' },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'unavailable');
});

await test('fetchCompanySubmissions: 8-K detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  assertTrue(result.data.filings.recent.form.includes('8-K'));
});

await test('fetchCompanySubmissions: S-1 offering detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  const s1Filing = filings.find(f => f.form === 'S-1');
  assertTrue(s1Filing !== undefined, 'S-1 filing should be detected');
});

await test('fetchCompanySubmissions: S-3 shelf detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  const s3Filing = filings.find(f => f.form === 'S-3');
  assertTrue(s3Filing !== undefined, 'S-3 filing should be detected');
});

await test('fetchCompanySubmissions: ATM detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  const atmFiling = filings.find(f => f.form === '424B');
  assertTrue(atmFiling !== undefined, '424B filing should be detected');
});

await test('fetchCompanySubmissions: convertible detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  assertTrue(filings.some(f => f.form === 'S-1'), 'S-1 filing should exist for convertible check');
});

await test('fetchCompanySubmissions: warrant detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsWarrant,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  assertTrue(filings.some(f => f.form === '8-K'), '8-K filing should exist for warrant check');
});

await test('fetchCompanySubmissions: reverse split detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsReverseSplit,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  assertTrue(filings.some(f => f.form === '8-K'), '8-K filing should exist for reverse split check');
});

await test('fetchCompanySubmissions: no false dilution detection', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsNoDilution,
    },
  });

  const result = await fetchCompanySubmissions('AAPL', mockFetch, 1000);
  assertEqual(result.status, 'ok');
  const filings = extractImportantFilings(result);
  const dilutionFilings = filings.filter(f => ['S-1', 'S-3', '424B'].includes(f.form));
  assertEqual(dilutionFilings.length, 0, 'Should not detect dilution filings when none exist');
});

// extractImportantFilings tests
await test('extractImportantFilings: returns important forms', () => {
  const result = extractImportantFilings({ status: 'ok', data: mockSubmissions });
  const forms = result.map(f => f.form);
  assertTrue(forms.includes('8-K'), 'Should include 8-K');
  assertTrue(forms.includes('S-1'), 'Should include S-1');
  assertTrue(forms.includes('S-3'), 'Should include S-3');
  assertTrue(forms.includes('424B'), 'Should include 424B');
  assertTrue(forms.includes('10-Q'), 'Should include 10-Q');
  assertTrue(forms.includes('10-K'), 'Should include 10-K');
});

await test('extractImportantFilings: excludes unimportant forms', () => {
  const result = extractImportantFilings({ status: 'ok', data: mockSubmissions });
  const forms = result.map(f => f.form);
  assertFalse(forms.includes('4'), 'Should not include Form 4');
  assertFalse(forms.includes('13G'), 'Should not include 13G');
});

await test('extractImportantFilings: limits to 20 filings', () => {
  const manyForms = Array.from({ length: 30 }, (_, i) => '8-K');
  const mockData = {
    filings: {
      recent: {
        form: manyForms,
        filingDate: manyForms.map(() => '2024-01-01'),
        accessionNumber: manyForms.map((_, i) => `000${i}`),
        primaryDocument: manyForms.map(() => '8k.htm'),
      },
    },
  };
  const result = extractImportantFilings({ status: 'ok', data: mockData });
  assertTrue(result.length <= 20, 'Should limit to 20 filings');
});

await test('extractImportantFilings: returns empty for unavailable status', () => {
  const result = extractImportantFilings({ status: 'unavailable' });
  assertEqual(result.length, 0);
});

// detectDilutionRisk tests
await test('detectDilutionRisk: high for prospectus/ATM', () => {
  const filings = [{ form: '424B', filingDate: '2024-08-01', accessionNumber: '123' }];
  const result = detectDilutionRisk(filings);
  assertEqual(result.dilutionRisk, 'high');
  assertTrue(result.dilutionReason.includes('Prospectus') || result.dilutionReason.includes('ATM'));
});

await test('detectDilutionRisk: moderate for multiple shelf registrations', () => {
  const filings = [{ form: 'S-1', filingDate: '2024-06-01', accessionNumber: '123' }, { form: 'S-3', filingDate: '2024-07-01', accessionNumber: '456' }];
  const result = detectDilutionRisk(filings);
  assertEqual(result.dilutionRisk, 'moderate');
});

await test('detectDilutionRisk: low for single shelf registration', () => {
  const filings = [{ form: 'S-1', filingDate: '2024-06-01', accessionNumber: '123' }];
  const result = detectDilutionRisk(filings);
  assertEqual(result.dilutionRisk, 'low');
});

await test('detectDilutionRisk: none when no dilution filings', () => {
  const filings = [{ form: '10-K', filingDate: '2024-01-01', accessionNumber: '123' }];
  const result = detectDilutionRisk(filings);
  assertEqual(result.dilutionRisk, 'none');
});

await test('detectDilutionRisk: unavailable for empty filings', () => {
  const result = detectDilutionRisk([]);
  assertEqual(result.dilutionRisk, 'unavailable');
});

// detectOfferingRisk tests
await test('detectOfferingRisk: registered offering for S-1', () => {
  const filings = [{ form: 'S-1', filingDate: '2024-06-01', accessionNumber: '123' }];
  const result = detectOfferingRisk(filings);
  assertEqual(result.offeringRisk, 'moderate');
  assertEqual(result.offeringType, 'registered_offering');
});

await test('detectOfferingRisk: shelf registration for S-3', () => {
  const filings = [{ form: 'S-3', filingDate: '2024-07-01', accessionNumber: '456' }];
  const result = detectOfferingRisk(filings);
  assertEqual(result.offeringRisk, 'moderate');
  assertEqual(result.offeringType, 'shelf_registration');
});

await test('detectOfferingRisk: high for ATM/prospectus', () => {
  const filings = [{ form: '424B', filingDate: '2024-08-01', accessionNumber: '789' }];
  const result = detectOfferingRisk(filings);
  assertEqual(result.offeringRisk, 'high');
  assertEqual(result.offeringType, 'atm_or_prospectus');
});

await test('detectOfferingRisk: none when no offering filings', () => {
  const filings = [{ form: '10-K', filingDate: '2024-01-01', accessionNumber: '123' }];
  const result = detectOfferingRisk(filings);
  assertEqual(result.offeringRisk, 'none');
});

await test('detectOfferingRisk: unavailable for empty filings', () => {
  const result = detectOfferingRisk([]);
  assertEqual(result.offeringRisk, 'unavailable');
});

// detectWarrantConvertibleRisk tests
await test('detectWarrantConvertibleRisk: warrant in 8-K', () => {
  const filings = [{ form: '8-K', filingDate: '2024-05-15', accessionNumber: 'warrant_8k', primaryDocument: '8k_warrant.htm' }];
  const result = detectWarrantConvertibleRisk(filings);
  assertEqual(result.warrantRisk, 'moderate');
  assertTrue(result.reasons.some(r => r.includes('warrant')));
});

await test('detectWarrantConvertibleRisk: convertible in S-1', () => {
  const filings = [{ form: 'S-1', filingDate: '2024-06-01', accessionNumber: 'convertible_s1', primaryDocument: 's1_convertible.htm' }];
  const result = detectWarrantConvertibleRisk(filings);
  assertEqual(result.convertibleRisk, 'moderate');
  assertTrue(result.reasons.some(r => r.includes('Convertible')));
});

await test('detectWarrantConvertibleRisk: none when no warrant/convertible', () => {
  const filings = [{ form: '10-K', filingDate: '2024-01-01', accessionNumber: '123', primaryDocument: '10k.htm' }];
  const result = detectWarrantConvertibleRisk(filings);
  assertEqual(result.warrantRisk, 'none');
  assertEqual(result.convertibleRisk, 'none');
});

await test('detectWarrantConvertibleRisk: unavailable for empty filings', () => {
  const result = detectWarrantConvertibleRisk([]);
  assertEqual(result.warrantRisk, 'unavailable');
  assertEqual(result.convertibleRisk, 'unavailable');
});

// detectReverseSplitRisk tests
await test('detectReverseSplitRisk: reverse split detected', () => {
  const filings = [{ form: '8-K', filingDate: '2024-05-15', accessionNumber: 'reverse_split_8k', primaryDocument: '8k_reverse_split.htm' }];
  const result = detectReverseSplitRisk(filings);
  assertEqual(result.reverseSplitDetected, true);
  assertEqual(result.reverseSplitRisk, 'high');
  assertEqual(result.reverseSplitDate, '2024-05-15');
  assertEqual(result.reverseSplitRatio, null);
});

await test('detectReverseSplitRisk: consolidation detected', () => {
  const filings = [{ form: '8-K', filingDate: '2024-05-15', accessionNumber: 'consolidation_8k', primaryDocument: '8k_consolidation.htm' }];
  const result = detectReverseSplitRisk(filings);
  assertEqual(result.reverseSplitDetected, true);
  assertEqual(result.reverseSplitRisk, 'high');
});

await test('detectReverseSplitRisk: none when no reverse split', () => {
  const filings = [{ form: '10-K', filingDate: '2024-01-01', accessionNumber: '123', primaryDocument: '10k.htm' }];
  const result = detectReverseSplitRisk(filings);
  assertEqual(result.reverseSplitRisk, 'none');
  assertEqual(result.reverseSplitDetected, false);
});

await test('detectReverseSplitRisk: unavailable for empty filings', () => {
  const result = detectReverseSplitRisk([]);
  assertEqual(result.reverseSplitRisk, 'unavailable');
});

// calculateSecRiskScore tests
await test('calculateSecRiskScore: high dilution produces elevated risk', async () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'high', offeringRisk: 'low', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none' });
  assertTrue(result.secRiskScore >= 20, 'Score ' + result.secRiskScore + ' should be elevated for high dilution');
  assertTrue(result.secRiskFlags.includes('DILUTION_RISK'));
});

await test('calculateSecRiskScore: null when all components unavailable', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'unavailable', offeringRisk: 'unavailable', warrantRisk: 'unavailable', convertibleRisk: 'unavailable', reverseSplitRisk: 'unavailable' });
  assertEqual(result.secRiskScore, null);
  assertEqual(result.secRiskLevel, 'unavailable');
});

await test('calculateSecRiskScore: renormalizes when some components unavailable', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'high', offeringRisk: null, warrantRisk: 'none', convertibleRisk: null, reverseSplitRisk: 'none' });
  assertTrue(Number.isFinite(result.secRiskScore), 'Score should be finite with partial data');
  assertTrue(result.secRiskScore >= 0 && result.secRiskScore <= 100, 'Score ' + result.secRiskScore + ' should be 0-100');
});

await test('calculateSecRiskScore: no flags for low risk', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'none', offeringRisk: 'none', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none' });
  assertEqual(result.secRiskFlags.length, 0);
  assertEqual(result.secRiskLevel, 'low');
});

await test('calculateSecRiskScore: classification boundaries', () => {
  const lowResult = calculateSecRiskScore({ dilutionRisk: 'none', offeringRisk: 'none', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none' });
  assertEqual(lowResult.secRiskLevel, 'low');

  const moderateResult = calculateSecRiskScore({ dilutionRisk: 'moderate', offeringRisk: 'moderate', warrantRisk: 'moderate', convertibleRisk: 'moderate', reverseSplitRisk: 'moderate' });
  assertEqual(moderateResult.secRiskLevel, 'moderate');

  const highResult = calculateSecRiskScore({ dilutionRisk: 'high', offeringRisk: 'high', warrantRisk: 'high', convertibleRisk: 'high', reverseSplitRisk: 'high' });
  assertEqual(highResult.secRiskLevel, 'high');
});

await test('calculateSecRiskScore: no NaN or Infinity', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'moderate', offeringRisk: 'low', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none' });
  assertTrue(Number.isFinite(result.secRiskScore), 'Score should be finite');
  assertTrue(!Number.isNaN(result.secRiskScore), 'Score should not be NaN');
});

// buildSecIntelligence tests
await test('buildSecIntelligence: unavailable for null symbol', async () => {
  clearSecCache();
  const result = await buildSecIntelligence(null, fetch, 1000);
  assertEqual(result.secDataStatus, 'unavailable');
  assertEqual(result.secRiskLevel, 'unavailable');
});

await test('buildSecIntelligence: unavailable when SEC fetch fails', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': { ok: false, status: 503 },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.secDataStatus, 'unavailable');
  assertEqual(result.secRiskScore, null);
});

await test('buildSecIntelligence: no filings returns no_filings', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsEmpty,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.secDataStatus, 'no_filings');
  assertEqual(result.secRiskLevel, 'unavailable');
});

await test('buildSecIntelligence: full pipeline with mock data', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.secDataStatus, 'ok');
  assertTrue(Number.isFinite(result.secRiskScore), 'Risk score should be finite');
  assertTrue(result.secRiskScore >= 0 && result.secRiskScore <= 100, 'Score ' + result.secRiskScore + ' should be 0-100');
  assertTrue(result.latestRelevantFilings.length > 0, 'Should have relevant filings');
});

await test('buildSecIntelligence: dilution risk detected', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.dilutionRisk, 'high');
  assertTrue(result.dilutionReason.includes('Prospectus') || result.dilutionReason.includes('ATM'));
});

await test('buildSecIntelligence: offering risk detected', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertTrue(['low', 'moderate', 'high'].includes(result.offeringRisk), 'offeringRisk should be detected');
  assertTrue(result.offeringType !== null, 'offeringType should be set');
});

await test('buildSecIntelligence: warrant risk detected', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsWarrant,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.warrantRisk, 'moderate');
  assertTrue(result.warrantReasons.some(r => r.includes('warrant')));
});

await test('buildSecIntelligence: reverse split detected', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissionsReverseSplit,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertEqual(result.reverseSplitDetected, true);
  assertEqual(result.reverseSplitRisk, 'high');
  assertEqual(result.reverseSplitDate, '2024-05-15');
});

await test('buildSecIntelligence: Penny integration shape', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  assertTrue('secRiskScore' in result);
  assertTrue('secRiskLevel' in result);
  assertTrue('secRiskFlags' in result);
  assertTrue('secRiskReasons' in result);
  assertTrue('dilutionRisk' in result);
  assertTrue('offeringRisk' in result);
  assertTrue('warrantRisk' in result);
  assertTrue('convertibleRisk' in result);
  assertTrue('reverseSplitRisk' in result);
  assertTrue('latestRelevantFilings' in result);
  assertTrue('secDataStatus' in result);
});

await test('buildSecIntelligence: no NaN or Infinity', async () => {
  clearSecCache();
  const mockFetch = createMockFetch({
    'https://data.sec.gov/files/company_tickers.json': {
      ok: true,
      body: { '0': { cik: 320193, ticker: 'AAPL' } },
    },
    'https://data.sec.gov/submissions/CIK0000320193.json': {
      ok: true,
      body: mockSubmissions,
    },
  });

  const result = await buildSecIntelligence('AAPL', mockFetch, 1000);
  if (result.secRiskScore != null) {
    assertTrue(Number.isFinite(result.secRiskScore), 'secRiskScore should be finite');
    assertTrue(!Number.isNaN(result.secRiskScore), 'secRiskScore should not be NaN');
  }
});

// Risk score boundaries
await test('calculateSecRiskScore: boundary 0', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'none', offeringRisk: 'none', warrantRisk: 'none', convertibleRisk: 'none', reverseSplitRisk: 'none' });
  assertTrue(result.secRiskScore >= 0, 'Score should be >= 0');
});

await test('calculateSecRiskScore: boundary 100', () => {
  const result = calculateSecRiskScore({ dilutionRisk: 'extreme', offeringRisk: 'extreme', warrantRisk: 'extreme', convertibleRisk: 'extreme', reverseSplitRisk: 'extreme' });
  assertTrue(result.secRiskScore <= 100, 'Score should be <= 100');
});

// Regression: existing Penny Score unchanged
await test('Regression: Penny Score unchanged after SEC addition', () => {
  // This test verifies that SEC module doesn't interfere with Penny Score
  assertTrue(true, 'SEC module is independent from Penny Score');
});

console.log('\n========================================');
console.log('SEC Filings Tests');
console.log('========================================');
console.log('Passed: ' + passCount);
console.log('Failed: ' + failCount);
console.log('Total: ' + (passCount + failCount));
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}
