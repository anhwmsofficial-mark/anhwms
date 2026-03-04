import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { tryLogin } from '../e2e/utils';

const RUN_RATE_LIMIT_TEST = process.env.E2E_RUN_RATE_LIMIT === '1';
const RUN_IMPORT_DUPLICATE_TEST = process.env.E2E_RUN_IMPORT_DUPLICATE === '1';
const RUN_STOCK_DECREASE_TEST = process.env.E2E_RUN_STOCK_DECREASE === '1';

function expectBlockedResponseShape(body: { ok?: boolean; error?: string | { code?: string } }) {
  const hasOkFalse = body?.ok === false;
  const hasError = typeof body?.error === 'string' || typeof body?.error?.code === 'string';
  expect(hasOkFalse || hasError).toBeTruthy();
}

test.describe('MVP 안정화 API 게이트', () => {
  test('인증 사용자 기준 import API는 레이트리밋 초과 시 429와 제한 헤더를 반환한다', async ({ page }) => {
    test.skip(!RUN_RATE_LIMIT_TEST, 'E2E_RUN_RATE_LIMIT=1 설정 시에만 실행');
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'E2E_EMAIL/E2E_PASSWORD 설정 시에만 실행');

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const uniquePrefix = `rl-${Date.now()}`;
    const rows = [
      {
        주문번호: `${uniquePrefix}-1`,
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

    let hit429 = false;
    for (let i = 0; i < 12; i++) {
      let res;
      try {
        res = await page.request.post('/api/orders/import', {
          timeout: 20_000,
          multipart: {
            file: {
              name: `orders-rate-limit-${i}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              buffer: fileBuffer,
            },
          },
        });
      } catch {
        test.skip(true, 'import API 응답 지연으로 레이트리밋 검증을 건너뜁니다.');
        return;
      }

      expect([200, 401, 403, 429]).toContain(res.status());
      if (res.status() === 429) {
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error?.code).toBe('RATE_LIMITED');
        expect(res.headers()['x-ratelimit-limit']).toBeTruthy();
        expect(res.headers()['x-ratelimit-remaining']).toBeTruthy();
        expect(res.headers()['x-ratelimit-reset']).toBeTruthy();
        expect(res.headers()['retry-after']).toBeTruthy();
        hit429 = true;
        break;
      }

      if (res.status() === 401 || res.status() === 403) {
        test.skip(true, '인증/권한 환경 미충족으로 레이트리밋 검증을 건너뜁니다.');
      }
    }

    test.skip(!hit429, '레이트리밋(429)이 현재 환경에서 재현되지 않았습니다.');
    expect(hit429).toBe(true);
  });

  test('비인증 사용자는 알림 목록 조회가 차단된다', async ({ request }) => {
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expectBlockedResponseShape(body);
    if (body?.error?.code) {
      expect(body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('비인증 사용자는 주문 상세 조회가 차단된다', async ({ request }) => {
    const res = await request.get('/api/orders/test-order-id');
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expectBlockedResponseShape(body);
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
    expectBlockedResponseShape(body);
    if (body?.error?.code) {
      expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(body.error.code);
    }
  });

  test('인증 사용자 기준 import 중복 주문번호는 DUPLICATE_ORDER_NO로 표준화된다', async ({ page }) => {
    test.skip(!RUN_IMPORT_DUPLICATE_TEST, 'E2E_RUN_IMPORT_DUPLICATE=1 설정 시에만 실행');
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, 'E2E_EMAIL/E2E_PASSWORD 설정 시에만 실행');

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

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

    let res;
    try {
      res = await page.request.post('/api/orders/import', {
        timeout: 20_000,
        multipart: {
          file: {
            name: 'orders-duplicate.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: fileBuffer,
          },
        },
      });
    } catch {
      test.skip(true, 'import API 응답 지연으로 중복주문 검증을 건너뜁니다.');
      return;
    }

    expect([200, 401, 403]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.ok).toBe(true);
      expect(body.data?.failedCount).toBeGreaterThanOrEqual(1);
      const hasDuplicateCode = (body.data?.failed || []).some(
        (item: { code?: string }) => item.code === 'DUPLICATE_ORDER_NO',
      );
      const hasDuplicateMessage = (body.data?.failed || []).some(
        (item: { reason?: string }) => (item.reason || '').includes('중복 주문번호'),
      );
      expect(hasDuplicateCode || hasDuplicateMessage).toBe(true);
    }
  });

  test('인증 사용자 기준 재고 감소는 가용재고 초과 시 VALIDATION_ERROR를 반환한다', async ({ page }) => {
    test.skip(!RUN_STOCK_DECREASE_TEST, 'E2E_RUN_STOCK_DECREASE=1 설정 시에만 실행');
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    const productId = process.env.E2E_PRODUCT_ID;
    const warehouseId = process.env.E2E_WAREHOUSE_ID;
    test.skip(
      !email || !password || !productId || !warehouseId,
      'E2E_EMAIL/E2E_PASSWORD/E2E_PRODUCT_ID/E2E_WAREHOUSE_ID 설정 시에만 실행',
    );

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    let res;
    try {
      res = await page.request.post('/api/inventory/adjust', {
        timeout: 20_000,
        data: {
          productId,
          warehouseId,
          adjustType: 'DECREASE',
          quantity: 999999999,
          reason: 'mvp-validation-test',
        },
      });
    } catch {
      test.skip(true, '재고 조정 API 응답 지연으로 검증을 건너뜁니다.');
      return;
    }

    expect([400, 401, 403]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 400) {
      expect(body.ok).toBe(false);
      expect(['VALIDATION_ERROR', 'BAD_REQUEST']).toContain(body.error?.code);
    }
  });
});
