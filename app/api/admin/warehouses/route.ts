import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 창고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || 'ACTIVE';

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('warehouse')
      .select(`
        *,
        org:org(id, name, code),
        locations:location(count),
        brands:brand_warehouse(brand:brand(id, code, name_ko))
      `, { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,city.ilike.%${search}%`);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching warehouses:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('GET /api/admin/warehouses error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 창고 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('warehouse')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating warehouse:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/warehouses error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

