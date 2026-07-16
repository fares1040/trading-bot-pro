import { NextResponse } from 'next/server';

export async function GET() {
  const BOT_TOKEN = '8822034470:AAGqmVjti7WUHlBqTektxlgU9dfwJqU4lUQ';
  const CHAT_ID = '896028407';

  // تنبيه تجريبي للتأكد أن الربط يعمل
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: "الرادار يعمل الآن!" })
  });

  return NextResponse.json({ status: "Test message sent" });
}
