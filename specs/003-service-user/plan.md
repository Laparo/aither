# Implementation Plan: Service User for Aither-Hemera API Integration

## Overview

This plan outlines the implementation steps for creating a dedicated service user in Clerk to enable secure API communication between Aither and Hemera applications.

## Prerequisites

- Clerk account with access to both Aither and Hemera applications
- Admin access to Hemera API
- Development environment set up for both applications

## Implementation Phases

### Phase 1: Clerk Service User Setup

#### 1.1 Create Service User in Clerk
- [ ] Log into Clerk Dashboard
- [ ] Navigate to Users section
- [ ] Create new service user `aither-service@hemera-academy.com` and set `publicMetadata`:
  ```json
  {
    "role": "api-client",
    "service": "aither"
  }
  ```
- [ ] Use a machine-oriented credential (M2M API token or Clerk sign-in token) instead of a reusable plaintext password. Clerk supports creating sign-in tokens via `clerkClient.signInTokens.createSignInToken()` for machine-to-machine flows; alternatively, provision a static API key and store it in the secrets manager.
- [ ] Store the secret/API token in a corporate secrets manager (e.g., Vault, AWS Secrets Manager) and reference it via environment variables; do NOT commit credentials to the repo.
- [ ] Disable interactive/password-based sign-in for the service user if the Clerk plan supports it; prefer token-based/M2M auth.
- [ ] Document service user ID and the secret's secret-name/key location in your environment/CI documentation (do not include the secret value in plaintext).
- [ ] Define credential rotation policy: rotation interval, automated rotation steps, test-and-rollback process, and immediate revocation procedure in case of compromise.
- [ ] Consider enabling additional protections (scope restrictions, IP whitelisting, or MFA for human accounts) where applicable.

#### 1.2 Configure Clerk JWT Template (if needed)
- [ ] Review Clerk JWT template settings
- [ ] Ensure `publicMetadata` is included in JWT claims
- [ ] Test JWT generation for service user

### Phase 2: Hemera API Implementation

#### 2.1 Extend Permission System
- [ ] Update `lib/auth/permissions.ts`:
  - Add `api-client` to `UserRole` enum
  - Define permissions for `api-client` role:
    - `read:courses` ✅
    - `read:bookings` ✅
    - `read:participations` ✅
    - `write:participation-results` ✅
    - `manage:courses` ❌
    - `manage:users` ❌

