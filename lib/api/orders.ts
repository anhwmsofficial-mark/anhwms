import { supabase } from '../supabase';
import { Order, LogisticsApiLog, PaginationMeta } from '@/types';
import type { Database, Tables } from '@/types/supabase';

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

type OrderRow = Tables<'orders'>;
type OrderReceiverRow = Tables<'order_receivers'>;
type LogisticsApiLogRow = Tables<'logistics_api_logs'>;
type OrderSenderRow = Tables<'order_senders'>;
type OrderDefaultSettingsRow = Tables<'order_default_settings'>;
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

type OrderSelectRow = OrderRow & {
  receiver?: OrderReceiverRow[];
  logs?: LogisticsApiLogRow[];
};

function mapLogRows(logs?: LogisticsApiLogRow[]): LogisticsApiLog[] | undefined {
  if (!logs) return undefined;
  return logs.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    adapter: item.adapter,
    direction: item.direction,
    status: item.status,
    httpCode: item.http_code,
    headers: item.headers,
    body: item.body,
    createdAt: new Date(item.created_at),
  }));
}

function mapOrderRow(item: OrderSelectRow): Order {
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
  };
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

  const { data, error, count } = await query.returns<OrderSelectRow[]>();
  if (error) throw error;

  const rows = data || [];
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].created_at : null;
  const total = count || 0;
  const totalPages = limit ? Math.ceil(total / limit) : 1;

  return {
    data: rows.map(mapOrderRow),
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
  const updates: OrderUpdate = {
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

  return (data || []).map((item) => ({
    id: item.id,
    orderId: item.order_id,
    adapter: item.adapter,
    direction: item.direction,
    status: item.status,
    httpCode: item.http_code,
    headers: item.headers,
    body: item.body,
    createdAt: new Date(item.created_at),
  }));
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

  const settingsRow = settings as OrderDefaultSettingsRow | null;

  if (settingsRow) {
    return {
      id: settingsRow.config_key,
      name: settingsRow.sender_name,
      phone: settingsRow.sender_phone,
      zip: settingsRow.sender_zip,
      address: settingsRow.sender_address,
      addressDetail: settingsRow.sender_address_detail,
      isDefault: true,
      createdAt: new Date(settingsRow.created_at),
    };
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

    const firstSenderRow = firstSender as OrderSenderRow | null;
    if (firstSenderRow) {
      return {
        id: firstSenderRow.id,
        name: firstSenderRow.name,
        phone: firstSenderRow.phone,
        zip: firstSenderRow.zip,
        address: firstSenderRow.address,
        addressDetail: firstSenderRow.address_detail,
        isDefault: firstSenderRow.is_default,
        createdAt: new Date(firstSenderRow.created_at),
      };
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

    const newSenderRow = newSender as OrderSenderRow | null;
    if (!newSenderRow) {
      throw new Error('기본 발송인 생성에 실패했습니다.');
    }

    await supabase.from('order_default_settings').upsert({
      config_key: 'default',
      sender_name: newSenderRow.name,
      sender_phone: newSenderRow.phone,
      sender_zip: newSenderRow.zip,
      sender_address: newSenderRow.address,
      sender_address_detail: newSenderRow.address_detail,
      updated_at: new Date().toISOString(),
    });

    return {
      id: newSenderRow.id,
      name: newSenderRow.name,
      phone: newSenderRow.phone,
      zip: newSenderRow.zip,
      address: newSenderRow.address,
      addressDetail: newSenderRow.address_detail,
      isDefault: newSenderRow.is_default,
      createdAt: new Date(newSenderRow.created_at),
    };
  }

  const senderRow = data as OrderSenderRow;
  await supabase.from('order_default_settings').upsert({
    config_key: 'default',
    sender_name: senderRow.name,
    sender_phone: senderRow.phone,
    sender_zip: senderRow.zip,
    sender_address: senderRow.address,
    sender_address_detail: senderRow.address_detail,
    updated_at: new Date().toISOString(),
  });

  return {
    id: senderRow.id,
    name: senderRow.name,
    phone: senderRow.phone,
    zip: senderRow.zip,
    address: senderRow.address,
    addressDetail: senderRow.address_detail,
    isDefault: senderRow.is_default,
    createdAt: new Date(senderRow.created_at),
  };
}

