import type { ProductBarcodeItem } from '@/app/actions/product';

export interface ClientOption {
  id: string;
  name: string;
}

export interface WarehouseOption {
  id: string;
  name: string;
}

export interface ManagerOption {
  id: string;
  name: string;
}

export interface ExcelInboundRow {
  product_sku: string;
  product_name: string;
  product_category: string;
  product_barcode: string;
  expected_qty: number;
  box_count: number | string;
  pallet_text: string;
  mfg_date: string;
  expiry_date: string;
  line_notes: string;
}

export interface InboundLine {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  barcode_primary: string;
  barcode_type_primary: string;
  barcodes: ProductBarcodeItem[];
  box_count: number | string;
  pallet_text: string;
  expected_qty: number;
  mfg_date: string;
  expiry_date: string;
  line_notes: string;
  notes: string;
}

export const createLineId = () => `${Date.now()}-${Math.random()}`;

export function createEmptyLine(): InboundLine {
  return {
    id: createLineId(),
    product_id: '',
    product_name: '',
    product_sku: '',
    barcode_primary: '',
    barcode_type_primary: '',
    barcodes: [],
    box_count: '',
    pallet_text: '',
    expected_qty: 0,
    mfg_date: '',
    expiry_date: '',
    line_notes: '',
    notes: '',
  };
}
