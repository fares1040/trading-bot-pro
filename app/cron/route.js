import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // استخدم المسار النسبي فقط (بدون الرابط الطويل)
    const stocksRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://' + process.env.VERCEL_URL}/api/stocks`);
    const stocksData = await stocksRes.json();

    const symbols = stocksData.data.map(item => item.ticker);

    for (const s of symbols) {
      // استخدم المسار النسبي هنا أيضاً
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://' + process.env.VERCEL_URL}/api/analyze?symbol=${s}`);
    }

    return NextResponse.json({ status: "all scanned", count: symbols.length, symbols });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
