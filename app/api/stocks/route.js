import { NextResponse } from 'next/server';

export async function GET() {
  // هذا الرابط هو الأساس الذي عمل معك في البداية (يعطي قائمة أسهم)
  const apiUrl = "https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,MSFT,TSLA,AMD,NVDA&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // إذا لم تأتِ بيانات التيكرز، سنعرف السبب فوراً
    if (!data.tickers) {
      return NextResponse.json({ error: "البيانات فارغة، جرب تحديث الرابط" }, { status: 404 });
    }

    // هنا نقوم بفلترة الأسهم
    const results = data.tickers.map(stock => {
      const price = stock.min?.c || 0;
      return { ticker: stock.ticker, price: price, status: price <= 0.800 ? "فرصة!" : "مراقبة" };
    });

    return NextResponse.json({ message: "تم الربط بنجاح", results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
