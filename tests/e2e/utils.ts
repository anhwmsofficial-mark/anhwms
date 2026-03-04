import { expect, Page } from '@playwright/test';

async function resolveLoginFields(page: Page) {
  const emailInput = page.locator('#email, input[name="email"], input[type="email"]').first();
  const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
  const emailCount = await emailInput.count();
  const passwordCount = await passwordInput.count();
  return { emailInput, passwordInput, ready: emailCount > 0 && passwordCount > 0 };
}

export async function performLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  const fields = await resolveLoginFields(page);
  if (!fields.ready) {
    throw new Error('로그인 입력 필드를 찾지 못했습니다.');
  }
  await fields.emailInput.fill(email);
  await fields.passwordInput.fill(password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function tryLogin(page: Page, email: string, password: string) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/login');
    const fields = await resolveLoginFields(page);
    if (!fields.ready) {
      const bodyText = await page.locator('body').innerText();
      if (/Application error: a client-side exception has occurred|Internal Server Error/i.test(bodyText)) {
        return { ok: false as const, reason: '로그인 페이지 런타임 오류(환경 상태 점검 필요)' };
      }
      return { ok: false as const, reason: '로그인 입력 필드 미노출(환경/빌드 상태 점검 필요)' };
    }
    await fields.emailInput.fill(email);
    await fields.passwordInput.fill(password);
    const submit = page.getByRole('button', { name: '로그인' });
    const disabled = await submit.isDisabled();
    if (disabled) {
      return { ok: false as const, reason: '로그인 버튼 비활성 상태(환경변수/인증 설정 점검 필요)' };
    }
    await submit.click();
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
