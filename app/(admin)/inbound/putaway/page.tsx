'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getPutawayTasks, completePutaway } from '@/app/actions/putaway';
// @ts-ignore
import BarcodeScanner from '@/components/BarcodeScanner';

export default function PutawayPage() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    
    // 로케이션 입력 상태
    const [locations, setLocations] = useState<Record<string, string>>({}); // lineId -> locationCode

    const supabase = createClient();

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // org_id 조회
        const { data: orgs } = await supabase.from('org').select('id').limit(1);
        if (orgs?.[0]) {
            const data = await getPutawayTasks(orgs[0].id);
            setTasks(data);
        }
        setLoading(false);
    };

    const handleLocationScan = (code: string | null) => {
        if (!code || !selectedTask) return;
        // 스캔된 코드를 현재 포커스된 입력창이나 전체 일괄 적용 등 처리
        // 여기서는 예시로 첫 번째 빈 칸에 넣음
        const firstEmpty = selectedTask.lines.find((line: any) => !locations[line.id]);
        if (firstEmpty) {
            setLocations({ ...locations, [firstEmpty.id]: code });
        }
        setScannerOpen(false);
    };

    const handleComplete = async () => {
        if (!selectedTask) return;
        const missing = selectedTask.lines.filter((line: any) => !locations[line.id]);
        if (missing.length > 0) {
            alert('모든 품목에 로케이션을 입력하거나 스캔해주세요.');
            return;
        }
        if (!confirm('적치 작업을 완료하시겠습니까?')) return;
        
        const payload = selectedTask.lines.map((line: any) => ({
            line_id: line.id,
            product_id: line.product_id,
            qty: line.received_qty,
            location_code: locations[line.id]
        }));
        await completePutaway(selectedTask.id, payload);
        alert('적치 완료 처리되었습니다.');
        setSelectedTask(null);
        loadTasks();
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">📦 입고 적치 (Putaway)</h1>

            {loading ? <div>로딩 중...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 대기 목록 */}
                    <div className="bg-white p-4 rounded-xl shadow border">
                        <h2 className="font-bold mb-4 text-gray-700">적치 대기 목록</h2>
                        <div className="space-y-3">
                            {tasks.map(task => (
                                <div 
                                    key={task.id} 
                                    onClick={() => setSelectedTask(task)}
                                    className={`p-3 rounded-lg border cursor-pointer hover:bg-blue-50 ${
                                        selectedTask?.id === task.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200'
                                    }`}
                                >
                                    <div className="font-bold">{task.receipt_no}</div>
                                    <div className="text-sm text-gray-500">{new Date(task.confirmed_at).toLocaleDateString()} 완료건</div>
                                </div>
                            ))}
                            {tasks.length === 0 && <div className="text-gray-400 text-center py-4">대기 중인 작업이 없습니다.</div>}
                        </div>
                    </div>

                    {/* 작업 상세 */}
                    <div className="bg-white p-4 rounded-xl shadow border">
                        {selectedTask ? (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="font-bold text-lg">{selectedTask.receipt_no}</h2>
                                    <button 
                                        onClick={() => setScannerOpen(true)}
                                        className="bg-gray-800 text-white px-3 py-1 rounded text-sm"
                                    >
                                        📷 로케이션 스캔
                                    </button>
                                </div>
                                
                                <div className="space-y-4 mb-6">
                                    {selectedTask.lines.map((line: any) => (
                                        <div key={line.id} className="p-3 bg-gray-50 rounded border">
                                            <div className="font-medium">{line.product?.name}</div>
                                            <div className="text-sm text-gray-500 mb-2">{line.product?.sku}</div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-blue-600">{line.received_qty}개</span>
                                                <input 
                                                    type="text" 
                                                    placeholder="로케이션 (예: A-01-02)"
                                                    className="border rounded px-2 py-1 text-sm w-32"
                                                    value={locations[line.id] || ''}
                                                    onChange={(e) => setLocations({...locations, [line.id]: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button 
                                    onClick={handleComplete}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700"
                                >
                                    적치 완료 (Complete)
                                </button>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                왼쪽에서 작업을 선택해주세요.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {scannerOpen && (
                <BarcodeScanner 
                    onScan={handleLocationScan}
                    onClose={() => setScannerOpen(false)}
                />
            )}
        </div>
    );
}
