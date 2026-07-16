import { NextResponse } from 'next/server';

export async function GET() {
  const stocks = [
    { symbol: 'PTORW', price: '0.58', trend: 'up' },
    { symbol: 'FGIWW', price: '0.39', trend: 'down' },
    { symbol: 'NXTC', price: '6.58', trend: 'up' },
    { symbol: 'PRENW', price: '0.01', trend: 'neutral' },
    { symbol: 'BOSER', price: '0.04', trend: 'up' }
  ];
  return NextResponse.json({ data: stocks });
}
