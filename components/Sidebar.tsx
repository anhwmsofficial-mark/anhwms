'use client';

import { useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessAdmin } from '@/lib/auth/accessPolicy';
import { hasRolePermission, type UserRole } from '@/lib/auth/permissions';
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
  WrenchScrewdriverIcon,
  MapPinIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TruckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  ArrowRightOnRectangleIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

interface SubMenuItem {
  name: string;
  href: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  requiredPermission?: string;
  adminOnly?: boolean;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
  subItems?: SubMenuItem[];
  requiredPermission?: string;
  adminOnly?: boolean;
}

const navigation: NavigationItem[] = [
  { name: '대시보드', href: '/admin', icon: HomeIcon, adminOnly: true },
  { 
    name: '현장운영팀', 
    href: '/operations', 
    icon: WrenchScrewdriverIcon,
    subItems: [
      { name: '현장운영팀', href: '/operations', icon: WrenchScrewdriverIcon },
      { name: '현장입고체크', href: '/operations/field-check', icon: ClipboardDocumentCheckIcon, requiredPermission: 'manage:inventory' },
      { name: '스캐너 테스트', href: '/scanner-test', icon: QrCodeIcon },
    ]
  },
  { 
    name: '운영지원팀', 
    href: '/inbound', 
    icon: ArrowDownTrayIcon,
    subItems: [
      { name: '입고 현황', href: '/inbound', icon: ArrowDownTrayIcon, requiredPermission: 'inventory:count' },
      { name: '적치 작업', href: '/inbound/putaway', icon: ArchiveBoxIcon, requiredPermission: 'manage:inventory' },
      { name: '재고 관리', href: '/inventory', icon: CubeIcon, requiredPermission: 'inventory:count' },
      { name: '물동량 관리', href: '/inventory/volume', icon: DocumentTextIcon, requiredPermission: 'inventory:count' },
      { name: '출고 관리', href: '/outbound', icon: ArrowUpTrayIcon, requiredPermission: 'read:orders' },
    ]
  },
  { 
    name: 'CS관리팀', 
    href: '/orders', 
    icon: ChatBubbleLeftRightIcon,
    subItems: [
      { name: '주문 관리', href: '/orders', icon: DocumentTextIcon, requiredPermission: 'read:orders' },
      { name: '배송 관리', href: '/admin/shipping', icon: TruckIcon, requiredPermission: 'manage:orders' },
      { name: 'AI CS 통합', href: '/cs', icon: ChatBubbleLeftRightIcon, requiredPermission: 'read:orders' },
      { name: 'CS 성과', href: '/admin/cs-performance', icon: ChartBarIcon, requiredPermission: 'view:reports' },
      { name: 'CS 담당', href: '/admin/cs-workers', icon: UserCircleIcon, adminOnly: true },
      { name: '알림 관리', href: '/admin/alerts', icon: ExclamationTriangleIcon, requiredPermission: 'manage:orders' },
    ]
  },
  { 
    name: '사업지원팀', 
    href: '/admin/customers', 
    icon: BriefcaseIcon,
    subItems: [
      { name: '거래처 관리', href: '/admin/customers', icon: UsersIcon, requiredPermission: 'view:customers' },
      { name: '견적 신청 관리', href: '/admin/quote-inquiries', icon: ClipboardDocumentCheckIcon, requiredPermission: 'view:customers' },
      { name: '창고 관리', href: '/admin/warehouses', icon: HomeIcon, adminOnly: true },
      { name: '로케이션 관리', href: '/admin/locations', icon: MapPinIcon, adminOnly: true },
      { name: '다수지 관리', href: '/management/destinations', icon: MapPinIcon },
      { name: '문서 관리', href: '/management/documents', icon: DocumentTextIcon },
    ]
  },
  { 
    name: '글로벌 풀필먼트', 
    href: '/global-fulfillment', 
    icon: GlobeAltIcon,
    subItems: [
      { name: '대시보드', href: '/global-fulfillment', icon: HomeIcon },
      { name: '드롭시핑', href: '/global-fulfillment/drop-shipping', icon: CubeIcon },
      { name: '상품 준비', href: '/global-fulfillment/preparation', icon: ClipboardDocumentCheckIcon },
      { name: '파도 관리', href: '/global-fulfillment/wave-management', icon: ChartBarIcon },
      { name: '2차 정렬', href: '/global-fulfillment/second-sorting', icon: TruckIcon },
      { name: '검증/검사', href: '/global-fulfillment/inspection', icon: ClipboardDocumentCheckIcon },
      { name: '패키지 검증', href: '/global-fulfillment/package-check', icon: CubeIcon },
      { name: '무게 측정', href: '/global-fulfillment/weight-check', icon: ScaleIcon },
      { name: '교환/반품', href: '/global-fulfillment/returns', icon: ArrowUpTrayIcon },
      { name: '이상 처리', href: '/global-fulfillment/exceptions', icon: ExclamationTriangleIcon },
      { name: '마감 시간', href: '/global-fulfillment/cutoff', icon: ClockIcon },
    ]
  },
  { 
    name: '관리자', 
    href: '/admin', 
    icon: ShieldCheckIcon, 
    badge: 'ADMIN',
    adminOnly: true,
    subItems: [
      { name: '대시보드', href: '/admin', icon: HomeIcon, adminOnly: true },
      { name: 'KPI 리포트', href: '/management/kpi', icon: ChartBarIcon, adminOnly: true },
      { name: '사용자 관리', href: '/users', icon: UserCircleIcon, adminOnly: true },
      { name: '시스템 공지', href: '/admin/system-announcements', icon: DocumentTextIcon, adminOnly: true },
      { name: '감사 로그', href: '/admin/audit-logs', icon: DocumentTextIcon, adminOnly: true },
      { name: '시스템설정', href: '/admin/settings', icon: WrenchScrewdriverIcon, adminOnly: true },
    ]
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const isAdminUser = canAccessAdmin(profile);
  const userRole = (profile?.role || 'viewer') as UserRole;

  const canViewNode = (node: { requiredPermission?: string; adminOnly?: boolean }) => {
    if (node.adminOnly && !isAdminUser) return false;
    if (node.requiredPermission && !hasRolePermission(userRole, node.requiredPermission)) return false;
    return true;
  };

  const filteredNavigation = navigation
    .map((item) => {
      if (!canViewNode(item)) return null;
      if (!item.subItems) return item;
      const subItems = item.subItems.filter((subItem) => canViewNode(subItem));
      if (subItems.length === 0) return null;
      return { ...item, subItems };
    })
    .filter((item): item is NavigationItem => Boolean(item));

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  // 현재 경로가 하위 메뉴에 속하면 자동으로 확장
  const isExpanded = (item: NavigationItem) => {
    if (!item.subItems) return false;
    const hasActiveSubItem = item.subItems.some(sub => pathname.startsWith(sub.href));
    return expandedItems.includes(item.name) || hasActiveSubItem;
  };

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
        flex h-screen w-64 flex-col bg-blue-600 shadow-xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-blue-700 bg-blue-700 lg:bg-blue-600">
        <h1 className="text-2xl font-bold text-white">ANH WMS</h1>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={onClose}
          className="lg:hidden text-white hover:bg-blue-600 p-2 rounded-lg transition active:bg-blue-800"
          aria-label="메뉴 닫기"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-transparent">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isAdmin = item.badge === 'ADMIN';
          const expanded = isExpanded(item);
          
          return (
            <div key={item.name}>
              {/* 메인 메뉴 항목 */}
              {item.subItems ? (
                // 하위 메뉴가 있는 경우 - 클릭 시 확장/축소
                <button
                  onClick={() => toggleExpand(item.name)}
                  className={`
                    w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base lg:text-sm font-bold transition-colors
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
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        isAdmin ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    {expanded ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </div>
                </button>
              ) : (
                // 하위 메뉴가 없는 경우 - 일반 링크
                <Link
                  href={item.href}
                  className={`
                    flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-base lg:text-sm font-bold transition-colors
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
                  onClick={onClose}
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
              )}
              
              {/* 하위 메뉴 렌더링 */}
              {item.subItems && expanded && (
                <div className="mt-1 ml-8 space-y-1">
                  {item.subItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    const SubIcon = subItem.icon;
                    
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`
                          flex items-center gap-2 rounded-lg px-3 py-2 text-sm lg:text-xs font-medium transition-colors
                          ${
                            isSubActive
                              ? 'bg-blue-600 text-white'
                              : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                          }
                        `}
                        onClick={onClose}
                      >
                        {SubIcon && <SubIcon className="h-4 w-4" />}
                        {subItem.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-blue-700 p-4">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.display_name || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-blue-200 truncate">{user.email}</p>
              </div>
            </div>
            {profile?.role && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  profile.role === 'admin' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {profile.role === 'admin' ? '관리자' : profile.role === 'manager' ? '매니저' : '운영자'}
                </span>
                {profile.department && (
                  <span className="text-xs text-blue-200">{profile.department}</span>
                )}
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <UserCircleIcon className="h-5 w-5" />
            로그인
          </Link>
        )}
      </div>
      </div>
    </>
  );
}

