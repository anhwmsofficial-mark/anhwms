'use client';

import { useEffect, useState } from 'react';

// 마이그레이션 상태 확인 컴포넌트
function MigrationStatusCheck() {
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  async function checkMigrationStatus() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/check-migration');
      const data = await response.json();
      setMigrationStatus(data);
    } catch (error) {
      console.error('마이그레이션 상태 확인 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-purple-700">확인 중...</div>;
  }

  if (!migrationStatus) {
    return <div className="text-sm text-red-600">확인 실패</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">user_profiles</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.user_profiles || '❓'}</div>
        </div>
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">org</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.org || '❓'}</div>
        </div>
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">customer_master</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.customer_master || '❓'}</div>
        </div>
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">brand</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.brand || '❓'}</div>
        </div>
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">warehouse</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.warehouse || '❓'}</div>
        </div>
        <div className="bg-white p-3 rounded border">
          <div className="text-xs text-gray-600">테스트 사용자</div>
          <div className="text-sm font-bold">{migrationStatus.summary?.test_users || '❓'}</div>
        </div>
      </div>
      
      {migrationStatus.checks?.test_users?.users && migrationStatus.checks.test_users.users.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-purple-900 mb-2">테스트 사용자 프로필:</div>
          <div className="space-y-2">
            {migrationStatus.checks.test_users.users.map((user: any) => (
              <div key={user.email} className="bg-white p-2 rounded text-xs">
                <div className="font-medium">{user.email}</div>
                <div className="text-gray-600">
                  역할: {user.role} | Admin: {user.can_access_admin ? '✅' : '❌'} | 상태: {user.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!migrationStatus.checks?.user_profiles?.exists || migrationStatus.checks?.test_users?.count === 0) && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="text-sm font-semibold text-yellow-900 mb-2">⚠️ 마이그레이션 필요</div>
          <div className="text-xs text-yellow-800 space-y-1">
            <p>1. Supabase SQL Editor에서 migrations/08_auth_users.sql 실행</p>
            <p>2. Supabase Dashboard에서 테스트 사용자 3명 생성</p>
            <p>3. migrations/09_create_test_users_guide.md 참고</p>
          </div>
        </div>
      )}

      <button
        onClick={checkMigrationStatus}
        className="mt-2 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition"
      >
        🔄 다시 확인
      </button>
    </div>
  );
}

export default function EnvCheckPage() {
  const [envStatus, setEnvStatus] = useState<{
    supabaseUrl: { exists: boolean; value: string; valid: boolean };
    supabaseAnonKey: { exists: boolean; value: string; valid: boolean };
    serviceRoleKey: { exists: boolean; value: string; valid: boolean };
  } | null>(null);

  useEffect(() => {
    // 클라이언트에서 환경변수 확인 (NEXT_PUBLIC_ 접두사만 확인 가능)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // 더 정확한 검증
    const urlValid = !!(supabaseUrl && 
                     supabaseUrl.startsWith('https://') && 
                     supabaseUrl.includes('.supabase.co') &&
                     supabaseUrl.length > 20);
    
    const keyValid = !!(supabaseAnonKey && 
                     supabaseAnonKey.length > 100 && // JWT 토큰은 보통 200자 이상
                     supabaseAnonKey.startsWith('eyJ')); // JWT는 항상 eyJ로 시작
    
    setEnvStatus({
      supabaseUrl: {
        exists: !!supabaseUrl,
        value: supabaseUrl || '없음',
        valid: urlValid,
      },
      supabaseAnonKey: {
        exists: !!supabaseAnonKey,
        value: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 50)}...` : '없음',
        valid: keyValid,
      },
      serviceRoleKey: {
        exists: false, // 클라이언트에서는 확인 불가
        value: '서버에서만 확인 가능',
        valid: false,
      },
    });
  }, []);

  if (!envStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const allValid = envStatus.supabaseUrl.valid && envStatus.supabaseAnonKey.valid;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 환경변수 확인
          </h1>

          {/* 상태 요약 */}
          <div className={`p-6 rounded-lg mb-6 ${
            allValid ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`text-4xl ${allValid ? '✅' : '❌'}`}>
                {allValid ? '✅' : '❌'}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${allValid ? 'text-green-800' : 'text-red-800'}`}>
                  {allValid ? '환경변수가 올바르게 설정되었습니다!' : '환경변수가 설정되지 않았거나 잘못되었습니다'}
                </h2>
                <p className={`text-sm mt-1 ${allValid ? 'text-green-700' : 'text-red-700'}`}>
                  {allValid 
                    ? 'Supabase 연결이 정상적으로 작동합니다.' 
                    : 'Vercel Dashboard에서 환경변수를 설정해주세요.'}
                </p>
              </div>
            </div>
          </div>

          {/* 환경변수 상세 */}
          <div className="space-y-4">
            {/* NEXT_PUBLIC_SUPABASE_URL */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  NEXT_PUBLIC_SUPABASE_URL
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  envStatus.supabaseUrl.valid 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {envStatus.supabaseUrl.valid ? '✅ 유효함' : '❌ 없음/잘못됨'}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-1">값:</p>
                <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                  {envStatus.supabaseUrl.value}
                </code>
                {!envStatus.supabaseUrl.valid && (
                  <div className="text-xs text-red-600 mt-2 space-y-1">
                    <p>⚠️ Supabase Project URL이 필요합니다.</p>
                    <p>형식: <code className="bg-red-50 px-1 rounded">https://xxx.supabase.co</code></p>
                    <p>확인 위치: Supabase Dashboard → Settings → API → Project URL</p>
                  </div>
                )}
              </div>
            </div>

            {/* NEXT_PUBLIC_SUPABASE_ANON_KEY */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  envStatus.supabaseAnonKey.valid 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {envStatus.supabaseAnonKey.valid ? '✅ 유효함' : '❌ 없음/잘못됨'}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-1">값:</p>
                <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                  {envStatus.supabaseAnonKey.value}
                </code>
                {!envStatus.supabaseAnonKey.valid && (
                  <div className="text-xs text-red-600 mt-2 space-y-1">
                    <p>⚠️ Supabase anon/public key가 필요합니다.</p>
                    <p>형식: <code className="bg-red-50 px-1 rounded">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code> (200자 이상)</p>
                    <p>확인 위치: Supabase Dashboard → Settings → API → anon public key</p>
                    {envStatus.supabaseAnonKey.exists && envStatus.supabaseAnonKey.value.length < 100 && (
                      <p className="font-bold">❌ 키가 너무 짧습니다. 전체 키를 복사했는지 확인하세요!</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SUPABASE_SERVICE_ROLE_KEY */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">
                  SUPABASE_SERVICE_ROLE_KEY
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  서버 전용
                </span>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  이 환경변수는 서버에서만 확인 가능합니다. Vercel Dashboard에서 설정해주세요.
                </p>
              </div>
            </div>
          </div>

          {/* 해결 방법 */}
          {!allValid && (
            <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h3 className="text-lg font-bold text-blue-900 mb-4">
                📋 해결 방법
              </h3>
              <ol className="list-decimal list-inside space-y-3 text-sm text-blue-800">
                <li>
                  <strong>Supabase Dashboard</strong>에서 키 확인
                  <ul className="list-disc list-inside ml-6 mt-1 text-blue-700">
                    <li>https://supabase.com → 프로젝트 선택</li>
                    <li>Settings → API 메뉴</li>
                    <li>Project URL과 anon/public key 복사</li>
                  </ul>
                </li>
                <li>
                  <strong>Vercel Dashboard</strong>에서 환경변수 설정
                  <ul className="list-disc list-inside ml-6 mt-1 text-blue-700">
                    <li>https://vercel.com → anhwms 프로젝트 선택</li>
                    <li>Settings → Environment Variables</li>
                    <li>3개 환경변수 추가 (Production, Preview, Development 모두 선택)</li>
                  </ul>
                </li>
                <li>
                  <strong>재배포</strong> 대기 (자동으로 시작됩니다)
                </li>
                <li>
                  이 페이지를 <strong>새로고침</strong>하여 확인
                </li>
              </ol>
              <div className="mt-4 p-4 bg-white rounded border border-blue-200">
                <p className="text-xs font-mono text-gray-700">
                  <strong>필수 환경변수:</strong><br />
                  NEXT_PUBLIC_SUPABASE_URL<br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY<br />
                  SUPABASE_SERVICE_ROLE_KEY
                </p>
              </div>
            </div>
          )}

          {/* 마이그레이션 상태 확인 */}
          <div className="mt-8 p-6 bg-purple-50 border-2 border-purple-200 rounded-lg">
            <h3 className="text-lg font-bold text-purple-900 mb-4">
              📊 마이그레이션 상태 확인
            </h3>
            <MigrationStatusCheck />
          </div>

          {/* 새로고침 버튼 */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

