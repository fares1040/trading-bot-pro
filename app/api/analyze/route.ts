import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ analysis: "تنبيه: مفتاح API Key مفقود في إعدادات Vercel. يرجى إضافته." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `حلل السهم ${symbol} فنياً بشكل مختصر جداً.`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error: any) {
    return NextResponse.json({ analysis: "خطأ تقني: " + error.message });
  }
}
