'use client';

import React, { useEffect, useState } from 'react';
import CommandCenter from '@/components/CommandCenter';

export default function CommandCenterPage() {
  const [commandCenterData, setCommandCenterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCommandCenter = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/command-center', { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load Command Center');
        }

        setCommandCenterData(json);
        setError('');
      } catch (err) {
        setError(err?.message || 'Failed to load Command Center data');
      } finally {
        setLoading(false);
      }
    };

    loadCommandCenter();
    const interval = setInterval(loadCommandCenter, 60000);

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
        📡 D11 Command Center يجمع البيانات من C7, C8, C9, C10. لا توجد أرقام مفقودة. البيانات الحقيقية فقط.
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

      <CommandCenter commandCenterData={commandCenterData} loading={loading} />

<div style={{
        backgroundColor: '#0B0F17',
        border: '1px solid #1F2636',
        borderRadius: '16px',
        padding: '12px 16px',
        textAlign: 'center',
        marginTop: 20,
      }}>
        <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>
          آخر تحديث: {commandCenterData?.timestamp ? new Date(commandCenterData.timestamp).toLocaleTimeString('ar-SA') : '—'}
        </p>
        <p style={{ color: '#475569', fontSize: 10, marginTop: 4, margin: 0 }}>
          D11 Command Center · تحتاج موافقة من C7, C8, C9, C10
        </p>
      </div>
    </div>
  );
}