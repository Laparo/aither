"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { useEffect, useState } from "react";

export function CameraSnapshot() {
	const [src, setSrc] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let objectUrl: string | null = null;
		let cancelled = false;

		const url = `/api/recording/snapshot?t=${Date.now()}`;
		fetch(url)
			.then(async (res) => {
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
				return res.blob();
			})
			.then((blob) => {
				if (cancelled) return;
				objectUrl = URL.createObjectURL(blob);
				setSrc(objectUrl);
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
				}
			});

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, []);

	if (error) {
		return (
			<Alert severity="error" data-testid="camera-error">
				Kamera nicht erreichbar: {error}
			</Alert>
		);
	}

	if (!src) {
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
