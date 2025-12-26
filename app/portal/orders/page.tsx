'use client';

import { useState } from 'react';
import { 
  ArrowUpTrayIcon, 
  PlusIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export default function PartnerOrdersPage() {
  const [activeTab, setActiveTab] = useState('list'); // list | create | upload

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            엑셀 대량 등록
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition"
          >
            <PlusIcon className="w-4 h-4" />
            주문 등록
          </button>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
        {/* 검색 및 필터 (List 모드일 때만) */}
        {activeTab === 'list' && (
          <div className="p-4 border-b border-gray-200 flex gap-4">
             <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="수취인명, 전화번호 검색..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
             </div>
             <select className="border border-gray-300 rounded-lg px-4 py-2 text-gray-700">
                <option value="ALL">전체 상태</option>
                <option value="CREATED">접수됨</option>
                <option value="SHIPPED">출고완료</option>
             </select>
          </div>
        )}

        {/* 컨텐츠 영역 */}
        <div className="p-6">
            {activeTab === 'list' && (
                <div className="text-center py-12 text-gray-500">
                    등록된 주문이 없습니다. 우측 상단 버튼을 눌러 주문을 등록해보세요.
                </div>
            )}

            {activeTab === 'upload' && (
                <div className="max-w-xl mx-auto text-center py-8">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 hover:border-blue-500 transition-colors cursor-pointer bg-gray-50">
                        <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">엑셀 파일 업로드</h3>
                        <p className="text-sm text-gray-500 mt-2">
                            주문 양식(Excel)을 이곳에 드래그하거나 클릭하여 업로드하세요.
                        </p>
                    </div>
                    <div className="mt-6 flex justify-center gap-4">
                        <button className="text-sm text-blue-600 hover:underline">
                            양식 다운로드
                        </button>
                        <span className="text-gray-300">|</span>
                        <button 
                            onClick={() => setActiveTab('list')}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            취소하고 돌아가기
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'create' && (
                <div className="max-w-2xl mx-auto">
                    <h3 className="text-lg font-medium mb-6">신규 주문 건별 등록</h3>
                    <form className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">수취인 이름</label>
                                <input type="text" className="w-full border-gray-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                                <input type="text" className="w-full border-gray-300 rounded-lg" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                            <input type="text" className="w-full border-gray-300 rounded-lg mb-2" placeholder="기본 주소" />
                            <input type="text" className="w-full border-gray-300 rounded-lg" placeholder="상세 주소" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택</label>
                            <select className="w-full border-gray-300 rounded-lg">
                                <option>상품을 선택하세요</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button 
                                type="button"
                                onClick={() => setActiveTab('list')}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                등록하기
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

