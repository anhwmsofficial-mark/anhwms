import supabaseAdmin from '@/lib/supabase-admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

/**
 * 관리자 사용자 목록 조회
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, name, email')
    .eq('role', 'admin')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getAdminUsers] select failed', error);
    throw new Error('관리자 목록 조회에 실패했습니다.');
  }

  return data || [];
}

