import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) return NextResponse.json({ error: "الرجاء تحديد السهم" }, { status: 400 });

  try {
    // تم تحديث الرابط ليتوافق مع المسار الصحيح لجلب تفاصيل السهم من Massive
    const url = `https://api.massive.com/v3/reference/tickers/${symbol.toUpperCase()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}`
      }
    });

    if (!response.ok) throw new Error('فشل الاتصال');
    
    const data = await response.json();

    // هنا نقوم باستخراج السعر. 
    // ملاحظة: إذا لم يظهر السعر، تأكد من مسار البيانات في الـ Logs (غالباً سيكون data.results.price)
    const price = data.results?.price || data.results?.close || "0.00";

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice: price,
      analysis: price > 0 ? "بيانات نشطة" : "يرجى التحقق من الرمز",
      status: "#00ff41"
    });
  } catch (error) {
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}
