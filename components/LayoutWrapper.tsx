'use client';

import { useState, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
});

export const useLayout = () => useContext(LayoutContext);

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // 사이드바를 숨길 경로들 (홈페이지, 포털, 로그인, 견적 페이지)
  const noSidebarPaths = ['/', '/portal', '/login', '/quote-request', '/quote-request-international'];
  const shouldShowSidebar = !noSidebarPaths.includes(pathname);

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, toggleSidebar }}>
      {shouldShowSidebar ? (
        // WMS/관리자 시스템 레이아웃 (사이드바 포함)
        <div className="flex h-screen overflow-hidden bg-gray-100">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          
          <div className="flex-1 flex flex-col overflow-hidden w-full relative">
            {/* 오버레이 (사이드바 열렸을 때 본문 클릭 방지 및 어둡게 처리) - 모바일 전용 */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative w-full">
              {children}
            </div>
          </div>
        </div>
      ) : (
        // 홈페이지/포털 레이아웃 (사이드바 없음)
        <div className="min-h-screen">
          {children}
        </div>
      )}
    </LayoutContext.Provider>
  );
}

