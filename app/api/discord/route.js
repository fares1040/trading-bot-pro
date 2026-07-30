// app/api/discord/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message } = await request.json();
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'رابط ديسكورد غير موجود في ملف البيئة' }, { status: 400 });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message || "🚨 تنبيه تداول ذكي جديد من منصة سنايبر." }),
    });

    if (!response.ok) throw new Error('فشل الإرسال إلى ديسكورد');

    return NextResponse.json({ success: true, message: 'تم إرسال التقرير لديسكورد بنجاح!' });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ في الاتصال بديسكورد' }, { status: 500 });
  }
}
