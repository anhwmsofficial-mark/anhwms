import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import type { Database } from '@/types/supabase';

type ContractUpdateBody = {
  contractName?: string;
  contractType?: string;
  contractStart?: string;
  contractEnd?: string | null;
  autoRenewal?: boolean;
  contractAmount?: number | null;
  status?: string;
  note?: string | null;
};

// 계약 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { contractId } = await params;
    const body = await req.json() as ContractUpdateBody;

    const updateData: Database['public']['Tables']['customer_contract']['Update'] = {};
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
  } catch (error: unknown) {
    console.error('Error updating customer contract:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
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
    await requirePermission('manage:orders', req);
    const { contractId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .delete()
      .eq('id', contractId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error deleting customer contract:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

