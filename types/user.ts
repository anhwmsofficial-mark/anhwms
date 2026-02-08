export const USER_ROLES = ['admin', 'manager', 'operator', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type PermissionSet = {
  canAccessAdmin: boolean;
  canAccessDashboard: boolean;
  canManageUsers: boolean;
  canManageInventory: boolean;
  canManageOrders: boolean;
};
