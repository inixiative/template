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

### useAuthFlow

**Location:** `/packages/ui/src/hooks/useAuthFlow.ts`

Handles auth submission, loading state, errors, and redirects.

**Purpose:** Eliminates duplication between login/signup flows.

```typescript
import { useAuthFlow } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';

const signIn = useAppStore((state) => state.auth.signIn);
const { handleAuth, error, isLoading } = useAuthFlow(signIn);

<LoginForm onSubmit={handleAuth} error={error} isLoading={isLoading} />
```

**Returns:**
- `handleAuth(credentials)` - Submit handler function
- `error` - Error message string or undefined
- `isLoading` - Loading boolean

**Features:**
- Generic - works with any auth function (signIn, signUp)
- Preserves `redirectTo` param from URL
- Auto-redirects after successful auth
- Handles errors and loading states

**Implementation:**
```typescript
export const useAuthFlow = (authFn: (credentials: Record<string, any>) => Promise<void>) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useAppStore((state) => state.navigation.navigate);

  const handleAuth = async (credentials: Record<string, any>) => {
    setError(undefined);
    setIsLoading(true);

    try {
      await authFn(credentials);
      navigate?.({ to: search.redirectTo || '/dashboard' });
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { handleAuth, error, isLoading };
};
```

---

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

### LoginPage

**Location:** `/packages/ui/src/pages/LoginPage.tsx`

```typescript
import { useAuthFlow, useAuthProviders } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signIn = useAppStore((state) => state.auth.signIn);
  const { handleAuth, error, isLoading } = useAuthFlow(signIn);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginForm
        onSubmit={handleAuth}
        onSignupClick={hideSignup ? undefined : () => {
          const signupUrl = buildPathWithSearch('/signup', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
          navigatePreservingContext(signupUrl);
        }}
        providers={providerError ? [] : providers}
        error={providerError ? 'Unable to load authentication providers. You can still sign in with email and password.' : error}
        isLoading={isLoading || isLoadingProviders}
      />
    </div>
  );
};
```

**Key Points:**
- Uses `useAuthFlow` for auth handling
- Uses `useAuthProviders` for provider fetching
- Injects error into form (no duplicate renders)
- Preserves `redirectTo` param when navigating to signup
- Shows fallback error if providers fail to load

### SignupPage

**Location:** `/packages/ui/src/pages/SignupPage.tsx`

```typescript
export const SignupPage = () => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const signUp = useAppStore((state) => state.auth.signUp);
  const { handleAuth, error, isLoading } = useAuthFlow(signUp);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm
        onSubmit={handleAuth}
        onLoginClick={() => {
          const loginUrl = buildPathWithSearch('/login', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
          navigatePreservingContext(loginUrl);
        }}
        providers={providerError ? [] : providers}
        error={providerError ? 'Unable to load authentication providers. You can still sign up with email and password.' : error}
        isLoading={isLoading || isLoadingProviders}
      />
    </div>
  );
};
```

---

## Components

### LoginForm

**Location:** `/packages/ui/src/components/auth/LoginForm.tsx`

Presentational component for login UI.

**Props:**
```typescript
export type LoginFormProps = {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onSignupClick?: () => void;
  providers?: AuthProvider[];
  error?: string;
  isLoading?: boolean;
};
```

**Features:**
- Email/password form
- OAuth/SAML provider buttons
- Auto-shows divider when providers present
- Error display
- Loading states
- Signup link

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

Presentational component for signup UI.

**Props:**
```typescript
export type SignupFormProps = {
  onSubmit: (credentials: SignupCredentials) => Promise<void>;
  onLoginClick?: () => void;
  providers?: AuthProvider[];
  error?: string;
  isLoading?: boolean;
};
```

**Features:**
- Name, email, password fields
- OAuth/SAML provider buttons
- Auto-shows divider when providers present
- Error display
- Loading states
- Login link

---

## Types

**Location:** `/packages/ui/src/types/auth.ts`

```typescript
export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignupCredentials = {
  email: string;
  password: string;
  name: string;
};
```

**Note:** Store uses generic `SignInCredentials` and `SignUpCredentials` as `Record<string, any>` for flexibility with different auth providers.

---

## OAuth/SAML

### OAuth Redirect Utility

**Location:** `/packages/ui/src/lib/auth/oauthRedirect.ts`

Handles OAuth provider redirects.

```typescript
import { redirectToOAuthProvider } from '@template/ui/lib';

// Called automatically by LoginForm/SignupForm provider buttons
redirectToOAuthProvider(provider);
```

**Implementation:**
```typescript
export const redirectToOAuthProvider = (provider: AuthProvider): void => {
  try {
    const baseURL = import.meta.env.VITE_API_URL;
    const callbackURL = `${window.location.origin}/auth/callback`;

    // Security: Validate callback origin
    const allowedOrigins = [window.location.origin, 'http://localhost:3000'];
    const callbackOrigin = new URL(callbackURL).origin;
    if (!allowedOrigins.includes(callbackOrigin)) {
      throw new Error('Invalid callback URL');
    }

    window.location.href = `${baseURL}/auth/${provider.provider.toLowerCase()}/signin?callbackURL=${encodeURIComponent(callbackURL)}`;
  } catch (err) {
    console.error('OAuth redirect failed:', err);
  }
};
```

**Security Features:**
- Validates callback URL origin
- Only allows current origin + localhost:3000
- Auto-encodes callback URL parameter
- Catches and logs errors

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
