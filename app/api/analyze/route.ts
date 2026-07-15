import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    const apiKey = "ضع_مفتاحك_هنا"; // مفتاحك من Google AI Studio

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `حلل السهم ${symbol} فنياً بشكل مختصر جداً ومباشر.`;
    const result = await model.generateContent(prompt);
    
    return NextResponse.json({ analysis: result.response.text() });
  } catch (error) {
    return NextResponse.json({ analysis: "حدث خطأ في الاتصال بالذكاء الاصطناعي." });
  }
}
