import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
|--------------------------------------------------------------------------
| Trading Bot Pro V4
|--------------------------------------------------------------------------
| IMPORTANT:
| The Telegram bot does NOT calculate technical indicators independently.
| It delegates analysis to the official /api/analyze engine.
|
| This guarantees:
| Telegram Bot = Web App = Same Analysis Engine
|--------------------------------------------------------------------------
*/

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  return url && key ? createClient(url, key) : null;
}

function cleanSymbol(value) {
  const symbol = String(value || '')
    .trim()
    .toUpperCase();

  if (!/^[A-Z][A-Z0-9.^=-]{0,11}$/.test(symbol)) {
    return null;
  }

  return symbol;
}

function getBaseUrl(request) {
  /*
   * Priority:
   * 1. Explicit application URL
   * 2. Vercel deployment URL
   * 3. Incoming request host
   */

  const configured =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const host = request.headers.get('host');

  if (host) {
    const forwardedProto =
      request.headers.get('x-forwarded-proto');

    const protocol =
      forwardedProto ||
      (host.startsWith('localhost')
        ? 'http'
        : 'https');

    return `${protocol}://${host}`;
  }

  return null;
}

async function callOfficialAnalyzer(request, symbol) {
  const baseUrl = getBaseUrl(request);

  if (!baseUrl) {
    throw new Error(
      'تعذر تحديد عنوان محرك التحليل الرئيسي'
    );
  }

  const response = await fetch(
    `${baseUrl}/api/analyze`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        symbol,
        mode: 'general',
      }),
      cache: 'no-store',
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.error ||
      'تعذر الحصول على التحليل الرئيسي'
    );
  }

  return data;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'غير متاح';
  }

  return number.toFixed(digits);
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'غير متاح';
  }

  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function buildAnalysisMessage(data) {
  const symbol = data.symbol || 'UNKNOWN';

  const score = Number(data.aiScore);

  const scoreText = Number.isFinite(score)
    ? `${score}/100`
    : 'غير متاح';

  const recommendation =
    data.recommendation ||
    'انتظر تأكيد السعر والحجم قبل اتخاذ القرار.';

  const analysis =
    data.analysis ||
    'لا يوجد تفسير إضافي متاح حالياً.';

  const signal =
    data.signal ||
    'لا توجد إشارة إضافية.';

  const direction =
    data.directionBias ||
    'غير متاح';

  const risk =
    data.riskLevel ||
    'غير متاح';

  return [
    `🤖 Trading Bot Pro V4`,
    ``,
    `📊 ${symbol}`,
    `💰 السعر: $${formatNumber(data.price)}`,
    `📈 التغير: ${data.change || 'غير متاح'}`,
    ``,
    `🧠 Technical Score: ${scoreText}`,
    `📊 RSI: ${formatNumber(data.rsi, 1)}`,
    `📦 RVOL: ${data.relativeVolume ?? 'غير متاح'}x`,
    `📐 SMA20: $${formatNumber(data.sma20)}`,
    `📐 SMA50: $${formatNumber(data.sma50)}`,
    ``,
    `🎯 الهدف: ${
      data.targetPrice != null
        ? `$${formatNumber(data.targetPrice)}`
        : 'غير مؤكد'
    }`,
    `⚠️ مستوى المخاطرة: ${risk}`,
    `🧭 الاتجاه: ${direction}`,
    ``,
    `💡 التوصية:`,
    recommendation,
    ``,
    `🔎 الإشارة:`,
    signal,
    ``,
    `🧠 التحليل:`,
    analysis,
    ``,
    `⚠️ التحليل مبني على البيانات المتاحة حالياً، وليس ضماناً للنتيجة المستقبلية.`,
  ].join('\n');
}

/*
|--------------------------------------------------------------------------
| NON-CRITICAL EXECUTION LOGGING
|--------------------------------------------------------------------------
| Supabase logging must never break the Telegram bot.
| If Supabase is unavailable, the bot continues normally.
|--------------------------------------------------------------------------
*/

async function logExecution(chatId, text, status = 'success') {
  const supabase = getSupabase();

  if (!supabase) {
    return false;
  }

  try {
    const details =
      `ChatID: ${chatId} | Command: ${text}`;

    const { error } = await supabase
      .from('execution_logs')
      .insert([
        {
          task_name: 'telegram_bot_response',
          status,
          details,
        },
      ]);

    if (error) {
      console.warn(
        'Supabase execution log unavailable:',
        error.message
      );

      return false;
    }

    return true;
  } catch (error) {
    /*
     * Execution logging is non-critical.
     * A Supabase/network failure must never
     * break Telegram bot analysis or delivery.
     */
    console.warn(
      'Supabase execution log skipped:',
      error?.message || error
    );

    return false;
  }
}

async function sendTelegramMessage(
  token,
  chatId,
  text
) {
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
        disable_web_page_preview: true,
      }),
    }
  );

  if (!response.ok) {
    const details = await response
      .text()
      .catch(() => '');

    throw new Error(
      details || 'Telegram send failed'
    );
  }

  return true;
}

