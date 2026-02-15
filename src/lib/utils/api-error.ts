// ---------------------------------------------------------------------------
// API Error Response Utilities
// Provides consistent error response formatting across all API endpoints
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

/**
 * Create a consistent error response for API endpoints.
 *
 * @param status - HTTP status code
 * @param errorCode - Machine-readable error code (e.g., 'Unauthorized', 'Not Found')
 * @param message - Optional human-readable error message
 * @returns NextResponse with standardized error format
 */
export function createErrorResponse(
	status: number,
	errorCode: string,
	message?: string,
): NextResponse {
	return NextResponse.json({ error: errorCode, message }, { status });
}
