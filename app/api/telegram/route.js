
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* =========================================================
   SUPABASE
========================================================= */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

/* =========================================================
   TELEGRAM
========================================================= */

function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

async function sendTelegramMessage(
  token,
  chatId,
  text,
  options = {}
) {
  if (!token || !chatId) {
    return {
      delivered: false,
      reason: 'Telegram credentials missing',
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }),
    }
  );

  if (!response.ok) {
    const details =
      await response
        .text()
        .catch(() => 'Telegram send failed');

    throw new Error(
      details || 'Telegram send failed'
    );
  }

  return {
    delivered: true,
  };
}

/* =========================================================
   HELPERS
========================================================= */

function cleanSymbol(value) {
  const symbol =
    String(value || '')
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z][A-Z0-9.-]{0,7}$/.test(
      symbol
    )
  ) {
    return null;
  }

  return symbol;
}

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatNumber(
  value,
  decimals = 2
) {
  const number =
    safeNumber(value);

  if (number == null) {
    return 'غير متاح';
  }

  return number.toFixed(
    decimals
  );
}

function formatVolume(value) {
  const number =
    safeNumber(value);

  if (number == null) {
    return 'غير متاح';
  }

  return Math.round(
    number
  ).toLocaleString(
    'en-US'
  );
}

/* =========================================================
   BASE URL
========================================================= */

function getBaseUrl(request) {
  const configured =
    process.env.NEXT_PUBLIC_BASE_URL;

  if (configured) {
    return configured.replace(
      /\/$/,
      ''
    );
  }

  const forwardedHost =
    request.headers.get(
      'x-forwarded-host'
    );

  const host =
    forwardedHost ||
    request.headers.get(
      'host'
    );

  const forwardedProto =
    request.headers.get(
      'x-forwarded-proto'
    );

  const protocol =
    forwardedProto ||
    (
      process.env.NODE_ENV ===
      'development'
        ? 'http'
        : 'https'
    );

  if (host) {
    return `${protocol}://${host}`;
  }

  return null;
}

/* =========================================================
   ANALYZE API
========================================================= */

async function fetchAnalysis(
  request,
  symbol
) {
  const baseUrl =
    getBaseUrl(request);

  if (!baseUrl) {
    return null;
  }

  const url =
    `${baseUrl}/api/analyze`;

  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          symbol,
          mode: 'general',
        }),

        cache: 'no-store',
      }
    );

  if (!response.ok) {
    return null;
  }

  return response
    .json()
    .catch(() => null);
}

/* =========================================================
   FORMAT ANALYSIS
========================================================= */

