import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // نستخدم بيانات محاكية احترافية للتأكد من عمل الواجهة فوراً
    const mockData = [
      { symbol: 'AAPL', price: '155.20', change: '5.4' },
      { symbol: 'NVDA', price: '120.50', change: '4.2' },
      { symbol: 'TSLA', price: '210.30', change: '1.2' },
      { symbol: 'AMD', price: '160.00', change: '6.1' }
    ];
    
    return NextResponse.json({ status: "Success", data: mockData });
  } catch (error) {
    return NextResponse.json({ status: "Error", data: [] });
  }
}
