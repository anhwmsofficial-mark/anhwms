'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// 이벤트 로깅 헬퍼
async function logInboundEvent(supabase: any, receiptId: string, eventType: string, payload: any, userId?: string) {
    try {
        const { data: receipt } = await supabase.from('inbound_receipts').select('org_id').eq('id', receiptId).single();
        if (!receipt) return;

        await supabase.from('inbound_events').insert({
            org_id: receipt.org_id,
            receipt_id: receiptId,
            event_type: eventType,
            payload,
            actor_id: userId
        });
    } catch (e) {
        console.error('Failed to log event', e);
    }
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

// 입고 예정 목록 조회
export async function getInboundPlans(orgId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('inbound_plans')
    .select(`
      *,
      inbound_plan_lines (*),
      client:client_id (name)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching inbound plans:', error);
    return [];
  }

  return data;
}

// 입고 예정 상세 조회 (수정용)
export async function getInboundPlanDetail(planId: string) {
    const supabase = await createClient();
    
    const { data, error } = await supabase
        .from('inbound_plans')
        .select(`
            *,
            inbound_plan_lines (*),
            client:client_id (id, name, code)
        `)
        .eq('id', planId)
        .single();
    
    if (error) return null;
    return data;
}


// 입고 예정 등록
export async function createInboundPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 폼 데이터 추출
  const org_id = formData.get('org_id') as string;
  const warehouse_id = formData.get('warehouse_id') as string;
  const client_id = formData.get('client_id') as string;
  const planned_date = formData.get('planned_date') as string;
  const inbound_manager = formData.get('inbound_manager') as string;
  const notes = formData.get('notes') as string;
  
  // Plan Number 생성
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const plan_no = `INP-${dateStr}-${randomStr}`;

  // 1. Plan 생성
  const { data: plan, error: planError } = await supabase
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
      created_by: user?.id
    })
    .select()
    .single();

  if (planError) {
    return { error: planError.message };
  }

  // 2. Lines 생성
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
      line_notes: line.line_notes || null
    }));

    const { error: linesError } = await supabase
      .from('inbound_plan_lines')
      .insert(linesToInsert);

    if (linesError) {
      console.error('Error inserting lines:', linesError);
      return { error: linesError.message };
    }
  }

  // 3. Receipt(실입고) 데이터 미리 생성
  const receipt_no = `INR-${dateStr}-${randomStr}`;
  const { data: receipt, error: receiptError } = await supabase
    .from('inbound_receipts')
    .insert({
      org_id,
      warehouse_id,
      client_id,
      plan_id: plan.id,
      receipt_no,
      status: 'ARRIVED',
      created_by: user?.id
    })
    .select()
    .single();

  if (receiptError) {
      console.error('Error creating receipt:', receiptError);
  } else {
      // 사진 가이드 슬롯 복제 (기본 템플릿 사용 가정)
      const defaultSlots = [
          { key: 'VEHICLE_LEFT', title: '차량 개방(좌)', min: 1 },
          { key: 'VEHICLE_RIGHT', title: '차량 개방(우)', min: 1 },
          { key: 'PRODUCT_FULL', title: '상품 전체', min: 1 },
          { key: 'BOX_OUTER', title: '박스 외관', min: 1 },
          { key: 'LABEL_CLOSEUP', title: '송장/라벨', min: 1 },
          { key: 'UNBOXED', title: '개봉 후 상태', min: 1 }
      ];
      
      const slotsToInsert = defaultSlots.map((slot, idx) => ({
          org_id,
          receipt_id: receipt.id,
          slot_key: slot.key,
          title: slot.title,
          is_required: true,
          min_photos: slot.min,
          sort_order: idx
      }));

      await supabase.from('inbound_photo_slots').insert(slotsToInsert);
      
      // 로그 생성
      await logInboundEvent(supabase, receipt.id, 'CREATED', { plan_no, receipt_no }, user?.id);
  }

  revalidatePath('/admin/inbound');
  revalidatePath('/inbound'); // 수정된 경로
  return { success: true };
}

// 입고 예정 수정
export async function updateInboundPlan(planId: string, formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminUser = await isAdminUser(supabase, user?.id);

    if (!adminUser) {
        return { error: '관리자 권한이 필요합니다.' };
    }

    // 1. Check Receipt Status
    const { data: receipt } = await supabase
        .from('inbound_receipts')
        .select('id, status')
        .eq('plan_id', planId)
        .single();
    
    // 만약 이미 검수가 완료되었거나 진행 중이라면 수정 제한 (여기서는 단순하게 완료된 건만 막음)
    if (receipt && ['CONFIRMED', 'PUTAWAY_READY', 'DISCREPANCY'].includes(receipt.status) && !adminUser) {
        return { error: '이미 처리된 입고 건은 수정할 수 없습니다.' };
    }

    // 2. Update Plan
    const client_id = formData.get('client_id') as string;
    const warehouse_id = formData.get('warehouse_id') as string;
    const planned_date = formData.get('planned_date') as string;
    const inbound_manager = formData.get('inbound_manager') as string;
    const notes = formData.get('notes') as string;

    const { error: planError } = await supabase
        .from('inbound_plans')
        .update({
            client_id,
            warehouse_id,
            planned_date,
            inbound_manager,
            notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', planId);

    if (planError) return { error: planError.message };

    // 3. Update Receipt (동기화)
    if (receipt) {
        await supabase
            .from('inbound_receipts')
            .update({
                client_id,
                warehouse_id
            })
            .eq('id', receipt.id);
    }

    // 4. Update Lines (전체 삭제 후 재생성 전략이 가장 깔끔함)
    const org_id = formData.get('org_id') as string;
    const linesJson = formData.get('lines') as string;
    
    if (linesJson) {
        const lines = JSON.parse(linesJson);
        
        // 기존 라인 삭제
        await supabase.from('inbound_plan_lines').delete().eq('plan_id', planId);

        // 새 라인 삽입
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
            line_notes: line.line_notes || null
        }));

        const { error: linesError } = await supabase
            .from('inbound_plan_lines')
            .insert(linesToInsert);

        if (linesError) {
            console.error('Error inserting lines:', linesError);
            return { error: linesError.message };
        }
    }

    // 로그 생성
    if (receipt) {
        await logInboundEvent(supabase, receipt.id, 'UPDATED', { updated_by: user?.email }, user?.id);
    }

    revalidatePath('/admin/inbound');
    revalidatePath('/inbound');
    return { success: true };
}

// 입고 예정 삭제 (New Feature)
export async function deleteInboundPlan(planId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminUser = await isAdminUser(supabase, user?.id);

    if (!adminUser) {
        return { error: '관리자 권한이 필요합니다.' };
    }
    
    // 이미 입고 진행된 건인지 확인 (Receipt 상태 체크)
    const { data: receipt } = await supabase
        .from('inbound_receipts')
        .select('id, status')
        .eq('plan_id', planId)
        .single();
    
    // 검수 완료되었거나 적치 대기 중인 경우 삭제 불가
    if (receipt && ['CONFIRMED', 'PUTAWAY_READY', 'DISCREPANCY'].includes(receipt.status) && !adminUser) {
        return { error: '이미 입고 작업이 진행되었거나 완료된 건은 삭제할 수 없습니다.' };
    }

    // 1. Receipt 삭제 (Cascade로 하위 Lines, Photos 등 삭제됨)
    if (receipt) {
        await supabase.from('inbound_receipts').delete().eq('id', receipt.id);
    }

    // 2. Plan 삭제 (Cascade로 Plan Lines 삭제됨)
    const { error } = await supabase.from('inbound_plans').delete().eq('id', planId);
    
    if (error) {
        return { error: '삭제 중 오류가 발생했습니다: ' + error.message };
    }

    revalidatePath('/admin/inbound');
    revalidatePath('/inbound');
    return { success: true };
}

// 사진 업로드 정보 저장 (Storage 업로드 후 호출)
export async function saveInboundPhoto(photoData: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('inbound_photos').insert({
        ...photoData,
        uploaded_by: user?.id
    });
    
    if (error) throw error;
    
    // 상태 업데이트: 사진 업로드 시 확인중 상태로 변경
    await supabase
        .from('inbound_receipts')
        .update({ status: 'PHOTO_REQUIRED' }) // or INSPECTING
        .eq('id', photoData.receipt_id)
        .eq('status', 'ARRIVED'); // ARRIVED 상태일 때만 변경

    await logInboundEvent(supabase, photoData.receipt_id, 'PHOTO_UPLOADED', { slot_id: photoData.slot_id }, user?.id);
    
    revalidatePath(`/ops/inbound/${photoData.receipt_id}`);
}

// 입고 수량 저장 (Line별 업데이트)
export async function saveReceiptLines(receiptId: string, lines: any[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: receipt } = await supabase.from('inbound_receipts').select('org_id, status').eq('id', receiptId).single();
    if (!receipt) throw new Error('Receipt not found');

    let hasChanges = false;

    for (const line of lines) {
        const normalQty = Number(line.received_qty || 0);
        const damagedQty = Number(line.damaged_qty || 0);
        const missingQty = Number(line.missing_qty || 0);
        const otherQty = Number(line.other_qty || 0);
        const totalReceived = normalQty + damagedQty + missingQty + otherQty;

        const lineData = {
            id: line.receipt_line_id || undefined,
            org_id: receipt.org_id,
            receipt_id: receiptId,
            plan_line_id: line.plan_line_id,
            product_id: line.product_id,
            expected_qty: line.expected_qty,
            received_qty: totalReceived, // 총 검수 수량
            accepted_qty: normalQty, // 정상 입고 수량
            damaged_qty: damagedQty,
            missing_qty: missingQty,
            other_qty: otherQty,
            location_id: line.location_id || null, // 로케이션 정보 저장
            updated_at: new Date().toISOString(),
            inspected_by: user?.id,
            inspected_at: new Date().toISOString()
        };

        if (lineData.id) {
            const { error } = await supabase.from('inbound_receipt_lines').update(lineData).eq('id', lineData.id);
            if (!error) hasChanges = true;
        } else {
             const { error } = await supabase.from('inbound_receipt_lines').insert(lineData);
             if (!error) hasChanges = true;
        }
    }
    
    // 상태 업데이트: 작업 시작 시 확인중으로 변경 + 갱신 타임스탬프 업데이트
    if (['ARRIVED', 'PHOTO_REQUIRED'].includes(receipt.status)) {
        await supabase
            .from('inbound_receipts')
            .update({ status: 'COUNTING', updated_at: new Date().toISOString() })
            .eq('id', receiptId);
    } else {
        await supabase
            .from('inbound_receipts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', receiptId);
    }

    if (hasChanges) {
        await logInboundEvent(supabase, receiptId, 'QTY_UPDATED', { lines_count: lines.length }, user?.id);
    }
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    revalidatePath('/inbound');
    return { success: true };
}

// 검수 완료 처리 (RPC 사용) + 비즈니스 로직 강화
export async function confirmReceipt(receiptId: string) {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: '로그인이 필요합니다.' };

    // 1. 필수 사진 체크
    const { data: photoCheck } = await supabase
        .from('v_inbound_receipt_photo_progress')
        .select('*')
        .eq('receipt_id', receiptId);
    
    const missingPhotos = photoCheck?.filter((slot: any) => !slot.slot_ok) || [];
    if (missingPhotos.length > 0) {
        const missingNames = missingPhotos.map((s: any) => s.title).join(', ');
        return { error: `필수 사진이 누락되었습니다: ${missingNames}` };
    }

    // 2. 수량 차이(Discrepancy) 체크
    const { data: lines } = await supabase
        .from('inbound_receipt_lines')
        .select('*')
        .eq('receipt_id', receiptId);
    
    let hasDiscrepancy = false;
    let discrepancyDetails: any[] = [];

    lines?.forEach((line: any) => {
        const normalQty = (line.accepted_qty ?? line.received_qty ?? 0);
        const totalReceived = normalQty + (line.damaged_qty || 0) + (line.missing_qty || 0) + (line.other_qty || 0);
        if (totalReceived !== line.expected_qty) {
            hasDiscrepancy = true;
            discrepancyDetails.push({ 
                product_id: line.product_id, 
                expected: line.expected_qty, 
                actual: totalReceived 
            });
        }
        // 파손/분실이 있어도 이슈로 간주
        if ((line.damaged_qty || 0) > 0 || (line.missing_qty || 0) > 0 || (line.other_qty || 0) > 0) {
            hasDiscrepancy = true;
        }
    });

    if (hasDiscrepancy) {
        // 이슈 발생 상태로 변경
        await supabase
            .from('inbound_receipts')
            .update({ status: 'DISCREPANCY' })
            .eq('id', receiptId);
        
        await logInboundEvent(supabase, receiptId, 'DISCREPANCY_FOUND', { details: discrepancyDetails }, user.id);
        
        revalidatePath(`/ops/inbound/${receiptId}`);
        revalidatePath('/inbound');
        return { error: '수량 차이 또는 이슈가 발견되어 "이슈 발생" 상태로 변경되었습니다. 관리자 확인이 필요합니다.' };
    }

    // 3. 정상 완료 처리 (DB Function 호출)
    const { data, error } = await supabase.rpc('confirm_inbound_receipt', {
        p_receipt_id: receiptId,
        p_user_id: user.id
    });
        
    if (error) {
        console.error('Confirm error:', error);
        return { error: error.message };
    }
    
    if (data && !data.success) {
        return { error: data.error || '검수 완료 처리 중 오류가 발생했습니다.' };
    }

    // 적치 대기 상태로 자동 전환
    await supabase
        .from('inbound_receipts')
        .update({ status: 'PUTAWAY_READY' })
        .eq('id', receiptId);

    // 성공 로그
    await logInboundEvent(supabase, receiptId, 'CONFIRMED', { next_status: 'PUTAWAY_READY' }, user.id);
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    revalidatePath('/inbound'); // 수정된 경로
    return { success: true };
}
