import { logAudit } from '@/utils/audit';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireTenantId } from '@/utils/supabase/tenant-security';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

type InboundPlanLineInput = {
  product_id: string;
  expected_qty: number | string;
  notes?: string | null;
  box_count?: number | null;
  pallet_text?: string | null;
  mfg_date?: string | null;
  expiry_date?: string | null;
  line_notes?: string | null;
};

type ReceiptLineInput = {
  plan_line_id?: string | null;
  receipt_line_id?: string | null;
  product_id: string;
  expected_qty: number;
  received_qty?: number;
  accepted_qty?: number;
  damaged_qty?: number;
  missing_qty?: number;
  other_qty?: number;
  location_id?: string | null;
  notes?: string | null;
};

type ReceiptInspectionInput = {
  product_id: string;
  expected_qty: number;
  received_qty: number;
  rejected_qty: number;
  condition?: string | null;
  note?: string | null;
  photos?: string[] | null;
  inspected_at?: string | null;
};

type ReceiptLineRow = {
  id: string;
  plan_line_id: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};
type PhotoProgressRow = { slot_ok?: boolean; title?: string | null };
type ReceiptLineRowFull = {
  product_id: string;
  expected_qty: number;
  accepted_qty?: number;
  received_qty?: number;
  damaged_qty?: number;
  missing_qty?: number;
  other_qty?: number;
};

async function logInboundEvent(
  db: SupabaseClient,
  receiptId: string,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
) {
  try {
    const { data: receipt } = await db
      .from('inbound_receipts')
      .select('org_id')
      .eq('id', receiptId)
      .single();
    if (!receipt) return;

    const orgId = requireTenantId(receipt.org_id);

    await db.from('inbound_events').insert({
      org_id: orgId,
      tenant_id: orgId,
      receipt_id: receiptId,
      event_type: eventType,
      payload,
      actor_id: userId,
    });
  } catch (e) {
    logger.error(e as Error, { scope: 'inbound', action: 'logInboundEvent' });
  }
}

export async function getInboundPlansService(db: SupabaseClient, orgId: string) {
  const { data, error } = await db
    .from('inbound_plans')
    .select(
      `
      *,
      inbound_plan_lines (*),
      client:client_id (name)
    `,
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error(error, { scope: 'inbound', action: 'getInboundPlans' });
    return [];
  }

  return data;
}

export async function getInboundPlanDetailService(db: SupabaseClient, planId: string) {
  const { data, error } = await db
    .from('inbound_plans')
    .select(
      `
        *,
        inbound_plan_lines (*),
        client:client_id (id, name, code)
    `,
    )
    .eq('id', planId)
    .single();

  if (error) return null;
  return data;
}

