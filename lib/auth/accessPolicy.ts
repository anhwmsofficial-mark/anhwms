export type AccessProfile = {
  role?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  locked_until?: string | null;
  can_access_admin?: boolean | null;
};

export function isActiveProfile(profile?: AccessProfile | null) {
  if (!profile) return false;
  const status = String(profile.status || '').toLowerCase();
  const isDeleted = !!profile.deleted_at;
  const isLocked =
    !!profile.locked_until && new Date(profile.locked_until).getTime() > Date.now();
  return status === 'active' && !isDeleted && !isLocked;
}

export function canAccessAdmin(profile?: AccessProfile | null) {
  if (!profile) return false;
  if (!isActiveProfile(profile)) return false;
  return Boolean(profile.can_access_admin) || profile.role === 'admin';
}
