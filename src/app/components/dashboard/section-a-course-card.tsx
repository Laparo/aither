import type { ServiceCourseDetail } from "@/lib/hemera/schemas";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

const levelLabels: Record<ServiceCourseDetail["level"], string> = {
	BEGINNER: "Grundkurs",
	INTERMEDIATE: "Fortgeschritten",
	ADVANCED: "Masterclass",
};

function formatDate(iso: string | null): string {
	if (!iso) return "-";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "-";
	return d.toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

interface CourseCardProps {
	course: ServiceCourseDetail;
}

export function CourseCard({ course }: CourseCardProps) {
	return (
		<Paper data-testid="course-card" sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
			<Typography variant="h6" gutterBottom>
				{course.title}
			</Typography>
			<Chip
				label={levelLabels[course.level] ?? course.level}
				size="small"
				color="primary"
				sx={{ mb: 2 }}
			/>
			<Box sx={{ display: "grid", gap: 1 }}>
				<Typography variant="body2">Startdatum: {formatDate(course.startDate)}</Typography>
				<Typography variant="body2">Enddatum: {formatDate(course.endDate)}</Typography>
				<Typography variant="body2">Teilnehmerzahl: {course.participants.length}</Typography>
			</Box>
		</Paper>
	);
}
