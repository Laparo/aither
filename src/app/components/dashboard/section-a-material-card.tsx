"use client";

import type { SlideStatus } from "@/app/components/dashboard/types";
import { SlideGenerateButton } from "@/app/components/slide-generate-button";
import { SlideThumbnails } from "@/app/components/slide-thumbnails";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";

function DescriptionIcon(props: React.ComponentProps<typeof SvgIcon>) {
	return (
		<SvgIcon {...props}>
			<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
		</SvgIcon>
	);
}

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

interface MaterialCardProps {
	slideStatus: SlideStatus;
}

export function MaterialCard({ slideStatus }: MaterialCardProps) {
	const generated = slideStatus.status === "generated";
	const isEmpty = slideStatus.files.length === 0 && slideStatus.status === "not-generated";

	return (
		<Paper data-testid="material-card" sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
			<Typography variant="h6" gutterBottom>
				Seminarmaterial
			</Typography>
			<Chip
				label={generated ? "Generiert" : "Nicht generiert"}
				color={generated ? "success" : "default"}
				size="small"
				sx={{ mb: 2 }}
			/>
			{isEmpty ? (
				<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, py: 2 }}>
					<DescriptionIcon sx={{ fontSize: 48, color: "text.disabled" }} />
					<Typography color="text.secondary">Keine Folien vorhanden</Typography>
				</Box>
			) : (
				<Box sx={{ display: "grid", gap: 1 }}>
					<Typography variant="body2">
						Letzte Aktualisierung: {formatDate(slideStatus.lastUpdated)}
					</Typography>
					<Typography variant="body2">Anzahl Seiten: {slideStatus.slideCount}</Typography>
				</Box>
			)}
			{slideStatus.files.length > 0 && slideStatus.courseId && (
				<SlideThumbnails courseId={slideStatus.courseId} files={slideStatus.files} />
			)}
			<SlideGenerateButton />
		</Paper>
	);
}
