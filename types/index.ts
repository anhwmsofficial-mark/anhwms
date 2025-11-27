// 제품 타입
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  price: number;
  location: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 입고 타입
export interface Inbound {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  inboundDate: Date;
  status: 'pending' | 'completed' | 'cancelled';
  note?: string;
  createdAt: Date;
}

// 출고 타입
export interface Outbound {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  outboundDate: Date;
  status: 'pending' | 'completed' | 'cancelled';
  note?: string;
  createdAt: Date;
}

// 거래처 타입
export interface Partner {
  id: string;
  name: string;
  type: 'supplier' | 'customer' | 'both';
  contact: string;
  phone: string;
  email: string;
  address: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 사용자 타입 (Supabase user_profiles 연동)
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  createdAt: string;
  department?: string | null;
  status?: string | null;
  canAccessAdmin?: boolean;
  canAccessDashboard?: boolean;
}

// 대시보드 통계 타입
export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockItems: number;
  totalInboundToday: number;
  totalOutboundToday: number;
  recentInbounds: Inbound[];
  recentOutbounds: Outbound[];
  lowStockProducts: Product[];
}

// 작업 상태 타입
export type WorkStatus = 'planned' | 'in-progress' | 'completed' | 'overdue' | 'on-hold';

// 작업 타입 (입고/출고/포장)
export type WorkType = 'inbound' | 'outbound' | 'packing';

// 작업 지시
export interface WorkOrder {
  id: string;
  type: WorkType;
  title: string;
  description?: string;
  productName: string;
  quantity: number;
  unit: string;
  location?: string;
  assignee?: string;
  status: WorkStatus;
  dueDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  note?: string;
  attachments?: string[];
  createdAt: Date;
}

// 내 작업
export interface MyTask {
  id: string;
  workOrderId: string;
  type: WorkType;
  title: string;
  description?: string;
  productName: string;
  quantity: number;
  unit: string;
  location?: string;
  status: WorkStatus;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  barcode?: string;
  qrCode?: string;
  note?: string;
  attachments?: string[];
  createdAt: Date;
}

