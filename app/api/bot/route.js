import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const message = body.message || body.edited_message;
    
    if (!message || !message.text) {
      return NextResponse.json({ status: 'No message found' }, { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    
    // تحديد رد البوت حسب الأمر
    let responseText = 'أهلاً بك في بوت منصة سناير 🚀، استخدم الأوامر: /analyze أو /alerts';
    if (text.startsWith('/analyze')) {
      responseText = '📈 التحليل الفوري: الاتجاه العام صاعد ومناسب للمضاربة.';
    } else if (text === '/alerts') {
      responseText = '🔔 التنبيهات الحالية: السوق مستقر وجاري مراقبة الفرص.';
    } else if (text === '/start') {
      responseText = '👋 أهلاً بك! تم ربط بوت منصة سناير بنجاح وجاهز لخدمتك.';
    }

    // تسجيل العملية في قاعدة البيانات
    await supabase.from('execution_logs').insert([
      {
        task_name: 'telegram_bot_response',
        status: 'success',
        details: `ChatID: ${chatId} | Command: ${text}`
      }
    ]);

    // إرسال الرد فعلياً إلى تيليجرام
    const token = process.env.TELEGRAM_BOT_TOKEN;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText
      })
    });

    return NextResponse.json({ status: 'Success' }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
