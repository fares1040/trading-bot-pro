import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getWebhookUrl() {
  return process.env.DISCORD_WEBHOOK_URL || '';
}

function sanitizeMessage(message) {
  const text = String(message || '').trim();

  if (!text) {
    return '🚨 تنبيه جديد من HUNTER AI V4';
  }

  // حماية بسيطة من رسائل ضخمة أو غير صالحة
  return text.slice(0, 1900);
}

export async function POST(request) {
  try {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            'DISCORD_WEBHOOK_URL غير موجود في ملف البيئة',
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const message =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.content === 'string'
          ? body.content
          : '';

    const content = sanitizeMessage(message);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'HUNTER AI V4',
        content,
        allowed_mentions: {
          parse: [],
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');

      console.error(
        'Discord webhook error:',
        response.status,
        errorText
      );

      throw new Error(
        `Discord webhook failed: ${response.status}`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال التنبيه إلى Discord بنجاح',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      'Discord route error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'تعذر إرسال التنبيه إلى Discord حالياً',
      },
      { status: 503 }
    );
  }
}

/*
 * فحص حالة الاتصال بدون إرسال رسالة
 */
export async function GET() {
  const configured =
    Boolean(
      process.env.DISCORD_WEBHOOK_URL
    );

  return NextResponse.json({
    success: true,
    service: 'discord',
    configured,
    status: configured
      ? 'ready'
      : 'not_configured',
    timestamp: new Date().toISOString(),
  });
}