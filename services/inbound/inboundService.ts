import { logAudit } from '@/utils/audit';
import { logger } from '@/lib/logger';

async function logInboundEvent(
  db: any,
  receiptId: string,
  eventType: string,
  payload: any,
  userId?: string,
) {
  try {
    const { data: receipt } = await db
      .from('inbound_receipts')
      .select('org_id')
      .eq('id', receiptId)
      .single();
    if (!receipt) return;

    await db.from('inbound_events').insert({
      org_id: receipt.org_id,
      receipt_id: receiptId,
      event_type: eventType,
      payload,
      actor_id: userId,
    });
  } catch (e) {
    logger.error(e as Error, { scope: 'inbound', action: 'logInboundEvent' });
  }
}

export async function getInboundPlansService(db: any, orgId: string) {
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

export async function getInboundPlanDetailService(db: any, planId: string) {
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

export async function createInboundPlanService(
  db: any,
  userId: string | undefined,
  formData: FormData,
) {
  const org_id = formData.get('org_id') as string;
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

  const { data: plan, error: planError } = await db
    .from('inbound_plans')
    .insert({
      org_id,
      warehouse_id,
      client_id,
      plan_no,
      planned_date,
      inbound_manager,
      status: 'SUBMITTED',
      notes,
      created_by: userId,
    })
    .select()
    .single();

  if (planError) {
    throw new Error(planError.message);
  }

  const linesJson = formData.get('lines') as string;
  if (linesJson) {
    const lines = JSON.parse(linesJson);
    const linesToInsert = lines.map((line: any) => ({
      org_id,
      plan_id: plan.id,
      product_id: line.product_id,
      expected_qty: parseInt(line.expected_qty),
      notes: line.notes,
      box_count: line.box_count || null,
      pallet_text: line.pallet_text || null,
      mfg_date: line.mfg_date || null,
      expiry_date: line.expiry_date || null,
      line_notes: line.line_notes || null,
    }));

    const { error: linesError } = await db
      .from('inbound_plan_lines')
      .insert(linesToInsert);

    if (linesError) {
      logger.error(linesError, { scope: 'inbound', action: 'createInboundPlanLines' });
      throw new Error(linesError.message);
    }
  }

  const receipt_no = `INR-${dateStr}-${randomStr}`;
  const { data: receipt, error: receiptError } = await db
    .from('inbound_receipts')
    .insert({
      org_id,
      warehouse_id,
      client_id,
      plan_id: plan.id,
      receipt_no,
      status: 'ARRIVED',
      created_by: userId,
    })
    .select()
    .single();

  if (receiptError) {
    logger.error(receiptError, { scope: 'inbound', action: 'createReceipt' });
  } else {
    const defaultSlots = [
      { key: 'VEHICLE_LEFT', title: '차량 개방(좌)', min: 1 },
      { key: 'VEHICLE_RIGHT', title: '차량 개방(우)', min: 1 },
      { key: 'PRODUCT_FULL', title: '상품 전체', min: 1 },
      { key: 'BOX_OUTER', title: '박스 외관', min: 1 },
      { key: 'LABEL_CLOSEUP', title: '송장/라벨', min: 1 },
      { key: 'UNBOXED', title: '개봉 후 상태', min: 1 },
    ];

    const slotsToInsert = defaultSlots.map((slot, idx) => ({
      org_id,
      receipt_id: receipt.id,
      slot_key: slot.key,
      title: slot.title,
      is_required: true,
      min_photos: slot.min,
      sort_order: idx,
    }));

    await db.from('inbound_photo_slots').insert(slotsToInsert);
    await logInboundEvent(db, receipt.id, 'CREATED', { plan_no, receipt_no }, userId);
  }

  await logAudit({
    actionType: 'CREATE',
    resourceType: 'inventory',
    resourceId: plan.id,
    newValue: { plan_no, receipt_no, org_id, warehouse_id, client_id },
  });

  return { planId: plan.id, planNo: plan_no };
}

export async function updateInboundPlanService(
  db: any,
  userId: string | undefined,
  isAdmin: boolean,
  planId: string,
  formData: FormData,
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('id, status')
    .eq('plan_id', planId)
    .single();

  if (receipt && ['CONFIRMED', 'PUTAWAY_READY', 'DISCREPANCY'].includes(receipt.status) && !isAdmin) {
    throw new Error('이미 처리된 입고 건은 수정할 수 없습니다.');
  }

  const client_id = formData.get('client_id') as string;
  const warehouse_id = formData.get('warehouse_id') as string;
  const planned_date = formData.get('planned_date') as string;
  const inbound_manager = formData.get('inbound_manager') as string;
  const notes = formData.get('notes') as string;

  const { error: planError } = await db
    .from('inbound_plans')
    .update({
      client_id,
      warehouse_id,
      planned_date,
      inbound_manager,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId);

  if (planError) throw new Error(planError.message);

  if (receipt) {
    await db
      .from('inbound_receipts')
      .update({
        client_id,
        warehouse_id,
      })
      .eq('id', receipt.id);
  }

  const org_id = formData.get('org_id') as string;
  const linesJson = formData.get('lines') as string;

  if (linesJson) {
    const lines = JSON.parse(linesJson);
    await db.from('inbound_plan_lines').delete().eq('plan_id', planId);

    const linesToInsert = lines.map((line: any) => ({
      org_id,
      plan_id: planId,
      product_id: line.product_id,
      expected_qty: parseInt(line.expected_qty),
      notes: line.notes,
      box_count: line.box_count || null,
      pallet_text: line.pallet_text || null,
      mfg_date: line.mfg_date || null,
      expiry_date: line.expiry_date || null,
      line_notes: line.line_notes || null,
    }));

    const { error: linesError } = await db
      .from('inbound_plan_lines')
      .insert(linesToInsert);

    if (linesError) {
      logger.error(linesError, { scope: 'inbound', action: 'updateInboundPlanLines' });
      throw new Error(linesError.message);
    }
  }

  if (receipt) {
    await logInboundEvent(db, receipt.id, 'UPDATED', { updated_by: userId }, userId);
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
  db: any,
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
  db: any,
  userId: string | undefined,
  photoData: any,
) {
  const { error } = await db.from('inbound_photos').insert({
    ...photoData,
    uploaded_by: userId,
  });

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
  db: any,
  userId: string | undefined,
  receiptId: string,
  lines: any[],
) {
  const { data: receipt } = await db
    .from('inbound_receipts')
    .select('org_id, status')
    .eq('id', receiptId)
    .single();
  if (!receipt) throw new Error('Receipt not found');

  const { data: existingLines, error: existingLinesError } = await db
    .from('inbound_receipt_lines')
    .select('id, plan_line_id')
    .eq('receipt_id', receiptId);
  if (existingLinesError) throw new Error(existingLinesError.message);

  const existingLineMap = new Map(
    (existingLines || [])
      .filter((l: any) => l.plan_line_id)
      .map((l: any) => [l.plan_line_id, l.id]),
  );

  let hasChanges = false;
  const errors: string[] = [];

  let locationColumnAvailable = true;

  for (const line of lines) {
    const normalQty = Number(line.received_qty || 0);
    const damagedQty = Number(line.damaged_qty || 0);
    const missingQty = Number(line.missing_qty || 0);
    const otherQty = Number(line.other_qty || 0);
    const totalReceived = normalQty + damagedQty + missingQty + otherQty;

    const lineData: any = {
      org_id: receipt.org_id,
      receipt_id: receiptId,
      plan_line_id: line.plan_line_id,
      product_id: line.product_id,
      expected_qty: line.expected_qty,
      received_qty: totalReceived,
      accepted_qty: normalQty,
      damaged_qty: damagedQty,
      missing_qty: missingQty,
      other_qty: otherQty,
      updated_at: new Date().toISOString(),
      inspected_by: userId,
      inspected_at: new Date().toISOString(),
    };
    if (locationColumnAvailable) {
      lineData.location_id = line.location_id || null;
    }

    const targetId = line.receipt_line_id || existingLineMap.get(line.plan_line_id);
    if (targetId) {
      let { error } = await db.from('inbound_receipt_lines').update(lineData).eq('id', targetId);
      if (error && locationColumnAvailable && /location_id/i.test(error.message)) {
        locationColumnAvailable = false;
        delete lineData.location_id;
        ({ error } = await db.from('inbound_receipt_lines').update(lineData).eq('id', targetId));
      }
      if (error) errors.push(error.message);
      else hasChanges = true;
    } else {
      let { error } = await db.from('inbound_receipt_lines').insert(lineData);
      if (error && locationColumnAvailable && /location_id/i.test(error.message)) {
        locationColumnAvailable = false;
        delete lineData.location_id;
        ({ error } = await db.from('inbound_receipt_lines').insert(lineData));
      }
      if (error) errors.push(error.message);
      else hasChanges = true;
    }
  }

  if (['ARRIVED', 'PHOTO_REQUIRED'].includes(receipt.status)) {
    await db
      .from('inbound_receipts')
      .update({ status: 'COUNTING', updated_at: new Date().toISOString() })
      .eq('id', receiptId);
  } else {
    await db
      .from('inbound_receipts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', receiptId);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }

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

export async function confirmReceiptService(
  db: any,
  userId: string | null,
  receiptId: string,
) {
  const { data: photoCheck } = await db
    .from('v_inbound_receipt_photo_progress')
    .select('*')
    .eq('receipt_id', receiptId);

  const missingPhotos = photoCheck?.filter((slot: any) => !slot.slot_ok) || [];
  if (missingPhotos.length > 0) {
    const missingNames = missingPhotos.map((s: any) => s.title).join(', ');
    throw new Error(`필수 사진이 누락되었습니다: ${missingNames}`);
  }

  const { data: lines } = await db
    .from('inbound_receipt_lines')
    .select('*')
    .eq('receipt_id', receiptId);

  let hasDiscrepancy = false;
  const discrepancyDetails: any[] = [];

  lines?.forEach((line: any) => {
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

  return { discrepancy: false };
}

export async function getOpsInboundDataService(db: any, planId: string, shareReceiptId?: string) {
  const { data: receipt, error: receiptError } = await db
    .from('inbound_receipts')
    .select('*, client:client_id (name)')
    .eq('plan_id', planId)
    .single();

  if (receiptError || !receipt) {
    throw new Error(receiptError?.message || 'Receipt not found');
  }

  if (shareReceiptId && shareReceiptId !== receipt.id) {
    throw new Error('공유 링크에 대한 접근 권한이 없습니다.');
  }

  const { data: locations } = await db
    .from('location')
    .select('*')
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
