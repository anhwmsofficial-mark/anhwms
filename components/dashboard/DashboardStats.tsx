import { 
  ClipboardDocumentCheckIcon, 
  TruckIcon, 
  ExclamationTriangleIcon,
  ArchiveBoxArrowDownIcon
} from '@heroicons/react/24/outline';

interface StatCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  type?: 'neutral' | 'warning' | 'success' | 'danger';
  icon?: any;
}

export function StatCard({ title, value, subValue, type = 'neutral', icon: Icon }: StatCardProps) {
  const colors = {
    neutral: 'bg-white border-gray-200 text-gray-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };

  const iconColors = {
    neutral: 'text-gray-400 bg-gray-100',
    warning: 'text-yellow-600 bg-yellow-100',
    success: 'text-green-600 bg-green-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${colors[type]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
          {subValue && <p className="text-xs mt-1 opacity-70">{subValue}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${iconColors[type]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  stats: {
    todayOrders: number;
    pendingShipments: number;
    pendingInbounds: number;
    lowStockItems: number;
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="오늘의 주문"
        value={stats.todayOrders}
        subValue="실시간 접수 현황"
        icon={ClipboardDocumentCheckIcon}
      />
      <StatCard
        title="출고 대기"
        value={stats.pendingShipments}
        subValue="즉시 처리 필요"
        type={stats.pendingShipments > 50 ? 'warning' : 'neutral'}
        icon={TruckIcon}
      />
      <StatCard
        title="입고 예정"
        value={stats.pendingInbounds}
        subValue="도착 대기 중"
        icon={ArchiveBoxArrowDownIcon}
      />
      <StatCard
        title="재고 부족 알림"
        value={stats.lowStockItems}
        subValue="발주 필요 품목"
        type={stats.lowStockItems > 0 ? 'danger' : 'success'}
        icon={ExclamationTriangleIcon}
      />
    </div>
  );
}

