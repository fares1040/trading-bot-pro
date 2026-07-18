import { NextResponse } from 'next/server';

export async function GET(request) {
  const watchlist = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  const BOT_TOKEN = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';
  const CHAT_ID = '896028407';

  // هنا كود الفحص التلقائي
  for (const symbol of watchlist) {
    // تحقق من الشروط... إذا تحققت:
    const message = `🚨 صيد جديد! سهم ${symbol} يحقق شروط الدخول.`;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(message)}`);
  }

  return NextResponse.json({ status: "Scanner Active" });
}
