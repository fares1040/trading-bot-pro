const fetchWatchlist = async () => {
    const data = await Promise.all(watchlist.map(async (s) => {
        try {
            const res = await fetch(`/api/analyze?symbol=${s}`);
            const json = await res.json();
            // هنا التعديل: نأخذ الـ analysis من الـ json اللي يجي من الـ API
            return { 
                symbol: s, 
                currentPrice: json.currentPrice || '---', 
                isSuitable: json.isSuitable || false, 
                analysis: json.analysis || "لا يوجد تحليل حالياً" 
            };
        } catch (e) {
            return { symbol: s, currentPrice: '---', isSuitable: false, analysis: 'خطأ في الاتصال' };
        }
    }));
    setWatchData(data);
};
