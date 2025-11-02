import { Product, Inbound, Outbound, Partner, DashboardStats } from '@/types';

// 임시 제품 데이터
export const mockProducts: Product[] = [
  {
    id: '1',
    name: '노트북 A',
    sku: 'LAP-001',
    category: '전자제품',
    quantity: 45,
    unit: '개',
    minStock: 10,
    price: 1200000,
    location: 'A-1-01',
    description: '15인치 노트북',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-11-01'),
  },
  {
    id: '2',
    name: '무선 마우스',
    sku: 'MOU-001',
    category: '전자제품',
    quantity: 120,
    unit: '개',
    minStock: 30,
    price: 25000,
    location: 'A-2-05',
    description: '블루투스 무선 마우스',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-10-30'),
  },
  {
    id: '3',
    name: '키보드',
    sku: 'KEY-001',
    category: '전자제품',
    quantity: 8,
    unit: '개',
    minStock: 15,
    price: 85000,
    location: 'A-2-06',
    description: '기계식 키보드',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-11-02'),
  },
  {
    id: '4',
    name: '모니터 27인치',
    sku: 'MON-001',
    category: '전자제품',
    quantity: 32,
    unit: '개',
    minStock: 10,
    price: 350000,
    location: 'B-1-03',
    description: '4K 해상도 모니터',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-11-01'),
  },
  {
    id: '5',
    name: 'USB 케이블',
    sku: 'CAB-001',
    category: '액세서리',
    quantity: 5,
    unit: '개',
    minStock: 50,
    price: 5000,
    location: 'C-1-01',
    description: 'USB Type-C 케이블',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-11-02'),
  },
];

// 임시 거래처 데이터
export const mockPartners: Partner[] = [
  {
    id: '1',
    name: '테크 공급업체',
    type: 'supplier',
    contact: '김철수',
    phone: '02-1234-5678',
    email: 'tech@supplier.com',
    address: '서울시 강남구',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'ABC 전자',
    type: 'customer',
    contact: '이영희',
    phone: '02-9876-5432',
    email: 'abc@customer.com',
    address: '서울시 서초구',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
];

// 임시 입고 데이터
export const mockInbounds: Inbound[] = [
  {
    id: '1',
    productId: '1',
    productName: '노트북 A',
    supplierId: '1',
    supplierName: '테크 공급업체',
    quantity: 20,
    unit: '개',
    unitPrice: 1200000,
    totalPrice: 24000000,
    inboundDate: new Date('2024-11-02'),
    status: 'completed',
    createdAt: new Date('2024-11-02'),
  },
  {
    id: '2',
    productId: '2',
    productName: '무선 마우스',
    supplierId: '1',
    supplierName: '테크 공급업체',
    quantity: 50,
    unit: '개',
    unitPrice: 25000,
    totalPrice: 1250000,
    inboundDate: new Date('2024-11-02'),
    status: 'completed',
    createdAt: new Date('2024-11-02'),
  },
  {
    id: '3',
    productId: '4',
    productName: '모니터 27인치',
    supplierId: '1',
    supplierName: '테크 공급업체',
    quantity: 10,
    unit: '개',
    unitPrice: 350000,
    totalPrice: 3500000,
    inboundDate: new Date('2024-11-01'),
    status: 'completed',
    createdAt: new Date('2024-11-01'),
  },
];

// 임시 출고 데이터
export const mockOutbounds: Outbound[] = [
  {
    id: '1',
    productId: '1',
    productName: '노트북 A',
    customerId: '2',
    customerName: 'ABC 전자',
    quantity: 10,
    unit: '개',
    unitPrice: 1200000,
    totalPrice: 12000000,
    outboundDate: new Date('2024-11-02'),
    status: 'completed',
    createdAt: new Date('2024-11-02'),
  },
  {
    id: '2',
    productId: '2',
    productName: '무선 마우스',
    customerId: '2',
    customerName: 'ABC 전자',
    quantity: 30,
    unit: '개',
    unitPrice: 25000,
    totalPrice: 750000,
    outboundDate: new Date('2024-11-02'),
    status: 'completed',
    createdAt: new Date('2024-11-02'),
  },
];

// 대시보드 통계 데이터
export const getDashboardStats = (): DashboardStats => {
  const lowStockProducts = mockProducts.filter(p => p.quantity < p.minStock);
  const today = new Date().toDateString();
  const todayInbounds = mockInbounds.filter(
    i => i.inboundDate.toDateString() === today
  );
  const todayOutbounds = mockOutbounds.filter(
    o => o.outboundDate.toDateString() === today
  );

  return {
    totalProducts: mockProducts.length,
    totalStock: mockProducts.reduce((sum, p) => sum + p.quantity, 0),
    lowStockItems: lowStockProducts.length,
    totalInboundToday: todayInbounds.reduce((sum, i) => sum + i.quantity, 0),
    totalOutboundToday: todayOutbounds.reduce((sum, o) => sum + o.quantity, 0),
    recentInbounds: mockInbounds.slice(0, 5),
    recentOutbounds: mockOutbounds.slice(0, 5),
    lowStockProducts: lowStockProducts,
  };
};

