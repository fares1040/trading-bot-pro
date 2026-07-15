import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // التحقق من أن الرسالة نصية
    if (!body.message?.text) return NextResponse.json({ ok: true });

    const symbol = body.message.text;
    const apiKey = process.env.GEMINI_API_KEY;

    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً.`);
    const analysis = result.response.text();

    // إرجاع النتيجة بتنسيق التليجرام
    return NextResponse.json({
      method: "sendMessage",
      chat_id: body.message.chat.id,
      text: analysis
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
