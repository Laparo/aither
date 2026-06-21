"use client";

import { colors, typography } from "@/app/components/theme/design-tokens";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export function AppHeader() {
	return (
		<AppBar
			position="static"
			elevation={0}
			sx={{
				bgcolor: colors.rosyBrown,
			}}
		>
			<Container maxWidth="lg">
				<Toolbar
					disableGutters
					sx={{
						py: 1,
						minHeight: "64px !important",
						justifyContent: "space-between",
					}}
				>
					<Typography
						component="div"
						sx={{
							fontFamily: `${typography.heading} !important`,
							fontWeight: "700 !important",
							fontSize: { xs: "1.25rem", md: "1.5rem" },
							color: `${colors.white} !important`,
							letterSpacing: "0.02em",
						}}
					>
						Aither Backbone
					</Typography>

					<Box sx={{ display: "flex", alignItems: "center" }}>
						<Avatar
							sx={{
								width: 36,
								height: 36,
								bgcolor: colors.marsala,
								opacity: 0.5,
								cursor: "default",
								pointerEvents: "none",
							}}
							aria-hidden="true"
						>
							A
						</Avatar>
					</Box>
				</Toolbar>
			</Container>
		</AppBar>
	);
}
