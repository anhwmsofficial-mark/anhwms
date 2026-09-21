'use server';

import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { ERROR_CODES, type AppErrorCode } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { resolvePartnerInboundCustomer } from '@/lib/partner/ybk-customer';

function actionError(code: AppErrorCode, message: string) {
  return {
    ok: false as const,
    error: message,
    errorCode: code,
    errorDetail: { code, message },
  };
}

function actionSuccess<T extends Record<string, any>>(payload: T) {
  return { ok: true as const, ...payload };
}

async function requirePartnerInboundAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return actionError(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다.');
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, status, org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    return actionError(ERROR_CODES.FORBIDDEN, '권한 정보를 확인할 수 없습니다.');
  }
  if (profile.status && profile.status !== 'active') {
    return actionError(ERROR_CODES.FORBIDDEN, '계정이 비활성화되었습니다.');
  }
  if (profile.role !== 'partner') {
    return actionError(ERROR_CODES.FORBIDDEN, '파트너 계정만 접근할 수 있습니다.');
  }
  if (!profile.org_id) {
    return actionError(ERROR_CODES.FORBIDDEN, '조직 정보가 없는 계정입니다.');
  }

  return { user, profile };
}

export async function getPartnerInboundList(page = 1, limit = 20) {
  const access = await requirePartnerInboundAccess();
  if ('error' in access) return access;

  const db = createTrackedAdminClient({
    route: 'partner_inbound',
    action: 'getPartnerInboundList',
  }) as any;
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const offset = (safePage - 1) * safeLimit;

  try {
    const customer = await resolvePartnerInboundCustomer(db, access.profile.org_id);
    const { data, error, count } = await db
      .from('inbound_receipts')
      .select(
        `
          id,
          receipt_no,
          status,
          confirmed_at,
          created_at,
          client:client_id(name, code),
          plan:plan_id(plan_no, planned_date)
        `,
        { count: 'exact' },
      )
      .eq('org_id', access.profile.org_id)
      .eq('client_id', customer.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    if (error) throw error;

    const total = count || 0;
    return actionSuccess({
      data: {
        customerName: customer.name,
        items: (data || []).map((row: any) => ({
          id: row.id,
          receiptNo: row.receipt_no,
          planNo: row.plan?.plan_no || '',
          plannedDate: row.plan?.planned_date || '',
          clientName: row.client?.name || customer.name,
          status: row.status,
          confirmedAt: row.confirmed_at,
        })),
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        },
      },
    });
  } catch (error: any) {
    logger.error(error, { scope: 'partner-inbound', action: 'getPartnerInboundList' });
    return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '입고 목록을 불러오지 못했습니다.');
  }
}

export async function getPartnerInboundDetail(receiptId: string) {
  const access = await requirePartnerInboundAccess();
  if ('error' in access) return access;

  const db = createTrackedAdminClient({
    route: 'partner_inbound',
    action: 'getPartnerInboundDetail',
  }) as any;

  try {
    const customer = await resolvePartnerInboundCustomer(db, access.profile.org_id);
    const { data: receipt, error: receiptError } = await db
      .from('inbound_receipts')
      .select(`
        *,
        client:client_id(name, code, address_line1, address_line2, city, contact_name, contact_phone),
        plan:plan_id(plan_no, planned_date, inbound_manager, notes),
        warehouse:warehouse_id(name, address_line1, address_line2, city)
      `)
      .eq('id', receiptId)
      .eq('org_id', access.profile.org_id)
      .eq('client_id', customer.id)
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

    const slots = slotDataResult.error ? [] : slotDataResult.data || [];
    const slotsWithPhotos = await Promise.all(
      slots.map(async (slot: any) => {
        const { data: photos } = await db
          .from('inbound_photos')
          .select('*')
          .eq('org_id', access.profile.org_id)
          .eq('receipt_id', receipt.id)
          .eq('slot_id', slot.id)
          .eq('is_deleted', false)
          .order('uploaded_at', { ascending: false });

        return {
          ...slot,
          photos: (photos || []).map((photo: any) => ({
            ...photo,
            url: db.storage
              .from(photo.storage_bucket || 'inbound')
              .getPublicUrl(photo.storage_path).data.publicUrl,
          })),
        };
      }),
    );

    return actionSuccess({
      data: {
        receipt,
        lines: displayLines,
        snapshots: snapshotMap,
        slots: slotsWithPhotos,
      },
    });
  } catch (error: any) {
    logger.error(error, { scope: 'partner-inbound', action: 'getPartnerInboundDetail' });
    return actionError(ERROR_CODES.INTERNAL_ERROR, error?.message || '입고 상세를 불러오지 못했습니다.');
  }
}
