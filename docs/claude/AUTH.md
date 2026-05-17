# Authentication & Authorization

<!-- toc:start -->

## Contents

- [Authentication](#authentication)
  - [Backend](#backend)
    - [Overview](#overview)
    - [BetterAuth (Session)](#betterauth-session)
    - [OAuth + Bearer Tokens](#oauth--bearer-tokens)
    - [Multi-Provider Authentication (AuthProvider)](#multi-provider-authentication-authprovider)
    - [Token Authentication](#token-authentication)
    - [Token Types](#token-types)
    - [Auth Middleware Chain](#auth-middleware-chain)
    - [Spoof Middleware](#spoof-middleware)
    - [Validation Middleware](#validation-middleware)
    - [Choosing Between validateUser and validateActor](#choosing-between-validateuser-and-validateactor)
  - [Frontend](#frontend)
    - [Architecture](#architecture)
    - [Hooks](#hooks)
    - [Login/Signup Pattern](#loginsignup-pattern)
    - [Components](#components)
    - [Types](#types)
    - [OAuth/SAML](#oauthsaml)
    - [Navigation Patterns](#navigation-patterns)
    - [Guards](#guards)
    - [Store Integration](#store-integration)
    - [Error Handling](#error-handling)
    - [Testing](#testing)
    - [Security](#security)
    - [Common Patterns](#common-patterns)
    - [Key Files](#key-files)
- [Authorization](#authorization)

<!-- toc:end -->

Authentication = "who is this caller?" (sessions, tokens, OAuth, SAML).
Authorization = "what can they do?" (ReBAC permissions — see [PERMISSIONS.md](./PERMISSIONS.md)).

## Authentication

### Backend


#### Overview

Two authentication methods, both populate the same context:

| Method | Use Case | Header/Cookie | Middleware |
|--------|----------|---------------|------------|
| Session | Browser clients | Cookie (better-auth) | `authMiddleware` |
| Token | API clients | `Authorization: Bearer <key>` | `tokenAuthMiddleware` |

Both methods ultimately set `user`, `organizationUsers`, and configure `permix`.

---

#### BetterAuth (Session)

Located in `apps/api/src/lib/auth.ts`. Session-based authentication for browser clients.

##### Configuration

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
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,  // 5-minute cache window (stateless JWT in cookie)
    },
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
    // Redis for frequently-accessed data (permissions, org lists)
    // NOT primary session storage (uses stateless JWT)
    get: async (key) => { /* redis get */ },
    set: async (key, value, ttl) => { /* redis setex */ },
    delete: async (key) => { /* redis del */ },
  },
});
```

##### Session Storage Strategy

Sessions use **stateless JWT tokens** stored in HTTP-only cookies (not database-backed).

- **Primary:** JWT cookie with 5-minute cache window
- **Secondary:** Redis for frequently-accessed data (permissions, org lists)
- **Benefit:** Horizontal scaling without session affinity or database lookups
- **Tradeoff:** 5-minute delay for permission revocation propagation

This means:
- ✅ No database hit for session validation
- ✅ Scales horizontally without sticky sessions
- ⚠️ Permission changes take up to 5 minutes to propagate (cache window)

##### Auth Routes

BetterAuth exposes routes at `/auth/*`:

```
POST /auth/sign-up/email     # Email/password signup
POST /auth/sign-in/email     # Email/password signin
POST /auth/sign-out          # Sign out
GET  /auth/session           # Get current session
GET  /auth/sign-in/google    # Google OAuth redirect
GET  /auth/callback/google   # Google OAuth callback
```

##### authMiddleware

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

#### OAuth + Bearer Tokens

Located in `packages/ui/src/lib/auth/signin.ts` and `/apps/*/app/routes/_public/auth.callback.tsx`.

##### OAuth Flow

1. **User clicks OAuth provider** (e.g., "Continue with Google")
2. **Frontend calls BetterAuth** via `client.signIn.social({ provider, callbackURL })`
3. **BetterAuth redirects** to OAuth provider (Google, GitHub, etc.)
4. **User authenticates** with provider
5. **Provider redirects back** to `/auth/callback?token=...`
6. **Callback route extracts token**:
   - Read token from query param or hash
   - Store in localStorage via `setToken()`
   - Hydrate user data via `fetchAndHydrateMe()`
   - Navigate to redirectTo destination

##### Bearer Token Pattern

OAuth flow returns a **bearer token** (not just session cookie):

```typescript
// Callback route (apps/web/app/routes/_public/auth.callback.tsx)
const url = new URL(window.location.href);
const token = url.searchParams.get('token') || url.hash.match(/token=([^&]+)/)?.[1];

if (token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  setToken(token, expiresAt);
  await fetchAndHydrateMe(store.setState, store.getState);
  navigate({ to: redirectTo });
}
```

All API requests include the bearer token:

```typescript
Authorization: Bearer <token>
```

See [Frontend Auth](#frontend-auth) for frontend implementation details.

---

#### Multi-Provider Authentication (AuthProvider)

**Status:** ✅ Complete
**Location:** `apps/api/src/modules/authProvider/`

The template supports configurable authentication providers at both the platform and organization level, enabling multi-tenant OAuth/SAML configurations.

##### Architecture

**Two Provider Types:**

1. **Platform Providers** (`organizationId = null`)
   - Available to all organizations
   - Configured by platform administrators
   - Examples: Google, Microsoft, GitHub
   - Listed in `apps/api/src/lib/auth/platformProviders.ts`

2. **Organization Providers** (`organizationId != null`)
   - Organization-specific configurations
   - Configured by organization administrators
   - Examples: Custom OAuth apps, SAML/SSO (Okta, Azure AD)
   - Isolated per organization for security

##### Database Schema

```prisma
model AuthProvider {
  id               AuthProviderId
  organizationId   OrganizationId?  // null = platform, set = organization

  name             String            // Display name
  provider         AuthProviderType  // GOOGLE | MICROSOFT | GITHUB | OKTA | SAML
  config           Json              // Provider configuration
  encryptedData    Json              // Encrypted secrets (client secret, certs)
  encryptionVersion Int              // Key rotation support
  enabled          Boolean           // Toggle on/off

  organization     Organization?
  @@unique([organizationId, name])
}
```

##### Encryption

**All sensitive data is encrypted** using AES-256-GCM:

```typescript
import { encryptionService } from '@template/shared/lib/encryption';

// Encrypt secrets
const { encryptedData, version } = encryptionService.encrypt(
  { clientSecret: 'secret', certificate: 'cert' },
  `authProvider:${providerId}`,  // AAD binds ciphertext to context
);

// Decrypt
const secrets = encryptionService.decrypt(
  encryptedData,
  `authProvider:${providerId}`,
  version,
);
```

**Security Features:**
- AES-256-GCM authenticated encryption
- Additional Authenticated Data (AAD) prevents tampering
- Key versioning supports rotation without downtime

##### API Endpoints

**Organization-scoped (Org Admins):**
```
POST   /organizations/:id/auth-providers      # Create provider
GET    /organizations/:id/auth-providers      # List org providers
PATCH  /auth-providers/:id                    # Update provider
DELETE /auth-providers/:id                    # Delete provider
GET    /auth-providers                        # List available providers
```

**Platform-wide (Superadmins):**
```
GET    /admin/auth-providers                  # List all providers
```

##### Example: Organization OAuth

```typescript
// Create custom Google OAuth for organization
POST /organizations/{orgId}/auth-providers
{
  "name": "Acme Google SSO",
  "provider": "GOOGLE",
  "config": {
    "clientId": "123456.apps.googleusercontent.com",
    "redirectUri": "https://acme.example.com/auth/callback",
    "allowedDomains": ["acme.com"]  // Optional domain restriction
  },
  "secrets": {
    "clientSecret": "GOCSPX-xxxxx"  // Encrypted before storage
  }
}
```

##### Provider Types

```typescript
enum AuthProviderType {
  GOOGLE      // Google OAuth
  MICROSOFT   // Microsoft/Azure AD OAuth
  GITHUB      // GitHub OAuth
  OKTA        // Okta SAML/OAuth
  SAML        // Generic SAML
}
```

##### SAML/SSO Status

**Schema ready**, **encryption ready**, **API complete**.

SAML integration requires:
- BetterAuth SAML plugin integration (in progress)
- SAML metadata parsing
- JIT (Just-In-Time) user provisioning

See [AUTH-003 ticket](../../tickets/AUTH-003-saml-sso.md) for SAML implementation timeline.

---

#### Token Authentication

Located in `apps/api/src/middleware/auth/tokenAuth.ts`. API key authentication.

##### How It Works

1. Extract token from `Authorization: Bearer <token>` header OR `?token=<token>` URL param
2. Hash token with SHA-256
3. Look up token by hash (cached in Redis with 10-minute TTL)
4. Validate: `isActive`, not expired
5. Set context based on token type

URL token is useful for WebSocket connections, email links, file downloads (where headers can't be set).

**Security:** Token lookups are cached for 10 minutes. Revoked tokens (isActive = false) are re-validated every 10 minutes to prevent indefinite caching of compromised tokens.

##### tokenAuthMiddleware

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

#### Token Types

Defined by `TokenOwnerModel` enum:

##### User Token

```
ownerModel: 'User'
userId: set
organizationId: null
```

- Tied to a specific user
- Has access to all user's orgs (restricted by token's role/entitlements)
- Used for personal API access

##### Organization Token

```
ownerModel: 'Organization'
userId: null
organizationId: set
```

- No user context, org-level only
- Has access only to the specific org
- Permissions set by token's role/entitlements
- Used for org-level integrations, CI/CD

##### OrganizationUser Token

```
ownerModel: 'OrganizationUser'
userId: set
organizationId: set
```

- Tied to a user's membership in a specific org
- Has access only to that org
- Permissions are intersection of user's role AND token's role
- Used for scoped access to a single org

##### Space Token

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

##### SpaceUser Token

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

##### Token Schema

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

#### Auth Middleware Chain

Order matters. Applied in `apps/api/src/routes/api.ts`:

```typescript
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);      // 1. Initialize context
apiRouter.use('*', authMiddleware);      // 2. Check session auth
apiRouter.use('*', spoofMiddleware);     // 3. Allow superadmin spoofing
apiRouter.use('*', tokenAuthMiddleware); // 4. Check token auth (if no session)
```

##### Flow

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

#### Spoof Middleware

Located in `apps/api/src/middleware/auth/spoofMiddleware.ts`. Allows superadmins to act as other users.

```typescript
export async function spoofMiddleware(c: Context<AppEnv>, next: Next) {
  const user = c.get('user');
  if (!user || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('x-spoof-user-email');
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

##### Usage

```bash
curl -H "Cookie: <session>" \
     -H "x-spoof-user-email: target@example.com" \
     https://api.example.com/api/v1/me
```

##### Requirements

- Caller must be authenticated as superadmin
- Target user must exist
- Original admin tracked in `spoofedBy` for audit

---

#### Validation Middleware

Use these after auth to enforce requirements:

##### validateUser

Requires any authenticated user (session or token with user):

```typescript
import { validateUser } from '#/middleware/validations/validateUser';

router.get('/me', validateUser, handler);  // 401 if no user
```

##### validateActor

Requires any actor (user OR org/space token):

```typescript
import { validateActor } from '#/middleware/validations/validateActor';

router.get('/resource', validateActor, handler);  // 401 if no user from getActor()
```

**Difference from validateUser:**
- `validateUser` requires `c.get('user')` to be set (session or user token only)
- `validateActor` requires `getActor(c).user` to be set (works with org/space tokens that have user relations)

Use `validateActor` for endpoints that should work with both session and token auth, including org/space tokens.

##### validateNotToken

Requires session auth (tokens forbidden):

```typescript
import { validateNotToken } from '#/middleware/validations/validateNotToken';

router.post('/sensitive', validateNotToken, handler);  // 403 if using token
```

##### validateSuperadmin

Requires superadmin:

```typescript
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';

router.get('/admin/users', validateSuperadmin, handler);  // 403 if not superadmin
```

---

#### Choosing Between validateUser and validateActor

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

##### validateUser - Requires User Context

Requires `c.get('user')` to be set:

**Works with:**
- ✅ JWT auth (authMiddleware via BetterAuth)
- ✅ User tokens (`token.ownerModel === 'User'`)
- ✅ OrganizationUser tokens (`token.ownerModel === 'OrganizationUser'`)
- ✅ SpaceUser tokens (`token.ownerModel === 'SpaceUser'`)

**Does NOT work with:**
- ❌ Organization tokens (`token.ownerModel === 'Organization'`)
- ❌ Space tokens (`token.ownerModel === 'Space'`)

##### validateActor - More Permissive

Requires `getActor(c).user` to be set:

**Works with:**
- ✅ All of the above validateUser cases
- ✅ Organization tokens with organizationUser relation
- ✅ Space tokens with spaceUser relation

More permissive - works with all token types that have user relations.

##### When to Use Each

| Endpoint Type | Middleware | Reason |
|--------------|------------|---------|
| `/me/*` | `validateUser` | Always requires actual user context |
| `/organization/:id/users` | `validateActor` | Org tokens need to list org users |
| `/organization/:id/spaces` | `validateActor` | Org tokens need to access org resources |
| `/batch` | `validateActor` | Should work with all token types |
| User profile update | `validateUser` | Modifying user requires user session |
| `/me/tokens` (create) | `validateUser` | Token creation requires user |

##### Example

```typescript
// ❌ Wrong - org tokens can't access org resources
router.get('/organization/:id/users', validateUser, handler);

// ✅ Correct - org tokens can access org resources
router.get('/organization/:id/users', validateActor, handler);
```

---


---

### Frontend



Comprehensive guide to authentication in the template using BetterAuth, JWT sessions, and OAuth providers.

#### Architecture

**Stack:**
- BetterAuth - Auth framework issuing stateless JWTs
- HTTP-only cookie - JWT storage for email/password auth
- localStorage + Bearer token - JWT storage for OAuth auth
- OAuth/SAML - External identity providers
- ReBAC - Permission system (see PERMISSIONS.md)

**No server-side sessions** — JWTs are stateless. BetterAuth's `cookieCache` skips DB validation for up to 5 minutes.

**Email/password flow:**
```
User submits credentials
  ↓
BetterAuth validates + issues JWT in HTTP-only cookie
  ↓
Store hydrates user data via /me
  ↓
Auto-redirect to redirectTo or /dashboard
```

**OAuth flow:**
```
User clicks OAuth provider
  ↓
BetterAuth redirects to provider (Google, GitHub, etc.)
  ↓
Provider redirects back to /auth/callback?token=<jwt>
  ↓
Callback extracts JWT from URL, stores in localStorage via setToken()
  ↓
Store hydrates user data via /me (Authorization: Bearer <jwt>)
  ↓
Auto-redirect to redirectTo or /dashboard
```

---

#### Hooks

##### useAuthProviders

**Location:** `/packages/ui/src/hooks/useAuthProviders.ts`

Fetches context-aware authentication providers (OAuth/SAML).

**Purpose:** Centralizes provider fetching logic, supports org-specific providers.

```typescript
import { useAuthProviders } from '@template/ui/hooks';

const { providers, isLoading, error } = useAuthProviders();

<LoginForm
  providers={providers}
  isLoading={isLoading}
  error={error ? 'Unable to load providers.' : undefined}
/>
```

**Returns:**
- `providers` - Array of enabled providers
- `isLoading` - Loading boolean
- `error` - Error if fetch fails

**Behavior:**
- If `?org=xyz` in URL → fetches org providers + platform providers
- Otherwise → fetches platform providers only
- Auto-filters to enabled providers
- Retries failed requests (2 attempts)

**Provider Types:**
```typescript
type AuthProvider = {
  type: 'oauth' | 'saml';
  provider: string;  // 'google', 'github', etc.
  name: string;      // Display name
  enabled: boolean;
};
```

**Implementation:**
```typescript
export const useAuthProviders = () => {
  const search = useSearch({ strict: false }) as { org?: string };

  const { data, isLoading, error } = useQuery({
    queryKey: search.org
      ? ['authProviders', 'org', search.org]
      : ['authProviders', 'platform'],
    queryFn: search.org
      ? apiQuery((opts) => organizationReadAuthProvider({ ...opts, path: { id: search.org! } }))
      : apiQuery((opts) => authProviderReadMany(opts)),
    retry: 2,
  });

  const providers = search.org && data?.platform && data?.organization
    ? [...data.platform, ...data.organization]
    : data ?? [];

  return { providers, isLoading, error };
};
```

---

#### Login/Signup Pattern

##### Unified Auth System

All authentication methods (email/password, OAuth, SAML) use a **unified `AuthMethod` interface**:

```typescript
// packages/ui/src/lib/auth/types.ts
type AuthMethod =
  | { type: 'email', email: string, password: string, name?: string }
  | { type: 'oauth', provider: string, callbackURL?: string }
  | { type: 'saml', provider: string, email?: string };

// Unified sign-in interface
signIn(method: AuthMethod) → Promise<void>
signUp(method: AuthMethod) → Promise<void>
```

**Key Architectural Change:** Forms access store directly (no prop drilling).

##### LoginPage

**Location:** `/packages/ui/src/pages/LoginPage.tsx`

```typescript
import { navigateToSignup } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import { LoginForm } from '@template/ui/components/auth/LoginForm';

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const getStore = useAppStore.getState;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm
        onSignupClick={hideSignup ? undefined : () => navigateToSignup(getStore, true)}
      />
    </div>
  );
};
```

**Key Points:**
- ✅ **No props** - form accesses store directly for auth
- ✅ **No error/loading state** - form manages internally
- ✅ **No provider fetching** - form handles via `useAuthProviders()`
- ✅ **Navigation helpers** - `navigateToSignup(getStore, preserveSearch: true)`

##### SignupPage

**Location:** `/packages/ui/src/pages/SignupPage.tsx`

```typescript
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { useAppStore } from '@template/ui/store';
import { SignupForm } from '@template/ui/components/auth/SignupForm';

export const SignupPage = () => {
  const getStore = useAppStore.getState;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm onLoginClick={() => navigateToLogin(getStore, true)} />
    </div>
  );
};
```

**Same pattern** - minimal page, smart form component.

---

#### Components

##### LoginForm

**Location:** `/packages/ui/src/components/auth/LoginForm.tsx`

**Smart component** - accesses store directly, manages own state.

**Props:**
```typescript
export type LoginFormProps = {
  hideSignup?: boolean;
  onSignupClick?: () => void;
};
```

**Internal Implementation:**
```typescript
export const LoginForm = ({ hideSignup, onSignupClick }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signIn = useAppStore((state) => state.auth.signIn);
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      await signIn({ type: 'email', email, password });
      navigatePreservingContext(search.redirectTo || '/dashboard');
    } catch (err: any) {
      const message = err?.message || 'Sign in failed. Please try again.';
      setError(message);
      toast.error(message);  // Dual error handling
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthClick = async (provider: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const redirectTo = search.redirectTo || '/dashboard';
      localStorage.setItem('authRedirectTo', redirectTo);
      await signIn({
        type: 'oauth',
        provider,
        callbackURL: `${window.location.origin}/auth/callback`,
      });
    } catch (err: any) {
      const message = err?.message || 'OAuth sign in failed. Please try again.';
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  // ... render form
};
```

**Features:**
- ✅ Email/password form
- ✅ OAuth/SAML provider buttons (auto-detected)
- ✅ **Dual error handling** - inline form errors + toast notifications
- ✅ **Managed state** - error, isLoading, form fields
- ✅ **Store access** - calls `signIn()` directly
- ✅ **Navigation** - `navigatePreservingContext` after success
- ✅ **OAuth flow** - stores redirectTo in localStorage, uses BetterAuth client

**Provider Icons:**
```typescript
import { Chrome, Github, Shield, Key } from 'lucide-react';

const providerIcons: Record<string, typeof Chrome> = {
  google: Chrome,
  github: Github,
  saml: Shield,
};
```

##### SignupForm

**Location:** `/packages/ui/src/components/auth/SignupForm.tsx`

**Same pattern** - smart component accessing store directly.

**Props:**
```typescript
export type SignupFormProps = {
  hideLogin?: boolean;
  onLoginClick?: () => void;
};
```

**Features:**
- ✅ Name, email, password fields
- ✅ OAuth/SAML provider buttons (auto-detected)
- ✅ **Dual error handling** - inline + toast
- ✅ **Managed state** - form manages error, isLoading
- ✅ **Store access** - calls `signUp()` directly
- ✅ **Navigation** - `navigatePreservingContext` after success

---

#### Types

**Location:** `/packages/ui/src/lib/auth/types.ts`

##### AuthMethod (Unified Auth Interface)

```typescript
export type EmailAuthMethod = {
  type: 'email';
  email: string;
  password: string;
  name?: string;  // For signup
};

export type OAuthAuthMethod = {
  type: 'oauth';
  provider: string;
  callbackURL?: string;
};

export type SamlAuthMethod = {
  type: 'saml';
  provider: string;
  email?: string;  // Optional hint for IdP
};

export type AuthMethod = EmailAuthMethod | OAuthAuthMethod | SamlAuthMethod;
```

**Usage:**

```typescript
// Email signin
await signIn({ type: 'email', email: 'user@example.com', password: 'secret' });

// OAuth signin
await signIn({ type: 'oauth', provider: 'google', callbackURL: '/auth/callback' });

// SAML signin (when implemented)
await signIn({ type: 'saml', provider: 'okta-sso', email: 'user@company.com' });
```

**Benefits:**
- Single interface for all auth methods
- Type-safe - TypeScript enforces correct fields per method
- Easy to add new auth methods (just extend union)
- No code duplication between signin/signup

---

#### OAuth/SAML

##### OAuth Flow (BetterAuth Client)

OAuth authentication uses **BetterAuth's client SDK** (not manual URL construction).

**Implementation:**

```typescript
// packages/ui/src/lib/auth/signin.ts
import { getAuthClient } from '@template/ui/lib/auth/authClient';

const signInWithOAuth = async (method: OAuthAuthMethod): Promise<void> => {
  const client = getAuthClient();

  // Store redirectTo before OAuth redirect (URL params lost during OAuth flow)
  localStorage.setItem('authRedirectTo', window.location.pathname + window.location.search + window.location.hash);

  // BetterAuth handles OAuth negotiation and redirect
  await client.signIn.social({
    provider: method.provider,
    callbackURL: method.callbackURL || `${window.location.origin}/auth/callback`,
  });
};
```

**OAuth Callback Route:**

```typescript
// apps/web/app/routes/_public/auth.callback.tsx
import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { setToken } from '@template/ui/lib/auth/token';
import { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
import { useAppStore } from '@template/ui/store';

export const Route = createFileRoute('/_public/auth/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const store = useAppStore();

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const token = url.searchParams.get('token') || url.hash.match(/token=([^&]+)/)?.[1];

        if (!token) {
          throw new Error('No authentication token received');
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        setToken(token, expiresAt);

        await fetchAndHydrateMe(store.setState, store.getState);

        const redirectTo = localStorage.getItem('authRedirectTo') || '/dashboard';
        localStorage.removeItem('authRedirectTo');

        navigate({ to: redirectTo });
      } catch (error: any) {
        console.error('OAuth callback failed:', error);
        navigate({
          to: '/login',
          search: { error: error.message || 'Authentication failed' },
        });
      }
    };

    completeOAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Completing authentication...</div>
    </div>
  );
}
```

**Flow:**
1. User clicks OAuth provider button
2. `signIn({ type: 'oauth', provider: 'google' })`
3. BetterAuth redirects to Google OAuth
4. User authenticates with Google
5. Google redirects to `/auth/callback?token=...`
6. Callback route extracts bearer token, stores in localStorage
7. Hydrates user data via `/me` API call
8. Navigates to redirectTo destination

**Security:**
- BetterAuth handles OAuth state/nonce validation
- Bearer token pattern (not session cookies)
- Callback routes in all 3 apps (web, admin, superadmin)

##### Provider Configuration

**Backend:** `/apps/api/src/lib/auth/platformProviders.ts`

Platform providers configured via environment variables:
```env
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
```

**Organization Providers:** Stored in database per organization:
```prisma
model AuthProvider {
  id             String   @id
  organizationId String
  type           String   // 'oauth' | 'saml'
  provider       String   // 'google', 'github', 'okta', etc.
  name           String
  enabled        Boolean
  encryptedSecrets                   String?
  encryptedSecretsEncryptionMetadata Json?
  encryptedSecretsEncryptionKeyVersion Int?
}
```

---

#### Navigation Patterns

##### Preserving Context

**Use navigation helpers to preserve URL parameters:**

```typescript
const navigate = useAppStore((state) => state.navigation.navigate);
const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);
```

**When to use:**
- `navigate({ to, search })` - Basic navigation, explicit params
- `navigatePreservingContext(to)` - Preserve org/space/spoof
- `navigatePreservingSpoof(to)` - Preserve spoof only

##### Preserving redirectTo

**Use `buildPathWithSearch` to preserve redirectTo between login/signup:**

```typescript
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

const signupUrl = buildPathWithSearch(
  '/signup',
  search.redirectTo ? { redirectTo: search.redirectTo } : undefined
);
navigatePreservingContext(signupUrl);
```

**Why:** Ensures user lands on intended page after auth flow.

**Example Flow:**
1. User visits `/settings` (not logged in)
2. Guard redirects to `/login?redirectTo=/settings`
3. User clicks "Sign up"
4. Navigates to `/signup?redirectTo=/settings`
5. After signup, redirects to `/settings`

---

#### Guards

**Location:** `/packages/ui/src/guards/authGuard.ts`

Route guards for protecting pages and redirecting unauthenticated users.

##### requireAuth

Redirects unauthenticated users to login.

```typescript
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});
```

**Behavior:**
1. Calls `auth.initialize()` (loads user data)
2. If not authenticated → redirect to `/login?redirectTo=<current-path>`
3. Preserves context params (org, space, spoof) in redirectTo

##### requirePublic

Redirects authenticated users away from public pages.

```typescript
export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: LoginPage,
});
```

**Behavior:**
1. Calls `auth.initialize()` (loads user data)
2. If authenticated → redirect to `redirectTo` or `/dashboard`

**Implementation:**
```typescript
export const createAuthGuards = (getStore: () => AppStore) => ({
  requireAuth: async (context?: BeforeLoadContext) => {
    await getStore().auth.initialize();

    if (!getStore().auth.isAuthenticated) {
      const pathname = context?.location.pathname || '/dashboard';
      const search = context?.location.search;
      const preserved = pickSearchParams(search, ['org', 'space', 'spoof']);
      const redirectTo = buildPathWithSearch(pathname, preserved);

      throw redirect({ to: '/login', search: { redirectTo } });
    }
  },

  requirePublic: async (context?: BeforeLoadContext) => {
    await getStore().auth.initialize();

    if (getStore().auth.isAuthenticated) {
      const search = context?.location.search;
      const redirectTo = readSearchParam(search, 'redirectTo') || '/dashboard';

      throw redirect({ to: redirectTo });
    }
  },
});
```

---

#### Store Integration

##### Auth Slice

**Location:** `/packages/ui/src/store/slices/auth.ts`

```typescript
export type AuthSlice = {
  auth: {
    user: User | null;
    organizations: Record<string, Organization> | null;
    spaces: Record<string, Space> | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    spoofUserEmail: string | null;

    initialize: () => Promise<void>;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    logout: () => Promise<void>;
    setSpoof: (email: string | null) => Promise<void>;
  };
};
```

**Key Methods:**

###### initialize()

Loads user data from backend `/me` endpoint.

```typescript
await auth.initialize();
```

**Called by:**
- Auth guards (`requireAuth`, `requirePublic`)
- Authenticated layout (on mount)

###### signIn(credentials)

Authenticates user via BetterAuth.

```typescript
await auth.signIn({ email, password });
```

**Flow:**
1. Calls BetterAuth API
2. Sets JWT in httpOnly cookie
3. Hydrates store with user data
4. Sets `isAuthenticated` to true

###### signUp(credentials)

Creates new user via BetterAuth.

```typescript
await auth.signUp({ email, password, name });
```

**Flow:**
1. Calls BetterAuth API
2. Sets JWT in httpOnly cookie
3. Hydrates store with user data
4. Sets `isAuthenticated` to true

###### logout()

Clears auth state and revokes session.

```typescript
await auth.logout();
```

**Flow:**
1. Calls BetterAuth signOut API
2. Clears JWT cookie
3. Resets store state
4. Sets `isAuthenticated` to false

---

#### Error Handling

##### Pattern: Error Injection

**Don't duplicate component renders for errors:**

❌ **Bad:**
```typescript
if (providerError) {
  return <LoginForm providers={[]} error="Provider error" />;
}
return <LoginForm providers={providers} error={error} />;
```

✅ **Good:**
```typescript
return (
  <LoginForm
    providers={providerError ? [] : providers}
    error={providerError ? 'Provider error' : error}
    isLoading={isLoading || isLoadingProviders}
  />
);
```

**Why:** Single source of truth, easier to maintain, no duplication.

##### Error Messages

**Be specific and actionable:**

```typescript
// ✅ Good
error={providerError
  ? 'Unable to load authentication providers. You can still sign in with email and password.'
  : error}

// ❌ Bad
error={providerError ? 'Error' : error}
```

---

#### Testing

##### Hook Tests

**Location:** `/packages/ui/src/hooks/useAuthFlow.test.ts`

```bash
cd packages/ui && bun test useAuthFlow
```

**Coverage:**
- Successful auth flow
- Error handling
- Loading states
- redirectTo preservation

##### Page Tests

**Location:** `/packages/ui/src/pages/LoginPage.test.tsx`

```bash
cd packages/ui && bun test LoginPage
```

**Coverage:**
- Provider fetching
- Form submission
- Error display
- Navigation between login/signup

---

#### Security

##### Best Practices

**httpOnly Cookies:**
- JWT tokens stored in httpOnly cookies
- Not accessible via JavaScript
- Prevents XSS attacks

**CSRF Protection:**
- BetterAuth handles CSRF tokens automatically
- Validates on all auth endpoints

**OAuth Validation:**
- Validates callback URL origin
- Only allows same-origin + localhost:3000
- Prevents redirect attacks

**Spoof Protection:**
- Spoof feature only available to superadmin
- Requires special permissions
- Tracked via audit log

##### Environment Variables

```env
### BetterAuth
BETTER_AUTH_SECRET=<random-secret>

### OAuth Providers (Platform)
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>

### API
VITE_API_URL=http://localhost:8000
```

---

#### Common Patterns

##### Login with redirectTo

```typescript
// Guard redirects to login
throw redirect({
  to: '/login',
  search: { redirectTo: '/settings' }
});

// LoginPage preserves redirectTo
const { handleAuth } = useAuthFlow(signIn);
// Auto-redirects to '/settings' after login
```

##### Switching between Login/Signup

```typescript
// LoginPage
onSignupClick={() => {
  const signupUrl = buildPathWithSearch('/signup', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
  navigatePreservingContext(signupUrl);
}}

// SignupPage
onLoginClick={() => {
  const loginUrl = buildPathWithSearch('/login', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
  navigatePreservingContext(loginUrl);
}}
```

##### OAuth Login

```typescript
// LoginForm automatically handles OAuth
<Button onClick={() => redirectToOAuthProvider(provider)}>
  Continue with {provider.name}
</Button>

// Redirects to: /auth/google/signin?callbackURL=<origin>/auth/callback
```

##### Logout

```typescript
const logout = useAppStore((state) => state.auth.logout);
const navigate = useAppStore((state) => state.navigation.navigate);

await logout();
navigate({ to: '/login' });
```

---

#### Key Files

##### Hooks
- `/packages/ui/src/hooks/useAuthFlow.ts`
- `/packages/ui/src/hooks/useAuthProviders.ts`

##### Pages
- `/packages/ui/src/pages/LoginPage.tsx`
- `/packages/ui/src/pages/SignupPage.tsx`

##### Components
- `/packages/ui/src/components/auth/LoginForm.tsx`
- `/packages/ui/src/components/auth/SignupForm.tsx`

##### Utilities
- `/packages/ui/src/lib/auth/oauthRedirect.ts`
- `/packages/ui/src/lib/searchParams.ts`

##### Guards
- `/packages/ui/src/guards/authGuard.ts`

##### Store
- `/packages/ui/src/store/slices/auth.ts`
- `/packages/ui/src/store/slices/navigation.ts`

##### Types
- `/packages/ui/src/types/auth.ts`
- `/packages/ui/src/store/types/auth.ts`

##### Backend
- `/apps/api/src/lib/auth/platformProviders.ts`
- `/apps/api/src/modules/authProvider/` (org providers)

---

## Authorization

Permission enforcement uses the ReBAC system (Permix-based). See [PERMISSIONS.md](./PERMISSIONS.md) for the full guide.

Key entry points:

- **Route layer:** `validateActor` / `validateUser` middleware (see [Validation Middleware](#validation-middleware) above for which to pick)
- **Page layer:** `_authenticated.tsx` enforces nav-entry access — the nav config is the source of truth for "can view"
- **Component / handler layer:** `checkPermission(permissions, model, record, action)` from `@template/ui/hooks/usePermission`
- **Platform bypass:** `user.platformRole === 'superadmin'` short-circuits permission checks
