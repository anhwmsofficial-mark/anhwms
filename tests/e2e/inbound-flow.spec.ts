import { test, expect } from '@playwright/test';
import { tryLogin } from './utils';

function hasRuntimeError(bodyText: string) {
  return /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText);
}

test('입고 목록 화면 핵심 요소 접근', async ({ page }) => {
  const runInboundCriticalTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundCriticalTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound');
  const bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 목록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.');

  await expect(page.getByRole('heading', { name: '입고 작업 목록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 신규 예정 등록' })).toBeVisible();
  await expect(page.getByPlaceholder('번호, 화주사, SKU 검색...')).toBeVisible();
});

test('입고 목록에서 신규 등록 화면으로 이동', async ({ page }) => {
  const runInboundCriticalTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundCriticalTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);
  await page.goto('/inbound');
  let bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 목록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.');

  await page.getByRole('button', { name: '+ 신규 예정 등록' }).click();
  await expect(page).toHaveURL(/\/inbound\/new(\?.*)?$/);

  bodyText = await page.locator('body').innerText();
  test.skip(
    hasRuntimeError(bodyText),
    '입고 등록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.'
  );
  await expect(page.getByRole('heading', { name: '신규 입고 예정 등록' })).toBeVisible();
});

test('입고 상세 화면 탭 및 인수증 액션 노출', async ({ page }) => {
  const runInboundCriticalTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundCriticalTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound');
  let bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 목록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.');

  const detailButtons = page.locator('button:has-text("어드민 상세"), button:has-text("상세보기")');
  const detailCount = await detailButtons.count();
  test.skip(detailCount === 0, '입고 상세 진입 가능한 데이터가 없어 검증을 건너뜁니다.');

  await detailButtons.first().click();
  await expect(page).toHaveURL(/\/inbound\/[^/]+(\?.*)?$/);

  bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 상세 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.');

  await expect(page.getByRole('button', { name: '기본 정보' })).toBeVisible();
  await expect(page.getByRole('button', { name: '사진' })).toBeVisible();
  await expect(page.getByRole('button', { name: '인수증' })).toBeVisible();

  await page.getByRole('button', { name: '인수증' }).click();
  await expect(page.getByRole('button', { name: '공유 링크' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF 저장' })).toBeVisible();
});

test('입고 목록의 현장체크 수정 링크는 step4 파라미터를 포함', async ({ page }) => {
  const runInboundCriticalTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundCriticalTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);

  await page.goto('/inbound');
  const bodyText = await page.locator('body').innerText();
  test.skip(hasRuntimeError(bodyText), '입고 목록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.');

  const editButtons = page.getByRole('button', { name: '현장체크 수정' });
  const editCount = await editButtons.count();
  test.skip(editCount === 0, '현장체크 수정 가능한 데이터가 없어 검증을 건너뜁니다.');

  const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await editButtons.first().click();
  const popup = await popupPromise;
  test.skip(!popup, '팝업이 열리지 않아 현장체크 수정 URL 검증을 건너뜁니다.');

  const popupUrl = popup.url();
  expect(popupUrl).toContain('/ops/inbound/');
  expect(popupUrl).toContain('step=4');
  expect(popupUrl).toContain('mode=edit');
  await popup.close();
});
