// ---------------------------------------------------------------------------
// Service API Authorization Guard
// Provides consolidated RBAC logic for service endpoints
// ---------------------------------------------------------------------------

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { Permission, Role } from './permissions';
import { hasPermission } from './permissions';
import { createErrorResponse } from '../utils/api-error';

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
    return createErrorResponse(401, 'Unauthorized', 'Authentication required');
  }

  const role = await getUserRole(userId);

  if (!hasPermission(role, requiredPermission)) {
    return createErrorResponse(403, 'Forbidden', 'Insufficient permissions');
  }

  return null; // Auth successful
}
