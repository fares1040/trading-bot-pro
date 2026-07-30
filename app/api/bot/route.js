// app/api/bot/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // التحقق من رسالة تيليجرام الواردة
    const message = body.message || body.edited_message;
    if (!message || !message.text) {
      return NextResponse.json({ status: 'No message found' }, { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    let responseText = '🤖 أهلاً بك في بوت منصة النخبة الاستخباراتية.\nاستخدم الأوامر التالية:\n- /analyze [السهم] (لتحليل السهم فوريًا)\n- /alerts (لعرض التنبيهات النشطة)';

    if (text.startsWith('/analyze')) {
      const parts = text.split(' ');
      const ticker = parts[1] ? parts[1].toUpperCase() : 'SOFI';
      responseText = `📊 **التحليل الفوري للسهم: ${ticker}**\n\n- الاتجاه العام: صاعد بقوة 🚀\n- مناطق الدعم: مناسبة للشراء المضاربي\n- الهدف المقترح: +5% من سعر الدخول\n- الحالة: مراقبة السيولة المؤسسية نشطة.`;
    } else if (text === '/alerts') {
      responseText = `🔔 **تنبيهاتك النشطة حالياً:**\n1. SOFI عند تجاوز $22.00\n2. PLTR عند ارتداد الدعم $80.50`;
    }

    // هنا يمكنك لاحقاً ربط Token بوت تيليجرام الفعلي لإرسال الرد عبر Telegram API
    // const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    // await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { ... });

    return NextResponse.json({ status: 'Success', reply: responseText, chatId }, { status: 200 });
  } catch (error) {
    console.error('خطأ في معالجة طلب البوت:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
