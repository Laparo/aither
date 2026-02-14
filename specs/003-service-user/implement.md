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

interface CachedToken {
  value: string;
  expiresAt: Date;
}

// In-memory token cache (use Redis/Vercel KV for horizontal scaling)
const tokenCache = new Map<string, CachedToken>();

/**
 * Get a valid service token for Hemera API access.
 * Automatically handles caching and refresh.
 */
export async function getServiceToken(): Promise<string> {
  const cacheKey = 'hemera-service-token';
  const cached = tokenCache.get(cacheKey);
  
  // Return cached token if still valid (with 2-minute buffer)
  if (cached && cached.expiresAt > new Date(Date.now() + 120000)) {
    return cached.value;
  }
  
  // Obtain new token from Clerk
  const config = loadConfig();
  const token = await obtainTokenFromClerk(config.CLERK_SERVICE_USER_ID);
  
  // Cache with 15-minute expiration
  tokenCache.set(cacheKey, {
    value: token,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  
  return token;
}

/**
 * Obtain a JWT token from Clerk for the service user.
 */
async function obtainTokenFromClerk(userId: string): Promise<string> {
  try {
    // Get user session token from Clerk
    const user = await clerkClient.users.getUser(userId);
    
    // Generate a session token for the service user
    // Note: This requires Clerk Backend SDK and appropriate permissions
    const session = await clerkClient.sessions.createSession({
      userId: user.id,
      // Add any additional session configuration here
    });
    
    // Get the JWT token from the session
    const token = await clerkClient.sessions.getToken(session.id, 'hemera-api');
    
    return token;
  } catch (error) {
    console.error('Failed to obtain service token from Clerk:', error);
    throw new Error('Service token generation failed');
  }
}

/**
 * Clear the token cache (useful for testing or forced refresh).
 */
export function clearTokenCache(): void {
  tokenCache.clear();
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
      headers: new Map(),
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
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
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });
  
  // Add more tests...
});
```

### Step 4: Environment Configuration

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
```

---

## Part 2: Hemera Implementation (Separate Project)

### Step 1: Create getUserRole Helper

Create `lib/auth/user-role.ts`:

```typescript
import { clerkClient } from '@clerk/nextjs/server';

export async function getUserRole(userId: string): Promise<string | null> {
  if (!userId) return null;
  
  try {
    const user = await clerkClient.users.getUser(userId);
    return (user?.publicMetadata?.role as string) || null;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
}
```

### Step 2: Extend Permission System

Update `lib/auth/permissions.ts`:

```typescript
export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  PARTICIPANT = 'participant',
  API_CLIENT = 'api-client', // New role
}

export enum Permission {
  // Existing permissions...
  READ_COURSES = 'read:courses',
  READ_BOOKINGS = 'read:bookings',
  READ_PARTICIPATIONS = 'read:participations',
  WRITE_PARTICIPATION_RESULTS = 'write:participation-results',
  MANAGE_COURSES = 'manage:courses',
  MANAGE_USERS = 'manage:users',
}

export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // All permissions
    Permission.READ_COURSES,
    Permission.READ_BOOKINGS,
    Permission.READ_PARTICIPATIONS,
    Permission.WRITE_PARTICIPATION_RESULTS,
    Permission.MANAGE_COURSES,
    Permission.MANAGE_USERS,
  ],
  [UserRole.API_CLIENT]: [
    // Limited permissions for service user
    Permission.READ_COURSES,
    Permission.READ_BOOKINGS,
    Permission.READ_PARTICIPATIONS,
    Permission.WRITE_PARTICIPATION_RESULTS,
  ],
  // ... other roles
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
```

### Step 3: Create Auth Guard

Create `lib/auth/service-guard.ts`:

```typescript
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getUserRole } from './user-role';
import { UserRole, Permission, hasPermission } from './permissions';

export async function requireServiceAuth(requiredPermission: Permission) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const role = await getUserRole(userId);
  
  if (!role || !hasPermission(role as UserRole, requiredPermission)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  
  return null; // Auth successful
}
```

### Step 4: Create Service Endpoints

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
      { error: 'Internal server error' },
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
    
    if (!course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(course);
  } catch (error) {
    console.error('Failed to fetch course:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

Create `app/api/service/participations/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
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
      include: {
        course: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!participation) {
      return NextResponse.json(
        { error: 'Participation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(participation);
  } catch (error) {
    console.error('Failed to fetch participation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

Create `app/api/service/participations/[id]/result/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { requireServiceAuth } from '@/lib/auth/service-guard';
import { Permission } from '@/lib/auth/permissions';
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
    const data = UpdateResultSchema.parse(body);
    
    const participation = await prisma.courseParticipation.update({
      where: { id: params.id },
      data: {
        resultOutcome: data.resultOutcome,
        resultNotes: data.resultNotes,
      },
    });
    
    return NextResponse.json(participation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Failed to update participation result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 5: Update Middleware

Update `proxy.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isServiceRoute = createRouteMatcher(['/api/service/(.*)']);

export default clerkMiddleware((auth, req) => {
  // Require authentication for service routes
  if (isServiceRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### Step 6: Add Rate Limiting

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

export async function GET(request: Request) {
  const { userId } = await auth();
  
  // Check rate limit
  const rateLimit = await checkRateLimit(`service:${userId}`);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
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