import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { symbol } = await req.json();
    const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. جلب السعر الحقيقي
    const priceRes = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaKey}`);
    const priceData = await priceRes.json();
    const price = priceData['Global Quote'] ? priceData['Global Quote']['05. price'] : "N/A";

    // 2. إرسال السعر لـ Gemini ليقوم بتحليله
    const genAI = new GoogleGenerativeAI(geminiKey!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`السهم ${symbol} سعره الآن هو ${price}. قم بتحليله فنياً بشكل مختصر.`);
    
    return NextResponse.json({ 
      analysis: result.response.text(),
      price: price 
    });
  } catch (error) {
    return NextResponse.json({ analysis: "حدث خطأ في جلب البيانات." });
  }
}
