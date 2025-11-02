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

