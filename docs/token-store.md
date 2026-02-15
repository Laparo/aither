**TokenStore: purpose and usage**

- **What it is:** a small abstraction around storing the service-issued token used by `getServiceToken()`.
- **Why:** share tokens across multiple processes, persist tokens across restarts, and avoid duplicate token generation.

## Examples

1) Use in-memory store (default for local/dev):

```ts
import { setTokenStore } from '@/lib/auth/service-token';
// The project defaults to an in-memory TokenStore for local development.
// Example: explicitly set the in-memory store (optional):
import { InMemoryTokenStore } from '@/lib/auth/token-store';
setTokenStore(new InMemoryTokenStore());
```

2) Wire Upstash Redis in your app bootstrap:

```ts
import { Redis } from '@upstash/redis';
import { setTokenStore } from '@/lib/auth/service-token';
import { createUpstashTokenStore } from '@/lib/auth/token-store-upstash';

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
setTokenStore(createUpstashTokenStore(redis));
```

3) Wire Vercel KV in your app bootstrap (if using Vercel):

```ts
import kv from '@vercel/kv';
import { setTokenStore } from '@/lib/auth/service-token';
import { createVercelKVTokenStore } from '@/lib/auth/token-store-vercel';

setTokenStore(createVercelKVTokenStore(kv));
```

Notes

- The adapters defined in `src/lib/auth` accept a client-like object so there is no hard dependency on SDK packages in the library code. Import SDKs only where you wire the store in your app bootstrap.
- Keep secrets (Upstash/KV credentials) out of source; use environment variables.

## Environment Variables

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `UPSTASH_REDIS_REST_URL` | Only if using Upstash | `token-store-upstash.ts` | Upstash Redis REST endpoint URL |
| `UPSTASH_REDIS_REST_TOKEN` | Only if using Upstash | `token-store-upstash.ts` | Upstash Redis REST auth token |
| `TOKEN_STORE_ENCRYPTION_KEY` | No (opt-in) | `encryption.ts` | 32-byte key (Base64 or Hex) for AES-256-GCM encryption at rest |
| `HEMERA_SERVICE_TOKEN` | No | `service-token.ts` | Pre-provisioned service token (skips Clerk mint if set) |

### Validation

The token store itself does **not** validate env vars at import time — it fails fast at first use:

- **Upstash adapter**: `Redis` constructor throws if URL/token are missing.
- **Encryption**: `getKey()` returns `null` when `TOKEN_STORE_ENCRYPTION_KEY` is unset; encryption is silently skipped and tokens are stored in plaintext.
  > **⚠️ Warning**: When `TOKEN_STORE_ENCRYPTION_KEY` is not set, all cached tokens are stored **unencrypted**. In production deployments with external backends (Upstash, Vercel KV), always set this variable to protect tokens at rest.
- **Encryption key length**: must decode to exactly 32 bytes. A malformed key throws `Error: Key must be 32 bytes` on first encrypt/decrypt call.

To validate early (e.g. in CI or app startup), add a check:

```ts
import { getKey } from '@/lib/auth/encryption';

if (process.env.TOKEN_STORE_ENCRYPTION_KEY && !getKey()) {
  throw new Error('TOKEN_STORE_ENCRYPTION_KEY is set but invalid (must be 32 bytes, Base64 or Hex)');
}
```
