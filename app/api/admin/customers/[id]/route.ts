/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';

// GET: 고객사 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .select('*, brands:brand(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/admin/customers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 고객사 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('PUT /api/admin/customers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 고객사 삭제 (soft delete - status를 INACTIVE로 변경)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;
    const { data, error} = await supabaseAdmin
      .from('customer_master')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('DELETE /api/admin/customers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

