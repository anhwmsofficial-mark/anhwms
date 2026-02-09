// ====================================================================
// ANH WMS v2 Extended Types
// ====================================================================
// 확장된 엔터프라이즈 WMS 타입 정의
// 기존 types/index.ts와 함께 사용
// ====================================================================

// ====================================================================
// 1. 코어 & 고객 계층
// ====================================================================

export interface Org {
  id: string;  // UUID
  name: string;
  code?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMaster {
  id: string;  // UUID
  orgId?: string;
  code: string;
  name: string;
  type: 'DIRECT_BRAND' | 'AGENCY' | 'MULTI_BRAND' | 'FORWARDER' | 'LOGISTICS_PARTNER';
  countryCode?: string;
  businessRegNo?: string;
  billingCurrency?: string;
  billingCycle?: string;
  paymentTerms?: number;
  
  // 연락처
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  
  // 주소
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  
  // 계약
  contractStart?: Date;
  contractEnd?: Date;
  
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  note?: string;
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Brand {
  id: string;  // UUID
  customerMasterId: string;
  code: string;
  nameKo?: string;
  nameEn?: string;
  nameZh?: string;
  countryCode?: string;
  
  isDefaultBrand: boolean;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  
  // 운영 설정
  allowBackorder: boolean;
  autoAllocate: boolean;
  requireLotTracking: boolean;
  
  status: 'ACTIVE' | 'INACTIVE';
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;  // UUID
  brandId: string;
  name: string;
  platform: string; // NAVER, COUPANG, TAOBAO, DOUYIN, TMALL, SHOPIFY, OFFLINE, ETC
  externalStoreId?: string;
  storeUrl?: string;
  
  countryCode?: string;
  timezone?: string;
  language?: string;
  
  // API 설정
  apiEnabled: boolean;
  apiKey?: string;
  apiEndpoint?: string;
  syncIntervalMin?: number;
  lastSyncedAt?: Date;
  
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// 2. 창고 & 로케이션
// ====================================================================

export interface Warehouse {
  id: string;  // UUID
  orgId?: string;
  code: string;
  name: string;
  type: 'ANH_OWNED' | 'CLIENT_OWNED' | 'PARTNER_OVERSEAS' | 'RETURNS_CENTER';
  countryCode?: string;
  timezone?: string;
  
  operatorCustomerId?: string;
  ownerCustomerId?: string;
  
  // 주소
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  
  // 운영 설정
  isReturnsCenter: boolean;
  allowInbound: boolean;
  allowOutbound: boolean;
  allowCrossDock: boolean;
  
  operatingHours?: Record<string, string>;
  cutoffTime?: string;
  
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;  // UUID
  warehouseId: string;
  code: string;
  type: 'STORAGE' | 'PICK_FACE' | 'RECEIVING' | 'SHIPPING' | 'STAGING' | 'INSPECTION' | 'RETURNS' | 'QUARANTINE';
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  
  maxCapacity?: number;
  capacityUnit?: string;
  
  isPickable: boolean;
  isBulk: boolean;
  temperatureZone?: string;
  
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'FULL';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandWarehouse {
  id: string;  // UUID
  brandId: string;
  warehouseId: string;
  
  isPrimary: boolean;
  fulfillPriority: number;
  
  allowInbound: boolean;
  allowOutbound: boolean;
  allowStockHold: boolean;
  
  storageRate?: number;
  handlingRate?: number;
  rateCurrency?: string;
  
  status: 'ACTIVE' | 'INACTIVE';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransfer {
  id: string;  // UUID
  fromWarehouseId: string;
  toWarehouseId: string;
  refNo?: string;
  
  status: 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  
  requestedAt: Date;
  approvedAt?: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  
  createdByUserId?: string;
  approvedByUserId?: string;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransferLine {
  id: string;  // UUID
  stockTransferId: string;
  productId: string;
  uomCode: string;
  qtyPlanned: number;
  qtyShipped: number;
  qtyReceived: number;
  lineNo?: number;
}

// ====================================================================
// 3. 상품 확장
// ====================================================================

export interface ProductExtended {
  // 기존 Product 필드 + 확장
  id: string;  // UUID
  brandId?: string;
  sku: string;
  name: string;
  barcode?: string;
  category?: string;
  
  hsCode?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  
  productType: 'NORMAL' | 'KIT' | 'COMPONENT' | 'VIRTUAL';
  
  status: 'ACTIVE' | 'INACTIVE';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductUOM {
  id: string;  // UUID
  productId: string;
  uomCode: string;
  uomName?: string;
  qtyInBaseUom: number;
  barcode?: string;
  
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  
  isBaseUom: boolean;
  isOrderable: boolean;
  isSellable: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductBOM {
  id: string;  // UUID
  kitProductId: string;
  componentProductId: string;
  componentQtyInBaseUom: number;
  seqNo?: number;
  isOptional: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryExtended {
  id: string;  // UUID
  warehouseId: string;
  locationId?: string;
  productId: string;
  ownerBrandId: string;
  uomCode: string;
  
  qtyOnHand: number;
  qtyAllocated: number;
  qtyAvailable: number; // computed
  
  lotNo?: string;
  expiryDate?: Date;
  manufacturedDate?: Date;
  
  status: 'AVAILABLE' | 'HOLD' | 'DAMAGED' | 'QUARANTINE';
  
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// 4. 입출고 확장
// ====================================================================

export interface InboundShipment {
  id: string;  // UUID
  warehouseId: string;
  ownerBrandId: string;
  supplierCustomerId?: string;
  
  refNo?: string;
  type: 'PURCHASE' | 'RETURN' | 'TRANSFER' | 'B2B';
  
  status: 'DRAFT' | 'RECEIVING' | 'COMPLETED' | 'CANCELLED';
  
  eta?: Date;
  receivedAt?: Date;
  completedAt?: Date;
  
  createdByUserId?: string;
  receivedByUserId?: string;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface InboundShipmentLine {
  id: string;  // UUID
  inboundShipmentId: string;
  productId: string;
  uomCode: string;
  
  qtyExpected: number;
  qtyReceived: number;
  qtyDamaged: number;
  
  lotNo?: string;
  expiryDate?: Date;
  
  lineNo?: number;
  note?: string;
}

export interface OutboundExtended {
  // 기존 Outbound + 확장
  id: string;  // UUID
  warehouseId?: string;
  brandId?: string;
  storeId?: string;
  
  orderType: 'B2C' | 'B2B' | 'TRANSFER' | 'RETURN';
  
  clientOrderNo?: string;
  channelOrderNo?: string;
  
  status: 'NEW' | 'ALLOCATED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'CANCELLED';
  
  requestedShipAt?: Date;
  shippedAt?: Date;
  
  trackingNo?: string;
  carrierCode?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface OutboundOrderLine {
  id: string;  // UUID
  outboundId: string;
  productId: string;
  uomCode: string;
  
  qtyOrdered: number;
  qtyAllocated: number;
  qtyPicked: number;
  qtyPacked: number;
  qtyShipped: number;
  
  lotNo?: string;
  
  lineNo?: number;
  note?: string;
}

// ====================================================================
// 5. 작업 관리 확장
// ====================================================================

export interface WorkTaskExtended {
  id: string;  // UUID
  warehouseId?: string;
  taskType?: string; // PICK / PACK / PUTAWAY / COUNT / RETURN / PACK_JOB / INSPECTION
  processStage?: string; // OUTBOUND_PICK / OUTBOUND_PACK / OUTBOUND_SHIP / INBOUND_RECEIVING / INBOUND_PUTAWAY
  
  outboundId?: string;
  inboundShipmentId?: string;
  
  assigneeUserId?: string;
  
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'HOLD' | 'CANCELLED';
  priority: number;
  
  slaDueAt?: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkTaskAction {
  id: string;  // UUID
  workOrderId: string;
  actionCode: string;
  label: string;
  seqNo: number;
  
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  completedAt?: Date;
  completedBy?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// 6. 번들/키팅
// ====================================================================

export interface PackJob {
  id: string;  // UUID
  warehouseId: string;
  kitProductId: string;
  ownerBrandId: string;
  
  fromLocationId?: string;
  toLocationId?: string;
  
  qtyKitPlanned: number;
  qtyKitCompleted: number;
  
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  
  createdByUserId?: string;
  startedAt?: Date;
  completedAt?: Date;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PackJobComponent {
  id: string;  // UUID
  packJobId: string;
  componentProductId: string;
  uomCode: string;
  
  qtyRequired: number;
  qtyConsumed: number;
  
  lineNo?: number;
}

// ====================================================================
// 7. 재고 트랜잭션
// ====================================================================

export interface InventoryTransaction {
  id: string;  // UUID
  warehouseId: string;
  locationId?: string;
  productId: string;
  ownerBrandId?: string;
  uomCode: string;
  
  transactionType: 'IN' | 'OUT' | 'MOVE' | 'ADJUST' | 'HOLD' | 'RELEASE';
  qty: number;
  
  refType?: string; // INBOUND / OUTBOUND / PACK_JOB / STOCK_TRANSFER / ADJUSTMENT
  refId?: string;
  
  lotNo?: string;
  
  fromLocationId?: string;
  toLocationId?: string;
  
  performedByUserId?: string;
  performedAt: Date;
  
  note?: string;
  
  createdAt: Date;
}

// ====================================================================
// 8. 반품센터
// ====================================================================

export interface ReturnOrder {
  id: string;  // UUID
  warehouseId: string;
  brandId?: string;
  storeId?: string;
  
  sourceType: 'OUR_OUTBOUND' | 'EXTERNAL' | 'CUSTOMER_RETURN';
  outboundId?: string;
  externalOrderRef?: string;
  
  carrierCode?: string;
  trackingNo?: string;
  
  status: 'CREATED' | 'RECEIVED' | 'INSPECTED' | 'COMPLETED' | 'DISPOSED';
  reasonCode?: string; // DEFECT / SIZE_MISMATCH / CUSTOMER_CHANGE / DAMAGED / ETC
  disposition?: string; // RESTOCK / RESHIP / SCRAP / RETURN_TO_SENDER / EXCHANGE
  
  receivedAt?: Date;
  inspectedAt?: Date;
  completedAt?: Date;
  
  receivedByUserId?: string;
  inspectedByUserId?: string;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ReturnOrderLine {
  id: string;  // UUID
  returnOrderId: string;
  productId?: string;
  uomCode?: string;
  
  qtyReturned: number;
  qtyAccepted: number;
  qtyRestocked: number;
  qtyScrapped: number;
  qtyReshipped: number;
  
  conditionCode?: string; // NEW / GOOD / DAMAGED / DESTROYED
  lotNo?: string;
  
  lineNo?: number;
  note?: string;
}

// ====================================================================
// 9. 배송 관리
// ====================================================================

export interface ShippingCarrier {
  id: string;  // UUID
  code: string;
  nameKo: string;
  nameEn?: string;
  countryCode?: string;
  
  apiType?: string; // REST / SOAP / SFTP / MANUAL
  apiEndpoint?: string;
  apiKey?: string;
  
  isDomestic: boolean;
  isInternational: boolean;
  
  status: 'ACTIVE' | 'INACTIVE';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ShippingAccount {
  id: string;  // UUID
  customerMasterId: string;
  carrierId: string;
  
  accountCode: string;
  accountName?: string;
  
  isAnhOwned: boolean;
  
  apiUsername?: string;
  apiPassword?: string;
  apiToken?: string;
  
  contractRate?: number;
  rateCurrency?: string;
  
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  validFrom?: Date;
  validTo?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ParcelShipment {
  id: string;  // UUID
  shippingAccountId: string;
  brandId?: string;
  storeId?: string;
  outboundId?: string;
  warehouseId?: string;
  
  sourceType: 'WMS' | 'EXTERNAL';
  
  trackingNo: string;
  waybillNo?: string;
  invoiceNo?: string;
  
  shipDate: Date;
  destCountryCode?: string;
  destCity?: string;
  destPostalCode?: string;
  
  boxCount: number;
  weightKg?: number;
  volumeM3?: number;
  
  feeTotal?: number;
  feeBase?: number;
  feeFuel?: number;
  feeRemote?: number;
  feeExtra?: number;
  feeCurrency?: string;
  
  anhCommission?: number;
  anhCommissionRate?: number;
  
  billingStatus: 'UNBILLED' | 'BILLED' | 'PAID' | 'DISPUTED';
  billedAt?: Date;
  paidAt?: Date;
  
  status: 'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
  deliveredAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// 10. 청구 관리
// ====================================================================

export interface BillingInvoice {
  id: string;  // UUID
  customerMasterId: string;
  brandId?: string;
  
  invoiceNo: string;
  invoiceDate: Date;
  dueDate?: Date;
  
  periodFrom: Date;
  periodTo: Date;
  
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issuedAt?: Date;
  paidAt?: Date;
  
  note?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingInvoiceLine {
  id: string;  // UUID
  billingInvoiceId: string;
  
  itemType: 'STORAGE' | 'HANDLING' | 'SHIPPING' | 'PACKING' | 'EXTRA';
  description: string;
  
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  
  refType?: string; // PARCEL_SHIPMENT / INBOUND_SHIPMENT / OUTBOUND_ORDER
  refId?: string;
  
  lineNo?: number;
}

// ====================================================================
// 11. 시스템 알림
// ====================================================================

export interface SystemAlert {
  id: string;  // UUID
  alertType: 'INVENTORY_LOW' | 'ORDER_DELAYED' | 'SHIPMENT_EXCEPTION' | 'BILLING_OVERDUE';
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  
  brandId?: string;
  warehouseId?: string;
  
  title: string;
  message?: string;
  
  refType?: string;
  refId?: string;
  
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ====================================================================
// 12. 대시보드 통계 (확장)
// ====================================================================

export interface AdminDashboardStats {
  // 고객사 통계
  totalCustomers: number;
  activeCustomers: number;
  totalBrands: number;
  totalStores: number;
  
  // 창고 통계
  totalWarehouses: number;
  totalLocations: number;
  totalStorageCapacity: number;
  usedStorageCapacity: number;
  
  // 재고 통계
  totalSKUs: number;
  totalInventoryValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  
  // 주문 통계
  todayInbounds: number;
  todayOutbounds: number;
  pendingOutbounds: number;
  delayedOrders: number;
  
  // 반품 통계
  pendingReturns: number;
  todayReturns: number;
  
  // 배송 통계
  todayShipments: number;
  totalShipmentCost: number;
  
  // 청구 통계
  unbilledAmount: number;
  overdueInvoices: number;
  
  // 알림
  openAlerts: number;
  criticalAlerts: number;
}

// ====================================================================
// 13. 필터 & 검색 타입
// ====================================================================

export interface CustomerFilter {
  type?: string[];
  status?: string[];
  countryCode?: string;
  searchTerm?: string;
}

export interface WarehouseFilter {
  type?: string[];
  status?: string[];
  countryCode?: string;
  searchTerm?: string;
}

export interface ProductFilter {
  brandId?: string;
  category?: string;
  productType?: string[];
  status?: string[];
  searchTerm?: string;
}

export interface OutboundFilter {
  warehouseId?: string;
  brandId?: string;
  storeId?: string;
  orderType?: string[];
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}

// ====================================================================
// Export all
// ====================================================================

export type {
  // 기존 타입들은 types/index.ts에서 re-export
};

