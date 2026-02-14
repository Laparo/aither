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
- [ ] Create new user: `aither-service@hemera-academy.com`
- [ ] Set `publicMetadata`:
  ```json
  {
    "role": "api-client",
    "service": "aither"
  }
  ```
- [ ] Document the user ID for environment configuration

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
- [ ] Create server-side helper function:
  ```typescript
  import { clerkClient } from '@clerk/nextjs/server';
  
  export async function getUserRole(userId: string): Promise<string | null> {
    if (!userId) return null;
    const user = await clerkClient.users.getUser(userId);
    return (user?.publicMetadata?.role as string) || null;
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
- [x] Implement token caching mechanism:
  ```typescript
  async function getServiceToken() {
    const cached = tokenCache.get('hemera-service-token');
    if (cached && !cached.isExpired()) return cached.value;
    
    const token = await obtainServiceTokenFromClerkBackend({ scope: 'hemera-api' });
    tokenCache.set('hemera-service-token', { value: token, expiresAt: token.expiresAt });
    return token;
  }
  ```
- [ ] Implement token refresh logic
- [ ] Add retry-on-expiry mechanism

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

## Notes

- This implementation follows Option A from the Aither-Hemera API Integration Plan
- All changes should be reviewed and approved before production deployment
- Regular security audits should be conducted post-deployment