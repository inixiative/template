# Authentication

Comprehensive guide to authentication in the template using BetterAuth, JWT sessions, and OAuth providers.

## Architecture

**Stack:**
- BetterAuth - Auth framework with JWT sessions
- httpOnly cookies - Secure token storage
- OAuth/SAML - External identity providers
- ReBAC - Permission system (see PERMISSIONS.md)

**Flow:**
```
User submits credentials
  ↓
Store calls auth service (signIn/signUp)
  ↓
BetterAuth API validates + sets JWT cookie
  ↓
Store hydrates user data
  ↓
Auto-redirect to redirectTo or /dashboard
```

---

## Hooks

### useAuthProviders

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

## Login/Signup Pattern

### Unified Auth System

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

### LoginPage

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

### SignupPage

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

## Components

### LoginForm

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

### SignupForm

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

## Types

**Location:** `/packages/ui/src/lib/auth/types.ts`

### AuthMethod (Unified Auth Interface)

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

## OAuth/SAML

### OAuth Flow (BetterAuth Client)

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

### Provider Configuration

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

## Navigation Patterns

### Preserving Context

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

### Preserving redirectTo

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

## Guards

**Location:** `/packages/ui/src/guards/authGuard.ts`

Route guards for protecting pages and redirecting unauthenticated users.

### requireAuth

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

### requirePublic

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

## Store Integration

### Auth Slice

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

#### initialize()

Loads user data from backend `/me` endpoint.

```typescript
await auth.initialize();
```

**Called by:**
- Auth guards (`requireAuth`, `requirePublic`)
- Authenticated layout (on mount)

#### signIn(credentials)

Authenticates user via BetterAuth.

```typescript
await auth.signIn({ email, password });
```

**Flow:**
1. Calls BetterAuth API
2. Sets JWT in httpOnly cookie
3. Hydrates store with user data
4. Sets `isAuthenticated` to true

#### signUp(credentials)

Creates new user via BetterAuth.

```typescript
await auth.signUp({ email, password, name });
```

**Flow:**
1. Calls BetterAuth API
2. Sets JWT in httpOnly cookie
3. Hydrates store with user data
4. Sets `isAuthenticated` to true

#### logout()

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

## Error Handling

### Pattern: Error Injection

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

### Error Messages

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

## Testing

### Hook Tests

**Location:** `/packages/ui/src/hooks/useAuthFlow.test.ts`

```bash
cd packages/ui && bun test useAuthFlow
```

**Coverage:**
- Successful auth flow
- Error handling
- Loading states
- redirectTo preservation

### Page Tests

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

## Security

### Best Practices

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

### Environment Variables

```env
# BetterAuth
BETTER_AUTH_SECRET=<random-secret>

# OAuth Providers (Platform)
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>

# API
VITE_API_URL=http://localhost:8000
```

---

## Common Patterns

### Login with redirectTo

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

### Switching between Login/Signup

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

### OAuth Login

```typescript
// LoginForm automatically handles OAuth
<Button onClick={() => redirectToOAuthProvider(provider)}>
  Continue with {provider.name}
</Button>

// Redirects to: /auth/google/signin?callbackURL=<origin>/auth/callback
```

### Logout

```typescript
const logout = useAppStore((state) => state.auth.logout);
const navigate = useAppStore((state) => state.navigation.navigate);

await logout();
navigate({ to: '/login' });
```

---

## Key Files

### Hooks
- `/packages/ui/src/hooks/useAuthFlow.ts`
- `/packages/ui/src/hooks/useAuthProviders.ts`

### Pages
- `/packages/ui/src/pages/LoginPage.tsx`
- `/packages/ui/src/pages/SignupPage.tsx`

### Components
- `/packages/ui/src/components/auth/LoginForm.tsx`
- `/packages/ui/src/components/auth/SignupForm.tsx`

### Utilities
- `/packages/ui/src/lib/auth/oauthRedirect.ts`
- `/packages/ui/src/lib/searchParams.ts`

### Guards
- `/packages/ui/src/guards/authGuard.ts`

### Store
- `/packages/ui/src/store/slices/auth.ts`
- `/packages/ui/src/store/slices/navigation.ts`

### Types
- `/packages/ui/src/types/auth.ts`
- `/packages/ui/src/store/types/auth.ts`

### Backend
- `/apps/api/src/lib/auth/platformProviders.ts`
- `/apps/api/src/modules/authProvider/` (org providers)
