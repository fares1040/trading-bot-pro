const runScanner = async () => {
  setStatus('جاري مسح السوق...');
  try {
    // نطلب الرابط `/api/stocks` بدون أي إضافات
    const response = await fetch('/api/stocks');
    const data = await response.json();
    
    if (data.error) {
      setStatus('خطأ: ' + data.error);
    } else {
      setStatus('تم المسح! الفرص الموجودة: ' + (data.alerts ? data.alerts.length : 0));
      setAlerts(data.alerts || []);
    }
  } catch (e) {
    setStatus('حدث خطأ في الاتصال');
  }
};
