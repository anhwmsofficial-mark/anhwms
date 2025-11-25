import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';

// 담당자 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id: customerId, contactId } = await params;
    const body = await req.json();

    // 주 담당자로 변경 시, 기존 주 담당자 해제
    if (body.isPrimary) {
      await supabaseAdmin
        .from('customer_contact')
        .update({ is_primary: false })
        .eq('customer_master_id', customerId)
        .eq('is_primary', true)
        .neq('id', contactId);
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.department !== undefined) updateData.department = body.department;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.mobile !== undefined) updateData.mobile = body.mobile;
    if (body.preferredContact !== undefined) updateData.preferred_contact = body.preferredContact;
    if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.note !== undefined) updateData.note = body.note;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating customer contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 담당자 삭제 (실제로는 is_active = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { contactId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .update({ is_active: false })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error deleting customer contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

