import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol } = body;
    
    // استدعاء المفتاح من إعدادات Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ analysis: "خطأ: مفتاح API غير مضبوط." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `حلل السهم ${symbol} فنياً بشكل مختصر ومباشر.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ analysis: "حدث خطأ في الاتصال بالذكاء الاصطناعي." }, { status: 500 });
  }
}
