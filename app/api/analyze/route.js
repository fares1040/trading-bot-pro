import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  // قائمة أسهمك "القاسية" مع دعمها ومقاومتها الحقيقية
  const watchList = {
    "AAPL": { support: 0.75, resistance: 0.85 },
    "TSLA": { support: 0.65, resistance: 0.95 },
    "A":    { support: 0.60, resistance: 0.90 }
  };

  const levels = watchList[symbol.toUpperCase()] || { support: 0.50, resistance: 1.0 };
  
  // هنا ستقوم بجلب السعر الحقيقي من المنصة لاحقاً
  const currentPrice = 0.78; 
  
  let signal = "مراقبة";
  
  if (currentPrice <= levels.support) {
    signal = "فرصة دخول: السعر عند منطقة الدعم";
  } else if (currentPrice >= levels.resistance) {
    signal = "فرصة خروج: السعر عند منطقة المقاومة";
  }

  return NextResponse.json({
    symbol,
    currentPrice,
    support: levels.support,
    resistance: levels.resistance,
    analysis: signal
  });
}
