/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';

// GET: 로케이션 목록 조회
export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId') || '';
    const status = searchParams.get('status') || 'ACTIVE';
    const search = searchParams.get('search') || '';

    let query = supabaseAdmin
      .from('location')
      .select('*, warehouse:warehouse(id, name)')
      .order('code', { ascending: true });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`code.ilike.%${search}%,zone.ilike.%${search}%,type.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 로케이션 생성
export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from('location')
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
