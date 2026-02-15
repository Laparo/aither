export interface TokenValue {
	token: string;
	expiresAt: number;
}

export interface TokenStore {
	get(key: string): Promise<TokenValue | null>;
	set(key: string, value: TokenValue): Promise<void>;
	delete(key: string): Promise<void>;
}

// Simple in-memory TokenStore for local development and tests.
export class InMemoryTokenStore implements TokenStore {
	private store = new Map<string, TokenValue>();

	async get(key: string): Promise<TokenValue | null> {
		const v = this.store.get(key) || null;
		return v;
	}

	async set(key: string, value: TokenValue): Promise<void> {
		this.store.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}
}

// Export notes: in production, provide an adapter that implements TokenStore
// backed by Vercel KV, Upstash Redis, or another shared store.
