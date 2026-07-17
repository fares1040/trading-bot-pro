import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = 'Fc_0SgzQR4F9fDxI22VYMu7K0izaBBfn'; 

  try {
    const response = await fetch('https://api.massive.com/v1/keys', { // جربت تغيير المسار لشيء قياسي
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text(); // نستخدم .text() بدلاً من .json() لتجنب خطأ التنسيق
    return NextResponse.json({ rawData: text }); // سيعرض لنا بالضبط ماذا أرسلت المنصة
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
