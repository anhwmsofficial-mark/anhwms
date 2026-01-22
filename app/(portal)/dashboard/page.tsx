import { createClient } from '@/utils/supabase/server';
import { 
  ShoppingCartIcon, 
  TruckIcon, 
  ArchiveBoxIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';

export default async function PartnerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 파트너 ID 조회
  // 실제로는 user_meta_data 또는 users 테이블 조인 필요
  // 여기서는 MVP로 본인 주문(user_id) 조회로 대체하거나 RLS 믿고 전체 조회
  
  // 1. 주문 현황
  const { count: activeOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['CREATED', 'APPROVED', 'ALLOCATED', 'PICKED', 'PACKED']);

  const { count: shippedToday } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'SHIPPED')
    .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString());

  // 2. 재고 현황
  // products 테이블에 RLS가 걸려있다고 가정
  const { count: lowStock } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .lt('quantity', 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">진행 중인 주문</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{activeOrders || 0}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingCartIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">오늘 출고 완료</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{shippedToday || 0}</p>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <TruckIcon className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">재고 부족 품목</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{lowStock || 0}</p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <ExclamationCircleIcon className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 최근 주문 목록 (Placeholder) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">최근 주문 내역</h3>
        <div className="text-center py-8 text-gray-500">
          <ArchiveBoxIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>최근 주문 내역이 없습니다.</p>
        </div>
      </div>
    </div>
  );
}

