import { NextResponse } from 'next/server';

export async function GET(req) {
  // هذه هي القائمة التي يمسحها الرادار
  // يمكنك إضافة أو حذف أي سهم تريده من هنا في أي وقت
  const marketList = ['PPSI', 'ANVS', 'BYRN', 'KULR', 'HURA', 'NVDA', 'AMD', 'PLTR', 'MARA', 'SOUN'];
  
  const API_KEY = 'QE3ODUMP7UQR22T8';
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';
  let alerts = [];

  for (const symbol of marketList) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const dailyData = Object.values(data['Time Series (Daily)']);
      const price = parseFloat(dailyData[0]['4. close']);
      const prevPrice = parseFloat(dailyData[1]['4. close']);
      const vol = parseFloat(dailyData[0]['5. volume']);
      const avgVol = dailyData.slice(1, 11).reduce((a, b) => a + parseFloat(b['5. volume']), 0) / 10;

      // شروط "السنايبر" الجديدة (أكثر مرونة قليلاً لتلتقط الفرص)
      if (price > prevPrice * 1.01 && vol > avgVol * 1.2) {
        alerts.push({ symbol, msg: '🚀 فرصة دخول: اختراق' });
        
        // إرسال التنبيه فوراً
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: `رادار السنايبر: فرصة قوية في ${symbol}\nالسعر: ${price}\nالحالة: اختراق وتدفق فوليوم` 
            })
        });
      }
    } catch (e) { continue; }
  }
  return NextResponse.json({ alerts });
}
