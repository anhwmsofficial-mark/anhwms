'use client';

import { useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  QrCodeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import OpsBoard from './tabs/OpsBoard';
import MyTasksTab from './tabs/MyTasksTab';
import PackingTab from './tabs/PackingTab';
import ScanTab from './tabs/ScanTab';

type TabType = 'ops-board' | 'my-tasks' | 'packing' | 'scan';

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('ops-board');
  const { toggleSidebar } = useLayout();

  const tabs = [
    { id: 'ops-board' as TabType, name: 'Ops 보드', icon: ClipboardDocumentCheckIcon },
    { id: 'my-tasks' as TabType, name: 'My Tasks', icon: CheckCircleIcon },
    { id: 'packing' as TabType, name: '포장 관리', icon: CubeIcon },
    { id: 'scan' as TabType, name: '스캔 처리', icon: QrCodeIcon },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Header title="⚙️ 운영팀" onMenuClick={toggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* Tab Header */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex space-x-4 lg:space-x-8 px-4 lg:px-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-3 lg:py-4 px-1 border-b-2 font-bold text-xs lg:text-sm transition-colors whitespace-nowrap
                    ${
                      isActive
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-1.5 lg:mr-2 h-4 w-4 lg:h-5 lg:w-5
                      ${isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 lg:p-8">
          {activeTab === 'ops-board' && <OpsBoard />}
          {activeTab === 'my-tasks' && <MyTasksTab />}
          {activeTab === 'packing' && <PackingTab />}
          {activeTab === 'scan' && <ScanTab />}
        </div>
      </main>
    </div>
  );
}

