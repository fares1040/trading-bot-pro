import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    
    // سحب المفتاح من المتغيرات في Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ analysis: "يرجى إضافة مفتاح GEMINI_API_KEY في إعدادات Vercel." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `حلل السهم ${symbol} فنياً بشكل مختصر.`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error: any) {
    return NextResponse.json({ analysis: "خطأ في الاتصال بالمحلل." });
  }
}
