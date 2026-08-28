import { NextResponse } from 'next/server';
import { fetchTrending } from '@/lib/market-engine';
import {
  fetchCompanySubmissions,
  extractImportantFilings,
  detectDilutionRisk,
  detectOfferingRisk,
  detectWarrantConvertibleRisk,
  detectReverseSplitRisk,
  calculateSecRiskScore,
} from '@/lib/sec-filings';
import {
  buildSecEdgarIntelligence,
  extractAllFilings,
  rankSecOpportunities,
} from '@/lib/sec-edgar-intelligence';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BATCH_SIZE = 5;
const SEC_RATE_LIMIT_DELAY = 200;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeSymbol(symbol) {
  try {
    const submissions = await fetchCompanySubmissions(symbol);

    const secData = {
      symbol,
      secDataStatus: submissions.status,
      cik: submissions.cik || null,
    };

    if (submissions.status !== 'ok') {
      secData.secRiskScore = null;
      secData.secRiskLevel = 'unavailable';
      secData.dilutionRisk = 'unavailable';
      secData.dilutionReason = null;
      secData.offeringRisk = 'unavailable';
      secData.offeringType = null;
      secData.offeringDate = null;
      secData.offeringReason = null;
      secData.warrantRisk = 'unavailable';
      secData.convertibleRisk = 'unavailable';
      secData.reverseSplitRisk = 'unavailable';
      secData.secRiskFlags = [];
      secData.secRiskReasons = [submissions.error || 'SEC data unavailable'];
      secData.latestRelevantFilings = [];
      secData.filings = [];
    } else {
      const importantFilings = extractImportantFilings(submissions);
      const allFilings = extractAllFilings(submissions);

      const dilution = detectDilutionRisk(importantFilings);
      const offering = detectOfferingRisk(importantFilings);
      const warrantConvertible = detectWarrantConvertibleRisk(importantFilings);
      const reverseSplit = detectReverseSplitRisk(importantFilings);

      const secSummary = calculateSecRiskScore({
        dilutionRisk: dilution.dilutionRisk,
        offeringRisk: offering.offeringRisk,
        warrantRisk: warrantConvertible.warrantRisk,
        convertibleRisk: warrantConvertible.convertibleRisk,
        reverseSplitRisk: reverseSplit.reverseSplitRisk,
        filings: importantFilings,
      });

      secData.filings = allFilings;
      secData.secRiskScore = secSummary.secRiskScore;
      secData.secRiskLevel = secSummary.secRiskLevel || 'unavailable';
      secData.secRiskFlags = secSummary.secRiskFlags;
      secData.secRiskReasons = secSummary.secRiskReasons;
      secData.dilutionRisk = dilution.dilutionRisk;
      secData.dilutionReason = dilution.dilutionReason;
      secData.offeringRisk = offering.offeringRisk;
      secData.offeringType = offering.offeringType;
      secData.offeringDate = offering.offeringDate;
      secData.offeringReason = offering.offeringReason;
      secData.warrantRisk = warrantConvertible.warrantRisk;
      secData.convertibleRisk = warrantConvertible.convertibleRisk;
      secData.reverseSplitRisk = reverseSplit.reverseSplitRisk;
      secData.latestRelevantFilings = secSummary.latestRelevantFilings || importantFilings;
    }

    return {
      symbol,
      ...buildSecEdgarIntelligence(secData, symbol),
    };
  } catch (error) {
    console.error(`SEC EDGAR error for ${symbol}:`, error.message);
    return buildSecEdgarIntelligence(
      { symbol, secDataStatus: 'unavailable', secRiskScore: null, secRiskLevel: 'unavailable',
        dilutionRisk: 'unavailable', offeringRisk: 'unavailable',
        warrantRisk: 'unavailable', convertibleRisk: 'unavailable',
        reverseSplitRisk: 'unavailable', secRiskFlags: [], secRiskReasons: ['Error fetching SEC data'],
        latestRelevantFilings: [], filings: [], cik: null },
      symbol
    );
  }
}

export async function GET(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (expectedSecret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const symbols = await fetchTrending(30);
    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No valid universe found' }, { status: 503 });
    }

    const results = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(symbol => analyzeSymbol(symbol).catch(() => null))
      );
      results.push(...batchResults.filter(Boolean));

      if (i + BATCH_SIZE < symbols.length) {
        await sleep(SEC_RATE_LIMIT_DELAY);
      }
    }

    const { ranked, top, alternatives } = rankSecOpportunities(results);

    const qualityFilter = ['TOP', 'STRONG', 'WATCH', 'WEAK', 'UNAVAILABLE'];
    const qualityCount = {};
    qualityFilter.forEach(q => { qualityCount[q] = results.filter(r => r.quality === q).length; });

    return NextResponse.json({
      success: true,
      count: results.length,
      scanned: symbols.length,
      data: ranked,
      top: top,
      alternatives: alternatives,
      filters: {
        quality: qualityFilter,
        eventCategories: ['MATERIAL_EVENT', 'INSIDER_BUYING', 'INSIDER_SELLING', 'OFFERING',
                          'DILUTION_RISK', 'SHELF_REGISTRATION', 'FINANCING', 'EARNINGS',
                          'CORPORATE_UPDATE', 'OWNERSHIP_CHANGE', 'REGULATORY_EVENT', 'ATM_CAPITAL_RAISE', 'OTHER'],
        flagFilters: ['MATERIAL_EVENT', 'INSIDER_ACTIVITY', 'CAPITAL_STRUCTURE_EVENT',
                      'DILUTION_RISK', 'OFFERING_RISK', 'FORM_4_FILED', 'HAS_8K',
                      'HAS_OFFERING', 'HAS_EARNINGS', 'HIGH_VALUE_INSIDER_TXN'],
      },
      dataAvailability: {
        filings: results.some(r => r.latestFiling != null),
        insiderActivity: results.some(r => r.insiderActivity?.form4Detected),
        materialEvents: results.some(r => r.materialEventInfo?.materialEventDetected),
        dilutionRisk: results.some(r => r.dilutionRisk !== 'unavailable'),
        offeringRisk: results.some(r => r.offeringRisk !== 'unavailable'),
        secRiskScore: results.some(r => r.secRiskScore != null),
        cik: results.some(r => r.cik != null),
      },
      limitations: [
        'SEC EDGAR data is limited to public filings',
        'Form 4 transaction direction requires document-level parsing (not available via submissions JSON)',
        'Filing content is not parsed — only metadata is analyzed',
        'SEC EDGAR rate limits may affect data freshness',
        'Not all companies file all form types',
      ],
      qualityBreakdown: qualityCount,
      disclaimer: 'SEC EDGAR Intelligence is analytical only. Not a buy/sell recommendation. Data sourced from SEC EDGAR. Missing data is explicitly nulled.',
    });
  } catch (error) {
    console.error('SEC EDGAR API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run SEC EDGAR Intelligence',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    );
  }
}
