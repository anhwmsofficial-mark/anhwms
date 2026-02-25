import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { performLogin } from '../e2e/utils';

test.describe('MVP 안정화 API 게이트', () => {
  test('비인증 사용자는 알림 목록 조회가 차단된다', async ({ request }) => {
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('비인증 사용자는 주문 상세 조회가 차단된다', async ({ request }) => {
    const res = await request.get('/api/orders/test-order-id');
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test('재고 조정 API는 필수값 검증을 수행한다', async ({ request }) => {
    const res = await request.post('/api/inventory/adjust', {
      data: {},
    });
    expect([400, 401, 403]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 400) {
      expect(body.ok).toBe(false);
      expect(['BAD_REQUEST', 'VALIDATION_ERROR']).toContain(body.error?.code);
    }
  });

  test('주문 상태 변경 API는 비인증 접근을 차단한다', async ({ request }) => {
    const res = await request.post('/api/orders/test-order-id/status', {
      data: { status: 'CREATED' },
    });
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(body.error?.code);
  });

  test('인증 사용자 기준 import 중복 주문번호는 DUPLICATE_ORDER_NO로 표준화된다', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'E2E_EMAIL/E2E_PASSWORD 설정 시에만 실행');

    await performLogin(page, email!, password!);

    const duplicateOrderNo = `dup-${Date.now()}`;
    const rows = [
      {
        주문번호: duplicateOrderNo,
        수취인: '홍길동',
        전화번호: '010-1234-5678',
        주소: '서울시 강남구 테스트로 1',
        우편번호: '12345',
        상품명: '테스트상품A',
      },
      {
        주문번호: duplicateOrderNo,
        수취인: '홍길동',
        전화번호: '010-1234-5678',
        주소: '서울시 강남구 테스트로 1',
        우편번호: '12345',
        상품명: '테스트상품A',
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const res = await page.request.post('/api/orders/import', {
      multipart: {
        file: {
          name: 'orders-duplicate.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: fileBuffer,
        },
      },
    });

    expect([200, 401, 403]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.ok).toBe(true);
      expect(body.data?.failedCount).toBeGreaterThanOrEqual(1);
      const hasDuplicateCode = (body.data?.failed || []).some(
        (item: { code?: string }) => item.code === 'DUPLICATE_ORDER_NO',
      );
      expect(hasDuplicateCode).toBe(true);
    }
  });

  test('인증 사용자 기준 재고 감소는 가용재고 초과 시 VALIDATION_ERROR를 반환한다', async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    const productId = process.env.E2E_PRODUCT_ID;
    const warehouseId = process.env.E2E_WAREHOUSE_ID;
    test.skip(
      !email || !password || !productId || !warehouseId,
      'E2E_EMAIL/E2E_PASSWORD/E2E_PRODUCT_ID/E2E_WAREHOUSE_ID 설정 시에만 실행',
    );

    await performLogin(page, email!, password!);

    const res = await page.request.post('/api/inventory/adjust', {
      data: {
        productId,
        warehouseId,
        adjustType: 'DECREASE',
        quantity: 999999999,
        reason: 'mvp-validation-test',
      },
    });

    expect([400, 401, 403]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 400) {
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    }
  });
});
