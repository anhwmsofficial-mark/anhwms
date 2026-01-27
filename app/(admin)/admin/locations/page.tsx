'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function AdminLocationsPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    code: '',
    type: 'STORAGE',
    zone: '',
    aisle: '',
    rack: '',
    shelf: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) fetchLocations();
  }, [selectedWarehouseId]);

  const fetchWarehouses = async () => {
    const res = await fetch('/api/admin/warehouses?status=ACTIVE&limit=2000');
    const json = await res.json();
    if (res.ok) {
      setWarehouses(json.data || []);
      if (json.data?.length) setSelectedWarehouseId(json.data[0].id);
    }
  };

  const fetchLocations = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/locations?warehouseId=${selectedWarehouseId}&status=ACTIVE`);
    const json = await res.json();
    if (res.ok) setLocations(json.data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!selectedWarehouseId || !form.code) return;
    const res = await fetch('/api/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse_id: selectedWarehouseId, ...form }),
    });
    if (res.ok) {
      setForm({ code: '', type: 'STORAGE', zone: '', aisle: '', rack: '', shelf: '', status: 'ACTIVE' });
      fetchLocations();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('로케이션을 비활성 처리하시겠습니까?')) return;
    const res = await fetch(`/api/admin/locations/${id}`, { method: 'DELETE' });
    if (res.ok) fetchLocations();
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="로케이션 관리" />
      <main className="flex-1 p-8 overflow-y-auto">
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
