import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { failResult, type ActionResult } from '@/lib/actions/result';

type AdminAccessPayload = {
  user: { id: string };
  profile: { role: string | null; can_access_admin: boolean | null; org_id: string | null };
};

export async function ensurePermission(
  permission: string,
  request?: Request,
): Promise<ActionResult<true, 'FORBIDDEN' | 'INTERNAL_ERROR'>> {
  try {
    await requirePermission(permission, request);
    return { ok: true, data: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return failResult('Forbidden', { status: 403, code: 'FORBIDDEN' });
    }
    return failResult('권한 확인 중 오류가 발생했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function ensureAdminUserAccess(): Promise<
  ActionResult<AdminAccessPayload, 'UNAUTHORIZED' | 'FORBIDDEN' | 'INTERNAL_ERROR'>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return failResult('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, can_access_admin, org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile || (!profile.can_access_admin && profile.role !== 'admin')) {
      return failResult('Forbidden', { status: 403, code: 'FORBIDDEN' });
    }

    return {
      ok: true,
      data: {
        user: { id: user.id },
        profile: {
          role: profile.role,
          can_access_admin: profile.can_access_admin,
          org_id: profile.org_id || null,
        },
      },
    };
  } catch {
    return failResult('권한 확인 중 오류가 발생했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}
