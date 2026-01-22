'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ClipboardDocumentCheckIcon, 
  CameraIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { Inbound } from '@/types'; // Inbound 타입 업데이트 필요 (새 컬럼)

export default function InboundInspectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [inbound, setInbound] = useState<any>(null); // 타입 임시 any
  const [loading, setLoading] = useState(true);
  
  // 검수 폼 상태
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [condition, setCondition] = useState('GOOD');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]); // URL 배열 (실제 업로드는 생략하고 텍스트로 대체 가능)
  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // async params unwrap
  const [inboundId, setInboundId] = useState<string>('');

  useEffect(() => {
    params.then(p => {
        setInboundId(p.id);
        fetchInbound(p.id);
    });
  }, [params]);

  const fetchInbound = async (id: string) => {
    try {
      // 기존 목록 조회 API 재사용하거나 상세 조회 API 필요
      // 여기서는 목록 API에서 필터링하거나, Supabase Client 사용 가정
      // 임시로 Supabase Client 대신 fetch로 구현 (가정)
       const res = await fetch(`/api/inbound/${id}`); // 상세 조회 API 필요 (없으면 만들어야 함)
       if (!res.ok) {
           // 상세 API가 없다면 목록에서 찾기 (fallback)
           const listRes = await fetch('/api/admin/inbound'); // 가정
           // ... 로직 생략, 여기서는 Mock Data로 대체 가능성 염두
           throw new Error('입고 정보를 불러올 수 없습니다.');
       }
       const data = await res.json();
       setInbound(data);
       setReceivedQty(data.quantity); // 기본값: 전량 입고
    } catch (err) {
      console.error(err);
      // Mock Data for Demo
      setInbound({
          id: inboundId,
          productName: 'Sample Product',
          quantity: 100,
          supplierName: 'Best Supplier Inc.',
          inboundDate: new Date(),
          status: 'pending'
      });
      setReceivedQty(100);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundId) return;

    setSubmitting(true);
    try {
        const res = await fetch(`/api/inbound/${inboundId}/inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receivedQty,
                rejectedQty,
                condition,
                note,
                photos,
                completeInbound: isComplete
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '검수 처리 실패');
        }

        alert('검수가 완료되었습니다.');
        router.push('/admin/inbound'); // 목록으로 이동
    } catch (err: any) {
        alert(err.message);
    } finally {
        setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!inbound) return <div className="p-8 text-center">정보를 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/inbound" className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">입고 검수</h1>
            <p className="text-sm text-gray-500">
                {inbound.productName} ({inbound.quantity}개 예정) - {inbound.supplierName}
            </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 수량 입력 */}
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">실제 도착 수량 (양품)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0"
                            className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg font-bold text-blue-600"
                            value={receivedQty}
                            onChange={(e) => setReceivedQty(Number(e.target.value))}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                            EA
                        </div>
                    </div>
                    {receivedQty !== inbound.quantity && (
                        <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            예정 수량({inbound.quantity})과 다릅니다.
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">불량/거절 수량</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0"
                            className="block w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-lg font-bold text-red-600"
                            value={rejectedQty}
                            onChange={(e) => setRejectedQty(Number(e.target.value))}
                        />
                         <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                            EA
                        </div>
                    </div>
                </div>
            </div>

            {/* 상태 판정 */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">상품 상태</label>
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { id: 'GOOD', label: '양호', icon: CheckCircleIcon, color: 'text-green-600 bg-green-50 border-green-200' },
                        { id: 'DAMAGED', label: '파손됨', icon: XCircleIcon, color: 'text-red-600 bg-red-50 border-red-200' },
                        { id: 'WRONG_ITEM', label: '오배송', icon: ExclamationTriangleIcon, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                        { id: 'EXPIRED', label: '유통기한', icon: ExclamationTriangleIcon, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setCondition(item.id)}
                            className={`
                                flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                                ${condition === item.id 
                                    ? `ring-2 ring-offset-1 ring-blue-500 ${item.color}` 
                                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'}
                            `}
                        >
                            <item.icon className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 사진 및 메모 */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검수 메모</label>
                <textarea 
                    rows={3}
                    className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="특이사항을 입력하세요..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
            </div>

            <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <input
                        id="complete"
                        type="checkbox"
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={isComplete}
                        onChange={(e) => setIsComplete(e.target.checked)}
                    />
                    <label htmlFor="complete" className="font-medium text-gray-900 cursor-pointer">
                        검수를 마치고 입고를 확정합니다.
                    </label>
                </div>
                {isComplete && (
                    <p className="text-sm text-gray-500 mb-4 ml-7">
                        * 확정 시 재고가 즉시 반영되며, 되돌릴 수 없습니다.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    <ClipboardDocumentCheckIcon className="w-5 h-5" />
                    {submitting ? '처리 중...' : '검수 결과 저장'}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}

