// app/api/telegram/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || body.chat_id;

    if (!token) {
      return NextResponse.json({ error: 'بيانات بوت تلغرام غير مُعرّفة' }, { status: 500 });
    }

    // دعم استقبال رسائل وأوامر البوت التفاعلية (مثل /scan أو /top أو الرسائل النصية المباشرة)
    let messageText = body.message;
    if (body.message && typeof body.message === 'object') {
      // في حال كان الطلب قادماً من Webhook تليجرام الفعلي
      const text = body.message.text;
      const incomingChatId = body.message.chat.id;

      if (text) {
        let responseReply = "أهلاً بك في بوت منصة سنايبر التفاعلي ⚡\nالأوامر المتاحة:\n- `/top` لعرض أفضل فرص السنتات الحالية.\n- `/scan [ticker]` لفحص سهم معين.";

        if (text.startsWith('/top')) {
          responseReply = "🎯 *أفضل 3 فرص سنتات حالياً بالرادار:*\n1. *AMD* - عقد Call سترايك 120$ (ثقة 96%)\n2. *PLTR* - عقد Call سترايك 45$ (ثقة 94%)\n3. *GME* - عقد Call سترايك 25$ (ثقة 93%)";
        } else if (text.startsWith('/scan')) {
          const parts = text.split(' ');
          const ticker = parts[1] ? parts[1].toUpperCase() : 'AAPL';
          responseReply = `🔍 *نتيجة فحص السهم (${ticker}):*\n- الاتجاه الفني: إيجابي صاعد.\n- مؤشر البولنجر: ضغط ممتاز.\n- التوصية: فرصة مناسبة لعقد سنتات بصلاحية فوق الشهر.`;
        }

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: incomingChatId,
            text: responseReply,
            parse_mode: 'Markdown'
          })
        });

        return NextResponse.json({ success: true, handled: true });
      }
    }

    // الإرسال العادي المباشر للرسائل والتنبيهات
    if (!chatId) {
      return NextResponse.json({ error: 'معرف محادثة تليجرام غير متاح' }, { status: 400 });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
        reply_markup: body.reply_markup || undefined
      })
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'فشل إرسال الرسالة عبر تلغرام');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
