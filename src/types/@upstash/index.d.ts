// Minimal @upstash type declarations used by this project.
// Expand as needed to match actual SDK surface or install upstream types.

declare module "@upstash/redis" {
	export class Redis {
		constructor(opts: { url: string; token: string });
		get(key: string): Promise<string | null>;
		set(key: string, value: string, opts?: { ex?: number }): Promise<"OK" | null>;
		del(key: string): Promise<number>;
	}

	export default Redis;
}

declare module "@upstash/ratelimit" {
	export type RatelimitResponse = {
		success: boolean;
		limit: number;
		remaining: number;
		reset: number;
	};

	export type RatelimitStrategyOptions = {
		window: string; // duration string, e.g. "60 s", "1 m"
		limit: number;
	};

	export class Ratelimit {
		constructor(opts: {
			redis: InstanceType<typeof import("@upstash/redis").Redis>;
			limiter?: ReturnType<typeof Ratelimit.slidingWindow>;
			analytics?: boolean;
		});
		limit(key: string): Promise<RatelimitResponse>;
		static slidingWindow(limit: number, window: string): object;
		static fixedWindow(limit: number, window: string): object;
	}

	export default Ratelimit;
}
