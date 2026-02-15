# Implementation Guide: Service User for Aither-Hemera API Integration

## Overview

This guide provides step-by-step instructions for implementing the service user feature. Follow these instructions in order.

---

## Part 1: Aither Implementation (Current Project)

### Step 1: Token Management Service

Create a new file `src/lib/auth/service-token.ts`:

```typescript
// ---------------------------------------------------------------------------
// Service Token Management for Hemera API
// Handles JWT token caching and refresh for service-to-service communication
// ---------------------------------------------------------------------------

import { clerkClient } from '@clerk/nextjs/server';
import { loadConfig } from '../config';

// Token shape: { token: string; expiresAt: number }
// Stored via TokenStore abstraction (see token-store.ts)

// In-memory token cache (DEV-ONLY).
// For production, replace this with a shared store such as Vercel KV, Upstash Redis, or similar.
// The in-memory `Map` works for local development and CI tests but will not work across
// multiple instances or serverless cold starts.

// Use TokenStore abstraction for production; in-memory for dev only.
import { tokenStore, setTokenStore } from '@/lib/auth/token-store';
const refreshLocks = new Map<string, Promise<string>>();

/**
 * Get a valid service token for Hemera API access.
 * Automatically handles caching and refresh.
 */
export async function getServiceToken(): Promise<string> {
  const cacheKey = 'hemera-service-token';
  const cached = await tokenStore.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 120000) {
    return cached.token;
  }

  // Deduplicate concurrent refreshes
  if (refreshLocks.has(cacheKey)) {
    return refreshLocks.get(cacheKey)!;
  }

  const refreshPromise = (async () => {
    // Prefer pre-provisioned token from environment
    const envToken = process.env.CLERK_SERVICE_USER_API_KEY || process.env.CLERK_SERVICE_USER_SIGNIN_TOKEN;
    if (envToken && typeof envToken === 'string' && envToken.trim().length > 0) {
      // Validate before caching
      await validateToken(envToken, 'generated');
      const expiresAt = Date.now() + 15 * 60 * 1000;
      await tokenStore.set(cacheKey, { token: envToken, expiresAt });
      return envToken;
    }

    const config = loadConfig();
    const tokenResp = await obtainTokenFromClerk(config.CLERK_SERVICE_USER_ID);
    // Validate before caching
    await validateToken(tokenResp, 'generated');
    const expiresAt = Date.now() + 15 * 60 * 1000;
    await tokenStore.set(cacheKey, { token: tokenResp, expiresAt });
    return tokenResp;
  })();

  refreshLocks.set(cacheKey, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshLocks.delete(cacheKey);
  }
}

/**
 * Obtain a JWT token from Clerk for the service user.
 */
async function obtainTokenFromClerk(userId: string): Promise<string> {
  try {
    // Mint a short‑lived JWT using a Clerk JWT Template configured as 'hemera-api'
    // This avoids creating persistent sessions and follows least-privilege
    const minted = await clerkClient.users.createToken(userId, {
      template: 'hemera-api',
      expiresInSeconds: 15 * 60, // 15 minutes
    });
    return minted.jwt;
  } catch (error) {
    console.error('Failed to mint service JWT from Clerk:', error);
    // Surface network/5xx errors to callers so they can be retried/monitored.
    const status = (error as any)?.status;
    if (!status || status >= 500) throw error;
    throw new Error('Service token generation failed');
  }
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export async function clearTokenCache(): Promise<void> {
  await tokenStore.delete('hemera-service-token');
}
```

### Step 2: Update HemeraClient Initialization

Update `src/app/api/recordings/route.ts`:

```typescript
import { HemeraClient } from '@/lib/hemera/client';
import { loadConfig } from '@/lib/config';
import { getServiceToken } from '@/lib/auth/service-token';

export async function GET(request: Request) {
  const config = loadConfig();
  
  const client = new HemeraClient({
    baseUrl: config.HEMERA_API_BASE_URL,
    getToken: getServiceToken,
  });
  
  // ... rest of the implementation
}
```

Update `src/app/api/slides/route.ts`:

```typescript
import { HemeraClient } from '@/lib/hemera/client';
import { loadConfig } from '@/lib/config';
import { getServiceToken } from '@/lib/auth/service-token';

export async function GET(request: Request) {
  const config = loadConfig();
  
  const client = new HemeraClient({
    baseUrl: config.HEMERA_API_BASE_URL,
    getToken: getServiceToken,
  });
  
  // ... rest of the implementation
}
```

Update `src/app/api/sync/route.ts`:

