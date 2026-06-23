import { 
  ClipboardDocumentCheckIcon, 
  UsersIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ScaleIcon,
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  type?: 'neutral' | 'warning' | 'success' | 'danger';
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
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
    todayWorkload: number;
    weekWorkload: number;
    monthWorkload: number;
    totalWorkers: number;
    averageWorkers: number;
    totalPrevRemain: number;
    totalTodayProcessed: number;
    totalTodayRemain: number;
    dayChangeRate: number;
    weekChangeRate: number;
    monthChangeRate: number;
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value || 0);
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}%`;
}

function getRateType(value: number): StatCardProps['type'] {
  if (value > 0) return 'success';
  if (value < 0) return 'warning';
  return 'neutral';
}

function getRateIcon(value: number) {
  return value < 0 ? ArrowTrendingDownIcon : ArrowTrendingUpIcon;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards: StatCardProps[] = [
    {
      title: '오늘 작업량',
      value: formatNumber(stats.todayWorkload),
      subValue: '금일 작업일지 처리 수량',
      icon: ClipboardDocumentCheckIcon,
    },
    {
      title: '이번주 작업량',
      value: formatNumber(stats.weekWorkload),
      subValue: '주간 누적 처리 수량',
      icon: CalendarDaysIcon,
    },
    {
      title: '이번달 작업량',
      value: formatNumber(stats.monthWorkload),
      subValue: '월간 누적 처리 수량',
      icon: ChartBarIcon,
    },
    {
      title: '총 근무인원',
      value: formatNumber(stats.totalWorkers),
      subValue: '오늘 등록된 근무인원',
      icon: UsersIcon,
    },
    {
      title: '평균 근무인원',
      value: formatNumber(stats.averageWorkers),
      subValue: '이번달 작업일지 평균',
      icon: UsersIcon,
    },
    {
      title: '총 전일잔여',
      value: formatNumber(stats.totalPrevRemain),
      subValue: '오늘 기준 전일잔여 합계',
      icon: ArchiveBoxIcon,
    },
    {
      title: '총 금일작업',
      value: formatNumber(stats.totalTodayProcessed),
      subValue: '오늘 처리 수량 합계',
      icon: ArchiveBoxArrowDownIcon,
    },
    {
      title: '총 금일잔여',
      value: formatNumber(stats.totalTodayRemain),
      subValue: '오늘 남은 수량 합계',
      icon: ScaleIcon,
    },
    {
      title: '전일 대비',
      value: formatPercent(stats.dayChangeRate),
      subValue: '오늘 작업량 증감률',
      type: getRateType(stats.dayChangeRate),
      icon: getRateIcon(stats.dayChangeRate),
    },
    {
      title: '전주 대비',
      value: formatPercent(stats.weekChangeRate),
      subValue: '이번주 작업량 증감률',
      type: getRateType(stats.weekChangeRate),
      icon: getRateIcon(stats.weekChangeRate),
    },
    {
      title: '전월 대비',
      value: formatPercent(stats.monthChangeRate),
      subValue: '이번달 작업량 증감률',
      type: getRateType(stats.monthChangeRate),
      icon: getRateIcon(stats.monthChangeRate),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}

