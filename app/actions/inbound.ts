'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  confirmReceiptService,
  createInboundPlanService,
  deleteInboundPlanService,
  getInboundPlanDetailService,
  getInboundPlansService,
  getOpsInboundDataService,
  saveInboundPhotoService,
  saveReceiptLinesService,
  updateInboundPlanService,
} from '@/services/inbound/inboundService';
import { logger } from '@/lib/logger';

type ActionErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID'
  | 'CONFLICT'
  | 'UNKNOWN';

function actionError(code: ActionErrorCode, message: string) {
  return {
    ok: false,
    error: message,
    errorCode: code,
    errorDetail: { code, message },
  };
}

function actionSuccess<T extends Record<string, any>>(payload: T) {
  return { ok: true, ...payload };
}

async function isAdminUser(supabase: any, userId?: string) {
    if (!userId) return false;
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, can_access_admin')
        .eq('id', userId)
        .maybeSingle();
    return profile?.role === 'admin' || profile?.can_access_admin === true;
}

async function requireInboundAccess(options?: { requireAdmin?: boolean }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return actionError('UNAUTHORIZED', '인증이 필요합니다.');
    }

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, can_access_admin, can_manage_inventory, status')
        .eq('id', user.id)
        .maybeSingle();

    if (error || !profile) {
        return actionError('FORBIDDEN', '권한 정보를 확인할 수 없습니다.');
    }

    if (profile.status && profile.status !== 'active') {
        return actionError('FORBIDDEN', '계정이 비활성화되었습니다.');
    }

    const isAdmin = profile.role === 'admin' || profile.can_access_admin;
    if (options?.requireAdmin && !isAdmin) {
        return actionError('FORBIDDEN', '슈퍼관리자만 접근할 수 있습니다.');
    }

    const allowedRoles = ['admin', 'manager', 'staff', 'operator'];
    const allowed =
        profile.can_manage_inventory ||
        profile.can_access_admin ||
        allowedRoles.includes(profile.role);

    if (!allowed) {
        return actionError('FORBIDDEN', '재고/입고 권한이 없습니다.');
    }

    return { supabase, user, profile };
}


// 입고 예정 목록 조회
export async function getInboundPlans(orgId: string) {
  const access = await requireInboundAccess();
  if ('error' in access) {
    return [];
  }
  const { supabase } = access;

  return getInboundPlansService(supabase, orgId);
}

// 입고 예정 상세 조회 (수정용)
export async function getInboundPlanDetail(planId: string) {
    const access = await requireInboundAccess();
    if ('error' in access) {
        return null;
    }
    const { supabase } = access;

    return getInboundPlanDetailService(supabase, planId);
}


// 입고 예정 등록
export async function createInboundPlan(formData: FormData) {
  const access = await requireInboundAccess();
  if ('error' in access) {
    return actionError('FORBIDDEN', access.error);
  }
  const { supabase, user } = access;
  try {
    await createInboundPlanService(supabase, user?.id, formData);
    revalidatePath('/admin/inbound');
    revalidatePath('/inbound');
    return actionSuccess({ success: true });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'createInboundPlan' });
    return actionError('INVALID', error?.message || '입고 예정 생성에 실패했습니다.');
  }
}

// 입고 예정 수정
export async function updateInboundPlan(planId: string, formData: FormData) {
    const access = await requireInboundAccess();
    if ('error' in access) {
        return actionError('FORBIDDEN', access.error);
    }
    const { supabase, user } = access;
    const adminUser = await isAdminUser(supabase, user?.id);

    if (!adminUser) {
        return actionError('FORBIDDEN', '관리자 권한이 필요합니다.');
    }
    try {
        await updateInboundPlanService(supabase, user?.id, adminUser, planId, formData);
        revalidatePath('/admin/inbound');
        revalidatePath('/inbound');
        return actionSuccess({ success: true });
    } catch (error: any) {
        const message = error?.message || '수정 중 오류가 발생했습니다.';
        const code = /수정할 수 없습니다/.test(message) ? 'CONFLICT' : 'INVALID';
        logger.error(error, { scope: 'inbound', action: 'updateInboundPlan' });
        return actionError(code as ActionErrorCode, message);
    }
}

