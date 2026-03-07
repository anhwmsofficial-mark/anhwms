import { expect, test, type Page } from '@playwright/test';
import { tryLogin } from '../e2e/utils';
import {
  createInboundReceiptFixture,
  createServiceRoleClient,
  findReadableReceiptIdByLineMode,
  getInboundInspectEnv,
} from '../helpers/inboundInspectHelper';

const RUN_WRITE_TESTS = process.env.E2E_RUN_INBOUND_INSPECT_WRITE === '1';
const RUN_FOREIGN_TENANT_TEST = process.env.E2E_RUN_INBOUND_TENANT_MISMATCH === '1';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

async function ensureAdminLogin(page: Page) {
  const env = getInboundInspectEnv();
  test.skip(
    !env.adminEmail || !env.adminPassword,
    'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD 또는 E2E_EMAIL/E2E_PASSWORD 설정 시에만 실행합니다.',
  );

  const login = await tryLogin(page, env.adminEmail, env.adminPassword);
  test.skip(!login.ok, login.ok ? '' : login.reason);
}

async function withFixture<T>(
  options: Parameters<typeof createInboundReceiptFixture>[0],
  run: (fixture: Awaited<ReturnType<typeof createInboundReceiptFixture>>) => Promise<T>,
) {
  test.skip(!RUN_WRITE_TESTS, 'E2E_RUN_INBOUND_INSPECT_WRITE=1 설정 시에만 쓰기 기반 검수를 실행합니다.');

  const fixture = await createInboundReceiptFixture(options);
  try {
    return await run(fixture);
  } finally {
    await fixture.cleanup();
  }
}

