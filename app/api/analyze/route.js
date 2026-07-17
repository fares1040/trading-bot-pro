import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || "AAPL";

  const watchList = {
    "AAPL": { support: 0.75, resistance: 0.85 },
    "TSLA": { support: 0.65, resistance: 0.95 },
    "A":    { support: 0.60, resistance: 0.90 }
  };

  const levels = watchList[symbol.toUpperCase()] || { support: 0.50, resistance: 1.0 };
  const currentPrice = 0.78; // سيتم ربطه مستقبلاً بالسعر اللحظي من المنصة
  
  let signal = "مراقبة (السعر في المنتصف)";
  let statusColor = "yellow";

  if (currentPrice <= levels.support) {
    signal = "فرصة دخول قوية";
    statusColor = "green";
  } else if (currentPrice >= levels.resistance) {
    signal = "فرصة خروج";
    statusColor = "red";
  }

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    currentPrice,
    analysis: signal,
    status: statusColor
  });
}
