import { test, expect } from '@playwright/test';
import { performLogin } from './utils';

test('주문 관리 페이지 접근', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  await performLogin(page, email!, password!);
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { name: '주문 관리' })).toBeVisible();
});
