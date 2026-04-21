'use server';

import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
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
import { listManagerUsersAction } from '@/app/actions/admin/users';
import { logger } from '@/lib/logger';
import { ERROR_CODES, type AppErrorCode } from '@/lib/api/errors';

function actionError(code: AppErrorCode, message: string) {
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

type InboundSelectOption = {
  id: string;
  name: string;
  code?: string | null;
};

function isSeededDailyWorkLogCustomer(code: string | null | undefined) {
  return Boolean(code?.startsWith('DWL_CLIENT_'));
}

function dedupeCustomerOptions(options: InboundSelectOption[]) {
  const byName = new Map<string, InboundSelectOption>();

  for (const option of options) {
    const existing = byName.get(option.name);
    if (!existing) {
      byName.set(option.name, option);
      continue;
    }

    const existingIsSeed = isSeededDailyWorkLogCustomer(existing.code);
    const nextIsSeed = isSeededDailyWorkLogCustomer(option.code);

    if (existingIsSeed && !nextIsSeed) {
      byName.set(option.name, option);
      continue;
    }

    if (existingIsSeed === nextIsSeed) {
      const existingCode = existing.code ?? '';
      const nextCode = option.code ?? '';
      if (nextCode.localeCompare(existingCode, 'en') < 0) {
        byName.set(option.name, option);
      }
    }
  }

  return Array.from(byName.values());
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
        return actionError(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다.');
    }

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role, can_access_admin, can_manage_inventory, status, org_id')
        .eq('id', user.id)
        .maybeSingle();

    if (error || !profile) {
        return actionError(ERROR_CODES.FORBIDDEN, '권한 정보를 확인할 수 없습니다.');
    }

    if (profile.status && profile.status !== 'active') {
        return actionError(ERROR_CODES.FORBIDDEN, '계정이 비활성화되었습니다.');
    }

    const isAdmin = profile.role === 'admin' || profile.can_access_admin;
    if (options?.requireAdmin && !isAdmin) {
        return actionError(ERROR_CODES.FORBIDDEN, '슈퍼관리자만 접근할 수 있습니다.');
    }

    const allowedRoles = ['admin', 'manager', 'staff', 'operator'];
    const allowed =
        profile.can_manage_inventory ||
        profile.can_access_admin ||
        allowedRoles.includes(profile.role);

    if (!allowed) {
        return actionError(ERROR_CODES.FORBIDDEN, '재고/입고 권한이 없습니다.');
    }

    return { supabase, user, profile };
}

export async function getInboundCreateMeta() {
  const access = await requireInboundAccess();
  if ('error' in access) {
    return access;
  }

  const { profile } = access;
  const db = createTrackedAdminClient({
    route: 'inbound_action',
    action: 'getInboundCreateMeta',
  }) as any;
  const orgId = profile.org_id;

  try {
    const [customersResult, warehousesResult, managersResult] = await Promise.all([
      db
        .from('customer_master')
        .select('id, name, code')
        .eq('org_id', orgId)
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true }),
      db
        .from('warehouse')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('status', 'ACTIVE')
        .eq('type', 'ANH_OWNED')
        .order('name', { ascending: true }),
      listManagerUsersAction(),
    ]);

    if (customersResult.error) throw customersResult.error;
    if (warehousesResult.error) throw warehousesResult.error;

    const clients = dedupeCustomerOptions(
      (customersResult.data || []).map((row: { id: string; name: string | null; code?: string | null }) => ({
        id: String(row.id),
        name: String(row.name || '-'),
        code: row.code ?? null,
      })),
    ).map((row) => ({
      id: row.id,
      name: row.name,
    }));

    const warehouses = (warehousesResult.data || []).map((row: { id: string; name: string | null }) => ({
      id: String(row.id),
      name: String(row.name || '-'),
    }));

    const managers = managersResult.ok ? managersResult.data.data || [] : [];

    return actionSuccess({
      data: {
        userOrgId: orgId,
        clients,
        warehouses,
        managers,
        defaultWarehouseId: warehouses[0]?.id || '',
      },
    });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'getInboundCreateMeta' });
    return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '입고 등록 메타를 불러오는 중 오류가 발생했습니다.');
  }
}

