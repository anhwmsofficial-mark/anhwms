'use client';

import { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function TemplatesTab() {
  const [activeSection, setActiveSection] = useState<'templates' | 'glossary'>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [glossary, setGlossary] = useState<any[]>([]);

  // TODO: 실제 데이터 로딩 구현

  return (
    <div className="space-y-6">
      {/* 탭 전환 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveSection('templates')}
              className={`px-6 py-3 font-medium text-sm ${
                activeSection === 'templates'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              템플릿
            </button>
            <button
              onClick={() => setActiveSection('glossary')}
              className={`px-6 py-3 font-medium text-sm ${
                activeSection === 'glossary'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              용어집
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeSection === 'templates' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">응답 템플릿</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <PlusIcon className="h-5 w-5" />
                  추가
                </button>
              </div>
              <div className="text-center text-gray-500 py-8">
                템플릿 목록은 구현 예정입니다
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">용어집</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <PlusIcon className="h-5 w-5" />
                  추가
                </button>
              </div>
              <div className="text-center text-gray-500 py-8">
                용어집 목록은 구현 예정입니다
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

