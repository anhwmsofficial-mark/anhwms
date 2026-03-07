'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  createLocationAction,
  deactivateLocationAction,
  listLocationsAction,
} from '@/app/actions/admin/locations';
import { listWarehousesAction } from '@/app/actions/admin/warehouses';

export default function AdminLocationsPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    type: 'STORAGE',
    zone: '',
    aisle: '',
    rack: '',
    shelf: '',
    status: 'ACTIVE',
  });

  const fetchWarehouses = useCallback(async () => {
    setError(null);
    const result = await listWarehousesAction({ status: 'ACTIVE', limit: 2000 });
    if (result.ok) {
      const rows = result.data.data || [];
      setWarehouses(rows);
      if (rows.length) setSelectedWarehouseId(rows[0].id);
      return;
    }

    setWarehouses([]);
    setSelectedWarehouseId('');
    setError(result.error || '창고 목록을 불러오지 못했습니다.');
  }, []);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listLocationsAction({ warehouseId: selectedWarehouseId, status: 'ACTIVE' });
    if (result.ok) {
      setLocations(result.data.data || []);
      setLoading(false);
      return;
    }

    setLocations([]);
    setError(result.error || '로케이션 목록을 불러오지 못했습니다.');
    setLoading(false);
  }, [selectedWarehouseId]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    if (selectedWarehouseId) fetchLocations();
  }, [selectedWarehouseId, fetchLocations]);

  const handleCreate = async () => {
    if (!selectedWarehouseId || !form.code) return;
    setError(null);
    const result = await createLocationAction({ warehouse_id: selectedWarehouseId, ...form });
    if (result.ok) {
      setForm({ code: '', type: 'STORAGE', zone: '', aisle: '', rack: '', shelf: '', status: 'ACTIVE' });
      fetchLocations();
      return;
    }

    setError(result.error || '로케이션 생성에 실패했습니다.');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('로케이션을 비활성 처리하시겠습니까?')) return;
    setError(null);
    const result = await deactivateLocationAction(id);
    if (result.ok) {
      fetchLocations();
      return;
    }

    setError(result.error || '로케이션 비활성화에 실패했습니다.');
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="로케이션 관리" />
      <main className="flex-1 p-8 overflow-y-auto">
        <InlineErrorAlert
          error={error ? { message: error } : null}
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        />
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">창고</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">로케이션 코드</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="A-1-01-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">구역(Zone)</label>
              <input
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">통로(Aisle)</label>
              <input
                value={form.aisle}
                onChange={(e) => setForm({ ...form, aisle: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">랙(Rack)</label>
              <input
                value={form.rack}
                onChange={(e) => setForm({ ...form, rack: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">셀(Shelf)</label>
              <input
                value={form.shelf}
                onChange={(e) => setForm({ ...form, shelf: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="01"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            로케이션 추가
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b text-sm text-gray-600">
            {loading ? '로딩 중...' : `총 ${locations.length}개`}
          </div>
          <div className="divide-y">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <div>
                  <div className="font-medium">{loc.code}</div>
                  <div className="text-gray-500">
                    {loc.type} · {loc.zone || '-'}-{loc.aisle || '-'}-{loc.rack || '-'}-{loc.shelf || '-'}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(loc.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
            {!loading && locations.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-500">로케이션이 없습니다.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
