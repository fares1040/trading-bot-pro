import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { data } = body;
    const BOT_TOKEN = '8822034470:AAGqmVjti7WUH1BqTektxlgU9dfwJqU41UQ';
    const CHAT_ID = '896028407';

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: CHAT_ID, 
        text: `⚠️ تنبيه من الرادار:\nالسهم: ${data.symbol}\nالحالة: ${data.msg}` 
      }),
    });

    return NextResponse.json({ status: "Message sent" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
