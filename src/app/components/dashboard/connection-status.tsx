"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

interface ConnectionAttempt {
	timestamp: Date;
	success: boolean;
	error?: string;
}

interface ConnectionStatusProps {
	/** URL to probe for connectivity (e.g. /api/hemera-health) */
	probeUrl: string;
	/** Maximum number of retries before giving up */
	maxRetries?: number;
	/** Interval between retries in ms */
	retryInterval?: number;
}

const CONNECTION_PROBE_TIMEOUT_MS = 30_000;

export function ConnectionStatus({
	probeUrl,
	maxRetries = 10,
	retryInterval = 5_000,
}: ConnectionStatusProps) {
	const [attempts, setAttempts] = useState<ConnectionAttempt[]>([]);
	const [connected, setConnected] = useState(false);
	const [gaveUp, setGaveUp] = useState(false);
	const retriesRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelledRef = useRef(false);

	const probe = useCallback(async () => {
		const controller = new AbortController();
		const timeoutHandle = setTimeout(() => controller.abort(), CONNECTION_PROBE_TIMEOUT_MS);
		try {
			const res = await fetch(probeUrl, {
				method: "GET",
				cache: "no-store",
				signal: controller.signal,
			});
			clearTimeout(timeoutHandle);
			if (cancelledRef.current) return;

			let ok = res.ok || res.status === 401;
			let error: string | undefined;

			if (ok && res.headers.get("content-type")?.includes("application/json")) {
				try {
					const payload = (await res.json()) as { reachable?: boolean; error?: string };
					if (payload.reachable === false) {
						ok = false;
						error = payload.error ?? "Hemera nicht erreichbar";
					}
				} catch {
					// Ignore JSON parse issues and fall back to status-based check
				}
			}

			if (!ok && !error) {
				error = `HTTP ${res.status}`;
			}

			setAttempts((prev) => [
				...prev,
				{ timestamp: new Date(), success: ok, error: ok ? undefined : error },
			]);
			if (ok) {
				if (cancelledRef.current) return;
				setConnected(true);
				return;
			}
		} catch (err) {
			clearTimeout(timeoutHandle);
			if (cancelledRef.current) return;
			const message = err instanceof Error ? err.message : "Netzwerkfehler";
			setAttempts((prev) => [...prev, { timestamp: new Date(), success: false, error: message }]);
		}

		if (cancelledRef.current) return;
		retriesRef.current += 1;
		if (retriesRef.current >= maxRetries) {
			if (cancelledRef.current) return;
			setGaveUp(true);
		} else {
			timerRef.current = setTimeout(() => {
				if (cancelledRef.current) return;
				void probe();
			}, retryInterval);
		}
	}, [probeUrl, maxRetries, retryInterval]);

	useEffect(() => {
		cancelledRef.current = false;
		void probe();
		return () => {
			cancelledRef.current = true;
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [probe]);

	// Connected — trigger page reload to re-fetch SSR data
	useEffect(() => {
		if (connected) {
			const reloadTimer = setTimeout(() => {
				window.location.reload();
			}, 1_000);
			return () => clearTimeout(reloadTimer);
		}
	}, [connected]);

	if (connected) {
		return (
			<Alert severity="success" data-testid="connection-established" sx={{ mt: 3, mb: 3 }}>
				Verbindung hergestellt — Seite wird neu geladen…
			</Alert>
		);
	}

	return (
		<Alert
			severity="warning"
			data-testid="connection-status"
			icon={false}
			sx={{
				mt: 3,
				mb: 3,
				bgcolor: "common.white",
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
				{!gaveUp && <CircularProgress size={18} color="warning" />}
				<Typography variant="body1" sx={{ fontWeight: 600 }}>
					{gaveUp
						? "Kursdaten konnten nicht geladen werden."
						: "Verbindung zu Hemera wird hergestellt…"}
				</Typography>
			</Box>

			<Box
				component="ul"
				sx={{
					m: 0,
					pl: 2.5,
					listStyle: "none",
					maxHeight: 160,
					overflowY: "auto",
					"& li": { py: 0.25, display: "flex", alignItems: "center", gap: 1 },
				}}
			>
				{attempts.map((attempt, i) => (
					<li key={`${attempt.timestamp.getTime()}-${i}`}>
						<Box
							component="span"
							sx={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								bgcolor: attempt.success ? "success.main" : "error.main",
								flexShrink: 0,
							}}
						/>
						<Typography variant="caption" sx={{ color: "text.secondary" }}>
							{attempt.timestamp.toLocaleTimeString("de-DE")}
						</Typography>
						<Typography variant="caption">
							{attempt.success
								? "Verbunden"
								: `Fehlgeschlagen${attempt.error ? ` — ${attempt.error}` : ""}`}
						</Typography>
					</li>
				))}
			</Box>

			{!gaveUp && (
				<Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
					Versuch {Math.min(retriesRef.current + 1, maxRetries)} von {maxRetries} — nächster Versuch
					in {retryInterval / 1_000}s
				</Typography>
			)}
		</Alert>
	);
}
