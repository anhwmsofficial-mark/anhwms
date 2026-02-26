export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer' | 'partner' | 'staff';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  manager: [
    'view:dashboard',
    'manage:products',
    'manage:inventory',
    'manage:orders',
    'read:orders',
    'view:customers',
    'view:reports',
    'inventory:count',
    'inventory:adjust',
  ],
  operator: [
    'view:dashboard',
    'view:products',
    'read:orders',
    'update:order_status',
    'inventory:count',
    'inventory:adjust',
  ],
  viewer: ['view:dashboard', 'view:products', 'read:orders'],
  partner: ['view:own_dashboard', 'view:own_products', 'view:own_orders', 'create:own_orders', 'view:own_inventory'],
  staff: ['view:dashboard', 'view:products', 'read:orders', 'inventory:count'],
};

export function hasRolePermission(role: UserRole, permission: string) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (permissions.includes('*')) return true;
  return permissions.some((p) => {
    if (p === permission) return true;
    if (p.endsWith(':*')) {
      const scope = p.split(':')[0];
      return permission.startsWith(`${scope}:`);
    }
    return false;
  });
}
