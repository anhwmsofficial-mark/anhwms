'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { InboundPlan, InboundPlanLine } from '@/types/inbound';

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

// 입고 예정 등록
export async function createInboundPlan(formData: FormData) {
  const supabase = await createClient();
  
  // 폼 데이터 추출
  const org_id = formData.get('org_id') as string;
  const warehouse_id = formData.get('warehouse_id') as string;
  const client_id = formData.get('client_id') as string;
  const planned_date = formData.get('planned_date') as string;
  const notes = formData.get('notes') as string;
  
  // Plan Number 생성 (간단한 예시)
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
      status: 'SUBMITTED', // 바로 제출 상태로 (간소화)
      notes
    })
    .select()
    .single();

  if (planError) {
    return { error: planError.message };
  }

  // 2. Lines 생성 (예시: 폼에서 JSON 문자열로 받았다고 가정)
  // 실제로는 동적 폼 필드를 파싱해야 함
  const linesJson = formData.get('lines') as string;
  if (linesJson) {
    const lines = JSON.parse(linesJson);
    const linesToInsert = lines.map((line: any) => ({
      org_id,
      plan_id: plan.id,
      product_id: line.product_id,
      expected_qty: parseInt(line.expected_qty),
      notes: line.notes
    }));

    const { error: linesError } = await supabase
      .from('inbound_plan_lines')
      .insert(linesToInsert);

    if (linesError) {
      console.error('Error inserting lines:', linesError);
      // 롤백 로직이 필요할 수 있음
      return { error: linesError.message };
    }
  }

  // 3. Receipt(실입고) 데이터 미리 생성 (현장에서 바로 보이게)
  // 기획에 따라 입고 예정 승인 시 생성할 수도 있음
  const receipt_no = `INR-${dateStr}-${randomStr}`;
  const { data: receipt, error: receiptError } = await supabase
    .from('inbound_receipts')
    .insert({
      org_id,
      warehouse_id,
      client_id,
      plan_id: plan.id,
      receipt_no,
      status: 'ARRIVED', // 초기 상태
    })
    .select()
    .single();

  if (receiptError) {
      console.error('Error creating receipt:', receiptError);
  } else {
      // 사진 가이드 슬롯 복제 (기본 템플릿 사용 가정)
      // 실제로는 템플릿 조회 후 복사
      const defaultSlots = [
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
  }

  revalidatePath('/admin/inbound');
  redirect('/admin/inbound');
}

// 사진 업로드 정보 저장 (Storage 업로드 후 호출)
export async function saveInboundPhoto(photoData: any) {
    const supabase = await createClient();
    const { error } = await supabase.from('inbound_photos').insert(photoData);
    if (error) throw error;
    revalidatePath(`/ops/inbound/${photoData.receipt_id}`);
}

// 입고 수량 저장 (Line별 업데이트)
export async function saveReceiptLines(receiptId: string, lines: any[]) {
    const supabase = await createClient();
    
    // Receipt 기본 정보 조회 (org_id 필요)
    const { data: receipt } = await supabase.from('inbound_receipts').select('org_id').eq('id', receiptId).single();
    if (!receipt) throw new Error('Receipt not found');

    for (const line of lines) {
        // 기존 Line이 있으면 업데이트, 없으면 생성 (UPSERT)
        // product_id, plan_line_id 등의 정보가 필요함
        
        // 간단한 로직: ID가 있으면 업데이트, 없으면 신규 생성
        // 하지만 현장 UI에서는 ID가 없을 수도 있음 (Plan Line만 있는 경우)
        
        const lineData = {
            id: line.receipt_line_id || undefined, // ID가 있으면 업데이트
            org_id: receipt.org_id,
            receipt_id: receiptId,
            plan_line_id: line.plan_line_id,
            product_id: line.product_id || (await getProductIdFromPlanLine(supabase, line.plan_line_id)), // Helper function needed
            expected_qty: line.expected_qty,
            received_qty: line.received_qty,
            updated_at: new Date().toISOString()
        };

        // upsert 시 conflict 컬럼 지정 필요하거나, ID 유무로 분기
        if (lineData.id) {
            await supabase.from('inbound_receipt_lines').update(lineData).eq('id', lineData.id);
        } else {
            // 신규 생성
             await supabase.from('inbound_receipt_lines').insert(lineData);
        }
    }
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    return { success: true };
}

async function getProductIdFromPlanLine(supabase: any, planLineId: string) {
    const { data } = await supabase.from('inbound_plan_lines').select('product_id').eq('id', planLineId).single();
    return data?.product_id;
}

// 검수 완료 처리
export async function confirmReceipt(receiptId: string) {
    const supabase = await createClient();
    
    // 1. 필수 조건 체크 (DB View 활용)
    // const { data: checks } = await supabase.from('v_inbound_receipt_photo_progress').select('*').eq('receipt_id', receiptId);
    // const allPhotosOk = checks?.every((c: any) => c.slot_ok);
    // if (!allPhotosOk) return { error: '필수 사진이 모두 업로드되지 않았습니다.' };
    
    // 2. 상태 업데이트
    const { error } = await supabase
        .from('inbound_receipts')
        .update({ 
            status: 'CONFIRMED', 
            confirmed_at: new Date().toISOString()
        })
        .eq('id', receiptId);
        
    if (error) return { error: error.message };
    
    revalidatePath(`/ops/inbound/${receiptId}`);
    return { success: true };
}
