import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { tryLogin } from '../e2e/utils';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function getRequiredEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    adminEmail: process.env.E2E_ADMIN_EMAIL || '',
    adminPassword: process.env.E2E_ADMIN_PASSWORD || '',
    receiptId: process.env.E2E_READONLY_RECEIPT_ID || '',
    smokeBypassToken: process.env.CI_SMOKE_BYPASS_TOKEN || '',
  };
}

function createServiceRoleClient() {
  const { supabaseUrl, serviceRoleKey } = getRequiredEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
test.describe('최소 API 상태 검증', () => {
  test.setTimeout(20_000);

  test('/api/health 가 응답한다', async ({ request }) => {
    const { smokeBypassToken } = getRequiredEnv();
    test.skip(!smokeBypassToken, 'CI_SMOKE_BYPASS_TOKEN 없이 실행한 경우 health smoke는 skip 합니다.');
    const headers = { 'x-ci-smoke-bypass': smokeBypassToken };

    const res = await request.get('/api/health', { headers });
    expect(res.ok(), `/api/health 호출 실패: ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('anh-wms');
  });

  test('Supabase 읽기 연결이 가능하다', async () => {
    const { supabaseUrl, serviceRoleKey } = getRequiredEnv();
    test.skip(!supabaseUrl || !serviceRoleKey, 'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없어 skip 합니다.');

    const db = createServiceRoleClient();
    const { count, error } = await db
      .from('inventory_ledger')
      .select('id', { count: 'exact', head: true });

    expect(error, error?.message || 'Supabase 연결 오류').toBeNull();
    expect(typeof count === 'number' || count === null).toBeTruthy();
  });

  test('GET /api/inbound/[id] 는 기본 구조를 반환한다', async ({ page }) => {
    const { supabaseUrl, serviceRoleKey, adminEmail, adminPassword, receiptId: readonlyReceiptId } = getRequiredEnv();
    test.skip(
      !supabaseUrl || !serviceRoleKey || !adminEmail || !adminPassword,
      '입고 조회 검증용 Supabase/관리자 환경변수가 없어 skip 합니다.',
    );

    const login = await tryLogin(page, adminEmail, adminPassword);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const db = createServiceRoleClient();
    let receiptId = readonlyReceiptId;

    if (!receiptId) {
      const { data, error } = await db
        .from('inbound_receipts')
        .select('id')
        .neq('id', ZERO_UUID)
        .limit(1)
        .maybeSingle();

      expect(error, error?.message || '읽기 전용 receipt 조회 실패').toBeNull();
      test.skip(!data?.id, '검증 가능한 inbound_receipts 데이터가 없어 skip 합니다.');
      receiptId = data!.id;
    }

    const res = await page.request.get(`/api/inbound/${receiptId}`);
    expect(res.ok(), `/api/inbound/${receiptId} 호출 실패: ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(receiptId);
    expect(typeof body.data.productName).toBe('string');
    expect(typeof body.data.quantity).toBe('number');
    expect(Array.isArray(body.data.lines)).toBe(true);
  });

  test('GET /api/admin/audit-logs 는 관리자 기준 조회 가능하다', async ({ page }) => {
    const { supabaseUrl, supabaseAnonKey, adminEmail, adminPassword } = getRequiredEnv();
    test.skip(
      !supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword,
      '관리자 API 검증용 환경변수가 없어 skip 합니다.',
    );

    const login = await tryLogin(page, adminEmail, adminPassword);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const res = await page.request.get('/api/admin/audit-logs?page=1&limit=5', {
      headers: { 'x-request-id': `ci-audit-${Date.now()}` },
    });

    expect(res.ok(), `/api/admin/audit-logs 호출 실패: ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.pagination).toBeTruthy();
    expect(typeof body.data.pagination.page).toBe('number');
  });
});
