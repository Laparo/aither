import type { TokenStore, TokenValue } from "./token-store";

type KVLike = {
	get: (key: string) => Promise<unknown>;
	set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>;
	del?: (key: string) => Promise<unknown>;
};

export function createVercelKVTokenStore(kvClient: KVLike): TokenStore {
	return {
		async get(key: string) {
			const raw = await kvClient.get(key);
			if (raw == null) return null;

			if (typeof raw === "string") {
				try {
					const parsed = JSON.parse(raw);
					if (!parsed || typeof parsed !== "object") return null;
					const blob = parsed as Record<string, unknown>;
					if (typeof blob.token !== "string" || typeof blob.expiresAt !== "number") {
						return null;
					}
					return { token: blob.token as string, expiresAt: blob.expiresAt as number };
				} catch (_err) {
					return null;
				}
			}

			if (typeof raw === "object" && raw) {
				const obj = raw as Record<string, unknown>;
				if (typeof obj.token === "string" && typeof obj.expiresAt === "number") {
					return { token: obj.token as string, expiresAt: obj.expiresAt as number };
				}
			}

			console.warn("token-store-vercel: unexpected raw value for key", key);
			return null;
		},

		async set(key: string, value: TokenValue) {
			const now = Date.now();
			const remaining = value.expiresAt - now;
			if (remaining <= 0) {
				if (kvClient.del) {
					await kvClient.del(key);
				} else {
					console.warn(
						`token-store-vercel: token for key "${key}" is expired but KV client does not support deletion; skipping cleanup`,
					);
				}
				return;
			}
			const ttl = Math.ceil(remaining / 1000);
			await kvClient.set(key, JSON.stringify(value), { ex: ttl });
		},

		async delete(key: string) {
			if (!kvClient.del) {
				throw new Error("token-store-vercel: KV client does not support deletion");
			}
			await kvClient.del(key);
		},
		async clear() {
			// clear is not supported by generic KV client without a listing API.
			// Signal this explicitly so callers can choose a different store
			// or implement a platform-specific cleanup.
			throw new Error("token-store-vercel: clear operation is not supported");
		},
	};
}

export default createVercelKVTokenStore;
