import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    
    // ضع مفتاحك هنا بين علامات التنصيص
    const apiKey = "AQ.Ab8RN6Jnk3naalqjqEwfrfcAdN-dzFxWyCHBAOpuIOXerndLNg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً بشكل مختصر.`);
    
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error) {
    return NextResponse.json({ analysis: "حدث خطأ في الاتصال بالذكاء الاصطناعي." });
  }
}
