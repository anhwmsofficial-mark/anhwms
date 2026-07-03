import { expect, test } from '@playwright/test';
import { tryLogin } from '../e2e/utils';

const RUN_SHARE_BRUTE_FORCE_TEST = process.env.E2E_RUN_SHARE_BRUTE_FORCE === '1';
const RUN_FOREIGN_OWNERSHIP_TEST = process.env.E2E_RUN_FOREIGN_OWNERSHIP === '1';
const RUN_UPLOAD_VALIDATION_TEST = process.env.E2E_RUN_UPLOAD_VALIDATION === '1';

function getE2ECredentials() {
  const email = process.env.E2E_EMAIL || process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_PASSWORD || process.env.E2E_ADMIN_PASSWORD;
  return { email, password };
}

test.describe('보안 하드닝 API 검증', () => {
  test('비인증 사용자는 common-codes 수정이 차단된다', async ({ request }) => {
    const response = await request.post('/api/common-codes', {
      data: {
        group_code: 'TEST',
        code: 'SECURITY',
        label: '보안 테스트',
      },
    });

    expect([401, 403]).toContain(response.status());
    const body = await response.json();
    expect(String(body.error || body.message || '')).not.toBe('');
  });

  test('비인증 사용자는 inbound-share 관리 API 접근이 차단된다', async ({ request }) => {
    const listResponse = await request.get('/api/admin/inbound-share?receipt_id=test');
    expect([401, 403]).toContain(listResponse.status());

    const createResponse = await request.post('/api/admin/inbound-share', {
      data: { receipt_id: 'test' },
    });
    expect([401, 403]).toContain(createResponse.status());
  });

  test('비인증 사용자는 inventory volume share 관리 API 접근이 차단된다', async ({ request }) => {
    const listResponse = await request.get('/api/admin/inventory/volume/share?customer_id=test');
    expect([401, 403]).toContain(listResponse.status());

    const createResponse = await request.post('/api/admin/inventory/volume/share', {
      data: { customer_id: 'test' },
    });
    expect([401, 403]).toContain(createResponse.status());
  });

  test('비인증 사용자는 글로벌 풀필먼트 관리 API 접근이 차단된다', async ({ request }) => {
    const statsResponse = await request.get('/api/global-fulfillment/stats');
    expect([401, 403]).toContain(statsResponse.status());

    const ordersResponse = await request.post('/api/global-fulfillment/orders', {
      data: {
        orderNumber: 'GF-SECURITY-TEST',
        customerId: '00000000-0000-4000-8000-000000000000',
      },
    });
    expect([401, 403]).toContain(ordersResponse.status());

    const exceptionsResponse = await request.post('/api/global-fulfillment/exceptions', {
      data: {
        orderId: '00000000-0000-4000-8000-000000000000',
        exceptionType: 'security-test',
        title: 'security test',
      },
    });
    expect([401, 403]).toContain(exceptionsResponse.status());
  });

  test('cron 엔드포인트는 인증 누락 시 실행되지 않는다', async ({ request }) => {
    const response = await request.get('/api/cron/alerts');
    expect([401, 503]).toContain(response.status());
    const body = await response.json();
    expect(String(body.error || body.message || '')).not.toBe('');
  });

  test('공유 비밀번호 실패 누적 시 잠금 또는 rate-limit이 발생한다', async ({ request }) => {
    test.skip(!RUN_SHARE_BRUTE_FORCE_TEST, 'E2E_RUN_SHARE_BRUTE_FORCE=1 설정 시에만 실행');
    const slug = process.env.E2E_SHARE_INVENTORY_SLUG || process.env.E2E_SHARE_INBOUND_SLUG;
    const route = process.env.E2E_SHARE_INVENTORY_SLUG ? '/api/share/inventory' : '/api/share/inbound';
    test.skip(!slug, 'E2E_SHARE_INVENTORY_SLUG 또는 E2E_SHARE_INBOUND_SLUG 설정 시에만 실행');

    let sawThrottle = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request.post(route, {
        data: { slug, password: `wrong-password-${attempt}` },
      });

      expect([401, 404, 429]).toContain(response.status());
      if (response.status() === 429) {
        sawThrottle = true;
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.code).toBe('RATE_LIMITED');
        break;
      }
    }

    expect(sawThrottle).toBe(true);
  });

  test('타 조직 인수증 공유 접근은 403 또는 404로 차단된다', async ({ page }) => {
    test.skip(!RUN_FOREIGN_OWNERSHIP_TEST, 'E2E_RUN_FOREIGN_OWNERSHIP=1 설정 시에만 실행');
    const { email, password } = getE2ECredentials();
    const foreignReceiptId = process.env.E2E_FOREIGN_RECEIPT_ID;
    test.skip(
      !email || !password || !foreignReceiptId,
      'E2E_EMAIL 또는 E2E_ADMIN_EMAIL, E2E_PASSWORD 또는 E2E_ADMIN_PASSWORD, E2E_FOREIGN_RECEIPT_ID 설정 시에만 실행',
    );

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const response = await page.request.get(`/api/admin/inbound-share?receipt_id=${encodeURIComponent(foreignReceiptId!)}`);
    expect([403, 404]).toContain(response.status());
  });

  test('허용되지 않은 업로드 파일은 서버에서 거부된다', async ({ page }) => {
    test.skip(!RUN_UPLOAD_VALIDATION_TEST, 'E2E_RUN_UPLOAD_VALIDATION=1 설정 시에만 실행');
    const { email, password } = getE2ECredentials();
    test.skip(
      !email || !password,
      'E2E_EMAIL 또는 E2E_ADMIN_EMAIL, E2E_PASSWORD 또는 E2E_ADMIN_PASSWORD 설정 시에만 실행',
    );

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const response = await page.request.post('/api/orders/import', {
      multipart: {
        file: {
          name: 'malicious.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('not-a-valid-spreadsheet', 'utf8'),
        },
      },
    });

    expect([400, 401, 403]).toContain(response.status());
    if (response.status() === 400) {
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.code).toBe('BAD_REQUEST');
    }
  });

  test('인증된 관리자 요청에서 공유 링크 생성 입력 검증이 동작한다', async ({ page }) => {
    const { email, password } = getE2ECredentials();
    test.skip(
      !email || !password,
      'E2E_EMAIL 또는 E2E_ADMIN_EMAIL, E2E_PASSWORD 또는 E2E_ADMIN_PASSWORD 설정 시에만 실행',
    );

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    const inventoryShare = await page.request.post('/api/admin/inventory/volume/share', {
      data: {
        customer_id: 'not-a-uuid',
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    expect(inventoryShare.status()).toBe(400);
    const inventoryBody = await inventoryShare.json();
    expect(inventoryBody.ok).toBe(false);
    expect(inventoryBody.code).toBe('BAD_REQUEST');

    const inboundShare = await page.request.post('/api/admin/inbound-share', {
      data: {
        receipt_id: 'not-a-uuid',
        language_default: 'de',
      },
    });
    expect(inboundShare.status()).toBe(400);
    const inboundBody = await inboundShare.json();
    expect(inboundBody.ok).toBe(false);
    expect(inboundBody.code).toBe('BAD_REQUEST');
  });
});
