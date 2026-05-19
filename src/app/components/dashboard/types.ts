export interface SlideStatus {
	status: "generated" | "not-generated";
	slideCount: number;
	lastUpdated: string | null;
	files: string[];
	courseId: string | null;
}
