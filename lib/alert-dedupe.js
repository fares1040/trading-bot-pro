/**
 * Alert Dedupe Module
 *
 * Extracted from app/api/alerts/route.js for deterministic testing.
 * Preserves exact behavior: 60-minute window, key prefixes, Supabase safety.
 */

export function getDedupeKey(item) {
  if (item.kind === 'OPTIONS_CENTS') {
    return `OPT:${item.contract}`;
  }
  if (item.kind === 'PENNY') {
    return `PENNY:${item.symbol}`;
  }
  if (item.kind === 'TECHNICAL') {
    return `HUNTER:${item.symbol}`;
  }
  return item.symbol;
}

export async function duplicate(supabase, ticker) {
  if (!supabase) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from('auto_signals')
      .select('ticker,created_at')
      .eq('ticker', ticker)
      .gte('created_at', since)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function saveSignal(supabase, item) {
  if (!supabase) return false;
  const ticker = getDedupeKey(item);
  if (await duplicate(supabase, ticker)) return false;
  const row = {
    ticker,
    price: Number(item.price ?? item.premium ?? 0) || null,
    change_percent: null,
    volume_status: item.kind === 'OPTIONS_CENTS'
      ? `Option volume ${item.volume ?? 0}`
      : `RVOL ${item.rvol ?? 'N/A'}x`,
    target_price: null,
    stop_loss: null,
    confidence: Number(item.score) || 0,
    reason: `${item.kind}: ${(item.reasons || []).join(' • ')}`,
    sector: null,
    option_idea: item.kind === 'OPTIONS_CENTS' ? item.contract : null,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('auto_signals').insert([row]);
  return !error;
}