export async function getInboundDashboardPageData(page = 1, limit = 50) {
  const access = await requireInboundAccess();
  if ('error' in access) {
    return access;
  }

  const { profile } = access;
  const db = createTrackedAdminClient({
    route: 'inbound_action',
    action: 'getInboundDashboardPageData',
  }) as any;
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 50)));
  const offset = (safePage - 1) * safeLimit;
  const orgId = profile.org_id;

  try {
    const today = new Date().toISOString().split('T')[0];

    const [todayExpectedResult, pendingResult, issuesResult, recentCompletedResult, plansResult] =
      await Promise.all([
        db
          .from('inbound_plans')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('planned_date', today),
        db
          .from('inbound_receipts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']),
        db
          .from('inbound_receipts')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'DISCREPANCY'),
        db
          .from('inbound_receipts')
          .select(`
            id,
            receipt_no,
            confirmed_at,
            client:client_id(name)
          `)
          .eq('org_id', orgId)
          .eq('status', 'CONFIRMED')
          .order('confirmed_at', { ascending: false })
          .limit(5),
        db
          .from('inbound_plans')
          .select(
            '*, client:client_id(name), inbound_plan_lines(*, product:products!fk_inbound_plan_lines_product(name, sku, barcode))',
            { count: 'exact' },
          )
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .range(offset, offset + safeLimit - 1),
      ]);

    if (todayExpectedResult.error) throw todayExpectedResult.error;
    if (pendingResult.error) throw pendingResult.error;
    if (issuesResult.error) throw issuesResult.error;
    if (recentCompletedResult.error) throw recentCompletedResult.error;
    if (plansResult.error) throw plansResult.error;

    const plans = plansResult.data || [];
    const planIds = plans.map((plan: { id: string }) => plan.id);

    const receiptsResult = planIds.length
      ? await db
          .from('inbound_receipts')
          .select(
            '*, lines:inbound_receipt_lines(accepted_qty, received_qty, damaged_qty, missing_qty, other_qty), photos:inbound_photos(count)',
          )
          .eq('org_id', orgId)
          .in('plan_id', planIds)
      : { data: [], error: null };

    if (receiptsResult.error) throw receiptsResult.error;

    const receipts = receiptsResult.data || [];
    const items = plans.map((plan: any) => {
      const receipt = receipts.find((current: any) => current.plan_id === plan.id);
      const totalExpected =
        plan.inbound_plan_lines?.reduce((sum: number, line: any) => sum + line.expected_qty, 0) || 0;
      const totalNormal =
        receipt?.lines?.reduce((sum: number, line: any) => {
          const normalQty = line.accepted_qty ?? line.received_qty ?? 0;
          return sum + normalQty;
        }, 0) || 0;
      const issueCounts =
        receipt?.lines?.reduce(
          (acc: { damaged: number; missing: number; other: number }, line: any) => {
            acc.damaged += line.damaged_qty || 0;
            acc.missing += line.missing_qty || 0;
            acc.other += line.other_qty || 0;
            return acc;
          },
          { damaged: 0, missing: 0, other: 0 },
        ) || { damaged: 0, missing: 0, other: 0 };
      const totalActual = totalNormal + issueCounts.damaged + issueCounts.missing + issueCounts.other;
      const photoCount = receipt?.photos?.[0]?.count || 0;
      const hasPhotos = photoCount > 0;

      let displayStatus = plan.status;
      if (receipt) displayStatus = receipt.status;
      const hasMismatch = totalExpected !== totalActual && totalActual > 0;
      if (displayStatus === 'DISCREPANCY' && !hasMismatch) {
        displayStatus = 'CONFIRMED';
      }

      return {
        ...plan,
        receipt_id: receipt?.id,
        displayStatus,
        totalExpected,
        totalNormal,
        totalActual,
        hasPhotos,
        photoCount,
        issueCounts,
        hasMismatch,
      };
    });

    const total = plansResult.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return actionSuccess({
      data: {
        stats: {
          todayExpected: todayExpectedResult.count || 0,
          pending: pendingResult.count || 0,
          issues: issuesResult.count || 0,
          recentCompleted: recentCompletedResult.data || [],
        },
        plans: items,
        pagination: {
          page: safePage,
          totalPages,
          total,
          limit: safeLimit,
        },
      },
    });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'getInboundDashboardPageData' });
    return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '입고 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

