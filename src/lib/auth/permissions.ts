// Minimal permission definitions and role mapping for Hemera
// This file provides a small, explicit permission map used by service endpoints.

export type Permission =
  | 'read:courses'
  | 'read:bookings'
  | 'read:participations'
  | 'write:participation-results'
  | 'read:users'
  | 'manage:courses'
  | 'manage:users'
  | string;

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  ApiClient = 'api-client',
}

export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.Admin]: [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
    'read:users',
    'manage:courses',
    'manage:users',
  ],
  [UserRole.User]: [
    'read:courses',
    'read:participations',
  ],
  [UserRole.ApiClient]: [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
    // Allow limited user lookup for correlation without broader user management
    'read:users',
  ],
};

export function hasPermission(role: UserRole | string, permission: Permission): boolean {
  const perms = rolePermissions[role as UserRole] || [];
  return perms.includes(permission) || false;
}

export default {
  UserRole,
  rolePermissions,
  hasPermission,
};
