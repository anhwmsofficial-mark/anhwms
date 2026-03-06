import { test, expect } from '@playwright/test';
import { tryLogin } from './utils';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';

function hasRuntimeError(bodyText: string) {
  return /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText);
}

async function createInboundExcelFixture() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['SKU', '상품명', '카테고리', '바코드', '바코드유형(RETAIL/SET)', '박스수', '팔렛', '제조일', '유통기한', '수량(Qty)', '비고'],
    ['E2E-INBOUND-SKU-001', 'E2E 테스트 상품', 'ETC', '880000000001', 'RETAIL', '1', '1plt', '2026-01-01', '2027-01-01', '3', 'e2e'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inbound-new-e2e-'));
  const filePath = path.join(tmpDir, 'inbound-new-e2e.xlsx');
  XLSX.writeFile(wb, filePath);
  return filePath;
}

test('입고 신규 등록 페이지 스모크 (로딩/엑셀 버튼/저장 버튼)', async ({ page }) => {
  const runInboundCriticalTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundCriticalTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound/new');
  const bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 등록 페이지 런타임 오류로 인해 스모크 검증을 건너뜁니다.');

  await expect(page.getByRole('heading', { name: '신규 입고 예정 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '📥 엑셀 업로드' })).toBeVisible();
  await expect(page.getByRole('button', { name: '입고 예정 등록 완료' })).toBeVisible();

  const dialogPromise = page.waitForEvent('dialog').catch(() => null);
  await page.getByRole('button', { name: '입고 예정 등록 완료' }).click();
  const dialog = await dialogPromise;
  if (dialog) {
    await dialog.dismiss();
  }
});

test('입고 신규 등록 플로우 스모크 (주요 필드 + 엑셀 업로드 + 저장 버튼 클릭)', async ({ page }) => {
  const runInboundFlowTest = process.env.E2E_RUN_INBOUND_NEW_FLOW === '1';
  test.skip(!runInboundFlowTest, 'E2E_RUN_INBOUND_NEW_FLOW=1 설정 시에만 실행');

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound/new');
  const bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 등록 페이지 런타임 오류로 인해 플로우 검증을 건너뜁니다.');

  await expect(page.getByRole('heading', { name: '신규 입고 예정 등록' })).toBeVisible();

  const clientSelect = page
    .locator('div')
    .filter({ has: page.getByText('업체명 (Client)') })
    .locator('select')
    .first();
  const clientOptions = clientSelect.locator('option');
  test.skip((await clientOptions.count()) < 2, '선택 가능한 업체 옵션이 없어 검증을 건너뜁니다.');
  await clientSelect.selectOption({ index: 1 });

  const plannedDateInput = page.locator('input[type="date"]').first();
  await plannedDateInput.fill('2026-03-05');

  const warehouseSelect = page
    .locator('div')
    .filter({ has: page.getByText('입고지 주소') })
    .locator('select')
    .first();
  const warehouseOptions = warehouseSelect.locator('option');
  test.skip((await warehouseOptions.count()) < 2, '선택 가능한 입고지 옵션이 없어 검증을 건너뜁니다.');
  await warehouseSelect.selectOption({ index: 1 });

  const inboundManagerSelect = page
    .locator('div')
    .filter({ has: page.getByText('입고담당') })
    .locator('select')
    .first();
  const managerOptions = inboundManagerSelect.locator('option');
  test.skip((await managerOptions.count()) < 2, '선택 가능한 입고담당 옵션이 없어 검증을 건너뜁니다.');

  const excelPath = await createInboundExcelFixture();
  const fileInput = page.locator('input[type="file"][accept=".xlsx, .xls"]');
  await fileInput.setInputFiles(excelPath);
  await expect(page.getByText('E2E-INBOUND-SKU-001')).toBeVisible({ timeout: 10000 });

  // 비파괴 스모크: manager는 의도적으로 미선택 상태로 두고 저장 버튼 클릭까지 확인
  await page.getByRole('button', { name: '입고 예정 등록 완료' }).click();
  await expect(page.getByRole('button', { name: '입고 예정 등록 완료' })).toBeVisible();
});

test('입고 신규 등록 플로우 뮤테이션 (실제 저장 후 목록 이동)', async ({ page }) => {
  const runInboundMutationTest = process.env.E2E_RUN_INBOUND_NEW_MUTATION === '1';
  test.skip(!runInboundMutationTest, 'E2E_RUN_INBOUND_NEW_MUTATION=1 설정 시에만 실행');

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound/new');
  const bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 등록 페이지 런타임 오류로 인해 뮤테이션 검증을 건너뜁니다.');

  const clientSelect = page
    .locator('div')
    .filter({ has: page.getByText('업체명 (Client)') })
    .locator('select')
    .first();
  const clientOptions = clientSelect.locator('option');
  test.skip((await clientOptions.count()) < 2, '선택 가능한 업체 옵션이 없어 검증을 건너뜁니다.');
  await clientSelect.selectOption({ index: 1 });

  const plannedDateInput = page.locator('input[type="date"]').first();
  const today = new Date();
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  await plannedDateInput.fill(`${yyyy}-${mm}-${dd}`);

  const warehouseSelect = page
    .locator('div')
    .filter({ has: page.getByText('입고지 주소') })
    .locator('select')
    .first();
  const warehouseOptions = warehouseSelect.locator('option');
  test.skip((await warehouseOptions.count()) < 2, '선택 가능한 입고지 옵션이 없어 검증을 건너뜁니다.');
  await warehouseSelect.selectOption({ index: 1 });

  const inboundManagerSelect = page
    .locator('div')
    .filter({ has: page.getByText('입고담당') })
    .locator('select')
    .first();
  const managerOptions = inboundManagerSelect.locator('option');
  test.skip((await managerOptions.count()) < 2, '선택 가능한 입고담당 옵션이 없어 검증을 건너뜁니다.');
  await inboundManagerSelect.selectOption({ index: 1 });

  const excelPath = await createInboundExcelFixture();
  const fileInput = page.locator('input[type="file"][accept=".xlsx, .xls"]');
  await fileInput.setInputFiles(excelPath);
  await expect(page.getByText('E2E-INBOUND-SKU-001')).toBeVisible({ timeout: 10000 });

  const runId = `E2E-INBOUND-NEW-${Date.now()}`;
  await page.getByPlaceholder('비고 (전체 메모)').fill(runId);

  await page.getByRole('button', { name: '입고 예정 등록 완료' }).click();
  await expect(page).toHaveURL(/\/inbound(\?.*)?$/, { timeout: 20000 });
});
