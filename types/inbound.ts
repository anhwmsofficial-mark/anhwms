export type InboundPlanStatus = 'DRAFT' | 'SUBMITTED' | 'NOTIFIED' | 'CLOSED' | 'CANCELLED';

export interface InboundPlan {
  id: string;
  org_id: string;
  warehouse_id: string;
  client_id: string;
  plan_no: string;
  planned_date: string;
  status: InboundPlanStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InboundPlanLine {
  id: string;
  org_id: string;
  plan_id: string;
  product_id: string;
  expected_qty: number;
  uom: string;
  lot_no?: string;
  box_count?: number;
  pallet_text?: string;
  mfg_date?: string;
  expiry_date?: string;
  line_notes?: string;
  notes?: string;
  created_at: string;
}

export type InboundReceiptStatus = 'ARRIVED' | 'PHOTO_REQUIRED' | 'COUNTING' | 'INSPECTING' | 'DISCREPANCY' | 'CONFIRMED' | 'PUTAWAY_READY' | 'CANCELLED';

export interface InboundReceipt {
  id: string;
  org_id: string;
  warehouse_id: string;
  client_id: string;
  plan_id?: string;
  receipt_no: string;
  arrived_at?: string;
  status: InboundReceiptStatus;
  dock_name?: string;
  carrier_name?: string;
  tracking_no?: string;
  total_box_count?: number;
  notes?: string;
  created_by?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InboundReceiptLine {
  id: string;
  org_id: string;
  receipt_id: string;
  plan_line_id?: string;
  product_id: string;
  expected_qty: number;
  received_qty: number;
  accepted_qty: number;
  damaged_qty: number;
  missing_qty: number;
  over_qty: number;
  discrepancy_reason?: string;
  lot_no?: string;
  expiry_date?: string;
  inspected_by?: string;
  inspected_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PhotoGuideSlot {
  id: string;
  org_id: string;
  receipt_id: string;
  slot_key: string;
  title: string;
  is_required: boolean;
  min_photos: number;
  sort_order: number;
  created_at: string;
}

export interface InboundPhoto {
  id: string;
  org_id: string;
  receipt_id: string;
  slot_id?: string;
  line_id?: string;
  storage_bucket: string;
  storage_path: string;
  mime_type?: string;
  width?: number;
  height?: number;
  file_size?: number;
  taken_at?: string;
  uploaded_by?: string;
  uploaded_at: string;
  is_deleted: boolean;
}
