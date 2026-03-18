import fs from "node:fs/promises";
import path from "node:path";
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
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { CameraSnapshot } from "./components/camera-snapshot";
import { EndpointStatus } from "./components/endpoint-status";
import { SlideGenerateButton } from "./components/slide-generate-button";
import { SlideThumbnails } from "./components/slide-thumbnails";

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

interface SlideStatus {
	status: "generated" | "not-generated";
	slideCount: number;
	lastUpdated: string | null;
	files: string[];
}

async function fetchSlideStatus(courseId: string | null): Promise<SlideStatus> {
	const notGenerated: SlideStatus = {
		status: "not-generated",
		slideCount: 0,
		lastUpdated: null,
		files: [],
	};
	const outputDir = process.env.SLIDES_OUTPUT_DIR || "output/slides";
	if (!courseId || !/^[A-Za-z0-9_.-]+$/.test(courseId)) return notGenerated;

	const baseDir = path.resolve(process.cwd(), outputDir);
	const courseDir = path.resolve(baseDir, courseId);
	if (!courseDir.startsWith(baseDir + path.sep)) return notGenerated;

	try {
		const entries = await fs.readdir(courseDir);
		const htmlFiles = entries.filter((f) => f.endsWith(".html"));

		if (htmlFiles.length === 0) {
			return { status: "not-generated", slideCount: 0, lastUpdated: null, files: [] };
		}

		let latestMtime = 0;
		for (const file of htmlFiles) {
			const stat = await fs.stat(path.join(courseDir, file));
			if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
		}

		return {
			status: "generated",
			slideCount: htmlFiles.length,
			lastUpdated: new Date(latestMtime).toISOString(),
			files: htmlFiles.sort(),
		};
	} catch {
		return { status: "not-generated", slideCount: 0, lastUpdated: null, files: [] };
	}
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

	const slideStatus = await fetchSlideStatus(courseDetail?.id ?? null);

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

					{/* --- Slide Status --- */}
					<Typography variant="h5" sx={{ mt: 4, mb: 1 }}>
						Seminarmaterial
					</Typography>
					<TableContainer component={Paper} data-testid="slide-status-table">
						<Table size="small">
							<TableBody>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600, width: "30%" }}>
										Status
									</TableCell>
									<TableCell>
										<Chip
											label={slideStatus.status === "generated" ? "Generiert" : "Nicht generiert"}
											color={slideStatus.status === "generated" ? "success" : "default"}
											size="small"
										/>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Letzte Aktualisierung
									</TableCell>
									<TableCell>{formatDate(slideStatus.lastUpdated)}</TableCell>
								</TableRow>
								<TableRow>
									<TableCell component="th" sx={{ fontWeight: 600 }}>
										Anzahl Seiten
									</TableCell>
									<TableCell>{slideStatus.slideCount}</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</TableContainer>
					{slideStatus.files.length > 0 && courseDetail && (
						<SlideThumbnails courseId={courseDetail.id} files={slideStatus.files} />
					)}
					<SlideGenerateButton />

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

					{/* --- Camera Status --- */}
					<Typography variant="h5" sx={{ mt: 4, mb: 1 }}>
						Kamera
					</Typography>
					<CameraSnapshot />
				</>
			)}

			{/* --- Steuerung (endpoint health) --- */}
			<Typography variant="h5" sx={{ mt: 4, mb: 1 }}>
				Steuerung
			</Typography>
			<EndpointStatus />
		</Box>
	);
}
