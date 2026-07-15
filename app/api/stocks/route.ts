import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const stocks = ['NVDA', 'AAPL', 'TSLA']; // يمكنك إضافة أي أسهم هنا
  
  let results = [];

  for (let symbol of stocks) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
      const data = await res.json();
      const quote = data['Global Quote'];
      
      if (quote) {
        results.push({
          symbol: quote['01. symbol'],
          price: quote['05. price'],
          change: quote['10. change percent']
        });
      }
    } catch (e) {
      console.error(`Error fetching ${symbol}:`, e);
    }
  }

  // إرسال تنبيه لتليجرام (يمكنك تفعيله لاحقاً)
  return NextResponse.json({ status: "Success", data: results });
}