```typescript
import { HemeraClient } from '@/lib/hemera/client';
import { loadConfig } from '@/lib/config';
import { getServiceToken } from '@/lib/auth/service-token';

export async function POST(request: Request) {
  const config = loadConfig();
  
  const client = new HemeraClient({
    baseUrl: config.HEMERA_API_BASE_URL,
    getToken: getServiceToken,
  });
  
  // ... rest of the implementation
}
```

### Step 3: Update Tests

Update `tests/unit/hemera-client.spec.ts`:

```typescript
import { HemeraClient } from '@/lib/hemera/client';
import { describe, it, expect, vi } from 'vitest';

function createMockFetch(responses: Array<{ status: number; body: unknown }>) {
  let callCount = 0;
  return vi.fn(async () => {
    const response = responses[callCount++] || responses[responses.length - 1];
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: 'OK',
      headers: new Headers(),
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    } as unknown as Response;
  });
}

describe('HemeraClient', () => {
  it('should use getToken for authentication', async () => {
    const mockFetch = createMockFetch([{ status: 200, body: [] }]);
    const mockGetToken = vi.fn(async () => 'mock-token');
    
    const client = new HemeraClient({
      baseUrl: 'https://api.hemera.academy',
      getToken: mockGetToken,
      fetchFn: mockFetch as any,
    });
    
    await client.getServiceCourses();

    expect(mockGetToken).toHaveBeenCalled();
    // Verify the Authorization header was passed to fetch
    const firstCall = mockFetch.mock.calls[0];
    const options = firstCall[1];
    let authHeader;
    if (options?.headers instanceof Headers) {
      authHeader = options.headers.get('Authorization');
    } else if (Array.isArray(options?.headers)) {
      const found = options.headers.find(([k]) => k.toLowerCase() === 'authorization');
      authHeader = found ? found[1] : undefined;
    } else if (options?.headers && typeof options.headers === 'object') {
      authHeader = options.headers['Authorization'] || options.headers['authorization'];
    }
    expect(authHeader).toBe('Bearer mock-token');
  });
  
  // Add more tests...
});
```

### Step 4: Environment Configuration

Security note: Never commit `.env.local` or other secret-containing files to version control. Use your cloud provider's secret manager, Vercel environment variables, or another secure store for production secrets. The examples below are for local development only.

