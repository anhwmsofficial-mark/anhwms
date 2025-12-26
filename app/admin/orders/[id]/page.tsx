'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon, 
  ExclamationTriangleIcon,
  TruckIcon,
  ArchiveBoxIcon,
  UserIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { Order } from '@/types';
import { getOrder } from '@/lib/api/orders'; // 기존 API 재사용 (상세조회) -> CSR로 다시 구현하거나 API Route 호출

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'HOLD' | 'CANCEL' | 'UNHOLD' | null>(null);
  const [reason, setReason] = useState('');

  // async params unwrap
  const [orderId, setOrderId] = useState<string>('');
  
  useEffect(() => {
    params.then(p => {
        setOrderId(p.id);
        fetchOrder(p.id);
    });
  }, [params]);

  const fetchOrder = async (id: string) => {
    try {
      // API Route를 통해 호출하는 것이 좋음 (RBAC 적용 등)
      // 현재는 lib 함수 직접 호출 시 Supabase 클라이언트 문제 발생 가능 (브라우저 vs 서버)
      // 따라서 API Route를 하나 만들거나, Client Side Supabase 사용.
      // 여기서는 간단히 Client Side Supabase 대신, API Route를 사용하는 패턴으로 변경 권장하나
      // 기존 lib/api/orders.ts가 클라이언트용으로 작성되었는지 확인 필요.
      // lib/supabase.ts가 getEnv()를 사용하므로 클라이언트에서도 동작 가능.
      
      const data = await getOrder(id);
      setOrder(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!orderId || !modalType) return;
    
    setActionLoading(true);
    try {
      let body: any = { reason };
      
      if (modalType === 'HOLD') {
        body.onHold = true;
      } else if (modalType === 'UNHOLD') {
        body.onHold = false;
      } else if (modalType === 'CANCEL') {
        body.status = 'CANCELLED';
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '요청 처리 실패');
      }

      // 성공 시 리로드
      await fetchOrder(orderId);
      closeModal();
      alert('처리가 완료되었습니다.'); // Toast로 교체 권장
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (type: 'HOLD' | 'CANCEL' | 'UNHOLD') => {
    setModalType(type);
    setReason('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (error) return <div className="p-8 text-center text-red-600">에러: {error}</div>;
  if (!order) return <div className="p-8 text-center">주문을 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 상단 네비게이션 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/orders" className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            주문 #{order.orderNo}
            {order.onHold && (
              <span className="px-2 py-0.5 rounded text-sm bg-red-100 text-red-800 border border-red-200">
                ⛔ 보류됨
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">
            {order.createdAt.toLocaleString()} · {order.status}
          </p>
        </div>
        <div className="ml-auto flex gap-3">
            {/* 액션 버튼들 */}
            {order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && (
                <>
                    {order.onHold ? (
                        <button
                            onClick={() => openModal('UNHOLD')}
                            className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 font-medium transition"
                        >
                            보류 해제
                        </button>
                    ) : (
                        <button
                            onClick={() => openModal('HOLD')}
                            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium transition"
                        >
                            ⛔ 출고 보류
                        </button>
                    )}
                    <button
                        onClick={() => openModal('CANCEL')}
                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
                    >
                        주문 취소
                    </button>
                </>
            )}
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">
                수정 저장
            </button>
        </div>
      </div>

      {/* 보류 사유 표시 */}
      {order.onHold && order.holdReason && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <div className="flex">
                  <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                      <p className="text-sm text-red-700">
                          <strong>보류 사유:</strong> {order.holdReason}
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 주문 정보 */}
        <div className="lg:col-span-2 space-y-6">
            {/* 수취인 정보 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-gray-500" />
                    수취인 정보
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-500">이름</label>
                        <div className="mt-1 text-gray-900">{order.receiver?.name}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">연락처</label>
                        <div className="mt-1 text-gray-900">{order.receiver?.phone}</div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" /> 주소 ({order.countryCode})
                        </label>
                        <div className="mt-1 text-gray-900">
                            [{order.receiver?.zip}] {order.receiver?.address1} {order.receiver?.address2}
                        </div>
                    </div>
                </div>
            </div>

            {/* 주문 상품 정보 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                 <h2 className="text-lg font-bold text-gray-900 mb-4">주문 상품</h2>
                 <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">수량</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">상태</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                             {/* 단일 상품 구조이므로 하나만 표시 (추후 OrderItem 테이블 분리 시 map) */}
                            <tr>
                                <td className="px-4 py-4 text-sm text-gray-900">{order.productName}</td>
                                <td className="px-4 py-4 text-sm text-gray-900 text-right">1</td>
                                <td className="px-4 py-4 text-sm text-gray-500 text-right">{order.status}</td>
                            </tr>
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>

        {/* 우측: 배송 및 기타 */}
        <div className="space-y-6">
             {/* 배송 정보 */}
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TruckIcon className="w-5 h-5 text-gray-500" />
                    배송 정보
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-500">배송사</label>
                        <div className="mt-1 font-medium">{order.logisticsCompany || '미지정'}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">송장번호</label>
                        <div className="mt-1 font-mono bg-gray-50 p-2 rounded text-center">
                            {order.trackingNo || '발급 전'}
                        </div>
                    </div>
                </div>
             </div>

             {/* 관리자 메모 */}
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">관리자 메모</h2>
                <textarea 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    rows={4}
                    defaultValue={order.remark}
                    placeholder="특이사항을 입력하세요..."
                />
             </div>
        </div>
      </div>

      {/* 상태 변경 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeModal}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                      modalType === 'HOLD' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    <ExclamationTriangleIcon className={`h-6 w-6 ${
                        modalType === 'HOLD' ? 'text-red-600' : 'text-yellow-600'
                    }`} aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      {modalType === 'HOLD' && '주문 출고 보류'}
                      {modalType === 'UNHOLD' && '보류 해제'}
                      {modalType === 'CANCEL' && '주문 취소'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {modalType === 'HOLD' && '출고를 중단하고 보류 상태로 변경합니다. 사유를 입력해주세요.'}
                        {modalType === 'UNHOLD' && '보류를 해제하고 출고 프로세스를 재개합니다.'}
                        {modalType === 'CANCEL' && '주문을 취소합니다. 이 작업은 되돌릴 수 없습니다.'}
                      </p>
                      
                      <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">사유 입력 (필수)</label>
                          <input 
                            type="text" 
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="변경 사유를 입력하세요"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                    type="button" 
                    disabled={!reason.trim() || actionLoading}
                    onClick={handleStatusChange}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                        modalType === 'UNHOLD' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    }`}
                >
                  {actionLoading ? '처리 중...' : '확인'}
                </button>
                <button 
                    type="button" 
                    onClick={closeModal}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

