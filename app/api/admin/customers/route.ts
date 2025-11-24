import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 고객사 목록 조회
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
      .from('customer_master')
      .select('*, brands:brand(count)', { count: 'exact' });

    // 필터링
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // 페이지네이션
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
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
    console.error('GET /api/admin/customers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 고객사 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/customers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

