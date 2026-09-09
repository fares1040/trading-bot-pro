/**
 * Live Opportunities API
 *
 * GET /api/live-opportunities?symbols=NVDA,AMD,TSLA
 *
 * Returns live market opportunity data for explicit symbols.
 * Maximum 10 symbols. No discovery. No fabrication.
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

export async function GET(request) {
  try {
    const access = checkDashboardAccess(request);
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason || 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
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

    const { searchParams } = new URL(request.url);
    const symbolsRaw = searchParams.get('symbols') || '';

    if (!symbolsRaw.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: symbols',
          usage: '/api/live-opportunities?symbols=NVDA,AMD,TSLA',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const rawSymbols = symbolsRaw.split(',').map((s) => s.trim()).filter(Boolean);

    if (rawSymbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid symbols provided' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const invalidSymbols = rawSymbols.filter((s) => !SYMBOL_RE.test(s.toUpperCase()));
    if (invalidSymbols.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid symbol format: ${invalidSymbols.join(', ')}`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await processLiveOpportunities(rawSymbols);
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
        error: error?.message || 'Internal error',
        source: 'yahoo',
        mode: 'live',
        generatedAt: new Date().toISOString(),
        data: [],
        summary: buildLiveIntelligenceSummary([]),
        errors: [{ symbol: '', error: error?.message || 'Internal error' }],
        disclaimer: 'Live opportunity radar is derived from polled Yahoo data.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
