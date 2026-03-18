"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface SlideThumbnailsProps {
	courseId: string;
	files: string[];
}

export function SlideThumbnails({ courseId, files }: SlideThumbnailsProps) {
	if (files.length === 0) return null;

	return (
		<Box
			sx={{
				display: "flex",
				flexWrap: "wrap",
				gap: 2,
				mt: 2,
			}}
		>
			{files.map((file, _idx) => {
				const src = `/api/slides/view?courseId=${encodeURIComponent(courseId)}&file=${encodeURIComponent(file)}`;
				const label = file.replace(/\.html$/, "").replace(/_/g, " ");
				return (
					<Box
						key={file}
						component="a"
						href={src}
						target="_blank"
						rel="noopener noreferrer"
						sx={{
							display: "block",
							textDecoration: "none",
							color: "text.primary",
							width: 240,
							"&:hover .thumb-frame": {
								borderColor: "primary.main",
								boxShadow: 2,
							},
						}}
					>
						<Box
							className="thumb-frame"
							sx={{
								width: 240,
								height: 135,
								overflow: "hidden",
								borderRadius: 1,
								border: "1px solid",
								borderColor: "divider",
								position: "relative",
								bgcolor: "#16213e",
								transition: "border-color 0.2s, box-shadow 0.2s",
							}}
						>
							<Box
								component="iframe"
								src={src}
								title={label}
								sandbox="allow-same-origin"
								loading="lazy"
								sx={{
									width: 1920,
									height: 1080,
									border: "none",
									transform: "scale(0.125)",
									transformOrigin: "top left",
									pointerEvents: "none",
								}}
							/>
						</Box>
						<Typography
							variant="caption"
							sx={{
								display: "block",
								mt: 0.5,
								textAlign: "center",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{label}
						</Typography>
					</Box>
				);
			})}
		</Box>
	);
}
