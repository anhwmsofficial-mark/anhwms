export const INVENTORY_MOVEMENT_DEFINITIONS = [
  { type: 'DAMAGE', label: '파손', direction: 'OUT' },
  { type: 'RETURN_B2C', label: '반품(B2C)', direction: 'IN' },
  { type: 'DISPOSAL', label: '폐기(-)', direction: 'OUT' },
  { type: 'JET_RETURN', label: '제트회송(+)', direction: 'IN' },
  { type: 'RETURN_MILKRUN', label: '반품(밀크런)', direction: 'IN' },
  { type: 'FREIGHT_QUICK_OUT', label: '화물(퀵)', direction: 'OUT' },
  { type: 'OFFICE_USE_OUT', label: '비품(-)', direction: 'OUT' },
  { type: 'FIRE_IN', label: '화재(+)', direction: 'IN' },
  { type: 'FIRE_OUT', label: '화재(-)', direction: 'OUT' },
  { type: 'INBOUND', label: '입고', direction: 'IN' },
  { type: 'RECLASSIFY_GOOD_IN', label: '양품화(+)', direction: 'IN' },
  { type: 'JET_TRANSFER_OUT', label: '제트이관(-)', direction: 'OUT' },
  { type: 'JET_TRANSFER_CANCEL_IN', label: '제트이관작업취소(+)', direction: 'IN' },
  { type: 'ADVANCE_EXCHANGE_IN', label: '선교환(+)', direction: 'IN' },
  { type: 'ADVANCE_EXCHANGE_OUT', label: '선교환(-)', direction: 'OUT' },
  { type: 'COUPANG_MILKRUN_OUT', label: '쿠팡(밀크런)', direction: 'OUT' },
  { type: 'STOCK_ADJUSTMENT_IN', label: '재고조정(+)', direction: 'IN' },
  { type: 'STOCK_ADJUSTMENT_OUT', label: '재고조정(-)', direction: 'OUT' },
  { type: 'SAMPLE_OUT', label: '샘플(-)', direction: 'OUT' },
  { type: 'REPACK_INBOUND_IN', label: '재포장입고(+)', direction: 'IN' },
  { type: 'EXPORT_PICKUP_OUT', label: '수출픽업(-)', direction: 'OUT' },
  { type: 'BUNDLE_SPLIT_IN', label: '번들해체(+)', direction: 'IN' },
  { type: 'BUNDLE_SPLIT_OUT', label: '번들해체(-)', direction: 'OUT' },
  { type: 'BUNDLE_IN', label: '번들(+)', direction: 'IN' },
  { type: 'BUNDLE_OUT', label: '번들(-)', direction: 'OUT' },
  { type: 'REPACK_IN', label: '재포장(+)', direction: 'IN' },
  { type: 'REPACK_OUT', label: '재포장(-)', direction: 'OUT' },
  { type: 'RELABEL_IN', label: '라벨작업(+)', direction: 'IN' },
  { type: 'RELABEL_OUT', label: '라벨작업(-)', direction: 'OUT' },
  { type: 'ROCKET_GROWTH_PARCEL_OUT', label: '로켓그로스(택배)', direction: 'OUT' },
  { type: 'CAFE_DISPLAY_IN', label: '카페진열(+)', direction: 'IN' },
  { type: 'CAFE_DISPLAY_OUT', label: '카페진열(-)', direction: 'OUT' },
  { type: 'OUTBOUND_CANCEL_IN', label: '출고취소', direction: 'IN' },
  { type: 'PARCEL_OUT', label: '택배', direction: 'OUT' },
  { type: 'INVENTORY_INIT', label: '초기재고', direction: 'IN' },
  { type: 'OUTBOUND', label: '출고', direction: 'OUT' },
  { type: 'TRANSFER', label: '이관', direction: null },
] as const;

export const INVENTORY_MOVEMENT_TYPES = INVENTORY_MOVEMENT_DEFINITIONS.map((item) => item.type) as [
  (typeof INVENTORY_MOVEMENT_DEFINITIONS)[number]['type'],
  ...(typeof INVENTORY_MOVEMENT_DEFINITIONS)[number]['type'][]
];

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];
export type InventoryMovementDirection = 'IN' | 'OUT';

export const INVENTORY_MOVEMENT_LABEL_MAP: Record<InventoryMovementType, string> =
  Object.fromEntries(INVENTORY_MOVEMENT_DEFINITIONS.map((item) => [item.type, item.label])) as Record<
    InventoryMovementType,
    string
  >;

export const INVENTORY_MOVEMENT_DIRECTION_MAP: Record<InventoryMovementType, InventoryMovementDirection | null> =
  Object.fromEntries(INVENTORY_MOVEMENT_DEFINITIONS.map((item) => [item.type, item.direction])) as Record<
    InventoryMovementType,
    InventoryMovementDirection | null
  >;

export function getInventoryMovementLabel(type: string) {
  return INVENTORY_MOVEMENT_LABEL_MAP[type as InventoryMovementType] || type;
}
