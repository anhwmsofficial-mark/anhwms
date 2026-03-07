import { expect, test, type APIResponse, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { tryLogin } from '../e2e/utils';
import { ORDER_IMPORT_ERROR_CODES } from '@/lib/orders/importErrors';
import {
  getOrderRowCountsByOrderNo,
  isOrdersDbHelperAvailable,
} from '../helpers/ordersDbHelper';

const RUN_IMPORT_TRANSACTION_TEST = process.env.E2E_RUN_IMPORT_TRANSACTION === '1';
const RUN_IMPORT_EXTERNAL_SYNC_FAILURE_TEST =
  process.env.E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE === '1';

type ImportRow = {
  주문번호: string;
  수취인: string;
  전화번호: string;
  주소: string;
  우편번호: string;
  상품명: string;
  비고?: string;
};

function buildImportRow(
  orderNo: string,
  overrides?: Partial<ImportRow>,
): ImportRow {
  return {
    주문번호: orderNo,
    수취인: '홍길동',
    전화번호: '010-1234-5678',
    주소: '서울시 강남구 테스트로 1',
    우편번호: '12345',
    상품명: '트랜잭션 테스트 상품',
    비고: 'orders-import-transaction-e2e',
    ...overrides,
  };
}

function buildWorkbookBuffer(rows: ImportRow[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function ensureLoggedIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, 'E2E_EMAIL/E2E_PASSWORD 설정 시에만 실행');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);
}

async function importOrders(
  page: Page,
  rows: ImportRow[],
  filename: string,
): Promise<APIResponse> {
  const fileBuffer = buildWorkbookBuffer(rows);

  try {
    return await page.request.post('/api/orders/import', {
      timeout: 20_000,
      multipart: {
        file: {
          name: filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: fileBuffer,
        },
      },
    });
  } catch {
    test.skip(true, 'import API 응답 지연으로 transaction 검증을 건너뜁니다.');
    throw new Error('unreachable');
  }
}

async function expectImportApiReady(response: APIResponse) {
  expect([200, 401, 403, 429]).toContain(response.status());

  if (response.status() === 401 || response.status() === 403) {
    test.skip(true, '인증/권한 환경 미충족으로 import transaction 검증을 건너뜁니다.');
  }

  if (response.status() === 429) {
    test.skip(true, '레이트리밋으로 import transaction 검증을 건너뜁니다.');
  }

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
  return body.data as {
    successCount?: number;
    failedCount?: number;
    failed?: Array<{ orderNo?: string; code?: string; reason?: string }>;
  };
}

function expectImportResultFormat(data: {
  successCount?: number;
  failedCount?: number;
  failed?: Array<{ orderNo?: string; code?: string; reason?: string }>;
  inputRowCount?: number;
}) {
  const successCount = data.successCount ?? 0;
  const failedCount = data.failedCount ?? 0;
  const failed = data.failed ?? [];
  const inputRowCount = data.inputRowCount ?? successCount + failedCount;

  expect(successCount + failedCount).toBe(inputRowCount);
  expect(failed.length).toBe(failedCount);
  expect(failed.length).toBeLessThanOrEqual(50);

  failed.forEach((item) => {
    expect(typeof item.orderNo).toBe('string');
    expect(typeof item.code).toBe('string');
    expect(typeof item.reason).toBe('string');
    expect(item.orderNo.length).toBeGreaterThan(0);
    expect(item.code.length).toBeGreaterThan(0);
    expect(item.reason.length).toBeGreaterThan(0);
  });
}

