
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fail, ok } from '@/lib/api/response';

/**
 * 입고 상세 조회 API
 * GET /api/inbound/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. 입고 헤더 조회 (inbound_receipts)
    // client:customer_master!client_id(name) -> client_id가 customer_master 참조
    const { data: receipt, error: receiptError } = await supabase
      .from('inbound_receipts')
      .select(`
        *,
        client:customer_master!client_id(name)
      `)
      .eq('id', id)
      .single();

    if (receiptError || !receipt) {
      return fail('NOT_FOUND', 'Inbound receipt not found', { status: 404 });
    }

    // 2. 입고 라인 조회 (inbound_receipt_lines)
    const { data: lines, error: linesError } = await supabase
      .from('inbound_receipt_lines')
      .select(`
        *,
        product:products(name, sku)
      `)
      .eq('receipt_id', id);

    if (linesError) {
      throw linesError;
    }

    // 3. 프론트엔드 호환 포맷 변환
    const totalExpectedQty = lines.reduce((sum, line) => sum + (line.expected_qty || 0), 0);
    const totalReceivedQty = lines.reduce((sum, line) => sum + (line.received_qty || 0), 0);
    
    // 대표 상품명 생성
    let productName = 'Unknown Product';
    if (lines.length > 0) {
      productName = lines[0].product?.name || 'Unknown Product';
      if (lines.length > 1) {
        productName += ` 외 ${lines.length - 1}건`;
      }
    }

    const responseData = {
      id: receipt.id,
      productName: productName,
      quantity: totalExpectedQty,
      supplierName: receipt.client?.name || 'Unknown Client',
      inboundDate: receipt.arrived_at || receipt.created_at,
      status: receipt.status,
      received_quantity: totalReceivedQty,
      // 상세 라인 정보도 함께 내려줌 (확장성)
      lines: lines.map(line => ({
        id: line.id,
        receiptLineId: line.id,
        planLineId: line.plan_line_id,
        productId: line.product_id,
        productName: line.product?.name,
        sku: line.product?.sku,
        expectedQty: line.expected_qty,
        receivedQty: line.received_qty,
        acceptedQty: line.accepted_qty,
        damagedQty: line.damaged_qty,
        missingQty: line.missing_qty,
        otherQty: line.other_qty,
        note: line.notes || '',
        inspectedAt: line.inspected_at || null,
        inspectedBy: line.inspected_by || null,
      }))
    };

    return ok(responseData);

  } catch (error: any) {
    console.error('Error fetching inbound:', error);
    return fail('INTERNAL_ERROR', error.message, { status: 500 });
  }
}
