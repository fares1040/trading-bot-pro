// استبدل جزء جلب السعر في ملف الـ route.ts بهذا الكود:
let price = "غير متاح حالياً";
try {
  const priceRes = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`);
  const priceData = await priceRes.json();
  if (priceData['Global Quote'] && priceData['Global Quote']['05. price']) {
    price = priceData['Global Quote']['05. price'];
  }
} catch (e) {
  console.error("خطأ في جلب السعر، سنكمل التحليل بدونه");
}
// ثم أكمل التحليل بـ Gemini كما في الكود السابق