export async function POST(request) {
  try {
    /*
    |--------------------------------------------------------------------------
    | Telegram Webhook Security
    |--------------------------------------------------------------------------
    */

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
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const message =
      body?.message ||
      body?.edited_message;

    if (
      !message?.text ||
      !message?.chat?.id
    ) {
      return NextResponse.json(
        {
          status: 'No message found',
        },
        {
          status: 200,
        }
      );
    }

    const chatId = message.chat.id;

    const text = String(message.text)
      .trim();

    const parts = text.split(/\s+/);

    const command =
      String(parts[0] || '')
        .toLowerCase()
        .split('@')[0];

    const requestedSymbol =
      cleanSymbol(parts[1]);

    let responseText =
      [
        '👋 أهلاً بك في Trading Bot Pro V4.',
        '',
        'الأوامر المتاحة:',
        '',
        '/analyze SYMBOL',
        '/scan SYMBOL',
        '/alerts',
        '/start',
        '',
        'مثال:',
        '/analyze SOFI',
      ].join('\n');

    /*
    |--------------------------------------------------------------------------
    | START
    |--------------------------------------------------------------------------
    */

    if (command === '/start') {
      responseText =
        [
          '🤖 Trading Bot Pro V4',
          '',
          'أهلاً بك 👋',
          '',
          'يمكنك استخدام:',
          '',
          '🔎 /analyze SOFI',
          '🔎 /scan NVDA',
          '🔔 /alerts',
          '',
          'ملاحظة:',
          'البوت يستخدم محرك التحليل الرئيسي للمنصة، لذلك لا توجد معادلات منفصلة عن الواجهة.',
        ].join('\n');
    }

    /*
    |--------------------------------------------------------------------------
    | ANALYZE / SCAN
    |--------------------------------------------------------------------------
    */

    else if (
      command === '/analyze' ||
      command === '/scan'
    ) {
      if (!requestedSymbol) {
        responseText =
          [
            '⚠️ رمز السهم غير موجود.',
            '',
            'استخدم الأمر بهذا الشكل:',
            '',
            '/analyze SOFI',
            '',
            'أو:',
            '',
            '/scan NVDA',
          ].join('\n');
      } else {
        try {
          responseText =
            '⏳ جاري تحليل ' +
            requestedSymbol +
            ' باستخدام محرك Trading Bot Pro الرئيسي...';

          /*
           * Send temporary processing message first.
           * This is intentionally NOT treated as the final answer.
           */

          const token =
            process.env.TELEGRAM_BOT_TOKEN;

          if (token) {
            await sendTelegramMessage(
              token,
              chatId,
              responseText
            );
          }

          const analysis =
            await callOfficialAnalyzer(
              request,
              requestedSymbol
            );

          responseText =
            buildAnalysisMessage(
              analysis
            );

          await logExecution(
            chatId,
            text,
            'success'
          );

          if (token) {
            await sendTelegramMessage(
              token,
              chatId,
              responseText
            );

            return NextResponse.json(
              {
                status: 'Success',
                analyzed: true,
                symbol: requestedSymbol,
              },
              {
                status: 200,
              }
            );
          }

          return NextResponse.json(
            {
              status: 'ok',
              delivered: false,
              analyzed: true,
              symbol: requestedSymbol,
              message: responseText,
            },
            {
              status: 200,
            }
          );
        } catch (analysisError) {
          console.error(
            'Official analyzer error:',
            analysisError
          );

          responseText =
            [
              `❌ تعذر تحليل ${requestedSymbol}.`,
              '',
              'لم يتم إنشاء قراءة بديلة حتى لا نعطيك رقماً غير موثوق.',
              '',
              'تحقق من اتصال محرك البيانات ثم أعد المحاولة.',
            ].join('\n');

          await logExecution(
            chatId,
            text,
            'error'
          );

          const token =
            process.env.TELEGRAM_BOT_TOKEN;

          if (token) {
            await sendTelegramMessage(
              token,
              chatId,
              responseText
            );

            return NextResponse.json(
              {
                status: 'AnalyzerError',
                analyzed: false,
              },
              {
                status: 200,
              }
            );
          }

          return NextResponse.json(
            {
              status: 'AnalyzerError',
              delivered: false,
              message: responseText,
            },
            {
              status: 503,
            }
          );
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | ALERTS
    |--------------------------------------------------------------------------
    */

    else if (command === '/alerts') {
      responseText =
        [
          '🔔 Trading Bot Pro Alerts',
          '',
          'حالة التنبيهات تعتمد على آخر فحص ناجح للرادار.',
          '',
          'لا يتم اختراع تنبيه أو قراءة إذا لم تتوفر بيانات حية مؤكدة.',
          '',
          'لفحص سهم مباشرة:',
          '/analyze SYMBOL',
        ].join('\n');
    }

    /*
    |--------------------------------------------------------------------------
    | UNKNOWN COMMAND
    |--------------------------------------------------------------------------
    */

    else if (text.startsWith('/')) {
      responseText =
        [
          '❓ أمر غير معروف.',
          '',
          'الأوامر المتاحة:',
          '',
          '/start',
          '/analyze SYMBOL',
          '/scan SYMBOL',
          '/alerts',
        ].join('\n');
    }

    /*
    |--------------------------------------------------------------------------
    | LOG
    |--------------------------------------------------------------------------
    */

    await logExecution(
      chatId,
      text,
      'success'
    );

    /*
    |--------------------------------------------------------------------------
    | TELEGRAM DELIVERY
    |--------------------------------------------------------------------------
    */

    const token =
      process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          status: 'ok',
          delivered: false,
          message: responseText,
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
        status: 'Success',
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'Trading Bot Pro V4 error:',
      error
    );

    return NextResponse.json(
      {
        error:
          'تعذر تنفيذ أمر البوت حالياً',
      },
      {
        status: 503,
      }
    );
  }
}
