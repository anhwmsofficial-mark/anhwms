export const ROLES = {
  ADMIN: 'admin',      // Super Admin: All access
  MANAGER: 'manager',  // General Admin: Can manage resources, but restricted from sensitive settings
  OPERATOR: 'operator',// Operations: Can execute tasks (Inbound/Outbound), but cannot change settings
  VIEWER: 'viewer'     // Read-only
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.ADMIN]: 100,
  [ROLES.MANAGER]: 50,
  [ROLES.OPERATOR]: 20,
  [ROLES.VIEWER]: 10
}

/**
 * Check if the user's role has sufficient permission for the required role.
 * Example: hasPermission('admin', 'manager') -> true
 * Example: hasPermission('operator', 'manager') -> false
 */
export function hasPermission(userRole: string | null | undefined, requiredRole: Role): boolean {
  if (!userRole) return false
  
  // Normalize role string just in case
  const role = userRole.toLowerCase() as Role
  
  const userLevel = ROLE_HIERARCHY[role] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole]
  
  return userLevel >= requiredLevel
}

/**
 * Returns true if the user can perform sensitive admin actions
 * (e.g. deleting users, changing org settings, viewing audit logs)
 */
export function canManageSystem(userRole: string | null | undefined): boolean {
  return hasPermission(userRole, ROLES.MANAGER)
}

/**
 * Returns true if the user can perform operational tasks
 * (e.g. confirming inbound, shipping orders)
 */
export function canOperate(userRole: string | null | undefined): boolean {
  return hasPermission(userRole, ROLES.OPERATOR)
}

/**
 * Returns true if the user is strictly a Super Admin
 */
export function isSuperAdmin(userRole: string | null | undefined): boolean {
  return hasPermission(userRole, ROLES.ADMIN)
}
