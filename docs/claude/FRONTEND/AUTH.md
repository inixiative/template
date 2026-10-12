# Frontend Authentication

<!-- toc:start -->

## Contents

- [Architecture](#architecture)
- [Unified Auth Method](#unified-auth-method)
- [Pages and Forms](#pages-and-forms)
- [useAuthProviders](#useauthproviders)
- [OAuth Callback](#oauth-callback)
- [Guards](#guards)
- [Auth Slice](#auth-slice)
- [Navigation Helpers](#navigation-helpers)
- [Security](#security)
- [Testing](#testing)
- [Key Files](#key-files)

<!-- toc:end -->

Sign-in, sign-up, OAuth callback, guards and the auth slice in `@template/ui`. Backend sessions, tokens and middleware: [AUTH.md](../AUTH.md). Permission checks: [PERMISSIONS.md](../PERMISSIONS.md#frontend-checks).

## Architecture

- **BetterAuth client** (`better-auth/client`) talks to the API's `/api/auth/*` routes.
- **Bearer token in localStorage.** Email sign-in and the OAuth callback both end in `setToken(token, expiresAt)` (`auth_token` / `auth_token_expiry`). Every API call sends `Authorization: Bearer <token>`.
- **`/me` hydrates the store.** `fetchAndHydrateMe` loads the user, organizations, spaces and space memberships, then runs `permissions.setup(me)`.

**Email/password:**
```
signIn({ type: 'email', email, password })
  ↓
client.signIn.email → session token → setToken()
  ↓
fetchAndHydrateMe() → permissions.setup()
  ↓
navigatePreserving(redirectTo || '/dashboard', 'context')
```

**OAuth:**
```
signIn({ type: 'oauth', provider })
  ↓
client.signIn.social → provider → API callback
  ↓
API redirects to /auth/callback#ott=<one-time token>
  ↓
AuthCallbackPage: completeOAuthSignIn(ott) → setToken()
  ↓
fetchAndHydrateMe() → navigate(localStorage.authRedirectTo || '/dashboard')
```

The session token never travels in a URL; only the single-use `ott` does, in the fragment. See [AUTH.md → Bearer Token Handoff](../AUTH.md#bearer-token-handoff).

---

## Unified Auth Method

**Location:** `packages/ui/src/lib/auth/types.ts`

```typescript
type AuthMethod =
  | { type: 'email'; email: string; password: string; name?: string }
  | { type: 'oauth'; provider: string; callbackURL?: string }
  | { type: 'saml'; provider: string; email?: string };

signIn(method: AuthMethod): Promise<void>
signUp(method: AuthMethod): Promise<SignUpResult>

type SignUpResult =
  | { status: 'authenticated' }
  | { status: 'verification-pending'; email: string }
  | { status: 'redirecting' };
```

- `signIn` / `signUp` live in `packages/ui/src/lib/auth/{signin,signup}.ts`; the store wraps them (`auth.signIn`, `auth.signUp`).
- `signUp` with email requires `name`. The API requires email verification, so a new account usually returns `verification-pending` and stays logged out.
- `saml` throws `SAML authentication not yet implemented` (see [AUTH-003](../../../tickets/AUTH-003-saml-sso.md)).
- OAuth defaults: `callbackURL` = `${origin}/auth/callback`, `errorCallbackURL` = `${origin}/login`.

---

## Pages and Forms

Pages are thin; the forms own their state and read the store directly (no prop drilling).

| File | Role |
|------|------|
| `packages/ui/src/pages/LoginPage.tsx` | `LoginPage({ hideSignup? })` renders `LoginForm`, links to signup with `navigateToSignup(getStore, true)` |
| `packages/ui/src/pages/SignupPage.tsx` | `SignupPage` renders `SignupForm`, links to login with `navigateToLogin(getStore, true)` |
| `packages/ui/src/pages/AuthCallbackPage.tsx` | OAuth callback (`/auth/callback` in all three apps) |
| `packages/ui/src/components/auth/LoginForm.tsx` | `LoginFormProps = { hideSignup?, onSignupClick? }` |
| `packages/ui/src/components/auth/SignupForm.tsx` | `SignupFormProps = { onLoginClick? }` |

App routes only mount them:

```typescript
// apps/web/app/routes/_public/login.tsx
export const Route = createFileRoute('/_public/login')({
  beforeLoad: (ctx) => requirePublic(ctx),
  component: () => <LoginPage />,
});
```

**LoginForm / SignupForm behavior:**
- Fetch providers with `useAuthProviders()`; render a "Continue with {name}" button per enabled provider, then the email form.
- Provider icons are Iconify slugs (`simple-icons:google`, `simple-icons:github`, `lucide:shield`, fallback `lucide:key`).
- Errors go through `describeError` and show twice: inline and as a toast.
- A provider-load failure shows "Unable to load authentication providers. You can still log in with email and password." and keeps the email form.
- `LoginForm` reads `?error=` (set by the callback page on failure) into its initial error.
- On success: `navigatePreserving(search.redirectTo || '/dashboard', 'context')`.
- OAuth click stores `redirectTo` in `localStorage.authRedirectTo` before leaving the page.
- `SignupForm` shows "Open the verification link sent to {email}" on `verification-pending`.

Also exported from `@template/ui/components/auth` but not used by the forms: `AuthDivider`, `SocialAuthButton`. `LoginCredentials` / `SignupCredentials` live in `packages/ui/src/types/auth.ts`.

---

## useAuthProviders

**Location:** `packages/ui/src/hooks/useAuthProviders.ts`

```typescript
const { providers, isLoading, error } = useAuthProviders();
```

- `?org=<id>` in the URL → `organizationReadAuthProvider` (platform + that org's providers).
- Otherwise → `authProviderReadMany` (platform providers from `apps/api/src/lib/auth/platformProviders.ts`).
- Only the active query is enabled; both retry twice.
- Returns every provider; callers filter on `enabled` (the forms do).

---

## OAuth Callback

**Location:** `packages/ui/src/pages/AuthCallbackPage.tsx`, mounted by `apps/{web,admin,superadmin}/app/routes/_public/auth.callback.tsx`.

1. Read `ott` from the URL fragment, then strip the fragment with `history.replaceState`.
2. `completeOAuthSignIn(ott)` → `client.oneTimeToken.verify` → `setToken(session.token, session.expiresAt)`.
3. `fetchAndHydrateMe(useAppStore.setState, useAppStore.getState)`.
4. Navigate to `localStorage.authRedirectTo` (then remove it) or `/dashboard`.
5. On failure: log, then navigate to `/login?error=<message>`.

A `useRef` guard runs the exchange once; the token is single-use and StrictMode runs effects twice.

---

## Guards

**Location:** `packages/ui/src/guards/authGuard.ts` (`createAuthGuards`), instances in `packages/ui/src/guards/appGuards.ts`.

```typescript
import { requireAuth, requirePublic } from '@template/ui/guards';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});
```

| Guard | Behavior |
|-------|----------|
| `requireAuth` | `auth.initialize()`; if not authenticated, redirect to `/login?redirectTo=<path+search+hash>` and carry `org`, `space`, `spoof` as login params |
| `requirePublic` | `auth.initialize()`; if authenticated, redirect to `?redirectTo` or `/dashboard` |

Initialization errors are swallowed; the redirect handles the unauthenticated case.

---

## Auth Slice

**Location:** `packages/ui/src/store/slices/auth.ts`, type in `packages/ui/src/store/types/auth.ts`. Full slice reference: [ZUSTAND.md](../ZUSTAND.md).

| Member | Behavior |
|--------|----------|
| `initialize()` | Once per load: if a token exists, `fetchAndHydrateMe` + websocket auth. A failed hydrate logs out and rethrows. Sets `isInitialized` |
| `signIn(method)` | Calls `lib/auth/signIn`; for non-OAuth methods hydrates `/me` and authenticates the websocket |
| `signUp(method)` | Calls `lib/auth/signUp`; hydrates on `authenticated`, clears local auth on `verification-pending`; returns the result |
| `refreshMe()` | Re-hydrate `/me` |
| `setSpoof(email \| null)` | Sets `spoofUserEmail`, re-hydrates `/me` (sent as `x-spoof-user-email`), spoofs/unspoofs the websocket |
| `logout()` | `client.signOut` with the bearer token; always clears token, user, permissions, tenant (→ public) and navigates to `/login`; rethrows a sign-out error |
| `setStrategy(strategy)` | `{ type: 'login' }` or `{ type: 'embed', parentOrigin? }`; sets `isEmbedded` |

State: `user`, `organizations`, `spaces`, `spaceUsers` (dicts by id / spaceId), `spoofUserEmail`, `spoofingUserEmail` (from the `x-spoofing-user-email` response header), `isAuthenticated`, `isInitialized`, `strategy`, `client`.

Logout from a component:

```typescript
const logout = useAppStore((state) => state.auth.logout);
await logout();
```

---

## Navigation Helpers

**Location:** `packages/ui/src/lib/routeRedirect.ts`, store `navigation.navigatePreserving`.

```typescript
navigatePreserving(to, 'context');  // keep org/space (+ spoof, flow)
navigatePreserving(to, 'spoof');    // keep spoof (+ flow) only
navigatePreserving(to, 'all');      // keep every current search param

navigateToLogin(getStore, preserveSearch?);
navigateToSignup(getStore, preserveSearch?);
redirectPreservingContext(beforeLoadCtx, to);  // throw a redirect keeping org/space/spoof
```

`navigateToLogin` / `navigateToSignup` either carry the current search + hash (`preserveSearch`) or set `?redirectTo=<current path>`. Login ↔ signup links pass `preserveSearch: true`, so `redirectTo` survives the switch:

1. `/settings` while logged out → guard redirects to `/login?redirectTo=/settings`.
2. "Sign Up" → `/signup?redirectTo=/settings`.
3. After an authenticated sign-up → `/settings`.

---

## Security

- **CSRF / OAuth state:** BetterAuth validates state and nonce; trusted origins come from the API's CORS allow-list (`getAllowedOrigins`).
- **Spoofing** is superadmin-only on the API; the UserMenu hides spoof controls unless the user is superadmin or already spoofing, and the superadmin app hides them entirely.
- **Token storage** is localStorage (readable by any script on the origin), not an HTTP-only cookie.

**Environment:**

```env
# API
BETTER_AUTH_SECRET=<random-secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

# Frontends
VITE_API_URL=http://localhost:8000
```

---

## Testing

- `packages/ui/src/store/slices/auth.test.tsx` — auth slice. There are no LoginForm/LoginPage tests.

```bash
cd packages/ui && bun run test
```

---

## Key Files

- `packages/ui/src/lib/auth/` — `signin.ts`, `signup.ts`, `token.ts`, `fetchAndHydrateMe.ts`, `types.ts`
- `packages/ui/src/hooks/useAuthProviders.ts`
- `packages/ui/src/hooks/useAuthStrategy/` — embed strategy context (`AuthStrategyProvider`, `useAuthStrategy`)
- `packages/ui/src/pages/{LoginPage,SignupPage,AuthCallbackPage}.tsx`
- `packages/ui/src/components/auth/` — `LoginForm`, `SignupForm`, `AuthDivider`, `SocialAuthButton`
- `packages/ui/src/guards/{authGuard,appGuards}.ts`
- `packages/ui/src/store/slices/auth.ts`, `packages/ui/src/store/types/auth.ts`
- `packages/ui/src/lib/routeRedirect.ts`, `packages/ui/src/lib/searchParams.ts`
