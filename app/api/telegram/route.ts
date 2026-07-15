import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // التوكن الخاص بك
    const TELEGRAM_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ';
    
    // ضع مفتاح الـ API الخاص بـ Gemini هنا مكان النص التالي
    const GEMINI_KEY = 'AQ.Ab8RN6JzSJcweZqEDNULyEhLVY0aO2FR8AUVlnrI6DRmebrf-A'; 

    if (!body.message?.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const symbol = body.message.text;

    // إرسال رسالة "جاري التحليل" لتأكيد الاستلام
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🔍 جاري تحليل سهم ${symbol}، لحظات...` })
    });

    // الاتصال المباشر بـ Google Gemini
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `أنت خبير تداول. قم بتحليل السهم ${symbol} فنياً بشكل مختصر ومباشر واذكر اتجاهه ومستويات الدعم والمقاومة.` }] }]
      })
    });

    const geminiData = await geminiResponse.json();
    
    // استخراج التحليل أو إظهار رسالة خطأ في حال فشل الرد
    const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أتمكن من تحليل السهم حالياً. تأكد من صحة اسم السهم.";

    // إرسال النتيجة النهائية لتليجرام
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
