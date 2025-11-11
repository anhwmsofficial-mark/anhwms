import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: 이상 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    let query = supabase
      .from('global_exceptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching exceptions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exceptions' },
      { status: 500 }
    );
  }
}

// POST: 새 이상 생성
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('global_exceptions')
      .insert({
        exception_number: body.exceptionNumber || `EXP-${Date.now()}`,
        order_id: body.orderId,
        exception_type: body.exceptionType,
        severity: body.severity || 'medium',
        title: body.title,
        description: body.description,
        detected_by: body.detectedBy || 'system',
        detected_at: new Date().toISOString(),
        status: 'open',
        customer_notified: false
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating exception:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create exception' },
      { status: 500 }
    );
  }
}

