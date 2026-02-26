import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('read:orders', request);
    const supabase = await createClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ count: inboundTotal }, { count: inboundMonthly }] = await Promise.all([
      supabase.from('inbound_receipts').select('id', { count: 'exact', head: true }),
      supabase
        .from('inbound_receipts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart),
    ]);

    const [{ count: ordersTotal }, { count: ordersMonthly }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart),
    ]);

    const { count: ledgerMonthly } = await supabase
      .from('inventory_ledger')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart);

    return NextResponse.json({
      inbound: {
        total: inboundTotal || 0,
        monthly: inboundMonthly || 0,
      },
      orders: {
        total: ordersTotal || 0,
        monthly: ordersMonthly || 0,
      },
      inventory: {
        ledgerMonthly: ledgerMonthly || 0,
      },
    });
  } catch (error) {
    logger.error(error as Error, { scope: 'api', route: 'GET /api/admin/reports/summary' });
    return NextResponse.json({ error: '리포트 데이터를 불러오지 못했습니다.' }, { status: 500 });
  }
}
