'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  MapPinIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

interface Destination {
  id: string;
  destination_code: string;
  name: string;
  channel: string;
  customer_id?: string;
  type: 'B2B' | 'B2C' | 'FC' | '점포' | '센터' | '지점' | '기타';
  country: string;
  postal_code?: string;
  address: string;
  address_detail?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  lead_time_days: number;
  delivery_note?: string;
  restrictions?: string;
  label_format?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 샘플 데이터
const SAMPLE_DESTINATIONS: Destination[] = [
  {
    id: '1',
    destination_code: 'OLY-SD-0134',
    name: '올리브영 서대문점',
    channel: '올리브영',
    type: '점포',
    country: 'KR',
    postal_code: '03736',
    address: '서울특별시 서대문구 신촌로 83',
    contact_name: '김영희',
    contact_phone: '02-1234-5678',
    lead_time_days: 1,
    restrictions: '납품시간: 오전 10시~오후 5시, 팔레트 불가',
    label_format: 'A4',
    active: true,
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  },
  {
    id: '2',
    destination_code: 'CP-FC-01',
    name: '쿠팡 인천 1센터',
    channel: '쿠팡',
    type: 'FC',
    country: 'KR',
    postal_code: '22742',
    address: '인천광역시 서구 북항로 32번길 56',
    contact_name: '최담당',
    contact_phone: '032-111-2222',
    lead_time_days: 2,
    restrictions: '팔레트 필수, QR코드 라벨 부착',
    label_format: '100x150mm',
    active: true,
    created_at: new Date('2024-01-20'),
    updated_at: new Date('2024-01-20'),
  },
  {
    id: '3',
    destination_code: 'JT-CN-SH01',
    name: 'JT 상하이 창고',
    channel: 'JT',
    type: '센터',
    country: 'CN',
    postal_code: '200000',
    address: '上海市浦东新区张江高科技园区',
    contact_name: 'Zhang Wei',
    contact_phone: '+86-21-1234-5678',
    lead_time_days: 5,
    delivery_note: '통관서류 필수, 영문/중문 라벨',
    restrictions: 'HS Code 표기 필수',
    label_format: 'A4',
    active: true,
    created_at: new Date('2024-02-01'),
    updated_at: new Date('2024-02-01'),
  },
  {
    id: '4',
    destination_code: 'YBK-HQ-001',
    name: 'YBK 본사 물류센터',
    channel: 'YBK',
    type: '센터',
    country: 'KR',
    postal_code: '13487',
    address: '경기도 성남시 분당구 판교역로 235',
    contact_name: '박대리',
    contact_phone: '031-666-7777',
    lead_time_days: 1,
    active: true,
    created_at: new Date('2024-02-10'),
    updated_at: new Date('2024-02-10'),
  },
  {
    id: '5',
    destination_code: 'WMG-PC-01',
    name: 'WMG 부품센터 (본사)',
    channel: 'WMG',
    type: '센터',
    country: 'KR',
    postal_code: '06774',
    address: '서울특별시 서초구 서초대로 396',
    contact_name: '윤부장',
    contact_phone: '02-888-9999',
    lead_time_days: 1,
    active: true,
    created_at: new Date('2024-02-15'),
    updated_at: new Date('2024-02-15'),
  },
];

export default function DestinationsPage() {
  const { toggleSidebar } = useLayout();
  const [destinations, setDestinations] = useState<Destination[]>(SAMPLE_DESTINATIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);

  // 필터링
  const filteredDestinations = destinations.filter(dest => {
    const matchesSearch = 
      dest.destination_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dest.channel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dest.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = filterChannel === 'all' || dest.channel === filterChannel;
    const matchesType = filterType === 'all' || dest.type === filterType;
    const matchesCountry = filterCountry === 'all' || dest.country === filterCountry;

    return matchesSearch && matchesChannel && matchesType && matchesCountry;
  });

  // 통계
  const stats = {
    total: destinations.length,
    active: destinations.filter(d => d.active).length,
    domestic: destinations.filter(d => d.country === 'KR').length,
    overseas: destinations.filter(d => d.country !== 'KR').length,
  };

  // 채널 목록
  const channels = ['all', ...Array.from(new Set(destinations.map(d => d.channel)))];
  const types = ['all', 'B2B', 'B2C', 'FC', '점포', '센터', '지점', '기타'];
  const countries = ['all', 'KR', 'CN', 'US', 'JP'];

  const getTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
      'B2B': 'bg-blue-100 text-blue-700',
      'B2C': 'bg-green-100 text-green-700',
      'FC': 'bg-purple-100 text-purple-700',
      '점포': 'bg-orange-100 text-orange-700',
      '센터': 'bg-indigo-100 text-indigo-700',
      '지점': 'bg-pink-100 text-pink-700',
      '기타': 'bg-gray-100 text-gray-700',
    };
    return badges[type] || 'bg-gray-100 text-gray-700';
  };

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'KR': '🇰🇷',
      'CN': '🇨🇳',
      'US': '🇺🇸',
      'JP': '🇯🇵',
    };
    return flags[country] || '🌍';
  };

  const handleAdd = () => {
    setEditingDestination(null);
    setShowModal(true);
  };

  const handleEdit = (destination: Destination) => {
    setEditingDestination(destination);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setDestinations(destinations.filter(d => d.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setDestinations(destinations.map(d =>
      d.id === id ? { ...d, active: !d.active } : d
    ));
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="📍 다수지 관리 (納品處 코드)" onMenuClick={toggleSidebar} />

      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-8">
        {/* 안내 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl shadow-lg p-6 text-white mb-6">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <MapPinIcon className="h-7 w-7" />
            다수지 코드 관리
          </h2>
          <p className="text-green-100">
            여러 납품처·수령지를 고유 코드로 관리하여 출고·피킹·패킹·라벨링 자동화에 활용합니다
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3 mb-2">
              <MapPinIcon className="h-6 w-6 text-blue-600" />
              <span className="text-sm text-gray-600">전체 다수지</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckIcon className="h-6 w-6 text-green-600" />
              <span className="text-sm text-gray-600">활성</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3 mb-2">
              <BuildingOfficeIcon className="h-6 w-6 text-indigo-600" />
              <span className="text-sm text-gray-600">국내</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.domestic}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3 mb-2">
              <GlobeAltIcon className="h-6 w-6 text-purple-600" />
              <span className="text-sm text-gray-600">해외</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.overseas}</div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="코드, 이름, 채널, 주소로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {channels.map(channel => (
                <option key={channel} value={channel}>
                  {channel === 'all' ? '전체 채널' : channel}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {types.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? '전체 유형' : type}
                </option>
              ))}
            </select>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {countries.map(country => (
                <option key={country} value={country}>
                  {country === 'all' ? '전체 국가' : `${getCountryFlag(country)} ${country}`}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold whitespace-nowrap"
            >
              <PlusIcon className="h-5 w-5" />
              다수지 추가
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            총 <strong>{filteredDestinations.length}</strong>개 다수지
          </p>
        </div>

        {/* 다수지 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    다수지 코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수령지명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    채널/유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주소
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    리드타임
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDestinations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      검색 결과가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredDestinations.map((dest) => (
                    <tr key={dest.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{getCountryFlag(dest.country)}</span>
                          <span className="font-mono font-bold text-green-700">{dest.destination_code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{dest.name}</div>
                        <div className="text-xs text-gray-500">{dest.channel}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadge(dest.type)}`}>
                          {dest.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{dest.address}</div>
                        {dest.postal_code && (
                          <div className="text-xs text-gray-500">우편번호: {dest.postal_code}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {dest.contact_name && (
                          <div className="text-sm text-gray-900">{dest.contact_name}</div>
                        )}
                        {dest.contact_phone && (
                          <div className="text-xs text-gray-500">{dest.contact_phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dest.lead_time_days}일
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(dest.id)}
                          className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            dest.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {dest.active ? '✓ 활성' : '✗ 비활성'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(dest)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(dest.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 추가/수정 모달 (간단 버전) */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingDestination ? '다수지 수정' : '다수지 추가'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="text-center text-gray-500 py-12">
                <MapPinIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>다수지 추가/수정 폼은 구현 예정입니다</p>
                <p className="text-sm mt-2">실제 운영 시 Supabase와 연동됩니다</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold shadow-lg"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

