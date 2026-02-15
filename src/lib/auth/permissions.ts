// ---------------------------------------------------------------------------
// Permission Definitions and RBAC Logic
// Centralized role-based access control for service endpoints
// ---------------------------------------------------------------------------

export type Permission =
	| "read:courses"
	| "read:bookings"
	| "read:participations"
	| "write:participation-results"
	| "read:users"
	| "manage:courses"
	| "manage:users";

// Consolidated role type - single source of truth
export type Role = "admin" | "api-client" | "instructor" | "participant";

// Centralized RBAC map
export const rolePermissions: Record<Role, Permission[]> = {
	admin: [
		"read:courses",
		"read:bookings",
		"read:participations",
		"write:participation-results",
		"read:users",
		"manage:courses",
		"manage:users",
	],
	"api-client": [
		"read:courses",
		"read:bookings",
		"read:participations",
		"write:participation-results",
	],
	instructor: ["read:courses", "read:participations"],
	participant: [],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
	return !!role && rolePermissions[role]?.includes(permission) === true;
}
