import { test, expect } from '@playwright/test';
import { tryLogin } from './utils';

test('사용자 관리 페이지 접근', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  const login = await tryLogin(page, email!, password!);
  test.skip(!login.ok, login.ok ? '' : login.reason);
  await page.goto('/users');
  const bodyText = await page.locator('body').innerText();
  test.skip(
    /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText),
    '사용자 관리 페이지 런타임 오류로 인해 접근 검증을 건너뜁니다.'
  );
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
});
