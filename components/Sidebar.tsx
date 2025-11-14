'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  CubeIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon, 
  UsersIcon, 
  UserCircleIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  QrCodeIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  XMarkIcon,
  BriefcaseIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

const navigation = [
  { name: '대시보드', href: '/', icon: HomeIcon },
  { name: '👨‍💼 관리자 모드', href: '/admin', icon: ShieldCheckIcon, badge: 'ADMIN' },
  { name: '📊 관리팀', href: '/management', icon: BriefcaseIcon, badge: 'NEW' },
  { name: '⚙️ 운영팀', href: '/operations', icon: WrenchScrewdriverIcon, badge: 'NEW' },
  { name: 'AI CS 통합', href: '/cs', icon: ChatBubbleLeftRightIcon, badge: 'AI' },
  { name: '글로벌 풀필먼트', href: '/global-fulfillment', icon: GlobeAltIcon, badge: 'NEW' },
  { name: '주문업로드&배송연동', href: '/orders', icon: DocumentTextIcon, badge: 'NEW' },
  { name: '🔍 스캐너 테스트', href: '/scanner-test', icon: QrCodeIcon, badge: 'TEST' },
  { name: '재고 관리', href: '/inventory', icon: CubeIcon },
  { name: '입고 관리', href: '/inbound', icon: ArrowDownTrayIcon },
  { name: '출고 관리', href: '/outbound', icon: ArrowUpTrayIcon },
  { name: '거래처 관리', href: '/partners', icon: UsersIcon },
  { name: '사용자 관리', href: '/users', icon: UserCircleIcon },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* 사이드바 */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex h-screen w-64 flex-col bg-blue-600
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-blue-700">
        <h1 className="text-2xl font-bold text-white">ANH WMS</h1>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={onClose}
          className="lg:hidden text-white hover:bg-blue-700 p-2 rounded-lg transition"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isAdmin = item.badge === 'ADMIN';
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors
                ${
                  isActive && isAdmin
                    ? 'bg-red-600 text-white shadow-lg'
                    : isActive
                    ? 'bg-blue-700 text-white'
                    : isAdmin
                    ? 'text-red-200 hover:bg-red-600 hover:text-white'
                    : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.name}
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  isAdmin ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-blue-700 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">관리자</p>
            <p className="text-xs text-blue-200">admin@anhwms.com</p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

