import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET: 배송사 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const is_domestic = searchParams.get('is_domestic') || '';

    let query = supabaseAdmin
      .from('shipping_carrier')
      .select('*, accounts:shipping_account(count)');

    if (status) {
      query = query.eq('status', status);
    }
    if (is_domestic !== '') {
      query = query.eq('is_domestic', is_domestic === 'true');
    }

    query = query.order('name_ko', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching carriers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/admin/shipping/carriers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 배송사 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('shipping_carrier')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating carrier:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/shipping/carriers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

