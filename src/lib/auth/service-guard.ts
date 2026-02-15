// ---------------------------------------------------------------------------
// Service API Authorization Guard
// Provides consolidated RBAC logic for service endpoints
// ---------------------------------------------------------------------------

import { auth } from "@clerk/nextjs/server";
import type { NextResponse } from "next/server";
import { createErrorResponse } from "../utils/api-error";
import type { Permission, Role } from "./permissions";
import { hasPermission } from "./permissions";

/**
 * Get the user's role from Clerk session claims.
 */
function getUserRoleFromClaims(sessionClaims: unknown): Role | null {
	try {
		// Extract role from public metadata in session claims
		const claims = sessionClaims as { publicMetadata?: { role?: string } } | undefined;
		const metadata = claims?.publicMetadata;
		const role = metadata?.role;

		if (!role || typeof role !== "string") return null;

		if (["admin", "api-client", "instructor", "participant"].includes(role)) {
			return role as Role;
		}

		return null;
	} catch (error) {
		console.error("Failed to derive user role from session claims:", error);
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
export async function requireServiceAuth(
	requiredPermission: Permission,
): Promise<NextResponse | null> {
	const session = await auth();

	const userId = (session as { userId?: string })?.userId;
	const sessionClaims = (session as { sessionClaims?: unknown })?.sessionClaims;

	if (!userId) {
		return createErrorResponse(401, "Unauthorized", "Authentication required");
	}

	const role = getUserRoleFromClaims(sessionClaims);

	if (!hasPermission(role, requiredPermission)) {
		return createErrorResponse(403, "Forbidden", "Insufficient permissions");
	}

	return null; // Auth successful
}
