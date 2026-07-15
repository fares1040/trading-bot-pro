import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // ضع التوكن الخاص بك هنا بين علامتي التنصيص
    const token = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ'; 
    
    // التحقق من أن الرسالة نصية
    if (!body.message?.text) return NextResponse.json({ ok: true });

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // رد أولي للتأكد من أن البوت يتلقى الرسائل
    const responseText = `تم استلام طلبك للسهم: ${userText}. جاري التحليل...`;

    // إرسال الرد لتليجرام
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: responseText 
      })
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: true });
  }
}
