"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useState } from "react";

type State = "idle" | "running" | "success" | "error";

interface Result {
	slidesGenerated?: number;
	courseTitle?: string;
	error?: string;
}

export function SlideGenerateButton() {
	const [state, setState] = useState<State>("idle");
	const [result, setResult] = useState<Result | null>(null);

	async function handleGenerate() {
		setState("running");
		setResult(null);

		try {
			const res = await fetch("/api/slides", { method: "POST" });
			const body = await res.json();

			if (res.ok) {
				setState("success");
				setResult({ slidesGenerated: body.slidesGenerated, courseTitle: body.courseTitle });
			} else {
				setState("error");
				setResult({ error: body.error ?? body.message ?? `HTTP ${res.status}` });
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
					{result.slidesGenerated} Folien für „{result.courseTitle}" generiert.
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
