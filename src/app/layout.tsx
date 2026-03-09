import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Aither",
	description: "Hemera Academy Integration",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="de">
			<body>
				<AppRouterCacheProvider>{children}</AppRouterCacheProvider>
			</body>
		</html>
	);
}
