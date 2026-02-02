import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkLowStock } from '@/lib/alerts/lowStock';

export async function GET() {
  try {
    const db = createAdminClient();
    const result = await checkLowStock(db);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '재고 부족 경보 실패' }, { status: 500 });
  }
}
