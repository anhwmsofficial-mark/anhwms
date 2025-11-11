import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabase, jsonResponse, errorResponse, SUPABASE_URL } from '../_shared/supabaseClient.ts';

interface DocumentRequest {
  orderNo: string;
  documentType?: 'invoice' | 'packing_list' | 'outbound';
}

const DEFAULT_TTL_MINUTES = 60;

serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405);
  }

  let payload: DocumentRequest;

  try {
    payload = await req.json();
  } catch (error) {
    return errorResponse('Invalid JSON payload', 400, error);
  }

  const orderNo = payload?.orderNo?.trim();
  const documentType = payload?.documentType ?? 'invoice';

  if (!orderNo) {
    return errorResponse('orderNo 필드는 필수입니다.');
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_no, logistics_company, tracking_no, created_at')
    .eq('order_no', orderNo)
    .maybeSingle();

  if (error) {
    return errorResponse('주문 정보를 조회하지 못했습니다.', 500, error);
  }

  if (!order) {
    return errorResponse(`주문번호 ${orderNo} 를 찾을 수 없습니다.`, 404);
  }

  const bucket = Deno.env.get('DOCUMENT_BUCKET') ?? 'documents';
  const fileNameMap: Record<string, string> = {
    invoice: 'invoice.pdf',
    packing_list: 'packing-list.pdf',
    outbound: 'outbound-slip.pdf',
  };

  const fileName = fileNameMap[documentType] ?? 'document.pdf';
  const objectPath = `${order.order_no}/${fileName}`;
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, DEFAULT_TTL_MINUTES * 60);

  if (signedError || !signed) {
    const fallbackUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
    return jsonResponse({
      orderNo: order.order_no,
      documentType,
      url: fallbackUrl,
      signed: false,
      expiresAt: null,
      note: '서명 URL 발급에 실패했습니다. 객체가 존재하는지 확인하세요.',
    });
  }

  return jsonResponse({
    orderNo: order.order_no,
    documentType,
    url: signed.signedUrl,
    signed: true,
    expiresAt: new Date(Date.now() + DEFAULT_TTL_MINUTES * 60 * 1000).toISOString(),
  });
});
