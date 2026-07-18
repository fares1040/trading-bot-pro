'use client';
import { useState, useEffect } from 'react';

export default function Home() {
    const [ticker, setTicker] = useState('');
    const [newTicker, setNewTicker] = useState('');
    const [watchData, setWatchData] = useState([]);
    const [watchlist, setWatchlist] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('myWatchlist');
            return saved ? JSON.parse(saved) : ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
        }
        return ['HURA', 'KULR', 'BYRN', 'BJSX', 'PODC', 'SPSC', 'MRAM', 'NOK', 'OPI'];
    });

    // الحفظ التلقائي عند أي تغيير
    useEffect(() => {
        localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
    }, [watchlist]);

    const fetchWatchlist = async () => {
        const data = await Promise.all(watchlist.map(async (s) => {
            try {
                const res = await fetch(`/api/analyze?symbol=${s}`);
                const json = await res.json();
                return { symbol: s, ...json };
            } catch (e) {
                return { symbol: s, currentPrice: '---', isSuitable: false, analysis: 'خطأ في التحليل' };
            }
        }));
        setWatchData(data);
    };

    useEffect(() => {
        fetchWatchlist();
    }, [watchlist]);

    const handleSearch = async () => {
        if (!ticker) return;
        const res = await fetch(`/api/analyze?symbol=${ticker.toUpperCase()}`);
        const data = await res.json();
        alert(data.analysis);
    };

    const addSymbol = () => {
        if (newTicker && !watchlist.includes(newTicker.toUpperCase())) {
            const updatedList = [...watchlist, newTicker.toUpperCase()];
            setWatchlist(updatedList);
            setNewTicker('');
        }
    };

    const removeSymbol = (symbolToRemove) => {
        const updatedList = watchlist.filter(s => s !== symbolToRemove);
        setWatchlist(updatedList);
    };

    return (
        <div style={{ backgroundColor: '#121212', color: '#fff', padding: '20px', fontFamily: 'monospace' }}>
            <h1 style={{ textAlign: 'center', color: '#00ff41' }}>غرفة العمليات - نظام السنايبر المطور</h1>

            <div style={{ marginBottom: '20px' }}>
                <input onChange={(e) => setTicker(e.target.value)} placeholder="بحث عن سهم..." style={{ width: '80%', padding: '10px', background: '#00ff41', border: 'none' }} />
                <button onClick={handleSearch} style={{ width: '19%', padding: '10px', marginLeft: '1%', background: '#00ff41', cursor: 'pointer' }}>بحث</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <input onChange={(e) => setNewTicker(e.target.value)} value={newTicker} placeholder="إضافة سهم للقائمة..." style={{ width: '80%', padding: '10px', background: '#00ff41', border: 'none' }} />
                <button onClick={addSymbol} style={{ width: '19%', padding: '10px', marginLeft: '1%', background: '#00ff41', cursor: 'pointer' }}>إضافة</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ color: '#888', borderBottom: '2px solid #333' }}>
                        <th>السهم</th>
                        <th>السعر</th>
                        <th>حالة الدخول</th>
                        <th>التحليل الفني</th>
                        <th>حذف</th>
                    </tr>
                </thead>
                <tbody>
                    {watchData.map((item) => (
                        <tr key={item.symbol} style={{ borderBottom: '1px solid #333' }}>
                            <td>{item.symbol}</td>
                            <td>{item.currentPrice}</td>
                            <td style={{ color: item.isSuitable ? '#00ff41' : '#ff4141' }}>
                                {item.isSuitable ? 'مناسب ✅' : 'انتظر ⏳'}
                            </td>
                            <td><button onClick={() => alert(item.analysis)} style={{ background: 'none', color: '#00ff41', border: 'none', cursor: 'pointer' }}>عرض</button></td>
                            <td><button onClick={() => removeSymbol(item.symbol)} style={{ background: 'none', color: '#ff4141', border: 'none', cursor: 'pointer' }}>حذف</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
