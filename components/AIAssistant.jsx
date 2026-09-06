// components/AIAssistant.jsx
'use client';

import React, { useState } from 'react';
import { colors, radius } from '@/components/ui/DesignTokens';

const panel = { backgroundColor: '#090A0F', border: '1px solid #1F2636', borderRadius: radius.lg };

export default function SmartManagementHub() {
  const [portfolioSize, setPortfolioSize] = useState(10000);
  const [riskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(15);
  const [stopLossPrice, setStopLossPrice] = useState(14.2);

  const riskAmount = (portfolioSize * (riskPercent / 100)).toFixed(2);
  const riskPerShare = (entryPrice - stopLossPrice).toFixed(2);
  const suggestedShares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;

  const [dcaTotalAmount, setDcaTotalAmount] = useState(3000);
  const amountPerTranche = (dcaTotalAmount / 3).toFixed(2);

  const [isOpenAI, setIsOpenAI] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'أهلاً بك يا بطل! أنا مساعد Hunter الذكي. اسألني عن أي سهم أو صفقة (مثلاً: تحليل سهم SERV الآن مع السعر الفعلي).' }
  ]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || isLoading) return;

    const userMsg = chatQuery;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, mode: 'general' })
      });

      const data = await response.json();
      const aiReply = data.reply || data.analysis || 'عذراً، لم أتمكن من جلب التحليل المباشر حالياً.';

      setChatHistory(prev => [...prev, { sender: 'ai', text: aiReply }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'حدث خطأ في الاتصال بخادم التحليل الذكي.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = { width: '100%', backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: radius.sm, padding: '8px 10px', color: colors.text.primary, fontFamily: 'monospace', fontSize: 12, outline: 'none' };
  const labelStyle = { color: colors.text.muted, display: 'block', marginBottom: 4, fontSize: 11 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16, padding: 16, backgroundColor: '#090A0F', color: colors.text.primary, borderRadius: radius.lg, border: '1px solid #1F2636' }}>
      
      {/* لوحة استراتيجية الذكاء الاصطناعي اليومية */}
      <div style={{ padding: 14, borderRadius: radius.md, border: '1px solid #6366F140', backgroundColor: '#312E8120' }}>
        <h4 style={{ fontSize: 13, fontWeight: 900, color: '#818CF8', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          🤖 توجيهات مست顾问 Hunter AI لليوم
        </h4>
        <div style={{ fontSize: 11, color: colors.text.secondary, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.semantic.success, fontWeight: 700 }}>
            <span>✔ قطاعات مستهدفة وعالية السيولة:</span> AI Stocks / Semiconductor / Small Caps 🚀
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.semantic.danger, fontWeight: 700 }}>
            <span>❌ قطاعات مستبعدة لضعف الرواج:</span> Biotech (تم الإخراج التلقائي لتفادي جمود رأس المال)
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#A78BFA', display: 'flex', alignItems: 'center', gap: 8 }}>
          🧠 أدوات القيادة الذكية وإدارة حجم الصفقات
        </h3>
        <p style={{ fontSize: 11, color: colors.text.muted, marginTop: 4 }}>تنسيق فوري للمخاطر وتخطيط الدفعات الآمنة لحماية صفقات السنتات والأوبشنز.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* حاسبة المخاطر اللحظية */}
        <div style={{ ...panel, padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: colors.semantic.success, marginBottom: 12 }}>📊 حاسبة حجم الصفقة (Position Sizing)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
            <div>
              <label style={labelStyle}>حجم المحفظة الإجمالي ($):</label>
              <input type="number" value={portfolioSize} onChange={(e) => setPortfolioSize(Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>سعر الدخول ($):</label>
                <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>وقف الخسارة ($):</label>
                <input type="number" value={stopLossPrice} onChange={(e) => setStopLossPrice(Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: radius.sm, backgroundColor: '#0B0F17', border: '1px solid #1F2636', marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: colors.accent.cyan }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>المبلغ المعرض للمخاطر (2%):</span> <strong style={{ color: colors.text.primary }}>${riskAmount}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>عدد الأسهم المقترح:</span> <strong style={{ color: colors.semantic.success }}>{suggestedShares} سهم</strong></div>
            </div>
          </div>
        </div>

        {/* حاسبة DCA */}
        <div style={{ ...panel, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: colors.accent.cyan, marginBottom: 12 }}>🛡️ حاسبة التجميع وتوزيع السيولة (DCA Planner)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div>
                <label style={labelStyle}>المبلغ المخصص للاستثمار ($):</label>
                <input type="number" value={dcaTotalAmount} onChange={(e) => setDcaTotalAmount(Number(e.target.value))} style={inputStyle} />
              </div>
              <div style={{ padding: 12, borderRadius: radius.sm, backgroundColor: '#0B0F17', border: '1px solid #1F2636', fontSize: 11, color: colors.text.secondary }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>مبلغ الدفعة الواحد (من 3 دفعات):</span> <strong style={{ color: colors.semantic.success }}>${amountPerTranche}</strong></div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 10, borderRadius: radius.sm, backgroundColor: '#4C1D9520', border: '1px solid #8B5CF630', fontSize: 10, color: '#C4B5FD' }}>
            🔔 رادار مسح الارتدادات يبحث لك عن قيعان 52 أسبوع للتجميع الفوري الآمن.
          </div>
        </div>
      </div>

      {/* شات البوت الذكي العائم */}
      <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 50 }}>
        {!isOpenAI ? (
          <button onClick={() => setIsOpenAI(true)} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #059669, #4F46E5)', color: colors.text.primary, borderRadius: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.4)', border: '1px solid #6366F140', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'transform 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🤖 اسأل مست顾问 Hunter AI
          </button>
        ) : (
          <div style={{ width: 320, height: 384, backgroundColor: '#0B0F17', border: '1px solid #6366F150', borderRadius: radius.lg, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#0F1420', padding: '10px 14px', borderBottom: '1px solid #1F2636', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#818CF8' }}>🤖 لوحة محادثة Hunter AI</span>
              <button onClick={() => setIsOpenAI(false)} style={{ color: colors.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: radius.md, maxWidth: '85%', backgroundColor: msg.sender === 'user' ? '#312E8140' : '#0B0F17', color: msg.sender === 'user' ? '#C7D2FE' : colors.text.secondary, alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.text}
                </div>
              ))}
              {isLoading && (
                <div style={{ padding: '8px 12px', borderRadius: radius.md, maxWidth: '85%', backgroundColor: '#0B0F17', color: '#818CF8' }}>
                  جاري تحليل الأسعار والسيولة الحية...
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: '8px 10px', borderTop: '1px solid #1F2636', display: 'flex', gap: 8, backgroundColor: '#0F1420' }}>
              <input type="text" placeholder="اكتب اسم السهم لمعرفة سبب الصيد الفني..." value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} disabled={isLoading} style={{ flex: 1, backgroundColor: '#0B0F17', border: '1px solid #1F2636', borderRadius: radius.sm, padding: '6px 10px', color: colors.text.primary, fontSize: 11, outline: 'none' }} />
              <button type="submit" disabled={isLoading} style={{ padding: '6px 14px', backgroundColor: '#4F46E5', color: colors.text.primary, borderRadius: radius.sm, fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}>إرسال</button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
