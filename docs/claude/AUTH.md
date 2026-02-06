# Authentication

## Contents

- [Overview](#overview)
- [BetterAuth (Session)](#betterauth-session)
- [Token Authentication](#token-authentication)
- [Token Types](#token-types)
- [Auth Middleware Chain](#auth-middleware-chain)
- [Spoof Middleware](#spoof-middleware)

---

## Overview

Two authentication methods, both populate the same context:

| Method | Use Case | Header/Cookie | Middleware |
|--------|----------|---------------|------------|
| Session | Browser clients | Cookie (better-auth) | `authMiddleware` |
| Token | API clients | `Authorization: Bearer <key>` | `tokenAuthMiddleware` |

Both methods ultimately set `user`, `organizationUsers`, and configure `permix`.

---

## BetterAuth (Session)

Located in `apps/api/src/lib/auth.ts`. Session-based authentication for browser clients.

### Configuration

```typescript
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL,
  basePath: '/auth',

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
      : undefined,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,  // 7 days
  },

  user: {
    additionalFields: {
      platformRole: {
        type: ['user', 'superadmin'],
        defaultValue: 'user',
        input: false,  // Can't be set by user
      },
    },
  },

  plugins: [bearer()],  // Allows session token in Authorization header

  secondaryStorage: {
    // Redis for session storage (faster lookups, distributed)
    get: async (key) => { /* redis get */ },
    set: async (key, value, ttl) => { /* redis setex */ },
    delete: async (key) => { /* redis del */ },
  },
});
```

### Auth Routes

BetterAuth exposes routes at `/auth/*`:

```
POST /auth/sign-up/email     # Email/password signup
POST /auth/sign-in/email     # Email/password login
POST /auth/sign-out          # Logout
GET  /auth/session           # Get current session
GET  /auth/sign-in/google    # Google OAuth redirect
GET  /auth/callback/google   # Google OAuth callback
```

### authMiddleware

Located in `apps/api/src/middleware/auth/authMiddleware.ts`:

```typescript
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  // Check for valid session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) return next();

  // Load user with org memberships
  const db = c.get('db');
  const user = await findUserWithOrganizationUsers(db, session.user.id);
  if (!user) return next();

  // Set context and permissions
  await setUserContext(c, user);
  await next();
}
```

---

## Token Authentication

Located in `apps/api/src/middleware/auth/tokenAuth.ts`. API key authentication.

### How It Works

1. Extract token from `Authorization: Bearer <token>` header OR `?token=<token>` URL param
2. Hash token with SHA-256
3. Look up token by hash (cached in Redis with 10-minute TTL)
4. Validate: `isActive`, not expired
5. Set context based on token type

URL token is useful for WebSocket connections, email links, file downloads (where headers can't be set).

**Security:** Token lookups are cached for 10 minutes. Revoked tokens (isActive = false) are re-validated every 10 minutes to prevent indefinite caching of compromised tokens.

### tokenAuthMiddleware

```typescript
export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  // Skip if already authenticated via session
  if (c.get('user')) return next();

  const authorization = c.req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return next();

  const apiKey = authorization.slice(7);
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Cached lookup with 10-minute TTL (balances performance with security)
  const token = await cache<TokenWithRelations | null>(
    cacheKey('Token', { keyHash }),
    () => db.token.findUnique({
      where: {
        keyHash,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: true,
        organization: true,
        organizationUser: { include: { user: true, organization: true } },
        space: true,
        spaceUser: { include: { user: true, organization: true, organizationUser: true, space: true } },
      },
    }),
    60 * 10, // 10-minute TTL to ensure revoked tokens are re-checked
  );

  if (!token) return next();

  // Update lastUsedAt (fire and forget)
  db.token.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  c.set('token', token);

  // Set up context based on token type
  if (token.ownerModel === 'User' && token.user) {
    // User token → load user with all org memberships
    const userWithOrgs = await findUserWithRelations(db, token.user.id);
    if (userWithOrgs) await setUserContext(c, userWithOrgs);
  } else if (token.ownerModel === 'OrganizationUser' && token.organizationUser) {
    // OrgUser token → use token data directly (scoped to single org)
    const { user, organization, ...orgUserFields } = token.organizationUser;
    await setUserContext(c, {
      ...user,
      organizationUsers: [orgUserFields],
      organizations: organization ? [organization] : [],
      spaceUsers: [],
      spaces: [],
    });
  } else if (token.ownerModel === 'SpaceUser' && token.spaceUser) {
    // SpaceUser token → scoped to single space
    const { user, organization, organizationUser, space, ...spaceUserFields } = token.spaceUser;
    await setUserContext(c, {
      ...user,
      organizationUsers: organizationUser ? [organizationUser] : [],
      organizations: organization ? [organization] : [],
      spaceUsers: [spaceUserFields],
      spaces: space ? [space] : [],
    });
  } else {
    // Org/Space token → just set up permissions (no user)
    await setupOrgPermissions(c);
  }

  await next();
};
```

---

## Token Types

Defined by `TokenOwnerModel` enum:

### User Token

```
ownerModel: 'User'
userId: set
organizationId: null
```

- Tied to a specific user
- Has access to all user's orgs (restricted by token's role/entitlements)
- Used for personal API access

### Organization Token

```
ownerModel: 'Organization'
userId: null
organizationId: set
```

- No user context, org-level only
- Has access only to the specific org
- Permissions set by token's role/entitlements
- Used for org-level integrations, CI/CD

### OrganizationUser Token

```
ownerModel: 'OrganizationUser'
userId: set
organizationId: set
```

- Tied to a user's membership in a specific org
- Has access only to that org
- Permissions are intersection of user's role AND token's role
- Used for scoped access to a single org

### Space Token

```
ownerModel: 'Space'
userId: null
organizationId: set
spaceId: set
```

- No user context, space-level only
- Has access to the specific space within an org
- Permissions set by token's role/entitlements
- Used for space-level integrations

### SpaceUser Token

```
ownerModel: 'SpaceUser'
userId: set
organizationId: set
spaceId: set
```

- Tied to a user's membership in a specific space
- Has access only to that space
- Permissions are intersection of user's space role AND token's role
- Used for scoped access to a single space

### Token Schema

```prisma
model Token {
  id        String   @id @default(dbgenerated("uuidv7()"))
  name      String
  keyHash   String   @unique
  keyPrefix String   // First 8 chars for identification

  // Polymorphic ownership
  ownerModel     TokenOwnerModel
  userId         String?
  organizationId String?
  spaceId        String?

  // Relations
  user             User?
  organization     Organization?
  organizationUser OrganizationUser?
  space            Space?
  spaceUser        SpaceUser?

  // Permissions
  role         Role @default(member)
  entitlements Json?

  // Rate limiting
  rateLimitPerSecond Int?

  // Lifecycle
  expiresAt  DateTime?
  lastUsedAt DateTime?
  isActive   Boolean @default(true)
}

enum TokenOwnerModel {
  User
  Organization
  OrganizationUser
  Space
  SpaceUser
}
```

---

## Auth Middleware Chain

Order matters. Applied in `apps/api/src/routes/api.ts`:

```typescript
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);      // 1. Initialize context
apiRouter.use('*', authMiddleware);      // 2. Check session auth
apiRouter.use('*', spoofMiddleware);     // 3. Allow superadmin spoofing
apiRouter.use('*', tokenAuthMiddleware); // 4. Check token auth (if no session)
```

### Flow

```
Request
  ↓
prepareRequest
  - user: null, token: null, permix: empty
  ↓
authMiddleware
  - If valid session → setUserContext() → user: User, permix: configured
  - If no session → pass through unchanged
  ↓
spoofMiddleware
  - If superadmin + spoof header → replace user context
  - Sets spoofedBy to original admin
  ↓
tokenAuthMiddleware
  - If already has user → skip (session/spoof takes precedence)
  - If valid Bearer token → set token, maybe setUserContext()
```

---

## Spoof Middleware

Located in `apps/api/src/middleware/auth/spoofMiddleware.ts`. Allows superadmins to act as other users.

```typescript
export async function spoofMiddleware(c: Context<AppEnv>, next: Next) {
  const user = c.get('user');
  if (!user || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('spoof-user-email');
  if (!rawEmail) return next();

  const spoofEmail = normalizeEmail(rawEmail);
  const spoofedUser = await findUserWithOrganizationUsers(db, spoofEmail);
  if (!spoofedUser) return next();

  // Replace context with spoofed user
  await setUserContext(c, spoofedUser);
  c.set('spoofedBy', user);  // Track original admin

  // Response headers for debugging
  c.header('spoofing-user-email', user.email);
  c.header('spoofed-user-email', spoofEmail);

  await next();
}
```

### Usage

```bash
curl -H "Cookie: <session>" \
     -H "spoof-user-email: target@example.com" \
     https://api.example.com/api/v1/me
```

### Requirements

- Caller must be authenticated as superadmin
- Target user must exist
- Original admin tracked in `spoofedBy` for audit

---

## Validation Middleware

Use these after auth to enforce requirements:

### validateUser

Requires any authenticated user (session or token with user):

```typescript
import { validateUser } from '#/middleware/validations/validateUser';

router.get('/me', validateUser, handler);  // 401 if no user
```

### validateActor

Requires any actor (user OR org/space token):

```typescript
import { validateActor } from '#/middleware/validations/validateActor';

router.get('/resource', validateActor, handler);  // 401 if no user from getActor()
```

**Difference from validateUser:**
- `validateUser` requires `c.get('user')` to be set (session or user token only)
- `validateActor` requires `getActor(c).user` to be set (works with org/space tokens that have user relations)

Use `validateActor` for endpoints that should work with both session and token auth, including org/space tokens.

### validateNotToken

Requires session auth (tokens forbidden):

```typescript
import { validateNotToken } from '#/middleware/validations/validateNotToken';

router.post('/sensitive', validateNotToken, handler);  // 403 if using token
```

### validateSuperadmin

Requires superadmin:

```typescript
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';

router.get('/admin/users', validateSuperadmin, handler);  // 403 if not superadmin
```

---

## Choosing Between validateUser and validateActor

Use this decision tree:

```
Does the endpoint need to work with org/space tokens (no user context)?
├─ YES → Use validateActor
│   ├─ Examples: Batch API, org-level operations
│   └─ Checks: getActor(c).user is set (works with delegated tokens)
└─ NO → Use validateUser
    ├─ Examples: /me endpoints, user-specific operations
    └─ Checks: c.get('user') is set (requires JWT or user token)
```

### validateUser - Requires User Context

Requires `c.get('user')` to be set:

**Works with:**
- ✅ JWT auth (authMiddleware via BetterAuth)
- ✅ User tokens (`token.ownerModel === 'User'`)
- ✅ OrganizationUser tokens (`token.ownerModel === 'OrganizationUser'`)
- ✅ SpaceUser tokens (`token.ownerModel === 'SpaceUser'`)

**Does NOT work with:**
- ❌ Organization tokens (`token.ownerModel === 'Organization'`)
- ❌ Space tokens (`token.ownerModel === 'Space'`)

### validateActor - More Permissive

Requires `getActor(c).user` to be set:

**Works with:**
- ✅ All of the above validateUser cases
- ✅ Organization tokens with organizationUser relation
- ✅ Space tokens with spaceUser relation

More permissive - works with all token types that have user relations.

### When to Use Each

| Endpoint Type | Middleware | Reason |
|--------------|------------|---------|
| `/me/*` | `validateUser` | Always requires actual user context |
| `/organization/:id/users` | `validateActor` | Org tokens need to list org users |
| `/organization/:id/spaces` | `validateActor` | Org tokens need to access org resources |
| `/batch` | `validateActor` | Should work with all token types |
| User profile update | `validateUser` | Modifying user requires user session |
| `/me/tokens` (create) | `validateUser` | Token creation requires user |

### Example

```typescript
// ❌ Wrong - org tokens can't access org resources
router.get('/organization/:id/users', validateUser, handler);

// ✅ Correct - org tokens can access org resources
router.get('/organization/:id/users', validateActor, handler);
```
