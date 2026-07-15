import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    
    // سنضع المفتاح هنا مباشرة داخل الكود لنتجاوز مشاكل إعدادات Vercel
    const apiKey = "AQ.Ab8RN6JnK3naalqjqEwfrfcAdN-dzFxWyCHBAOpuIOXernDLng";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `حلل السهم ${symbol} فنياً بشكل مختصر.`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error: any) {
    return NextResponse.json({ analysis: "حدث خطأ أثناء الاتصال بـ Gemini." });
  }
}