function isMissingCreateInboundPlanRpcError(error: { message?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('create_inbound_plan_full') && message.includes('function');
}

async function createInboundPlanWithoutRpc(params: {
  userId?: string;
  orgId: string;
  planNo: string;
  receiptNo: string;
  planData: {
    warehouse_id: string;
    client_id: string;
    planned_date: string;
    inbound_manager: string;
    notes: string;
  };
  linesToInsert: Record<string, any>[];
  slotsToInsert: Record<string, any>[];
}) {
  const adminDb = createTrackedAdminClient({ route: 'createInboundPlanService:fallback' }) as any;
  const now = new Date().toISOString();
  let planId: string | null = null;
  let receiptId: string | null = null;

  try {
    const { data: createdPlan, error: planError } = await adminDb
      .from('inbound_plans')
      .insert({
        org_id: params.orgId,
        warehouse_id: params.planData.warehouse_id,
        client_id: params.planData.client_id,
        plan_no: params.planNo,
        planned_date: params.planData.planned_date,
        inbound_manager: params.planData.inbound_manager,
        status: 'SUBMITTED',
        notes: params.planData.notes || null,
        created_by: params.userId || null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (planError || !createdPlan?.id) {
      throw planError || new Error('입고 예정 생성에 실패했습니다.');
    }
    const createdPlanId = String(createdPlan.id);
    planId = createdPlanId;

    if (params.linesToInsert.length > 0) {
      const { error: lineError } = await adminDb
        .from('inbound_plan_lines')
        .insert(
          params.linesToInsert.map((line) => ({
            org_id: params.orgId,
            plan_id: createdPlanId,
            product_id: line.product_id,
            expected_qty: line.expected_qty,
            box_count: line.box_count,
            pallet_text: line.pallet_text,
            mfg_date: line.mfg_date,
            expiry_date: line.expiry_date,
            notes: line.notes,
            line_notes: line.line_notes,
            created_at: now,
          })),
        );

      if (lineError) throw lineError;
    }

    const { data: createdReceipt, error: receiptError } = await adminDb
      .from('inbound_receipts')
      .insert({
        org_id: params.orgId,
        warehouse_id: params.planData.warehouse_id,
        client_id: params.planData.client_id,
        plan_id: createdPlanId,
        receipt_no: params.receiptNo,
        status: 'ARRIVED',
        created_by: params.userId || null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (receiptError || !createdReceipt?.id) {
      throw receiptError || new Error('입고 인수증 생성에 실패했습니다.');
    }
    const createdReceiptId = String(createdReceipt.id);
    receiptId = createdReceiptId;

    if (params.slotsToInsert.length > 0) {
      const { error: slotError } = await adminDb
        .from('inbound_photo_slots')
        .insert(
          params.slotsToInsert.map((slot) => ({
            org_id: params.orgId,
            receipt_id: createdReceiptId,
            slot_key: slot.slot_key,
            title: slot.title,
            is_required: slot.is_required,
            min_photos: slot.min_photos,
            sort_order: slot.sort_order,
            created_at: now,
          })),
        );

      if (slotError) throw slotError;
    }

    const { error: eventError } = await adminDb.from('inbound_events').insert({
      org_id: params.orgId,
      receipt_id: createdReceiptId,
      event_type: 'CREATED',
      payload: { plan_no: params.planNo, receipt_no: params.receiptNo, fallback: true },
      actor_id: params.userId || null,
      created_at: now,
    });

    if (eventError) throw eventError;

    return { plan_id: createdPlanId, receipt_id: createdReceiptId };
  } catch (error) {
    if (receiptId) {
      await adminDb.from('inbound_events').delete().eq('receipt_id', receiptId);
      await adminDb.from('inbound_photo_slots').delete().eq('receipt_id', receiptId);
      await adminDb.from('inbound_receipts').delete().eq('id', receiptId);
    }
    if (planId) {
      await adminDb.from('inbound_plan_lines').delete().eq('plan_id', planId);
      await adminDb.from('inbound_plans').delete().eq('id', planId);
    }
    throw error;
  }
}

export async function createInboundPlanService(
  db: SupabaseClient,
  userId: string | undefined,
  formData: FormData,
) {
  const org_id = requireTenantId(formData.get('org_id') as string);
  const warehouse_id = formData.get('warehouse_id') as string;
  const client_id = formData.get('client_id') as string;
  const planned_date = formData.get('planned_date') as string;
  const inbound_manager = formData.get('inbound_manager') as string;
  const notes = formData.get('notes') as string;

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  const plan_no = `INP-${dateStr}-${randomStr}`;
  const receipt_no = `INR-${dateStr}-${randomStr}`;

  // 1. Prepare Plan Data
  const planData = {
    warehouse_id,
    client_id,
    planned_date,
    inbound_manager,
    notes,
  };

  // 2. Prepare Lines Data
  const linesJson = formData.get('lines') as string;
  let linesToInsert: Record<string, any>[] = [];
  if (linesJson) {
    const lines = JSON.parse(linesJson) as InboundPlanLineInput[];
    linesToInsert = lines.map((line) => ({
      product_id: line.product_id,
      expected_qty: parseInt(String(line.expected_qty)),
      notes: line.notes,
      box_count: line.box_count || null,
      pallet_text: line.pallet_text || null,
      mfg_date: line.mfg_date || null,
      expiry_date: line.expiry_date || null,
      line_notes: line.line_notes || null,
    }));
  }

  // 3. Prepare Photo Slots Data
  const defaultSlots = [
    { key: 'VEHICLE_LEFT', title: '차량 개방(좌)', min: 1 },
    { key: 'VEHICLE_RIGHT', title: '차량 개방(우)', min: 1 },
    { key: 'PRODUCT_FULL', title: '상품 전체', min: 1 },
    { key: 'BOX_OUTER', title: '박스 외관', min: 1 },
    { key: 'LABEL_CLOSEUP', title: '송장/라벨', min: 1 },
    { key: 'UNBOXED', title: '개봉 후 상태', min: 1 },
  ];
  const slotsToInsert = defaultSlots.map((slot, idx) => ({
    slot_key: slot.key,
    title: slot.title,
    is_required: true,
    min_photos: slot.min,
    sort_order: idx,
  }));

  // 4. Call RPC (Transaction)
  let rpcResult: any = null;
  const { data, error: rpcError } = await db.rpc('create_inbound_plan_full', {
    p_org_id: org_id,
    p_user_id: userId,
    p_plan_no: plan_no,
    p_receipt_no: receipt_no,
    p_plan_data: planData,
    p_lines: linesToInsert,
    p_slots: slotsToInsert,
  });
  rpcResult = data;

  if (rpcError) {
    if (!isMissingCreateInboundPlanRpcError(rpcError)) {
      logger.error(rpcError, { scope: 'inbound', action: 'createInboundPlanService' });
      throw new Error(rpcError.message);
    }

    logger.warn('create_inbound_plan_full RPC missing, using fallback inserts', {
      scope: 'inbound',
      action: 'createInboundPlanService',
      orgId: org_id,
    });

    rpcResult = await createInboundPlanWithoutRpc({
      userId,
      orgId: org_id,
      planNo: plan_no,
      receiptNo: receipt_no,
      planData,
      linesToInsert,
      slotsToInsert,
    });
  }

  const planId = (rpcResult as any)?.plan_id;

  await logAudit({
    actionType: 'CREATE',
    resourceType: 'inventory',
    resourceId: planId,
    newValue: { plan_no, receipt_no, org_id, warehouse_id, client_id },
  });

  return { planId, planNo: plan_no };
}

export async function updateInboundPlanService(
  db: SupabaseClient,
  userId: string | undefined,
  isAdmin: boolean,
  planId: string,
  formData: FormData,
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('id, status, org_id')
    .eq('plan_id', planId)
    .single();

  if (receipt && ['CONFIRMED', 'PUTAWAY_READY', 'DISCREPANCY'].includes(receipt.status) && !isAdmin) {
    throw new Error('이미 처리된 입고 건은 수정할 수 없습니다.');
  }

  const org_id = requireTenantId(formData.get('org_id') as string || receipt?.org_id);
  const client_id = formData.get('client_id') as string;
  const warehouse_id = formData.get('warehouse_id') as string;
  const planned_date = formData.get('planned_date') as string;
  const inbound_manager = formData.get('inbound_manager') as string;
  const notes = formData.get('notes') as string;

  // 1. Prepare Plan Data
  const planData = {
    client_id,
    warehouse_id,
    planned_date,
    inbound_manager,
    notes,
  };

  // 2. Prepare Lines Data
  const linesJson = formData.get('lines') as string;
  let linesToInsert: Record<string, any>[] = [];

  if (linesJson) {
    const lines = JSON.parse(linesJson) as InboundPlanLineInput[];
    linesToInsert = lines.map((line) => ({
      product_id: line.product_id,
      expected_qty: parseInt(String(line.expected_qty)),
      notes: line.notes,
      box_count: line.box_count || null,
      pallet_text: line.pallet_text || null,
      mfg_date: line.mfg_date || null,
      expiry_date: line.expiry_date || null,
      line_notes: line.line_notes || null,
    }));
  }

  // 3. Call RPC (Transaction)
  const { error: rpcError } = await db.rpc('update_inbound_plan_full', {
    p_plan_id: planId,
    p_org_id: org_id,
    p_user_id: userId,
    p_plan_data: planData,
    p_lines: linesToInsert,
  });

  if (rpcError) {
    logger.error(rpcError, { scope: 'inbound', action: 'updateInboundPlanService' });
    throw new Error(rpcError.message);
  }

  await logAudit({
    actionType: 'UPDATE',
    resourceType: 'inventory',
    resourceId: planId,
    newValue: {
      client_id,
      warehouse_id,
      planned_date,
      inbound_manager,
      notes,
    },
  });
}

export async function deleteInboundPlanService(
  db: SupabaseClient,
  userId: string | undefined,
  isAdmin: boolean,
  planId: string,
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('id, status')
    .eq('plan_id', planId)
    .single();

  if (receipt && ['CONFIRMED', 'PUTAWAY_READY', 'DISCREPANCY'].includes(receipt.status) && !isAdmin) {
    throw new Error('이미 입고 작업이 진행되었거나 완료된 건은 삭제할 수 없습니다.');
  }

  if (receipt) {
    await db.from('inbound_receipts').delete().eq('id', receipt.id);
    await logInboundEvent(db, receipt.id, 'DELETED', { plan_id: planId }, userId);
  }

  const { error } = await db.from('inbound_plans').delete().eq('id', planId);
  if (error) {
    throw new Error(`삭제 중 오류가 발생했습니다: ${error.message}`);
  }

  await logAudit({
    actionType: 'DELETE',
    resourceType: 'inventory',
    resourceId: planId,
    reason: '입고 예정 삭제',
  });
}

export async function saveInboundPhotoService(
  db: SupabaseClient,
  userId: string | undefined,
  photoData: Record<string, unknown> & {
    receipt_id: string;
    slot_id?: string | null;
    org_id?: string | null;
    tenant_id?: string | null;
  },
) {
  const orgId = requireTenantId((typeof photoData.org_id === 'string' ? photoData.org_id : null));

  const insertPhotoData = {
    ...photoData,
    org_id: orgId,
    tenant_id: orgId, // 명시적 주입
    uploaded_by: userId,
  };

  const { error } = await db.from('inbound_photos').insert(insertPhotoData);

  if (error) throw error;

  await db
    .from('inbound_receipts')
    .update({ status: 'PHOTO_REQUIRED' })
    .eq('id', photoData.receipt_id)
    .eq('status', 'ARRIVED');

  await logInboundEvent(
    db,
    photoData.receipt_id,
    'PHOTO_UPLOADED',
    { slot_id: photoData.slot_id },
    userId,
  );
}

export async function saveReceiptLinesService(
  db: SupabaseClient,
  userId: string | undefined,
  receiptId: string,
  lines: ReceiptLineInput[],
  options?: {
    inspectionEntries?: ReceiptInspectionInput[];
    requireFullLineSet?: boolean;
  },
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('org_id, status')
    .eq('id', receiptId)
    .single();
  if (!receipt) throw new Error('Receipt not found');

  const orgId = requireTenantId(receipt.org_id);
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('검수 라인 정보가 필요합니다.');
  }

  const linePayload = lines.map((line) => ({
    receipt_line_id: line.receipt_line_id ?? null,
    plan_line_id: line.plan_line_id ?? null,
    product_id: line.product_id,
    expected_qty: Number(line.expected_qty || 0),
    received_qty: Number(line.received_qty || 0),
    damaged_qty: Number(line.damaged_qty || 0),
    missing_qty: Number(line.missing_qty || 0),
    other_qty: Number(line.other_qty || 0),
    notes: line.notes?.trim() || null,
    location_id: line.location_id || null,
  }));

  const inspectionPayload = (options?.inspectionEntries || []).map((entry) => ({
    product_id: entry.product_id,
    expected_qty: Number(entry.expected_qty || 0),
    received_qty: Number(entry.received_qty || 0),
    rejected_qty: Number(entry.rejected_qty || 0),
    condition: entry.condition || 'GOOD',
    note: entry.note?.trim() || null,
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    inspected_at: entry.inspected_at || new Date().toISOString(),
  }));

  const { data: rpcResult, error: rpcError } = await db.rpc('save_receipt_lines_batch', {
    p_tenant_id: orgId,
    p_receipt_id: receiptId,
    p_actor_id: userId ?? null,
    p_lines: linePayload,
    p_inspections: inspectionPayload,
    p_require_full_line_set: options?.requireFullLineSet ?? false,
  });

  if (rpcError) {
    logger.error(rpcError, { scope: 'inbound', action: 'saveReceiptLinesService' });
    throw new Error(rpcError.message);
  }

  const hasChanges = Boolean((rpcResult as { has_changes?: boolean } | null)?.has_changes);

  if (hasChanges) {
    await logInboundEvent(db, receiptId, 'QTY_UPDATED', { lines_count: lines.length }, userId);
    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'inventory',
      resourceId: receiptId,
      reason: '입고 수량 업데이트',
      newValue: { lines_count: lines.length },
    });
  }

  return { hasChanges };
}

export async function saveInboundInspectionAndTransitionService(
  db: SupabaseClient,
  userId: string | undefined,
  receiptId: string,
  lines: ReceiptLineInput[],
  options?: {
    inspectionEntries?: ReceiptInspectionInput[];
    requireFullLineSet?: boolean;
    finalize?: boolean;
  },
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('org_id, status')
    .eq('id', receiptId)
    .single();
  if (!receipt) throw new Error('Receipt not found');

  const orgId = requireTenantId(receipt.org_id);
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('검수 라인 정보가 필요합니다.');
  }

  const linePayload = lines.map((line) => ({
    receipt_line_id: line.receipt_line_id ?? null,
    plan_line_id: line.plan_line_id ?? null,
    product_id: line.product_id,
    expected_qty: Number(line.expected_qty || 0),
    received_qty: Number(line.received_qty || 0),
    damaged_qty: Number(line.damaged_qty || 0),
    missing_qty: Number(line.missing_qty || 0),
    other_qty: Number(line.other_qty || 0),
    notes: line.notes?.trim() || null,
    location_id: line.location_id || null,
  }));

  const inspectionPayload = (options?.inspectionEntries || []).map((entry) => ({
    product_id: entry.product_id,
    expected_qty: Number(entry.expected_qty || 0),
    received_qty: Number(entry.received_qty || 0),
    rejected_qty: Number(entry.rejected_qty || 0),
    condition: entry.condition || 'GOOD',
    note: entry.note?.trim() || null,
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    inspected_at: entry.inspected_at || new Date().toISOString(),
  }));

  const { data: rpcResult, error: rpcError } = await db.rpc('save_inbound_inspection_and_transition', {
    p_tenant_id: orgId,
    p_receipt_id: receiptId,
    p_actor_id: userId ?? null,
    p_lines: linePayload,
    p_inspections: inspectionPayload,
    p_require_full_line_set: options?.requireFullLineSet ?? false,
    p_finalize: options?.finalize ?? false,
  });

  if (rpcError) {
    logger.error(rpcError, { scope: 'inbound', action: 'saveInboundInspectionAndTransitionService' });
    throw new Error(rpcError.message);
  }

  const result = (rpcResult || {}) as {
    success?: boolean;
    status?: string;
    discrepancy?: boolean;
    details?: unknown;
  };

  const nextStatus = result.status || 'INSPECTING';
  const discrepancy = Boolean(result.discrepancy);

  await logInboundEvent(
    db,
    receiptId,
    'QTY_UPDATED',
    { lines_count: lines.length, next_status: nextStatus },
    userId,
  );

  await logAudit({
    actionType: 'UPDATE',
    resourceType: 'inventory',
    resourceId: receiptId,
    reason: '입고 수량 업데이트',
    newValue: {
      lines_count: lines.length,
      status: nextStatus,
      discrepancy,
    },
  });

  if (options?.finalize) {
    await logInboundEvent(
      db,
      receiptId,
      discrepancy ? 'DISCREPANCY_FOUND' : 'CONFIRMED',
      discrepancy
        ? { details: result.details || [], next_status: nextStatus }
        : { next_status: nextStatus },
      userId,
    );

    await logAudit({
      actionType: discrepancy ? 'UPDATE' : 'APPROVE',
      resourceType: 'inventory',
      resourceId: receiptId,
      reason: discrepancy ? '입고 검수 저장 후 이슈 상태 전환' : '입고 검수 완료',
      newValue: {
        lines_count: lines.length,
        status: nextStatus,
        discrepancy,
      },
    });
  }

  return {
    success: result.success !== false,
    status: nextStatus,
    discrepancy,
    details: result.details,
  };
}

export async function confirmReceiptService(
  db: SupabaseClient,
  userId: string | null,
  receiptId: string,
) {
  const { data: photoCheck } = await db
    .from('v_inbound_receipt_photo_progress')
    .select('*')
    .eq('receipt_id', receiptId);

  const missingPhotos = ((photoCheck || []) as PhotoProgressRow[]).filter((slot) => !slot.slot_ok);
  if (missingPhotos.length > 0) {
    const missingNames = missingPhotos.map((s) => s.title || '').filter(Boolean).join(', ');
    throw new Error(`필수 사진이 누락되었습니다: ${missingNames}`);
  }

  const { data: lines } = await db
    .from('inbound_receipt_lines')
    .select('*')
    .eq('receipt_id', receiptId);

  let hasDiscrepancy = false;
  const discrepancyDetails: Array<{ product_id: string; expected: number; actual: number }> = [];

  (lines as ReceiptLineRowFull[] | null)?.forEach((line) => {
    const normalQty = line.accepted_qty ?? line.received_qty ?? 0;
    const totalReceived =
      normalQty + (line.damaged_qty || 0) + (line.missing_qty || 0) + (line.other_qty || 0);
    if (totalReceived !== line.expected_qty) {
      hasDiscrepancy = true;
      discrepancyDetails.push({
        product_id: line.product_id,
        expected: line.expected_qty,
        actual: totalReceived,
      });
    }
  });

  if (hasDiscrepancy) {
    await db.from('inbound_receipts').update({ status: 'DISCREPANCY' }).eq('id', receiptId);
    await logInboundEvent(
      db,
      receiptId,
      'DISCREPANCY_FOUND',
      { details: discrepancyDetails },
      userId ?? undefined,
    );
    return { discrepancy: true };
  }

  const { data, error } = await db.rpc('confirm_inbound_receipt', {
    p_receipt_id: receiptId,
    p_user_id: userId,
  });

  if (error) {
    logger.error(error, { scope: 'inbound', action: 'confirmReceipt' });
    throw new Error(error.message);
  }

  if (data && !data.success) {
    throw new Error(data.error || '검수 완료 처리 중 오류가 발생했습니다.');
  }

  const alreadyConfirmed = Boolean((data as { already_confirmed?: boolean } | null)?.already_confirmed);

  if (alreadyConfirmed) {
    return { discrepancy: false, alreadyConfirmed: true };
  }

  await logInboundEvent(
    db,
    receiptId,
    'CONFIRMED',
    { next_status: 'PUTAWAY_READY' },
    userId ?? undefined,
  );

  await logAudit({
    actionType: 'APPROVE',
    resourceType: 'inventory',
    resourceId: receiptId,
    reason: '입고 검수 완료',
  });

  return { discrepancy: false, alreadyConfirmed: false };
}

export async function getOpsInboundDataService(
  db: SupabaseClient,
  planId: string,
  shareReceiptId?: string,
  expectedOrgId?: string,
) {
  let receiptQuery = db
    .from('inbound_receipts')
    .select('*, client:client_id (name)')
    .eq('plan_id', planId)
  if (expectedOrgId) {
    receiptQuery = receiptQuery.eq('org_id', expectedOrgId);
  }
  const { data: receipt, error: receiptError } = await receiptQuery.single();

  if (receiptError || !receipt) {
    throw new Error(receiptError?.message || 'Receipt not found');
  }

  if (shareReceiptId && shareReceiptId !== receipt.id) {
    throw new Error('공유 링크에 대한 접근 권한이 없습니다.');
  }

  const { data: locations } = await db
    .from('location')
    .select('*')
    .eq('org_id', receipt.org_id)
    .eq('warehouse_id', receipt.warehouse_id)
    .eq('status', 'ACTIVE')
    .order('code');

  const { data: slots } = await db
    .from('inbound_photo_slots')
    .select('*')
    .eq('receipt_id', receipt.id)
    .order('sort_order');

  const { data: progress } = await db
    .from('v_inbound_receipt_photo_progress')
    .select('*')
    .eq('receipt_id', receipt.id);

  const { data: planLines } = await db
    .from('inbound_plan_lines')
    .select('*, product:products!fk_inbound_plan_lines_product(name, sku, barcode)')
    .eq('plan_id', planId);

  const { data: receiptLines } = await db
    .from('inbound_receipt_lines')
    .select('*')
    .eq('receipt_id', receipt.id);

  return {
    receipt,
    locations: locations || [],
    slots: slots || [],
    progress: progress || [],
    planLines: planLines || [],
    receiptLines: receiptLines || [],
  };
}
