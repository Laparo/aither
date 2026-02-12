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
			<body>{children}</body>
		</html>
	);
}
