// app/api/telegram/route.js
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { type, data } = await req.json();
  
  // ضع التوكن هنا مباشرة، لا حاجة للمتغيرات في Vercel حالياً
  const BOT_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ'; 
  const CHAT_ID = '896028407';

  let message = `🏆✨ بداية الصفقة ✨🏆\n\n📍 ${data.symbol}\n💰 السعر: ${data.price}$`;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: message })
  });

  return NextResponse.json({ success: true });
}
