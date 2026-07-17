import { NextResponse } from 'next/server';

export async function GET() {
  // هذا هو المتغير الذي أضفته في Vercel تحت اسم MASSIVE_API_KEY
  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'لم يتم العثور على مفتاح API في إعدادات Vercel' }, { status: 500 });
  }

  try {
    // رابط مثال لـ Massive - تأكد من الرابط الصحيح من وثائقهم (REST Docs)
    const response = await fetch('https://api.massive.com/v1/your-endpoint', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey, // هذه هي الطريقة المطلوبة لهذه المنصة
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`خطأ من المنصة: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json({ error: 'فشل الاتصال: ' + error.message }, { status: 500 });
  }
}
