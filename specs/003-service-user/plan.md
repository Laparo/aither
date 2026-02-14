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
- [ ] Use a machine-oriented credential (API token/service key) instead of a reusable plaintext password where possible. If a password is created, use a strong randomly generated secret.
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
      const user = await clerkClient.users.getUser(userId);
      if (!user) return null;
      const role = user?.publicMetadata?.role;
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
- [x] Update `HemeraClient` to accept `getToken` callback
- [x] Implement token caching mechanism with explicit shape and error handling:
  ```typescript
  // Simple in-memory cache for dev; use Redis/Vercel KV in production
  const tokenCache = new Map<string, { token: string; expiresAt: number }>();

  async function getServiceToken(): Promise<string | null> {
    const cacheKey = 'hemera-service-token';
    const cached = tokenCache.get(cacheKey);

    // Return cached token if still valid (2-minute buffer)
    if (cached && cached.expiresAt > Date.now() + 120000) return cached.token;

    // Attempt token acquisition with error handling and one retry-on-401
    try {
      const tokenResp = await obtainServiceTokenFromClerkBackend({ scope: 'hemera-api' });
      // Expect tokenResp: { token: string, expiresAt: number }
      tokenCache.set(cacheKey, { token: tokenResp.token, expiresAt: tokenResp.expiresAt });
      return tokenResp.token;
    } catch (err) {
      // If auth-related (401), try once more; otherwise surface the error
      if (isAuthError(err)) {
        try {
          const retryResp = await obtainServiceTokenFromClerkBackend({ scope: 'hemera-api' });
          tokenCache.set(cacheKey, { token: retryResp.token, expiresAt: retryResp.expiresAt });
          return retryResp.token;
        } catch (retryErr) {
          console.error('getServiceToken: retry failed', retryErr);
          return null;
        }
      }
      console.error('getServiceToken: failed to obtain token', err);
      return null;
    }
  }

  // Token structure: { token: string, expiresAt: number } and store keyed by 'hemera-service-token'

  // Constants and retry policy for refresh-on-expiry
  const MAX_REFRESH_RETRIES = 2;
  async function refreshTokenWithBackoff(flow) {
    for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
      try {
        return await obtainServiceTokenFromClerkBackend(flow);
      } catch (err) {
        if (attempt + 1 >= MAX_REFRESH_RETRIES) throw err;
        const backoffMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
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
- [ ] End-to-end latency measurements for representative workflows (success criteria: p95 < X ms — define X per environment)
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
| Migration/Abwärtskompatibilität | Hoch | Parallelbetrieb beider Systeme während der Migration, Feature-Flags für kontrollierten Rollout, Canary-Deployments |

## Notes

- This implementation follows Option A from the Aither-Hemera API Integration Plan
- All changes should be reviewed and approved before production deployment
- Regular security audits should be conducted post-deployment