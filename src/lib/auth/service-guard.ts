// ---------------------------------------------------------------------------
// Service API Authorization Guard
// Provides consolidated RBAC logic for service endpoints
// ---------------------------------------------------------------------------

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { Permission } from './permissions';

// Fixed, centralized RBAC map
export type Role = 'admin' | 'api-client' | 'instructor' | 'participant';

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
    'manage:courses',
    'manage:users',
  ],
  'api-client': [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
  ],
  instructor: ['read:courses', 'read:participations'],
  participant: [],
};

/**
 * Check if a role has a specific permission.
 */
function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && rolePermissions[role]?.includes(permission) === true;
}

/**
 * Helper to create consistent error responses.
 */
function error(status: number, error: string, message?: string) {
  return NextResponse.json({ error, message }, { status });
}

/**
 * Get the user's role from Clerk session claims.
 */
async function getUserRole(userId: string): Promise<Role | null> {
  try {
    const { sessionClaims } = await auth();
    
    // Extract role from public metadata in session claims
    // Clerk stores custom data in publicMetadata
    const metadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
    const role = metadata?.role;
    
    if (!role || typeof role !== 'string') {
      return null;
    }
    
    // Validate that the role is one of our known roles
    if (['admin', 'api-client', 'instructor', 'participant'].includes(role)) {
      return role as Role;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
}

/**
 * Require service authentication and authorization for an API endpoint.
 * Returns null if authorized, or a NextResponse with error if not.
 * 
 * @param requiredPermission - The permission required to access the endpoint
 * @returns null if authorized, NextResponse with error otherwise
 */
export async function requireServiceAuth(requiredPermission: Permission): Promise<NextResponse | null> {
  const { userId } = await auth();

  if (!userId) {
    return error(401, 'Unauthorized', 'Authentication required');
  }

  const role = await getUserRole(userId);

  if (!hasPermission(role, requiredPermission)) {
    return error(403, 'Forbidden', 'Insufficient permissions');
  }

  return null; // Auth successful
}
