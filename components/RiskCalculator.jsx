// components/RiskCalculator.jsx
'use client';
import React, { useState } from 'react';

export default function RiskCalculator() {
  const [accountSize, setAccountSize] = useState('');
  const [riskPercentage, setRiskPercentage] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [result, setResult] = useState(null);

  const calculateRisk = (e) => {
    e.preventDefault();
    const acc = parseFloat(accountSize);
    const riskP = parseFloat(riskPercentage);
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);

    if (!acc || !riskP || !entry || !sl) return;

    const riskAmountDollars = (acc * riskP) / 100;
    const riskPerShare = Math.abs(entry - sl);

    if (riskPerShare === 0) return;

    const sharesCount = Math.floor(riskAmountDollars / riskPerShare);
    const totalCost = sharesCount * entry;
    const target1 = entry + (riskPerShare * 1.5);
    const target2 = entry + (riskPerShare * 2.5);

    setResult({
      riskAmountDollars: riskAmountDollars.toFixed(2),
      riskPerShare: riskPerShare.toFixed(2),
      sharesCount,
      totalCost: totalCost.toFixed(2),
      target1: target1.toFixed(2),
      target2: target2.toFixed(2)
    });
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #0d111a 0%, #161b22 100%)', padding: '25px', borderRadius: '16px', border: '1px solid #30363d', marginTop: '25px', color: '#fff', direction: 'rtl', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#38bdf8', fontSize: '18px', borderBottom: '1px solid #21262d', paddingBottom: '12px' }}>
        🧮 حاسبة إدارة المخاطر وتحديد حجم المركز (منصة النخبة)
      </h3>

      <form onSubmit={calculateRisk} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>رأس مال المحفظة ($)</label>
          <input 
            type="number" 
            value={accountSize} 
            onChange={(e) => setAccountSize(e.target.value)} 
            placeholder="مثال: 10000" 
            style={{ width: '100%', background: '#07090e', color: '#fff', border: '1px solid #30363d', padding: '10px 14px', borderRadius: '8px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>نسبة المخاطرة المسموحة (%)</label>
          <input 
            type="number" 
            value={riskPercentage} 
            onChange={(e) => setRiskPercentage(e.target.value)} 
            placeholder="1" 
            style={{ width: '100%', background: '#07090e', color: '#fff', border: '1px solid #30363d', padding: '10px 14px', borderRadius: '8px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>سعر الدخول ($)</label>
          <input 
            type="number" 
            step="0.01" 
            value={entryPrice} 
            onChange={(e) => setEntryPrice(e.target.value)} 
            placeholder="مثال: 45.50" 
            style={{ width: '100%', background: '#07090e', color: '#fff', border: '1px solid #30363d', padding: '10px 14px', borderRadius: '8px', outline: 'none' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '6px' }}>وقف الخسارة SL ($)</label>
          <input 
            type="number" 
            step="0.01" 
            value={stopLoss} 
            onChange={(e) => setStopLoss(e.target.value)} 
            placeholder="مثال: 44.00" 
            style={{ width: '100%', background: '#07090e', color: '#fff', border: '1px solid #30363d', padding: '10px 14px', borderRadius: '8px', outline: 'none' }}
          />
        </div>
      </form>

      <button 
        onClick={calculateRisk}
        style={{ width: '100%', background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#0d111a', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginBottom: '20px' }}
      >
        احسب خطة الصفقة والأسهم المطلوبة
      </button>

      {result && (
        <div style={{ background: '#07090e', padding: '18px', borderRadius: '10px', border: '1px solid #21262d' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#4ade80', fontSize: '14px' }}>📊 نتائج خطة إدارة المخاطر:</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', fontSize: '13px' }}>
            <div style={{ background: '#111827', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#9ca3af', display: 'block' }}>الخسارة المسموحة:</span>
              <span style={{ color: '#f87171', fontWeight: 'bold' }}>${result.riskAmountDollars}</span>
            </div>
            <div style={{ background: '#111827', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#9ca3af', display: 'block' }}>عدد الأسهم الآمن:</span>
              <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{result.sharesCount} سهم</span>
            </div>
            <div style={{ background: '#111827', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#9ca3af', display: 'block' }}>إجمالي التكلفة:</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${result.totalCost}</span>
            </div>
            <div style={{ background: '#111827', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#9ca3af', display: 'block' }}>الهدف الأول (1.5R):</span>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>${result.target1}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
