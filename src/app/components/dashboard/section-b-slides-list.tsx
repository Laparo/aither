"use client";

import type { SlideStatus } from "@/app/components/dashboard/types";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useState } from "react";

interface SlidesListProps {
	slideStatus: SlideStatus;
}

export function SlidesList({ slideStatus }: SlidesListProps) {
	const [previewFile, setPreviewFile] = useState<string | null>(null);

	return (
		<Paper data-testid="slides-list" sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
			<Typography variant="h6" gutterBottom>
				Kursfolien
			</Typography>

			{slideStatus.files.length === 0 ? (
				<Typography color="text.secondary">Keine Folien generiert.</Typography>
			) : (
				<List disablePadding>
					{slideStatus.files.map((file) => {
						if (!slideStatus.courseId) {
							return (
								<Box component="li" key={file} sx={{ py: 0.5, listStyle: "none" }}>
									<Typography variant="body2">{file}</Typography>
								</Box>
							);
						}

						return (
							<ListItemButton
								key={file}
								onClick={() => setPreviewFile(file)}
								sx={{ py: 0.5, borderRadius: 1 }}
							>
								<Typography variant="body2">{file}</Typography>
							</ListItemButton>
						);
					})}
				</List>
			)}

			<Dialog
				open={previewFile !== null}
				onClose={() => setPreviewFile(null)}
				maxWidth="md"
				fullWidth
			>
				{previewFile && slideStatus.courseId && (
					<Box data-testid="slide-preview-modal">
						<DialogTitle
							sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
						>
							{previewFile}
							<IconButton onClick={() => setPreviewFile(null)} aria-label="Schließen" size="small">
								✕
							</IconButton>
						</DialogTitle>
						<DialogContent>
							<Box
								component="iframe"
								src={`/api/slides/view?courseId=${encodeURIComponent(slideStatus.courseId)}&file=${encodeURIComponent(previewFile)}`}
								sx={{ width: "100%", height: 500, border: "none" }}
								title={previewFile}
							/>
						</DialogContent>
					</Box>
				)}
			</Dialog>
		</Paper>
	);
}
