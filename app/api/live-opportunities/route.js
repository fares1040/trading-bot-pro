/**
 * Live Opportunities API
 *
 * GET /api/live-opportunities?symbols=NVDA,AMD,TSLA
 *
 * Returns live market opportunity data for explicit symbols.
 * Maximum 10 symbols. No discovery. No fabrication.
 *
 * Uses existing Yahoo polling via live-market-data.js.
 * Uses existing access control pattern.
 * Uses existing circuit breaker for Yahoo.
 */

import { NextResponse } from 'next/server';
import { processLiveOpportunities } from '@/lib/live-opportunity-service.js';
import { shouldAllowProviderCall } from '@/lib/circuit-breaker-manager.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SYMBOL_RE = /^[A-Z][A-Z0-9.^=-]{0,11}$/;
const MAX_SYMBOLS = 10;

export async function GET(request) {
  try {
    // Circuit breaker check
    const cbResult = shouldAllowProviderCall('yahoo');
    if (cbResult && !cbResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          source: 'yahoo',
          mode: 'live',
          generatedAt: new Date().toISOString(),
          data: [],
          errors: [{ symbol: '', error: 'Yahoo circuit breaker open — try again later' }],
          disclaimer: 'Live opportunity radar is derived from polled Yahoo data.',
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Parse symbols from query
    const { searchParams } = new URL(request.url);
    const symbolsRaw = searchParams.get('symbols') || '';

    if (!symbolsRaw.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: symbols',
          usage: '/api/live-opportunities?symbols=NVDA,AMD,TSLA',
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const rawSymbols = symbolsRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (rawSymbols.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid symbols provided',
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Validate symbol format before processing
    const invalidSymbols = rawSymbols.filter(s => !SYMBOL_RE.test(s.toUpperCase()));
    if (invalidSymbols.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid symbol format: ${invalidSymbols.join(', ')}`,
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Process
    const result = await processLiveOpportunities(rawSymbols);

    return NextResponse.json(result, {
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
        errors: [{ symbol: '', error: error?.message || 'Internal error' }],
        disclaimer: 'Live opportunity radar is derived from polled Yahoo data.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
