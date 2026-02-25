/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const { data, error } = await supabaseAdmin
      .from('product_categories')
      .select('code, name_ko, name_en')
      .order('code');

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      data: data.map(item => ({
        code: item.code,
        nameKo: item.name_ko,
        nameEn: item.name_en
      }))
    });
  } catch (error: any) {
    console.error('GET /api/admin/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
