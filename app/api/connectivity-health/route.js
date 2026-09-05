// app/api/connectivity-health/route.js
import { NextResponse } from 'next/server';
import { list, summarize } from '@/lib/failure-events';
import { buildConnectivityHealth, probeAllEndpoints, HEALTH_STATUS, ENDPOINT_PROVIDERS } from '@/lib/connectivity-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROBE_ENDPOINTS = Object.keys(ENDPOINT_PROVIDERS);
const PROBE_TIMEOUT_MS = 10000;

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;
    const probeParam = url.searchParams.get('probe') === 'true';

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

    const events = list({ limit: 100 });

    let lastSuccess = null;
    let lastFailure = null;

    const recentEvents = [...events];

    for (const event of recentEvents) {
      const isSuccess = event.severity === 'INFO' && event.errorType === null;
      const isFailure = !isSuccess;

      if (isSuccess && !lastSuccess) {
        lastSuccess = event.timestamp;
      }
      if (isFailure && !lastFailure) {
        lastFailure = event.timestamp;
      }

      if (lastSuccess && lastFailure) {
        break;
      }
    }

    const circuitHealth = buildConnectivityHealth();

    let probeResults = null;
    if (probeParam) {
      try {
        probeResults = await probeAllEndpoints(
          PROBE_ENDPOINTS.map((ep) => ({ endpoint: ep, origin })),
          PROBE_TIMEOUT_MS
        );
      } catch {
        probeResults = null;
      }
    }

    return NextResponse.json({
      success: true,
      status,
      lastSuccess,
      lastFailure,
      timestamp: new Date().toISOString(),
      endpoints: circuitHealth.endpoints,
      summary: circuitHealth.summary,
      totalEndpoints: circuitHealth.totalEndpoints,
      healthy: circuitHealth.healthy,
      degraded: circuitHealth.degraded,
      unavailable: circuitHealth.unavailable,
      probe: probeParam ? {
        enabled: true,
        results: probeResults?.endpoints || null,
        aggregate: probeResults?.status || HEALTH_STATUS.UNCHECKED,
      } : { enabled: false },
      disclaimer: 'Connectivity health combines circuit-breaker state and recent failure events. Live probes are opt-in via ?probe=true. No status is fabricated.',
      errors: [],
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
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

export { HEALTH_STATUS, ENDPOINT_PROVIDERS };
