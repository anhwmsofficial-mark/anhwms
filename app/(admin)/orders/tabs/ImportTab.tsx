'use client';

import { useState, useRef } from 'react';
import {
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function ImportTab() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '업로드 실패');
      }

      setResult(data);
    } catch (error: any) {
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2">
          📋 엑셀 업로드 가이드
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 엑셀 파일의 첫 번째 시트만 읽습니다</li>
          <li>
            • 필수 열: <strong>订单号/주문번호</strong>,{' '}
            <strong>收件人姓名/수취인</strong>,{' '}
            <strong>收件人电话/전화번호</strong>,{' '}
            <strong>收件地址/주소</strong>
          </li>
          <li>• 선택 열: 收件人邮编/우편번호, 商品名称/상품명, 备注/비고</li>
          <li>• 중국어 주소는 자동으로 중문 파싱됩니다</li>
          <li>• CJ 배송사로 배정된 주문은 자동으로 송장 생성됩니다</li>
        </ul>
      </div>

      {/* 업로드 영역 */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col items-center justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`
              flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer
              transition-colors
              ${
                uploading
                  ? 'bg-gray-100 border-gray-300'
                  : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }
            `}
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600">업로드 중...</p>
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  클릭하여 파일 선택
                </p>
                <p className="text-sm text-gray-500">
                  Excel (.xlsx, .xls) 또는 CSV 파일
                </p>
              </>
            )}
          </label>
        </div>

        {/* 결과 표시 */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* 성공/실패 요약 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-green-600 font-medium">
                      성공
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {result.successCount}건
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <ExclamationCircleIcon className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="text-sm text-red-600 font-medium">실패</p>
                    <p className="text-2xl font-bold text-red-900">
                      {result.failedCount}건
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 실패 목록 */}
            {result.failed && result.failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-900 mb-2">실패 내역</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.failed.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="text-sm text-red-800 flex items-start gap-2"
                    >
                      <span className="font-mono bg-red-200 px-2 py-0.5 rounded">
                        {item.orderNo}
                      </span>
                      <span>{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 샘플 다운로드 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DocumentArrowUpIcon className="h-5 w-5 text-blue-600" />
          샘플 템플릿
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          아래 형식에 맞춰 엑셀 파일을 작성하세요.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  订单号
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  收件人姓名
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  收件人电话
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  收件地址
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  收件人邮编
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                  商品名称
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  备注
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  A2025-000001
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  张三
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  +86-138-0000-1111
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  上海市 浦东新区 花木路100弄5号801室
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  200120
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  노트북 A
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  배송 전 연락
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  A2025-000002
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  김철수
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  010-2222-3333
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  서울시 강남구 테헤란로 123
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  06000
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 border-r">
                  무선 마우스
                </td>
                <td className="px-4 py-2 text-sm text-gray-700"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

