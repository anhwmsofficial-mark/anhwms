export type ScanMode = 'lookup' | 'inbound' | 'outbound' | 'relocation' | 'count';
export type BarcodeType = 'product' | 'location' | 'unknown';
export type ScanStatus = 'success' | 'warning' | 'error';

export interface ParsedBarcode {
  original: string;
  type: BarcodeType;
  value: string; // The cleaned value (e.g. without prefixes if needed)
}

export interface ScanResult {
  barcode: string;
  type: BarcodeType;
  status: ScanStatus;
  message: string;
  timestamp: number;
  data?: any; // The fetched product or location data
  mode: ScanMode;
}

export interface ScanQueueItem {
  id: string; // UUID
  barcode: string;
  scannedAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ScanResult;
}

export interface RecentScanItem extends ScanResult {
  id: string;
}

export interface WorkflowActionResult {
  success: boolean;
  message: string;
  data?: any;
}
