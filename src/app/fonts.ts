import { Inter, Playfair_Display } from "next/font/google";

export const inter = Inter({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-inter",
	display: "swap",
});

export const playfairDisplay = Playfair_Display({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-playfair",
	display: "swap",
});
