import { NextResponse } from 'next/server';

export async function GET() {
  // هذه القائمة التي تريد عرضها
  const stocks = [
    { symbol: 'PTORW', price: '0.58', trend: 'up' },
    { symbol: 'FGIWW', price: '0.39', trend: 'down' },
    { symbol: 'PTORW', price: '0.68', trend: 'up' },
    { symbol: 'PRENW', price: '0.01', trend: 'neutral' },
    { symbol: 'BOSER', price: '0.04', trend: 'up' }
  ];
  
  return NextResponse.json({ data: stocks });
}
