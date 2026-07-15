import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ضع مفتاحك هنا مباشرة لتجاوز مشاكل الإعدادات
    const GEMINI_KEY = 'AQ.Ab8RN6JD4c1CBOxUs9QsCX2zJmdbPfucL_0hYZoLkPYJk6IAAw'; 
    const TELEGRAM_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ'; 
    
    if (!body.message?.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const symbol = body.message.text;

    // 1. الاتصال بـ Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`حلل السهم ${symbol} فنياً بشكل مختصر ومباشر.`);
    const analysis = result.response.text();

    // 2. إرسال النتيجة لتليجرام
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: analysis 
      })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
