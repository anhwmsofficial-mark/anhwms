/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';

// 가격 정책 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pricingId: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { pricingId } = await params;
    const body = await req.json();

    const updateData: any = {};
    if (body.unitPrice !== undefined) updateData.unit_price = body.unitPrice;
    if (body.effectiveFrom !== undefined) updateData.effective_from = body.effectiveFrom;
    if (body.effectiveTo !== undefined) updateData.effective_to = body.effectiveTo;
    if (body.volumeDiscountRate !== undefined) updateData.volume_discount_rate = body.volumeDiscountRate;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.note !== undefined) updateData.note = body.note;

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .update(updateData)
      .eq('id', pricingId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating customer pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 가격 정책 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pricingId: string }> }
) {
  try {
    await requirePermission('manage:orders', req);
    const { pricingId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .delete()
      .eq('id', pricingId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error deleting customer pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

