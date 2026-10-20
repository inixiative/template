# Authentication

<!-- toc:start -->

## Contents

- [Overview](#overview)
- [Sign-in (the BetterAuth handshake)](#sign-in-the-betterauth-handshake)
  - [Configuration](#configuration)
  - [What lives where](#what-lives-where)
  - [jwtHandoff](#jwthandoff)
  - [Auth Routes](#auth-routes)
- [Person JWT](#person-jwt)
  - [Verification](#verification)
  - [jwtAuthMiddleware](#jwtauthmiddleware)
  - [Revocation and sign-out](#revocation-and-sign-out)
  - [Spoofing and WebSockets](#spoofing-and-websockets)
- [OAuth + One-Time Token](#oauth--one-time-token)
  - [OAuth Flow](#oauth-flow)
  - [One-Time Token Handoff](#one-time-token-handoff)
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
- [Entitlement grants on a JWT](#entitlement-grants-on-a-jwt)
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

Who is the caller: person JWTs, API tokens, the sign-in handshake, OAuth, spoofing, and the middleware that enforces them. What they can do: [PERMISSIONS.md](./PERMISSIONS.md). Client side (forms, guards, auth slice): [FRONTEND/AUTH.md](./FRONTEND/AUTH.md).

## Overview

Two credentials, both populate the same context. Both are bearer-only, and neither is a session: a cookie or a BetterAuth session never authenticates an API request (CI rule `bearer-only-auth`, [SCRIPTS.md](./SCRIPTS.md)).

| Credential | Who presents it | Header | Middleware |
|--------|----------|---------------|------------|
| Person JWT | A signed-in person (web, admin and superadmin apps, or anything holding their JWT) | `Authorization: Bearer <jwt>` | `jwtAuthMiddleware` |
| API token | A program (MCP, integrations, CI) | `Authorization: Bearer <key>` or `?token=<key>` | `tokenAuthMiddleware` |

Both set `user`, `organizationUsers`, and configure `permix`.

Why no sessions: a session is server state that every request must look up, and a session cookie is a second way in. Sessions lived on as the real credential under an earlier JWE cookie cache, and a revoked session stayed valid in that cache for up to 7 days. A person JWT is verified from its signature, and revocation is a per-user check in Redis ([Revocation and sign-out](#revocation-and-sign-out)).

---

## Sign-in (the BetterAuth handshake)

Located in `apps/api/src/lib/auth.ts`. BetterAuth runs sign-up, sign-in, email verification and OAuth. It still creates a session at the end of each sign-in, because its flows are built around one; `jwtHandoff` swaps that session for a JWT before the response leaves the API, so the client never holds a session.

### Configuration

```typescript
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    onPasswordReset: async ({ user }) => rotateUserJwts(user.id),
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) =>
      emitAppEvent('user.verificationRequested', { userId: user.id, verificationUrl: url }),
  },

  socialProviders: { google: /* when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set */ },

  session: { expiresIn: 10 * 60 },          // handshake only

  plugins: authPlugins(),                   // jwt(), oneTimeToken, oauthCallbackToken, jwtHandoff
  disabledPaths: [/* every endpoint that acts on a live session, see below */],
  trustedOrigins: getAllowedOrigins(),
  secondaryStorage: { get, set, delete, getAndDelete },  // Redis, `redisNamespace.session`
});
```

The plugin list lives in `apps/api/src/lib/auth/authPlugins.ts`. Its order matters: `jwtHandoff` runs last, after the one-time-token hook has read the new session.

### What lives where

| Piece | What it is | Where it lives |
|-------|-----------|----------------|
| **Person JWT** | ES256 JWT, `sub` = `User.id`, `iss` = `aud` = `API_URL`, `iat`, `exp` 30 days | The client. Web apps keep it in localStorage (`packages/ui/src/lib/auth/token.ts`) and send `Authorization: Bearer <jwt>` on every call |
| **Signing keys** | BetterAuth `jwt()` plugin keys, ES256, rotated every 90 days; a retired key stays published for 30 days so JWTs it signed keep verifying | `Jwks` table; the private key is encrypted by the template field encryption (`jwks.privateKey`, [ENCRYPTION.md](./ENCRYPTION.md)) through `apps/api/src/lib/auth/jwksStore.ts`. Public keys at `GET /api/auth/jwks` |
| **Handshake session** | BetterAuth's session for one sign-in. Lives 10 minutes at most; `jwtHandoff` deletes it as soon as it hands out the JWT | Redis (`secondaryStorage`, `redisNamespace.session`). `storeSessionInDatabase` is off; the Prisma `Session` model is BetterAuth's schema and holds no rows |
| **OAuth one-time token** | Single-use, 1 minute, stored hashed; consumed with Redis `GETDEL` (`getAndDelete`) | Redis |
| **JWT version** | `User.jwtVersion`; every person JWT carries it as `ver`, and a JWT whose `ver` differs is refused. Incrementing it signs the user out everywhere | Postgres, on the `User` row `jwtAuthMiddleware` already loads |

- **Why the signing keys use the template field encryption:** one scheme for secrets at rest, rotated by the existing `rotateEncryptionKeys` job, instead of a second scheme keyed off `BETTER_AUTH_SECRET`.
- **Why 30 days and no refresh token:** revocation is the control, not short expiry. A refresh token would be a second long-lived credential to store, rotate and revoke; incrementing `User.jwtVersion` already ends every JWT a person holds.
- **Email verification is required** for email/password sign-up; the verification email goes out through the `user.verificationRequested` app event. Verifying does not sign the person in; they sign in afterwards.

### jwtHandoff

`apps/api/src/lib/auth/jwtHandoff.ts`, a BetterAuth plugin with one after-hook. On every endpoint that produced a new session it:

1. expires the session cookie on the response;
2. on `/callback/*` (the OAuth redirect) stops there, because the one-time token must still resolve to that session;
3. otherwise signs the person's JWT (`signJWT` with `personJwtOptions()` from `apps/api/src/lib/auth/personJwt.ts`), deletes the session, and replaces the response body with:

```json
{ "token": "<jwt>", "expiresAt": "<ISO time>", "user": { "...": "..." } }
```

That covers `POST /api/auth/sign-in/email`, `POST /api/auth/one-time-token/verify`, and `POST /api/auth/sign-up/email` when verification is not required.

### Auth Routes

`apps/api/src/routes/api.ts` mounts BetterAuth at `/api/auth/*` behind `authRateLimit`:

```
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email           # → { token, expiresAt, user }
GET  /api/auth/verify-email            # email verification link
POST /api/auth/sign-in/social          # OAuth start
GET  /api/auth/callback/:provider      # OAuth callback (register as the provider redirect URI)
POST /api/auth/one-time-token/verify   # OAuth handoff exchange → { token, expiresAt, user }
GET  /api/auth/jwks                    # public signing keys
```

`disabledPaths` turns every endpoint that acts on a live session into a 404: `/token` (it would mint a JWT from a session), `/get-session`, `/update-session`, `/list-sessions`, `/revoke-session`, `/revoke-sessions`, `/revoke-other-sessions`, `/sign-out`, `/update-user`, `/change-email`, `/change-password`, `/verify-password`, `/delete-user`, `/delete-user/callback`, `/link-social`, `/unlink-account`, `/list-accounts`, `/account-info`, `/get-access-token`, `/refresh-token`, `/one-time-token/generate`. Changing a password or linking a social account needs a JWT-authenticated route of our own; neither exists yet.

---

## Person JWT

### Verification

`apps/api/src/lib/auth/verifyIssuerJwt.ts` is the one verification path. It trusts:

- **this API**, always: issuer and audience `API_URL`, public keys read in-process from the `Jwks` table (no HTTP call to itself, no private key decrypted). The key set is cached 10 minutes, dropped when this process creates a key, and reloaded on an unknown `kid` at most once a second (another instance rotated; a forged `kid` cannot force a read per request);
- **a configured external issuer**, when `AUTH_ISSUER`, `AUTH_JWKS_URL` and `AUTH_AUDIENCE` are all set: keys from `createRemoteJWKSet(AUTH_JWKS_URL)`, cached 10 minutes.

The token's `iss` picks the issuer; an unknown `iss` is refused. `algorithms: ['ES256']` only, so `alg: none` and HS256 are refused; `iss`, `aud`, `exp`, `sub` and `iat` are required; 30 s clock tolerance. `sub` must be a local `User` id.

### jwtAuthMiddleware

`apps/api/src/middleware/auth/jwtAuthMiddleware.ts`. A bearer shaped like a JWT (three dot-separated segments) is verified and its user loaded with `findUserWithRelations` (the cached user every request loads) → `setUserContext`. A JWT this API signed must carry the user's current `jwtVersion` as `ver`; a soft-deleted user is refused.

- A JWT-shaped bearer that fails is a **401**, never a fall-through to API-token hashing.
- Unreachable issuer keys are a **503** (retryable, so a WebSocket keeps its identity).
- A JWT is never read from `?token=`: a JWT in a URL ends up in logs and referrers. API tokens keep `?token=`.

### Revocation and sign-out

`rotateUserJwts(userId)` (`apps/api/src/modules/user/services/rotateUserJwts.ts`) is the one writer of `User.jwtVersion`: it increments it through the scoped db client, inside the caller's transaction. Every caller below goes through it; the cache hooks drop the cached user, so the next request with an older JWT is a 401. No Redis lookup and no extra query: the version rides on the user row each request already loads. Why a version, not a timestamp: it needs no clock comparison and no second store (Aron, 2026-10-18: "the token just carries the version on the user… we just rotate that"). Permissions are not on the JWT, so a role or membership change applies on the next request without revoking anything. `jwtVerify` enforces `maxTokenAge` (30 days), so no JWT, external ones included, lives longer than that. A JWT from the configured external issuer carries that issuer's version, not ours, so the version check does not apply to it: rotating here (`/me/rotateJwts`, the admin rotation, password reset) does not end it. It ends when it expires (30 days at most), when the user is deleted here, when the issuer stops publishing its key, or, for a `grant` JWT, when the grant inquiry is revoked (read live). Signing out at the issuer is the issuer's job. The cached user row (`findUserWithRelations`, 10 minutes) is dropped by the cache hooks on the version bump; if that clear fails (the hook logs Redis errors), an old JWT can work until the cache entry expires, the same bound a role change has.

| What | Revokes |
|---|---|
| Sign out of one browser | Nothing on the server: the SPA drops its JWT |
| `POST /api/v1/me/rotateJwts` | Every JWT this API signed for the caller, on every device: the nuclear option, not a sign-out of one device. A `SessionAction` (`user.rotateJwts`, `validateSelfPermission`): an API token cannot rotate its user's JWTs unless its entitlements name it |
| `POST /api/admin/user/:id/rotateJwts` | Every JWT this API signed for that user (superadmin) |
| `redactUser` (`POST /api/v1/me/redact`, `POST /api/admin/user/:id/redact`) | Every JWT of the deleted account (`rotateUserJwts`; the soft-deleted user is refused too) |
| Password reset (BetterAuth `onPasswordReset`) | Every JWT this API signed for that user |

`jwtVersion` is never returned: every user response schema is `userResponseSchema` (`apps/api/src/modules/user/schemas/userResponseSchema.ts`, `UserScalarSchema.omit({ jwtVersion: true }).strip()`), and `jwtHandoff` omits it from the sign-in `user`. Nothing accepts it as input: BetterAuth declares it `input: false`, and no route takes a user body.

**Future: profile editing.** Profile editing will come (Aron, 2026-10-18); the write protection belongs in that route's body schema, not in a new mechanism.

- BetterAuth's `input: false` on `additionalFields` (`platformRole`, `lastLoginAt`, `jwtVersion`) only stops those fields in the request body of BetterAuth's own endpoints. It does nothing for our API routes or for server code calling `db.user.update`.
- Today nothing outside `rotateUserJwts` writes `jwtVersion`: there is no user update route, and BetterAuth's `/update-user` is in `disabledPaths`.
- A `/me` update route's body schema is the guard: accept only profile fields, never `jwtVersion`, `platformRole`, `email` or `lastLoginAt`. Email and password changes get their own JWT-authenticated routes, and a password change calls `rotateUserJwts`, like password reset does. Responses already go through `userResponseSchema`.


### Spoofing and WebSockets

A superadmin's JWT is superadmin, so spoofing rides it ([Spoof Middleware](#spoof-middleware)). A WebSocket's `authenticate` frame carries the JWT as its `authorization` header; `apps/api/src/ws/probe.ts` replays `/api/v1/me` with it, and the reauthorize sweep drops an identity whose JWT was revoked or expired.

---

## OAuth + One-Time Token

Server side: `apps/api/src/lib/auth/oauthHandoffPlugins.ts` and `jwtHandoff.ts`. Client side: `packages/ui/src/lib/auth/signin.ts` and `AuthCallbackPage` ([FRONTEND/AUTH.md](./FRONTEND/AUTH.md#oauth-callback)).

### OAuth Flow

1. **User clicks OAuth provider** (e.g., "Continue with Google")
2. **Frontend calls BetterAuth** via `client.signIn.social({ provider, callbackURL })`
3. **BetterAuth redirects** to the OAuth provider
4. **User authenticates** with provider
5. **Provider redirects to the API** at `{API_URL}/api/auth/callback/<provider>` — register this as the redirect URI with the provider
6. **API mints a one-time token** and redirects to `/auth/callback#ott=...`; the session cookie on that redirect is expired
7. **Callback page exchanges it** via `completeOAuthSignIn()`:
   - `POST /api/auth/one-time-token/verify` returns `{ token, expiresAt, user }`; `jwtHandoff` deletes the session
   - `storeJwtHandoff()` stores the JWT
   - Hydrate user data via `fetchAndHydrateMe()`
   - Navigate to redirectTo destination

### One-Time Token Handoff

The OAuth callback is a browser redirect, so the API cannot hand the SPA a JSON body there. `oauthHandoffPlugins()` bridges it:

- `oneTimeToken({ setOttHeaderOnNewSession: true })` mints a single-use token (1 minute, stored hashed) for every new session
- `oauthCallbackToken` moves that token onto the callback redirect as `#ott=` — a fragment, so it never reaches server logs or referrers
- The browser can't mint tokens itself (`disableClientRequest`, and `/one-time-token/generate` is disabled); verify consumes atomically via Redis `GETDEL` (`secondaryStorage.getAndDelete`)

Neither the session nor the JWT appears in a URL. The one-time token resolves only to the callback's 10-minute session, and its cookie is already expired.

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

URL token is useful for email links and file downloads (where headers can't be set). Only API tokens are read from the URL; a person JWT never is.

**Security:** Token lookups are cached for 10 minutes, so a revoked token (`isActive = false`) stops working within that window. `lastUsedAt` is touched on cache miss only.

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

`jwtAuthMiddleware` runs first and claims every JWT-shaped bearer; API keys are hex and never look like a JWT. A bearer that is neither (a BetterAuth session token, say) misses the lookup and authenticates no one.

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
- Reaches the user and every org and space they belong to, each capped by the user's own grant there ([Grants](./PERMISSIONS.md#grants))
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
- Permissions are the token's grant capped by the membership
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
- Permissions are the token's grant capped by the space membership
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

  // Permissions: full (entitlements null) or narrowed, capped per request by the owner's grant
  role             Role    @default(member)
  entitlements     Json?
  entitlementsOnly Boolean @default(false)

  integrationId String?   // optional link to an Integration

  // Which integrations it reaches (PERMISSIONS.md#integration-reach)
  integrationReach    IntegrationReach @default(none)
  integrationReachIds String[]

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

## Entitlement grants on a JWT

A person's JWT (self-issued or from the configured issuer, [Person JWT](#person-jwt)) is **the user, not a token**. With no `grant` claim it carries the full user ("the most access you can have"). With a `grant` claim it carries the narrower grant of the same user that an approved `grantUserEntitlements` inquiry holds ([Granting User Entitlements](./PERMISSIONS.md#granting-user-entitlements)). No Token row exists for it.

### Claims

| Claim | Meaning |
|---|---|
| `sub` | `User.id` |
| `grant` (optional) | id of an approved `grantUserEntitlements` inquiry targeting `sub`; read live on every request, so revoking it locks the JWT out at once |
| `iss`, `aud`, `exp`, `iat` | standard |

`jwtAuthMiddleware` sets `c.get('entitlementGrant')` (the grant, its inquiry id and the requesting integration) after the revocation check and before `setUserContext`, so the setup functions cap by it. Downstream:

- **Audit:** the actor is the user (`actorUserId`), `actorTokenId` stays null; the requesting integration, if any, is the audit `integrationId` (read from the permission actor, [The Actor](./PERMISSIONS.md#the-actor)).
- **Reach:** the grant's `integrationReach` decides which integrations the JWT touches ([Integration Reach](./PERMISSIONS.md#integration-reach)).
- **Batch:** `entitlementGrant` is cloned into sub-requests with the user.
- **Superadmin:** a superadmin's JWT is superadmin, spoofing included.

### What Kingdom Adds

Template signs and verifies its own JWTs. Kingdom is also the issuer other apps trust (`AUTH_ISSUER` pointing at it). Left for the Kingdom change: the embed login that mints a JWT for another app's audience (AUTH-008), and Kingdom's owner-authority code that still assumes a Token row (owner routes that re-hash the bearer, the actor-authority loader, and the org/space manage checks that cap memberships by hand and must move to `capGrant`).

---

## Auth Middleware Chain

Order matters. Applied in `apps/api/src/routes/api.ts`:

```typescript
apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);              // 1. Initialize context
apiRouter.route('/telemetry/browser', …);        // Public, before auth
apiRouter.route('/internal', internalRouter);    // Shared-secret auth only
apiRouter.use('/auth/*', authRateLimit);         // BetterAuth: the sign-in handshake
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.route('/unsubscribe', …);              // Public, signed link
apiRouter.use('*', jwtAuthMiddleware);           // 2. Person JWT
apiRouter.use('*', tokenAuthMiddleware);         // 3. API token
apiRouter.use('*', spoofMiddleware);             // 4. Superadmin spoofing (after user is resolved)
apiRouter.use('*', auditActorMiddleware);        // 5. Actor context for audit logs
apiRouter.use('*', apiRateLimit);
```

A JWT-shaped bearer is the person's JWT; any other bearer is looked up as an API token.
Spoof runs last so a superadmin can spoof through either credential.

### Flow

```
Request
  ↓
prepareRequest
  - user: null, token: null, entitlementGrant: null, permix: empty
  ↓
jwtAuthMiddleware
  - If issuer configured + JWT-shaped bearer → verify, load the grant, setUserContext()
  - Invalid JWT → 401
  ↓
jwtAuthMiddleware
  - JWT-shaped bearer → verify, load the user, check `ver` against `jwtVersion`, setUserContext()
  - Invalid or revoked JWT → 401; issuer keys unreachable → 503
  - Otherwise pass through unchanged
  ↓
tokenAuthMiddleware
  - If already has user (JWT) → skip
  - If valid Bearer/URL token matches a Token row → set token, setUserContext()
  - Otherwise pass through unchanged
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
  const spoofedBasic = await findUserByEmail(spoofEmail);
  if (!spoofedBasic) return next();
  const spoofedUser = await findUserWithRelations(spoofedBasic.id);
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
curl -H "Authorization: Bearer <jwt>" \
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

Requires any authenticated user (person JWT or token with user):

```typescript
import { validateUser } from '#/middleware/validations/validateUser';

router.get('/me', validateUser, handler);  // 401 if no user
```

### validateActor

Requires `getPrincipal(c).user`:

```typescript
import { validateActor } from '#/middleware/validations/validateActor';

router.get('/resource', validateActor, handler);  // 401 if the principal has no user
```

`getPrincipal(c).user` is `c.get('user')` with its memberships. Token auth calls `setUserContext` for User, OrganizationUser and SpaceUser tokens, so both validators admit the same callers; Organization and Space tokens carry no user and fail both.

### Session-Only Actions

There is no "tokens forbidden" guard. Token minting, token deletion, account redaction, organization deletion and rotating every JWT (`POST /api/v1/me/rotateJwts`) are `SessionAction`s, checked with `validateSelfPermission` ([PERMISSIONS.md](./PERMISSIONS.md#validateselfpermission)). A person's JWT with no grant holds them all; a token or grant holds one only when its entitlements name it. `token.create`, `user.redact` and `organization.delete` are person-only (`personOnlyActions`): `capGrant` drops them, so no API token or JWT grant holds them even when it names them, and their operations publish only `userJwt` in OpenAPI (`securityForRoute` reads the action off `validateSelfPermission`). A superadmin still passes on any credential (Aron, 2026-10-18: "put the same user check that we have in place on that one… we can revisit if things need to be more agentic"; 2026-10-19: "super admin is super admin").

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
| Person JWT | ✅ | ✅ | ✅ |
| User token | ✅ | ✅ | ✅ |
| OrganizationUser token | ✅ (scoped to its org) | ✅ | ✅ |
| SpaceUser token | ✅ (scoped to its space) | ✅ | ✅ |
| Issuer JWT (with or without grant) | ✅ | ✅ | ✅ |
| Organization token | ❌ (no user) | ❌ 401 | ❌ 401 |
| Space token | ❌ (no user) | ❌ 401 | ❌ 401 |

Organization and Space tokens are created without a `userId` (`organizationCreateToken`, `spaceCreateToken`); token auth only sets up their permissions. A route meant for them must skip both validators and rely on `validatePermission`. Use `validateUser` for `/me/*` and anything that acts as a person; authentication alone is never the whole check: every route also declares an action (`validatePermission` or `validateSelfPermission`).
