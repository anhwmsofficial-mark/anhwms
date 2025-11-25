import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { CustomerContact, CreateCustomerContactInput } from '@/types';

// 거래처 담당자 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .select('*')
      .eq('customer_master_id', customerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const contacts: CustomerContact[] = (data || []).map((row: any) => ({
      id: row.id,
      customerMasterId: row.customer_master_id,
      name: row.name,
      title: row.title,
      department: row.department,
      role: row.role,
      email: row.email,
      phone: row.phone,
      mobile: row.mobile,
      fax: row.fax,
      preferredContact: row.preferred_contact || 'EMAIL',
      workHours: row.work_hours,
      timezone: row.timezone || 'Asia/Seoul',
      language: row.language || 'ko',
      isPrimary: row.is_primary,
      isActive: row.is_active,
      birthday: row.birthday ? new Date(row.birthday) : null,
      note: row.note,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return NextResponse.json({ success: true, data: contacts });
  } catch (error: any) {
    console.error('Error fetching customer contacts:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 거래처 담당자 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const body: CreateCustomerContactInput = await req.json();

    // 주 담당자로 설정 시, 기존 주 담당자 해제
    if (body.isPrimary) {
      await supabaseAdmin
        .from('customer_contact')
        .update({ is_primary: false })
        .eq('customer_master_id', customerId)
        .eq('is_primary', true);
    }

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .insert({
        customer_master_id: customerId,
        name: body.name,
        title: body.title,
        department: body.department,
        role: body.role,
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
        preferred_contact: body.preferredContact || 'EMAIL',
        is_primary: body.isPrimary || false,
        note: body.note,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error creating customer contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

