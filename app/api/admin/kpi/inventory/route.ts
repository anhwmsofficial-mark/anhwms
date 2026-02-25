/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const { count: totalReceipts } = await db
      .from('inbound_receipts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr);

    const { count: confirmedReceipts } = await db
      .from('inbound_receipts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr)
      .in('status', ['CONFIRMED', 'PUTAWAY_READY']);

    const { data: inboundLedger } = await db
      .from('inventory_ledger')
      .select('qty_change')
      .eq('transaction_type', 'INBOUND')
      .gte('created_at', todayStr);

    const inboundQtyToday = (inboundLedger || []).reduce((sum, row: any) => sum + (row.qty_change || 0), 0);

    const { data: products } = await db
      .from('products')
      .select('id, min_stock')
      .gt('min_stock', 0);

    const productIds = (products || []).map((p: any) => p.id).filter(Boolean);
    if (productIds.length === 0) {
      return NextResponse.json({
        totalReceipts: totalReceipts || 0,
        confirmedReceipts: confirmedReceipts || 0,
        inboundQtyToday,
        lowStockCount: 0,
      });
    }

    const { data: qtyRows } = await db
      .from('inventory_quantities')
      .select('product_id, qty_on_hand')
      .in('product_id', productIds);

    const qtyMap: Record<string, number> = {};
    (qtyRows || []).forEach((row: any) => {
      qtyMap[row.product_id] = (qtyMap[row.product_id] || 0) + (row.qty_on_hand || 0);
    });

    const lowStockCount = (products || []).filter((p: any) => (qtyMap[p.id] || 0) < (p.min_stock || 0)).length;

    return NextResponse.json({
      totalReceipts: totalReceipts || 0,
      confirmedReceipts: confirmedReceipts || 0,
      inboundQtyToday,
      lowStockCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'KPI 조회 실패' }, { status: 500 });
  }
}
