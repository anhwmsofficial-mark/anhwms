'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import {
  ArrowUpTrayIcon,
  TruckIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import ImportTab from './tabs/ImportTab';
import DispatchTab from './tabs/DispatchTab';
import SyncTab from './tabs/SyncTab';
import LogsTab from './tabs/LogsTab';

type TabType = 'import' | 'dispatch' | 'sync' | 'logs';

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('import');

  const tabs = [
    {
      id: 'import' as TabType,
      name: '주문 업로드',
      icon: ArrowUpTrayIcon,
      description: '엑셀/CSV 업로드 + 주소 파싱',
    },
    {
      id: 'dispatch' as TabType,
      name: '배송사 자동배정',
      icon: TruckIcon,
      description: 'CJ/ANH 자동 분류',
    },
    {
      id: 'sync' as TabType,
      name: '송장연동',
      icon: DocumentCheckIcon,
      description: 'RegBook/API 전송 현황',
    },
    {
      id: 'logs' as TabType,
      name: '처리로그',
      icon: ClipboardDocumentListIcon,
      description: '실패/중복/API오류 확인',
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Header title="주문 업로드 & 배송연동" />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* 탭 헤더 */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex space-x-8 px-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-colors
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="p-8">
          {activeTab === 'import' && <ImportTab />}
          {activeTab === 'dispatch' && <DispatchTab />}
          {activeTab === 'sync' && <SyncTab />}
          {activeTab === 'logs' && <LogsTab />}
        </div>
      </main>
    </div>
  );
}

