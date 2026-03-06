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
  const db = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  const { data, error } = await db
    .from('user_profiles')
    .select('id, display_name, full_name, email')
    .eq('role', 'admin')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[getAdminUsers] select failed', error);
    throw new Error('관리자 목록 조회에 실패했습니다.');
  }

  const rows = (data || []) as Array<{
    id: string;
    display_name?: string | null;
    full_name?: string | null;
    email?: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name || row.full_name || row.email || '관리자',
    email: row.email || '',
  }));
}

