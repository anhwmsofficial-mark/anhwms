/**
 * tests 전용 orders DB 직접 조회 helper
 * - preview/test DB 기준으로 order / recipient row 존재 여부·개수 조회
 * - 운영 코드와 분리, tests/ 폴더에서만 import
 * - SUPABASE_SERVICE_ROLE_KEY 필요 (test 환경 .env.local)
 */
import { createClient } from '@supabase/supabase-js';

export type OrderRowCounts = {
  ordersCount: number;
  receiversCount: number;
  /** 현재 orders/import 스키마에는 order_items 없음. 향후 확장용 */
  itemsCount?: number;
};

let _client: ReturnType<typeof createClient> | null = null;

function getTestDbClient() {
  if (_client) return _client;

  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !key) {
    return null;
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/**
 * DB 직접 조회가 가능한 환경인지 여부
 */
export function isOrdersDbHelperAvailable(): boolean {
  return getTestDbClient() !== null;
}

/**
 * order_no 기준으로 orders / order_receivers row 개수 조회
 * - orders: order_no 일치 건수 (0 또는 1)
 * - receivers: 해당 order의 order_receivers 건수
 */
export async function getOrderRowCountsByOrderNo(
  orderNo: string,
): Promise<OrderRowCounts | null> {
  const client = getTestDbClient();
  if (!client) return null;

  const { data: orders, error: ordersError } = await client
    .from('orders')
    .select('id')
    .eq('order_no', orderNo);

  if (ordersError) return null;

  const ordersCount = orders?.length ?? 0;
  const orderIds = (orders ?? []).map((r) => r.id);

  let receiversCount = 0;
  if (orderIds.length > 0) {
    const { data: receivers, error: receiversError } = await client
      .from('order_receivers')
      .select('id')
      .in('order_id', orderIds);

    if (!receiversError) {
      receiversCount = receivers?.length ?? 0;
    }
  }

  return {
    ordersCount,
    receiversCount,
  };
}
