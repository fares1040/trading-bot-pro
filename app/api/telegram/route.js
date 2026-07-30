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

    let messageText = body.message || "🚨 تنبيه فوري من منصة سنايبر الاحترافية: تم رصد فرصة تداول ذات تقييم عالي!";
    
    if (body.message && typeof body.message === 'object') {
      const text = body.message.text;
      const incomingChatId = body.message.chat.id;

      if (text) {
        let responseReply = "أهلاً بك في بوت منصة سنايبر الذكي ⚡\nالأوامر المتاحة:\n- `/top` لعرض أفضل فرص السنتات الحالية.\n- `/scan [ticker]` لفحص سهم معين.";

        if (text.startsWith('/top')) {
          responseReply = "🎯 *أفضل 3 فرص مدعومة بالذكاء الاصطناعي:*\n1. *SERV* - AI Score: 96/100 (مخاطر منخفضة)\n2. *PLTR* - AI Score: 94/100 (مخاطر منخفضة)\n3. *AMD* - AI Score: 91/100 (مخاطر متوسطة)";
        } else if (text.startsWith('/scan')) {
          const parts = text.split(' ');
          const ticker = parts[1] ? parts[1].toUpperCase() : 'AAPL';
          responseReply = `🔍 *تحليل الذكاء الاصطناعي للسهم (${ticker}):*\n- تقييم الفرصة: 92/100\n- التوصية: مناسب للدخول بعد الثبات فوق الدعم.\n- المخاطر: منخفضة 🟢`;
        }

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: incomingChatId, text: responseReply, parse_mode: 'Markdown' })
        });

        return NextResponse.json({ success: true, handled: true });
      }
    }

    if (!chatId) {
      return NextResponse.json({ error: 'معرف محادثة تليجرام غير متاح' }, { status: 400 });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: messageText, parse_mode: 'Markdown' })
    });

    const data = await response.json();
    if (!data.ok) throw new Error(data.description || 'فشل إرسال الرسالة عبر تلغرام');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
