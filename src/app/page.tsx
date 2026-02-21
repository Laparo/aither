import { HemeraClient } from "@/lib/hemera/client";
import { type ServiceCourse, ServiceCoursesResponseSchema } from "@/lib/hemera/schemas";
import { getTokenManager } from "@/lib/hemera/token-manager";

const levelLabels: Record<string, string> = {
	BEGINNER: "Grundkurs",
	INTERMEDIATE: "Fortgeschritten",
	ADVANCED: "Masterclass",
};

function formatDate(iso: string | null): string {
	if (!iso) return "–";
	return new Date(iso).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

async function fetchCourses(): Promise<ServiceCourse[]> {
	try {
		const baseUrl = process.env.HEMERA_API_BASE_URL;
		if (!baseUrl) {
			console.error("HEMERA_API_BASE_URL nicht gesetzt");
			return [];
		}
		const tokenManager = getTokenManager();
		const client = new HemeraClient({
			baseUrl,
			getToken: () => tokenManager.getToken(),
			rateLimit: 2,
			maxRetries: 3,
		});
		const response = await client.get("/api/service/courses", ServiceCoursesResponseSchema);
		return response.data;
	} catch (error) {
		console.error("Fehler beim Laden der Kurse:", error);
		return [];
	}
}

export default async function Home() {
	const courses = await fetchCourses();

	return (
		<main
			style={{
				maxWidth: 900,
				margin: "0 auto",
				padding: "2rem",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h1>Aither</h1>
			<p>Hemera Academy Integration</p>

			<h2 style={{ marginTop: "2rem" }}>Kurse ({courses.length})</h2>

			{courses.length === 0 ? (
				<p style={{ color: "#888" }}>Keine Kurse verfügbar oder API nicht erreichbar.</p>
			) : (
				<table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
					<thead>
						<tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
							<th style={{ padding: "0.5rem" }}>Kurs</th>
							<th style={{ padding: "0.5rem" }}>Level</th>
							<th style={{ padding: "0.5rem" }}>Startdatum</th>
							<th style={{ padding: "0.5rem", textAlign: "right" }}>Teilnehmer</th>
						</tr>
					</thead>
					<tbody>
						{courses.map((course) => (
							<tr key={course.id} style={{ borderBottom: "1px solid #ddd" }}>
								<td style={{ padding: "0.5rem" }}>{course.title}</td>
								<td style={{ padding: "0.5rem" }}>{levelLabels[course.level] ?? course.level}</td>
								<td style={{ padding: "0.5rem" }}>{formatDate(course.startDate)}</td>
								<td style={{ padding: "0.5rem", textAlign: "right" }}>{course.participantCount}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</main>
	);
}
