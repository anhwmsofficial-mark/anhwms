import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('환경 변수 NEXT_PUBLIC_SUPABASE_URL 이 설정되어 있지 않습니다.');
}

export function getSupabaseAdminClient() {
  const key = serviceRoleKey ?? anonKey;
  if (!key) {
    throw new Error('Supabase Admin 클라이언트를 초기화할 키가 없습니다.');
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
    },
  });
}
