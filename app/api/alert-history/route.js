import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

function classifyKind(ticker) {
  if (ticker.startsWith('HUNTER:')) return 'TECHNICAL';
  if (ticker.startsWith('PENNY:')) return 'PENNY';
  if (ticker.startsWith('OPT:')) return 'OPTIONS_CENTS';
  return 'UNKNOWN';
}

function extractSymbol(ticker) {
  const idx = ticker.indexOf(':');
  return idx >= 0 ? ticker.slice(idx + 1) : ticker;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.trim().toUpperCase() || null;
  const kind = searchParams.get('kind')?.trim().toUpperCase() || null;
  const rawLimit = Number(searchParams.get('limit') || 50);
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const startDate = searchParams.get('startDate') || null;
  const endDate = searchParams.get('endDate') || null;

  let query = supabase
    .from('auto_signals')
    .select('ticker, price, confidence, reason, created_at, volume_status, option_idea')
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch alert history' }, { status: 500 });
  }

  let results = (data || []).map(row => ({
    ...row,
    kind: classifyKind(row.ticker),
    symbol: extractSymbol(row.ticker),
  }));

  if (kind) {
    results = results.filter(r => r.kind === kind);
  }

  if (symbol) {
    results = results.filter(r => r.symbol === symbol);
  }

  results = results.slice(0, limit);

  return NextResponse.json({
    success: true,
    count: results.length,
    data: results,
    filters: { symbol, kind, limit, startDate, endDate },
  });
}
