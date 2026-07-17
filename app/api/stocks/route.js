import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = "https://api.massive.com/v3/reference/tickers?market=stocks&active=true&order=asc&limit=10&sort=ticker&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  const BOT_TOKEN = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
  const CHAT_ID = "896028407";

  const TARGET_PRICE = 0.800; 
  const STOP_LOSS = 0.750;    

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (!data || !data.results) {
      return NextResponse.json({ error: "لا توجد بيانات جديدة حالياً" }, { status: 404 });
    }

    const sendTelegram = async (msg) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`);
    };

    const results = await Promise.all(data.results.map(async (stock) => {
      // هنا نقرأ السعر الحقيقي فقط إذا أرسلته المنصة في البيانات، وبدون قيم افتراضية عشوائية تسبب إزعاجاً
      const price = stock.price || (stock.min && stock.min.c) || 0; 
      
      // التنبيه يرسل فقط وفقط إذا كان هناك سعر حقيقي ومطابق للشروط
      if (price > 0 && price <= TARGET_PRICE) {
        await sendTelegram(`🚀 سنايبر: ${stock.ticker} بسعر حقيقي ${price} - فرصة دخول!`);
      } else if (price > 0 && price <= STOP_LOSS) {
        await sendTelegram(`⚠️ تنبيه: ${stock.ticker} كسر مستوى الانعكاس عند ${price}`);
      }
      return { ticker: stock.ticker, price: price };
    }));

    return NextResponse.json({ status: "النظام شغال ويراقب بصمت", total: results.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
