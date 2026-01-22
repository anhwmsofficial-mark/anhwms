'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from './actions';
import { isSupabaseConfigured, supabase as legacySupabase } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/client';
import { 
  LockClosedIcon, 
  EnvelopeIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supabaseReady, setSupabaseReady] = useState(false);

  useEffect(() => {
    setSupabaseReady(isSupabaseConfigured());
    if (!isSupabaseConfigured()) {
      setError('Supabase가 설정되지 않았습니다. 관리자에게 문의하세요.');
    }

    // 로그인 페이지 진입 시 클라이언트 세션 정리 (Stale session 방지)
    const cleanupSession = async () => {
      // 1. Cookie 기반 세션 정리
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // 2. LocalStorage 기반 세션 정리 (Legacy)
      if (legacySupabase) {
        await legacySupabase.auth.signOut();
      }
    };
    cleanupSession();
  }, []);

  const handleSubmit = async (formData: FormData) => {
    if (!supabaseReady) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
      // 성공하면 redirect 되므로 setLoading(false) 불필요
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
      <div className="max-w-md w-full mx-4">
        {/* 로고 & 타이틀 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <LockClosedIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AN · AH WMS
          </h1>
          <p className="text-gray-600">
            통합 로그인
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form action={handleSubmit} className="space-y-6">
            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">로그인 실패</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading || !supabaseReady}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>로그인 중...</span>
                </div>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* 테스트 계정 안내 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              테스트 계정이 필요하신가요?
              <br />
              관리자에게 문의하세요.
            </p>
            {!supabaseReady && (
              <div className="mt-4">
                <a
                  href="/admin/env-check"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  🔧 환경변수 설정 확인하기
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:text-blue-800 transition"
          >
            ← 홈페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
