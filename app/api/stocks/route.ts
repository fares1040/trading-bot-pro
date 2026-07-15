import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // اختبار بسيط للاتصال
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "تم الاتصال بنجاح من Vercel 🚀"
      }),
    });

    const data = await response.json();
    return NextResponse.json({ status: "Success", data });
  } catch (error) {
    return NextResponse.json({ status: "Error", error: String(error) }, { status: 500 });
  }
}