export async function getInboundAdminDetailData(receiptId: string) {
  const access = await requireInboundAccess();
  if ('error' in access) {
    return access;
  }

  const { profile } = access;
  const db = createTrackedAdminClient({
    route: 'inbound_action',
    action: 'getInboundAdminDetailData',
  }) as any;
  const orgId = profile.org_id;

  try {
    const { data: receipt, error: receiptError } = await db
      .from('inbound_receipts')
      .select(`
        *,
        client:client_id(name, address_line1, address_line2, city, contact_name, contact_phone),
        plan:plan_id(plan_no, planned_date, inbound_manager, notes),
        warehouse:warehouse_id(name, address_line1, address_line2, city)
      `)
      .eq('id', receiptId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (receiptError) throw receiptError;
    if (!receipt) {
      return actionError(ERROR_CODES.NOT_FOUND, '입고 정보를 찾을 수 없습니다.');
    }

    const [receiptLinesResult, planLinesResult, snapshotRowsResult, slotDataResult] = await Promise.all([
      db
        .from('inbound_receipt_lines')
        .select('*, product:products!fk_inbound_receipt_lines_product(name, sku, barcode)')
        .eq('receipt_id', receipt.id),
      db
        .from('inbound_plan_lines')
        .select('*, product:products!fk_inbound_plan_lines_product(name, sku, barcode)')
        .eq('plan_id', receipt.plan_id),
      db
        .from('inbound_inventory_snapshots')
        .select('product_id, qty_before, qty_after')
        .eq('receipt_id', receipt.id),
      db
        .from('inbound_photo_slots')
        .select('*')
        .eq('receipt_id', receipt.id)
        .order('sort_order'),
    ]);

    const safeReceiptLines = receiptLinesResult.error ? [] : receiptLinesResult.data || [];
    const safePlanLines = planLinesResult.error ? [] : planLinesResult.data || [];
    const planLineMap = new Map<string, any>(safePlanLines.map((line: any) => [line.id, line]));

    let displayLines: any[] = [];
    if (safePlanLines.length > 0) {
      displayLines = safePlanLines.map((planLine: any) => {
        const receiptLine = safeReceiptLines.find((line: any) => line.plan_line_id === planLine.id);
        return {
          ...planLine,
          receipt_line_id: receiptLine?.id,
          received_qty: (receiptLine?.accepted_qty ?? receiptLine?.received_qty) || 0,
          accepted_qty: receiptLine?.accepted_qty ?? null,
          damaged_qty: receiptLine?.damaged_qty || 0,
          missing_qty: receiptLine?.missing_qty || 0,
          other_qty: receiptLine?.other_qty || 0,
          field_check_notes: receiptLine?.notes || '',
          product: receiptLine?.product || planLine.product,
        };
      });
    } else if (safeReceiptLines.length > 0) {
      displayLines = safeReceiptLines.map((receiptLine: any) => ({
        ...receiptLine,
        product: receiptLine.product,
        plan_line_id: receiptLine.plan_line_id,
        expected_qty: planLineMap.get(receiptLine.plan_line_id)?.expected_qty,
        box_count: planLineMap.get(receiptLine.plan_line_id)?.box_count,
        pallet_text: planLineMap.get(receiptLine.plan_line_id)?.pallet_text,
        mfg_date: planLineMap.get(receiptLine.plan_line_id)?.mfg_date,
        expiry_date: planLineMap.get(receiptLine.plan_line_id)?.expiry_date,
        line_notes: planLineMap.get(receiptLine.plan_line_id)?.line_notes,
        field_check_notes: receiptLine?.notes || '',
      }));
    }

    const snapshotMap: Record<string, { before: number; after: number }> = {};
    (snapshotRowsResult.data || []).forEach((row: any) => {
      snapshotMap[row.product_id] = {
        before: Number(row.qty_before || 0),
        after: Number(row.qty_after || 0),
      };
    });

    return actionSuccess({
      data: {
        receipt,
        lines: displayLines,
        snapshots: snapshotMap,
        slots: slotDataResult.error ? [] : slotDataResult.data || [],
      },
    });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'getInboundAdminDetailData' });
    return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '입고 상세를 불러오는 중 오류가 발생했습니다.');
  }
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
    return actionError(ERROR_CODES.VALIDATION_ERROR, error?.message || '입고 예정 생성에 실패했습니다.');
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
        const code = /수정할 수 없습니다/.test(message) ? ERROR_CODES.CONFLICT : ERROR_CODES.VALIDATION_ERROR;
        logger.error(error, { scope: 'inbound', action: 'updateInboundPlan' });
        return actionError(code, message);
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
        const code = /삭제할 수 없습니다/.test(message) ? ERROR_CODES.CONFLICT : ERROR_CODES.INTERNAL_ERROR;
        logger.error(error, { scope: 'inbound', action: 'deleteInboundPlan' });
        return actionError(code, message);
    }
}

