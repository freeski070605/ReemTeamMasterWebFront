export const USER_ROLES = ['user', 'moderator', 'finance', 'admin', 'superadmin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const isUserRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
};

export const resolveUserRole = (role: unknown, legacyIsAdmin: boolean = false): UserRole => {
  if (isUserRole(role)) {
    return role;
  }
  return legacyIsAdmin ? 'admin' : 'user';
};

export const hasAdminTabAccess = (role: UserRole): boolean => role !== 'user';

