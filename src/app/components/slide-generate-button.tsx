"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useRouter } from "next/navigation";
import { useState } from "react";

type State = "idle" | "running" | "success" | "error";

interface Result {
	slidesGenerated?: number;
	courseTitle?: string;
	error?: string;
}

export function SlideGenerateButton() {
	const router = useRouter();
	const [state, setState] = useState<State>("idle");
	const [result, setResult] = useState<Result | null>(null);

	async function handleGenerate() {
		setState("running");
		setResult(null);

		try {
			const res = await fetch("/api/slides", { method: "POST" });

			const text = await res.text();
			let body: Record<string, unknown> | null = null;
			const contentType = res.headers.get("content-type") ?? "";
			if (contentType.includes("application/json")) {
				try {
					body = JSON.parse(text);
				} catch {
					/* JSON parse failure handled below */
				}
			}

			if (!body) {
				setState("error");
				setResult({ error: text || `HTTP ${res.status}` });
				return;
			}

			if (res.ok) {
				setState("success");
				setResult({
					slidesGenerated: body.slidesGenerated as number | undefined,
					courseTitle: body.courseTitle as string | undefined,
				});
				router.refresh();
			} else {
				setState("error");
				setResult({
					error: (body.error as string) ?? (body.message as string) ?? `HTTP ${res.status}`,
				});
			}
		} catch (err) {
			setState("error");
			setResult({ error: err instanceof Error ? err.message : String(err) });
		}
	}

	return (
		<Box sx={{ mt: 1 }}>
			<Button
				variant="contained"
				size="small"
				onClick={handleGenerate}
				disabled={state === "running"}
				startIcon={state === "running" ? <CircularProgress size={16} color="inherit" /> : undefined}
			>
				{state === "running" ? "Generiert…" : "Folien generieren"}
			</Button>

			{state === "success" && result && (
				<Alert severity="success" sx={{ mt: 1 }}>
					{result.slidesGenerated ?? 0} Folien für „{result.courseTitle ?? "Unbekannt"}" generiert.
				</Alert>
			)}

			{state === "error" && result && (
				<Alert severity="error" sx={{ mt: 1 }}>
					Fehler: {result.error}
				</Alert>
			)}
		</Box>
	);
}
