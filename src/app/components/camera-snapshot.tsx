"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useCallback, useEffect, useState } from "react";

export interface ReconnectState {
	src: string | null;
	error: string | null;
	loading: boolean;
	attempt: number;
}

export function getReconnectState(currentAttempt: number): ReconnectState {
	return {
		src: null,
		error: null,
		loading: true,
		attempt: currentAttempt + 1,
	};
}

export function buildSnapshotUrl(now: () => number = Date.now): string {
	return `/api/recording/snapshot?t=${now()}`;
}

type ProbeFetch = (input: string) => Promise<Response>;
type CreateObjectUrl = (blob: Blob) => string;
type RevokeObjectUrl = (url: string) => void;

export interface SnapshotLoadCallbacks {
	onSuccess: (objectUrl: string) => void;
	onError: (message: string) => void;
	onFinally: () => void;
	isCancelled: () => boolean;
}

export async function runSnapshotLoadCycle(
	url: string,
	fetchImpl: ProbeFetch,
	createObjectUrl: CreateObjectUrl,
	revokeObjectUrl: RevokeObjectUrl,
	callbacks: SnapshotLoadCallbacks,
): Promise<void> {
	let objectUrl: string | null = null;
	try {
		const res = await fetchImpl(url);
		if (!res.ok) {
			let msg = `HTTP ${res.status} ${res.statusText}`;
			try {
				const body = await res.json();
				if (body.error) msg = body.error;
			} catch {
				// response not JSON — use status text
			}
			throw new Error(msg);
		}

		const blob = await res.blob();
		objectUrl = createObjectUrl(blob);

		if (callbacks.isCancelled()) {
			revokeObjectUrl(objectUrl);
			return;
		}

		callbacks.onSuccess(objectUrl);
	} catch (err) {
		if (!callbacks.isCancelled()) {
			callbacks.onError(err instanceof Error ? err.message : String(err));
		}
	} finally {
		if (!callbacks.isCancelled()) {
			callbacks.onFinally();
		}
	}
}

export function CameraSnapshot() {
	const [src, setSrc] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [attempt, setAttempt] = useState(0);

	const reconnect = useCallback(() => {
		setAttempt((a) => {
			const next = getReconnectState(a);
			setSrc(next.src);
			setError(next.error);
			setLoading(next.loading);
			return next.attempt;
		});
	}, []);

	useEffect(() => {
		let objectUrl: string | null = null;
		let cancelled = false;

		const url = buildSnapshotUrl();
		void runSnapshotLoadCycle(url, (input) => fetch(input), URL.createObjectURL, URL.revokeObjectURL, {
			onSuccess: (createdUrl) => {
				objectUrl = createdUrl;
				setSrc(createdUrl);
				setError(null);
			},
			onError: (message) => {
				setError(message);
			},
			onFinally: () => {
				setLoading(false);
			},
			isCancelled: () => cancelled,
		});

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [attempt]);

	if (error) {
		return (
			<Box>
				<Alert severity="error" data-testid="camera-error" sx={{ mb: 1 }}>
					Kamera nicht erreichbar: {error}
				</Alert>
				<Button variant="outlined" size="small" onClick={reconnect} data-testid="camera-reconnect">
					Neu verbinden
				</Button>
			</Box>
		);
	}

	if (loading || !src) {
		return <Box sx={{ color: "text.secondary", py: 2 }}>Video wird aufgenommen…</Box>;
	}

	return (
		<Box
			component="video"
			src={src}
			autoPlay
			muted
			loop
			controls
			data-testid="camera-clip"
			sx={{ maxWidth: "100%", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
		/>
	);
}
