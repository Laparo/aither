import { CameraSection } from "@/app/components/dashboard/section-d-camera-card";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/camera-snapshot", () => ({
	CameraSnapshot: () => <div data-testid="mock-camera-snapshot">camera</div>,
}));

describe("CameraSection", () => {
	it("renders heading Kamera", () => {
		const html = renderToStaticMarkup(<CameraSection />);
		expect(html).toContain("Kamera");
	});

	it("embeds CameraSnapshot component", () => {
		const html = renderToStaticMarkup(<CameraSection />);
		expect(html).toContain("mock-camera-snapshot");
	});

	it("has data-testid camera-card", () => {
		const html = renderToStaticMarkup(<CameraSection />);
		expect(html).toContain('data-testid="camera-card"');
	});
});
