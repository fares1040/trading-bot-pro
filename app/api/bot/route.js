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
    
    // محاولة تسجيل العملية في قاعدة البيانات وفحص النتيجة
    const { error: dbError } = await supabase.from('execution_logs').insert([
      {
        task_name: 'telegram_bot_response',
        status: 'success',
        details: `ChatID: ${chatId} | Command: ${text}`
      }
    ]);

    let responseText = 'أهلاً بك في بوت منصة سناير 🚀';
    if (dbError) {
      responseText = `⚠️ خطأ في قاعدة البيانات: ${dbError.message}`;
    } else {
      responseText = `✅ تم الحفظ بنجاح في قاعدة البيانات!\nالرسالة: ${text}`;
    }

    return NextResponse.json({ status: 'Success', reply: responseText, chatId }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
