import { test, expect } from '@playwright/test';

const protectedPagePaths = ['/users', '/admin', '/operations/field-check', '/ops'];

for (const targetPath of protectedPagePaths) {
  test(`비로그인 사용자는 ${targetPath} 접근 시 로그인으로 리다이렉트`, async ({ page }) => {
    await page.goto(targetPath);
    await expect(page).toHaveURL(new RegExp(`\\/login(\\?.*)?$`));

    const current = new URL(page.url());
    const next = current.searchParams.get('next');
    expect(next).toBeTruthy();
    expect(next).toContain(targetPath);
  });
}

test('비로그인 사용자는 admin API 접근 시 401', async ({ request }) => {
  const response = await request.get('/api/admin/admin-users');
  expect(response.status()).toBe(401);
});
