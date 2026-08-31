'use client';

import React, { useEffect, useState } from 'react';
import AlertCenter from '@/components/AlertCenter';

export default function AlertCenterPage() {
  const [alertsData, setAlertsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/alert-center', { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok || !json?.success) {
          throw new Error(json?.error || 'تعذر جلب مركز التنبيهات');
        }

        setAlertsData(json);
        setError('');
      } catch (err) {
        setError(err?.message || 'فشل تحميل مركز التنبيهات');
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);

    return () => clearInterval(interval);
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
        📡 D12 Alert Center - دمج التنبيهات الناتجة من B1-B6 + C7-C10. البيانات الحقيقية فقط.
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#0B0F17',
            border: '1px solid #1F2636',
            borderRadius: '16px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#FCA5A5',
            fontSize: '12px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <AlertCenter alertsData={alertsData} loading={loading} />

      <div style={{
        backgroundColor: '#0B0F17',
        border: '1px solid #1F2636',
        borderRadius: '16px',
        padding: '12px 16px',
        textAlign: 'center',
        marginTop: 20,
      }}>
        <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
          آخر تحديث: {alertsData?.timestamp ? new Date(alertsData.timestamp).toLocaleTimeString('ar-SA') : '—'}
        </p>
        <p style={{ color: '#475569', fontSize: 10, marginTop: 4, margin: 0 }}>
          D12 Alert Center · مركز التنبيهات الموحد
        </p>
      </div>
    </div>
  );
}