import { NextResponse } from 'next/server';
import { record } from '@/lib/failure-events';
import { probe, TIMEOUT_MS } from '@/lib/production-probe.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const origin = new URL(request.url).origin;

  const [health, indices, stocks] = await Promise.all([
    probe(`${origin}/api/health`, 'production.health', 'internal', null, true),
    probe(`${origin}/api/indices`, 'production.indices', 'yahoo', null, true),
    probe(`${origin}/api/stocks?symbol=SOFI`, 'production.stocks', 'yahoo', 'SOFI', true),
  ]);

  const checks = {
    health: health.ok,
    indices: indices.ok,
    stocks: stocks.ok,
  };

  const ready = checks.health && checks.indices && checks.stocks;

  return NextResponse.json({
    success: ready,
    status: ready ? 'production-ready' : 'needs-attention',
    timestamp: new Date().toISOString(),
    checks,
    latencyMs: {
      health: health.latencyMs,
      indices: indices.latencyMs,
      stocks: stocks.latencyMs,
    },
    failures: [
      !health.ok && { endpoint: 'health', error: health.error },
      !indices.ok && { endpoint: 'indices', error: indices.error },
      !stocks.ok && { endpoint: 'stocks', error: stocks.error },
    ].filter(Boolean),
    phases: {
      phase1: ready ? 'PASS' : 'FAIL',
      phase2: 'ACTIVE',
      phase3: 'ACTIVE',
      phase4: 'ACTIVE',
      phase5: 'PROVIDER-NOT-CONNECTED',
      phase6: 'ACTIVE',
      phase7: 'ACTIVE',
      phase8: 'FEATURE-GATED',
      vercel: 'READY AFTER EXTERNAL DEPLOYMENT CHECK',
    },
  }, {
    status: ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
