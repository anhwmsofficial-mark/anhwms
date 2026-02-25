import { NextResponse } from 'next/server';
import { requirePermission } from '@/utils/rbac';

export async function GET() {
  try {
    await requirePermission('inventory:adjust');

    const header = [
      'sku',
      'barcode',
      'occurred_at',
      'opening_stock',
      'inbound_qty',
      'disposal_qty',
      'damage_qty',
      'return_b2c_qty',
      'outbound_qty',
      'adjustment_plus_qty',
      'adjustment_minus_qty',
      'bundle_break_in_qty',
      'bundle_break_out_qty',
      'export_pickup_qty',
      'outbound_cancel_qty',
      'memo',
    ];

    const sample = [
      'ABC-EAR-BK',
      '880000000001',
      '2026-02-25T00:00:00Z',
      '100',
      '20',
      '2',
      '1',
      '3',
      '15',
      '0',
      '0',
      '0',
      '0',
      '0',
      '1',
      '샘플 데이터',
    ];

    const csv = [header.join(','), sample.join(',')].join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="inventory_ledger_staging_template.csv"',
      },
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || '템플릿 다운로드 실패' },
      { status },
    );
  }
}
