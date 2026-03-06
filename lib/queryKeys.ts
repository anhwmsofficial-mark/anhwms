export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (params: {
      page: number;
      search: string;
      category: string;
    }) => ['products', 'list', params] as const,
    categories: ['products', 'categories'] as const,
    inventoryStats: ['products', 'inventory-stats'] as const,
  },
  documents: {
    inbounds: ['documents', 'inbounds'] as const,
    outbounds: ['documents', 'outbounds'] as const,
    receiptDocuments: ['documents', 'receipt-documents'] as const,
  },
  inbound: {
    all: ['inbound'] as const,
    list: (params: { page: number; search?: string; status?: string }) =>
      ['inbound', 'list', params] as const,
    detail: (receiptId: string) => ['inbound', 'detail', receiptId] as const,
    photos: (receiptId: string) => ['inbound', 'photos', receiptId] as const,
    slots: (receiptId: string) => ['inbound', 'slots', receiptId] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (params?: { status?: string; page?: number; search?: string }) =>
      ['orders', 'list', params || {}] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
    logs: (orderId: string) => ['orders', 'logs', orderId] as const,
  },
  cs: {
    all: ['cs'] as const,
    glossary: ['cs', 'glossary'] as const,
    templates: ['cs', 'templates'] as const,
    conversations: (params?: { status?: string; search?: string }) =>
      ['cs', 'conversations', params || {}] as const,
    quoteInquiries: (params?: {
      status?: string;
      assignee?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    }) => ['cs', 'quote-inquiries', params || {}] as const,
  },
};

