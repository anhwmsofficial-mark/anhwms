import { expect, Page } from '@playwright/test';

export async function performLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function tryLogin(page: Page, email: string, password: string) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForTimeout(1200);

    if (!/\/login(?:\?.*)?$/.test(page.url())) {
      return { ok: true as const };
    }

    const bodyText = await page.locator('body').innerText();
    if (/Invalid login credentials|로그인 실패/i.test(bodyText)) {
      return { ok: false as const, reason: 'E2E 계정 로그인 실패(아이디/비밀번호 확인 필요)' };
    }
  }

  return { ok: false as const, reason: '로그인 후 리다이렉트 실패(환경/권한 점검 필요)' };
}
