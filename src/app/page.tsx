import { HemeraClient } from "@/lib/hemera/client";
import {
	type ServiceCourseDetail,
	ServiceCourseDetailResponseSchema,
	ServiceCoursesResponseSchema,
} from "@/lib/hemera/schemas";
import { getTokenManager } from "@/lib/hemera/token-manager";
import { selectNextCourse } from "@/lib/sync/course-selector";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

const levelLabels: Record<string, string> = {
	BEGINNER: "Grundkurs",
	INTERMEDIATE: "Fortgeschritten",
	ADVANCED: "Masterclass",
};

function formatDate(iso: string | null): string {
	if (!iso) return "–";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "–";
	return d.toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function dash(value: string | null | undefined): string {
	return value ?? "–";
}

/** Create an authenticated HemeraClient for SSR data fetching. */
function createClient(): HemeraClient | null {
	const baseUrl = process.env.HEMERA_API_BASE_URL;
	if (!baseUrl) {
		console.error("HEMERA_API_BASE_URL nicht gesetzt");
		return null;
	}
	const tokenManager = getTokenManager();
	return new HemeraClient({
		baseUrl,
		getToken: () => tokenManager.getToken(),
		rateLimit: 2,
		maxRetries: 3,
	});
}

/** Fetch next course with participants, or null on failure. */
async function fetchNextCourseDetail(): Promise<ServiceCourseDetail | null> {
	const client = createClient();
	if (!client) return null;

	const coursesResponse = await client.get("/api/service/courses", ServiceCoursesResponseSchema);
	if (!coursesResponse.data) return null;
	const nextCourse = selectNextCourse(coursesResponse.data);
	if (!nextCourse) return null;

	const detailResponse = await client.get(
		`/api/service/courses/${nextCourse.id}`,
		ServiceCourseDetailResponseSchema,
	);
	return detailResponse.data;
}

export default async function Home() {
	let courseDetail: ServiceCourseDetail | null = null;
	let fetchError = false;

	try {
		courseDetail = await fetchNextCourseDetail();
	} catch (error) {
		console.error("Fehler beim Laden der Kursdaten:", error);
		fetchError = true;
	}

	return (
		<Box component="main" sx={{ maxWidth: 960, mx: "auto", p: 3 }}>
			<Typography variant="h3" component="h1" gutterBottom>
				Aither
			</Typography>
			<Typography variant="subtitle1" color="text.secondary" gutterBottom>
				Hemera Academy Integration
			</Typography>

			{/* --- Error Fallback (T024) --- */}
			{fetchError && (
				<Alert severity="warning" data-testid="homepage-error-fallback" sx={{ mt: 3 }}>
					Kursdaten konnten nicht geladen werden.
				</Alert>
			)}

			{/* --- No Upcoming Course --- */}
			{!fetchError && !courseDetail && (
				<Alert severity="info" data-testid="no-upcoming-course" sx={{ mt: 3 }}>
					Kein kommender Kurs verfügbar.
				</Alert>
			)}

			{/* --- Course Details Table (T022) --- */}
			{courseDetail && (
				<>
					<Typography variant="h5" sx={{ mt: 4, mb: 1 }}>
						Nächster Kurs
					</Typography>
					<TableContainer component={Paper} data-testid="course-details-table">
						<Table size="small">
							<TableBody>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600, width: "30%" }}>
										Kurs
									</TableCell>
									<TableCell>{courseDetail.title}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Level
									</TableCell>
									<TableCell>{levelLabels[courseDetail.level] ?? courseDetail.level}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Startdatum
									</TableCell>
									<TableCell>{formatDate(courseDetail.startDate)}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Enddatum
									</TableCell>
									<TableCell>{formatDate(courseDetail.endDate)}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Teilnehmerzahl
									</TableCell>
									<TableCell>{courseDetail.participants.length}</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</TableContainer>

					{/* --- Participants Table (T023) --- */}
					<Typography variant="h5" sx={{ mt: 4, mb: 1 }}>
						Teilnehmer &amp; Vorbereitungen
					</Typography>
					{courseDetail.participants.length === 0 ? (
						<Typography color="text.secondary">Keine Teilnehmer.</Typography>
					) : (
						<TableContainer component={Paper} data-testid="participants-table">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Vorbereitungsabsicht</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Gewünschte Ergebnisse</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Vorgesetzten-Profil</TableCell>
										<TableCell sx={{ fontWeight: 600 }}>Vorbereitung abgeschlossen</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{courseDetail.participants.map((p) => (
										<TableRow key={p.participationId}>
											<TableCell>{dash(p.name)}</TableCell>
											<TableCell sx={{ wordBreak: "break-word" }}>
												{dash(p.preparationIntent)}
											</TableCell>
											<TableCell sx={{ wordBreak: "break-word" }}>
												{dash(p.desiredResults)}
											</TableCell>
											<TableCell sx={{ wordBreak: "break-word" }}>
												{dash(p.lineManagerProfile)}
											</TableCell>
											<TableCell>{p.preparationCompletedAt !== null ? "Ja" : "–"}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</>
			)}
		</Box>
	);
}
