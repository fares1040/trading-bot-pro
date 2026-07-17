import { NextResponse } from 'next/server';

export async function GET() {
  // وضعنا المفتاح مباشرة هنا للتجربة فقط
  const apiKey = 'Fc_0SgzQR4F9fDxI22VYMu7K0izaBBfn'; 

  if (!apiKey) {
    return NextResponse.json({ error: 'المفتاح مفقود' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.massive.com/v1/your-endpoint', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json({ error: 'خطأ: ' + error.message }, { status: 500 });
  }
}
