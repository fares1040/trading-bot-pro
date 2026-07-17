import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = "https://api.massive.com/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  const BOT_TOKEN = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
  const CHAT_ID = "896028407";

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // إضافة حماية: هل البيانات موجودة؟
    if (!data || !data.tickers) {
      return NextResponse.json({ error: "لم يتم العثور على بيانات من المنصة (تأكد من الرابط)" }, { status: 404 });
    }

    const sendTelegram = async (msg) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`);
    };

    const results = await Promise.all(data.tickers.map(async (stock) => {
      // التأكد من وجود السعر قبل المعالجة
      const price = stock.min?.c || 0; 
      
      if (price <= 0.800 && price > 0) {
        await sendTelegram(`🚀 سنايبر (ترند): ${stock.ticker} بسعر ${price}`);
      }
      return { ticker: stock.ticker, price: price };
    }));

    return NextResponse.json({ status: "تم الفحص", results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