// 입고 예정 삭제 (New Feature)
export async function deleteInboundPlan(planId: string) {
    const access = await requireInboundAccess();
    if ('error' in access) {
        return actionError('FORBIDDEN', access.error);
    }
    const { supabase, user } = access;
    const adminUser = await isAdminUser(supabase, user?.id);

    if (!adminUser) {
        return actionError('FORBIDDEN', '관리자 권한이 필요합니다.');
    }

    try {
        await deleteInboundPlanService(supabase, user?.id, adminUser, planId);
        revalidatePath('/admin/inbound');
        revalidatePath('/inbound');
        return actionSuccess({ success: true });
    } catch (error: any) {
        const message = error?.message || '삭제 중 오류가 발생했습니다.';
        const code = /삭제할 수 없습니다/.test(message) ? 'CONFLICT' : 'UNKNOWN';
        logger.error(error, { scope: 'inbound', action: 'deleteInboundPlan' });
        return actionError(code as ActionErrorCode, message);
    }
}

// 사진 업로드 정보 저장 (Storage 업로드 후 호출)
export async function saveInboundPhoto(photoData: any, options?: { requireAdmin?: boolean }) {
    const access = await requireInboundAccess(options);
    if ('error' in access) {
        throw new Error(access.error);
    }
    const { supabase, user } = access;
    const db = supabase;

    await saveInboundPhotoService(db, user?.id, photoData);
    revalidatePath(`/ops/inbound/${photoData.receipt_id}`);
}

// 입고 수량 저장 (Line별 업데이트)
export async function saveReceiptLines(
    receiptId: string,
    lines: any[],
    options?: { requireAdmin?: boolean }
) {
    try {
        const access = await requireInboundAccess(options);
        if ('error' in access) {
            return actionError('FORBIDDEN', access.error);
        }
        const { supabase, user } = access;
        const db = supabase;
        
        await saveReceiptLinesService(db, user?.id, receiptId, lines);
        
        revalidatePath(`/ops/inbound/${receiptId}`);
        revalidatePath('/inbound');
        revalidatePath('/admin/inbound');
        return actionSuccess({ success: true });
    } catch (err: any) {
        logger.error(err, { scope: 'inbound', action: 'saveReceiptLines' });
        return actionError('UNKNOWN', err?.message || '저장 중 오류가 발생했습니다.');
    }
}

// 검수 완료 처리 (RPC 사용) + 비즈니스 로직 강화
export async function confirmReceipt(receiptId: string, options?: { requireAdmin?: boolean }) {
    const access = await requireInboundAccess(options);
    if ('error' in access) {
        return actionError('FORBIDDEN', access.error);
    }
    const { supabase, user } = access;
    const db = supabase;
    const userId = user?.id ?? null;
    try {
        const result = await confirmReceiptService(db, userId, receiptId);
        if (result.discrepancy) {
            revalidatePath(`/ops/inbound/${receiptId}`);
            revalidatePath('/inbound');
            return actionError(
              'CONFLICT',
              '수량 차이 또는 이슈가 발견되어 "이슈 발생" 상태로 변경되었습니다. 관리자 확인이 필요합니다.'
            );
        }
        revalidatePath(`/ops/inbound/${receiptId}`);
        revalidatePath('/inbound');
        return actionSuccess({ success: true });
    } catch (error: any) {
        logger.error(error, { scope: 'inbound', action: 'confirmReceipt' });
        return actionError('UNKNOWN', error?.message || '검수 완료 처리 중 오류가 발생했습니다.');
    }
}

// 현장(새창) 데이터 조회 - 로그인 없을 때도 동작
export async function getOpsInboundData(planId: string, options?: { requireAdmin?: boolean }) {
    const access = await requireInboundAccess(options);
    if ('error' in access) {
        return { error: access.error };
    }
    const { supabase } = access;
    const db = supabase;
    try {
        return await getOpsInboundDataService(db, planId);
    } catch (error: any) {
        return { error: error?.message || 'Receipt not found' };
    }
}
