"use client";

import { hemeraTheme } from "@/app/components/theme/theme";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

interface ThemeRegistryProps {
	children: React.ReactNode;
}

export function ThemeRegistry({ children }: ThemeRegistryProps) {
	return (
		<AppRouterCacheProvider>
			<ThemeProvider theme={hemeraTheme}>
				<CssBaseline />
				{children}
			</ThemeProvider>
		</AppRouterCacheProvider>
	);
}
