import { createClient } from '@/utils/supabase/server';
import { 
  ArrowPathIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  TruckIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getDashboardStats } from '@/lib/api/dashboard';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운영 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString()} 기준 실시간 현황입니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <ShoppingCartIcon className="w-4 h-4" />
            주문 관리
          </Link>
          <Link
             href="/admin/inbound"
             className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
             <ArchiveBoxIcon className="w-4 h-4" />
             입고 관리
          </Link>
        </div>
      </div>

      {/* 핵심 지표 (Stats) */}
      <DashboardStats stats={stats} />

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 빠른 메뉴 및 차트 (Placeholder) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 작업 현황판 (To-Do) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-gray-500" />
              주간 처리량 추이
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <span className="text-gray-400">차트 영역 (준비 중)</span>
            </div>
          </div>

          {/* 빠른 바로가기 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: '재고 실사', href: '/admin/inventory/adjustment', icon: ArchiveBoxIcon },
              { name: '배송 조회', href: '/admin/shipping', icon: TruckIcon },
              { name: '주문 반품', href: '/admin/orders?status=RETURN_REQ', icon: ArrowPathIcon },
              { name: '통계 리포트', href: '/admin/reports', icon: ChartBarIcon },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-2 group-hover:bg-blue-100">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 우측: 실시간 로그 */}
        <div className="space-y-6">
          <ActivityFeed activities={stats.recentActivities} />
          
          {/* 시스템 공지 (Placeholder) */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">📢 시스템 점검 안내</h3>
            <p className="text-indigo-100 text-sm mb-4">
              이번 주 토요일 새벽 2시부터 4시까지 정기 서버 점검이 예정되어 있습니다.
            </p>
            <button className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium backdrop-blur-sm transition">
              자세히 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
