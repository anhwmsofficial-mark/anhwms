import { NextRequest } from 'next/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { requirePermission } from '@/utils/rbac';

type LedgerCsvHeader =
  | 'created_at'
  | 'movement_type'
  | 'direction'
  | 'quantity'
  | 'transaction_type'
  | 'qty_change'
  | 'balance_after'
  | 'reference_type'
  | 'reference_id'
  | 'memo'
  | 'notes';

type LedgerCsvRow = Record<LedgerCsvHeader, string | number | null>;

export async function GET(request: NextRequest) {
  await requirePermission('manage:orders', request);
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  if (!productId) {
    return new Response('product_id가 필요합니다.', { status: 400 });
  }

  const db = createTrackedAdminClient({ route: 'ledger_csv' });
  const dbUntyped = db as unknown as {
    from: (table: string) => any;
  };
  const { data, error } = await dbUntyped
    .from('inventory_ledger')
    .select('movement_type, direction, quantity, transaction_type, qty_change, balance_after, reference_type, reference_id, memo, notes, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = ((data || []) as unknown) as LedgerCsvRow[];
  const header: LedgerCsvHeader[] = ['created_at', 'movement_type', 'direction', 'quantity', 'transaction_type', 'qty_change', 'balance_after', 'reference_type', 'reference_id', 'memo', 'notes'];
  const csv = [
    header.join(','),
    ...rows.map((row) =>
      header.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory_ledger_${productId}.csv"`,
    },
  });
}
