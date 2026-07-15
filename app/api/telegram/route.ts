import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // التوكن الخاص بك
    const TELEGRAM_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ';
    
    // تأكد من وضع مفتاحك هنا
    const GEMINI_KEY = 'AQ.Ab8RN6JzSJcweZqEDNULyEhLVY0aO2FR8AUVlnrI6DRmebrf-A'; 

    if (!body.message?.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const symbol = body.message.text;

    // إرسال رسالة تأكيد
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🔍 جاري تحليل السهم: ${symbol}...` })
    });

    // الاتصال المباشر بـ Google Gemini بتعليمات واضحة
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `أنت محلل مالي خبير. قم بتحليل سهم السوق المالي "${symbol}" بشكل مختصر. اذكر الاتجاه العام (صاعد/هابط)، ومستويات الدعم والمقاومة التقريبية. إذا لم تكن لديك بيانات كافية عن السهم، اطلب من المستخدم التأكد من الرمز.` 
          }] 
        }]
      })
    });

    const geminiData = await geminiResponse.json();
    
    // استخراج التحليل
    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتمكن الذكاء الاصطناعي من استخراج تحليل لهذا الرمز.";

    // إرسال النتيجة
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: analysis })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
