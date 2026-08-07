import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// تهيئة Supabase للاتصال بقاعدة البيانات
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
    
    let responseText = 'أهلاً بك في بوت منصة سناير 🚀، استخدم الأوامر التالية: /analyze أو /alerts';

    if (text.startsWith('/analyze')) {
      const parts = text.split(' ');
      const ticker = parts[1] ? parts[1].toUpperCase() : 'SOFI';
      responseText = `التحليل الفوري للسهم ${ticker} 📈\n\nالاتجاه العام: صاعد بقوة 🚀\nمناطق الدعم: مناسبة للشراء المضاربي 💸`;
    } else if (text === '/alerts') {
      responseText = '🔔 تنبيهات الأسهم الحالية:\n1. SOFI تجاوز 22.00$\n2. PLTR عند 80.50$';
    }

    // تسجيل العملية في قاعدة البيانات (المراقب الذكي)
    await supabase.from('execution_logs').insert([
      {
        task_name: 'telegram_bot_response',
        status: 'success',
        details: `ChatID: ${chatId} | Command: ${text}`
      }
    ]);

    return NextResponse.json({ status: 'Success', reply: responseText, chatId }, { status: 200 });
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    // تسجيل الخطأ في القاعدة أيضاً
    await supabase.from('execution_logs').insert([
      {
        task_name: 'telegram_bot_error',
        status: 'error',
        details: error.message
      }
    ]);

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
