import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // هذه هي الأسهم التي تريد مراقبتها
    const stocks = [
      { symbol: 'NXTC', price: '6.58', change: '4.5' },
      { symbol: 'FGIWW', price: '0.09', change: '2.1' },
      { symbol: 'PTORW', price: '0.684', change: '5.2' },
      { symbol: 'PRENW', price: '0.0159', change: '3.8' },
      { symbol: 'BOSER', price: '0.04', change: '1.2' }
      // يمكنك إضافة المزيد هنا بنفس الصيغة
    ];
    
    return NextResponse.json({ status: "Success", data: stocks });
  } catch (error) {
    return NextResponse.json({ status: "Error", data: [] });
  }
}
