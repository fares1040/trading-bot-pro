import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const TELEGRAM_TOKEN = 'AQ.Ab8RN6JLde2vZQVpIO1oKRAjmc0Sbbg-39woXZKWIBAjeFH7TQ';
    const GEMINI_KEY = 'AQ.Ab8RN6JzSJcweZqEDNULyEhLVY0aO2FR8AUVlnrI6DRmebrf-A';

    if (!body.message?.text) return NextResponse.json({ ok: true });
    const chatId = body.message.chat.id;

    // إذا أرسل المستخدم كلمة "ترند" أو "سوق"
    if (body.message.text.toLowerCase().includes('ترند') || body.message.text.toLowerCase().includes('سوق')) {
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "🚀 جاري فحص السوق والأسهم الأكثر نشاطاً حالياً..." })
      });

      // إرسال طلب ذكي لـ Gemini لفحص الترند الحالي
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `أعطني قائمة بأبرز 3 أسهم ترند في السوق الأمريكي اليوم (أعلى تداول/نشاط). حلل كل سهم باختصار: هل هو في اتجاه صاعد؟ وهل يتوافق مع شروط المضاربة اليومية (سيولة عالية وتذبذب)؟` 
            }] 
          }]
        })
      });

      const geminiData = await geminiResponse.json();
      const report = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: report })
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
