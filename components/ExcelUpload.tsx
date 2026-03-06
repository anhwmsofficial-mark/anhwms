'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { showError } from '@/lib/toast';
import { parseExcelInWorker } from '@/lib/workers/useExcelParser';

interface InboundExcelRow {
  product_sku: string;
  product_name: string;
  product_category: string;
  product_barcode: string;
  product_barcode_type: string;
  expected_qty: number;
  box_count: number | string;
  pallet_text: string;
  mfg_date: string;
  expiry_date: string;
  line_notes: string;
}

interface ExcelUploadProps {
  onDataLoaded: (data: InboundExcelRow[]) => void;
}

export default function ExcelUpload({ onDataLoaded }: ExcelUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const parsedData = await parseExcelInWorker<InboundExcelRow[]>(file, 'inbound');
      onDataLoaded(parsedData);
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : '엑셀 파일 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
      const ws = XLSX.utils.aoa_to_sheet([
          ['SKU', '상품명', '카테고리', '바코드', '바코드유형(RETAIL/SET)', '박스수', '팔렛', '제조일', '유통기한', '수량(Qty)', '비고'],
          ['ABC-EAR-BK', '무선 이어폰 (Black)', 'Electronics', '880000000001', 'RETAIL', '20', '5plt', '2025-01-01', '2026-01-01', '100', '예시 데이터입니다. 삭제 후 입력하세요.']
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'inbound_template.xlsx');
  };

  return (
    <div className="flex gap-2 items-center">
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button 
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 flex items-center gap-2 text-sm font-medium"
      >
        {loading ? '처리 중...' : '📥 엑셀 업로드'}
      </button>
      <button 
        type="button"
        onClick={handleDownloadTemplate}
        className="text-gray-500 text-xs underline hover:text-gray-700"
      >
        양식 다운로드
      </button>
    </div>
  );
}
