const INTEGER_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
});

const AMOUNT_FORMATTER = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeNumericString(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export function formatInteger(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return INTEGER_FORMATTER.format(Math.trunc(safe));
}

export function formatAmount(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return AMOUNT_FORMATTER.format(roundToTwo(safe));
}

export function formatCurrency(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return KRW_FORMATTER.format(safe);
}

export function parseIntegerInput(raw: unknown): number | null {
  const value = normalizeNumericString(raw);
  if (!value) return null;
  const digitsOnly = value.replace(/[^0-9-]/g, '');
  if (!digitsOnly || digitsOnly === '-') return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

export function parseAmountInput(raw: unknown): number | null {
  const value = normalizeNumericString(raw);
  if (!value) return null;
  const normalized = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, roundToTwo(parsed));
}

export function sanitizeNumericPayload<T extends Record<string, unknown>>(
  payload: T,
  integerKeys: string[] = [],
  amountKeys: string[] = [],
): T {
  const next: Record<string, unknown> = { ...payload };

  for (const key of integerKeys) {
    if (!(key in next)) continue;
    next[key] = parseIntegerInput(next[key]);
  }
  for (const key of amountKeys) {
    if (!(key in next)) continue;
    next[key] = parseAmountInput(next[key]);
  }

  return next as T;
}
