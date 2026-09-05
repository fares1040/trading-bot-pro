// app/api/connectivity-health/route.js
import { NextResponse } from 'next/server';
import { list, summarize } from '@/lib/failure-events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Get summary for the last 5 minutes (300000 ms) to determine current status
    const summaryResult = summarize({ windowMs: 300000 });
    let status;
    switch (summaryResult.status) {
      case 'healthy':
        status = 'CONNECTED';
        break;
      case 'degraded':
        status = 'DEGRADED';
        break;
      case 'unavailable':
        status = 'UNAVAILABLE';
        break;
      default:
        status = 'ERROR';
    }

    // Fetch recent events to find last success and last failure
    // We'll fetch a reasonable number of events (e.g., 100) to cover recent history
    const events = list({ limit: 100 });

    let lastSuccess = null;
    let lastFailure = null;

    // The list function returns events in reverse chronological order (most recent first)
    const recentEvents = [...events]; // already most recent first

    for (const event of recentEvents) {
      // Check for success: severity INFO and errorType null (or message indicates success)
      const isSuccess = event.severity === 'INFO' && event.errorType === null;
      // Check for failure: not a success (or we can check for errorType not null or severity not INFO)
      const isFailure = !isSuccess;

      if (isSuccess && !lastSuccess) {
        lastSuccess = event.timestamp;
      }
      if (isFailure && !lastFailure) {
        lastFailure = event.timestamp;
      }

      // If we have both, we can break early
      if (lastSuccess && lastFailure) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      status,
      lastSuccess,
      lastFailure,
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    // If anything goes wrong, return ERROR status
    return NextResponse.json({
      success: false,
      status: 'ERROR',
      lastSuccess: null,
      lastFailure: null,
      error: 'Failed to compute connectivity health',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}