Update `.env.local` (create if it doesn't exist):

```bash
# Clerk Service User
CLERK_SERVICE_USER_ID=user_xxxxxxxxxxxxxxxxxxxxx
CLERK_SERVICE_USER_EMAIL=aither-service@hemera-academy.com

# Hemera API
HEMERA_API_BASE_URL=https://api.hemera.academy

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx

# Upstash Redis (used for rate limiting)
# Get these from your Upstash console and keep secrets in your environment manager
UPSTASH_REDIS_REST_URL=https://<your-upstash-id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
```

---

## Part 2: Hemera Implementation (Separate Project)

### Step 1: Create getUserRole Helper

Create `lib/auth/user-role.ts` (canonical helper used by service endpoints). Implementations should import and use this single helper to avoid duplication.

### Step 2: Permissions (single canonical definition)

Update `lib/auth/permissions.ts` to provide a single canonical RBAC definition used throughout the codebase:

```typescript
// ---------------------------------------------------------------------------
// Permission Definitions and RBAC Logic
// Centralized role-based access control for service endpoints
// ---------------------------------------------------------------------------

export const Permission = {
  READ_COURSES: 'read:courses',
  READ_BOOKINGS: 'read:bookings',
  READ_PARTICIPATIONS: 'read:participations',
  WRITE_PARTICIPATION_RESULTS: 'write:participation-results',
  READ_USERS: 'read:users',
  MANAGE_COURSES: 'manage:courses',
  MANAGE_USERS: 'manage:users',
} as const;
export type Permission = typeof Permission[keyof typeof Permission];

// Consolidated role type - single source of truth
export type Role = 'admin' | 'api-client' | 'instructor' | 'participant';

// Centralized RBAC map
export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
    'read:users',
    'manage:courses',
    'manage:users',
  ],
  'api-client': [
    'read:courses',
    'read:bookings',
    'read:participations',
    'write:participation-results',
  ],
  instructor: [
    'read:courses',
    'read:participations',
  ],
  participant: [],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && rolePermissions[role]?.includes(permission) === true;
}
```

### Step 3: Create Error Utilities

Create `lib/utils/api-error.ts`:

```typescript
// ---------------------------------------------------------------------------
// API Error Response Utilities
// Provides consistent error response formatting across all API endpoints
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

/**
 * Create a consistent error response for API endpoints.
 * 
 * @param status - HTTP status code
 * @param errorCode - Machine-readable error code (e.g., 'Unauthorized', 'Not Found')
 * @param message - Optional human-readable error message
 * @returns NextResponse with standardized error format
 */
export function createErrorResponse(
  status: number,
  errorCode: string,
  message?: string
): NextResponse {
  return NextResponse.json({ error: errorCode, message }, { status });
}
```

### Step 4: Create Auth Guard

Create `lib/auth/service-guard.ts`:

```typescript
// ---------------------------------------------------------------------------
// Service API Authorization Guard
// Provides consolidated RBAC logic for service endpoints
// ---------------------------------------------------------------------------

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { Permission, Role } from './permissions';
import { hasPermission } from './permissions';
import { createErrorResponse } from '../utils/api-error';

/**
 * Require service authentication and authorization for an API endpoint.
 * Returns null if authorized, or a NextResponse with error if not.
 * 
 * @param requiredPermission - The permission required to access the endpoint
 * @returns null if authorized, NextResponse with error otherwise
 */
export async function requireServiceAuth(requiredPermission: Permission): Promise<NextResponse | null> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return createErrorResponse(401, 'Unauthorized', 'Authentication required');
  }

  // Derive role from session claims directly (avoid double auth() call)
  const metadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
  const role = metadata?.role;
  const validatedRole = (role && typeof role === 'string' &&
    ['admin', 'api-client', 'instructor', 'participant'].includes(role))
    ? role as Role : null;

  if (!hasPermission(validatedRole, requiredPermission)) {
    return createErrorResponse(403, 'Forbidden', 'Insufficient permissions');
  }

  return null; // Auth successful
}
```

### Step 5: Create Service Endpoints

Create `app/api/service/courses/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  // Check authentication and permissions
  const authError = await requireServiceAuth(Permission.READ_COURSES);
  if (authError) return authError;
  
  try {
    // Fetch courses with participation counts
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { participations: true },
        },
      },
    });
    
    return NextResponse.json(courses);
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
```

Create `app/api/service/courses/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
import { createErrorResponse } from '@/lib/utils/api-error';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await requireServiceAuth(Permission.READ_COURSES);
  if (authError) return authError;
  
  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
      participations: {
      select: {
      id: true,
      courseId: true,
      userId: true, // Pseudonymous identifier only; no name/email
      resultOutcome: true,
      resultNotes: true,
      },
      },
      },
    });
    
    if (!course) {
      return createErrorResponse(404, 'Not Found', 'Course not found');
    }
    
    return NextResponse.json(course);
  } catch (err) {
    console.error('Failed to fetch course:', err);
    return createErrorResponse(500, 'Server Error', 'Failed to fetch course');
  }
}
```

Create `app/api/service/participations/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
import { createErrorResponse } from '@/lib/utils/api-error';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await requireServiceAuth(Permission.READ_PARTICIPATIONS);
  if (authError) return authError;
  
  try {
    const participation = await prisma.courseParticipation.findUnique({
      where: { id: params.id },
    });

    if (!participation) {
      return createErrorResponse(404, 'Not Found', 'Participation not found');
    }

    return NextResponse.json(participation);
  } catch (err) {
    console.error('Failed to fetch participation:', err);
    return createErrorResponse(500, 'Server Error', 'Failed to fetch participation');
  }
}
```

Create `app/api/service/participations/[id]/result/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
import { createErrorResponse } from '@/lib/utils/api-error';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateResultSchema = z.object({
  resultOutcome: z.string().nullable().optional(),
  resultNotes: z.string().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = await requireServiceAuth(Permission.WRITE_PARTICIPATION_RESULTS);
  if (authError) return authError;
  
  try {
    const body = await request.json();
    let data;
    try {
      data = UpdateResultSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return createErrorResponse(400, 'Bad Request', 'Invalid request data');
      }
      throw err;
    }

    try {
      const participation = await prisma.courseParticipation.update({
        where: { id: params.id },
        data: {
          resultOutcome: data.resultOutcome,
          resultNotes: data.resultNotes,
        },
      });
      return NextResponse.json(participation);
    } catch (error) {
      // Prisma known error handling
      if ((error as any)?.code === 'P2025') {
        return createErrorResponse(404, 'Not Found', 'Participation not found');
      }
      console.error('Failed to update participation result:', error);
      return createErrorResponse(500, 'Server Error', 'Failed to update participation result');
    }
  } catch (err) {
    console.error('Failed to process participation result request:', err);
    return createErrorResponse(500, 'Server Error', 'Internal server error');
  }
}
```

### Step 6: Update Middleware

Update `middleware.ts` (renamed from `proxy.ts`):

```typescript
// middleware.ts — Clerk auth for all routes; per-endpoint authorization
// is handled by requireServiceAuth in route handlers.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isServiceRoute = createRouteMatcher(['/api/service/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isServiceRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

Note: This follows a two-step approach — `middleware.ts` performs authentication (`auth.protect()`), while per-endpoint authorization (permission checks) is implemented in `requireServiceAuth` and used within individual route handlers.

### Step 7: Add Rate Limiting

Create `lib/rate-limit.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create rate limiter (100 requests per minute)
export const serviceRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await serviceRateLimit.limit(identifier);
  
  return {
    success,
    limit,
    reset,
    remaining,
  };
}
```

Update service endpoints to use rate limiting:

```typescript
import { checkRateLimit } from '@/lib/rate-limit';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Check rate limit after auth to prevent unauthenticated DoS
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (err) {
    console.warn('Rate limit pre-check: auth() failed, using anon key', err);
  }
  const key = userId ? `service:${userId}` : 'service:anon';
  const rateLimit = await checkRateLimit(key);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.reset.toString(),
        },
      }
    );
  }
  // ... rest of the implementation
}
```

---

## Part 3: Clerk Configuration

### Step 1: Create Service User

1. Log into Clerk Dashboard
2. Navigate to Users section
3. Click "Create User"
4. Fill in details:
   - Email: `aither-service@hemera-academy.com`
   - Password: Generate a strong password
5. Click "Create"
6. Copy the User ID (starts with `user_`)

### Step 2: Set Public Metadata

1. Click on the newly created user
2. Navigate to "Metadata" tab
3. In "Public metadata" section, add:
   ```json
   {
     "role": "api-client",
     "service": "aither"
   }
   ```
4. Click "Save"

### Step 3: Configure JWT Template (if needed)

1. Navigate to "JWT Templates" in Clerk Dashboard
2. Create a new template named "hemera-api"
3. Add claims:
   ```json
   {
     "userId": "{{user.id}}",
     "role": "{{user.public_metadata.role}}",
     "service": "{{user.public_metadata.service}}"
   }
   ```
4. Save the template

---

## Part 4: Testing

### Step 1: Unit Tests

Run unit tests:
```bash
npm test
```

### Step 2: Integration Tests

Test the authentication flow:
```bash
curl -X GET https://api.hemera.academy/api/service/courses \
  -H "Authorization: Bearer <token>"