#### 2.2 Implement getUserRole Helper
- [ ] Create server-side helper function and include robust error handling:
  ```typescript
  import { clerkClient } from '@clerk/nextjs/server';

  export async function getUserRole(userId: string): Promise<string | null> {
    if (!userId) return null;
    try {
      // clerkClient may be a factory function in newer SDK versions
      const client = typeof clerkClient === 'function' ? await (clerkClient as unknown as () => Promise<typeof clerkClient>)() : clerkClient;
      const user = await client.users.getUser(userId);
      if (!user) return null;
      const metadata = user?.publicMetadata as Record<string, unknown> | undefined;
      const role = metadata?.role;
      return typeof role === 'string' && role.length > 0 ? role : null;
    } catch (error) {
      console.error(`getUserRole failed for userId=${userId}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
  ```

#### 2.3 Create Service API Endpoints
- [ ] Create `app/api/service/` directory
- [ ] Implement `app/api/service/courses/route.ts` (GET)
  - List all courses with participant counts
  - Apply role-based access control
- [ ] Implement `app/api/service/courses/[id]/route.ts` (GET)
  - Get single course with bookings and participations
  - Apply role-based access control
- [ ] Implement `app/api/service/participations/[id]/route.ts` (GET)
  - Get participation details
  - Apply role-based access control
- [ ] Implement `app/api/service/participations/[id]/result/route.ts` (PUT)
  - Update result data (resultOutcome, resultNotes)
  - Apply role-based access control

#### 2.4 Update Middleware
- [ ] Update `proxy.ts` to handle `/api/service/*` routes
- [ ] Ensure Clerk authentication is applied
- [ ] Inject validated `userId` and `role` into request context

#### 2.5 Add Rate Limiting
- [ ] Implement rate limiting for `/api/service/*` endpoints
- [ ] Configure appropriate limits (e.g., 100 requests/minute)

### Phase 3: Aither Implementation

#### 3.1 Token Management
- [ ] Update `HemeraClient` to accept `getToken` callback
- [ ] Implement token caching mechanism with explicit shape and error handling:
  ```typescript
  // Simple in-memory cache for dev; use Redis/Vercel KV in production.
  // WARNING: in-memory Map is per-process — not shared across serverless invocations or horizontal replicas.
  const tokenCache = new Map<string, { token: string; expiresAt: number }>();
  const refreshLocks = new Map<string, Promise<string>>();

  async function getServiceToken(): Promise<string> {
    const cacheKey = 'hemera-service-token';
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (2-minute buffer)
    if (cached && cached.expiresAt > Date.now() + 120000) return cached.token;

    // Deduplicate concurrent refresh calls (promise-deduplication)
    if (refreshLocks.has(cacheKey)) {
      return refreshLocks.get(cacheKey)!;
    }

    const refreshPromise = (async () => {
      try {
        const tokenResp = await refreshTokenWithBackoff({ scope: 'hemera-api' });
        // Validate before caching
        if (!tokenResp.token || tokenResp.token.trim().length === 0) {
          throw new Error('Received empty token from Clerk backend');
        }
        tokenCache.set(cacheKey, { token: tokenResp.token, expiresAt: tokenResp.expiresAt });
        return tokenResp.token;
      } catch (err) {
        console.error('getServiceToken: failed to obtain token', err);
        throw err;
      } finally {
        refreshLocks.delete(cacheKey);
      }
    })();

    refreshLocks.set(cacheKey, refreshPromise);
    return refreshPromise;
  }

  // Constants and retry policy for refresh-on-expiry
  const MAX_REFRESH_RETRIES = 3;

  /**
   * Retry token acquisition with exponential backoff + jitter.
   * Used by getServiceToken when the initial mint fails.
   *
   * @param flow - Options forwarded to obtainServiceTokenFromClerkBackend
   * @returns { token: string; expiresAt: number }
   * @throws After MAX_REFRESH_RETRIES consecutive failures
   */
  async function refreshTokenWithBackoff(
    flow: { scope: string }
  ): Promise<{ token: string; expiresAt: number }> {
    for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
      try {
        return await obtainServiceTokenFromClerkBackend(flow);
      } catch (err) {
        if (attempt + 1 >= MAX_REFRESH_RETRIES) throw err;
        const backoffMs = 1000 * Math.pow(2, attempt)
          + Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
    // Unreachable, but satisfies TS return type
    throw new Error('refreshTokenWithBackoff: exhausted retries');
  }

  // Fallback: if token operations fail persistently, callers should fallback to re-auth/alerting

  ```
- [ ] Implement token refresh logic
- [ ] Add retry-on-expiry mechanism (see `refreshTokenWithBackoff` above)

#### 3.2 Environment Configuration
- [x] Add environment variables to `src/lib/config.ts`:
  - `CLERK_SERVICE_USER_ID`
  - `CLERK_SERVICE_USER_EMAIL`
- [x] Update `.env.example` with service user credentials
- [ ] Document environment variables in README

#### 3.3 Service API Integration
- [x] Add service API schemas to `src/lib/hemera/schemas.ts`
- [x] Implement service API methods in `HemeraClient`:
  - `getServiceCourses()`
  - `getServiceCourse(id)`
  - `getServiceParticipation(id)`
  - `updateServiceParticipationResult(id, data)`

#### 3.4 Update Existing Code
- [ ] Update `src/app/api/recordings/route.ts` to use new token mechanism
- [ ] Update `src/app/api/slides/route.ts` to use new token mechanism
- [ ] Update `src/app/api/sync/route.ts` to use new token mechanism

### Phase 4: Testing

#### 4.1 Unit Tests
- [ ] Test `getUserRole` helper function
- [ ] Test service API endpoints with different roles
- [ ] Test token caching and refresh logic
- [ ] Test HemeraClient service methods

#### 4.2 Integration Tests
- [ ] Test end-to-end authentication flow
- [ ] Test service user can access allowed endpoints
- [ ] Test service user cannot access restricted endpoints
- [ ] Test token expiry and refresh

#### 4.3 Contract Tests
- [ ] Create contract tests for service API endpoints
- [ ] Verify request/response schemas
- [ ] Test error handling

#### 4.4 Performance & Load Testing
- [ ] Load-test service endpoints under expected concurrency (target: 100 req/min per service user) and verify 95th/99th latency bounds
- [ ] Performance tests for token-caching and token-refresh logic (verify cache hit rate and refresh latency)
- [ ] End-to-end latency measurements for representative workflows (success criteria: p95 < 200 ms for internal services, p95 < 500 ms for public-facing endpoints — tune per environment)
- [ ] Stress tests to validate rate-limiting and graceful degradation under peak load (verify 429 behavior and Retry-After handling)
- [ ] Define pass/fail criteria for each test (e.g., max error rate, latency thresholds, recovery time)

### Phase 5: Security & Monitoring

#### 5.1 Security Audit
- [ ] Review all service endpoints for security vulnerabilities
- [ ] Verify principle of least privilege is applied
- [ ] Test rate limiting effectiveness
- [ ] Review audit logging

#### 5.2 Monitoring Setup
- [ ] Add logging for service user actions
- [ ] Set up alerts for suspicious activity
- [ ] Monitor API usage patterns
- [ ] Track token refresh rates

#### 5.3 Documentation
- [ ] Document service user setup process
- [ ] Create API documentation for service endpoints
- [ ] Document token management strategy
- [ ] Create troubleshooting guide

### Phase 6: Deployment

#### 6.1 Staging Deployment
- [ ] Deploy Hemera changes to staging
- [ ] Deploy Aither changes to staging
- [ ] Run full test suite in staging
- [ ] Verify monitoring and logging

#### 6.2 Production Deployment
- [ ] Create production service user in Clerk
- [ ] Deploy Hemera changes to production
- [ ] Deploy Aither changes to production
- [ ] Monitor for issues
- [ ] Verify audit logs

#### 6.3 Post-Deployment
- [ ] Monitor API usage for 24 hours
- [ ] Review error logs
- [ ] Verify performance metrics
- [ ] Document any issues and resolutions

## Rollback Plan

If issues arise during deployment:

1. **Immediate Actions**
   - Disable service user in Clerk
   - Revert to previous API key authentication
   - Monitor for resolution of issues

2. **Investigation**
   - Review logs and error messages
   - Identify root cause
   - Create fix plan

3. **Re-deployment**
   - Apply fixes
   - Test in staging
   - Re-deploy to production

### TokenStore abstraction (implementation plan)

- Goal: provide a pluggable token storage implementation so token caches can be swapped between in-memory (dev), Vercel KV, Upstash Redis, or other backends without code changes.
- Interface:
  ```ts
  export interface TokenStore {
    get(key: string): Promise<{ token: string; expiresAt: number } | null>;
    set(key: string, value: { token: string; expiresAt: number }): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  }
  ```
- Provide a default `InMemoryTokenStore` for local development and tests.
- Provide adapter examples for `VercelKV` and `Upstash Redis` in the repo as optional modules.
- Migration: update `getServiceToken` to accept an optional `TokenStore` implementation (defaulting to `InMemoryTokenStore`) and document recommended production config in the README.
- **Error semantics**: `get()` returns `null` for missing/expired keys; `set()` and `delete()` throw on backend failures. Callers should catch store errors and fall back to re-mint rather than surfacing them to end-users.
- **Health check**: provide an optional `ping(): Promise<boolean>` method on store adapters (returns `true` if the backend is reachable). Use in startup / readiness probes.

### Encryption at rest

- **Purpose**: protect cached tokens stored in external backends (Upstash, Vercel KV) against data-at-rest exposure.
- **Algorithm**: AES-256-GCM with a 12-byte random IV per write; ciphertext prefixed with `enc:` for transparent detection.
- **Implementation** (`src/lib/auth/encryption.ts`):
  - `encryptString(plaintext): string` — returns `enc:<base64(iv ‖ authTag ‖ ciphertext)>`
  - `decryptString(payload): string` — strips prefix, decrypts, returns plaintext
  - `getKey(): Buffer | null` — reads `TOKEN_STORE_ENCRYPTION_KEY` (Base64 or Hex, must decode to 32 bytes)
  - `isEncryptedString(value): boolean` — checks `enc:` prefix
- **Config**: set `TOKEN_STORE_ENCRYPTION_KEY` env var (32-byte key, Base64 or Hex). When unset, encryption is silently skipped.
- **Startup validation**: at application boot, call `getKey()` and verify the result. If `TOKEN_STORE_ENCRYPTION_KEY` is set but `getKey()` returns `null`, throw immediately to fail fast instead of silently falling through to plaintext storage.
- **Store integration**: Upstash and InMemory adapters encrypt on `set()` and decrypt on `get()` automatically when key is present.
- **Key rotation**: use `scripts/reencrypt-upstash.js --idempotent` to write re-encrypted values to `<key>.reenc`, then `--swap` to replace originals. See `docs/upstash-migration.md`.
- **Tests**: `tests/unit/encryption.spec.ts` — 4 tests covering no-key pass-through, encrypt/decrypt round-trip, malformed payload error, and non-prefixed plaintext pass-through.

### Circuit-Breaker and escalation process

- Add a lightweight circuit-breaker around Hemera API calls using the [`cockatiel`](https://github.com/connor4312/cockatiel) library (`CircuitBreakerPolicy`) to prevent cascading failures when Hemera is degraded.
- Behavior:
  - Track consecutive 5xx/429 failures per endpoint or host.
  - After configurable threshold (e.g., 5 failures within 1 minute), open circuit for a cooling period (e.g., 1 minute).
  - While open, immediately return a 503/429 fallback or a cached response where appropriate.
  - Record metrics and send alert to on-call channel when circuit opens.
- Escalation: if circuit remains open beyond a threshold, automatically create an incident and notify the SRE channel with context and recent logs.

### isAuthError helper

- Implement `isAuthError(err)` helper to detect authentication/authorization failures (401/403) vs transient server/network errors. This is used to decide whether to retry obtaining a token or fail-fast and alert.

### obtainServiceTokenFromClerkBackend

- Add `obtainServiceTokenFromClerkBackend(flow)` function (server-side) that centralizes Clerk calls to mint service tokens. This will be the single place to add retry/backoff, observability, and error classification. Document expected return shape: `{ token: string; expiresAt: number }`.


## Success Criteria

- [ ] Service user can authenticate via Clerk
- [ ] Service endpoints reject unauthorized access
- [ ] Aither can successfully read/write required data
- [ ] Audit logs show service user actions
- [ ] No admin privileges exposed to service user
- [ ] Token refresh works reliably
- [ ] Rate limiting prevents abuse
- [ ] All tests pass
- [ ] Documentation is complete

## Timeline

- **Phase 1**: 1 day
- **Phase 2**: 3 days
- **Phase 3**: 2 days
- **Phase 4**: 2 days
- **Phase 5**: 1 day
- **Phase 6**: 1 day

**Total Estimated Time**: 10 days

## Dependencies

- Clerk SDK version compatibility
- Hemera API availability
- Aither development environment
- Test environment access

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token expiry issues | High | Implement robust refresh logic with retries |
| Service user compromise | Critical | Monitor usage, implement rate limiting, regular credential rotation |
| API endpoint vulnerabilities | High | Security audit, penetration testing |
| Performance degradation | Medium | Load testing, optimize token caching |
| Deployment issues | Medium | Staged rollout, comprehensive rollback plan |
| Migration/Backward Compatibility | High | Run both systems in parallel during migration, feature flags for controlled rollout, canary deployments |

## Notes

- This implementation follows Option A from the Aither-Hemera API Integration Plan
- All changes should be reviewed and approved before production deployment
- Regular security audits should be conducted post-deployment