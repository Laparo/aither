import { CameraSnapshot } from "@/app/components/camera-snapshot";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export function CameraSection() {
	return (
		<Paper data-testid="camera-card" sx={{ p: { xs: 2, md: 3 } }}>
			<Typography variant="h5" sx={{ mb: 1.5 }}>
				Kamera
			</Typography>
			<CameraSnapshot />
		</Paper>
	);
}
