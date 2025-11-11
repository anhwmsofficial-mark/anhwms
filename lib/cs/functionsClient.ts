const FUNCTIONS_BASE_URL = process.env.SUPABASE_FUNCTIONS_URL;
const FUNCTIONS_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FUNCTIONS_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!FUNCTIONS_BASE_URL) {
  console.warn('[cs/functionsClient] 환경 변수 SUPABASE_FUNCTIONS_URL 이 설정되지 않았습니다. Edge Function 호출 시 오류가 발생할 수 있습니다.');
}

function resolveAuthHeader() {
  if (FUNCTIONS_SERVICE_KEY) {
    return `Bearer ${FUNCTIONS_SERVICE_KEY}`;
  }
  if (FUNCTIONS_ANON_KEY) {
    return `Bearer ${FUNCTIONS_ANON_KEY}`;
  }
  throw new Error('Supabase Edge Function 인증용 키가 없습니다. SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요.');
}

async function invokeFunction<T>(name: string, payload: unknown): Promise<T> {
  if (!FUNCTIONS_BASE_URL) {
    throw new Error('SUPABASE_FUNCTIONS_URL 이 설정되어 있지 않아 Edge Function을 호출할 수 없습니다.');
  }

  const response = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: resolveAuthHeader(),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const text = await response.text();
  let data: any;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Edge Function 응답을 파싱하지 못했습니다: ${error}`);
  }

  if (!response.ok) {
    const message = data?.error ?? `Edge Function ${name} 호출이 실패했습니다.`;
    const detail = data?.details ?? data;
    throw new Error(`${message}${detail ? ` | ${JSON.stringify(detail)}` : ''}`);
  }

  return data as T;
}

export function callShipmentStatus(payload: { orderNo?: string; trackingNo?: string; limit?: number; }) {
  return invokeFunction('shipment-status', payload);
}

export function callOutboundStatus(payload: { orderNo?: string; outboundId?: string; productName?: string; limit?: number; }) {
  return invokeFunction('outbound-status', payload);
}

export function callInboundStatus(payload: { asnNo?: string; inboundId?: string; productName?: string; limit?: number; }) {
  return invokeFunction('inbound-status', payload);
}

export function callInventoryBySku(payload: { sku: string; }) {
  return invokeFunction('inventory-by-sku', payload);
}

export function callDocument(payload: { orderNo: string; documentType?: 'invoice' | 'packing_list' | 'outbound'; }) {
  return invokeFunction('document', payload);
}

export function callCreateTicket(payload: { partnerId?: string; conversationId?: string; summary: string; description?: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; assignee?: string; tags?: string[]; }) {
  return invokeFunction('cs-ticket', payload);
}
