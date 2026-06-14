import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { ERROR_CODES } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createInboundPlanService } from '@/services/inbound/inboundService';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다.', { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, can_access_admin, can_manage_inventory, status, org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return fail(ERROR_CODES.FORBIDDEN, '권한 정보를 확인할 수 없습니다.', { status: 403 });
    }

    if (profile.status && profile.status !== 'active') {
      return fail(ERROR_CODES.FORBIDDEN, '계정이 비활성화되었습니다.', { status: 403 });
    }

    const allowedRoles = ['admin', 'manager', 'staff', 'operator'];
    const allowed =
      profile.can_manage_inventory ||
      profile.can_access_admin ||
      allowedRoles.includes(profile.role);

    if (!allowed) {
      return fail(ERROR_CODES.FORBIDDEN, '재고/입고 권한이 없습니다.', { status: 403 });
    }

    if (!profile.org_id) {
      return fail(ERROR_CODES.FORBIDDEN, '사용자 조직 정보가 없어 입고 예정 등록을 진행할 수 없습니다.', {
        status: 403,
      });
    }

    const formData = await request.formData();
    const safeFormData = new FormData();
    formData.forEach((value, key) => {
      safeFormData.append(key, value);
    });
    safeFormData.set('org_id', String(profile.org_id));

    const db = createTrackedAdminClient({
      route: '/api/inbound/plans',
      action: 'POST',
      requestId: request.headers.get('x-request-id') || undefined,
    }) as any;

    const result = await createInboundPlanService(db, user.id, safeFormData);

    revalidatePath('/admin/inbound');
    revalidatePath('/inbound');

    return ok({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'POST /api/inbound/plans' });
    const message = error?.message || '입고 예정 생성에 실패했습니다.';
    const code =
      /row-level security|permission denied|권한/.test(message)
        ? ERROR_CODES.FORBIDDEN
        : ERROR_CODES.VALIDATION_ERROR;

    return fail(code, message, { status: code === ERROR_CODES.FORBIDDEN ? 403 : 400 });
  }
}
