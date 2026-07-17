import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol'); // استقبال رمز السهم من البحث
  
  const apiUrl = symbol 
    ? `https://api.massive.com/v3/reference/tickers?ticker=${symbol}&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8`
    : "https://api.massive.com/v3/reference/tickers?market=stocks&active=true&limit=5&apiKey=txQ1pePWvQR7McsjPfZWBCYeDgNYNef8";

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    return NextResponse.json({ status: "نجاح", data: data.results || data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
