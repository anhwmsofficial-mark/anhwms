'use client';

import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pagination.limit));
      if (actionType) params.set('action', actionType);
      if (resourceType) params.set('resource', resourceType);
      if (actorId) params.set('actorId', actorId);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || '감사 로그 조회 실패');
      }

      setLogs(payload.data || []);
      if (payload.pagination) {
        setPagination((prev) => ({ ...prev, ...payload.pagination }));
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || '감사 로그를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionType, resourceType, actorId, from, to]);

  useEffect(() => {
    setPage(1);
  }, [actionType, resourceType, actorId, from, to]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운영/감사 로그</h1>
        <p className="text-sm text-gray-500 mt-1">운영 변경 이력을 조회합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액터</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">리소스</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(log.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{log.actor_id || '-'}</div>
                    <div className="text-xs text-gray-400">{log.actor_role || '-'}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{log.action_type}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{log.resource_type}</div>
                    <div className="text-xs text-gray-400">{log.resource_id || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{log.reason || '-'}</td>
                </tr>
              ))
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
