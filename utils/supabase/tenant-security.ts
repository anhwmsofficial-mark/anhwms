export function requireTenantId(orgId: string | null | undefined): string {
  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    throw new Error('Tenant ID (Organization ID) is required and cannot be empty.');
  }
  return orgId;
}
