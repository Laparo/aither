export interface EndpointDef {
	label: string;
	path: string;
	method: "GET" | "POST";
	group: string;
	probeMethod?: "HEAD" | "GET";
	fallbackToGetOnHeadUnsupported?: boolean;
}

export const MONITORED_ENDPOINTS: EndpointDef[] = [
	{ label: "Folien generieren", path: "/api/slides", method: "POST", group: "Präsentation" },
	{ label: "Folien-Status", path: "/api/slides/status", method: "GET", group: "Präsentation" },
	{ label: "Aufnahme starten", path: "/api/recording/start", method: "POST", group: "Aufnahme" },
	{ label: "Aufnahme stoppen", path: "/api/recording/stop", method: "POST", group: "Aufnahme" },
	{ label: "Aufnahme-Status", path: "/api/recording/status", method: "GET", group: "Aufnahme" },
	{ label: "Aufnahmen auflisten", path: "/api/recording/list", method: "GET", group: "Aufnahme" },
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
