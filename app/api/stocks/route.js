import { NextResponse } from 'next/server';

export async function GET() {
  // الرابط الكامل الذي استخرجته مع كافة الإعدادات
  const apiUrl = "https://api.massive.com/v3/reference/tickers?market=stocks&active=true&order=asc&limit=100&sort=ticker&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في الاتصال: ' + error.message }, { status: 500 });
  }
}
