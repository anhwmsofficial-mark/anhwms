'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import {
  ChatBubbleLeftRightIcon,
  LinkIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellIcon,
  DocumentDuplicateIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline';
import ConversationsTab from './tabs/ConversationsTab';
import StatusSyncTab from './tabs/StatusSyncTab';
import DocumentsTab from './tabs/DocumentsTab';
import ReportsTab from './tabs/ReportsTab';
import AlertsTab from './tabs/AlertsTab';
import TemplatesTab from './tabs/TemplatesTab';
import QuickTranslateTab from './tabs/QuickTranslateTab';

type TabType = 'conversations' | 'status' | 'documents' | 'reports' | 'alerts' | 'templates' | 'translate';

export default function CSPage() {
  const [activeTab, setActiveTab] = useState<TabType>('conversations');

  const tabs = [
    {
      id: 'conversations' as TabType,
      name: '실시간 대화함',
      icon: ChatBubbleLeftRightIcon,
      description: '파트너 대화 관리 & AI 자동응답',
    },
    {
      id: 'status' as TabType,
      name: '상태연동',
      icon: LinkIcon,
      description: '주문/운송장/ASN 실시간 조회',
    },
    {
      id: 'documents' as TabType,
      name: '문서센터',
      icon: DocumentTextIcon,
      description: '인보이스/패킹리스트/출고증',
    },
    {
      id: 'reports' as TabType,
      name: '보고서',
      icon: ChartBarIcon,
      description: 'CS/물류 KPI & 지표',
    },
    {
      id: 'alerts' as TabType,
      name: '알림센터',
      icon: BellIcon,
      description: 'SLA 위반/지연/오류 경보',
    },
    {
      id: 'templates' as TabType,
      name: '템플릿 & 용어집',
      icon: DocumentDuplicateIcon,
      description: '응답 템플릿/용어 매핑 관리',
    },
    {
      id: 'translate' as TabType,
      name: 'Quick Translate',
      icon: LanguageIcon,
      description: 'KR⇄ZH 즉시 번역',
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Header title="AI CS 통합 시스템" />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* 탭 헤더 */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex space-x-8 px-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap
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
          {activeTab === 'conversations' && <ConversationsTab />}
          {activeTab === 'status' && <StatusSyncTab />}
          {activeTab === 'documents' && <DocumentsTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'alerts' && <AlertsTab />}
          {activeTab === 'templates' && <TemplatesTab />}
          {activeTab === 'translate' && <QuickTranslateTab />}
        </div>
      </main>
    </div>
  );
}

