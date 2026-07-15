import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // التأكد من أن هناك نص مرسل
    if (!body.message?.text) return NextResponse.json({ ok: true });

    const symbol = body.message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!token || !apiKey) {
      console.error("Missing ENV variables");
      return NextResponse.json({ ok: true });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // البرومبت المصمم للصيد (تحليل سريع ومباشر)
    const prompt = `أنت خبير تداول. قم بتحليل السهم ${symbol} فنياً بشكل مختصر. هل السهم في وضع انفجاري أم لا؟ أذكر مستويات الدعم والمقاومة الحالية.`;
    
    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    // إرسال التحليل لتليجرام
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: body.message.chat.id,
        text: analysis,
        parse_mode: "Markdown"
      })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Bot Error:", error);
    return NextResponse.json({ ok: true });
  }
}
