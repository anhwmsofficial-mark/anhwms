import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 브랜드 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('brand')
      .select(`
        *,
        customer:customer_master(*),
        stores:store(*),
        warehouses:brand_warehouse(*, warehouse:warehouse(*))
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/admin/brands/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 브랜드 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('brand')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('PUT /api/admin/brands/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 브랜드 삭제 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('brand')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting brand:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('DELETE /api/admin/brands/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

