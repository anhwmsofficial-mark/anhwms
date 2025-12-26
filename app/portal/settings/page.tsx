'use client';

import { useState, useEffect } from 'react';
import { UserCircleIcon, BuildingOfficeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/utils/supabase/client';

export default function PartnerSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 내 정보 + 파트너 정보 (View 활용 or Join)
        const { data } = await supabase
          .from('users')
          .select('*, partner:partners(*)')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setProfile(data);
          setPartner(data.partner);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">설정</h1>

      {/* 내 프로필 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5 text-gray-500" />
          내 프로필
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">이메일</label>
            <div className="mt-1 text-gray-900">{profile?.email}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">이름</label>
            <div className="mt-1 text-gray-900">{profile?.username || '미설정'}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">권한</label>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
              {profile?.role}
            </span>
          </div>
        </div>
      </div>

      {/* 파트너사 정보 */}
      {partner && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-gray-500" />
            회사 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500">회사명</label>
              <div className="mt-1 text-gray-900 font-medium">{partner.name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">대표 연락처</label>
              <div className="mt-1 text-gray-900 flex items-center gap-1">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                {partner.phone}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500">주소</label>
              <div className="mt-1 text-gray-900">{partner.address}</div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-gray-400">
          정보 수정이 필요한 경우 담당 매니저에게 문의해주세요.
        </p>
      </div>
    </div>
  );
}