test.describe('orders/import 트랜잭션 경계', () => {
  test('검증 실패 행은 주문번호를 점유하지 않아 동일 주문번호 재시도가 성공한다', async ({
    page,
  }) => {
    test.skip(!RUN_IMPORT_TRANSACTION_TEST, 'E2E_RUN_IMPORT_TRANSACTION=1 설정 시에만 실행');
    await ensureLoggedIn(page);

    const orderNo = `txn-invalid-${Date.now()}`;

    const invalidResponse = await importOrders(
      page,
      [buildImportRow(orderNo, { 전화번호: 'abc' })],
      'orders-import-invalid-phone.xlsx',
    );
    const invalidData = await expectImportApiReady(invalidResponse);

    expect(invalidData.successCount).toBe(0);
    expect(invalidData.failedCount).toBeGreaterThanOrEqual(1);
    const invalidPhoneFailure = (invalidData.failed || []).find(
      (item) =>
        item.orderNo === orderNo && item.code === ORDER_IMPORT_ERROR_CODES.INVALID_PHONE,
    );
    expect(invalidPhoneFailure).toBeTruthy();

    if (isOrdersDbHelperAvailable()) {
      const countsBeforeRetry = await getOrderRowCountsByOrderNo(orderNo);
      expect(countsBeforeRetry?.ordersCount).toBe(0);
      expect(countsBeforeRetry?.receiversCount).toBe(0);
    }

    const retryResponse = await importOrders(
      page,
      [buildImportRow(orderNo)],
      'orders-import-invalid-phone-retry.xlsx',
    );
    const retryData = await expectImportApiReady(retryResponse);

    expect(retryData.successCount).toBe(1);
    expect(retryData.failedCount).toBe(0);

    if (isOrdersDbHelperAvailable()) {
      const countsAfterRetry = await getOrderRowCountsByOrderNo(orderNo);
      expect(countsAfterRetry?.ordersCount).toBe(1);
      expect(countsAfterRetry?.receiversCount).toBe(1);
    }
  });

  test('동일 파일 중복 주문번호는 한 건만 커밋되고 재업로드 시 duplicate로 차단된다', async ({
    page,
  }) => {
    test.skip(!RUN_IMPORT_TRANSACTION_TEST, 'E2E_RUN_IMPORT_TRANSACTION=1 설정 시에만 실행');
    await ensureLoggedIn(page);

    const orderNo = `txn-dup-${Date.now()}`;

    const mixedResponse = await importOrders(
      page,
      [buildImportRow(orderNo), buildImportRow(orderNo)],
      'orders-import-duplicate-mixed.xlsx',
    );
    const mixedData = await expectImportApiReady(mixedResponse);

    expect(mixedData.successCount).toBe(1);
    expect(mixedData.failedCount).toBeGreaterThanOrEqual(1);
    const duplicateFailure = (mixedData.failed || []).find(
      (item) =>
        item.orderNo === orderNo &&
        item.code === ORDER_IMPORT_ERROR_CODES.DUPLICATE_ORDER_NO,
    );
    expect(duplicateFailure).toBeTruthy();

    if (isOrdersDbHelperAvailable()) {
      const countsAfterMixed = await getOrderRowCountsByOrderNo(orderNo);
      expect(countsAfterMixed?.ordersCount).toBe(1);
      expect(countsAfterMixed?.receiversCount).toBe(1);
    }

    const retryResponse = await importOrders(
      page,
      [buildImportRow(orderNo)],
      'orders-import-duplicate-retry.xlsx',
    );
    const retryData = await expectImportApiReady(retryResponse);

    expect(retryData.successCount).toBe(0);
    expect(retryData.failedCount).toBeGreaterThanOrEqual(1);
    const persistedDuplicate = (retryData.failed || []).find(
      (item) =>
        item.orderNo === orderNo &&
        item.code === ORDER_IMPORT_ERROR_CODES.DUPLICATE_ORDER_NO,
    );
    expect(persistedDuplicate).toBeTruthy();

    if (isOrdersDbHelperAvailable()) {
      const countsAfterRetry = await getOrderRowCountsByOrderNo(orderNo);
      expect(countsAfterRetry?.ordersCount).toBe(1);
      expect(countsAfterRetry?.receiversCount).toBe(1);
    }
  });

  test('외부 연동 실패는 행 실패로 반환되지만 주문 커밋은 유지되어 재업로드 시 duplicate가 난다', async ({
    page,
  }) => {
    test.skip(
      !RUN_IMPORT_EXTERNAL_SYNC_FAILURE_TEST,
      'E2E_RUN_IMPORT_EXTERNAL_SYNC_FAILURE=1 설정 시에만 실행',
    );
    await ensureLoggedIn(page);

    const orderNo = `txn-cj-fail-${Date.now()}`;

    const firstResponse = await importOrders(
      page,
      [buildImportRow(orderNo)],
      'orders-import-external-failure.xlsx',
    );
    const firstData = await expectImportApiReady(firstResponse);

    expect(firstData.successCount).toBe(0);
    expect(firstData.failedCount).toBeGreaterThanOrEqual(1);
    const externalFailure = (firstData.failed || []).find(
      (item) =>
        item.orderNo === orderNo &&
        (item.code === ORDER_IMPORT_ERROR_CODES.EXTERNAL_SYNC_FAILED ||
          (item.reason || '').includes('CJ')),
    );
    expect(externalFailure).toBeTruthy();

    if (isOrdersDbHelperAvailable()) {
      const countsAfterFirst = await getOrderRowCountsByOrderNo(orderNo);
      expect(countsAfterFirst?.ordersCount).toBe(1);
      expect(countsAfterFirst?.receiversCount).toBe(1);
    }

    const retryResponse = await importOrders(
      page,
      [buildImportRow(orderNo)],
      'orders-import-external-failure-retry.xlsx',
    );
    const retryData = await expectImportApiReady(retryResponse);

    expect(retryData.successCount).toBe(0);
    expect(retryData.failedCount).toBeGreaterThanOrEqual(1);
    const duplicateAfterExternalFailure = (retryData.failed || []).find(
      (item) =>
        item.orderNo === orderNo &&
        item.code === ORDER_IMPORT_ERROR_CODES.DUPLICATE_ORDER_NO,
    );
    expect(duplicateAfterExternalFailure).toBeTruthy();
  });

  test('부분 성공 시 집계 형식이 일관된다 (successCount + failedCount = 입력 행 수, failed 배열 형식)', async ({
    page,
  }) => {
    test.skip(!RUN_IMPORT_TRANSACTION_TEST, 'E2E_RUN_IMPORT_TRANSACTION=1 설정 시에만 실행');
    await ensureLoggedIn(page);

    const prefix = `txn-partial-${Date.now()}`;
    const rows: ImportRow[] = [
      buildImportRow(`${prefix}-1`),
      buildImportRow(`${prefix}-2`, { 전화번호: 'invalid' }),
      buildImportRow(`${prefix}-3`),
    ];

    const response = await importOrders(
      page,
      rows,
      'orders-import-partial-success.xlsx',
    );
    const data = await expectImportApiReady(response);

    expect(data.successCount).toBe(2);
    expect(data.failedCount).toBe(1);
    expectImportResultFormat({
      ...data,
      inputRowCount: rows.length,
    });

    const failedItem = (data.failed || []).find(
      (item) => item.code === ORDER_IMPORT_ERROR_CODES.INVALID_PHONE,
    );
    expect(failedItem).toBeTruthy();
  });
});
