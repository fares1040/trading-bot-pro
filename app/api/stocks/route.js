// app/api/stocks/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const type = searchParams.get('type') || 'active'; // لدعم أنواع القوائم المختلفة (ترند، سيولة، إلخ)

    const apiKey = process.env.MASSIVE_SECRET_KEY;
    
    // استخدام بديل آمن أو رابط ياهو/مزود معتمد في حال عدم توفر مفتاح خارجي
    let apiUrl = '';
    if (symbol) {
      apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=1d`;
    } else {
      // جلب قائمة افتراضية في حال عدم تحديد رمز
      apiUrl = `https://query1.finance.yahoo.com/v1/finance/trending/US?count=10`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error('فشل جلب البيانات من المزود المعتمد');
    }

    const data = await response.json();
    
    // استخراج الرموز أو النتائج بناءً على الهيكل المستلم
    let results = [];
    if (symbol) {
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        results = [{
          symbol: symbol.toUpperCase(),
          price: meta.regularMarketPrice || meta.chartPreviousClose || 0,
          currency: meta.currency || 'USD'
        }];
      }
    } else {
      // استخراج الأسهم الشائعة/الترند
      const quotes = data?.finance?.result?.[0]?.quotes || [];
      results = quotes.map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice || 0
      })).filter(item => item.price <= 100 && item.price > 0); // تطبيق شرط السعر 100 دولار وتحت
    }

    return NextResponse.json({ 
      status: "نجاح", 
      count: results.length,
      data: results.length > 0 ? results : ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN'] 
    });

  } catch (error) {
    console.error('Stocks API Error:', error.message);
    // إرجاع قائمة احتياطية آمنة لضمان عمل الواجهة دون توقف
    return NextResponse.json({ 
      status: "بديل طارئ", 
      data: ['VMAR', 'CETX', 'GSIT', 'PRFX', 'BYRN', 'KULR'] 
    }, { status: 200 });
  }
}
