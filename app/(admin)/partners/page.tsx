'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Partner } from '@/types';
import { getPartners, createPartner, updatePartner, deletePartner } from '@/lib/api/partners';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<Partial<Partner>>({
    name: '',
    type: 'supplier',
    contact: '',
    phone: '',
    email: '',
    address: '',
    note: '',
  });

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    try {
      setLoading(true);
      const data = await getPartners();
      setPartners(data);
    } catch (error) {
      console.error('거래처 로딩 실패:', error);
      alert('거래처를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const types = ['전체', 'supplier', 'customer', 'both'];
  const typeLabels: Record<string, string> = {
    '전체': '전체',
    'supplier': '공급업체',
    'customer': '고객',
    'both': '공급/고객',
  };

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         partner.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         partner.phone.includes(searchTerm);
    const matchesType = selectedType === '전체' || partner.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleOpenModal = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData(partner);
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        type: 'supplier',
        contact: '',
        phone: '',
        email: '',
        address: '',
        note: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
    setFormData({
      name: '',
      type: 'supplier',
      contact: '',
      phone: '',
      email: '',
      address: '',
      note: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPartner) {
        await updatePartner(editingPartner.id, formData);
      } else {
        await createPartner(formData as Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>);
      }
      
      await loadPartners();
      handleCloseModal();
    } catch (error) {
      console.error('거래처 저장 실패:', error);
      alert('거래처 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 거래처를 삭제하시겠습니까?')) {
      try {
        await deletePartner(id);
        await loadPartners();
      } catch (error) {
        console.error('거래처 삭제 실패:', error);
        alert('거래처 삭제에 실패했습니다.');
      }
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'supplier':
        return <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">공급업체</span>;
      case 'customer':
        return <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">고객</span>;
      case 'both':
        return <span className="inline-flex rounded-full bg-purple-100 px-2 text-xs font-semibold leading-5 text-purple-800">공급/고객</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="거래처 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="거래처명, 담당자, 전화번호로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {types.map(type => (
                <option key={type} value={type}>{typeLabels[type]}</option>
              ))}
            </select>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              거래처 추가
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">공급업체</p>
                <p className="text-2xl font-bold text-gray-900">
                  {partners.filter(p => p.type === 'supplier' || p.type === 'both').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <UserGroupIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">고객</p>
                <p className="text-2xl font-bold text-gray-900">
                  {partners.filter(p => p.type === 'customer' || p.type === 'both').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-3">
                <BuildingOfficeIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 거래처</p>
                <p className="text-2xl font-bold text-gray-900">
                  {partners.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 거래처 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      거래처명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      담당자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      연락처
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      주소
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      {partner.note && <div className="text-sm text-gray-500">{partner.note}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(partner.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {partner.contact}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {partner.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {partner.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {partner.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenModal(partner)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(partner.id)}
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
      </main>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingPartner ? '거래처 수정' : '거래처 추가'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      거래처명 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      유형 *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'supplier' | 'customer' | 'both' })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="supplier">공급업체</option>
                      <option value="customer">고객</option>
                      <option value="both">공급/고객</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      담당자 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      전화번호 *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      비고
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                  >
                    {editingPartner ? '수정' : '추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

