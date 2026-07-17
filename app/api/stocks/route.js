import { NextResponse } from 'next/server';

export async function GET() {
  // سنستخدم مسار التيكرز الأساسي والمستقر للغاية للتأكد من جلب البيانات
  const apiUrl = "https://api.massive.com/v3/reference/tickers?market=stocks&active=true&order=asc&limit=10&sort=ticker&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  const BOT_TOKEN = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
  const CHAT_ID = "896028407";

  // قيم المراقبة الخاصة بك
  const TARGET_PRICE = 0.800; 
  const STOP_LOSS = 0.750;    

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // إذا واجهنا مشكلة في استلام البيانات من المنصة سنعرض رد المنصة الأصلي لنعرف الخلل فوراً
    if (!data || (!data.results && !data.tickers)) {
      return NextResponse.json({ 
        error: "رد غير متوقع من المنصة", 
        rawResponse: data 
      }, { status: 404 });
    }

    // استخراج القائمة سواء كانت تحت مسمى results أو tickers
    const stocksList = data.results || data.tickers || [];

    const sendTelegram = async (msg) => {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`);
    };

    const results = await Promise.all(stocksList.map(async (stock) => {
      // جلب السعر؛ وإذا لم يتوفر سعر مباشر نضع قيمة افتراضية للمراقبة (مثل 0.800 لتجربة البوت)
      // ملاحظة: المسارات المجانية قد لا تعطي سعراً لحظياً دائماً
      const price = stock.min?.c || stock.price || 0.800; 
      
      if (price <= TARGET_PRICE && price > 0) {
        await sendTelegram(`🚀 سنايبر: ${stock.ticker} بسعر ${price} - فرصة دخول!`);
      } else if (price <= STOP_LOSS && price > 0) {
        await sendTelegram(`⚠️ تنبيه: ${stock.ticker} كسر مستوى الانعكاس عند ${price}`);
      }
      return { ticker: stock.ticker, price: price };
    }));

    return NextResponse.json({ status: "تم الفحص بنجاح", total: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
