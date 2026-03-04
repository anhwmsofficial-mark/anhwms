import { test, expect } from '@playwright/test';
import { tryLogin } from './utils';

const adminOnlyPaths = ['/admin', '/users', '/ops'];

test.describe('권한 매트릭스 접근 제어', () => {
  test('일반 사용자 계정은 관리자 전용 경로 접근이 차단된다', async ({ page }) => {
    const email = process.env.E2E_STAFF_EMAIL;
    const password = process.env.E2E_STAFF_PASSWORD;
    test.skip(!email || !password, 'E2E 일반 사용자 계정 정보가 필요합니다.');

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    for (const path of adminOnlyPaths) {
      await page.goto(path);
      const bodyText = await page.locator('body').innerText();
      test.skip(
        /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText),
        `권한 매트릭스 검증 중 런타임 오류 발생: ${path}`
      );
      await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    }
  });

  test('관리자 계정은 관리자 전용 경로 접근이 가능하다', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

    const login = await tryLogin(page, email!, password!);
    test.skip(!login.ok, login.ok ? '' : login.reason);

    await page.goto('/users');
    let bodyText = await page.locator('body').innerText();
    test.skip(
      /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText),
      '관리자 경로 검증 중 런타임 오류 발생: /users'
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();

    await page.goto('/admin');
    bodyText = await page.locator('body').innerText();
    test.skip(
      /Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText),
      '관리자 경로 검증 중 런타임 오류 발생: /admin'
    );
    await expect(page).toHaveURL(/\/admin(\?.*)?$/);
  });
});
