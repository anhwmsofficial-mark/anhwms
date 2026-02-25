export const ORDER_STATE_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['APPROVED', 'CANCELLED', 'FAILED'],
  APPROVED: ['ALLOCATED', 'CANCELLED', 'on_hold'],
  ALLOCATED: ['PICKED', 'CANCELLED', 'on_hold'],
  PICKED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURN_REQ'],
  DELIVERED: ['RETURN_REQ'],
  CANCELLED: [],
  FAILED: ['CREATED'],
  SYNCED: ['APPROVED', 'CANCELLED'],
  PUSHED: ['SYNCED', 'FAILED'],
};

export function canTransitionOrderStatus(currentStatus: string, nextStatus: string): boolean {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  const allowedNext = ORDER_STATE_TRANSITIONS[currentStatus] || [];
  return allowedNext.includes(nextStatus);
}
