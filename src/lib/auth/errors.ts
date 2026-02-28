export function isAuthError(err: unknown): boolean {
	if (!err) return false;
	const e = err as {
		status?: number;
		statusCode?: number;
		httpStatus?: number;
		message?: string;
		error?: string;
		code?: string;
	};
	// Common shapes: { status }, Error with httpStatus, or custom error codes
	const status = e?.status ?? e?.statusCode ?? e?.httpStatus;
	if (typeof status === "number") {
		return status === 401 || status === 403;
	}
	// Fallback: check message-like fields
	const msg = e?.message ?? e?.error ?? e?.code ?? "";
	if (typeof msg === "string") {
		// Match whole-word '401' or '403' or words like 'unauthorized'/'forbidden'
		return /\b(?:401|403|unauthorized|unauthorised|forbidden)\b/i.test(msg);
	}
	return false;
}
