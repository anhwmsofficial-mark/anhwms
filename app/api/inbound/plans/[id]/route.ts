import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { ERROR_CODES } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { deleteInboundPlanService } from '@/services/inbound/inboundService';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return fail(ERROR_CODES.BAD_REQUEST, '입고 예정 ID가 필요합니다.', { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다.', { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, can_access_admin, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return fail(ERROR_CODES.FORBIDDEN, '권한 정보를 확인할 수 없습니다.', { status: 403 });
    }

    if (profile.status && profile.status !== 'active') {
      return fail(ERROR_CODES.FORBIDDEN, '계정이 비활성화되었습니다.', { status: 403 });
    }

    const isAdmin = profile.role === 'admin' || profile.can_access_admin === true;
    if (!isAdmin) {
      return fail(ERROR_CODES.FORBIDDEN, '관리자 권한이 필요합니다.', { status: 403 });
    }

    const db = createTrackedAdminClient({
      route: '/api/inbound/plans/[id]',
      action: 'DELETE',
      requestId: request.headers.get('x-request-id') || undefined,
    }) as any;

    await deleteInboundPlanService(db, user.id, isAdmin, id);

    revalidatePath('/admin/inbound');
    revalidatePath('/inbound');

    return ok({ success: true });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'DELETE /api/inbound/plans/[id]' });
    const message = error?.message || '삭제 중 오류가 발생했습니다.';
    const code = /삭제할 수 없습니다/.test(message) ? ERROR_CODES.CONFLICT : ERROR_CODES.INTERNAL_ERROR;
    return fail(code, message, { status: code === ERROR_CODES.CONFLICT ? 409 : 500 });
  }
}
