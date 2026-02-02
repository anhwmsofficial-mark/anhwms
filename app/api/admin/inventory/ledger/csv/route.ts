import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  if (!productId) {
    return new Response('product_id가 필요합니다.', { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_ledger')
    .select('transaction_type, qty_change, balance_after, reference_type, reference_id, notes, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = data || [];
  const header = ['created_at', 'transaction_type', 'qty_change', 'balance_after', 'reference_type', 'reference_id', 'notes'];
  const csv = [
    header.join(','),
    ...rows.map((row: any) =>
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
