import Link from 'next/link';
import {
  ArchiveBoxIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const quickLinks = [
  {
    title: '주문 관리',
    description: '주문 접수 및 처리 현황을 확인합니다.',
    href: '/portal/orders',
    icon: ClipboardDocumentListIcon,
  },
  {
    title: '재고 조회',
    description: '상품별 가용 재고와 보관 위치를 확인합니다.',
    href: '/portal/inventory',
    icon: ArchiveBoxIcon,
  },
  {
    title: '설정',
    description: '파트너 포털 기본 설정을 관리합니다.',
    href: '/portal/settings',
    icon: Cog6ToothIcon,
  },
];

export default function PartnerDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">파트너 대시보드</h1>
        <p className="mt-2 text-sm text-gray-600">
          주문, 재고, 설정 메뉴로 빠르게 이동할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            <item.icon className="h-8 w-8 text-blue-600" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">{item.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
