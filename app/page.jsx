const runScanner = async () => {
  setStatus('جاري مسح السوق...');
  try {
    const response = await fetch('/api/stocks');
    const text = await response.text(); // نجلب النص أولاً
    try {
      const data = JSON.parse(text); // نحاول تحويله لـ JSON
      setStatus('تم المسح! الفرص: ' + (data.alerts ? data.alerts.length : 0));
      setAlerts(data.alerts || []);
    } catch (parseError) {
      setStatus('خطأ في البيانات: ' + text.substring(0, 20)); // نظهر أول جزء من النص لنتعرف على الخطأ
    }
  } catch (e) {
    setStatus('خطأ في الاتصال');
  }
};
