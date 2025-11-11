import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts';

interface InboundStatusRequest {
  asnNo?: string;
  inboundId?: string;
  productName?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: InboundStatusRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const { asnNo, inboundId, productName, limit = 50 } = payload ?? {};

  let query = supabase
    .from('inbounds')
    .select(
      `id, product_id, product_name, supplier_id, supplier_name, quantity, unit, unit_price, total_price,
       inbound_date, status, note, created_at`
    )
    .order('inbound_date', { ascending: false })
    .limit(limit);

  if (inboundId) {
    query = query.eq('id', inboundId);
  }

  if (asnNo) {
    query = query.eq('note', asnNo);
  }

  if (productName) {
    query = query.ilike('product_name', `%${productName}%`);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse('입고 내역 조회에 실패했습니다.', 500, error);
  }

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    inboundDate: row.inbound_date,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  }));

  return jsonResponse({
    count: mapped.length,
    items: mapped,
  });
});
