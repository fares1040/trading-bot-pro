import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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

const radarConfigs = {
  cents: {
    tickers: ['SERV', 'NVDA', 'TSLA', 'PLTR', 'AMD', 'SOFI'],
    title: 'رادار مركز القيادة الذكي للفرص',
    promptIntro: 'You are an elite quantitative trading AI copilot. Analyze the following real-time stock data for an advanced breakout scanner.',
    schemaExample: `[
          {
            "ticker": "SYMBOL",
            "aiScore": 94,
            "momentum": 85,
            "volumeMultiplier": "x3.2",
            "riskLevel": "منخفض",
            "directionProbability": "⬆️ صعود 78%",
            "recommendation": "الدخول بعد الاختراق المؤكد",
            "signal": "اختراق حاد للمقاومة مع تدفق سيولة"
          }
        ]`
  },
  darkpool_under_100: {
    tickers: ['NVDA', 'AMD', 'SOFI', 'PLTR', 'INTC', 'MARA', 'RIOT', 'CLSK', 'GME', 'AMC', 'HOOD', 'NIO', 'LCID', 'RIVN', 'SNDL', 'TLRY'],
    title: 'رادار السيولة المؤسسية (Dark Pool) — أسهم تحت 100$',
    promptIntro: 'You are an elite institutional flow analyst. Analyze the following real-time stock data to detect potential dark pool accumulation and institutional interest signals.',
    schemaExample: `[
          {
            "ticker": "SYMBOL",
            "aiScore": 90,
            "momentum": 82,
            "volumeMultiplier": "x2.8",
            "riskLevel": "متوسط",
            "directionProbability": "⬆️ صعود 75% / ⬇️ هبوط 25%",
            "recommendation": "مراقبة تدفق السيولة المؤسسية قبل الدخول",
            "signal": "حجم غير معتاد يشير لتجميع مؤسسي محتمل"
          }
        ]`
  },
  gaps: {
    tickers: ['NVDA', 'AMD', 'TSLA', 'SOFI', 'PLTR', 'HOOD', 'MARA', 'RIOT', 'GME', 'AMC', 'NIO', 'LCID', 'RIVN', 'SNAP', 'INTC'],
    title: 'رادار الفجوات السعرية (Gaps) — فرص الصباح',
    promptIntro: 'You are an expert gap-trading analyst. Analyze the following real-time stock data to identify significant price gaps (opening gaps vs previous close) and assess fill/continuation probability.',
    schemaExample: `[
          {
            "ticker": "SYMBOL",
            "aiScore": 88,
            "momentum": 80,
            "gapPercent": "+3.5%",
            "riskLevel": "متوسط",
            "directionProbability": "⬆️ صعود 70% / ⬇️ هبوط 30%",
            "recommendation": "الدخول عند استقرار السعر فوق فجوة الصباح",
            "signal": "فجوة صعودية مع حجم تداول مرتفع"
          }
        ]`
  },
  reversal: {
    tickers: ['NVDA', 'AMD', 'TSLA', 'SOFI', 'PLTR', 'INTC', 'SNAP', 'HOOD', 'NIO', 'LCID', 'RIVN', 'GME', 'AMC', 'MARA', 'RIOT'],
    title: 'رادار الانعكاسات (Reversals) — فرص الارتداد',
    promptIntro: 'You are an expert reversal-pattern analyst. Analyze the following real-time stock data to detect potential reversal setups (oversold bounces, overbought fades, divergence signals).',
    schemaExample: `[
          {
            "ticker": "SYMBOL",
            "aiScore": 86,
            "momentum": 78,
            "riskLevel": "منخفض",
            "directionProbability": "⬆️ صعود 68% / ⬇️ هبوط 32%",
            "recommendation": "انتظر تأكيد شمعة الانعكاس قبل الدخول",
            "signal": "تشبع بيعي مع ارتداد من الدعم"
          }
        ]`
  }
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, mode } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY in environment variables." }, { status: 500 });
    }

    const radarConfig = radarConfigs[mode];

    // ─── 1. جميع أوضاع الرادار (cents, darkpool, gaps, reversal) ───
    if (radarConfig) {
      const stocksMarketData = [];

      const marketDataResults = await Promise.all(
        radarConfig.tickers.map(t => fetchLiveStockData(t).then(data => ({ ticker: t, data })))
      );

      for (const { ticker, data } of marketDataResults) {
        if (data.price) {
          stocksMarketData.push({
            ticker,
            price: data.price.toFixed(2),
            changePercent: data.changePercent.toFixed(2),
            volume: data.volume
          });
        }
      }

      if (stocksMarketData.length === 0) {
        return NextResponse.json({ error: 'لم يتم جلب أي بيانات حية للأسهم' }, { status: 400 });
      }

      const radarPrompt = `
        ${radarConfig.promptIntro}
        ${JSON.stringify(stocksMarketData)}

        For each stock, calculate sophisticated metrics:
        1. aiScore: (integer between 65 and 99, overall rating)
        2. momentum: (integer between 60 and 100)
        3. volumeMultiplier: (string like "x3.5")
        4. riskLevel: (String in Arabic: "منخفض" or "متوسط" or "مرتفع")
        5. directionProbability: (String e.g. "⬆️ صعود 78% / ⬇️ هبوط 22%")
        6. recommendation: (A precise professional Arabic action phrase e.g. "مناسب للدخول إذا أغلق فوق المستوى مع حجم تداول عالي")
        7. signal: (Brief professional Arabic technical insight)

        Return response STRICTLY as a JSON array:
        ${radarConfig.schemaExample}
      `;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: radarPrompt,
        config: { responseMimeType: 'application/json' }
      });

      const aiEvaluations = JSON.parse(aiResponse.text);

      const radarItems = stocksMarketData.map(stock => {
        const aiEval = aiEvaluations.find(e => e.ticker === stock.ticker) || {};
        return {
          ticker: stock.ticker,
          price: stock.price,
          change_percent: stock.changePercent,
          aiScore: aiEval.aiScore || 88,
          momentum: aiEval.momentum || 80,
          volumeMultiplier: aiEval.volumeMultiplier || 'x2.0',
          gapPercent: aiEval.gapPercent || `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%`,
          riskLevel: aiEval.riskLevel || 'متوسط',
          directionProbability: aiEval.directionProbability || '⬆️ صعود 70%',
          recommendation: aiEval.recommendation || 'راقب مستوى الدعم الحالي',
          signal: aiEval.signal || 'تحليل فني مستمر للسيولة اللحظية'
        };
      });

      return NextResponse.json({
        type: 'cent_options',
        title: radarConfig.title,
        items: radarItems
      });
    }

    // ─── 2. الفحص الفردي المعمق ───
    const upperSym = (symbol || 'SPY').toUpperCase().trim();
    const data = await fetchLiveStockData(upperSym);

    if (!data.price) {
      return NextResponse.json({ error: 'عذراً، لم نتمكن من جلب بيانات السهم' }, { status: 400 });
    }

    const changePercent = data.changePercent.toFixed(2);

    const singlePrompt = `
      You are an expert market analyst. Analyze the live stock data for ${upperSym}:
      Current Price: $${data.price.toFixed(2)}
      Daily Change: ${changePercent}%
      Volume: ${data.volume.toLocaleString()}

      Provide advanced institutional analysis in JSON schema:
      {
        "aiScore": 95,
        "momentum": 92,
        "volumeScore": 88,
        "riskLevel": "منخفض",
        "directionProbability": "⬆️ صعود 76%",
        "recommendation": "الدخول المباشر عند ارتداد الدعم",
        "analysis": "تحليل فني احترافي متقدم باللغة العربية"
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
      aiScore: singleEval.aiScore || 85,
      momentum: singleEval.momentum || 80,
      riskLevel: singleEval.riskLevel || 'متوسط',
      directionProbability: singleEval.directionProbability || '⬆️ صعود 70%',
      recommendation: singleEval.recommendation || 'راقب السهم بحذر',
      analysis: singleEval.analysis || `تحليل تقني آلي للسهم ${upperSym}.`
    });

  } catch (error) {
    console.error("AI Analysis route error:", error);
    return NextResponse.json({ error: 'خطأ في معالجة وتحليل البيانات' }, { status: 500 });
  }
}
