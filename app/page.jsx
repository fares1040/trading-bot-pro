'use client';
import { useState, useEffect } from 'react';

export default function Home() {
    const [ticker, setTicker] = useState('');
    const [newTicker, setNewTicker] = useState('');
    const [watchData, setWatchData] = useState([]);
    const [watchlist, setWatchlist] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('myWatchlist');
            return saved ? JSON.parse(saved) : ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI', 'CNF'];
        }
        return ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI', 'CNF'];
    });

    useEffect(() => {
        localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
        fetchWatchlist();
    }, [watchlist]);

    const fetchWatchlist = async () => {
        const data = await Promise.all(watchlist.map(async (s) => {
            try {
                const res = await fetch(`/api/analyze?symbol=${s}`);
                const json = await res.json();
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

    const handleSearch = async () => {
        if (!ticker) return;
        const res = await fetch(`/api/analyze?symbol=${ticker.toUpperCase()}`);
        const data = await res.json();
        alert(data.analysis || "لا يوجد بيانات");
    };

    const addSymbol = () => {
        if (newTicker && !watchlist.includes(newTicker.toUpperCase())) {
            setWatchlist([...watchlist, newTicker.toUpperCase()]);
            setNewTicker('');
        }
    };

    const removeSymbol = (symbolToRemove) => {
        setWatchlist(watchlist.filter(s => s !== symbolToRemove));
    };

    return (
        <div style={{ background: '#000', color: '#00ff41', padding: '20px', fontFamily: 'monospace' }}>
            <h1 style={{ textAlign: 'center' }}>غرفة العمليات - نظام السنايبر المطور</h1>
            
            <div style={{ marginBottom: '20px' }}>
                <input onChange={(e) => setTicker(e.target.value)} placeholder="ابحث عن سهم" style={{ width: '80%', padding: '10px' }} />
                <button onClick={handleSearch} style={{ width: '15%', padding: '10px', marginLeft: '5px', background: '#00ff41', border: 'none', cursor: 'pointer' }}>بحث</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input onChange={(e) => setNewTicker(e.target.value)} value={newTicker} placeholder="إضافة سهم للقائمة" style={{ width: '80%', padding: '10px' }} />
                <button onClick={addSymbol} style={{ width: '15%', padding: '10px', marginLeft: '5px', background: '#00ff41', border: 'none', cursor: 'pointer' }}>إضافة</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
                        <th>السهم</th>
                        <th>السعر</th>
                        <th>حالة الدخول</th>
                        <th>التحليل الفني</th>
                    </tr>
                </thead>
                <tbody>
                    {watchData.map((item) => (
                        <tr key={item.symbol} style={{ borderBottom: '1px solid #333' }}>
                            <td>{item.symbol}</td>
                            <td>{item.currentPrice}</td>
                            <td style={{ color: item.isSuitable ? '#00ff41' : '#ff4d4d' }}>
                                {item.isSuitable ? "مناسب ✅" : "انتظر ❌"}
                            </td>
                            <td>
                                <button onClick={() => alert(item.analysis)} style={{ background: 'none', color: '#00ff41', border: 'none', cursor: 'pointer' }}>عرض</button>
                                <button onClick={() => removeSymbol(item.symbol)} style={{ background: 'none', color: '#ff4d4d', border: 'none', cursor: 'pointer', marginLeft: '10px' }}>X</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
