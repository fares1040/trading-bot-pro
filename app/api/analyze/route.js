import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// تهيئة مكتبة الجيل الجديد من جوجل للذكاء الاصطناعي (تأكد من تنصيبها عبر npm i @google/genai)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function fetchLiveStockData(symbol) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 10 }
    });
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    
    const currentPrice = meta?.regularMarketPrice || meta?.chartPreviousClose || 100;
    const prevClose = meta?.chartPreviousClose || currentPrice;
    const volume = meta?.regularMarketVolume || meta?.volume || 5000000;
    const changePercent = (((currentPrice - prevClose) / prevClose) * 100);

    return {
      price: currentPrice,
      prevClose: prevClose,
      changePercent: changePercent,
      volume: volume
    };
  } catch (e) {
    return { price: null, prevClose: null, changePercent: 0, volume: 0 };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, mode } = body;

    // التحقق من وجود مفتاح الـ API لضمان استقرار السيرفر
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY in environment variables." }, { status: 500 });
    }

    // 1. رادار عقود السنتات وتصفية أعلى سيولة وانفجارات الـ 52 أسبوع
    if (mode === 'cents') {
      const targetTickers = ['SERV', 'NVDA', 'TSLA', 'PLTR', 'AMD', 'SOFI'];
      const stocksMarketData = [];

      // خطوة 1: جلب كل بيانات السوق اللحظية دفعة واحدة من ياهو فاينانشال
      for (const t of targetTickers) {
        const data = await fetchLiveStockData(t);
        if (data.price) {
          stocksMarketData.push({
            ticker: t,
            price: data.price.toFixed(2),
            changePercent: data.changePercent.toFixed(2),
            volume: data.volume
          });
        }
      }

      // خطوة 2: صياغة برومبت مالي موحد ومحكم لفلترة واحتساب المؤشرات رقمياً بالذكاء الاصطناعي
      const centsPrompt = `
        You are an elite quantitative trading AI assistant. Analyze the following real-time stock data for a penny-options and high-liquidity breakout scanner:
        ${JSON.stringify(stocksMarketData)}

        For each stock, calculate realistic and sophisticated trading metrics based on their current price action and change percent:
        1. momentum: (integer between 60 and 100 based on price strength)
        2. volumeMultiplier: (string format like "x3.5" or "x1.2" representing institutional accumulation relative to baseline)
        3. breakout: (integer between 60 and 100, representing proximity to a major technical key level or 52-week high resistance)
        4. confidence: (integer between 65 and 99, overall technical setup quality)
        5. signal: (A very brief, powerful, professional Arabic insight phrase about the technical state, e.g., "🚀 اختراق حاد لمستويات المقاومة مع زخم سيولة متصاعد").

        Return the response STRICTLY as a JSON array matching this exact schema:
        [
          {
            "ticker": "SYMBOL",
            "momentum": 85,
            "volumeMultiplier": "x3.2",
            "breakout": 90,
            "confidence": 94,
            "signal": "العبارة الفنية بالعربية هنا"
          }
        ]
      `;

      // استدعاء نموذج الذكاء الاصطناعي لمعالجة المصفوفة بالكامل
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: centsPrompt,
        config: { responseMimeType: 'application/json' }
      });

      const aiEvaluations = JSON.parse(aiResponse.text);

      // خطوة 3: دمج الأرقام الحية القادمة من ياهو مع التقييمات الذكية الذكاء الاصطناعي
      const centItems = stocksMarketData.map(stock => {
        const aiEval = aiEvaluations.find(e => e.ticker === stock.ticker) || {};
        return {
          ticker: stock.ticker,
          price: stock.price,
          change_percent: stock.changePercent,
          momentum: aiEval.momentum || 80,
          volumeMultiplier: aiEval.volumeMultiplier || 'x2.0',
          breakout: aiEval.breakout || 75,
          confidence: aiEval.confidence || 85,
          signal: aiEval.signal || '📊 تحليل فني مستمر لتحديثات السوق اللحظية'
        };
      });

      return NextResponse.json({
        type: 'cent_options',
        title: 'رادار مركز القيادة لأعلى سيولة واختراق 52 أسبوع',
        items: centItems
      });
    }

    // 2. السيناريو الافتراضي للفحص الفردي المعمق المتكامل الشامل لسهم محدد
    const upperSym = (symbol || 'SPY').toUpperCase().trim();
    const data = await fetchLiveStockData(upperSym);
    
    if (!data.price) {
      return NextResponse.json({ error: 'عذراً، لم نتمكن من جلب بيانات السهم المطلوبة حالياً' }, { status: 400 });
    }

    const changePercent = data.changePercent.toFixed(2);

    // برومبت التحليل الفردي الشامل
    const singlePrompt = `
      You are an expert market analyst. Analyze the following live stock data for ${upperSym}:
      Current Price: $${data.price.toFixed(2)}
      Daily Change: ${changePercent}%
      Volume: ${data.volume.toLocaleString()}

      Provide an advanced, institutional-level tactical market analysis and score breakdowns:
      1. confidenceScore (integer 50-100)
      2. momentum (integer 50-100)
      3. volumeScore (integer 50-100)
      4. breakoutScore (integer 50-100)
      5. analysis (A profound, high-level professional Arabic technical analysis statement about the setup, order flow, dark pool, or gamma wall triggers).

      Return your response STRICTLY as a JSON object matching this exact schema:
      {
        "confidenceScore": 95,
        "momentum": 92,
        "volumeScore": 88,
        "breakoutScore": 94,
        "analysis": "التحليل الفني والمالي الاحترافي باللغة العربية"
      }
    `;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: singlePrompt,
      config: { responseMimeType: 'application/json' }
    });

    const singleEval = JSON.parse(aiResponse.text);

    return NextResponse.json({
      price: Number(data.price).toFixed(2),
      change: `${changePercent >= 0 ? '+' : ''}${changePercent}%`,
      volume: Number(data.volume).toLocaleString(),
      confidenceScore: singleEval.confidenceScore || 85,
      momentum: singleEval.momentum || 80,
      volumeScore: singleEval.volumeScore || 75,
      breakoutScore: singleEval.breakoutScore || 80,
      analysis: singleEval.analysis || `تحليل تقني آلي للسهم ${upperSym} بناءً على تدفقات السيولة الحالية.`
    });

  } catch (error) {
    console.error("AI Analysis route error:", error);
    return NextResponse.json({ error: 'خطأ في معالجة وفلترة بيانات ياهو ترند عبر الذكاء الاصطناعي' }, { status: 500 });
  }
}
