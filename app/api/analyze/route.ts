import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    
    // سحب المفتاح من إعدادات Vercel مباشرة
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ analysis: "خطأ: مفتاح API غير موجود في إعدادات Vercel" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً بشكل مختصر ومباشر.`);
    const response = await result.response;
    
    return NextResponse.json({ analysis: response.text() });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ analysis: "حدث خطأ أثناء الاتصال بـ Gemini." }, { status: 500 });
  }
}