// Ops 보드 통계
export interface OpsStats {
  inbound: {
    planned: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  outbound: {
    planned: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  packing: {
    planned: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
}

// ====================================================================
// 주문 업로드 & 배송연동
// ====================================================================

export interface Order {
  id: string;
  orderNo: string;
  userId?: string;
  countryCode?: string;
  productName?: string;
  remark?: string;
  logisticsCompany?: 'CJ' | 'ANH' | 'INTL';
  trackingNo?: string;
  status: 'CREATED' | 'PUSHED' | 'SYNCED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  receiver?: OrderReceiver;
}

export interface OrderReceiver {
  id: string;
  orderId: string;
  name: string;
  phone?: string;
  zip?: string;
  address1?: string;
  address2?: string;
  locality?: string;
  countryCode?: string;
  meta?: any;
  createdAt: Date;
}

export interface OrderSender {
  id: string;
  name: string;
  phone?: string;
  zip?: string;
  address?: string;
  addressDetail?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface LogisticsApiLog {
  id: string;
  orderId: string;
  adapter: 'CJ' | 'ANH' | 'INTL';
  direction: 'REQUEST' | 'RESPONSE';
  status: 'S' | 'E' | 'F';
  httpCode?: number;
  headers?: any;
  body?: any;
  createdAt: Date;
}

export interface TelParts {
  a: string;
  b: string;
  c: string;
}

export interface ParsedAddress {
  countryCode: string;
  address1: string;
  address2: string;
  postcode: string;
  locality: string;
  phoneIntl: string;
}

export interface CJRegBookPayload {
  order: {
    orderNo: string;
    trackingNo: string;
    items: Array<{
      name: string;
      qty: number;
      unit: string;
      amountKRW: number;
    }>;
    remark?: string;
    createdAt?: string;
  };
  sender: {
    name: string;
    tel: TelParts;
    zip: string;
    addr: string;
    addrDetail: string;
  };
  receiver: {
    name: string;
    tel: TelParts;
    zip: string;
    addr: string;
    addrDetail: string;
  };
  options: {
    printFlag: string;
    deliveryType: string;
    boxType: string;
    boxQty: number;
    freight: number;
  };
}

export interface CJRegBookResponse {
  result: 'S' | 'E' | 'F';
  invoiceNo?: string;
  cj?: {
    RESULT_CD: string;
    RESULT_DETAIL: string;
  };
  echo?: {
    orderNo: string;
  };
}

// ====================================================================
// AI CS 통합 시스템
// ====================================================================

// 파트너 확장 (CS용)
export interface PartnerExtended extends Partner {
  code?: string;
  locale?: string;
  timezone?: string;
}

// CS 대화
export interface CSConversation {
  id: string;
  partnerId?: string;
  channel: 'wechat' | 'email' | 'chat' | 'phone';
  langIn: 'zh' | 'ko';
  subject?: string;
  status: 'open' | 'closed' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// CS 메시지
export interface CSMessage {
  id: string;
  convoId: string;
  role: 'partner' | 'agent' | 'ai';
  lang: 'zh' | 'ko';
  content: string;
  intent?: CSIntent;
  slots?: Record<string, any>;
  toolName?: string;
  toolPayload?: any;
  toolResult?: any;
  createdAt: Date;
}

// CS 의도 (Intent)
export type CSIntent = 
  | 'shipping_query'      // 배송조회
  | 'outbound_check'       // 출고확인
  | 'inbound_check'        // 입고확인
  | 'inventory'            // 재고수량
  | 'document'             // 서류요청
  | 'customs'              // 통관
  | 'quote'                // 견적
  | 'billing'              // 청구
  | 'other';               // 기타

// CS 템플릿
export interface CSTemplate {
  id: string;
  key: string;
  lang: 'zh' | 'ko';
  tone: 'business' | 'friendly' | 'formal';
  body: string;
  variables?: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 번역 로그
export interface CSTranslateLog {
  id: string;
  userId?: string;
  sourceLang: 'ko' | 'zh';
  targetLang: 'ko' | 'zh';
  sourceText: string;
  translatedText: string;
  tone: 'business' | 'friendly' | 'formal';
  formality: 'formal' | 'neutral' | 'casual';
  charsIn?: number;
  charsOut?: number;
  createdAt: Date;
}

// 용어집
export interface CSGlossary {
  id: string;
  termKo: string;
  termZh: string;
  note?: string;
  priority: number; // 1-10
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// CS 알림/경보
export interface CSAlert {
  id: string;
  type: 'delay48h' | 'qty_mismatch' | 'customs_hold' | 'damage' | 'missing';
  ref?: string;
  partnerId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  message?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// CS 티켓
export interface CSTicket {
  id: string;
  partnerId?: string;
  conversationId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  summary: string;
  description?: string;
  assignee?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// CS 툴 함수 스키마
export interface CSToolFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// CS 응답 결과
export interface CSResponse {
  intent: CSIntent;
  slots?: Record<string, any>;
  toolCalls?: Array<{
    name: string;
    payload: any;
    result?: any;
  }>;
  response: string; // 최종 응답 (중국어)
  confidence?: number;
}

// ====================================================================
// Global Fulfillment (글로벌 풀필먼트)
// ====================================================================

// 풀필먼트 통계
export interface GlobalFulfillmentStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  delayedOrders: number;
  exceptionOrders: number;
  byStep: {
    drop_shipping: number;
    preparation: number;
    wave_management: number;
    second_sorting: number;
    inspection: number;
    package_check: number;
    weight_check: number;
    completed: number;
    exception: number;
    returned: number;
  };
  byCountry?: Record<string, number>;
  byCustomer?: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
  }>;
  topExceptions?: Array<{
    type: string;
    count: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  recentActivity?: Array<any>;
}

// 풀필먼트 프로세스 로그
export interface GlobalProcessLog {
  id: string;
  orderId: string;
  step: string;
  status: 'pending' | 'in-progress' | 'completed' | 'exception';
  timestamp: Date;
  note?: string;
}

// 웨이브 관리
export interface GlobalWave {
  id: string;
  waveNumber: string;
  waveName: string;
  waveType: string;
  shippingMethod: string;
  carrier: string;
  status: 'planned' | 'pending' | 'in_progress' | 'sorting' | 'completed' | 'cancelled';
  totalOrders: number;
  completedOrders: number;
  targetDate?: Date;
  plannedShipDate?: Date;
  cutoffTime?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

// ====================================================================
// External Quote Inquiry (신규 리드)
// ====================================================================

export type MonthlyOutboundRange =
  | '0_1000'
  | '1000_2000'
  | '2000_3000'
  | '3000_5000'
  | '5000_10000'
  | '10000_30000'
  | '30000_plus';

export type QuoteInquiryStatus =
  | 'new'           // 신규
  | 'checked'       // 확인됨
  | 'processing'    // 상담중
  | 'quoted'        // 견적 발송
  | 'pending'       // 고객 검토중
  | 'won'           // 수주
  | 'lost'          // 미수주
  | 'on_hold';      // 보류

export interface ExternalQuoteInquiry {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  monthlyOutboundRange: MonthlyOutboundRange;
  skuCount?: number | null;
  productCategories: string[];
  extraServices: string[];
  memo?: string | null;
  status: QuoteInquiryStatus;
  ownerUserId?: string | null;
  source?: string | null;
  assignedTo?: string | null;
  quoteFileUrl?: string | null;
  quoteSentAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface CreateExternalQuoteInquiryInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  monthlyOutboundRange: MonthlyOutboundRange;
  skuCount?: number | null;
  productCategories?: string[];
  extraServices?: string[];
  memo?: string | null;
  status?: QuoteInquiryStatus;
  ownerUserId?: string | null;
  source?: string;
}

// ====================================================================
// International Quote Inquiry (해외배송 견적)
// ====================================================================

export type ShippingMethod = 'air' | 'express' | 'sea' | 'combined';

export type MonthlyShipmentVolume =
  | '0_100'
  | '100_500'
  | '500_1000'
  | '1000_3000'
  | '3000_plus';

export type TradeTerms = 'FOB' | 'DDP' | 'EXW' | 'CIF' | 'not_sure';

export interface InternationalQuoteInquiry {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  destinationCountries: string[];
  shippingMethod?: ShippingMethod | null;
  monthlyShipmentVolume: MonthlyShipmentVolume;
  avgBoxWeight?: number | null;
  skuCount?: number | null;
  productCategories: string[];
  productCharacteristics: string[];
  customsSupportNeeded: boolean;
  tradeTerms?: TradeTerms | null;
  memo?: string | null;
  status: QuoteInquiryStatus;
  ownerUserId?: string | null;
  source?: string | null;
  assignedTo?: string | null;
  quoteFileUrl?: string | null;
  quoteSentAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface CreateInternationalQuoteInquiryInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  destinationCountries: string[];
  shippingMethod?: ShippingMethod | null;
  monthlyShipmentVolume: MonthlyShipmentVolume;
  avgBoxWeight?: number | null;
  skuCount?: number | null;
  productCategories?: string[];
  productCharacteristics?: string[];
  customsSupportNeeded?: boolean;
  tradeTerms?: TradeTerms | null;
  memo?: string | null;
  status?: QuoteInquiryStatus;
  ownerUserId?: string | null;
  source?: string;
}

// ====================================================================
// 견적 문의 메모 (Inquiry Notes)
// ====================================================================

export interface InquiryNote {
  id: string;
  inquiryId: string;
  inquiryType: 'external' | 'international';
  adminId: string;
  adminName?: string;  // 조인 시 포함
  note: string;
  createdAt: Date;
  updatedAt?: Date | null;
}

export interface CreateInquiryNoteInput {
  inquiryId: string;
  inquiryType: 'external' | 'international';
  note: string;
}

// ====================================================================
// 거래처 관리 고도화 (Customer Enhancement)
// ====================================================================

// 거래처 담당자
export interface CustomerContact {
  id: string;
  customerMasterId: string;
  name: string;
  title?: string | null;
  department?: string | null;
  role: 'PRIMARY' | 'SALES' | 'OPERATION' | 'FINANCE' | 'TECHNICAL' | 'LEGAL' | 'CS' | 'OTHER';
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  preferredContact: 'EMAIL' | 'PHONE' | 'SMS' | 'KAKAO' | 'WECHAT' | 'LINE';
  workHours?: string | null;
  timezone: string;
  language: string;
  isPrimary: boolean;
  isActive: boolean;
  birthday?: Date | null;
  note?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerContactInput {
  customerMasterId: string;
  name: string;
  title?: string | null;
  department?: string | null;
  role: CustomerContact['role'];
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContact?: CustomerContact['preferredContact'];
  isPrimary?: boolean;
  note?: string | null;
}

// 거래처 관계
export type RelationshipType = 
  | 'PARENT_SUBSIDIARY'
  | 'AGENCY_CLIENT'
  | 'PRIME_SUB'
  | 'PARTNERSHIP'
  | 'REFERRAL'
  | 'AFFILIATED'
  | 'FRANCHISEE'
  | 'RESELLER';

export interface CustomerRelationship {
  id: string;
  parentCustomerId: string;
  childCustomerId: string;
  relationshipType: RelationshipType;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  relationshipStrength?: 'STRONG' | 'MEDIUM' | 'WEAK' | null;
  note?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  // 조인 데이터
  parentCustomer?: { id: string; code: string; name: string; type: string };
  childCustomer?: { id: string; code: string; name: string; type: string };
}

export interface CreateCustomerRelationshipInput {
  parentCustomerId: string;
  childCustomerId: string;
  relationshipType: RelationshipType;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  relationshipStrength?: 'STRONG' | 'MEDIUM' | 'WEAK';
  note?: string;
}

// 거래처 가격 정책
export type PricingType =
  | 'STORAGE'
  | 'INBOUND'
  | 'OUTBOUND'
  | 'PACKING'
  | 'LABELING'
  | 'KITTING'
  | 'RETURNS'
  | 'INSPECTION'
  | 'REPACKAGING'
  | 'SPECIAL_SERVICE'
  | 'SHIPPING_DOMESTIC'
  | 'SHIPPING_INTL'
  | 'CUSTOMS'
  | 'WAREHOUSING';

export interface CustomerPricing {
  id: string;
  customerMasterId: string;
  orgId?: string | null;
  pricingType: PricingType;
  serviceName?: string | null;
  serviceCode?: string | null;
  unitPrice: number;
  currency: string;
  unit: string;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  volumeDiscountRate?: number | null;
  volumeThreshold?: number | null;
  requiresApproval: boolean;
  isActive: boolean;
  note?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerPricingInput {
  customerMasterId: string;
  orgId?: string;
  pricingType: PricingType;
  serviceName?: string;
  serviceCode?: string;
  unitPrice: number;
  currency?: string;
  unit: string;
  minQuantity?: number;
  maxQuantity?: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  volumeDiscountRate?: number;
  volumeThreshold?: number;
  note?: string;
}

// 거래처 계약
export type ContractType =
  | 'SERVICE_AGREEMENT'
  | 'MASTER_AGREEMENT'
  | 'NDA'
  | 'SLA'
  | 'PRICING_AGREEMENT'
  | 'AMENDMENT'
  | 'LEASE'
  | 'PARTNERSHIP';

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'RENEWED';

export interface CustomerContract {
  id: string;
  customerMasterId: string;
  contractNo: string;
  contractName: string;
  contractType: ContractType;
  contractStart: Date;
  contractEnd?: Date | null;
  autoRenewal: boolean;
  renewalNoticeDays: number;
  renewalCount: number;
  contractAmount?: number | null;
  currency: string;
  paymentTerms: number;
  paymentMethod?: string | null;
  billingCycle: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
  slaInboundProcessing?: number | null;
  slaOutboundCutoff?: string | null;
  slaAccuracyRate?: number | null;
  slaOntimeShipRate?: number | null;
  contractFileUrl?: string | null;
  contractFileName?: string | null;
  signedDate?: Date | null;
  signedByCustomer?: string | null;
  signedByCompany?: string | null;
  status: ContractStatus;
  parentContractId?: string | null;
  replacedByContractId?: string | null;
  terminationReason?: string | null;
  terminationDate?: Date | null;
  terminationNoticeDate?: Date | null;
  reminderSent: boolean;
  reminderSentAt?: Date | null;
  note?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  // 계산된 필드
  daysUntilExpiry?: number | null;
  isExpiringSoon?: boolean;
}

export interface CreateCustomerContractInput {
  customerMasterId: string;
  contractNo: string;
  contractName: string;
  contractType: ContractType;
  contractStart: Date;
  contractEnd?: Date;
  autoRenewal?: boolean;
  contractAmount?: number;
  currency?: string;
  paymentTerms?: number;
  billingCycle?: CustomerContract['billingCycle'];
  note?: string;
}

// 거래처 활동 이력
export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'SITE_VISIT'
  | 'VIDEO_CALL'
  | 'ISSUE'
  | 'COMPLAINT'
  | 'FEEDBACK'
  | 'QUOTE_SENT'
  | 'CONTRACT_SIGNED'
  | 'NOTE'
  | 'TASK'
  | 'REMINDER';

export type ActivityPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CustomerActivity {
  id: string;
  customerMasterId: string;
  activityType: ActivityType;
  subject: string;
  description?: string | null;
  relatedContactId?: string | null;
  performedByUserId?: string | null;
  priority: ActivityPriority;
  requiresFollowup: boolean;
  followupDueDate?: Date | null;
  followupCompleted: boolean;
  followupCompletedAt?: Date | null;
  attachmentUrls?: string[] | null;
  tags?: string[] | null;
  activityDate: Date;
  durationMinutes?: number | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  // 조인 데이터
  relatedContact?: { id: string; name: string; role: string };
  performedByUser?: { id: string; username: string; email: string };
}

export interface CreateCustomerActivityInput {
  customerMasterId: string;
  activityType: ActivityType;
  subject: string;
  description?: string;
  relatedContactId?: string;
  performedByUserId?: string;
  priority?: ActivityPriority;
  requiresFollowup?: boolean;
  followupDueDate?: Date;
  tags?: string[];
  activityDate?: Date;
  durationMinutes?: number;
}

// 거래처 상세 정보 (통합)
export interface CustomerMasterDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  countryCode: string;
  businessRegNo?: string | null;
  billingCurrency: string;
  billingCycle?: string | null;
  paymentTerms: number;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  contractStart?: Date | null;
  contractEnd?: Date | null;
  status: string;
  note?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  // 추가 정보
  contacts?: CustomerContact[];
  relationships?: CustomerRelationship[];
  pricings?: CustomerPricing[];
  contracts?: CustomerContract[];
  recentActivities?: CustomerActivity[];
}
