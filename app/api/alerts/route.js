import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

async function duplicate(supabase, ticker) {
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

async function saveSignal(supabase, item) {
  if (!supabase) return false;
  const ticker = item.kind === 'OPTIONS_CENTS'
    ? `OPT:${item.contract}`
    : item.kind === 'PENNY'
      ? `PENNY:${item.symbol}`
      : item.symbol;
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

function pickAlerts(data) {
  return [
    ...(data.technical || []).filter((x) => Number(x.score) >= 85).slice(0, 4),
    ...(data.penny || []).filter((x) => Number(x.score) >= 80 && Number(x.rvol || 0) >= 1.5).slice(0, 4),
    ...(data.options || []).filter((x) => Number(x.score) >= 75 && Number(x.premium) <= 1 && Number(x.volume || 0) >= 10).slice(0, 6),
  ];
}

function buildMessage(items, baseUrl) {
  let text = '🔥 <b>HUNTER AI — OPPORTUNITY ALERT</b>\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += 'هذه إشارات رصد آلية وليست ضمانًا للربح أو توصية مضمونة.\n\n';
  for (const x of items) {
    if (x.kind === 'OPTIONS_CENTS') {
      text += `🎯 <b>${x.symbol}</b> — ${x.side}\n`;
      text += `📜 ${x.contract}\n`;
      text += `💰 Premium: $${x.premium} | Contract: $${x.contractCost}\n`;
      text += `📅 ${x.expiry} | Strike: $${x.strike}\n`;
      text += `📊 Vol: ${x.volume} | OI: ${x.openInterest} | Score: ${x.score}\n`;
      text += '⚠️ High Risk / Speculative\n\n';
    } else {
      text += `🎯 <b>${x.symbol}</b> — ${x.kind}\n`;
      text += `💰 $${x.price ?? '—'} | Score: ${x.score}/100\n`;
      text += `⚡ RVOL: ${x.rvol ?? '—'}x | RSI: ${x.rsi ?? '—'}\n`;
      text += `🧠 ${(x.reasons || []).join(' • ') || x.action || 'مراجعة مطلوبة'}\n`;
      text += `⚠️ ${x.riskLabel || 'مراجعة وإدارة مخاطرة'}\n\n`;
    }
  }
  if (baseUrl) text += `📲 <a href="${baseUrl}">فتح HUNTER AI</a>`;
  return text;
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return r.ok;
}

async function sendDiscord(text) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return false;
  const r = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HUNTER AI', content: text.replace(/<[^>]+>/g, ''), allowed_mentions: { parse: [] } }),
  });
  return r.ok;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/opportunities`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Opportunity scan failed');

    const candidates = pickAlerts(data);
    const supabase = getSupabase();
    const newItems = [];

    for (const item of candidates) {
      const saved = await saveSignal(supabase, item);
      if (saved) newItems.push(item);
    }

    const allowWithoutSupabase = process.env.ALERTS_ALLOW_WITHOUT_SUPABASE === 'true';
    const shouldSend = newItems.length > 0 || (!supabase && allowWithoutSupabase && candidates.length > 0);
    let telegram = false;
    let discord = false;

    if (shouldSend) {
      const message = buildMessage(supabase ? newItems : candidates, process.env.NEXT_PUBLIC_BASE_URL || origin);
      [telegram, discord] = await Promise.allSettled([sendTelegram(message), sendDiscord(message)]).then((r) => [
        r[0].status === 'fulfilled' && r[0].value,
        r[1].status === 'fulfilled' && r[1].value,
      ]);
    }

    return NextResponse.json({
      success: true,
      scanned: candidates.length,
      newAlerts: newItems.length,
      sent: { telegram, discord },
      dedupe: Boolean(supabase),
      note: supabase ? 'التنبيهات مكررة الحماية عبر auto_signals.' : 'لم يتم إرسال تنبيهات متكررة بدون Supabase إلا إذا ALERTS_ALLOW_WITHOUT_SUPABASE=true.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'تعذر تشغيل محرك التنبيهات حالياً.' }, { status: 503 });
  }
}
