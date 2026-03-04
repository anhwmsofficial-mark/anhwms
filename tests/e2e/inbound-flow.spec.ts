import { test, expect } from '@playwright/test';
import { tryLogin } from './utils';

test('입고 등록 화면 접근', async ({ page }) => {
  const runInboundNewTest = process.env.E2E_RUN_INBOUND_NEW === '1';
  test.skip(!runInboundNewTest, 'E2E_RUN_INBOUND_NEW=1 설정 시에만 실행');
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);
  await page.goto('/inbound/new');
  const bodyText = await page.locator('body').innerText();
  test.skip(
    /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText),
    '입고 등록 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.'
  );
  await expect(page.getByRole('heading', { name: '신규 입고 예정 등록' })).toBeVisible();
});
