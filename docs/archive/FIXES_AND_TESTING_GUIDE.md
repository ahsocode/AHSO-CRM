# AHSO CRM — Comprehensive Fixes & Testing Guide

**Purpose:** Actionable guide for agents to fix all issues identified in PROJECT_REVIEW_REPORT.md  
**Date:** 2026-04-25  
**Status:** Ready for implementation

---

## 📋 TABLE OF CONTENTS

1. [Critical Security Fixes (3 issues)](#critical-security-fixes)
2. [High Priority Fixes (5 issues)](#high-priority-fixes)
3. [Medium Priority Fixes (10 issues)](#medium-priority-fixes)
4. [Low Priority Fixes (3 issues)](#low-priority-fixes)
5. [Testing Strategy](#testing-strategy)
6. [Implementation Order](#implementation-order)

---

# CRITICAL SECURITY FIXES

## Fix #1: Secure Auth Token Storage (XSS Prevention)

**ISSUE:** Access tokens stored in localStorage — vulnerable to XSS attacks  
**SEVERITY:** CRITICAL  
**IMPACT:** Session hijacking, token theft  
**EFFORT:** 8-12 hours

### Current Flow
```
Backend: Creates {accessToken, refreshToken}
Frontend: Stores both in localStorage
Browser: localStorage accessible via JavaScript (XSS risk!)
```

### Target Flow
```
Backend: Returns {accessToken} in body + refreshToken in HttpOnly cookie
Frontend: Stores accessToken in memory (lost on refresh)
Browser: HttpOnly cookie cannot be accessed via JavaScript
Refresh: Call POST /auth/refresh → get new accessToken in body
```

### Implementation Steps

#### Backend Changes

**File:** `backend/src/auth/auth.controller.ts`

1. **Modify login endpoint** to return refreshToken as HttpOnly cookie:
```typescript
// Current (line ~60):
return { accessToken, refreshToken };

// New:
response.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});
return { accessToken };
```

2. **Modify refresh endpoint** (`POST /auth/refresh`):
```typescript
// Current implementation should:
// 1. Read refreshToken from cookie (not body)
// 2. Validate refreshToken
// 3. Generate new accessToken
// 4. Return NEW refreshToken as cookie (rotation) + accessToken in body
// 5. Invalidate old refreshToken

// Example:
async refresh(@Req() req: Request) {
  const oldRefreshToken = req.cookies.refreshToken;
  const newTokens = await this.authService.refreshTokens(oldRefreshToken);
  
  response.cookie('refreshToken', newTokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  
  return { accessToken: newTokens.accessToken };
}
```

3. **Modify logout endpoint** to clear refreshToken cookie:
```typescript
// Current:
// Just invalidate token in DB

// New:
async logout(@Req() req: Request, @Res() response: Response) {
  const refreshToken = req.cookies.refreshToken;
  await this.authService.logout(user.id, refreshToken);
  
  response.clearCookie('refreshToken', { path: '/' });
  
  return { message: 'Logged out' };
}
```

4. **Update auth.service.ts**:
   - Add `invalidateRefreshToken(userId, token)` method
   - Add `refreshTokens(oldToken)` method with rotation logic
   - Track invalidated tokens in RefreshTokenBlacklist table (or use DB expiry)

5. **Prisma Migration** (if needed):
   - Add `isRevoked Boolean @default(false)` to refresh token storage
   - Add `revokedAt DateTime?` for audit

#### Frontend Changes

**File:** `frontend/lib/auth.ts`

1. **Remove localStorage token storage:**
```typescript
// Current:
const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

// New:
const setAccessToken = (accessToken) => {
  // Store ONLY in memory (lost on page refresh)
  // RefreshToken stays in HttpOnly cookie
  sessionStorage.setItem('accessToken', accessToken); // Fallback to sessionStorage
};

// Note: accessToken lost on page refresh is OK — user redirected to login
// refreshToken persists in cookie, so login page can auto-refresh
```

2. **Implement auto-refresh on page load:**
```typescript
const hydrateAuth = async () => {
  // On initial page load, check if we have valid accessToken in sessionStorage
  const cachedToken = sessionStorage.getItem('accessToken');
  if (cachedToken && !isTokenExpired(cachedToken)) {
    return { accessToken: cachedToken };
  }
  
  // If not, try to refresh using HttpOnly cookie (automatic via credentials)
  try {
    const { accessToken } = await apiClient.post('/auth/refresh');
    sessionStorage.setItem('accessToken', accessToken);
    return { accessToken };
  } catch {
    // No valid session, redirect to login
    redirectToLogin();
  }
};
```

**File:** `frontend/lib/api-client.ts`

3. **Update API client to use memory/sessionStorage:**
```typescript
// Current (line ~10):
const token = localStorage.getItem('accessToken');

// New:
const getAccessToken = () => {
  return sessionStorage.getItem('accessToken');
};

// In request interceptor:
config.headers.Authorization = `Bearer ${getAccessToken()}`;
```

4. **Improve 401 refresh retry:**
```typescript
// Current: Retry once
// New: 
// - Retry with refresh
// - If refresh fails, clear sessionStorage
// - Redirect to login
// - Prevent infinite loop with _retry flag
```

**File:** `frontend/hooks/use-auth.ts`

5. **Update logout to clear session:**
```typescript
const logout = async () => {
  try {
    await apiClient.post('/auth/logout'); // Clears cookie on backend
  } finally {
    sessionStorage.removeItem('accessToken');
    redirectToLogin();
  }
};
```

### Testing

#### Backend Tests

```typescript
// File: backend/src/auth/auth.controller.spec.ts

describe('Auth Controller - Token Security', () => {
  
  it('POST /auth/login returns accessToken in body, refreshToken in HttpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@ahso.vn', password: 'AHSO123!' });
    
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeUndefined(); // NOT in body
    
    const setCookie = response.headers['set-cookie'][0];
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure'); // In production
    expect(setCookie).toContain('SameSite=Strict');
  });
  
  it('POST /auth/refresh returns new accessToken, rotates refreshToken cookie', async () => {
    const loginRes = await login();
    const oldCookie = loginRes.headers['set-cookie'][0];
    
    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', oldCookie);
    
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.accessToken).not.toEqual(loginRes.body.accessToken); // New token
    
    const newCookie = refreshRes.headers['set-cookie'][0];
    expect(newCookie).toContain('refreshToken=');
    // Should be different from old cookie (rotation)
  });
  
  it('POST /auth/logout clears refreshToken cookie', async () => {
    const loginRes = await login();
    const cookie = loginRes.headers['set-cookie'][0];
    
    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    
    const setCookie = logoutRes.headers['set-cookie'][0];
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('Max-Age=0'); // Cleared
  });
  
  it('POST /auth/refresh fails if refreshToken cookie is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', ''); // No cookie
    
    expect(response.status).toBe(401);
  });
});
```

#### Frontend Tests

```typescript
// File: frontend/__tests__/auth.test.ts

describe('Auth Token Security', () => {
  
  it('sessionStorage contains accessToken, NOT localStorage', async () => {
    await login('admin@ahso.vn', 'AHSO123!');
    
    expect(sessionStorage.getItem('accessToken')).toBeDefined();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
  
  it('accessToken removed from sessionStorage on logout', async () => {
    await login('admin@ahso.vn', 'AHSO123!');
    expect(sessionStorage.getItem('accessToken')).toBeDefined();
    
    await logout();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });
  
  it('API client attaches accessToken to Authorization header', async () => {
    await login('admin@ahso.vn', 'AHSO123!');
    
    const spy = jest.spyOn(apiClient, 'get');
    await apiClient.get('/customers');
    
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer ')
        })
      })
    );
  });
  
  it('401 response triggers refresh and retry', async () => {
    await login('admin@ahso.vn', 'AHSO123!');
    
    // Simulate 401 (token expired)
    fetchMock.mockResponseOnce('Unauthorized', { status: 401 });
    // Refresh endpoint succeeds
    fetchMock.mockResponseOnce(JSON.stringify({ accessToken: 'new-token' }));
    // Original request retried
    fetchMock.mockResponseOnce(JSON.stringify({ data: [] }));
    
    const result = await apiClient.get('/customers');
    
    expect(result.data).toBeDefined();
    expect(sessionStorage.getItem('accessToken')).toBe('new-token');
  });
});
```

#### Manual Testing (QA Checklist)

```
✅ Login flow:
  - [ ] User logs in
  - [ ] Browser Network tab shows refreshToken cookie with HttpOnly flag
  - [ ] Browser Application/Storage shows NO token in localStorage
  - [ ] Browser Application/Session Storage shows accessToken only
  - [ ] Browser Console shows Cookies tab has refreshToken

✅ Page refresh:
  - [ ] User on /customers page
  - [ ] Refresh page (F5)
  - [ ] Brief loading state, then page reloads
  - [ ] Session preserved (no redirect to login)
  - [ ] accessToken refreshed invisibly (verify in Network tab)

✅ XSS protection:
  - [ ] Open Browser Console
  - [ ] Type: `localStorage.getItem('accessToken')` → returns null
  - [ ] Type: `document.cookie` → shows refreshToken with HttpOnly (cannot read value)
  - [ ] Type: `sessionStorage.getItem('accessToken')` → shows token (expected in sessionStorage)

✅ Logout:
  - [ ] User logs out
  - [ ] Redirect to login
  - [ ] Browser Network: refreshToken cookie has Max-Age=0
  - [ ] sessionStorage cleared

✅ Token expiry:
  - [ ] User on /customers
  - [ ] Manually delete accessToken from sessionStorage (in DevTools)
  - [ ] Trigger any API call (or wait for auto-refresh)
  - [ ] Refresh succeeds silently
  - [ ] No user-visible disruption

✅ Malicious XSS attempt:
  - [ ] User visits compromised page with XSS payload
  - [ ] Payload tries: `stolen = localStorage.getItem('accessToken')` → null
  - [ ] Payload tries: `stolen = document.cookie` → fails (HttpOnly)
  - [ ] Payload CANNOT steal token
```

---

## Fix #2: Protect Public Settings Endpoints (Data Leakage)

**ISSUE:** GET /api/settings and /api/settings/policies leak company secrets (tax ID, bank details)  
**SEVERITY:** CRITICAL  
**IMPACT:** Information disclosure, competitive intelligence leak  
**EFFORT:** 2-4 hours

### Current Behavior
```
GET /api/settings (unauthenticated)
→ Returns { company: { name, taxId, bankAccount, ... }, policies: {...} }
→ Publicly visible, no authentication required
```

### Target Behavior
```
GET /api/settings/public (unauthenticated)
→ Returns { company: { name, logo, description }, language: 'vi' }

GET /api/settings (authenticated, admin)
→ Returns full { company: {...}, policies: {...}, ... }

GET /api/settings/company-info (authenticated, admin)
→ Returns full company object with bank details
```

### Implementation Steps

#### Backend Changes

**File:** `backend/src/settings/settings.controller.ts`

1. **Create public DTO:**
```typescript
// File: backend/src/settings/dto/public-settings.dto.ts
import { z } from 'zod';

export const PublicSettingsSchema = z.object({
  company: z.object({
    name: z.string(),
    logo: z.string().nullable(),
    description: z.string().optional(),
    website: z.string().optional(),
  }),
  language: z.enum(['vi', 'vi-en']).default('vi'),
});

export type PublicSettings = z.infer<typeof PublicSettingsSchema>;
```

2. **Split settings endpoints:**
```typescript
// Current (line ~30):
@Get()
async getSettings() {
  return this.settingsService.getAllSettings();
}

// New:
@Get('public')
async getPublicSettings() {
  // Unauthenticated endpoint
  const fullSettings = await this.settingsService.getAllSettings();
  return this.mapToPublic(fullSettings);
}

@Get()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('settings', 'view')
async getAllSettings(@Req() user: JwtUser) {
  // Authenticated admin-only
  return this.settingsService.getAllSettings();
}

@Get('policies')
async getPublicPolicies() {
  // Unauthenticated: return public policy summaries ONLY
  // NOT full policy details
  return {
    message: 'For detailed policies, contact admin@ahso.vn'
  };
}

@Get('policies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('settings', 'view')
async getPolicies(@Req() user: JwtUser) {
  // Authenticated admin-only
  const settings = await this.settingsService.getAllSettings();
  return settings.policies;
}

private mapToPublic(settings: any): PublicSettings {
  return {
    company: {
      name: settings.company?.name,
      logo: settings.company?.logo,
      description: settings.company?.description,
      website: settings.company?.website,
    },
    language: 'vi',
  };
}
```

3. **Remove secret fields from responses:**
   - Remove `taxCode` from public API
   - Remove `bankAccount`, `bankBranch`, `bankName`, `swift` from public API
   - Remove full `policies` (payment terms, warranty terms) from public API

#### Frontend Changes

**File:** `frontend/lib/api-client.ts`

1. **Update API calls:**
```typescript
// For public company info (login page, footer):
const getPublicSettings = () => apiClient.get('/settings/public');

// For admin settings (admin panel, authenticated):
const getAllSettings = () => apiClient.get('/settings');

// For admin policies:
const getPolicies = () => apiClient.get('/settings/policies');
```

### Testing

#### Backend Tests

```typescript
// File: backend/src/settings/settings.controller.spec.ts

describe('Settings Controller - Public vs Admin', () => {
  
  it('GET /api/settings/public returns ONLY public fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/settings/public');
    
    expect(response.status).toBe(200);
    expect(response.body.company.name).toBeDefined();
    expect(response.body.company.logo).toBeDefined();
    
    // Secret fields MUST NOT be present
    expect(response.body.company.taxCode).toBeUndefined();
    expect(response.body.company.bankAccount).toBeUndefined();
    expect(response.body.company.bankName).toBeUndefined();
    expect(response.body.company.bankBranch).toBeUndefined();
    expect(response.body.company.swift).toBeUndefined();
    expect(response.body.policies).toBeUndefined();
  });
  
  it('GET /api/settings/public works without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/settings/public')
      .set('Authorization', ''); // No auth header
    
    expect(response.status).toBe(200); // Should not require auth
  });
  
  it('GET /api/settings requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/settings');
    
    expect(response.status).toBe(401); // Unauthorized
  });
  
  it('GET /api/settings returns FULL data for authenticated admin', async () => {
    const { accessToken } = await login('admin@ahso.vn');
    
    const response = await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.company.name).toBeDefined();
    expect(response.body.company.taxCode).toBeDefined(); // Admin can see
    expect(response.body.company.bankAccount).toBeDefined(); // Admin can see
    expect(response.body.policies).toBeDefined(); // Admin can see
  });
  
  it('GET /api/settings/policies requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/settings/policies');
    
    expect(response.status).toBe(401); // Or 200 with generic message
  });
});
```

#### Manual Testing

```
✅ Check public endpoint:
  - [ ] Unauthenticated: curl http://localhost:3001/api/settings/public
  - [ ] Response contains: company.name, company.logo
  - [ ] Response does NOT contain: taxCode, bankAccount, bankBranch
  - [ ] Response status: 200 (no auth required)

✅ Check admin endpoint:
  - [ ] Unauthenticated: curl http://localhost:3001/api/settings
  - [ ] Response status: 401 Unauthorized
  
  - [ ] Authenticated: curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/settings
  - [ ] Response contains: taxCode, bankAccount, bankBranch, policies
  - [ ] Response status: 200

✅ Check login page:
  - [ ] Open /login
  - [ ] Browser Network tab shows GET /api/settings/public
  - [ ] Response 200, no sensitive data
  - [ ] Verify company logo loads correctly

✅ Check admin panel:
  - [ ] Login as admin
  - [ ] Open /admin/company-info
  - [ ] Browser Network tab shows GET /api/settings
  - [ ] Response includes bankAccount and other secret fields
```

---

## Fix #3: Complete RBAC Permission Enforcement (Inconsistent Guards)

**ISSUE:** Core CRM endpoints lack consistent `@RequirePermissions()` decorators  
**SEVERITY:** CRITICAL  
**IMPACT:** Custom roles cannot constrain CRUD; STAFF user can perform admin actions  
**EFFORT:** 12-20 hours

### Current State
```
✅ Some endpoints: @UseGuards(PermissionsGuard) @RequirePermissions('customers', 'create')
❌ Some endpoints: @UseGuards(JwtAuthGuard) [missing PermissionsGuard]
❌ Some endpoints: No guard at all

Result: Permission system is foundation-only, not enforced end-to-end
```

### Target State
```
✅ ALL mutating endpoints (POST, PUT, DELETE, PATCH):
  - @UseGuards(JwtAuthGuard, PermissionsGuard)
  - @RequirePermissions('resource', 'action')

✅ ALL sensitive reads (detail pages, analytics):
  - Same guards

✅ Tested: Custom role (VIEWER with only *.view) cannot mutate
```

### Implementation Steps

#### Audit Phase (2 hours)

1. **Scan all controllers for missing guards:**
```bash
grep -r "@Post\|@Put\|@Delete\|@Patch" backend/src/**/*.controller.ts | \
  grep -v "@UseGuards" | \
  grep -v "@Public()"
```

2. **Create audit spreadsheet:**
```
Endpoint              | Method | Current Guards        | Required Guards
POST /customers       | POST   | JwtAuthGuard          | PermissionsGuard + @RequirePermissions('customers', 'create')
PUT /customers/:id    | PUT    | JwtAuthGuard          | PermissionsGuard + @RequirePermissions('customers', 'edit')
DELETE /customers/:id | DELETE | JwtAuthGuard          | PermissionsGuard + @RequirePermissions('customers', 'delete')
...
```

#### Implementation Phase (10-16 hours)

**For EACH endpoint (systematically):**

1. **Add PermissionsGuard:**
```typescript
// Current:
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreateCustomerDto) { }

// New:
@Post()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('customers', 'create')
async create(@Body() dto: CreateCustomerDto) { }
```

2. **Apply to all 24 modules:**
   - customers.controller.ts (6 endpoints: list, get, create, update, delete, restore)
   - projects.controller.ts (8 endpoints: list, get, create, update, delete, kanban, restore, etc.)
   - quotes.controller.ts (10 endpoints: CRUD + PDF + preview + versioning)
   - contracts.controller.ts (10 endpoints: CRUD + milestones + payments + PDF + restore)
   - activities.controller.ts (6 endpoints: CRUD + restore)
   - calendar.controller.ts (4 endpoints: list, create, update, delete)
   - reports.controller.ts (4 endpoints: revenue, status, pipeline, customers)
   - admin/* modules (roles, permissions, users, settings)
   - dashboard.controller.ts (KPIs, trending, tasks)
   - documents.controller.ts (all document generation endpoints)
   - Plus: upload, notifications, webhooks, etc.

3. **Define permission matrix (from existing system):**

```typescript
// File: backend/src/common/constants/permissions.ts

export const PERMISSION_MATRIX = {
  // Customers
  'customers.view': 'View customers',
  'customers.create': 'Create customers',
  'customers.edit': 'Edit customers',
  'customers.delete': 'Delete customers',
  'customers.restore': 'Restore deleted customers',
  
  // Projects
  'projects.view': 'View projects',
  'projects.create': 'Create projects',
  'projects.edit': 'Edit projects',
  'projects.delete': 'Delete projects',
  'projects.kanban': 'Use kanban board',
  'projects.restore': 'Restore deleted projects',
  
  // Quotes
  'quotes.view': 'View quotes',
  'quotes.create': 'Create quotes',
  'quotes.edit': 'Edit quotes',
  'quotes.delete': 'Delete quotes',
  'quotes.pdf': 'Generate PDF',
  'quotes.email': 'Email quotes',
  
  // Contracts
  'contracts.view': 'View contracts',
  'contracts.create': 'Create contracts',
  'contracts.edit': 'Edit contracts',
  'contracts.delete': 'Delete contracts',
  'contracts.milestone': 'Manage milestones',
  'contracts.payment': 'Log payments',
  'contracts.acceptance': 'Accept contracts',
  'contracts.restore': 'Restore deleted contracts',
  
  // Activities
  'activities.view': 'View activities',
  'activities.create': 'Create activities',
  'activities.edit': 'Edit activities',
  'activities.delete': 'Delete activities',
  'activities.restore': 'Restore deleted activities',
  
  // Calendar
  'calendar.view': 'View calendar',
  'calendar.create': 'Create events',
  'calendar.edit': 'Edit events',
  'calendar.delete': 'Delete events',
  
  // Reports
  'reports.view': 'View reports',
  'reports.export': 'Export reports',
  
  // Admin
  'admin.roles': 'Manage roles',
  'admin.permissions': 'Manage permissions',
  'admin.users': 'Manage users',
  'admin.settings': 'Manage settings',
  'admin.audit': 'View audit logs',
  
  // Documents
  'documents.generate': 'Generate documents',
  'documents.preview': 'Preview documents',
  'documents.download': 'Download documents',
};
```

4. **Assign to system roles:**

```typescript
// File: backend/src/common/constants/system-roles.ts

export const SYSTEM_ROLES = {
  ADMIN: {
    name: 'ADMIN',
    permissions: [
      // All permissions
      'customers.*', 'projects.*', 'quotes.*', 'contracts.*', 
      'activities.*', 'calendar.*', 'reports.*', 'admin.*', 'documents.*'
    ]
  },
  
  MANAGER: {
    name: 'MANAGER',
    permissions: [
      'customers.view', 'customers.create', 'customers.edit',
      'projects.view', 'projects.create', 'projects.edit', 'projects.kanban',
      'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.pdf', 'quotes.email',
      'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.milestone', 'contracts.payment', 'contracts.acceptance',
      'activities.view', 'activities.create', 'activities.edit',
      'calendar.view', 'calendar.create', 'calendar.edit',
      'reports.view',
      'documents.generate', 'documents.preview', 'documents.download',
    ]
  },
  
  STAFF: {
    name: 'STAFF',
    permissions: [
      'customers.view',
      'projects.view', 'projects.kanban',
      'quotes.view', 'quotes.pdf', // View/read only
      'contracts.view',
      'activities.view', 'activities.create', 'activities.edit',
      'calendar.view', 'calendar.create', 'calendar.edit',
      'reports.view',
      'documents.preview', 'documents.download',
    ]
  },
};
```

#### Testing Phase (2-4 hours)

**File:** `backend/src/common/guards/permissions.guard.spec.ts`

```typescript
describe('Permissions Guard - RBAC Enforcement', () => {
  
  it('STAFF user blocked from POST /customers (create)', async () => {
    const staffToken = await loginAs('staff@ahso.vn', 'STAFF');
    
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'New Company', taxCode: '123456' });
    
    expect(response.status).toBe(403); // Forbidden
    expect(response.body.message).toContain('Bạn không có quyền'); // Vietnamese
  });
  
  it('MANAGER user allowed POST /customers (create)', async () => {
    const managerToken = await loginAs('manager@ahso.vn', 'MANAGER');
    
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'New Company', taxCode: '123456' });
    
    expect(response.status).toBe(201); // Created
  });
  
  it('STAFF user allowed GET /customers (view)', async () => {
    const staffToken = await loginAs('staff@ahso.vn', 'STAFF');
    
    const response = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`);
    
    expect(response.status).toBe(200); // OK
  });
  
  it('Custom role (VIEWER) with only *.view allowed GET, blocked POST', async () => {
    // Assume VIEWER role exists with: customers.view, projects.view, quotes.view
    const viewerToken = await loginAs('viewer@ahso.vn', 'VIEWER');
    
    // GET allowed
    let response = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(200);
    
    // POST blocked
    response = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'New' });
    expect(response.status).toBe(403);
  });
  
  it('Missing permission decorator logs warning (audit)', async () => {
    // Scan all controllers for missing @RequirePermissions
    const missingDecorators = scanControllers();
    expect(missingDecorators.length).toBe(0);
  });
});
```

**Manual Testing Checklist:**

```
✅ Test STAFF user:
  - [ ] Login as staff@ahso.vn (STAFF role)
  - [ ] GET /customers → 200 ✅
  - [ ] POST /customers (create) → 403 ❌ (expected)
  - [ ] PUT /customers/:id (edit) → 403 ❌ (expected)
  - [ ] DELETE /customers/:id → 403 ❌ (expected)

✅ Test MANAGER user:
  - [ ] Login as manager@ahso.vn (MANAGER role)
  - [ ] GET /customers → 200 ✅
  - [ ] POST /customers (create) → 201 ✅
  - [ ] PUT /customers/:id (edit) → 200 ✅
  - [ ] DELETE /customers/:id → 200 ✅

✅ Test ADMIN user:
  - [ ] Login as admin@ahso.vn (ADMIN role)
  - [ ] All endpoints 200/201/204 ✅

✅ Test custom VIEWER role:
  - [ ] Create custom role: VIEWER with permissions: *.view
  - [ ] Assign to test user
  - [ ] Login as viewer user
  - [ ] GET /customers → 200 ✅
  - [ ] POST /customers → 403 ❌
  - [ ] GET /admin/roles → 403 ❌

✅ Test error messages:
  - [ ] 403 response contains Vietnamese message: "Bạn không có quyền..."
  - [ ] Frontend shows user-friendly toast notification
```

---

# HIGH PRIORITY FIXES

## Fix #4: WebSocket CORS Consistency

**ISSUE:** Socket.IO CORS more permissive than HTTP API  
**SEVERITY:** HIGH  
**IMPACT:** Potential CORS bypass attack  
**EFFORT:** 1 hour

### Current State
```
HTTP API CORS: 
  origins: ['http://localhost:3000']

Socket.IO CORS:
  origins: ['*']  ← TOO PERMISSIVE
```

### Target State
```
Both use: origins: [process.env.FRONTEND_URL || 'http://localhost:3000']
```

### Implementation

**File:** `backend/src/main.ts`

```typescript
// Extract CORS config to constant
const CORS_CONFIG = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
};

// Apply to HTTP API
app.enableCors(CORS_CONFIG);

// File: backend/src/websocket/websocket.gateway.ts
@WebSocketGateway({
  cors: CORS_CONFIG,
})
export class WebsocketGateway implements OnGatewayConnection {
  // ...
}
```

### Testing

```bash
# Test HTTP CORS rejection
curl -H "Origin: http://attacker.com" http://localhost:3001/api/customers
# Expected: 403 Forbidden

# Test Socket.IO CORS rejection
# Use JavaScript to attempt connection from attacker.com
# Expected: Connection refused
```

---

## Fix #5: Implement Soft Delete Recovery

**ISSUE:** Users can delete but not recover customers/projects/activities  
**SEVERITY:** HIGH  
**IMPACT:** Operational risk; deleted data permanently lost  
**EFFORT:** 4-8 hours

### Current State
```
DELETE /customers/:id → sets deletedAt = now()
GET /customers → filters where deletedAt IS NULL
❌ No PATCH /customers/:id/restore endpoint
```

### Target State
```
✅ PATCH /customers/:id/restore → sets deletedAt = NULL
✅ GET /customers/:id/deleted → list deleted (admin only)
✅ Recovery available on detail page UI
```

### Implementation Steps

#### Backend

**File:** `backend/src/customers/customers.controller.ts`

```typescript
@Patch(':id/restore')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('customers', 'restore')
async restore(@Param('id') id: string, @Req() user: JwtUser) {
  return this.customersService.restore(id, user);
}

@Get('deleted')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('customers', 'view')
async getDeleted(@Query() query: PaginationDto) {
  return this.customersService.findDeleted(query);
}
```

**File:** `backend/src/customers/customers.service.ts`

```typescript
async restore(id: string, user: JwtUser) {
  const customer = await this.prisma.customer.findUnique({ where: { id } });
  
  if (!customer) {
    throw new NotFoundException('Khách hàng không tồn tại');
  }
  
  if (!customer.deletedAt) {
    throw new BadRequestException('Khách hàng không bị xóa');
  }
  
  return this.prisma.customer.update({
    where: { id },
    data: { deletedAt: null }
  });
}

async findDeleted(query: PaginationDto) {
  const { skip, take } = this.buildPagination(query);
  
  return Promise.all([
    this.prisma.customer.findMany({
      where: { deletedAt: { not: null } },
      skip,
      take,
      orderBy: { deletedAt: 'desc' }
    }),
    this.prisma.customer.count({
      where: { deletedAt: { not: null } }
    })
  ]).then(([items, total]) => ({
    data: items,
    meta: { total, skip, take }
  }));
}
```

#### Frontend

**File:** `frontend/app/(dashboard)/customers/[id]/_components/customer-actions.tsx`

```typescript
export function CustomerActions({ customer, onRestored }: {
  customer: Customer
  onRestored: () => void
}) {
  const { mutate: restore, isPending } = useMutation({
    mutationFn: () => apiClient.patch(`/customers/${customer.id}/restore`),
    onSuccess: () => {
      toast.success('Đã khôi phục khách hàng');
      onRestored();
    }
  });
  
  if (customer.deletedAt) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Khôi phục</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Khôi phục khách hàng?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này sẽ khôi phục khách hàng {customer.name} từ thùng rác.
          </AlertDialogDescription>
          <AlertDialogAction onClick={() => restore()} disabled={isPending}>
            {isPending ? 'Đang khôi phục...' : 'Khôi phục'}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  
  // Delete button (existing)
  return <DeleteButton ... />;
}
```

### Testing

```typescript
describe('Soft Delete Recovery', () => {
  it('PATCH /customers/:id/restore recovers deleted customer', async () => {
    // Create and delete
    const customer = await createCustomer('Test Co');
    await apiClient.delete(`/customers/${customer.id}`);
    
    // Should not appear in list
    let list = await apiClient.get('/customers');
    expect(list.data).not.toContainEqual(expect.objectContaining({ id: customer.id }));
    
    // Restore
    const restored = await apiClient.patch(`/customers/${customer.id}/restore`);
    expect(restored.deletedAt).toBeNull();
    
    // Should appear in list again
    list = await apiClient.get('/customers');
    expect(list.data).toContainEqual(expect.objectContaining({ id: customer.id }));
  });
  
  it('GET /customers/deleted lists only deleted items', async () => {
    const customer1 = await createCustomer('Active');
    const customer2 = await createCustomer('Deleted');
    await apiClient.delete(`/customers/${customer2.id}`);
    
    const deleted = await apiClient.get('/customers/deleted');
    expect(deleted.data).toHaveLength(1);
    expect(deleted.data[0].id).toBe(customer2.id);
  });
});
```

---

## Fix #6-10: Additional High Priority Fixes

For brevity, I'll summarize the remaining high priority fixes. Each follows the same pattern (Current → Target → Implementation Steps → Testing):

### Fix #6: Monolithic Services Refactoring
**Files:** projects.service.ts (1563 lines), reports.service.ts (1045 lines), quotes.service.ts (956 lines)  
**Fix:** Split into sub-services (ProjectsKanbanService, ProjectsTimelineService, etc.)  
**Effort:** 16-24 hours

### Fix #7: Consistent Error Messages (Vietnamese)
**Files:** All error handling (error.filter.ts, exception handlers)  
**Fix:** Ensure all error messages are in Vietnamese  
**Effort:** 2-4 hours

### Fix #8: Add Swagger Decorators to All Endpoints
**Files:** All *.controller.ts  
**Fix:** Add @ApiOperation, @ApiResponse, @ApiParam, @ApiQuery  
**Effort:** 6-12 hours

### Fix #9: Swagger Disabled in Production
**Files:** backend/src/main.ts  
**Fix:** Disable Swagger when NODE_ENV === 'production'  
**Effort:** 0.5 hours

### Fix #10: Add Config Validation at Startup
**Files:** backend/src/main.ts  
**Fix:** Validate required env vars exist before app starts  
**Effort:** 1-2 hours

---

# MEDIUM PRIORITY FIXES

## Categories:
1. Expand test coverage (integration tests, component tests, error paths) — 30-40 hours
2. Frontend component complexity (split large components) — 8-16 hours
3. Database query optimization (eliminate N+1, use select()) — 4-8 hours
4. Complete API documentation (Swagger, README) — 6-12 hours
5. Add monitoring/alerting setup — 4-8 hours
6. Implement external secret management — 4-6 hours
7. Add soft delete recovery UI to all modules — 4-8 hours
8. Setup database backup strategy — 2-4 hours
9. Add API versioning strategy — 2-4 hours
10. Dependency updates and Dependabot setup — 2-4 hours

---

# TESTING STRATEGY

## Overall Approach

```
Layer 1: Unit Tests (35-45% current → 60-70% target)
  - Service methods isolated
  - Mocked databases
  - ~40 hours to expand

Layer 2: Integration Tests (0% current → 40%+ target)
  - Real database
  - API endpoints
  - Full request/response cycle
  - ~30-40 hours to add

Layer 3: E2E Tests (15 smoke tests, expand to critical paths)
  - Playwright full workflows
  - Login → Create → Draft → Submit
  - ~15-20 hours to expand

Layer 4: Manual/QA Testing
  - Permission denials
  - Error states
  - Concurrent requests
  - ~10-15 hours
```

## Phased Testing Plan

### Phase 1: Fix Critical Issues (with unit tests)
- Auth token storage refactor (include unit + integration tests)
- Settings protection (include unit tests)
- RBAC enforcement (include unit + integration tests)

### Phase 2: Expand Test Coverage
- Add integration tests for all 24 controllers
- Add component tests for critical React pages
- Add error path tests

### Phase 3: Full QA & Load Testing
- Manual testing checklist
- Load test with realistic data volume
- Performance benchmarking

---

# IMPLEMENTATION ORDER

## Week 1: Critical Security Fixes
```
Day 1-2: Fix #1 — Auth token storage (8-12h)
Day 3: Fix #2 — Settings protection (2-4h)
Day 4-5: Fix #3 — RBAC enforcement (12-20h)
Tests: Unit + integration for each fix
```

## Week 2: High Priority Fixes
```
Day 1: Fix #4 — WebSocket CORS (1h)
Day 2-4: Fix #5 — Soft delete recovery (4-8h)
Day 5: Other high priority fixes (#6-#10)
Tests: Unit + integration for each
```

## Week 3-4: Test Coverage Expansion
```
Phase: Add integration tests for all 24 modules (~30-40h)
Phase: Add component tests for critical UI (~16-20h)
Phase: Expand error path testing (~8-16h)
```

## Week 5-6: Documentation & Optimization
```
Phase: Complete API documentation (6-12h)
Phase: Refactor monolithic services (16-24h)
Phase: Database query optimization (4-8h)
```

## Week 7-8: Deployment Prep
```
Phase: Setup monitoring/alerting (4-8h)
Phase: External secret management (4-6h)
Phase: Load testing & performance tuning (8-12h)
Phase: Final QA & sign-off (10-15h)
```

---

**Total Effort:** 72-126 hours (2-3 weeks with dedicated team)  
**Target Production Readiness:** 6-8 weeks

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-25  
**Owner:** AHSO Vietnam Engineering Team
