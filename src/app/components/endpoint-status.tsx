"use client";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

interface EndpointDef {
	label: string;
	path: string;
	method: "GET" | "POST";
	group: string;
}

const endpoints: EndpointDef[] = [
	// Slides
	{ label: "Folien generieren", path: "/api/slides", method: "POST", group: "Präsentation" },
	{
		label: "Folien-Status",
		path: "/api/slides/status?courseId=test",
		method: "GET",
		group: "Präsentation",
	},

	// Recording
	{ label: "Aufnahme starten", path: "/api/recording/start", method: "POST", group: "Aufnahme" },
	{ label: "Aufnahme stoppen", path: "/api/recording/stop", method: "POST", group: "Aufnahme" },
	{ label: "Aufnahme-Status", path: "/api/recording/status", method: "GET", group: "Aufnahme" },
	{ label: "Aufnahmen auflisten", path: "/api/recording/list", method: "GET", group: "Aufnahme" },

	// Playback
	{
		label: "Wiedergabe starten",
		path: "/api/recording/playback/play",
		method: "POST",
		group: "Wiedergabe",
	},
	{
		label: "Wiedergabe stoppen",
		path: "/api/recording/playback/stop",
		method: "POST",
		group: "Wiedergabe",
	},
	{
		label: "Zurückspulen",
		path: "/api/recording/playback/rewind",
		method: "POST",
		group: "Wiedergabe",
	},
	{
		label: "Vorspulen",
		path: "/api/recording/playback/forward",
		method: "POST",
		group: "Wiedergabe",
	},
];

type Status = "prüfe" | "erreichbar" | "fehler";

interface EndpointResult {
	status: Status;
	code?: number;
}

/**
 * For GET endpoints: fetch and check for a non-5xx response.
 * For POST endpoints: send a HEAD request — a 405 (Method Not Allowed)
 * confirms the route exists and is reachable.
 */
async function checkEndpoint(ep: EndpointDef): Promise<EndpointResult> {
	try {
		const res = await fetch(ep.path, {
			method: ep.method === "GET" ? "GET" : "HEAD",
			cache: "no-store",
		});
		// For GET: 2xx/4xx = reachable; for HEAD on POST routes: 405 = reachable
		const ok = res.status < 500;
		return { status: ok ? "erreichbar" : "fehler", code: res.status };
	} catch {
		return { status: "fehler" };
	}
}

export function EndpointStatus() {
	const [results, setResults] = useState<Map<string, EndpointResult>>(new Map());

	useEffect(() => {
		let cancelled = false;

		async function run() {
			const entries = await Promise.all(
				endpoints.map(async (ep) => {
					const result = await checkEndpoint(ep);
					return [ep.path, result] as const;
				}),
			);
			if (!cancelled) {
				setResults(new Map(entries));
			}
		}

		run();
		return () => {
			cancelled = true;
		};
	}, []);

	const groups = [...new Set(endpoints.map((ep) => ep.group))];

	return (
		<>
			{groups.map((group) => (
				<div key={group}>
					<Typography variant="subtitle1" sx={{ mt: 2, mb: 0.5, fontWeight: 600 }}>
						{group}
					</Typography>
					<TableContainer component={Paper}>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell sx={{ fontWeight: 600 }}>Endpunkt</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Methode</TableCell>
									<TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{endpoints
									.filter((ep) => ep.group === group)
									.map((ep) => {
										const r = results.get(ep.path);
										const status: Status = r?.status ?? "prüfe";
										return (
											<TableRow key={ep.path}>
												<TableCell>{ep.label}</TableCell>
												<TableCell>{ep.method}</TableCell>
												<TableCell>
													<Chip
														label={
															status === "prüfe"
																? "Prüfe…"
																: status === "erreichbar"
																	? `Erreichbar${r?.code ? ` (${r.code})` : ""}`
																	: `Fehler${r?.code ? ` (${r.code})` : ""}`
														}
														color={
															status === "prüfe"
																? "default"
																: status === "erreichbar"
																	? "success"
																	: "error"
														}
														size="small"
													/>
												</TableCell>
											</TableRow>
										);
									})}
							</TableBody>
						</Table>
					</TableContainer>
				</div>
			))}
		</>
	);
}
