import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    // التحقق من أن الرسالة موجودة
    if (!body.message?.text || !token) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const text = "البوت يعمل بنجاح! جاري تطوير التحليل.";

    // إرسال رد فوري للتأكد من أن الكود يعمل
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true }); // لتجنب إعادة الإرسال المتكرر من تليجرام
  }
}
