import { Product } from '@/types';

export type InventoryStatus = 'NORMAL' | 'WARNING' | 'LOW_STOCK' | 'INBOUND_EXPECTED';

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  NORMAL: '정상',
  WARNING: '주의',
  LOW_STOCK: '재고부족',
  INBOUND_EXPECTED: '입고예정',
};

export const INVENTORY_STATUS_COLORS: Record<InventoryStatus, { bg: string; text: string; ring: string }> = {
  NORMAL: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20' },
  LOW_STOCK: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
  INBOUND_EXPECTED: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20' },
};

export function getProductStatus(product: Product): InventoryStatus {
  const quantity = product.quantity || 0;
  const minStock = product.minStock || 0;
  const expectedInbound = product.expectedInbound || 0;

  if (quantity < minStock) {
    if (expectedInbound > 0) return 'INBOUND_EXPECTED';
    return 'LOW_STOCK';
  }
  
  if (minStock > 0 && quantity < minStock * 2) {
    return 'WARNING';
  }

  return 'NORMAL';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}
