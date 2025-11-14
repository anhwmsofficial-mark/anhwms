import { Product, Inbound, Outbound, Partner, DashboardStats, WorkOrder, MyTask, OpsStats } from '@/types';

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
    email: 'tech@anhwms.com',
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
    email: 'abc@anhwms.com',
    address: '서울시 서초구',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: '3',
    name: '글로벌 IT 솔루션',
    type: 'both',
    contact: '박민수',
    phone: '031-555-7777',
    email: 'global@anhwms.com',
    address: '경기도 성남시 분당구',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: '4',
    name: '스마트 전자',
    type: 'supplier',
    contact: '최영희',
    phone: '02-8888-9999',
    email: 'smart@anhwms.com',
    address: '서울시 송파구',
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
  {
    id: '5',
    name: '디지털 플러스',
    type: 'customer',
    contact: '정수진',
    phone: '02-3333-4444',
    email: 'digital@anhwms.com',
    address: '서울시 마포구',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
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
    inboundDate: new Date(), // 오늘
    status: 'completed',
    createdAt: new Date(),
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
    inboundDate: new Date(), // 오늘
    status: 'completed',
    createdAt: new Date(),
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
    inboundDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 어제
    status: 'completed',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    productId: '3',
    productName: '키보드',
    supplierId: '4',
    supplierName: '스마트 전자',
    quantity: 15,
    unit: '개',
    unitPrice: 85000,
    totalPrice: 1275000,
    inboundDate: new Date(), // 오늘
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: '5',
    productId: '5',
    productName: 'USB 케이블',
    supplierId: '1',
    supplierName: '테크 공급업체',
    quantity: 100,
    unit: '개',
    unitPrice: 5000,
    totalPrice: 500000,
    inboundDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 이틀 전
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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
    outboundDate: new Date(), // 오늘
    status: 'completed',
    createdAt: new Date(),
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
    outboundDate: new Date(), // 오늘
    status: 'completed',
    createdAt: new Date(),
  },
  {
    id: '3',
    productId: '4',
    productName: '모니터 27인치',
    customerId: '5',
    customerName: '디지털 플러스',
    quantity: 5,
    unit: '개',
    unitPrice: 350000,
    totalPrice: 1750000,
    outboundDate: new Date(), // 오늘
    status: 'pending',
    createdAt: new Date(),
  },
  {
    id: '4',
    productId: '2',
    productName: '무선 마우스',
    customerId: '3',
    customerName: '글로벌 IT 솔루션',
    quantity: 20,
    unit: '개',
    unitPrice: 25000,
    totalPrice: 500000,
    outboundDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 어제
    status: 'completed',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '5',
    productId: '5',
    productName: 'USB 케이블',
    customerId: '2',
    customerName: 'ABC 전자',
    quantity: 50,
    unit: '개',
    unitPrice: 5000,
    totalPrice: 250000,
    outboundDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 이틀 전
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
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

// 작업 지시 데이터
export const mockWorkOrders: WorkOrder[] = [
  {
    id: 'WO-001',
    type: 'inbound',
    title: '노트북 A 입고',
    description: '공급업체로부터 신규 입고',
    productName: '노트북 A',
    quantity: 30,
    unit: '개',
    location: 'A-1-01',
    assignee: '김철수',
    status: 'in-progress',
    dueDate: new Date(),
    startedAt: new Date(),
    createdAt: new Date(),
  },
  {
    id: 'WO-002',
    type: 'inbound',
    title: '무선 마우스 입고',
    description: '정기 입고 건',
    productName: '무선 마우스',
    quantity: 50,
    unit: '개',
    location: 'A-2-05',
    assignee: '이영희',
    status: 'planned',
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2시간 후
    createdAt: new Date(),
  },
  {
    id: 'WO-003',
    type: 'outbound',
    title: 'ABC 전자 출고',
    description: '노트북 10대 출고',
    productName: '노트북 A',
    quantity: 10,
    unit: '개',
    location: 'A-1-01',
    assignee: '박지성',
    status: 'completed',
    dueDate: new Date(),
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 30 * 60 * 1000),
    createdAt: new Date(),
  },
  {
    id: 'WO-004',
    type: 'outbound',
    title: 'XYZ 고객 출고',
    description: '키보드 긴급 출고',
    productName: '키보드',
    quantity: 5,
    unit: '개',
    location: 'A-2-06',
    assignee: '최민수',
    status: 'overdue',
    dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
    createdAt: new Date(),
  },
  {
    id: 'WO-005',
    type: 'packing',
    title: '모니터 포장',
    description: '모니터 20대 포장 작업',
    productName: '모니터 27인치',
    quantity: 20,
    unit: '개',
    location: 'B-1-03',
    assignee: '정수진',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    createdAt: new Date(),
  },
  {
    id: 'WO-006',
    type: 'packing',
    title: 'USB 케이블 포장',
    description: 'USB 케이블 100개 포장',
    productName: 'USB 케이블',
    quantity: 100,
    unit: '개',
    location: 'C-1-01',
    status: 'on-hold',
    dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
    note: '포장재 재고 부족으로 대기중',
    createdAt: new Date(),
  },
];

// 내 작업 데이터
export const mockMyTasks: MyTask[] = [
  {
    id: 'TASK-001',
    workOrderId: 'WO-001',
    type: 'inbound',
    title: '노트북 A 입고',
    description: '공급업체로부터 신규 입고',
    productName: '노트북 A',
    quantity: 30,
    unit: '개',
    location: 'A-1-01',
    status: 'in-progress',
    dueDate: new Date(),
    priority: 'high',
    barcode: 'LAP-001',
    qrCode: 'QR-LAP-001',
    createdAt: new Date(),
  },
  {
    id: 'TASK-002',
    workOrderId: 'WO-002',
    type: 'inbound',
    title: '무선 마우스 입고',
    description: '정기 입고 건',
    productName: '무선 마우스',
    quantity: 50,
    unit: '개',
    location: 'A-2-05',
    status: 'planned',
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
    priority: 'medium',
    barcode: 'MOU-001',
    qrCode: 'QR-MOU-001',
    createdAt: new Date(),
  },
  {
    id: 'TASK-003',
    workOrderId: 'WO-005',
    type: 'packing',
    title: '모니터 포장',
    description: '모니터 20대 포장 작업',
    productName: '모니터 27인치',
    quantity: 20,
    unit: '개',
    location: 'B-1-03',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
    priority: 'medium',
    barcode: 'MON-001',
    qrCode: 'QR-MON-001',
    createdAt: new Date(),
  },
];

// Ops 보드 통계
export const getOpsStats = (): OpsStats => {
  const stats: OpsStats = {
    inbound: { planned: 0, inProgress: 0, completed: 0, overdue: 0 },
    outbound: { planned: 0, inProgress: 0, completed: 0, overdue: 0 },
    packing: { planned: 0, inProgress: 0, completed: 0, overdue: 0 },
  };

  mockWorkOrders.forEach(order => {
    const category = stats[order.type];
    
    switch (order.status) {
      case 'planned':
        category.planned++;
        break;
      case 'in-progress':
        category.inProgress++;
        break;
      case 'completed':
        category.completed++;
        break;
      case 'overdue':
        category.overdue++;
        break;
    }
  });

  return stats;
};

