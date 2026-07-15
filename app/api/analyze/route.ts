import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    
    // وضع المفتاح مباشرة للتحقق
    const apiKey = "AQ.Ab8RN6JD4c1CBOxUs9QsCX2zJmdbPfucL_0hYZoLkPYJk6IAAw"; 

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(`حلل السهم ${symbol} فنياً بشكل مختصر.`);
    const response = await result.response;
    
    return NextResponse.json({ analysis: response.text() });
  } catch (error) {
    return NextResponse.json({ analysis: "خطأ تقني في الاتصال بـ Gemini." });
  }
}
