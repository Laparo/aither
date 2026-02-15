export interface TokenValue {
	token: string;
	expiresAt: number;
}

export interface TokenStore {
	get(key: string): Promise<TokenValue | null>;
	set(key: string, value: TokenValue): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

// Simple in-memory TokenStore for local development and tests.
export class InMemoryTokenStore implements TokenStore {
	// Values are either the raw TokenValue object or an encrypted string when
	// encryption is enabled via TOKEN_STORE_ENCRYPTION_KEY.
	private store = new Map<string, TokenValue | string>();

	async get(key: string): Promise<TokenValue | null> {
		const v = this.store.get(key) || null;
		if (!v) return null;

		// If value is encrypted string, decrypt then parse
		if (typeof v === "string") {
			try {
				const { decryptString } = await import("./encryption");
				const json = decryptString(v);
				const parsed = JSON.parse(json) as TokenValue;
				if (parsed.expiresAt <= Date.now()) {
					this.store.delete(key);
					return null;
				}
				return parsed;
			} catch (err) {
				// If decryption or parse fails, remove entry to avoid reuse
				console.warn(
					`InMemoryTokenStore.get: failed to decrypt/parse entry for key "${key}", removing`,
					err,
				);
				this.store.delete(key);
				return null;
			}
		}

		// v is TokenValue
		if (v.expiresAt <= Date.now()) {
			this.store.delete(key);
			return null;
		}
		return v;
	}

	async set(key: string, value: TokenValue): Promise<void> {
		try {
			const { encryptString, getKey } = await import("./encryption");
			// If encryption key present, store encrypted string
			if (typeof getKey === "function" && getKey()) {
				const json = JSON.stringify(value);
				const enc = encryptString(json);
				this.store.set(key, enc);
				return;
			}
		} catch (err) {
			// Encryption is configured but failed — rethrow to avoid silent plaintext fallback
			throw new Error(`InMemoryTokenStore.set: encryption failed for key "${key}"`, { cause: err });
		}
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async clear(): Promise<void> {
		this.store.clear();
	}
}

// Default, replaceable TokenStore instance and setter for application bootstrap
export let tokenStore: TokenStore = new InMemoryTokenStore();

export function setTokenStore(store: TokenStore) {
	tokenStore = store;
}

// Export notes: in production, provide an adapter that implements TokenStore
// backed by Vercel KV, Upstash Redis, or another shared store.
