# Clarifications: Service User for Aither-Hemera API Integration

## Questions & Answers

### Q1: Why use a dedicated service user instead of the admin account?

**Answer**: Using a dedicated service user follows the principle of least privilege and provides several security and operational benefits:

1. **Reduced Attack Surface**: If Aither is compromised, only the limited service user credentials are exposed, not full admin access
2. **Clear Audit Trail**: All Aither actions appear as "aither-service" in logs, making it easy to track automated vs. manual actions
3. **Granular Permissions**: Service user only has access to read courses/participations and write results, not manage users or courses
4. **Session Isolation**: No risk of session conflicts between admin usage and automated service calls
5. **Credential Rotation**: Service credentials can be rotated without affecting admin access

### Q2: How does the JWT authentication flow work?

**Answer**: The authentication flow follows these steps:

1. **Aither** obtains a JWT token from Clerk using the service user credentials
2. **Aither** caches the token with its expiration time
3. **Aither** sends API requests to Hemera with `Authorization: Bearer <token>` header
4. **Hemera** validates the JWT with Clerk
5. **Clerk** confirms the token is valid and returns the `userId` and `role`
6. **Hemera** checks if the role (`api-client`) has permission for the requested operation
7. **Hemera** processes the request and returns the response

If the token expires, Aither automatically refreshes it and retries the request.

### Q3: What happens if the service user credentials are compromised?

**Answer**: If credentials are compromised:

1. **Immediate Actions**:
   - Disable the service user in Clerk Dashboard
   - Rotate credentials by creating a new service user
   - Review audit logs for suspicious activity

2. **Limited Damage**:
   - Attacker can only read course/participation data
   - Attacker can only write to `resultOutcome` and `resultNotes` fields
   - Attacker cannot manage users, courses, or other sensitive operations
   - Rate limiting prevents mass data extraction

3. **Detection**:
   - Monitor for unusual API usage patterns
   - Alert on failed authentication attempts
   - Track token refresh rates

### Q4: How is token caching implemented?

**Answer**: Token caching follows this pattern:

```typescript
// In-memory cache (for single-instance deployments)
const tokenCache = new Map<string, { value: string; expiresAt: Date }>();

async function getServiceToken() {
  const cached = tokenCache.get('hemera-service-token');
  
  // Return cached token if still valid (with 2-minute buffer)
  if (cached && cached.expiresAt > new Date(Date.now() + 120000)) {
    return cached.value;
  }
  
  // Obtain new token from Clerk
  const token = await obtainServiceTokenFromClerkBackend({ 
    scope: 'hemera-api' 
  });
  
  // Cache with expiration
  tokenCache.set('hemera-service-token', { 
    value: token, 
    expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  });
  
  return token;
}
```

For horizontal scaling (multiple Aither instances), use a shared cache like Redis or Vercel KV.

### Q5: What data can the service user access?

**Answer**: The service user has access to:

**Read Access**:
- Course list with participant counts
- Individual course details with bookings
- Participation details (participant info, course enrollment)

**Write Access**:
- `resultOutcome` field on CourseParticipation
- `resultNotes` field on CourseParticipation

**No Access**:
- User management (create, update, delete users)
- Course management (create, update, delete courses)
- Booking management (create, update, delete bookings)
- Payment information
- Other sensitive user data

### Q6: How are service endpoints different from regular API endpoints?

**Answer**: Service endpoints (`/api/service/*`) differ in several ways:

1. **Authentication**: Require JWT with `api-client` or `admin` role
2. **Rate Limiting**: More restrictive limits to prevent abuse
3. **Response Format**: Optimized for service-to-service communication
4. **Error Handling**: Return machine-readable error codes
5. **Logging**: All actions logged with service user context
6. **Versioning**: May have different versioning strategy than public API

Regular endpoints may use session-based auth and are designed for interactive user access.

### Q7: What is the token lifetime and refresh strategy?

**Answer**: Token management follows these guidelines:

- **Access Token Lifetime**: 15 minutes (short-lived for security)
- **Refresh Strategy**: Proactive refresh when ≤ 2 minutes remaining
- **Cache Duration**: Tokens cached until 2 minutes before expiry
- **Retry Logic**: On 401 response, refresh token once and retry request
- **Failure Handling**: If refresh fails, log error and return 5xx/401

This ensures:
- Minimal risk if token is intercepted
- Smooth operation without frequent re-authentication
- Automatic recovery from token expiry

### Q8: How is rate limiting configured?

**Answer**: Rate limiting is applied at multiple levels:

1. **Client-Side** (Aither):
   - `p-throttle`: 2 requests/second to Hemera API
   - Prevents overwhelming the API

2. **Server-Side** (Hemera):
   - `/api/service/*`: 100 requests/minute per service user
   - Prevents abuse if credentials are compromised

3. **Clerk**:
   - JWT generation rate limits (per Clerk plan)

