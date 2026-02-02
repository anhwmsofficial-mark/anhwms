import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkInboundDelay } from '@/lib/alerts/inboundDelay';
import { checkLowStock } from '@/lib/alerts/lowStock';

export async function GET() {
  try {
    const db = createAdminClient();
    const hours = Number(process.env.INBOUND_INVENTORY_DELAY_HOURS || 24);
    const [delayResult, lowStockResult] = await Promise.all([
      checkInboundDelay(db, hours),
      checkLowStock(db),
    ]);

    return NextResponse.json({
      inboundDelay: delayResult,
      lowStock: lowStockResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '알림 크론 실패' }, { status: 500 });
  }
}
