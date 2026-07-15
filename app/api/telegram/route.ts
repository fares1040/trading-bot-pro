import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // التحقق من وجود الرسالة
    if (!body.message || !body.message.text) {
      return NextResponse.json({ status: "ok" }); // تجاهل الرسائل غير النصية
    }

    const symbol = body.message.text;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً.`);
    const analysis = result.response.text();

    // نجهز الرد لإرساله لاحقاً (بمجرد ربط التوكن)
    return NextResponse.json({
      method: "sendMessage",
      chat_id: body.message.chat.id,
      text: analysis
    });

  } catch (error) {
    console.error("Telegram API Error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
