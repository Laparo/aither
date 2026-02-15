import { setTokenStore } from "./token-store";
import { createUpstashTokenStore } from "./token-store-upstash";

/**
 * Initialize TokenStore from environment variables.
 * Dynamically imports the Upstash SDK to avoid adding a hard dependency
 * unless the function is actually invoked in production bootstrap.
 */
export async function initTokenStoreFromEnv(): Promise<void> {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return;

	try {
		const mod = await import("@upstash/redis");
		// Narrow the dynamic import to the declared module shape without `any`.
		const shaped = mod as unknown as {
			default?: unknown;
			Redis?: unknown;
		};
		const RedisCtorUn = shaped.default ?? shaped.Redis;
		if (!RedisCtorUn || typeof RedisCtorUn !== "function") {
			throw new Error("Invalid Redis module: no constructor found in @upstash/redis");
		}

		type RedisCtorType = new (opts: { url: string; token: string }) => {
			set(key: string, value: string, opts?: { ex?: number }): Promise<"OK" | null>;
			get(key: string): Promise<string | null>;
			del(key: string): Promise<number>;
		};

		const RedisCtor = RedisCtorUn as unknown as RedisCtorType;
		const redis = new RedisCtor({ url, token });
		setTokenStore(createUpstashTokenStore(redis));
		// eslint-disable-next-line no-console
		console.info("TokenStore: wired Upstash Redis store");
	} catch (err) {
		// Don't throw — fail gracefully and fall back to in-memory store.
		// Log the error to aid debugging in production.
		// eslint-disable-next-line no-console
		console.warn("TokenStore: failed to initialize Upstash store", err);
	}
}

export default initTokenStoreFromEnv;
