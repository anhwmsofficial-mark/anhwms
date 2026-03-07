'use client';

import { useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { InlineErrorMeta } from '@/lib/api/client';

type InlineErrorAlertProps = {
  error: InlineErrorMeta | string | null | undefined;
  className?: string;
};

function normalizeError(error: InlineErrorAlertProps['error']): InlineErrorMeta | null {
  if (!error) return null;
  if (typeof error === 'string') {
    return { message: error };
  }
  if (!error.message) return null;
  return error;
}

/**
 * 공통 인라인 에러 박스
 *
 * - message 표시, requestId 있으면 복사 버튼 노출
 * - 복사 성공 시 토스트 없이 버튼 텍스트만 "복사" → "복사됨" 2초 표시
 *
 * @example
 * ```tsx
 * const [error, setError] = useState<InlineErrorMeta | null>(null);
 * // API 실패 시
 * setError(getInlineErrorMeta(toClientApiError(res.status, payload, fallback), fallback));
 * // catch 시
 * setError(normalizeInlineError(err, '기본 메시지'));
 * // 렌더
 * <InlineErrorAlert error={error} className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3" />
 * ```
 *
 * @see docs/refactor/inline-error-ux-commonization.md
 */
export default function InlineErrorAlert({ error, className }: InlineErrorAlertProps) {
  const [copied, setCopied] = useState(false);
  const normalized = normalizeError(error);

  if (!normalized) return null;

  const handleCopy = async () => {
    if (!normalized.requestId) return;
    try {
      await navigator.clipboard.writeText(normalized.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures to keep the alert non-blocking.
    }
  };

  return (
    <div className={className || 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'}>
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div>{normalized.message}</div>
          {normalized.requestId ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-600">
              <span className="font-medium">요청 ID: {normalized.requestId}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded border border-red-200 bg-white px-2 py-0.5 hover:bg-red-100"
              >
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
