import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupCode = searchParams.get('group_code');
    const isActive = searchParams.get('is_active');

    let query = supabaseAdmin
      .from('common_codes')
      .select('*')
      .order('sort_order', { ascending: true });

    if (groupCode) {
      query = query.eq('group_code', groupCode);
    }

    if (isActive !== null) {
        query = query.eq('is_active', isActive === 'true');
    } else {
        query = query.eq('is_active', true); // Default active only
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching common codes:', error);
      // 테이블이 없을 경우를 대비해 빈 배열 반환
      if (error.code === '42P01') { // undefined_table
          return NextResponse.json({ data: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/common-codes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { group_code, code, label, sort_order, is_active } = body;

        if (!group_code || !code || !label) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('common_codes')
            .insert([{ group_code, code, label, sort_order, is_active }])
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
