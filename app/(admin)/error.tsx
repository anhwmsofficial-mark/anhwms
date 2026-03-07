'use client';

import { useEffect } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function AdminSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminSegmentError]', error);
  }, [error]);

  const isDigest = Boolean(error.digest);

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <ExclamationTriangleIcon className="h-16 w-16 text-amber-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          페이지를 불러올 수 없습니다
        </h1>
        <p className="text-gray-600 mb-6">
          일시적인 오류가 발생했습니다. 다시 시도하거나 대시보드로 돌아가 주세요.
        </p>
        {isDigest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">
            오류 코드: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <HomeIcon className="h-4 w-4" />
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  );
}