// 사진 업로드 정보 저장 (Storage 업로드 후 호출)
export async function saveInboundPhoto(photoData: any, options?: { requireAdmin?: boolean }) {
    try {
        const access = await requireInboundAccess(options);
        if ('error' in access) {
            return actionError('FORBIDDEN', access.error);
        }
        const { supabase, user } = access;
        const db = options?.requireAdmin ? createTrackedAdminClient({ route: 'inbound_action' }) : supabase;
        const { plan_id: planId, ...photoInsertData } = (photoData || {}) as Record<string, any>;
        if (!photoInsertData?.receipt_id) {
            return actionError(ERROR_CODES.VALIDATION_ERROR, 'receipt_id가 필요합니다.');
        }

        await saveInboundPhotoService(
            db,
            user?.id,
            photoInsertData as Record<string, unknown> & {
                receipt_id: string;
                slot_id?: string | null;
                org_id?: string | null;
                tenant_id?: string | null;
            },
        );

        // 현장 화면은 plan_id 기반 라우트이므로 plan_id가 있으면 우선 사용
        const targetPath = planId
            ? `/ops/inbound/${planId}`
            : `/ops/inbound/${photoInsertData.receipt_id}`;
        revalidatePath(targetPath);
        revalidatePath('/inbound');
        return actionSuccess({ success: true });
    } catch (error: any) {
        logger.error(error, { scope: 'inbound', action: 'saveInboundPhoto' });
        return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '사진 업로드 정보 저장 중 오류가 발생했습니다.');
    }
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
        const db = options?.requireAdmin ? createTrackedAdminClient({ route: 'inbound_action' }) : supabase;
        
        await saveReceiptLinesService(db, user?.id, receiptId, lines);
        
        revalidatePath(`/ops/inbound/${receiptId}`);
        revalidatePath('/inbound');
        revalidatePath('/admin/inbound');
        return actionSuccess({ success: true });
    } catch (err: any) {
        logger.error(err, { scope: 'inbound', action: 'saveReceiptLines' });
        return actionError(ERROR_CODES.INTERNAL_ERROR, err?.message || '저장 중 오류가 발생했습니다.');
    }
}

// 검수 완료 처리 (RPC 사용) + 비즈니스 로직 강화
export async function confirmReceipt(receiptId: string, options?: { requireAdmin?: boolean }) {
    const access = await requireInboundAccess(options);
    if ('error' in access) {
        return actionError('FORBIDDEN', access.error);
    }
    const { supabase, user } = access;
    const db = options?.requireAdmin ? createTrackedAdminClient({ route: 'inbound_action', action: 'confirmReceipt' }) : supabase;
    const userId = user?.id ?? null;
    try {
        const result = await confirmReceiptService(db, userId, receiptId);
        if (result.discrepancy) {
            revalidatePath(`/ops/inbound/${receiptId}`);
            revalidatePath('/inbound');
            return actionError(
              ERROR_CODES.CONFLICT,
              '수량 차이 또는 이슈가 발견되어 "이슈 발생" 상태로 변경되었습니다. 관리자 확인이 필요합니다.'
            );
        }
        revalidatePath(`/ops/inbound/${receiptId}`);
        revalidatePath('/inbound');
        return actionSuccess({ success: true });
    } catch (error: any) {
        logger.error(error, { scope: 'inbound', action: 'confirmReceipt' });
        return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '검수 완료 처리 중 오류가 발생했습니다.');
    }
}

// 현장(새창) 데이터 조회 - 로그인 없을 때도 동작
export async function getOpsInboundData(planId: string, options?: { requireAdmin?: boolean }) {
    const access = await requireInboundAccess(options);
    if ('error' in access) {
        return { error: access.error };
    }
    const { supabase, profile } = access;
    const db = options?.requireAdmin ? createTrackedAdminClient({ route: 'inbound_action', action: 'getOpsInboundData' }) : supabase;
    try {
        return await getOpsInboundDataService(db, planId, undefined, profile.org_id || undefined);
    } catch (error: any) {
        return { error: error?.message || 'Receipt not found' };
    }
}
