import { NextResponse } from 'next/server';

export async function GET() {
  // هذا الرابط يجلب "الأكثر صعوداً" (الترند) مع بيانات أسعارها الحالية
  const apiUrl = "https://api.massive.com/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  const BOT_TOKEN = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
  const CHAT_ID = "896028407";

  const TARGET_PRICE = 0.800; 
  const STOP_LOSS = 0.750;    

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    const sendTelegram = async (msg) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`);
    };

    // معالجة البيانات المدمجة
    const results = await Promise.all(data.tickers.map(async (stock) => {
      const price = stock.min.c; // السعر الحالي
      
      if (price <= TARGET_PRICE) {
        await sendTelegram(`🚀 سنايبر (ترند): ${stock.ticker} بسعر ${price} - فرصة دخول!`);
      } else if (price <= STOP_LOSS) {
        await sendTelegram(`⚠️ تنبيه (انعكاس): ${stock.ticker} وصل لمستوى ${price}`);
      }
      return { ticker: stock.ticker, price: price };
    }));

    return NextResponse.json({ status: "تم فحص الترند بنجاح", results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
