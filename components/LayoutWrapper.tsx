'use client';

import { useState, createContext, useContext } from 'react';
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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, toggleSidebar }}>
      <div className="flex h-screen overflow-hidden bg-gray-100">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

