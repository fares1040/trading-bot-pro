import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const TELEGRAM_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ';
    const GEMINI_KEY = 'AQ.Ab8RN6JzSJcweZqEDNULyEhLVY0aO2FR8AUVlnrI6DRmebrf-A'; // تأكد من وضع المفتاح الصحيح هنا

    if (!body.message?.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const symbol = body.message.text;

    // إرسال رسالة "جاري التحليل" أولاً
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `جاري تحليل سهم ${symbol}...` })
    });

    // محاولة التحليل
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`حلل السهم ${symbol} فنياً.`);
      const analysis = result.response.text();
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: analysis })
      });
    } catch (aiError) {
      // هذا الجزء يخبرك إذا كان المفتاح هو المشكلة
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "خطأ في الاتصال بالذكاء الاصطناعي (تأكد من مفتاح API)." })
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
