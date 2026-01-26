'use client';

import { MagnifyingGlassIcon, Bars3Icon } from '@heroicons/react/24/outline';
import NotificationCenter from './NotificationCenter';
import { useLayout } from './LayoutWrapper';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { toggleSidebar } = useLayout();

  // onMenuClick이 전달되면 그것을 사용하고, 아니면 LayoutContext의 toggleSidebar 사용
  const handleMenuClick = onMenuClick || toggleSidebar;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8 shadow-sm">
      <div className="flex items-center gap-3">
        {/* 모바일 햄버거 메뉴 */}
        <button
          onClick={handleMenuClick}
          className="lg:hidden text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition active:bg-gray-200"
          aria-label="메뉴 열기"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 truncate max-w-[200px] lg:max-w-none">{title}</h2>
      </div>
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="검색..."
            className="w-48 lg:w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        
        {/* 알림 센터 */}
        <NotificationCenter />
      </div>
    </header>
  );
}

