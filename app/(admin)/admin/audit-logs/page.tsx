'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const ACTION_TYPES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'VIEW_PII',
  'EXPORT',
  'LOGIN',
  'LOGOUT',
  'APPROVE',
  'REJECT',
  'SYSTEM',
];

const RESOURCE_TYPES = ['orders', 'inventory', 'users', 'partners', 'settings', 'auth', 'system'];

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  reason: string | null;
  created_at: string;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
};

const getActionBadgeClass = (action: string) => {
  if (action === 'CREATE' || action === 'APPROVE') return 'bg-green-100 text-green-700';
  if (action === 'UPDATE') return 'bg-blue-100 text-blue-700';
  if (action === 'DELETE' || action === 'REJECT') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
};

const toDateStartIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const toDateEndIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

const toKstDate = (date: Date) => {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffsetMs).toISOString().slice(0, 10);
};

const getResourceHref = (row: AuditLogRow) => {
  if (!row.resource_id) return null;
  if (row.resource_type === 'orders') return `/admin/orders/${row.resource_id}`;
  if (row.resource_type === 'partners') return `/admin/customers/${row.resource_id}`;
  if (row.resource_type === 'inventory') return '/admin/inventory/adjustment';
  return null;
};

const pretty = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });

  const [actionType, setActionType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [actorId, setActorId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));
      if (actionType) params.set('action', actionType);
      if (resourceType) params.set('resource', resourceType);
      if (actorId) params.set('actorId', actorId);
      if (keyword.trim()) params.set('q', keyword.trim());
      if (from) params.set('from', toDateStartIso(from));
      if (to) params.set('to', toDateEndIso(to));

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || '감사 로그 조회 실패');
      }

      setLogs(payload.data || []);
      if (payload.pagination) {
        setPagination((prev) => ({ ...prev, ...payload.pagination }));
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : '감사 로그를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, pagination.limit, actionType, resourceType, actorId, keyword, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionType, resourceType, actorId, keyword, from, to]);

  const applyRangePreset = (days: number) => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - days + 1);
    setFrom(toKstDate(start));
    setTo(toKstDate(now));
  };

  const clearFilters = () => {
    setActionType('');
    setResourceType('');
    setActorId('');
    setKeyword('');
    setFrom('');
    setTo('');
    setExpandedId(null);
  };

  const exportCurrentRowsToCsv = () => {
    const header = ['created_at', 'actor_id', 'actor_role', 'action_type', 'resource_type', 'resource_id', 'reason'];
    const rows = logs.map((row) =>
      [
        row.created_at,
        row.actor_id || '',
        row.actor_role || '',
        row.action_type,
        row.resource_type,
        row.resource_id || '',
        (row.reason || '').replace(/\n/g, ' '),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운영/감사 로그</h1>
        <p className="text-sm text-gray-500 mt-1">운영 변경 이력을 조회하고 상세 변경값을 확인합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyRangePreset(1)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            오늘
          </button>
          <button
            onClick={() => applyRangePreset(7)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            최근 7일
          </button>
          <button
            onClick={() => applyRangePreset(30)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            최근 30일
          </button>
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            필터 초기화
          </button>
          <button
            onClick={exportCurrentRowsToCsv}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            현재 페이지 CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-gray-500">키워드</label>
            <div className="relative mt-1">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                placeholder="reason/resource_id 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        <div>
          <label className="text-xs text-gray-500">액션</label>
          <select
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          >
            <option value="">전체</option>
            {ACTION_TYPES.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">리소스</label>
          <select
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          >
            <option value="">전체</option>
            {RESOURCE_TYPES.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Actor ID</label>
          <div className="relative mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
              placeholder="actor uuid"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
            />
          </div>
        </div>
          <div>
            <label className="text-xs text-gray-500">시작일</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
        <div>
            <label className="text-xs text-gray-500">종료일</label>
          <input
            type="date"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액터</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">리소스</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사유</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const resourceHref = getResourceHref(log);
                const isOpen = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(log.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{log.actor_id || '-'}</div>
                        <div className="text-xs text-gray-400">{log.actor_role || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getActionBadgeClass(log.action_type)}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{log.resource_type}</div>
                        {resourceHref ? (
                          <Link href={resourceHref} className="text-xs text-blue-600 hover:underline">
                            {log.resource_id || '-'}
                          </Link>
                        ) : (
                          <div className="text-xs text-gray-400">{log.resource_id || '-'}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{log.reason || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId((prev) => (prev === log.id ? null : log.id))}
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs hover:bg-gray-50"
                        >
                          {isOpen ? '닫기' : '열기'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="text-xs font-semibold text-gray-500 mb-2">변경 전(old_value)</div>
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all max-h-72 overflow-auto">
                                {pretty(log.old_value)}
                              </pre>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="text-xs font-semibold text-gray-500 mb-2">변경 후(new_value)</div>
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all max-h-72 overflow-auto">
                                {pretty(log.new_value)}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-4">
                            <span>IP: {log.ip_address || '-'}</span>
                            <span className="truncate">UA: {log.user_agent || '-'}</span>
                            <span>Log ID: {log.id}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        {error && (
          <div className="px-4 py-3 border-t border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          총 {pagination.total.toLocaleString()}건 · {pagination.page}/{pagination.totalPages} 페이지
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            이전
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
