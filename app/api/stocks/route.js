import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = "https://api.massive.com/v3/reference/tickers?market=stocks&active=true&order=asc&limit=100&sort=ticker&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";
  
  // بيانات البوت
  const BOT_TOKEN = "8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA";
  const CHAT_ID = "896028407";

  const TARGET_PRICE = 0.800;
  const STOP_LOSS = 0.750;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // دالة إرسال رسالة تيليجرام
    const sendTelegramMessage = async (message) => {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`;
      await fetch(url);
    };

    const alerts = await Promise.all(data.results.map(async (stock) => {
      const currentPrice = 0.810; // سعر تجريبي
      
      let status = "مراقبة";
      if (currentPrice <= TARGET_PRICE) {
        status = "فرصة دخول!";
        await sendTelegramMessage(`🚀 سنايبر: ${stock.ticker} بسعر ${currentPrice} - فرصة دخول!`);
      } else if (currentPrice <= STOP_LOSS) {
        status = "تنبيه: تم كسر مستوى الانعكاس!";
        await sendTelegramMessage(`⚠️ تنبيه: ${stock.ticker} وصل لمستوى الانعكاس ${STOP_LOSS}`);
      }

      return { ticker: stock.ticker, price: currentPrice, status, stopLoss: STOP_LOSS };
    }));

    return NextResponse.json({ message: "تم الفحص وإرسال التنبيهات", alerts });
    
  } catch (error) {
    return NextResponse.json({ error: 'خطأ: ' + error.message }, { status: 500 });
  }
}
