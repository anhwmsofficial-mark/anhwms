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

// 사용자 타입
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  createdAt: Date;
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
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  totalOrders: number;
  completedOrders: number;
  targetDate?: Date;
  createdAt?: Date;
  completedAt?: Date;
}

