import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // products 테이블에서 category 컬럼만 조회
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('category');

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 중복 제거 및 정렬
    const categories = Array.from(new Set(data.map((item) => item.category)))
      .filter(Boolean)
      .sort();

    return NextResponse.json({ data: categories });
  } catch (error: any) {
    console.error('GET /api/admin/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
