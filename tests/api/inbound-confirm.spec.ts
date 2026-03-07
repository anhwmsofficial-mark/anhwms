import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function getRequiredEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function createServiceRoleClient() {
  const { supabaseUrl, serviceRoleKey } = getRequiredEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe('입고 확정 최소 검증', () => {
  test.setTimeout(15_000);

  test('confirm_inbound_receipt RPC 가 존재하고 호출 가능하다', async () => {
    const { supabaseUrl, serviceRoleKey } = getRequiredEnv();
    test.skip(!supabaseUrl || !serviceRoleKey, 'RPC 검증용 Supabase 환경변수가 없어 skip 합니다.');

    const db = createServiceRoleClient();
    const { data, error } = await db.rpc('confirm_inbound_receipt', {
      p_receipt_id: ZERO_UUID,
      p_user_id: ZERO_UUID,
    });

    expect(error, error?.message || 'RPC 호출 자체가 실패했습니다.').toBeNull();
    expect(data, 'RPC 응답 데이터가 없습니다.').toBeTruthy();
    expect(typeof data.success).toBe('boolean');
  });

  test('inventory_ledger 테이블을 읽기 전용으로 조회할 수 있다', async () => {
    const { supabaseUrl, serviceRoleKey } = getRequiredEnv();
    test.skip(!supabaseUrl || !serviceRoleKey, 'Ledger 검증용 Supabase 환경변수가 없어 skip 합니다.');

    const db = createServiceRoleClient();
    const { data, error } = await db
      .from('inventory_ledger')
      .select('id, created_at, transaction_type, quantity')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(error, error?.message || 'inventory_ledger 조회 실패').toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
