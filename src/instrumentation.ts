// ---------------------------------------------------------------------------
// Next.js Instrumentation for Rollbar
// Ported from hemera — registers process-level error handlers
// ---------------------------------------------------------------------------

import { checkHemeraHealth } from "./lib/hemera/health-check";
import { serverInstance } from "./lib/monitoring/rollbar-official";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		process.on("uncaughtException", (error) => {
			serverInstance.error("Uncaught Exception", {
				error: error.message,
				stack: error.stack,
				timestamp: new Date().toISOString(),
			});
		});

		process.on("unhandledRejection", (reason, _promise) => {
			serverInstance.error("Unhandled Promise Rejection", {
				reason: reason instanceof Error ? reason.message : String(reason),
				stack: reason instanceof Error ? reason.stack : undefined,
				timestamp: new Date().toISOString(),
			});
		});

		// Verify Hemera API connectivity (logs warning in dev, reports to Rollbar in prod)
		try {
			await checkHemeraHealth();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn("Hemera health check failed during startup:", msg);
			if (process.env.NODE_ENV === "production") {
				serverInstance.warning("Hemera health check failed during startup", {
					error: msg,
					timestamp: new Date().toISOString(),
				});
			}
		}
	}
}
