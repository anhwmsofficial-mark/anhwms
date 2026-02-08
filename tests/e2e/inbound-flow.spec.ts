import { test, expect } from '@playwright/test';
import { performLogin } from './utils';

test('입고 등록 화면 접근', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, 'E2E 관리자 계정 정보가 필요합니다.');

  await performLogin(page, email!, password!);
  await page.goto('/inbound/new');
  await expect(page.getByPlaceholder('상품명/SKU 입력...')).toBeVisible();
});
