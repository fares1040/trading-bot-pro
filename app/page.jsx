'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import HunterRiskDesk from '@/components/HunterRiskDesk';

const panel = {
  backgroundColor: '#0B0F17',
  border: '1px solid #1F2636',
  borderRadius: '16px',
};

export default function HomePage() {
  const [riyadhTime, setRiyadhTime] = useState('');
  const [marketStatus, setMarketStatus] = useState('جاري الفحص...');
  const [indices, setIndices] = useState([]);
  const [radar, setRadar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');
  const [hunter, setHunter] = useState(null);
  const [radarTotal, setRadarTotal] = useState(0);
  const [production, setProduction] = useState(null);
  const [access, setAccess] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hunter', { cache: 'no-store' });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'تعذر جلب قراءة Hunter');
      }

      setIndices(json.indices || []);
      setRadar(json.opportunities || []);
      setHunter(json.regime || null);
      setRadarTotal(Number(json.radarCount || 0));
      setLastUpdate(json.timestamp || new Date().toISOString());
      setError('');
    } catch (err) {
      setError(err?.message || 'تعذر تحديث لوحة السوق');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateTimeAndMarket = () => {
      const now = new Date();
      setRiyadhTime(
        now.toLocaleTimeString('ar-SA', {
          timeZone: 'Asia/Riyadh',
          hour12: true,
        })
      );

      const nyParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(now);

      const part = (type) => nyParts.find((x) => x.type === type)?.value;
      const weekday = part('weekday');
      const hour = Number(part('hour'));
      const minute = Number(part('minute'));
      const total = hour * 60 + minute;
      const weekdayOpen = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);

      // Regular session only: 09:30–16:00 New York time.
      const open = weekdayOpen && total >= 570 && total < 960;
      setMarketStatus(
        open
          ? '🟢 السوق الأمريكي مفتوح'
          : '🔴 السوق الأمريكي مغلق'
      );
    };

    updateTimeAndMarket();
    const clock = setInterval(updateTimeAndMarket, 1000);
    loadDashboard();
    const refresh = setInterval(loadDashboard, 60_000);

    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const [healthRes, accessRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }),
          fetch('/api/access', { cache: 'no-store' }),
        ]);
        const health = await healthRes.json().catch(() => null);
        const access = await accessRes.json().catch(() => null);
        if (healthRes.ok) setProduction(health);
        if (accessRes.ok) setAccess(access);
      } catch {
        // Optional status services must never block the dashboard.
      }
    };
    loadStatus();
    const timer = setInterval(loadStatus, 60_000);
    return () => clearInterval(timer);
  }, []);

  const ready = useMemo(
    () => radar.filter((x) => x?.setupScore != null).slice(0, 10),
    [radar]
  );

  const top = ready.slice(0, 3);
  const averageScore = ready.length
    ? Math.round(
        ready.reduce((sum, item) => sum + Number(item.setupScore || 0), 0) /
          ready.length
      )
    : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#07090E',
        color: '#F8FAFC',
        fontFamily: 'sans-serif',
        direction: 'rtl',
        padding: '20px 30px',
      }}
    >
      <div
        style={{
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: '#0B0F17',
          border: '1px solid #1F2636',
          color: '#94A3B8',
          fontSize: '11px',
        }}
      >
        📡 الأسعار والمؤشرات والرادار هنا تُجلب من مصادر السوق الفعلية. لا توجد
        أرقام تجريبية معروضة على أنها حية.
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          marginBottom: '16px',
          paddingBottom: '4px',
        }}
      >
        {indices.map((idx) => (
          <div
            key={idx.symbol}
            style={{
              flex: '1',
              minWidth: '150px',
              ...panel,
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94A3B8' }}>
              {idx.name}
            </span>
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  fontFamily: 'monospace',
                }}
              >
                {Number(idx.value).toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: idx.isUp ? '#34D399' : '#EF4444',
                }}
              >
                {idx.isUp ? '▲' : '▼'} {idx.change}%
              </div>
            </div>
          </div>
        ))}
        {!indices.length && (
          <div style={{ ...panel, padding: 14, color: '#94A3B8', fontSize: 11 }}>
            {loading ? '⏳ جاري تحميل المؤشرات...' : 'المؤشرات غير متاحة حالياً'}
          </div>
        )}
      </div>

      <div
        style={{
          ...panel,
          padding: '16px 24px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              color: '#FBBF24',
              fontSize: '22px',
              fontWeight: '900',
              marginBottom: '4px',
            }}
          >
            🎯 HUNTER AI — V4.1 Intelligence
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: 0 }}>
            محرك قرار احترافي: سوق → رادار → سياق → مخاطرة → قرار.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              backgroundColor: '#07090E',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #1F2636',
              fontSize: '11px',
              color: '#34D399',
              fontWeight: 'bold',
            }}
          >
            {marketStatus}
          </div>
          <div
            style={{
              backgroundColor: '#07090E',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #1F2636',
              fontSize: '11px',
              color: '#FBBF24',
              fontFamily: 'monospace',
            }}
          >
            🇸🇦 الرياض: {riyadhTime || '...'}
          </div>
        </div>
      </div>

      <div
        style={{
          ...panel,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          fontSize: 10,
        }}
      >
        <strong style={{ color: '#FBBF24' }}>⚙️ PRODUCTION PIPELINE</strong>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ color: '#34D399' }}>P1✓</span>
          <span style={{ color: '#34D399' }}>P2✓</span>
          <span style={{ color: '#34D399' }}>P3✓</span>
          <span style={{ color: '#34D399' }}>P4✓</span>
          <span style={{ color: production?.phases?.institutionalIntelligence?.status === 'active' ? '#34D399' : '#FBBF24' }}>P5{production?.phases?.institutionalIntelligence?.status === 'active' ? '✓' : '○'}</span>
          <span style={{ color: '#34D399' }}>P6✓</span>
          <span style={{ color: '#34D399' }}>P7✓</span>
          <span style={{ color: '#C4B5FD' }}>P8✓</span>
          <span style={{ color: '#94A3B8' }}>{access?.plan ? `PLAN ${String(access.plan).toUpperCase()}` : 'PLAN FREE'}</span>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...panel,
            borderColor: '#7F1D1D',
            color: '#FCA5A5',
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {hunter && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ ...panel, padding: 18, background: 'linear-gradient(135deg, #111827 0%, #0B0F17 100%)' }}>
            <div style={{ color: '#38BDF8', fontSize: 10, fontWeight: 900, marginBottom: 8 }}>
              🧠 HUNTER MARKET REGIME
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: hunter.risk === 'DEFENSIVE' ? '#F87171' : hunter.risk === 'FAVORABLE' ? '#34D399' : '#FBBF24' }}>
                  {hunter.label}
                </div>
                <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>
                  سياق السوق: {hunter.score}/100
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', color: '#CBD5E1', fontSize: 12 }}>
                VIX {hunter.vix ?? '—'}
              </div>
            </div>
            <div style={{ color: '#64748B', fontSize: 10, marginTop: 10 }}>
              {hunter.reasons?.slice(0, 3).join(' • ') || 'لا توجد قراءة سياقية كافية'}
            </div>
          </div>
          <div style={{ ...panel, padding: 18 }}>
            <div style={{ color: '#A78BFA', fontSize: 10, fontWeight: 900 }}>🎯 RADAR DEPTH</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#F8FAFC', marginTop: 8 }}>{radarTotal}</div>
            <div style={{ color: '#94A3B8', fontSize: 10 }}>سهمًا أعاده الرادار في آخر دورة</div>
          </div>
          <div style={{ ...panel, padding: 18 }}>
            <div style={{ color: '#34D399', fontSize: 10, fontWeight: 900 }}>🛡️ DECISION RULE</div>
            <div style={{ color: '#F8FAFC', fontSize: 12, fontWeight: 800, marginTop: 8 }}>
              لا صفقة بلا وقف خسارة
            </div>
            <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 6 }}>
              Setup Score ≠ احتمال ربح. رأس المال أولاً.
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          background: 'linear-gradient(90deg, #1E1B4B 0%, #0B0F17 100%)',
          border: '1px solid #3730A3',
          borderRadius: '16px',
          padding: '18px 24px',
          marginBottom: '20px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: '#818CF8',
            fontWeight: 'bold',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          🧠 V4 RADAR STATUS
        </span>
        <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>
          {averageScore == null
            ? 'لا توجد قراءة كافية حالياً'
            : `متوسط Setup Score للرادار: ${averageScore}/100`}
        </h2>
        <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 0 }}>
          هذا تقييم حسابي للرادار، وليس احتمال ربح أو توصية مضمونة.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ ...panel, padding: '24px' }}>
          <div style={{ color: '#34D399', fontSize: 10, fontWeight: 'bold', marginBottom: 12 }}>
            ● LIVE TECHNICAL RADAR
          </div>
          <h3 style={{ color: '#FBBF24', fontSize: '20px', marginBottom: 8 }}>
            أفضل الفرص الحالية
          </h3>

          {loading ? (
            <div style={{ color: '#94A3B8', padding: 20 }}>⏳ جاري الفحص...</div>
          ) : !top.length ? (
            <div style={{ color: '#94A3B8', padding: 20 }}>
              لا توجد أسهم اجتازت البوابة حالياً.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {top.map((stock, index) => (
                <div
                  key={stock.symbol}
                  style={{
                    background: '#07090E',
                    border: '1px solid #3730A3',
                    padding: 14,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <strong style={{ color: '#FBBF24' }}>
                      #{index + 1} {stock.symbol}
                    </strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {stock.conviction && (
                        <span style={{ color: '#C4B5FD', fontSize: 10 }}>Hunter {stock.hunterTier || stock.conviction?.tier || '—'} · {stock.hunterScore ?? stock.conviction?.score ?? '—'}</span>
                      )}
                      <strong style={{ color: '#34D399' }}>
                        {stock.setupScore}/100
                      </strong>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 8,
                      marginTop: 10,
                      fontSize: 11,
                      color: '#CBD5E1',
                    }}
                  >
                    <span>السعر: ${stock.price}</span>
                    <span>RSI: {stock.rsi ?? '—'}</span>
                    <span>RVOL: {stock.relativeVolume?.toFixed?.(2) ?? '—'}x</span>
                    <span>{stock.conviction?.action || stock.signal || '—'}</span>
                  </div>
                  {stock.conviction?.reasons?.length > 0 && (
                    <div style={{ color: '#64748B', fontSize: 10, marginTop: 8 }}>
                      {stock.conviction.reasons.join(' • ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Link
            href="/analytics"
            style={{
              backgroundColor: '#FBBF24',
              color: '#000',
              padding: '14px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '900',
              fontSize: '14px',
              display: 'block',
              textAlign: 'center',
              marginTop: 18,
            }}
          >
            فتح الرادار والتحليلات ➔
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...panel, padding: 20 }}>
            <h4 style={{ color: '#38BDF8', fontSize: 14, marginTop: 0 }}>
              🎯 ملخص الرادار
            </h4>
            <div style={{ color: '#34D399', fontSize: 24, fontWeight: 900 }}>
              {radarTotal || ready.length} فرصة في آخر دورة
            </div>
            <p style={{ color: '#94A3B8', fontSize: 11 }}>
              مبنية على البيانات التي أعادها `/api/stocks` في آخر فحص.
            </p>
            <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.9 }}>
              <div>🟢 Score 90+: {ready.filter((x) => x.setupScore >= 90).length}</div>
              <div>🟡 Score 80–89: {ready.filter((x) => x.setupScore >= 80 && x.setupScore < 90).length}</div>
              <div>🟠 أقل من 80: {ready.filter((x) => x.setupScore < 80).length}</div>
            </div>
          </div>

          <div style={{ ...panel, padding: 20, flex: 1 }}>
            <h4 style={{ color: '#C084FC', fontSize: 14, marginTop: 0 }}>
              🛡️ حماية رأس المال
            </h4>
            <p style={{ color: '#94A3B8', fontSize: 11, lineHeight: 1.6 }}>
              خيارات Options وDark Pool وInstitutional Flow لا يتم عرضها كبيانات
              حقيقية في V4 ما لم يتوفر مزود فعلي لها.
            </p>
            <div
              style={{
                color: '#FBBF24',
                fontSize: 11,
                fontWeight: 'bold',
                backgroundColor: '#07090E',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #1F2636',
                textAlign: 'center',
              }}
            >
              البيانات غير المتاحة = غير محسوبة
            </div>
          </div>
        </div>
      </div>

      <HunterRiskDesk />

      <div style={{ ...panel, padding: '16px 24px', textAlign: 'center', marginTop: 20 }}>
        <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
          آخر تحديث للرادار:{' '}
          {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('ar-SA') : '—'}
        </p>
      </div>
    </div>
  );
}
