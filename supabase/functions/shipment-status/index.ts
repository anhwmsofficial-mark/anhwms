import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts';

interface ShipmentStatusRequest {
  orderNo?: string;
  trackingNo?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: ShipmentStatusRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const { orderNo, trackingNo, limit = 20 } = payload ?? {};

  if (!orderNo && !trackingNo) {
    return errorResponse('orderNo 또는 trackingNo 중 하나는 필수입니다.');
  }

  let query = supabase
    .from('orders')
    .select(
      `id, order_no, tracking_no, status, logistics_company, created_at, updated_at,
       order_receivers (name, phone, zip, address1, address2, locality, country_code),
       logistics_api_logs (adapter, direction, status, http_code, created_at, body)`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (orderNo) {
    query = query.eq('order_no', orderNo);
  }

  if (trackingNo) {
    query = query.eq('tracking_no', trackingNo);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse('주문/운송장 정보를 조회하지 못했습니다.', 500, error);
  }

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    orderNo: row.order_no,
    trackingNo: row.tracking_no,
    status: row.status,
    logisticsCompany: row.logistics_company,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receiver: row.order_receivers?.[0] ?? null,
    logs: (row.logistics_api_logs ?? []).map((log: any) => ({
      adapter: log.adapter,
      direction: log.direction,
      status: log.status,
      httpCode: log.http_code,
      createdAt: log.created_at,
      body: log.body,
    })),
  }));

  return jsonResponse({
    count: mapped.length,
    items: mapped,
  });
});
