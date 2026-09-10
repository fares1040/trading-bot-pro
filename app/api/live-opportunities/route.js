/**
 * Live Opportunities API
 *
 * GET /api/live-opportunities?symbols=NVDA,AMD,TSLA
 *
 * Returns live market opportunity data for explicit symbols.
 * Maximum 10 unique symbols. No discovery. No fabrication.
 *
 * Uses existing Yahoo polling via live-market-data.js.
 * Uses existing dashboard read-access control.
 * Uses existing circuit breaker for Yahoo.
 */

import { NextResponse } from 'next/server';
import { checkDashboardAccess } from '@/lib/access-control.js';
import { processLiveOpportunities } from '@/lib/live-opportunity-service.js';
import { buildLiveIntelligenceSummary } from '@/lib/live-intelligence-summary.js';
import { shouldAllowProviderCall } from '@/lib/circuit-breaker-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;
const MAX_SYMBOLS = 10;
const MAX_SYMBOLS_QUERY_LENGTH = 256;

function apiError(error, status = 400) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request) {
  try {
    const access = checkDashboardAccess(request);
    if (!access.allowed) {
      return apiError(access.reason || 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const symbolsRaw = searchParams.get('symbols') || '';

    if (!symbolsRaw.trim()) {
      return apiError('Missing required parameter: symbols');
    }

    if (symbolsRaw.length > MAX_SYMBOLS_QUERY_LENGTH) {
      return apiError(`Symbols query is too long. Maximum is ${MAX_SYMBOLS_QUERY_LENGTH} characters.`);
    }

    const rawSymbols = symbolsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const normalizedSymbols = rawSymbols.map((symbol) => symbol.toUpperCase());

    const invalidSymbols = normalizedSymbols.filter((symbol) => !SYMBOL_RE.test(symbol));
    if (invalidSymbols.length > 0) {
      return apiError(`Invalid symbol format: ${invalidSymbols.join(', ')}`);
    }

    const symbols = [...new Set(normalizedSymbols)];
    if (symbols.length === 0) {
      return apiError('No valid symbols provided');
    }

    if (symbols.length > MAX_SYMBOLS) {
      return apiError(`Too many symbols. Maximum is ${MAX_SYMBOLS}.`);
    }

    const cbResult = shouldAllowProviderCall('yahoo');
    if (cbResult && !cbResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          source: 'yahoo',
          mode: 'live',
          generatedAt: new Date().toISOString(),
          data: [],
          summary: buildLiveIntelligenceSummary([]),
          errors: [{ symbol: '', error: 'Yahoo circuit breaker open — try again later' }],
          disclaimer: 'Live opportunity radar is derived from polled Yahoo data.',
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }

    const result = await processLiveOpportunities(symbols);
    const summary = buildLiveIntelligenceSummary(result.data);

    return NextResponse.json({ ...result, summary }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Live opportunities error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Live opportunities request failed',
        source: 'yahoo',
        mode: 'live',
        generatedAt: new Date().toISOString(),
        data: [],
        summary: buildLiveIntelligenceSummary([]),
        errors: [{ symbol: '', error: 'Live opportunities request failed' }],
        disclaimer: 'Live opportunity radar is derived from polled Yahoo data.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
