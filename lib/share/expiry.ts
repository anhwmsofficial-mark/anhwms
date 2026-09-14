export const DEFAULT_SHARE_EXPIRY_DAYS = 7;
export const SHORT_SHARE_MAX_DAYS = 30;
export const MAX_INBOUND_SHARE_EXPIRY_DAYS = 365;

export function addCalendarDays(days: number, from = new Date()) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function maxAllowedExpiry(now: number, maxDays: number) {
  return endOfDay(addCalendarDays(maxDays, new Date(now))).getTime();
}

export function isLongLivedExpiry(expiresAt?: string | null, now = Date.now()) {
  if (!expiresAt) return true;
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  return parsed > maxAllowedExpiry(now, SHORT_SHARE_MAX_DAYS);
}

export function resolveInboundShareExpiresAt(value?: string | null, now = Date.now()) {
  const raw = String(value || '').trim();
  const maxExpiresAt = maxAllowedExpiry(now, MAX_INBOUND_SHARE_EXPIRY_DAYS);

  if (!raw) {
    return addCalendarDays(DEFAULT_SHARE_EXPIRY_DAYS, new Date(now)).toISOString();
  }

  const parsed = new Date(raw).getTime();
  if (!Number.isFinite(parsed)) {
    throw new Error('expires_at 형식이 올바르지 않습니다.');
  }
  if (parsed <= now) {
    throw new Error('expires_at은 현재 시각 이후여야 합니다.');
  }
  if (parsed > maxExpiresAt) {
    throw new Error(`공유 링크 만료일은 최대 ${MAX_INBOUND_SHARE_EXPIRY_DAYS}일 이내여야 합니다.`);
  }

  return new Date(parsed).toISOString();
}

export function longLivedPasswordRequired(
  expiresAt?: string | null,
  hasPassword = false,
  now = Date.now(),
) {
  return isLongLivedExpiry(expiresAt, now) && !hasPassword;
}

export function shareExtendLabel(days: number) {
  if (days >= MAX_INBOUND_SHARE_EXPIRY_DAYS) return '12개월 연장';
  return `${days}일 연장`;
}
