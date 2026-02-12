import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		environment: "node",
		include: ["tests/**/*.spec.ts"],
		exclude: ["tests/e2e/**"],
		coverage: {
			provider: "v8",
			include: ["src/lib/**/*.ts"],
			exclude: ["src/lib/**/*.d.ts"],
		},
	},
});
