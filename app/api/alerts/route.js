import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDedupeKey, duplicate, saveSignal } from '@/lib/alert-dedupe';
import { ALERT_THRESHOLDS } from '@/lib/alert-thresholds';
import { sendTelegram, sendDiscord } from '@/lib/alert-notifier';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

function pickAlerts(data) {
  return [
    // Hunter/Technical: require BOTH hunterEligible === true AND hunterScore >= 85
    // Do NOT treat legacy Technical Score as equivalent to Hunter Score.
    ...(data.technical || []).filter((x) =>
      x.hunterEligible === true && Number(x.hunterScore) >= ALERT_THRESHOLDS.hunterMinScore
    ).slice(0, 4),
    // Penny: preserve existing behavior
    ...(data.penny || []).filter((x) => Number(x.score) >= ALERT_THRESHOLDS.pennyMinScore && Number(x.rvol || 0) >= ALERT_THRESHOLDS.pennyMinRvol).slice(0, 4),
    // Options: preserve existing behavior
    ...(data.options || []).filter((x) => Number(x.score) >= ALERT_THRESHOLDS.optionsMinScore && Number(x.premium) <= ALERT_THRESHOLDS.optionsMaxPremium && Number(x.volume || 0) >= ALERT_THRESHOLDS.optionsMinVolume).slice(0, 6),
  ];
}

function buildMessage(items, baseUrl, maxLength = 4000) {
  let text = '🔥 <b>HUNTER AI — OPPORTUNITY ALERT</b>\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += 'هذه إشارات رصد آلية وليست ضمانًا للربح أو توصية مضمونة.\n\n';
  for (const x of items) {
    if (text.length >= maxLength) break;
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
      text += `⚠️ ${x.riskLabel || 'مراجعة وإدارة مخاطرة'}\n\n';
    }
  }
  if (baseUrl && text.length < maxLength) text += `📲 <a href="${baseUrl}">فتح HUNTER AI</a>`;
  return text;
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
      const telegramMessage = buildMessage(supabase ? newItems : candidates, process.env.NEXT_PUBLIC_BASE_URL || origin, 4000);
      const discordMessage = buildMessage(supabase ? newItems : candidates, process.env.NEXT_PUBLIC_BASE_URL || origin, 1900);
      [telegram, discord] = await Promise.allSettled([sendTelegram(telegramMessage), sendDiscord(discordMessage)]).then((r) => [
        r[0].status === 'fulfilled' && r[0].value,
        r[1].status === 'fulfilled' && r[1].value,
      ]);
    }

    const response = {
      success: true,
      scanned: candidates.length,
      newAlerts: newItems.length,
      sent: { telegram, discord },
      dedupe: Boolean(supabase),
      note: supabase ? 'التنبيهات مكررة الحماية عبر auto_signals.' : 'لم يتم إرسال تنبيهات متكررة بدون Supabase إلا إذا ALERTS_ALLOW_WITHOUT_SUPABASE=true.',
      timestamp: new Date().toISOString(),
    };

    if (newItems.length === 0) {
      const reasons = [];
      if (candidates.length === 0) reasons.push('no_candidates');
      else if (!supabase) reasons.push('supabase_unavailable');
      else reasons.push('all_candidates_deduped');

      response.emptyState = {
        reason: reasons[0],
        reasons,
        scanned: candidates.length,
        deduped: candidates.length - newItems.length,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'تعذر تشغيل محرك التنبيهات حالياً.' }, { status: 503 });
  }
}
