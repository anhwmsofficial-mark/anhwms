import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// 환경 변수 가져오기
const env = getEnv();

// Supabase 클라이언트 생성
let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const url = env.supabaseUrl || '';
  const key = env.supabaseAnonKey || '';

  // 환경변수 검증
  if (!url || !key) {
    console.error('❌ Supabase 환경변수 누락:', {
      hasUrl: !!url,
      hasKey: !!key,
    });
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  // 환경변수 값에 변수명이 포함되어 있을 수 있음 (예: "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...")
  const cleanKey = key.includes('=') ? key.split('=').slice(1).join('=').trim() : key.trim();
  const cleanUrl = url.includes('=') ? url.split('=').slice(1).join('=').trim() : url.trim();

  if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
    console.error('❌ Supabase URL 형식 오류:', cleanUrl);
    throw new Error('Supabase URL 형식이 올바르지 않습니다.');
  }
  
  if (cleanKey.length < 100) {
    console.error('❌ Supabase Key 길이 부족:', {
      keyLength: cleanKey.length,
      originalLength: key.length,
    });
    throw new Error('Supabase API Key 길이가 올바르지 않습니다.');
  }

  // JWT 토큰은 보통 eyJ로 시작하지만, 일부 환경에서는 다를 수 있으므로 더 유연하게 처리
  if (!cleanKey.startsWith('eyJ') && cleanKey.length < 200) {
    console.warn('⚠️ Supabase Key 형식이 예상과 다릅니다:', {
      keyLength: cleanKey.length,
      startsWithEyJ: cleanKey.startsWith('eyJ'),
      firstChars: cleanKey.substring(0, 10),
    });
    // 경고만 하고 계속 진행 (실제 API 호출 시 에러가 나면 그때 처리)
  }

  // 정상적인 클라이언트 생성
  try {
    supabaseInstance = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    
    console.log('✅ Supabase 클라이언트 생성 성공:', {
      url: cleanUrl.substring(0, 30) + '...',
      keyLength: cleanKey.length,
    });
    
    return supabaseInstance;
  } catch (error) {
    console.error('❌ Supabase 클라이언트 생성 실패:', error);
    throw error;
  }
}

// Supabase가 설정되어 있는지 확인하는 헬퍼 함수
export function isSupabaseConfigured(): boolean {
  const url = env.supabaseUrl || '';
  const key = env.supabaseAnonKey || '';
  
  // 환경변수 값에 변수명이 포함되어 있을 수 있음
  const cleanKey = key.includes('=') ? key.split('=').slice(1).join('=').trim() : key.trim();
  const cleanUrl = url.includes('=') ? url.split('=').slice(1).join('=').trim() : url.trim();
  
  return !!(
    cleanUrl && 
    cleanKey && 
    cleanUrl.startsWith('https://') &&
    cleanUrl.includes('.supabase.co') &&
    cleanKey.length > 100 // JWT 토큰은 보통 200자 이상
  );
}

// Supabase 클라이언트 생성
export const supabase = createSupabaseClient();

