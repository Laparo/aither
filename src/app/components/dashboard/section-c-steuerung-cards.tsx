"use client";

import { MONITORED_ENDPOINTS } from "@/app/components/endpoint-config";
import { type EndpointResult, checkEndpoint } from "@/app/components/endpoint-status";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";

function getInitialState(): Map<string, EndpointResult> {
	return new Map(MONITORED_ENDPOINTS.map((endpoint) => [endpoint.path, { status: "prüfe" }]));
}

function getStatusLabel(status: string): string {
	switch (status) {
		case "erreichbar":
			return "Erreichbar";
		case "fehler":
			return "Fehler";
		default:
			return "Prüfe…";
	}
}

function getStatusColor(status: string): "success" | "error" | "default" {
	switch (status) {
		case "erreichbar":
			return "success";
		case "fehler":
			return "error";
		default:
			return "default";
	}
}

function getOverallStatus(results: Map<string, EndpointResult>): {
	label: string;
	color: "success" | "error" | "default";
} {
	const statuses = [...results.values()].map((r) => r.status);
	if (statuses.every((s) => s === "prüfe")) {
		return { label: "Prüfe…", color: "default" };
	}
	if (statuses.some((s) => s === "fehler")) {
		return { label: "Beeinträchtigt", color: "error" };
	}
	if (statuses.every((s) => s === "erreichbar")) {
		return { label: "Alle Dienste erreichbar", color: "success" };
	}
	return { label: "Prüfe…", color: "default" };
}

export function SteuerungCards() {
	const [results, setResults] = useState<Map<string, EndpointResult>>(getInitialState);
	const [lastChecked, setLastChecked] = useState<Date | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const runChecks = useCallback(async () => {
		const entries = await Promise.all(
			MONITORED_ENDPOINTS.map(async (endpoint) => {
				const result = await checkEndpoint(endpoint);
				return [endpoint.path, result] as const;
			}),
		);
		return new Map(entries);
	}, []);

	useEffect(() => {
		let cancelled = false;

		const run = async () => {
			const newResults = await runChecks();
			if (!cancelled) {
				setResults(newResults);
				setLastChecked(new Date());
			}
		};

		void run();
		const timer = setInterval(() => {
			void run();
		}, 10_000);

		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [runChecks]);

	const handleRefresh = async () => {
		setRefreshing(true);
		setErrorMessage(null);
		try {
			const newResults = await runChecks();
			setResults(newResults);
			setLastChecked(new Date());
		} catch (err) {
			console.error("Systemstatus-Aktualisierung fehlgeschlagen", err);
			setErrorMessage("Systemstatus-Aktualisierung fehlgeschlagen");
		} finally {
			setRefreshing(false);
		}
	};

	const overall = getOverallStatus(results);

	// Group endpoints by their group property
	const groups = new Map<string, typeof MONITORED_ENDPOINTS>();
	for (const ep of MONITORED_ENDPOINTS) {
		const list = groups.get(ep.group) ?? [];
		list.push(ep);
		groups.set(ep.group, list);
	}

	return (
		<Card data-testid="steuerung-cards">
			<CardContent>
				<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
					<Typography variant="h6">Systemstatus</Typography>
					<Button
						size="small"
						onClick={handleRefresh}
						disabled={refreshing}
						aria-label="Aktualisieren"
					>
						{refreshing ? "Aktualisiere…" : "Aktualisieren"}
					</Button>
				</Stack>

				<Divider sx={{ mb: 2 }} />

				{errorMessage && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{errorMessage}
					</Alert>
				)}

				<Box sx={{ mb: 2 }}>
					<Typography variant="body2" component="span" sx={{ fontWeight: 600, mr: 1 }}>
						Gesamtstatus:
					</Typography>
					<Chip label={overall.label} color={overall.color} size="small" />
				</Box>

				<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 2 }}>
					<Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
						Dienste:
					</Typography>
					{[...groups.entries()].map(([groupName, endpoints]) => {
						const statuses = endpoints.map((ep) => results.get(ep.path)?.status ?? "prüfe");
						const hasError = statuses.some((s) => s === "fehler");
						const allOk = statuses.every((s) => s === "erreichbar");
						const status = hasError ? "fehler" : allOk ? "erreichbar" : "prüfe";
						const chipLabel = `${groupName}: ${getStatusLabel(status)}`;
						const tooltip = endpoints
							.map((ep) => {
								const r = results.get(ep.path);
								const code = r?.code ? ` (HTTP ${r.code})` : "";
								return `${ep.label}: ${getStatusLabel(r?.status ?? "prüfe")}${code}`;
							})
							.join("\n");

						return (
							<Tooltip
								key={groupName}
								title={<span style={{ whiteSpace: "pre-line" }}>{tooltip}</span>}
							>
								<Chip label={chipLabel} color={getStatusColor(status)} size="small" />
							</Tooltip>
						);
					})}
				</Box>

				<Divider sx={{ mb: 2 }} />

				<Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.5 }}>
					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						Version:
					</Typography>
					<Typography variant="caption">{process.env.NEXT_PUBLIC_APP_VERSION ?? "–"}</Typography>

					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						Commit:
					</Typography>
					<Typography variant="caption" sx={{ fontFamily: "monospace" }}>
						{process.env.NEXT_PUBLIC_GIT_COMMIT ?? "–"}
					</Typography>

					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						Umgebung:
					</Typography>
					<Typography variant="caption">{process.env.NODE_ENV ?? "–"}</Typography>

					{lastChecked && (
						<>
							<Typography variant="caption" sx={{ color: "text.secondary" }}>
								Zuletzt aktualisiert:
							</Typography>
							<Typography variant="caption">{lastChecked.toLocaleTimeString("de-DE")}</Typography>
						</>
					)}
				</Box>
			</CardContent>
		</Card>
	);
}
