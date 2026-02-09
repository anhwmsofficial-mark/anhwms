import { supabase } from '../supabase';
import { Order, LogisticsApiLog, OrderSender, PaginationMeta } from '@/types';

type OrderQueryFilters = {
  status?: string;
  logisticsCompany?: string;
  limit?: number;
  page?: number;
  cursor?: string;
  includeLogs?: boolean;
};

function buildOrderSelect(includeLogs?: boolean) {
  return `
      *,
      receiver:order_receivers(*)
      ${includeLogs ? ', logs:logistics_api_logs(*)' : ''}
    `;
}

function mapLogRows(logs?: any[]): LogisticsApiLog[] | undefined {
  if (!logs) return undefined;
  return logs.map((item: any) => ({
    id: item.id,
    orderId: item.order_id,
    adapter: item.adapter,
    direction: item.direction,
    status: item.status,
    httpCode: item.http_code,
    headers: item.headers,
    body: item.body,
    createdAt: new Date(item.created_at),
  })) as LogisticsApiLog[];
}

function mapOrderRow(item: any): Order {
  return {
    id: item.id,
    orderNo: item.order_no,
    userId: item.user_id,
    countryCode: item.country_code,
    productName: item.product_name,
    remark: item.remark,
    logisticsCompany: item.logistics_company,
    trackingNo: item.tracking_no,
    status: item.status,
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
    receiver: item.receiver?.[0]
      ? {
          id: item.receiver[0].id,
          orderId: item.receiver[0].order_id,
          name: item.receiver[0].name,
          phone: item.receiver[0].phone,
          zip: item.receiver[0].zip,
          address1: item.receiver[0].address1,
          address2: item.receiver[0].address2,
          locality: item.receiver[0].locality,
          countryCode: item.receiver[0].country_code,
          meta: item.receiver[0].meta,
          createdAt: new Date(item.receiver[0].created_at),
        }
      : undefined,
    logs: mapLogRows(item.logs),
  } as Order;
}

/**
 * 주문 목록 조회
 */
export async function getOrders(filters?: OrderQueryFilters) {
  const { data } = await getOrdersPageWithClient(supabase, filters);
  return data;
}

/**
 * 주문 목록 페이징/커서 조회
 */
export async function getOrdersPage(filters?: OrderQueryFilters): Promise<{ data: Order[]; pagination: PaginationMeta }> {
  return getOrdersPageWithClient(supabase, filters);
}

export async function getOrdersPageWithClient(
  client: typeof supabase,
  filters?: OrderQueryFilters,
): Promise<{ data: Order[]; pagination: PaginationMeta }> {
  const limit = filters?.limit ?? 50;
  const page = filters?.page ?? 1;

  let query = client
    .from('orders')
    .select(buildOrderSelect(filters?.includeLogs), { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.logisticsCompany) {
    query = query.eq('logistics_company', filters.logisticsCompany);
  }
  if (filters?.cursor) {
    query = query.lt('created_at', filters.cursor).limit(limit);
  } else {
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query.returns<any[]>();
  if (error) throw error;

  const rows = (data || []) as any[];
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].created_at : null;
  const total = count || 0;
  const totalPages = limit ? Math.ceil(total / limit) : 1;

  return {
    data: rows.map(mapOrderRow) as Order[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      nextCursor,
    },
  };
}

/**
 * 주문 상세 조회
 */
export async function getOrder(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(buildOrderSelect())
    .eq('id', id)
    .single();

  if (error) throw error;

  return mapOrderRow(data);
}

/**
 * 주문 상태 업데이트
 */
export async function updateOrderStatus(
  id: string,
  status: string,
  trackingNo?: string
) {
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (trackingNo) {
    updates.tracking_no = trackingNo;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 주문 삭제
 */
export async function deleteOrder(id: string) {
  const { error } = await supabase.from('orders').delete().eq('id', id);

  if (error) throw error;
}

/**
 * 로그 조회 (주문별)
 */
export async function getLogisticsLogs(orderId: string) {
  const { data, error } = await supabase
    .from('logistics_api_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((item: any) => ({
    id: item.id,
    orderId: item.order_id,
    adapter: item.adapter,
    direction: item.direction,
    status: item.status,
    httpCode: item.http_code,
    headers: item.headers,
    body: item.body,
    createdAt: new Date(item.created_at),
  })) as LogisticsApiLog[];
}

/**
 * 기본 발송인 정보 조회
 */
export async function getDefaultSender() {
  const { data: settings } = await supabase
    .from('order_default_settings')
    .select('*')
    .eq('config_key', 'default')
    .maybeSingle();

  if (settings) {
    return {
      id: settings.config_key,
      name: settings.sender_name,
      phone: settings.sender_phone,
      zip: settings.sender_zip,
      address: settings.sender_address,
      addressDetail: settings.sender_address_detail,
      isDefault: true,
      createdAt: new Date(settings.created_at),
    } as OrderSender;
  }

  const { data, error } = await supabase
    .from('order_senders')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    // 기본값이 없으면 첫 번째 발송인 반환
    const { data: firstSender } = await supabase
      .from('order_senders')
      .select('*')
      .limit(1)
      .single();

    if (firstSender) {
      return {
        id: firstSender.id,
        name: firstSender.name,
        phone: firstSender.phone,
        zip: firstSender.zip,
        address: firstSender.address,
        addressDetail: firstSender.address_detail,
        isDefault: firstSender.is_default,
        createdAt: new Date(firstSender.created_at),
      } as OrderSender;
    }

    // 둘 다 없으면 기본값 생성
    const { data: newSender } = await supabase
      .from('order_senders')
      .insert({
        name: 'ANH 물류센터',
        phone: '010-1234-5678',
        zip: '10009',
        address: '경기도 김포시 통진읍',
        address_detail: '서암고정로 295',
        is_default: true,
      })
      .select()
      .single();

    await supabase.from('order_default_settings').upsert({
      config_key: 'default',
      sender_name: newSender!.name,
      sender_phone: newSender!.phone,
      sender_zip: newSender!.zip,
      sender_address: newSender!.address,
      sender_address_detail: newSender!.address_detail,
      updated_at: new Date().toISOString(),
    });

    return {
      id: newSender!.id,
      name: newSender!.name,
      phone: newSender!.phone,
      zip: newSender!.zip,
      address: newSender!.address,
      addressDetail: newSender!.address_detail,
      isDefault: newSender!.is_default,
      createdAt: new Date(newSender!.created_at),
    } as OrderSender;
  }

  await supabase.from('order_default_settings').upsert({
    config_key: 'default',
    sender_name: data.name,
    sender_phone: data.phone,
    sender_zip: data.zip,
    sender_address: data.address,
    sender_address_detail: data.address_detail,
    updated_at: new Date().toISOString(),
  });

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    zip: data.zip,
    address: data.address,
    addressDetail: data.address_detail,
    isDefault: data.is_default,
    createdAt: new Date(data.created_at),
  } as OrderSender;
}

