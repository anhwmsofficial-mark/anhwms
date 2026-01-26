'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPutawayTasks, completePutaway, getLocations } from '@/app/actions/putaway';
import { MagnifyingGlassIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function PutawayPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  
  // Location Selection
  const [locationSearch, setLocationSearch] = useState('');
  const [locations, setLocations] = useState<any[]>([]);
  const [targetLocation, setTargetLocation] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const data = await getPutawayTasks();
    setTasks(data || []);
    setLoading(false);
  };

  const handleSelectTask = (task: any) => {
    setSelectedTask(task);
    setTargetLocation(null);
    setLocationSearch('');
    fetchLocations(task.warehouse_id, '');
  };

  const fetchLocations = async (whId: string, search: string) => {
    const data = await getLocations(whId, search);
    setLocations(data || []);
  };

  const handleLocationSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocationSearch(val);
    if (selectedTask) {
        fetchLocations(selectedTask.warehouse_id, val);
    }
  };

  const handleComplete = async () => {
    if (!selectedTask || !targetLocation) return;
    
    if (!confirm(`${targetLocation.code} 로케이션에 ${selectedTask.qty_expected}개를 적치하시겠습니까?`)) return;

    setProcessing(true);
    const result = await completePutaway(selectedTask.id, selectedTask.qty_expected, targetLocation.id);
    setProcessing(false);

    if (result.error) {
        alert(result.error);
    } else {
        alert('적치 완료!');
        setSelectedTask(null);
        fetchTasks();
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">📦 적치 작업 (Putaway)</h1>
            <p className="text-sm text-gray-500">입고 완료된 물품을 보관 로케이션으로 이동시킵니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-4">
            {loading ? (
                <div className="text-center py-10 text-gray-500">로딩 중...</div>
            ) : tasks.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-300 text-gray-500">
                    할당된 적치 작업이 없습니다.
                </div>
            ) : (
                tasks.map(task => (
                    <div 
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
                            selectedTask?.id === task.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                {task.receipt?.receipt_no}
                            </span>
                            <span className={`text-xs font-bold ${
                                task.status === 'COMPLETED' ? 'text-green-600' : 'text-orange-600'
                            }`}>
                                {task.status}
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-900">{task.product?.name}</h3>
                        <div className="text-sm text-gray-500 font-mono mb-2">{task.product?.sku}</div>
                        
                        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                            <div className="text-sm">
                                <span className="text-gray-500">수량: </span>
                                <span className="font-bold text-gray-900">{task.qty_expected}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-500 gap-2">
                                <span>입고장</span>
                                <ArrowRightIcon className="w-4 h-4" />
                                <span className={task.to_location ? 'text-blue-600 font-bold' : 'text-gray-400'}>
                                    {task.to_location?.code || '미지정'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Action Panel (Mobile: Bottom Sheet / Desktop: Sticky Side) */}
        <div className={`
            fixed inset-x-0 bottom-0 z-50 bg-white p-4 shadow-xl border-t border-gray-200 lg:static lg:block lg:shadow-none lg:border-none lg:bg-transparent lg:p-0
            ${!selectedTask ? 'hidden lg:block' : 'block'}
        `}>
            {selectedTask ? (
                <div className="bg-white lg:rounded-xl lg:shadow-sm lg:border lg:border-gray-200 p-4 lg:p-6 h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 lg:hidden">
                        <h3 className="font-bold text-lg">적치 처리</h3>
                        <button onClick={() => setSelectedTask(null)} className="text-gray-500">&times;</button>
                    </div>

                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-gray-500 mb-2">대상 물품</h4>
                        <div className="text-lg font-bold text-gray-900">{selectedTask.product?.name}</div>
                        <div className="text-sm text-gray-600">{selectedTask.product?.sku}</div>
                        <div className="mt-2 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold">
                            {selectedTask.qty_expected} EA
                        </div>
                    </div>

                    <div className="mb-6 flex-1">
                        <h4 className="text-sm font-bold text-gray-500 mb-2">로케이션 선택</h4>
                        <div className="relative mb-3">
                            <input 
                                type="text" 
                                placeholder="로케이션 검색 (예: A-01)" 
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500"
                                value={locationSearch}
                                onChange={handleLocationSearch}
                            />
                            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                            {locations.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => setTargetLocation(loc)}
                                    className={`p-3 rounded-lg border text-left transition-all ${
                                        targetLocation?.id === loc.id 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="font-bold text-sm">{loc.code}</div>
                                    <div className={`text-xs ${targetLocation?.id === loc.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {loc.type}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleComplete}
                        disabled={!targetLocation || processing}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? '처리 중...' : '적치 완료 (Confirm)'}
                    </button>
                </div>
            ) : (
                <div className="hidden lg:flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                    좌측 목록에서 작업을 선택해주세요.
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
