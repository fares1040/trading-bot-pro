import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        
        // التحقق من أن الطلب يحتوي على نقرة زر تفاعلي (Callback Query)
        if (body.callback_query) {
            const callbackQuery = body.callback_query;
            const data = callbackQuery.data; // البيانات المرسلة من الزر (مثال: enter_trade_TSLA_185.50)
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            
            const telegramToken = '8822034470:AAEbooViT3tdkkQqt2lx86GZBWipYUq0MgA';

            let responseText = "✅ تم التعامل مع الطلب بنجاح.";

            if (data.startsWith('enter_trade_')) {
                const parts = data.split('_');
                const symbol = parts[2];
                const entryPrice = parts[3];

                // هنا يمكنك حفظ الصفقة في قاعدة البيانات أو الذاكرة الحية لتتبعها عبر بوت المتابعة
                responseText = `👑 تم تأكيد دخولك صفقة السهم *[${symbol}]* بنجاح بسعر *\`${entryPrice} $\`*.\n🪂 تم تفعيل مظلة الحماية السيادية ومحرك التخارج اللحظي! بالتوفيق يا ملك الأرباح 🚀`;
            } else if (data.startsWith('ignore_trade_')) {
                const parts = data.split('_');
                const symbol = parts[2];
                responseText = `🗑️ تم تجاهل الفرصة على السهم *[${symbol}]*. بانتظار الفرصة الملكية القادمة.`;
            }

            // الرد الفوري على تيليجرام لإلغاء علامة التحميل من الزر
            await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callbackQuery.id,
                    text: "تم الاعتماد بنجاح! 👑"
                })
            });

            // تعديل الرسالة الأصلية لإزالة الأزرار وإظهار حالة الاعتماد
            await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: callbackQuery.message.text + `\n\n───────────────────\n${responseText}`,
                    parse_mode: 'Markdown'
                })
            });
        }

        return NextResponse.json({ status: "success" });
    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ status: "error", message: error.toString() }, { status: 500 });
    }
}
