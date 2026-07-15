import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  const body = await req.json();
  const token = process.env.TELEGRAM_BOT_TOKEN; // سحب التوكن من Vercel
  
  if (!body.message?.text || !token) return NextResponse.json({ ok: true });

  const symbol = body.message.text;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(`حلل السهم ${symbol} فنياً.`);
  const analysis = result.response.text();

  // إرسال الرد لتليجرام
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: body.message.chat.id,
      text: analysis
    })
  });

  return NextResponse.json({ ok: true });
}
