import * as XLSX from 'xlsx';
import { searchProducts, type ProductSearchItem } from '@/app/actions/product';
import { createProductFromExcelItem } from '@/src/features/inbound/new/api/createProduct';
import { createLineId, type ExcelInboundRow, type InboundLine } from '@/src/features/inbound/new/form/schema';

export interface ParsedResult {
  rows: ExcelInboundRow[];
}

export interface BuildInboundLinesResult {
  createdLines: InboundLine[];
  failedSkus: string[];
}

export async function parseInboundExcel(file: File): Promise<ParsedResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          reject(new Error('데이터가 없는 엑셀 파일입니다.'));
          return;
        }

        const headers = (jsonData[0] as string[]).map((h) => (h || '').toString().trim().toLowerCase());
        const findHeaderIndex = (candidates: string[]) =>
          headers.findIndex((h) => candidates.some((c) => h.includes(c)));

        const skuIndex = findHeaderIndex(['sku', '상품코드']);
        const qtyIndex = findHeaderIndex(['수량', 'qty']);
        const nameIndex = findHeaderIndex(['상품명', 'name']);
        const categoryIndex = findHeaderIndex(['카테고리', 'category']);
        const barcodeIndex = findHeaderIndex(['바코드', 'barcode']);
        const boxCountIndex = findHeaderIndex(['박스', 'box', 'box_count']);
        const palletIndex = findHeaderIndex(['팔렛', 'pallet']);
        const mfgIndex = findHeaderIndex(['제조일', 'mfg', 'manufacture']);
        const expiryIndex = findHeaderIndex(['유통기한', '유통일', 'expiry', 'exp']);
        const noteIndex = findHeaderIndex(['비고', 'note', 'notes']);

        if (skuIndex === -1 || qtyIndex === -1) {
          reject(new Error('필수 컬럼(SKU, 수량)을 찾을 수 없습니다. 엑셀 양식을 확인해주세요.'));
          return;
        }

        const parsedData = jsonData
          .slice(1)
          .map((row) => {
            const rowData = row as (string | number)[];
            return {
              product_sku: String(rowData[skuIndex] || ''),
              product_name: nameIndex !== -1 ? String(rowData[nameIndex] || '') : '',
              product_category: categoryIndex !== -1 ? String(rowData[categoryIndex] || '') : '',
              product_barcode: barcodeIndex !== -1 ? String(rowData[barcodeIndex] || '') : '',
              expected_qty: parseInt(String(rowData[qtyIndex] || '0')) || 0,
              box_count: boxCountIndex !== -1 ? parseInt(String(rowData[boxCountIndex] || '0')) || '' : '',
              pallet_text: palletIndex !== -1 ? String(rowData[palletIndex] || '') : '',
              mfg_date: mfgIndex !== -1 ? String(rowData[mfgIndex] || '') : '',
              expiry_date: expiryIndex !== -1 ? String(rowData[expiryIndex] || '') : '',
              line_notes: noteIndex !== -1 ? String(rowData[noteIndex] || '') : '',
            };
          })
          .filter((item): item is ExcelInboundRow => !!item.product_sku && item.expected_qty > 0);

        resolve({ rows: parsedData });
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function normalizeExcelInboundRows(data: ExcelInboundRow[]): ExcelInboundRow[] {
  return data
    .map((item) => ({
      product_sku: (item.product_sku || '').toString().trim(),
      product_name: (item.product_name || '').toString().trim(),
      product_category: (item.product_category || '').toString().trim(),
      product_barcode: (item.product_barcode || '').toString().trim(),
      expected_qty: Number(item.expected_qty || 0),
      box_count: item.box_count ?? '',
      pallet_text: item.pallet_text ?? '',
      mfg_date: item.mfg_date ?? '',
      expiry_date: item.expiry_date ?? '',
      line_notes: item.line_notes ?? '',
    }))
    .filter((item) => item.product_sku && item.expected_qty > 0);
}

export async function buildInboundLinesFromExcelRows(
  data: ExcelInboundRow[],
  selectedClientId: string
): Promise<BuildInboundLinesResult> {
  const normalized = normalizeExcelInboundRows(data);

  const mergedBySku = normalized.reduce<Record<string, ExcelInboundRow>>((acc, cur) => {
    if (!acc[cur.product_sku]) {
      acc[cur.product_sku] = { ...cur };
    } else {
      acc[cur.product_sku].expected_qty += cur.expected_qty;
    }
    return acc;
  }, {});

  const mergedItems = Object.values(mergedBySku);

  const createdLines: InboundLine[] = [];
  const failedSkus: string[] = [];

  for (const item of mergedItems) {
    let matchedProduct: ProductSearchItem | null = null;
    try {
      const results = await searchProducts(item.product_sku, selectedClientId);
      matchedProduct = results?.find((p) => p.sku === item.product_sku) || null;

      if (!matchedProduct && item.product_barcode) {
        const barcodeResults = await searchProducts(item.product_barcode, selectedClientId);
        matchedProduct = barcodeResults?.[0] || null;
      }

      if (!matchedProduct) {
        matchedProduct = await createProductFromExcelItem(item, selectedClientId);
      }

      createdLines.push({
        id: createLineId(),
        product_id: matchedProduct.id,
        product_name: matchedProduct.name || item.product_name || item.product_sku,
        product_sku: matchedProduct.sku || item.product_sku,
        barcode_primary: matchedProduct.barcode || item.product_barcode || '',
        barcode_type_primary: matchedProduct.barcode ? 'RETAIL' : '',
        expected_qty: item.expected_qty,
        box_count: item.box_count,
        pallet_text: item.pallet_text,
        mfg_date: item.mfg_date,
        expiry_date: item.expiry_date,
        line_notes: item.line_notes,
        notes: '',
        barcodes: matchedProduct.barcodes || [],
      });
    } catch (e) {
      console.error(e);
      failedSkus.push(item.product_sku);
    }
  }

  return { createdLines, failedSkus };
}
