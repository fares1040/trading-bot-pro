const handleAnalyze = async (symbol: string) => {
    setAnalysis("جاري سحب بيانات السعر وتحليل الانفجار...");
    try {
      // 1. هنا سيتصل الموقع بالـ API الخاص بك
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await response.json();
      
      // 2. تحديث النتيجة على الشاشة
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysis("خطأ: تأكد من إعدادات الـ API.");
    }
  };
