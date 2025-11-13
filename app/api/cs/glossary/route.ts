import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

// GET: 용어집 조회
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cs_glossary')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      items: data || [],
    });
  } catch (error: any) {
    console.error('[api/cs/glossary] GET 오류:', error);
    return NextResponse.json(
      { error: '용어집 조회 실패', details: error.message },
      { status: 500 }
    );
  }
}

// POST: 용어 추가
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdminClient();
    const body = await request.json();
    const { term_ko, term_zh, note, priority, active } = body;

    if (!term_ko || !term_zh) {
      return NextResponse.json(
        { error: 'term_ko와 term_zh는 필수입니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cs_glossary')
      .insert({
        term_ko,
        term_zh,
        note: note || null,
        priority: priority || 5,
        active: active !== undefined ? active : true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      term: data,
    });
  } catch (error: any) {
    console.error('[api/cs/glossary] POST 오류:', error);
    return NextResponse.json(
      { error: '용어 추가 실패', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: 용어 수정
export async function PUT(request: Request) {
  try {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { term_ko, term_zh, note, priority, active } = body;

    const { data, error } = await supabase
      .from('cs_glossary')
      .update({
        term_ko,
        term_zh,
        note: note || null,
        priority: priority || 5,
        active: active !== undefined ? active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      term: data,
    });
  } catch (error: any) {
    console.error('[api/cs/glossary] PUT 오류:', error);
    return NextResponse.json(
      { error: '용어 수정 실패', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 용어 삭제
export async function DELETE(request: Request) {
  try {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('cs_glossary')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('[api/cs/glossary] DELETE 오류:', error);
    return NextResponse.json(
      { error: '용어 삭제 실패', details: error.message },
      { status: 500 }
    );
  }
}

