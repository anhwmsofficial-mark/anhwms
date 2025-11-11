import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts';

interface OutboundStatusRequest {
  orderNo?: string;
  outboundId?: string;
  productName?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: OutboundStatusRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const { orderNo, outboundId, productName, limit = 50 } = payload ?? {};

  let query = supabase
    .from('outbounds')
    .select(
      `id, product_id, product_name, customer_id, customer_name, quantity, unit, unit_price, total_price,
       outbound_date, status, note, created_at`
    )
    .order('outbound_date', { ascending: false })
    .limit(limit);

  if (outboundId) {
    query = query.eq('id', outboundId);
  }

  if (orderNo) {
    query = query.eq('note', orderNo);
  }

  if (productName) {
    query = query.ilike('product_name', `%${productName}%`);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse('출고 내역 조회에 실패했습니다.', 500, error);
  }

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    outboundDate: row.outbound_date,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  }));

  return jsonResponse({
    count: mapped.length,
    items: mapped,
  });
});
