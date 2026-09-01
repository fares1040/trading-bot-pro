'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { colors, panelStyle } from '@/components/ui/DesignTokens';

const panel = { ...panelStyle };

export default function HomePage() {
  const [riyadhTime, setRiyadhTime] = useState('');
  const [marketStatus, setMarketStatus] = useState('جاري الفحص...');
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hunter, setHunter] = useState(null);
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
      setHunter(json.regime || null);
      setLastUpdate(json.timestamp || new Date().toISOString());
    } catch (err) {
      console.error('Dashboard load error:', err);
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
            <div style={{ fontSize: 26, fontWeight: 900, color: '#F8FAFC', marginTop: 8 }}>
              {hunter.count ?? hunter.radarCount ?? '—'}
            </div>
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <Link
          href="/command-center"
          style={{
            ...panel,
            padding: '24px',
            textDecoration: 'none',
            display: 'block',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#38BDF8'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1F2636'}
        >
          <div style={{ color: '#38BDF8', fontSize: 10, fontWeight: 900, marginBottom: 8 }}>
            COMMAND CENTER
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#F8FAFC', margin: '0 0 8px 0' }}>
            🎯 مركز الفرص
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
            رادار الفرص المتاحة مع التصفية والتصنيف. انقر لفتح مركز التحكم.
          </p>
          <div style={{ marginTop: 12, color: '#38BDF8', fontSize: 11, fontWeight: 700 }}>
            فتح ➔
          </div>
        </Link>

        <Link
          href="/analytics"
          style={{
            ...panel,
            padding: '24px',
            textDecoration: 'none',
            display: 'block',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#A78BFA'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1F2636'}
        >
          <div style={{ color: '#A78BFA', fontSize: 10, fontWeight: 900, marginBottom: 8 }}>
            ANALYTICS
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#F8FAFC', margin: '0 0 8px 0' }}>
            📊 التحليلات
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
            تحليلات شاملة للرادار والمؤشرات والأسواق.
          </p>
          <div style={{ marginTop: 12, color: '#A78BFA', fontSize: 11, fontWeight: 700 }}>
            فتح ➔
          </div>
        </Link>

        <Link
          href="/alert-center"
          style={{
            ...panel,
            padding: '24px',
            textDecoration: 'none',
            display: 'block',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#EC4899'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1F2636'}
        >
          <div style={{ color: '#EC4899', fontSize: 10, fontWeight: 900, marginBottom: 8 }}>
            ALERT CENTER
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#F8FAFC', margin: '0 0 8px 0' }}>
            🔔 التنبيهات
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
            مركز التنبيهات والتنبيهات الجاهزة للتليجرام.
          </p>
          <div style={{ marginTop: 12, color: '#EC4899', fontSize: 11, fontWeight: 700 }}>
            فتح ➔
          </div>
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <Link
          href="/command-center"
          style={{
            ...panel,
            padding: '16px 20px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'background-color 0.15s',
          }}
        >
          <div style={{ fontSize: 24 }}>🎯</div>
          <div>
            <div style={{ color: '#F8FAFC', fontSize: 12, fontWeight: 800 }}>الفرص</div>
            <div style={{ color: '#94A3B8', fontSize: 10 }}>Command Center</div>
          </div>
        </Link>

        <Link
          href="/analytics"
          style={{
            ...panel,
            padding: '16px 20px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>📊</div>
          <div>
            <div style={{ color: '#F8FAFC', fontSize: 12, fontWeight: 800 }}>التحليلات</div>
            <div style={{ color: '#94A3B8', fontSize: 10 }}>Analytics</div>
          </div>
        </Link>

        <Link
          href="/alert-center"
          style={{
            ...panel,
            padding: '16px 20px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>🔔</div>
          <div>
            <div style={{ color: '#F8FAFC', fontSize: 12, fontWeight: 800 }}>التنبيهات</div>
            <div style={{ color: '#94A3B8', fontSize: 10 }}>Alert Center</div>
          </div>
        </Link>

        <Link
          href="/command-center"
          style={{
            ...panel,
            padding: '16px 20px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>📋</div>
          <div>
            <div style={{ color: '#F8FAFC', fontSize: 12, fontWeight: 800 }}>القائمة</div>
            <div style={{ color: '#94A3B8', fontSize: 10 }}>Watchlist</div>
          </div>
        </Link>
      </div>

      <div style={{ ...panel, padding: '16px 24px', textAlign: 'center', marginTop: 20 }}>
        <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
          آخر تحديث للرادار:{' '}
          {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('ar-SA') : '—'}
        </p>
      </div>
    </div>
  );
}