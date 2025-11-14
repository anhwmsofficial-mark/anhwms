'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface GlossaryTerm {
  id: string;
  term_ko: string;
  term_zh: string;
  note?: string;
  priority: number;
  active: boolean;
}

export default function TemplatesTab() {
  const [activeSection, setActiveSection] = useState<'templates' | 'glossary'>('glossary');
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 폼 상태
  const [formData, setFormData] = useState({
    term_ko: '',
    term_zh: '',
    note: '',
    priority: 5,
    active: true,
  });

  useEffect(() => {
    if (activeSection === 'glossary') {
      loadGlossary();
    }
  }, [activeSection]);

  const loadGlossary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cs/glossary');
      if (!response.ok) throw new Error('용어집 조회 실패');
      const data = await response.json();
      setGlossary(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      term_ko: '',
      term_zh: '',
      note: '',
      priority: 5,
      active: true,
    });
    setEditingTerm(null);
    setShowAddModal(true);
  };

  const handleEdit = (term: GlossaryTerm) => {
    setFormData({
      term_ko: term.term_ko,
      term_zh: term.term_zh,
      note: term.note || '',
      priority: term.priority,
      active: term.active,
    });
    setEditingTerm(term);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formData.term_ko || !formData.term_zh) {
      alert('한국어와 중국어는 필수 입력입니다.');
      return;
    }

    try {
      const url = editingTerm 
        ? `/api/cs/glossary?id=${editingTerm.id}`
        : '/api/cs/glossary';
      
      const response = await fetch(url, {
        method: editingTerm ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('저장 실패');
      
      setShowAddModal(false);
      loadGlossary();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/cs/glossary?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('삭제 실패');
      loadGlossary();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (term: GlossaryTerm) => {
    try {
      const response = await fetch(`/api/cs/glossary?id=${term.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...term, active: !term.active }),
      });

      if (!response.ok) throw new Error('업데이트 실패');
      loadGlossary();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 검색 필터링
  const filteredGlossary = glossary.filter((term) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      term.term_ko.toLowerCase().includes(search) ||
      term.term_zh.toLowerCase().includes(search) ||
      (term.note && term.note.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg border border-purple-100">
        <div className="border-b border-purple-200">
          <nav className="flex">
            <button
              onClick={() => setActiveSection('templates')}
              className={`px-6 py-3 font-semibold text-sm ${
                activeSection === 'templates'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 템플릿
            </button>
            <button
              onClick={() => setActiveSection('glossary')}
              className={`px-6 py-3 font-semibold text-sm ${
                activeSection === 'glossary'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📚 용어집
            </button>
          </nav>
        </div>

        <div className="p-8">
          {activeSection === 'templates' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">응답 템플릿</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg">
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
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span>📚</span>
                    용어집 관리
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">번역 시 우선 적용되는 전문 용어를 관리합니다</p>
                </div>
                <button 
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <PlusIcon className="h-5 w-5" />
                  용어 추가
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* 검색창 */}
              <div className="mb-6">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="한국어, 중국어, 메모에서 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <p className="text-sm text-gray-600 mt-2">
                    검색 결과: <strong>{filteredGlossary.length}</strong>개 용어
                  </p>
                )}
              </div>

              {loading ? (
                <div className="text-center text-gray-500 py-12">
                  <div className="animate-spin text-4xl mb-2">⏳</div>
                  용어집을 불러오는 중...
                </div>
              ) : filteredGlossary.length === 0 ? (
                <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl">
                  <div className="text-4xl mb-2">📚</div>
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 용어가 없습니다'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          우선순위
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          한국어
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          중국어
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          메모
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          상태
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredGlossary.map((term) => (
                        <tr key={term.id} className="hover:bg-purple-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                              {term.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {term.term_ko}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {term.term_zh}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {term.note || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(term)}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                term.active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {term.active ? '✓ 활성' : '✗ 비활성'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(term)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(term.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingTerm ? '용어 수정' : '용어 추가'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  한국어 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.term_ko}
                  onChange={(e) => setFormData({ ...formData, term_ko: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  placeholder="예: 최현석"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  중국어 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.term_zh}
                  onChange={(e) => setFormData({ ...formData, term_zh: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  placeholder="例: 崔玄昔"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  메모
                </label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  placeholder="예: 인명 - 최현석 대표"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  우선순위 (1-10, 높을수록 우선)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm font-semibold text-gray-700">
                  활성화
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg"
              >
                {editingTerm ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

