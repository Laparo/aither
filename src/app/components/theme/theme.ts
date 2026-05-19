import { createTheme } from "@mui/material/styles";
import { colors, typography } from "./design-tokens";

export const hemeraTheme = createTheme({
	palette: {
		primary: {
			main: colors.marsala,
			light: colors.marsalaLight,
			dark: colors.marsalaDark,
			contrastText: colors.white,
		},
		secondary: {
			main: colors.bronze,
			contrastText: colors.white,
		},
		background: {
			default: colors.beige,
			paper: colors.white,
		},
		info: {
			main: colors.infoMain,
		},
		text: {
			primary: colors.lightBlack,
			secondary: colors.marsala,
		},
	},
	typography: {
		fontFamily: typography.body,
		h1: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		h2: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		h3: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		h4: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		h5: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		h6: { fontFamily: typography.heading, fontWeight: 700, color: colors.marsala },
		body1: { color: colors.lightBlack },
		body2: { color: colors.lightBlack },
	},
	components: {
		MuiContainer: {
			styleOverrides: {
				maxWidthLg: {
					maxWidth: "1200px",
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					backgroundColor: colors.rosyBrown,
				},
			},
		},
	},
	shape: {
		borderRadius: 8,
	},
});
