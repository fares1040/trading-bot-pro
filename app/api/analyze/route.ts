import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ analysis: "خطأ: مفتاح API غير موجود." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً بشكل مختصر ومباشر.`);
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error) {
    return NextResponse.json({ analysis: "حدث خطأ أثناء الاتصال بـ Gemini." });
  }
}