function formatAnalysis(
  symbol,
  data
) {
  if (!data?.success) {
    return (
      `⚠️ <b>${symbol}</b>\n\n` +
      `تعذر الحصول على التحليل المباشر حالياً.\n` +
      `حاول مرة أخرى بعد قليل.`
    );
  }

  const score =
    safeNumber(
      data.aiScore
    );

  const price =
    safeNumber(
      data.price
    );

  const change =
    String(
      data.change ||
        'غير متاح'
    );

  const rsi =
    safeNumber(
      data.rsi
    );

  const relativeVolume =
    safeNumber(
      data.relativeVolume
    );

  const sma20 =
    safeNumber(
      data.sma20
    );

  const sma50 =
    safeNumber(
      data.sma50
    );

  const target =
    safeNumber(
      data.targetPrice
    );

  let scoreEmoji = '🟡';

  if (
    score != null &&
    score >= 85
  ) {
    scoreEmoji = '🟢';
  } else if (
    score != null &&
    score >= 65
  ) {
    scoreEmoji = '🟡';
  } else if (
    score != null &&
    score < 50
  ) {
    scoreEmoji = '🔴';
  }

  return (
    `📊 <b>TRADING BOT PRO — ANALYSIS</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +

    `🎯 <b>${symbol}</b>\n` +
    `💰 السعر: <b>$${formatNumber(price)}</b>\n` +
    `📈 التغير: <b>${change}</b>\n\n` +

    `${scoreEmoji} <b>Technical Score:</b> ` +
    `${score != null ? `${score}/100` : 'غير متاح'}\n` +

    `🧭 الاتجاه: ` +
    `${data.directionBias || 'غير متاح'}\n` +

    `⚠️ مستوى المخاطرة: ` +
    `${data.riskLevel || 'غير متاح'}\n\n` +

    `📊 <b>Technical Data</b>\n` +
    `• RSI: ${rsi != null ? formatNumber(rsi, 1) : 'غير متاح'}\n` +
    `• Relative Volume: ${relativeVolume != null ? `${formatNumber(relativeVolume, 2)}x` : 'غير متاح'}\n` +
    `• SMA20: ${sma20 != null ? `$${formatNumber(sma20)}` : 'غير متاح'}\n` +
    `• SMA50: ${sma50 != null ? `$${formatNumber(sma50)}` : 'غير متاح'}\n` +
    `• Momentum: ${data.momentum ?? 'غير متاح'}\n` +
    `• Breakout: ${data.breakoutScore ?? 'غير متاح'}\n\n` +

    `🎯 الهدف الفني: ` +
    `${target != null ? `$${formatNumber(target)}` : 'غير متاح'}\n\n` +

    `🧠 <b>الخلاصة</b>\n` +
    `${data.recommendation || 'انتظر تأكيد السعر والحجم قبل اتخاذ القرار.'}\n\n` +

    `⚠️ <i>هذه قراءة فنية وليست ضماناً للربح.</i>`
  );
}

/* =========================================================
   ALERTS
========================================================= */

async function getLatestAlerts() {
  const supabase =
    getSupabase();

  if (!supabase) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from('auto_signals')
    .select('*')
    .order(
      'created_at',
      {
        ascending: false,
      }
    )
    .limit(5);

  if (error) {
    console.error(
      'Telegram alerts query error:',
      error.message
    );

    return [];
  }

  return data || [];
}

function formatAlerts(
  alerts
) {
  if (!alerts.length) {
    return (
      `🔔 <b>TRADING BOT PRO — ALERTS</b>\n\n` +
      `لا توجد إشارات محفوظة حالياً.`
    );
  }

  let text =
    `🔥 <b>TRADING BOT PRO — LATEST ALERTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n`;

  alerts.forEach(
    (alert, index) => {
      const ticker =
        alert?.ticker ||
        alert?.symbol ||
        'UNKNOWN';

      const price =
        safeNumber(
          alert?.price
        );

      const confidence =
        safeNumber(
          alert?.confidence
        );

      text +=
        `${index + 1}. <b>${ticker}</b>\n` +
        `💰 السعر: ${
          price != null
            ? `$${formatNumber(price)}`
            : 'غير متاح'
        }\n` +
        `🎯 الهدف: ${
          alert?.target_price != null
            ? `$${formatNumber(alert.target_price)}`
            : 'غير متاح'
        }\n` +
        `🛑 وقف الخسارة: ${
          alert?.stop_loss != null
            ? `$${formatNumber(alert.stop_loss)}`
            : 'غير متاح'
        }\n` +
        `🧠 الثقة: ${
          confidence != null
            ? `${formatNumber(confidence, 0)}%`
            : 'غير متاح'
        }\n` +
        `📌 ${
          alert?.volume_status ||
          'إشارة فنية'
        }\n\n`;
    }
  );

  text +=
    `⚠️ الإشارات تحتاج تأكيداً من البيانات الحالية قبل الدخول.`;

  return text;
}

/* =========================================================
   START
========================================================= */

function startMessage() {
  return (
    `🚀 <b>أهلاً بك في Trading Bot Pro V4</b>\n\n` +

    `📊 <b>الأوامر المتاحة:</b>\n\n` +

    `🔎 <code>/analyze SOFI</code>\n` +
    `تحليل فني مباشر للسهم.\n\n` +

    `🔔 <code>/alerts</code>\n` +
    `آخر إشارات الرادار المحفوظة.\n\n` +

    `ℹ️ <code>/help</code>\n` +
    `عرض قائمة الأوامر.\n\n` +

    `━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ لا يتم اعتبار أي إشارة ضماناً للربح.`
  );
}

/* =========================================================
   HELP
========================================================= */

function helpMessage() {
  return (
    `🤖 <b>Trading Bot Pro V4</b>\n\n` +

    `🔎 <code>/analyze SYMBOL</code>\n` +
    `مثال: <code>/analyze NVDA</code>\n\n` +

    `🔔 <code>/alerts</code>\n` +
    `عرض آخر التنبيهات.\n\n` +

    `🚀 <code>/start</code>\n` +
    `القائمة الرئيسية.\n\n` +

    `⚠️ البيانات تعتمد على مصادر السوق المتاحة للنظام.`
  );
}

/* =========================================================
   LOG
========================================================= */

async function logCommand(
  supabase,
  chatId,
  text,
  status,
  details = ''
) {
  if (!supabase) {
    return;
  }

  try {
    const {
      error,
    } = await supabase
      .from('execution_logs')
      .insert([
        {
          task_name:
            'telegram_bot_response',

          status,

          details:
            `ChatID: ${chatId} | Command: ${text} | ${details}`,
        },
      ]);

    if (error) {
      console.error(
        'Supabase Telegram log error:',
        error.message
      );
    }
  } catch (error) {
    console.error(
      'Telegram log exception:',
      error
    );
  }
}

/* =========================================================
   WEBHOOK
========================================================= */

export async function POST(
  request
) {
  const supabase =
    getSupabase();

  try {
    /* -----------------------------------------------------
       SECURITY
    ----------------------------------------------------- */

    const webhookSecret =
      process.env.TELEGRAM_WEBHOOK_SECRET;

    if (
      webhookSecret &&
      request.headers.get(
        'x-telegram-bot-api-secret-token'
      ) !== webhookSecret
    ) {
      return NextResponse.json(
        {
          error:
            'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const message =
      body?.message ||
      body?.edited_message;

    if (
      !message?.text ||
      !message?.chat?.id
    ) {
      return NextResponse.json(
        {
          status:
            'No message found',
        },
        {
          status: 200,
        }
      );
    }

    const chatId =
      message.chat.id;

    const text =
      String(
        message.text
      ).trim();

    const parts =
      text.split(
        /\s+/
      );

    const rawCommand =
      parts[0] ||
      '';

    const command =
      rawCommand
        .split('@')[0]
        .toLowerCase();

    const token =
      getTelegramToken();

    /* -----------------------------------------------------
       COMMAND
    ----------------------------------------------------- */

    let responseText = null;

    if (
      command ===
      '/start'
    ) {
      responseText =
        startMessage();
    }

    else if (
      command ===
      '/help'
    ) {
      responseText =
        helpMessage();
    }

    else if (
      command ===
      '/alerts'
    ) {
      const alerts =
        await getLatestAlerts();

      responseText =
        formatAlerts(
          alerts
        );
    }

    else if (
      command ===
      '/analyze'
    ) {
      const symbol =
        cleanSymbol(
          parts[1]
        );

      if (!symbol) {
        responseText =
          `❌ <b>صيغة الأمر غير صحيحة</b>\n\n` +
          `استخدم:\n` +
          `<code>/analyze SOFI</code>`;
      } else {
        /*
         * نطلب التحليل الحقيقي
         * من /api/analyze بدلاً
         * من إنشاء قراءة مستقلة.
         */

        const analysis =
          await fetchAnalysis(
            request,
            symbol
          );

        responseText =
          formatAnalysis(
            symbol,
            analysis
          );
      }
    }

    else {
      responseText =
        `🤖 لم أفهم الأمر.\n\n` +
        `استخدم <code>/help</code> لعرض الأوامر المتاحة.`;
    }

    /* -----------------------------------------------------
       LOG
    ----------------------------------------------------- */

    await logCommand(
      supabase,
      chatId,
      text,
      'success'
    );

    /* -----------------------------------------------------
       TELEGRAM
    ----------------------------------------------------- */

    if (!token) {
      return NextResponse.json(
        {
          status:
            'ok',

          delivered:
            false,

          message:
            responseText,
        },
        {
          status: 200,
        }
      );
    }

    await sendTelegramMessage(
      token,
      chatId,
      responseText
    );

    return NextResponse.json(
      {
        status:
          'success',

        delivered:
          true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'Telegram Bot Route Error:',
      error
    );

    const token =
      getTelegramToken();

    /*
     * إذا كان الخطأ داخل المعالجة
     * نحاول إرسال رسالة مفهومة
     * للمستخدم بدلاً من ترك Telegram
     * بدون رد.
     */

    try {
      const body =
        request.clone
          ? await request
              .clone()
              .json()
              .catch(
                () => null
              )
          : null;

      const chatId =
        body?.message?.chat?.id;

      if (
        token &&
        chatId
      ) {
        await sendTelegramMessage(
          token,
          chatId,
          `⚠️ <b>تعذر تنفيذ الطلب حالياً.</b>\n\n` +
            `حاول مرة أخرى بعد قليل.`
        );
      }

      await logCommand(
        supabase,
        chatId,
        body?.message?.text ||
          'unknown',
        'error',
        error?.message ||
          'Unknown error'
      );
    } catch (sendError) {
      console.error(
        'Telegram error response failed:',
        sendError
      );
    }

    return NextResponse.json(
      {
        success:
          false,

        error:
          'تعذر تنفيذ أمر البوت',
      },
      {
        status: 503,
      }
    );
  }
}