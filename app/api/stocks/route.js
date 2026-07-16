import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbolsInput = searchParams.get('symbols') || 'PPSI,ANVS,BYRN,KULR,HURA,BJDX,OPI,MRAM,SPSC,PODC,NOK,ERNA,PRFX,VMAR,CETX,GSIT';
  const symbols = symbolsInput.split(',');
  const API_KEY = 'QE3ODUMP7UQR22T8';
  let watchlist = [];
  let alerts = [];

  for (const symbol of symbols) {
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
      const data = await res.json();
      if (!data['Time Series (Daily)']) continue;

      const prices = Object.values(data['Time Series (Daily)']).slice(0, 20).map(d => parseFloat(d['4. close']));
      const currentPrice = prices[0];
      const avg = prices.reduce((a, b) => a + b, 0) / 20;
      const stdDev = Math.sqrt(prices.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / 20);
      
      const bollingerUpper = avg + (2 * stdDev);
      const resistance = Math.max(...prices.slice(1, 6)); 

      watchlist.push({ symbol, price: currentPrice.toFixed(2) });

      if (currentPrice > bollingerUpper && currentPrice > resistance) {
        alerts.push({ symbol, price: currentPrice.toFixed(2), reason: 'اختراق انفجاري' });
      }
    } catch (e) { continue; }
  }

  return NextResponse.json({ watchlist, alerts });
}
