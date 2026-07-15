import { NextResponse } from 'next/server';

export async function GET() {
  const stocks = [
    { symbol: 'NXTC', price: '6.58', trend: 'up' },
    { symbol: 'FGIWW', price: '0.09', trend: 'down' },
    { symbol: 'PTORW', price: '0.684', trend: 'up' },
    { symbol: 'PRENW', price: '0.0159', trend: 'neutral' },
    { symbol: 'BOSER', price: '0.04', trend: 'up' }
  ];
  
  return NextResponse.json({ data: stocks });
}
