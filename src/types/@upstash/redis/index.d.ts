declare module "@upstash/redis" {
	export class Redis {
		constructor(opts: { url: string; token: string });
		get(key: string): Promise<string | null>;
		set(key: string, value: string, opts?: { ex?: number }): Promise<"OK" | null>;
		del(key: string): Promise<number>;
	}

	export default Redis;
}
