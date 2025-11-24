'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  LockClosedIcon, 
  EnvelopeIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supabaseReady, setSupabaseReady] = useState(false);

  useEffect(() => {
    setSupabaseReady(isSupabaseConfigured());
    if (!isSupabaseConfigured()) {
      setError('Supabase가 설정되지 않았습니다. 관리자에게 문의하세요.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabaseReady) {
      setError('Supabase 환경변수가 설정되지 않았습니다. Vercel Dashboard에서 환경변수를 설정해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Supabase 클라이언트가 제대로 설정되었는지 확인
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase 환경변수가 올바르게 설정되지 않았습니다.');
      }

      console.log('🔐 로그인 시도:', { email });

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (signInError) {
        console.error('❌ 로그인 에러:', signInError);
        throw signInError;
      }

      console.log('✅ 로그인 성공:', { userId: data.user?.id });

      // 로그인 성공 - 프로필 확인
      if (data.user) {
        console.log('👤 사용자 프로필 확인 중...');
        
        // 프로필 조회 (에러가 나도 계속 진행)
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.warn('⚠️ 프로필 로드 실패 (테이블이 없을 수 있음):', profileError.message);
          // 프로필이 없어도 일단 진행 (마이그레이션 미실행 시)
        } else {
          console.log('✅ 프로필 로드 성공:', { role: profile?.role, canAccessAdmin: profile?.can_access_admin });
          
          // 로그인 시간 업데이트 (에러 무시)
          try {
            await supabase
              .from('user_profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', data.user.id);
            console.log('✅ 로그인 시간 업데이트 완료');
          } catch (err: any) {
            console.warn('⚠️ 로그인 시간 업데이트 실패:', err.message);
          }
        }

        // Admin 권한이 있으면 Admin으로, 아니면 Dashboard로
        if (profile?.can_access_admin) {
          console.log('🚀 Admin 페이지로 이동');
          router.push('/admin');
        } else {
          console.log('🚀 Dashboard로 이동');
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('❌ 로그인 에러:', {
        message: err.message,
        status: err.status,
        name: err.name,
      });
      
      // 에러 타입별 메시지 개선
      if (err.message?.includes('Invalid API key') || 
          err.message?.includes('Invalid') && err.status === 401) {
        setError('Supabase API Key가 올바르지 않습니다. Vercel 환경변수를 확인하세요. (NEXT_PUBLIC_SUPABASE_ANON_KEY)');
      } else if (err.message?.includes('Invalid login credentials') || 
                 err.message?.includes('Email rate limit exceeded')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('이메일 인증이 완료되지 않았습니다. Supabase Dashboard에서 이메일을 확인해주세요.');
      } else if (err.message?.includes('User not found')) {
        setError('사용자를 찾을 수 없습니다. Supabase Dashboard에서 사용자가 생성되었는지 확인하세요.');
      } else {
        setError(err.message || '로그인에 실패했습니다. 콘솔을 확인하세요.');
      }
    } finally {
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
            관리자 로그인
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
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
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

