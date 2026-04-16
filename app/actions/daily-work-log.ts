'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, failResult, type ActionResult } from '@/lib/actions/result';
import type {
  DailyWorkLog,
  DailyWorkLogListParams,
  DailyWorkLogListResult,
  DailyWorkLogMeta,
  DailyWorkLogServiceContext,
  DailyWorkLogUpsertInput,
} from '@/src/features/daily-work-log/dto';
import {
  createDailyWorkLogService,
  getDailyWorkLogByDateService,
  getDailyWorkLogByIdService,
  getDailyWorkLogMetaService,
  listDailyWorkLogsService,
  updateDailyWorkLogService,
} from '@/src/features/daily-work-log/service';

async function getDailyWorkLogActionContext(
  request?: Request,
): Promise<ActionResult<{ db: Awaited<ReturnType<typeof createClient>>; context: DailyWorkLogServiceContext }>> {
  try {
    const permission = await ensurePermission('inventory:count', request);
    if (!permission.ok) return permission;

    const db = await createClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();

    if (authError || !user) {
      return failResult('로그인이 필요합니다.', { status: 401, code: 'UNAUTHORIZED' });
    }

    const { data: profile, error: profileError } = await db
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return failResult(profileError.message, { status: 500, code: 'INTERNAL_ERROR' });
    }

    if (!profile?.org_id) {
      return failResult('조직 정보가 없는 계정은 작업일지를 사용할 수 없습니다.', {
        status: 403,
        code: 'FORBIDDEN',
      });
    }

    return {
      ok: true,
      data: {
        db,
        context: {
          userId: user.id,
          orgId: profile.org_id,
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 권한 확인에 실패했습니다.');
  }
}

export async function getDailyWorkLogMetaAction(
  request?: Request,
): Promise<ActionResult<DailyWorkLogMeta>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLogMeta>;

  try {
    const result = await getDailyWorkLogMetaService(actionContext.data.db, actionContext.data.context);
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 메타 정보를 불러오지 못했습니다.');
  }
}

export async function listDailyWorkLogsAction(
  params: DailyWorkLogListParams = {},
  request?: Request,
): Promise<ActionResult<DailyWorkLogListResult>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLogListResult>;

  try {
    const result = await listDailyWorkLogsService(actionContext.data.db, actionContext.data.context, params);
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 목록을 불러오지 못했습니다.');
  }
}

export async function getDailyWorkLogDetailAction(
  id: string,
  request?: Request,
): Promise<ActionResult<DailyWorkLog>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLog>;

  try {
    const result = await getDailyWorkLogByIdService(actionContext.data.db, actionContext.data.context, id);
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 상세를 불러오지 못했습니다.');
  }
}

export async function getDailyWorkLogByDateAction(
  params: { workDate: string; warehouseId: string },
  request?: Request,
): Promise<ActionResult<DailyWorkLog | null>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLog | null>;

  try {
    const result = await getDailyWorkLogByDateService(actionContext.data.db, actionContext.data.context, params);
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '기존 작업일지를 조회하지 못했습니다.');
  }
}

export async function createDailyWorkLogAction(
  input: DailyWorkLogUpsertInput,
  request?: Request,
): Promise<ActionResult<DailyWorkLog>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLog>;

  try {
    const result = await createDailyWorkLogService(actionContext.data.db, actionContext.data.context, input);
    revalidatePath('/operations/daily-work-logs');
    revalidatePath('/admin/daily-work-logs');
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 저장에 실패했습니다.');
  }
}

export async function updateDailyWorkLogAction(
  id: string,
  input: DailyWorkLogUpsertInput,
  request?: Request,
): Promise<ActionResult<DailyWorkLog>> {
  const actionContext = await getDailyWorkLogActionContext(request);
  if (!actionContext.ok) return actionContext as ActionResult<DailyWorkLog>;

  try {
    const result = await updateDailyWorkLogService(actionContext.data.db, actionContext.data.context, id, input);
    revalidatePath('/operations/daily-work-logs');
    revalidatePath(`/operations/daily-work-logs/${id}/edit`);
    revalidatePath('/admin/daily-work-logs');
    revalidatePath(`/admin/daily-work-logs/${id}/edit`);
    return { ok: true, data: result };
  } catch (error: unknown) {
    return failFromError(error, '작업일지 수정에 실패했습니다.');
  }
}
