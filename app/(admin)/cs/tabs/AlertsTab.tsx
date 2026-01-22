'use client';

import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface CSAlertItem {
  id: string;
  type: string;
  ref?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  message?: string;
  createdAt?: string;
}

const severityStyle: Record<CSAlertItem['severity'], string> = {
  low: 'border-green-400 bg-green-50',
  medium: 'border-yellow-400 bg-yellow-50',
  high: 'border-orange-500 bg-orange-50',
  critical: 'border-red-500 bg-red-50',
};

export default function AlertsTab() {
  const [alerts, setAlerts] = useState<CSAlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cs/alerts');
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '알림 조회에 실패했습니다.' }));
        throw new Error(data.error || '알림 조회에 실패했습니다.');
      }

      const data = await response.json();
      setAlerts(data.items ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '알림 조회 중 오류가 발생했습니다.');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">알림 & 경보</h3>
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            disabled={isLoading}
          >
            <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {isLoading ? '알림을 불러오는 중...' : '현재 활성 알림이 없습니다'}
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 p-4 rounded ${severityStyle[alert.severity]}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="font-medium text-gray-900">{alert.type}</div>
                      <div className="text-sm text-gray-600">
                        {alert.message ?? '세부 메시지 없음'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {alert.ref ? `참조: ${alert.ref} · ` : ''}
                        {alert.createdAt ? new Date(alert.createdAt).toLocaleString('zh-CN') : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 uppercase">
                    {alert.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

