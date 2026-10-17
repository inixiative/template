# Authentication

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [BetterAuth (Session)](#betterauth-session)
  - [Configuration](#configuration)
  - [Session Storage Strategy](#session-storage-strategy)
  - [Auth Routes](#auth-routes)
  - [authMiddleware](#authmiddleware)
- [OAuth + Bearer Tokens](#oauth--bearer-tokens)
  - [OAuth Flow](#oauth-flow)
  - [Bearer Token Handoff](#bearer-token-handoff)
- [Multi-Provider Authentication (AuthProvider)](#multi-provider-authentication-authprovider)
  - [Database Schema](#database-schema)
  - [Encryption](#encryption)
  - [Operations](#operations)
  - [SAML/SSO Status](#samlsso-status)
- [Token Authentication](#token-authentication)
  - [How It Works](#how-it-works)
  - [tokenAuthMiddleware](#tokenauthmiddleware)
- [Token Types](#token-types)
  - [User Token](#user-token)
  - [Organization Token](#organization-token)
  - [OrganizationUser Token](#organizationuser-token)
  - [Space Token](#space-token)
  - [SpaceUser Token](#spaceuser-token)
  - [Token Schema](#token-schema)
- [Issuer JWT](#issuer-jwt)
  - [Verification](#verification)
  - [Claims](#claims)
  - [What Kingdom Adds](#what-kingdom-adds)
- [Auth Middleware Chain](#auth-middleware-chain)
  - [Flow](#flow)
- [Spoof Middleware](#spoof-middleware)
  - [Usage](#usage)
  - [Requirements](#requirements)
- [Validation Middleware](#validation-middleware)
  - [validateUser](#validateuser)
  - [validateActor](#validateactor)
  - [Session-Only Actions](#session-only-actions)
  - [validateSuperadmin](#validatesuperadmin)
- [Choosing Between validateUser and validateActor](#choosing-between-validateuser-and-validateactor)

<!-- toc:end -->

Who is the caller: sessions, API tokens, OAuth, spoofing, and the middleware that enforces them. What they can do: [PERMISSIONS.md](./PERMISSIONS.md). Client side (forms, guards, auth slice): [FRONTEND/AUTH.md](./FRONTEND/AUTH.md).

## Overview

Two authentication methods, both populate the same context:

| Method | Use Case | Header/Cookie | Middleware |
|--------|----------|---------------|------------|
| Session | Browser clients | `Authorization: Bearer <session token>` (or BetterAuth cookie, or `?token=`) | `authMiddleware` |
| API token | API clients | `Authorization: Bearer <key>` or `?token=<key>` | `tokenAuthMiddleware` |

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

  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) =>
      emitAppEvent('user.verificationRequested', { userId: user.id, verificationUrl: url }),
  },

  socialProviders: {
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
      : undefined,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 7 * 24 * 60 * 60, strategy: 'jwe' },
  },

  user: {
    additionalFields: {
      platformRole: { type: ['user', 'superadmin'], defaultValue: 'user', input: false },
    },
  },

  plugins: [bearer(), ...oauthHandoffPlugins()],
  trustedOrigins: getAllowedOrigins(),
  onAPIError: process.env.WEB_URL ? { errorURL: `${process.env.WEB_URL}/login` } : undefined,

  secondaryStorage: { get, set, delete, getAndDelete },  // Redis, `redisNamespace.session`
});
```

### Session Storage Strategy

What is JWT and what is Redis:

| Piece | What it is | Where it lives |
|-------|-----------|----------------|
| **Session token** | BetterAuth's session token: an opaque random id (32 chars), **not a JWT**. There is no `jwt()` plugin, only `bearer()`. As a cookie it's HMAC-signed with `BETTER_AUTH_SECRET`; `bearer()` accepts it signed or bare. | Web apps: localStorage. Sign-in returns it (`data.token` for email, `data.session.token` after the OAuth one-time-token exchange), `packages/ui/src/lib/auth/token.ts` stores it, and `packages/ui/src/lib/apiFetchInternal.ts` sends `Authorization: Bearer <token>` on every call |
| **Session record** | `{ session, user }` JSON for that token, TTL = session expiry. A second key, `active-sessions-<userId>`, lists a user's live tokens. | **Redis** (`secondaryStorage`, keys under `redisNamespace.session`). Not written to Postgres: `storeSessionInDatabase` is off. The Prisma `Session` model is BetterAuth's default schema and is unused |
| **Cookie cache** | The only JWT-format piece: an encrypted JWE (`strategy: 'jwe'`) `session_data` cookie carrying the session + user, valid up to `maxAge` (7 days). Applies only to cookie-based clients; the web apps don't use it. | Browser cookie on the API origin. Requests that carry it skip the Redis lookup |
| **OAuth one-time token** | Single-use, 1 minute, stored hashed; consumed with Redis `GETDEL` (`getAndDelete`). | Redis |

- **The web apps are bearer clients, and every bearer request reads Redis.** `authMiddleware` → `auth.api.getSession` resolves the token through Redis; the web apps send no cookie, so the JWE cache doesn't apply to them. Deleting the Redis key ends the session at once (that's how sign-out and revocation work).
- **Lifetime.** `expiresIn` is 7 days, sliding: a session used more than a day (`updateAge`, default) after its last refresh is extended.
- **Cookie clients.** A client that keeps the API's cookies gets the JWE cache, so it can authenticate without Redis for up to `maxAge`, and a revoked session stays valid there until the cookie cache expires.
- **Email verification is required** for email/password sign-up; the verification email goes out through the `user.verificationRequested` app event.

API tokens are a different mechanism: SHA-256-hashed `Token` rows in Postgres, cached in Redis for 10 minutes ([Token Authentication](#token-authentication)).

### Auth Routes

`apps/api/src/routes/api.ts` mounts BetterAuth at `/api/auth/*` behind `authRateLimit`:

```
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email
POST /api/auth/sign-in/social          # OAuth start
GET  /api/auth/callback/:provider      # OAuth callback (register as the provider redirect URI)
POST /api/auth/one-time-token/verify   # OAuth handoff exchange
POST /api/auth/sign-out
GET  /api/auth/get-session
```

### authMiddleware

Located in `apps/api/src/middleware/auth/authMiddleware.ts`:

```typescript
export const authMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')) return next();

  const headers = c.req.raw.headers;
  const urlToken = new URL(c.req.url).searchParams.get('token');
  if (urlToken && !headers.get('authorization')) headers.set('authorization', `Bearer ${urlToken}`);

  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return next();

  const user = await findUserWithRelations(c.get('db'), session.user.id);
  if (!user) return next();

  await setUserContext(c, user);
  await next();
};
```

---

## OAuth + Bearer Tokens

Server side: `apps/api/src/lib/auth/oauthHandoffPlugins.ts`. Client side: `packages/ui/src/lib/auth/signin.ts` and `AuthCallbackPage` ([FRONTEND/AUTH.md](./FRONTEND/AUTH.md#oauth-callback)).

### OAuth Flow

1. **User clicks OAuth provider** (e.g., "Continue with Google")
2. **Frontend calls BetterAuth** via `client.signIn.social({ provider, callbackURL })`
3. **BetterAuth redirects** to the OAuth provider
4. **User authenticates** with provider
5. **Provider redirects to the API** at `{API_URL}/api/auth/callback/<provider>` — register this as the redirect URI with the provider
6. **API mints a one-time token** and redirects to `/auth/callback#ott=...`
7. **Callback page exchanges it** via `completeOAuthSignIn()`:
   - `POST /api/auth/one-time-token/verify` returns the session
   - Store the session token in localStorage via `setToken()`
   - Hydrate user data via `fetchAndHydrateMe()`
   - Navigate to redirectTo destination

### Bearer Token Handoff

The SPA authenticates with bearer tokens, but the OAuth callback is a browser redirect: the session BetterAuth
creates there exists only as a cookie on the API origin, which the SPA never sends. `oauthHandoffPlugins()`
(`apps/api/src/lib/auth/oauthHandoffPlugins.ts`) bridges the two:

- `oneTimeToken({ setOttHeaderOnNewSession: true })` mints a single-use token (1 minute, stored hashed) for every new session
- `oauthCallbackToken` moves that token onto the callback redirect as `#ott=` — a fragment, so it never reaches server logs or referrers
- The browser can't mint tokens itself (`disableClientRequest`); verify consumes atomically via Redis `GETDEL` (`secondaryStorage.getAndDelete`)

The session token itself never appears in a URL.

All API requests include the bearer token:

```typescript
Authorization: Bearer <token>
```

See [FRONTEND/AUTH.md](./FRONTEND/AUTH.md) for the client side.

---

## Multi-Provider Authentication (AuthProvider)

**Location:** `apps/api/src/modules/authProvider/`, organization routes in `apps/api/src/modules/organization/`.

Two sources of providers:

1. **Platform providers** — not rows. `getPlatformProviders()` (`apps/api/src/lib/auth/platformProviders.ts`) lists Google and GitHub when their `*_CLIENT_ID` / `*_CLIENT_SECRET` env vars are set. Only Google is wired into BetterAuth `socialProviders` today.
2. **Organization providers** — `AuthProvider` rows, one org each, secrets encrypted.

### Database Schema

```prisma
enum AuthProviderType {
  EMAIL
  OAUTH
  SAML
}

model AuthProvider {
  id             String           // uuidv7
  deletedAt      DateTime?
  type           AuthProviderType
  provider       String           // 'google', 'github', 'okta', 'azure-ad'
  name           String           // display name
  enabled        Boolean          @default(true)
  organizationId String           // required: org-specific providers only
  config         Json             // public config, safe to return
  encryptedSecrets           String  // AES-256-GCM ciphertext, never returned
  encryptedSecretsMetadata   Json
  encryptedSecretsKeyVersion Int

  @@unique([organizationId, provider, type])
}
```

### Encryption

```typescript
import { encryptField, decryptField } from '@template/db/lib/encryption/helpers';

const encrypted = await encryptField('authProvider', 'secrets', { ...data, secrets });
const secrets = await decryptField('authProvider', 'secrets', authProvider);
```

Provider credentials are encrypted, never hashed: the server must decrypt them to call the provider. AES-256-GCM with AAD bound from the encryption registry; the key version column supports rotation. See [ENCRYPTION.md](./ENCRYPTION.md).

### Operations

| Operation | Who | Notes |
|-----------|-----|-------|
| `authProviderReadMany` | public | Platform providers, for login/signup pages |
| `organizationReadAuthProvider` | public (no auth middleware; login page calls it) | `{ platform, organization }`; secrets omitted, non-owners see enabled providers only |
| `organizationCreateAuthProvider` | org owner | Encrypts `secrets` |
| `authProviderUpdate` | `own` on the provider | `organizationId`, `type`, `provider` and encrypted columns are sanitized; new `secrets` re-encrypt |
| `authProviderDelete` | `own` on the provider | |
| `adminAuthProviderReadMany` | superadmin | `/api/admin/authProvider` |

### SAML/SSO Status

Schema and encryption support SAML rows; sign-in does not. The client throws `SAML authentication not yet implemented`. Remaining: BetterAuth SAML plugin, metadata parsing, JIT provisioning. See [AUTH-003](../../tickets/AUTH-003-saml-sso.md).

---

## Token Authentication

Located in `apps/api/src/middleware/auth/tokenAuthMiddleware.ts`. API key authentication.

### How It Works

1. Extract token from `Authorization: Bearer <token>` header OR `?token=<token>` URL param
2. Hash token with SHA-256
3. Look up token by hash (cached in Redis with 10-minute TTL)
4. Validate: `isActive`, not expired
5. Set context based on token type

URL token is useful for WebSocket connections, email links, file downloads (where headers can't be set).

**Security:** Token lookups are cached for 10 minutes, so a revoked token (`isActive = false`) stops working within that window. `lastUsedAt` is touched on cache miss only. `authMiddleware` also reads `?token=` for session tokens.

### tokenAuthMiddleware

```typescript
export const tokenAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (c.get('user')) return next();

  const authorization = c.req.header('authorization');
  const urlToken = new URL(c.req.url).searchParams.get('token');
  const apiKey = authorization?.startsWith('Bearer ') ? authorization.slice(7) : urlToken;
  if (!apiKey) return next();

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const token = await cache(cacheKey('Token', { keyHash }), findActiveToken, TOKEN_CACHE_TTL);  // 10 min
  if (!token) return next();

  c.set('token', token);

  if (token.ownerModel === 'User') {
    // load the user with all memberships → setUserContext
  } else if (token.ownerModel === 'OrganizationUser' || token.ownerModel === 'SpaceUser') {
    // setUserContext from the token's own membership (one org / one space)
  } else {
    await setupOrgPermissions(c);
    await setupSpacePermissions(c);
  }

  await next();
};
```

A non-`Bearer` header or no key falls through to `authMiddleware`. A bearer value that is not an API key (a session token) misses the lookup and falls through too.

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
- Reaches the user and every org and space they belong to, each capped by the user's own grant there ([Slices](./PERMISSIONS.md#slices))
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
- Has access only to that org: no user entry, no spaces
- Permissions are the token's slice capped by the membership
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
- Has access only to that space: no user entry, no organization entry
- Permissions are the token's slice capped by the space membership
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

  // Permissions: a slice, capped per request by the owner's grant
  role             Role    @default(member)
  entitlements     Json?
  entitlementsOnly Boolean @default(false)

  integrationId String?   // optional link to an Integration

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

## Issuer JWT

A JWT from a configured issuer is **the user, not a token**. With no `grant` claim it carries the full user, exactly as a session does ("the most access you can have"). With a `grant` claim it carries a narrower slice of the same user: the one an approved `grantUserSlice` inquiry holds ([Granting a Slice](./PERMISSIONS.md#granting-a-slice)). No Token row exists for it.

Located in `apps/api/src/middleware/auth/jwtAuthMiddleware.ts`; verifier in `apps/api/src/lib/auth/verifyIssuerJwt.ts`.

### Verification

Off unless `AUTH_ISSUER`, `AUTH_JWKS_URL` and `AUTH_AUDIENCE` are all set. When on, a bearer shaped like a JWT (three dot-separated segments) is verified with `jose`:

- keys from `createRemoteJWKSet(AUTH_JWKS_URL)` (cached 10 minutes, unknown `kid` refetches);
- `algorithms: ['ES256']` only, so `alg: none` and HS256 are refused;
- `issuer`, `audience`, `exp` and `sub` required; 30 s clock tolerance.

A JWT-shaped bearer that fails is a **401**, never a fall-through to API-token hashing. `sub` must be a local `User` id.

### Claims

| Claim | Meaning |
|---|---|
| `sub` | `User.id` |
| `grant` (optional) | id of an approved `grantUserSlice` inquiry targeting `sub`; read live on every request, so revoking it locks the JWT out at once |
| `iss`, `aud`, `exp`, `iat` | standard |

The step sets `c.get('slice')` (the slice, its inquiry id and the requesting integration) before `setUserContext`, so the setup functions cap by it. Downstream:

- **Audit:** the actor is the user (`actorUserId`), `actorTokenId` stays null; the requesting integration, if any, is the audit `integrationId`.
- **Batch:** `slice` is cloned into sub-requests with the user.
- **Superadmin:** a superadmin's JWT is superadmin, spoofing included.

### What Kingdom Adds

Template verifies; Kingdom issues. Left for the Kingdom change: Better Auth `jwt()` with ES256 keys and a JWKS model, the embed login that mints the JWT (AUTH-008), a session-id check against the live session, and Kingdom's owner-authority code that still assumes a Token row (owner routes that re-hash the bearer, the actor-authority loader, and the org/space manage checks that cap memberships by hand and must move to `capSlice`).

---

## Auth Middleware Chain

Order matters. Applied in `apps/api/src/routes/api.ts`:

```typescript
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);              // 1. Initialize context
apiRouter.route('/telemetry/browser', …);        // Public, before auth
apiRouter.route('/internal', internalRouter);    // Shared-secret auth only
apiRouter.use('/auth/*', authRateLimit);         // BetterAuth handles its own auth
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.route('/unsubscribe', …);              // Public, signed link
apiRouter.use('*', jwtAuthMiddleware);           // 2. Issuer JWT (JWT-shaped bearer)
apiRouter.use('*', tokenAuthMiddleware);         // 3. Token auth (Authorization header wins)
apiRouter.use('*', authMiddleware);              // 4. Session auth
apiRouter.use('*', spoofMiddleware);             // 5. Superadmin spoofing (after user is resolved)
apiRouter.use('*', auditActorMiddleware);        // 6. Actor context for audit logs
apiRouter.use('*', apiRateLimit);
```

Token auth runs first so an `Authorization: Bearer <key>` header always wins
over a session cookie when both are present (typical SDK xhr from a browser).
Spoof runs last so a superadmin can spoof via either auth path.

### Flow

```
Request
  ↓
prepareRequest
  - user: null, token: null, slice: null, permix: empty
  ↓
jwtAuthMiddleware
  - If issuer configured + JWT-shaped bearer → verify, load slice from grant, setUserContext()
  - Invalid JWT → 401
  ↓
tokenAuthMiddleware
  - If valid Bearer/URL token matches a Token row → set token, setUserContext()
  - Otherwise pass through unchanged
  ↓
authMiddleware
  - If already has user (token won) → skip
  - If valid better-auth session → setUserContext()
  - If no session → pass through unchanged
  ↓
spoofMiddleware
  - If superadmin + spoof header → replace user context
  - Sets spoofedBy to original admin
```

---

## Spoof Middleware

Located in `apps/api/src/middleware/auth/spoofMiddleware.ts`. Allows superadmins to act as other users.

```typescript
export const spoofMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  if (!user || !isSuperadmin(c)) return next();

  const rawEmail = c.req.header('x-spoof-user-email');
  if (!rawEmail) return next();

  const spoofEmail = normalizeEmail(rawEmail);
  const spoofedBasic = await findUserByEmail(db, spoofEmail);
  if (!spoofedBasic) return next();
  const spoofedUser = await findUserWithRelations(db, spoofedBasic.id);
  if (!spoofedUser) return next();

  await setUserContext(c, spoofedUser);
  c.set('spoofedBy', user);
  c.header('x-spoofing-user-email', user.email);
  c.header('x-spoofed-user-email', spoofEmail);

  await next();
};
```

### Usage

```bash
curl -H "Authorization: Bearer <session-token>" \
     -H "x-spoof-user-email: target@example.com" \
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

Requires `getActor(c).user`:

```typescript
import { validateActor } from '#/middleware/validations/validateActor';

router.get('/resource', validateActor, handler);  // 401 if no user from getActor()
```

`getActor(c).user` falls back from `c.get('user')` to the organizationUser / spaceUser / token user. Token auth already calls `setUserContext` for User, OrganizationUser and SpaceUser tokens, so in practice both validators admit the same callers.

### Session-Only Actions

There is no "tokens forbidden" guard. Token minting, token deletion, account redaction and organization deletion are `SessionAction`s, checked with `validateSelfPermission` ([PERMISSIONS.md](./PERMISSIONS.md#validateselfpermission)). A session (or a JWT with no grant) holds them all; a token or slice holds one only when its entitlements name it.

```typescript
middleware: [validateSelfPermission(SessionAction.createToken)]
```

### validateSuperadmin

Requires superadmin:

```typescript
import { validateSuperadmin } from '#/middleware/validations/validateSuperadmin';

router.get('/admin/users', validateSuperadmin, handler);  // 403 if not superadmin
```

---

## Choosing Between validateUser and validateActor

| Credential | `c.get('user')` | `validateUser` | `validateActor` |
|------------|-----------------|----------------|-----------------|
| Session | ✅ | ✅ | ✅ |
| User token | ✅ | ✅ | ✅ |
| OrganizationUser token | ✅ (scoped to its org) | ✅ | ✅ |
| SpaceUser token | ✅ (scoped to its space) | ✅ | ✅ |
| Issuer JWT (with or without grant) | ✅ | ✅ | ✅ |
| Organization token | ❌ (no user) | ❌ 401 | ❌ 401 |
| Space token | ❌ (no user) | ❌ 401 | ❌ 401 |

Organization and Space tokens are created without a `userId` (`organizationCreateToken`, `spaceCreateToken`); token auth only sets up their permissions. A route meant for them must skip both validators and rely on `validatePermission`. Use `validateUser` for `/me/*` and anything that acts as a person; authentication alone is never the whole check: every route also declares an action (`validatePermission` or `validateSelfPermission`).
