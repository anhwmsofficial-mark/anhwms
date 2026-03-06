'use client';

import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ProductCategory } from '@/types';
import { CustomerOption } from '@/lib/api/partners';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseExcelInWorker } from '@/lib/workers/useExcelParser';
import { parseApiError } from '@/lib/api/parseApiError';

type ParsedRow = {
  rowNo: number;
  name: string;
  category: string;
  barcode?: string;
  sku?: string;
  manageName?: string;
  userCode?: string;
  unit?: string;
  minStock?: number;
  price?: number;
  costPrice?: number;
  location?: string;
  description?: string;
  manufactureDate?: string;
  expiryDate?: string;
  optionSize?: string;
  optionColor?: string;
  optionLot?: string;
  optionEtc?: string;
};

interface ProductBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  categories: ProductCategory[];
  onSuccess: (result: { successCount: number; failCount: number }) => void;
}

export default function ProductBulkUploadModal({
  isOpen,
  onClose,
  customers,
  categories,
  onSuccess,
}: ProductBulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    failCount: number;
    failedRows: Array<{ rowNo: number; reason: string }>;
  } | null>(null);

  const categorySet = useMemo(
    () =>
      new Set(
        categories.flatMap((category) => [
          String(category.nameKo || '').toLowerCase(),
          String(category.nameEn || '').toLowerCase(),
          String(category.code || '').toLowerCase(),
        ])
      ),
    [categories]
  );

  const resetState = () => {
    setRows([]);
    setParseError('');
    setUploadResult(null);
    setIsParsing(false);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTemplateDownload = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        '제품명',
        '카테고리',
        '바코드',
        'SKU',
        '관리명',
        '사용자코드',
        '단위',
        '최소재고',
        '판매가',
        '원가',
        '보관위치',
        '설명',
        '제조일',
        '유통기한',
        '옵션-사이즈',
        '옵션-색상',
        '옵션-롯트번호',
        '옵션-기타',
      ],
      [
        '무선 마우스',
        '전자',
        '8800000000001',
        '',
        '마우스-블랙',
        'MOUSE-BLK',
        'EA',
        10,
        25000,
        15000,
        'A-1-01',
        '샘플 데이터입니다. 삭제 후 사용하세요.',
        '2026-02-10',
        '2027-02-10',
        'M',
        'Black',
        'LOT-001',
        '',
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'inventory_product_bulk_template.xlsx');
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setParseError('');
    setUploadResult(null);
    try {
      const parsedRows = await parseExcelInWorker<ParsedRow[]>(file, 'product');
      setRows(parsedRows);
    } catch (error) {
      console.error(error);
      setParseError(error instanceof Error ? error.message : '엑셀 파일 파싱 중 오류가 발생했습니다.');
      setRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void parseFile(file);
  };

  const invalidRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!row.name || !row.category) return true;
        if (!categorySet.has(row.category.toLowerCase())) return true;
        return false;
      }),
    [rows, categorySet]
  );

  const canUpload = rows.length > 0 && invalidRows.length === 0 && selectedCustomerId && !isUploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    try {
      setIsUploading(true);
      setUploadResult(null);

      const response = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          items: rows,
        }),
      });

      if (!response.ok) {
        const { error } = await parseApiError(response, '대량 등록에 실패했습니다.');
        throw new Error(error);
      }
      const payload = await response.json();

      const result = {
        successCount: payload?.data?.successCount || 0,
        failCount: payload?.data?.failCount || 0,
        failedRows: payload?.data?.failedRows || [],
      };
      setUploadResult(result);
      onSuccess({ successCount: result.successCount, failCount: result.failCount });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '대량 등록 실패';
      setUploadResult({
        successCount: 0,
        failCount: rows.length,
        failedRows: [{ rowNo: 0, reason: message }],
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl p-6">
        <DialogHeader>
          <DialogTitle>엑셀 대량 제품 등록</DialogTitle>
          <DialogDescription>카테고리/제품정보를 검증 후 일괄 등록합니다.</DialogDescription>
        </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <select
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
                >
                  <option value="">고객사 선택 (필수)</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                >
                  {isParsing ? '엑셀 파싱 중...' : '엑셀 파일 선택'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTemplateDownload}
                >
                  양식 다운로드
                </Button>
              </div>

              {parseError && <p className="mb-3 text-sm text-red-600">{parseError}</p>}

              {rows.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">
                      총 <span className="font-semibold text-gray-900">{rows.length}</span>건 파싱됨
                    </p>
                    {invalidRows.length > 0 && (
                      <p className="text-sm text-red-600">
                        유효성 오류 <span className="font-semibold">{invalidRows.length}</span>건
                      </p>
                    )}
                  </div>
                  <div className="max-h-72 overflow-auto border rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">행</th>
                          <th className="px-3 py-2 text-left">제품명</th>
                          <th className="px-3 py-2 text-left">카테고리</th>
                          <th className="px-3 py-2 text-left">바코드</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.slice(0, 50).map((row) => {
                          const invalid =
                            !row.name || !row.category || !categorySet.has(row.category.toLowerCase());
                          return (
                            <tr key={`${row.rowNo}-${row.name}`} className={invalid ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">{row.rowNo}</td>
                              <td className="px-3 py-2">{row.name || '-'}</td>
                              <td className="px-3 py-2">{row.category || '-'}</td>
                              <td className="px-3 py-2">{row.barcode || '-'}</td>
                              <td className="px-3 py-2">{row.sku || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    카테고리는 등록된 카테고리의 코드/국문명/영문명 중 하나와 일치해야 합니다.
                  </p>
                </div>
              )}

              {uploadResult && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p>
                    등록 성공: <span className="font-semibold text-green-700">{uploadResult.successCount}</span>건 /
                    실패: <span className="font-semibold text-red-700">{uploadResult.failCount}</span>건
                  </p>
                  {uploadResult.failedRows.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-auto text-xs text-red-700">
                      {uploadResult.failedRows.slice(0, 20).map((item, index) => (
                        <p key={`${item.rowNo}-${index}`}>
                          {item.rowNo > 0 ? `${item.rowNo}행` : '시스템'}: {item.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
                <h4 className="font-semibold text-blue-900 mb-3">엑셀 등록 가이드</h4>
                <div className="space-y-2 text-blue-900/90">
                  <p>1) 고객사를 먼저 선택하세요.</p>
                  <p>2) 양식 다운로드 후 첫 시트에 데이터를 입력하세요.</p>
                  <p>3) 필수 컬럼은 `제품명`, `카테고리` 입니다.</p>
                  <p>4) `SKU`, `바코드`가 비어있으면 자동 생성됩니다.</p>
                  <p>5) 제품DB번호는 업로드 시 서버에서 자동 생성됩니다.</p>
                </div>
                <div className="mt-4 rounded-lg bg-white border border-blue-100 p-3">
                  <p className="font-medium text-gray-900 mb-1">카테고리 입력 규칙</p>
                  <p className="text-xs text-gray-600">
                    카테고리 코드는 `code`, `nameKo`, `nameEn` 중 하나로 입력 가능합니다.
                  </p>
                </div>
                <div className="mt-3 rounded-lg bg-white border border-blue-100 p-3">
                  <p className="font-medium text-gray-900 mb-1">권장 업로드 단위</p>
                  <p className="text-xs text-gray-600">
                    한 번에 100~300건 권장 / 최대 1000건까지 업로드 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              닫기
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {isUploading ? '대량 등록 중...' : '대량 등록 실행'}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