```

### Step 3: End-to-End Tests

Test from Aither to Hemera:
```bash
# In Aither project
npm run dev

# Make a request that triggers service API call
curl http://localhost:3000/api/sync
```

---

## Part 5: Deployment

### Step 1: Deploy to Staging

1. Deploy Hemera changes to staging
2. Deploy Aither changes to staging
3. Run full test suite
4. Verify monitoring and logging

### Step 2: Deploy to Production

1. Create production service user in Clerk
2. Update production environment variables
3. Deploy Hemera changes to production
4. Deploy Aither changes to production
5. Monitor for issues

---

## Troubleshooting

### Token Generation Fails

**Symptom**: `Service token generation failed` error

**Solution**:
1. Verify `CLERK_SECRET_KEY` is set correctly
2. Check service user exists in Clerk
3. Verify service user has correct metadata
4. Check Clerk API logs for errors

### 401 Unauthorized

**Symptom**: API returns 401 Unauthorized

**Solution**:
1. Verify token is being sent in Authorization header
2. Check token is not expired
3. Verify Clerk JWT validation is working
4. Check middleware is configured correctly

### 403 Forbidden

**Symptom**: API returns 403 Forbidden

**Solution**:
1. Verify service user has `api-client` role
2. Check role permissions are configured correctly
3. Verify endpoint requires correct permission
4. Check `getUserRole` is working

### Rate Limit Exceeded

**Symptom**: API returns 429 Too Many Requests

**Solution**:
1. Check rate limit configuration
2. Verify rate limit is appropriate for usage
3. Implement exponential backoff in client
4. Consider increasing rate limit if legitimate usage

---

## Next Steps

After implementation:

1. Monitor service user activity for 24 hours
2. Review error logs and metrics
3. Adjust rate limits if needed
4. Document any issues and resolutions
5. Create operational runbook
6. Train team on new system