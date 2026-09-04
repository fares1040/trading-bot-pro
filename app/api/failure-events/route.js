// app/api/failure-events/route.js
import { NextResponse } from 'next/server';
import { list, summarize, SEVERITY, ERROR_TYPES, PROVIDERS, clear } from '@/lib/failure-events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const since = searchParams.get('since');
    const severity = searchParams.get('severity') || null;
    const provider = searchParams.get('provider') || null;
    const route = searchParams.get('route') || null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const summary = searchParams.get('summary') === 'true';
    const clearAll = searchParams.get('clear') === 'true';

    if (clearAll) {
      clear();
      return NextResponse.json({
        success: true,
        message: 'Failure events cleared',
        timestamp: new Date().toISOString(),
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    if (summary) {
      const windowMs = parseInt(searchParams.get('windowMs') || '900000', 10);
      const result = summarize({ windowMs });
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: result,
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const events = list({
      since,
      severity: severity || null,
      provider: provider || null,
      route: route || null,
      limit,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      events,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch failure events',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export { SEVERITY, ERROR_TYPES, PROVIDERS };
