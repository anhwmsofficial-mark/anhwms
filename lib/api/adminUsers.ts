import supabaseAdmin from '@/lib/supabase-admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  jobTitle?: string | null;
  department?: string | null;
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
    .select('id, display_name, full_name, email, role, job_title, department')
    .is('deleted_at', null)
    .eq('status', 'active')
    .or('role.eq.admin,role.eq.manager,can_manage_orders.eq.true,can_access_admin.eq.true')
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
    role?: string | null;
    job_title?: string | null;
    department?: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name || row.full_name || row.email || '관리자',
    email: row.email || '',
    role: row.role || undefined,
    jobTitle: row.job_title || null,
    department: row.department || null,
  }));
}

