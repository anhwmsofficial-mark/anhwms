import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';

// 계약 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { contractId } = await params;
    const body = await req.json();

    const updateData: any = {};
    if (body.contractName !== undefined) updateData.contract_name = body.contractName;
    if (body.contractType !== undefined) updateData.contract_type = body.contractType;
    if (body.contractStart !== undefined) updateData.contract_start = body.contractStart;
    if (body.contractEnd !== undefined) updateData.contract_end = body.contractEnd;
    if (body.autoRenewal !== undefined) updateData.auto_renewal = body.autoRenewal;
    if (body.contractAmount !== undefined) updateData.contract_amount = body.contractAmount;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .update(updateData)
      .eq('id', contractId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating customer contract:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 계약 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { contractId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .delete()
      .eq('id', contractId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error deleting customer contract:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

