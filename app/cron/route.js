import { NextResponse } from 'next/server';

export async function GET() {
  // هذه قائمة أسهمك - يمكنك تحديثها هنا فقط إذا أضفت سهماً جديداً
  const symbols = ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
  
  const baseUrl = "https://trading-bot-pro-fwy4.vercel.app";
  
  for (const s of symbols) {
    await fetch(`${baseUrl}/api/analyze?symbol=${s}`);
  }
  
  return NextResponse.json({ status: "all scanned" });
}