Rate limits can be adjusted based on actual usage patterns.

### Q9: What testing is required before production deployment?

**Answer**: Comprehensive testing includes:

1. **Unit Tests**:
   - `getUserRole` helper function
   - Token caching and refresh logic
   - Service API endpoint handlers
   - Permission checks

2. **Integration Tests**:
   - End-to-end authentication flow
   - Service user access to allowed endpoints
   - Service user blocked from restricted endpoints
   - Token expiry and refresh

3. **Contract Tests**:
   - Request/response schema validation
   - Error response formats
   - API versioning compatibility

4. **Security Tests**:
   - Penetration testing of service endpoints
   - Rate limiting effectiveness
   - Token validation edge cases

5. **Performance Tests**:
   - Load testing with realistic traffic
   - Token cache performance
   - API response times

### Q10: How do we monitor service user activity?

**Answer**: Monitoring includes:

1. **Audit Logging**:
   - All service user actions logged with timestamp, endpoint, and result
   - Logs include request ID for tracing
   - PII scrubbed according to privacy policy

2. **Metrics**:
   - API request count by endpoint
   - Success/failure rates
   - Response times
   - Token refresh frequency

3. **Alerts**:
   - Failed authentication attempts
   - Rate limit violations
   - Unusual usage patterns
   - Error rate spikes

4. **Dashboards**:
   - Real-time API usage
   - Service health status
   - Token lifecycle metrics

### Q11: What is the rollback procedure if issues occur?

**Answer**: Rollback procedure:

1. **Immediate**:
   - Disable service user in Clerk (stops all service API access)
   - Revert Aither to use previous API key authentication
   - Monitor for issue resolution

2. **Investigation**:
   - Review error logs and metrics
   - Identify root cause (auth, permissions, API bugs, etc.)
   - Create fix plan with timeline

3. **Fix & Re-deploy**:
   - Apply fixes in development
   - Test thoroughly in staging
   - Deploy to production with monitoring
   - Verify resolution

4. **Post-Mortem**:
   - Document what went wrong
   - Update procedures to prevent recurrence
   - Share learnings with team

### Q12: How do we handle environment-specific configuration?

**Answer**: Environment configuration:

1. **Development**:
   - Use test service user in Clerk
   - Point to staging Hemera API
   - Verbose logging enabled
   - No rate limiting

2. **Staging**:
   - Use staging service user
   - Point to staging Hemera API
   - Production-like rate limiting
   - Full monitoring enabled

3. **Production**:
   - Use production service user
   - Point to production Hemera API
   - Strict rate limiting
   - Full monitoring and alerting

Environment variables are managed via:
- `.env.local` for development
- Vercel environment variables for staging/production
- Secrets stored in secure vault (not in code)

### Q13: What documentation needs to be created?

**Answer**: Required documentation:

1. **Setup Guide**:
   - How to create service user in Clerk
   - How to configure environment variables
   - How to test the integration

2. **API Documentation**:
   - Service endpoint specifications
   - Request/response examples
   - Error codes and handling

3. **Troubleshooting Guide**:
   - Common issues and solutions
   - How to check logs
   - How to verify token validity

4. **Security Guide**:
   - Credential management
   - Incident response procedures
   - Security best practices

5. **Operational Runbook**:
   - Monitoring and alerting
   - Deployment procedures
   - Rollback procedures

### Q14: How does this integrate with existing Aither code?

**Answer**: Integration points:

1. **HemeraClient** (already updated):
   - Changed from `apiKey` to `getToken()` callback
   - Added service API methods
   - Token obtained dynamically per request

2. **Existing API Routes** (needs update):
   - `src/app/api/recordings/route.ts`
   - `src/app/api/slides/route.ts`
   - `src/app/api/sync/route.ts`
   - All need to use new token mechanism

3. **Configuration** (already updated):
   - `src/lib/config.ts` includes service user env vars
   - `.env.example` documents required variables

4. **Tests** (needs update):
   - Update mocks to use `getToken` instead of `apiKey`
   - Add tests for service API methods

### Q15: What are the performance implications?

**Answer**: Performance considerations:

1. **Token Caching**:
   - Reduces Clerk API calls (1 per 15 minutes vs. per request)
   - Minimal memory overhead (single cached token)
   - Fast cache lookups (in-memory Map)

2. **API Requests**:
   - No additional latency vs. API key auth
   - JWT validation is fast (cryptographic signature check)
   - Rate limiting prevents overload

3. **Scalability**:
   - For single instance: in-memory cache is sufficient
   - For horizontal scaling: use Redis/Vercel KV for shared cache
   - Token refresh is non-blocking

4. **Monitoring Overhead**:
   - Logging adds minimal latency (<1ms)
   - Metrics collection is asynchronous
   - No impact on request processing

Expected performance: < 5ms additional latency compared to API key authentication.