test.describe('입고 검수 API', () => {
  test.setTimeout(45_000);

  test('비인증 사용자는 검수 저장이 차단된다', async ({ request }) => {
    const response = await request.post(`/api/inbound/${ZERO_UUID}/inspect`, {
      data: { receivedQty: 1, rejectedQty: 0, completeInbound: false },
    });

    expect([401, 403]).toContain(response.status());
    const rawBody = await response.text();
    expect(rawBody.length).toBeGreaterThan(0);
  });

  test('단일 품목 조회 성공', async ({ page }) => {
    await ensureAdminLogin(page);

    const receiptId =
      getInboundInspectEnv().readonlyReceiptId || (await findReadableReceiptIdByLineMode('single'));
    test.skip(!receiptId, '조회 가능한 단일 품목 receipt 데이터가 없어 skip 합니다.');

    const response = await page.request.get(`/api/inbound/${receiptId}`);
    expect(response.ok(), `단일 품목 조회 실패: ${response.status()}`).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(receiptId);
    expect(Array.isArray(body.data.lines)).toBe(true);
    expect(body.data.lines).toHaveLength(1);
  });

  test('다품목 조회 성공', async ({ page }) => {
    await ensureAdminLogin(page);

    const receiptId = await findReadableReceiptIdByLineMode('multi');
    test.skip(!receiptId, '조회 가능한 다품목 receipt 데이터가 없어 skip 합니다.');

    const response = await page.request.get(`/api/inbound/${receiptId}`);
    expect(response.ok(), `다품목 조회 실패: ${response.status()}`).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(receiptId);
    expect(Array.isArray(body.data.lines)).toBe(true);
    expect(body.data.lines.length).toBeGreaterThan(1);
  });

  test('단일 품목 저장 성공과 inspection history/audit log 적재', async ({ page }) => {
    await ensureAdminLogin(page);

    await withFixture({ lineCount: 1, expectedQtys: [10] }, async (fixture) => {
      const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
        headers: { 'x-request-id': `inspect-legacy-${Date.now()}` },
        data: {
          receivedQty: 7,
          rejectedQty: 0,
          note: 'legacy-single-save',
          completeInbound: false,
        },
      });

      expect(response.ok(), `단일 품목 저장 실패: ${response.status()}`).toBeTruthy();
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.success).toBe(true);

      const db = createServiceRoleClient();
      const lineId = fixture.lines[0].id;
      const { data: line, error: lineError } = await db
        .from('inbound_receipt_lines')
        .select('accepted_qty, damaged_qty, received_qty, notes')
        .eq('id', lineId)
        .single();

      expect(lineError, lineError?.message || 'receipt line 조회 실패').toBeNull();
      expect(line?.accepted_qty).toBe(7);
      expect(line?.damaged_qty).toBe(0);
      expect(line?.received_qty).toBe(7);
      expect(line?.notes).toBe('legacy-single-save');

      const { data: receipt, error: receiptError } = await db
        .from('inbound_receipts')
        .select('status')
        .eq('id', fixture.receiptId)
        .single();
      expect(receiptError, receiptError?.message || 'receipt 조회 실패').toBeNull();
      expect(receipt?.status).toBe('INSPECTING');

      const { count: inspectionCount, error: inspectionError } = await db
        .from('inbound_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('inbound_id', fixture.receiptId);
      expect(inspectionError, inspectionError?.message || 'inspection history 조회 실패').toBeNull();
      expect(inspectionCount).toBe(1);

      const { count: auditCount, error: auditError } = await db
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('resource_id', fixture.receiptId);
      expect(auditError, auditError?.message || 'audit log 조회 실패').toBeNull();
      expect((auditCount || 0) >= 1).toBe(true);
    });
  });

  test('단일 품목 finalize 성공 시 PUTAWAY_READY 로 전이된다', async ({ page }) => {
    await ensureAdminLogin(page);

    await withFixture({ lineCount: 1, expectedQtys: [10] }, async (fixture) => {
      const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
        data: {
          receivedQty: 10,
          rejectedQty: 0,
          note: 'legacy-finalize-success',
          completeInbound: true,
        },
      });

      expect(response.ok(), `단일 품목 finalize 실패: ${response.status()}`).toBeTruthy();
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.success).toBe(true);
      expect(body.data.status).toBe('PUTAWAY_READY');
      expect(body.data.discrepancy).toBe(false);

      const db = createServiceRoleClient();
      const { data: receipt, error: receiptError } = await db
        .from('inbound_receipts')
        .select('status, confirmed_at')
        .eq('id', fixture.receiptId)
        .single();
      expect(receiptError, receiptError?.message || 'finalize 후 receipt 조회 실패').toBeNull();
      expect(receipt?.status).toBe('PUTAWAY_READY');
      expect(receipt?.confirmed_at).toBeTruthy();

      const { count: ledgerCount, error: ledgerError } = await db
        .from('inventory_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('reference_type', 'INBOUND_RECEIPT')
        .eq('reference_id', fixture.receiptId);
      expect(ledgerError, ledgerError?.message || 'inventory_ledger 조회 실패').toBeNull();
      expect(ledgerCount).toBe(1);
    });
  });

  test('다품목 lines[] 저장 성공', async ({ page }) => {
    await ensureAdminLogin(page);

    await withFixture({ lineCount: 2, expectedQtys: [5, 7] }, async (fixture) => {
      const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
        data: {
          completeInbound: false,
          lines: [
            {
              receiptLineId: fixture.lines[0].id,
              acceptedQty: 5,
              damagedQty: 0,
              note: 'multi-line-1',
            },
            {
              receiptLineId: fixture.lines[1].id,
              acceptedQty: 6,
              damagedQty: 1,
              note: 'multi-line-2',
            },
          ],
        },
      });

      expect(response.ok(), `다품목 저장 실패: ${response.status()}`).toBeTruthy();
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.success).toBe(true);

      const db = createServiceRoleClient();
      const { data: lines, error: linesError } = await db
        .from('inbound_receipt_lines')
        .select('id, accepted_qty, damaged_qty, received_qty, notes')
        .eq('receipt_id', fixture.receiptId)
        .order('created_at', { ascending: true });
      expect(linesError, linesError?.message || '다품목 line 조회 실패').toBeNull();
      expect(lines).toHaveLength(2);
      expect(lines?.[0].accepted_qty).toBe(5);
      expect(lines?.[0].damaged_qty).toBe(0);
      expect(lines?.[1].accepted_qty).toBe(6);
      expect(lines?.[1].damaged_qty).toBe(1);
      expect(lines?.[1].received_qty).toBe(7);

      const { data: receipt, error: receiptError } = await db
        .from('inbound_receipts')
        .select('status')
        .eq('id', fixture.receiptId)
        .single();
      expect(receiptError, receiptError?.message || '다품목 receipt 조회 실패').toBeNull();
      expect(receipt?.status).toBe('DISCREPANCY');
    });
  });

  test('다품목 일부 라인만 보내면 BAD_REQUEST 가 반환된다', async ({ page }) => {
    await ensureAdminLogin(page);

    await withFixture({ lineCount: 2, expectedQtys: [5, 7] }, async (fixture) => {
      const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
        data: {
          completeInbound: false,
          lines: [
            {
              receiptLineId: fixture.lines[0].id,
              acceptedQty: 5,
              damagedQty: 0,
              note: 'partial-only',
            },
          ],
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.code).toBe('BAD_REQUEST');

      const db = createServiceRoleClient();
      const { count: inspectionCount, error: inspectionError } = await db
        .from('inbound_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('inbound_id', fixture.receiptId);
      expect(inspectionError, inspectionError?.message || 'partial save 후 inspection 조회 실패').toBeNull();
      expect(inspectionCount).toBe(0);
    });
  });

  for (const blockedStatus of ['CONFIRMED', 'PUTAWAY_READY', 'CANCELLED'] as const) {
    test(`${blockedStatus} 상태는 수정이 차단된다`, async ({ page }) => {
      await ensureAdminLogin(page);

      await withFixture(
        { lineCount: 1, expectedQtys: [4], initialStatus: blockedStatus },
        async (fixture) => {
          const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
            data: {
              receivedQty: 4,
              rejectedQty: 0,
              note: `${blockedStatus}-blocked`,
              completeInbound: false,
            },
          });

          expect(response.status()).toBe(400);
          const body = await response.json();
          expect(body.ok).toBe(false);
          expect(body.code).toBe('BAD_REQUEST');
        },
      );
    });
  }

  test('필수 사진 누락 시 finalize 는 실패하고 저장이 rollback 된다', async ({ page }) => {
    await ensureAdminLogin(page);

    await withFixture(
      {
        lineCount: 1,
        expectedQtys: [6],
        requiredPhotoSlots: [{ slot_key: 'LABEL', title: '라벨 사진', min_photos: 1 }],
      },
      async (fixture) => {
        const response = await page.request.post(`/api/inbound/${fixture.receiptId}/inspect`, {
          data: {
            receivedQty: 6,
            rejectedQty: 0,
            note: 'missing-photo-finalize',
            completeInbound: true,
          },
        });

        expect([400, 500]).toContain(response.status());
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(String(body.message || body.error || '')).toContain('필수 사진');

        const db = createServiceRoleClient();
        const { data: receipt, error: receiptError } = await db
          .from('inbound_receipts')
          .select('status')
          .eq('id', fixture.receiptId)
          .single();
        expect(receiptError, receiptError?.message || 'rollback 후 receipt 조회 실패').toBeNull();
        expect(receipt?.status).toBe('ARRIVED');

        const { data: line, error: lineError } = await db
          .from('inbound_receipt_lines')
          .select('accepted_qty, received_qty, damaged_qty')
          .eq('id', fixture.lines[0].id)
          .single();
        expect(lineError, lineError?.message || 'rollback 후 line 조회 실패').toBeNull();
        expect(line?.accepted_qty).toBe(0);
        expect(line?.received_qty).toBe(0);
        expect(line?.damaged_qty).toBe(0);

        const { count: inspectionCount, error: inspectionError } = await db
          .from('inbound_inspections')
          .select('id', { count: 'exact', head: true })
          .eq('inbound_id', fixture.receiptId);
        expect(inspectionError, inspectionError?.message || 'rollback 후 inspection 조회 실패').toBeNull();
        expect(inspectionCount).toBe(0);
      },
    );
  });

  test('tenant mismatch 차단은 foreign receipt 지정 시 검증할 수 있다', async ({ page }) => {
    test.skip(
      !RUN_FOREIGN_TENANT_TEST,
      'E2E_RUN_INBOUND_TENANT_MISMATCH=1 설정 시에만 foreign tenant 차단 검증을 실행합니다.',
    );

    await ensureAdminLogin(page);
    const foreignReceiptId = getInboundInspectEnv().foreignReceiptId;
    test.skip(!foreignReceiptId, 'E2E_FOREIGN_RECEIPT_ID 가 없어 tenant mismatch 검증을 skip 합니다.');

    const response = await page.request.post(`/api/inbound/${foreignReceiptId}/inspect`, {
      data: {
        receivedQty: 1,
        rejectedQty: 0,
        note: 'foreign-tenant-attempt',
        completeInbound: false,
      },
    });

    expect([400, 403, 404]).toContain(response.status());
    const body = await response.json();
    expect(body.ok).toBe(false);
  });
});
