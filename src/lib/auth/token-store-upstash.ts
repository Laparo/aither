import type { TokenStore, TokenValue } from "./token-store";

type UpstashLike = {
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string, opts?: { ex?: number }) => Promise<"OK" | null>;
	del: (key: string) => Promise<number>;
};

function isTokenValue(v: unknown): v is TokenValue {
	if (!v || typeof v !== "object") return false;
	const r = v as Record<string, unknown>;
	return typeof r.token === "string" && typeof r.expiresAt === "number";
}

/**
 * Create a TokenStore backed by an Upstash Redis-like client.
 */
export function createUpstashTokenStore(client: UpstashLike): TokenStore {
	return {
		async get(key: string) {
			const raw = await client.get(key);
			if (raw == null) return null;
			try {
				// raw may be encrypted string or JSON string
				let payload = raw as string;
				try {
					const { decryptString } = await import("./encryption");
					if (typeof decryptString === "function" && payload.startsWith("enc:")) {
						payload = decryptString(payload);
					}
				} catch (_e) {
					// If decrypt fails, fall through to try JSON parse which may still succeed
				}
				const parsed = JSON.parse(payload);
				if (!isTokenValue(parsed)) return null;
				const now = Date.now();
				if (parsed.expiresAt <= now) {
					await client.del(key);
					return null;
				}
				return parsed;
			} catch (_err) {
				// invalid payload
				return null;
			}
		},
		async set(key: string, value: TokenValue) {
			const now = Date.now();
			const remaining = value.expiresAt - now;
			if (remaining <= 0) {
				await client.del(key);
				return;
			}
			const ttl = Math.ceil(remaining / 1000);
			const json = JSON.stringify(value);
			try {
				const { encryptString, getKey } = await import("./encryption");
				if (typeof getKey === "function" && getKey()) {
					const enc = encryptString(json);
					await client.set(key, enc, { ex: ttl });
					return;
				}
				// Encryption module loaded but no key configured — store plaintext with warning
				console.warn(
					"UpstashTokenStore.set: TOKEN_STORE_ENCRYPTION_KEY not set, storing plaintext",
				);
			} catch (_e) {
				console.warn("UpstashTokenStore.set: encryption unavailable, storing plaintext", _e);
			}
			await client.set(key, json, { ex: ttl });
		},
		async delete(key: string) {
			await client.del(key);
		},
		async clear() {
			// clear is not supported by this implementation because it would require
			// a scan/del across the token namespace. Signal explicit failure so
			// callers are aware and can choose an alternative store or implement
			// a tailored cleanup routine.
			throw new Error(
				"createUpstashTokenStore.clear: operation not supported; implement with scan/del if required",
			);
		},
	};
}

export default createUpstashTokenStore;
