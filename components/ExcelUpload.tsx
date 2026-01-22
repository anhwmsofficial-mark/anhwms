'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ExcelUploadProps {
  onDataLoaded: (data: any[]) => void;
}

export default function ExcelUpload({ onDataLoaded }: ExcelUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 첫 번째 시트 사용
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // JSON으로 변환 (헤더 포함)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 헤더 검증 및 데이터 매핑
        if (jsonData.length < 2) {
            alert('데이터가 없는 엑셀 파일입니다.');
            return;
        }

        const headers = (jsonData[0] as string[]).map((h) => (h || '').toString().trim().toLowerCase());

        const findHeaderIndex = (candidates: string[]) =>
          headers.findIndex((h) => candidates.some((c) => h.includes(c)));

        // 필수 컬럼 체크: SKU, 수량
        const skuIndex = findHeaderIndex(['sku', '상품코드']);
        const qtyIndex = findHeaderIndex(['수량', 'qty']);
        const nameIndex = findHeaderIndex(['상품명', 'name']);
        const categoryIndex = findHeaderIndex(['카테고리', 'category']);
        const barcodeIndex = findHeaderIndex(['바코드', 'barcode']);
        const barcodeTypeIndex = findHeaderIndex(['바코드유형', 'barcode_type', 'barcode type']);
        const boxCountIndex = findHeaderIndex(['박스', 'box', 'box_count']);
        const palletIndex = findHeaderIndex(['팔렛', 'pallet']);
        const mfgIndex = findHeaderIndex(['제조일', 'mfg', 'manufacture']);
        const expiryIndex = findHeaderIndex(['유통기한', '유통일', 'expiry', 'exp']);
        const noteIndex = findHeaderIndex(['비고', 'note', 'notes']);

        if (skuIndex === -1 || qtyIndex === -1) {
            alert('필수 컬럼(SKU, 수량)을 찾을 수 없습니다. 엑셀 양식을 확인해주세요.');
            return;
        }

        const parsedData = jsonData.slice(1).map((row: any) => ({
            product_sku: row[skuIndex],
            product_name: nameIndex !== -1 ? row[nameIndex] : '',
            product_category: categoryIndex !== -1 ? row[categoryIndex] : '',
            product_barcode: barcodeIndex !== -1 ? row[barcodeIndex] : '',
            product_barcode_type: barcodeTypeIndex !== -1 ? row[barcodeTypeIndex] : '',
            expected_qty: parseInt(row[qtyIndex]) || 0,
            box_count: boxCountIndex !== -1 ? parseInt(row[boxCountIndex]) || '' : '',
            pallet_text: palletIndex !== -1 ? row[palletIndex] : '',
            mfg_date: mfgIndex !== -1 ? row[mfgIndex] : '',
            expiry_date: expiryIndex !== -1 ? row[expiryIndex] : '',
            line_notes: noteIndex !== -1 ? row[noteIndex] : ''
        })).filter(item => item.product_sku && item.expected_qty > 0);

        onDataLoaded(parsedData);
      } catch (error) {
        console.error(error);
        alert('엑셀 파일 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
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
