# AUTH-002: Unified Auth System

**Status**: 🏗️ In Progress
**Assignee**: Claude
**Priority**: High
**Created**: 2026-02-09
**Updated**: 2026-02-09

---

## Overview

Redesign authentication system to support multiple auth methods (email/password, OAuth, SSO/SAML) through a unified interface with standardized sign-in/sign-up experiences.

## Current State

- Email/password auth via Better Auth
- Partial Google OAuth support
- Separate flows for each auth method
- Props drilling pattern (`authClient` prop)
- Not designed for SSO/SAML expansion

## Goals

1. **Unified Interface**: Separate `signIn()` and `signUp()` functions handle all auth types
2. **No AuthClient**: Direct function calls from Zustand, no prop drilling
3. **Dynamic Discovery**: Backend tells frontend what auth methods are available
4. **Standardized UX**: Consistent sign-in/sign-up regardless of auth method
5. **Domain Routing**: Email domain → appropriate SSO provider
6. **Zustand Integration**: Auth functions called from store, session state managed centrally
7. **Future-Proof**: Easy to add new providers without code changes

## Key Components

### 0. Database-Backed Provider Management (Superadmin)

**Requirement:** Auth providers (OAuth, SAML, SSO) should be configurable via database, not hardcoded.

**Benefits:**
- Add/remove providers without code deployment
- Per-organization SSO configuration
- Superadmin UI for provider management
- Encrypted secrets storage
- Audit trail

**Model stub:**
```prisma
model AuthProvider {
  id              String   @id
  type            String   // 'oauth' | 'saml'
  provider        String   // 'google' | 'okta-acme'
  enabled         Boolean
  config          Json     // Provider-specific config (clientId, domains, etc.)
  organizationId  String?  // null = platform-wide

  // ... expand when implementing
}
```

**Superadmin UI:**
- CRUD interface for auth providers
- Test connection button
- Organization admins can configure their own SSO

**Note:** Implementation details TBD when ticket is picked up.

---

### 1. Unified Auth Interface

```typescript
// packages/shared/src/lib/auth/types.ts
export type EmailAuthMethod = {
  type: 'email';
  email: string;
  password: string;
  name?: string; // For signup
};

export type OAuthAuthMethod = {
  type: 'oauth';
  provider: 'google' | 'github' | 'microsoft';
};

export type SamlAuthMethod = {
  type: 'saml';
  provider: string;
  email?: string;
};

export type AuthMethod = EmailAuthMethod | OAuthAuthMethod | SamlAuthMethod;

export type AuthMethodConfig =
  | { type: 'email'; enabled: boolean }
  | { type: 'oauth'; providers: string[] }
  | { type: 'saml'; providers: Array<{ id: string; name: string; domains: string[] }> };

export type AuthSession = {
  user: AuthUser;
  session: {
    token: string;
    expiresAt: Date;
  };
};

// packages/shared/src/lib/auth/signin.ts
export async function signIn(method: AuthMethod): Promise<AuthSession> {
  switch (method.type) {
    case 'email':
      return signInWithEmail(method);
    case 'oauth':
      return signInWithOAuth(method);
    case 'saml':
      return signInWithSaml(method);
  }
}

// packages/shared/src/lib/auth/signup.ts
export async function signUp(method: AuthMethod): Promise<AuthSession> {
  switch (method.type) {
    case 'email':
      return signUpWithEmail(method);
    case 'oauth':
      return signUpWithOAuth(method); // OAuth auto-creates
    case 'saml':
      return signUpWithSaml(method); // JIT provisioning
  }
}

// packages/shared/src/store/slices/auth.ts
export type AuthSlice = {
  auth: {
    // ... existing fields
    availableMethods: AuthMethodConfig[];

    // New methods - call signIn/signUp functions
    fetchAuthMethods: () => Promise<AuthMethodConfig[]>;
    signIn: (method: AuthMethod) => Promise<void>;
    signUp: (method: AuthMethod) => Promise<void>;

    // Existing methods stay
    initialize: () => Promise<AuthUser | null>;
    logout: () => Promise<void>;
  };
};
```

### 2. Auth Methods Discovery Endpoint

```typescript
// apps/api/src/modules/auth/routes/authMethods.ts

GET /auth/methods
Query: ?email=user@company.com (optional, for domain-based routing)

Response:
{
  email: true,
  oauth: ['google', 'github', 'microsoft'],
  saml: [
    {
      id: 'okta-company',
      name: 'Company SSO',
      domains: ['company.com'],
      logoUrl: 'https://...'
    }
  ]
}
```

**Logic:**
- Always return email/password if enabled
- Return OAuth providers configured in Better Auth
- Check email domain against SAML provider domains
- Return only applicable SAML providers

### 3. Better Auth Configuration

```typescript
// apps/api/src/lib/auth.ts

export const auth = betterAuth({
  // ... existing config

  socialProviders: {
    google: { ... },
    github: { ... },
    microsoft: { ... },
  },

  // Add SAML plugin (when implementing SSO)
  plugins: [
    bearer(),
    saml({
      providers: [
        {
          id: 'okta-company',
          name: 'Company SSO',
          domains: ['company.com'],
          metadata: process.env.OKTA_METADATA_URL,
        }
      ]
    })
  ],
});
```

### 4. Dynamic Auth UI Components

```tsx
// packages/shared/src/components/AuthProvider.tsx

export const AuthProvider = () => {
  const { availableMethods, fetchAuthMethods } = useAppStore((s) => s.auth);

  useEffect(() => {
    fetchAuthMethods();
  }, []);

  return (
    <div>
      {availableMethods.map(method => {
        if (method.type === 'email') return <EmailPasswordForm />;
        if (method.type === 'oauth') {
          return method.providers.map(p => (
            <OAuthButton key={p} provider={p} />
          ));
        }
        if (method.type === 'saml') {
          return method.providers.map(p => (
            <SSOButton key={p.id} provider={p} />
          ));
        }
      })}
    </div>
  );
};
```

### 5. Email-Based Auth Routing

```tsx
// packages/shared/src/components/EmailInput.tsx

const EmailInput = () => {
  const [email, setEmail] = useState('');
  const { fetchAuthMethods, authenticate } = useAppStore((s) => s.auth);

  const handleSubmit = async () => {
    // Fetch auth methods for this email domain
    const methods = await fetchAuthMethods({ email });

    // If SSO required, auto-redirect
    const samlProvider = methods.saml?.[0];
    if (samlProvider) {
      await authenticate({ type: 'saml', provider: samlProvider.id, email });
      return;
    }

    // Otherwise, show password field
    setShowPasswordField(true);
  };
};
```

## Implementation Plan

### Phase 1: Database & Encryption ✅ COMPLETE
- [x] Design AuthProvider schema (org-scoped only)
- [x] Design encryption service with keyring + AAD
- [x] Create Prisma schema for AuthProvider
- [x] Generate migration
- [x] Implement EncryptionService with full validation
- [x] Add AuthProviderId to typed IDs system
- [x] Add authProvider permissions (own → organization.own)

### Phase 2: AuthProvider CRUD API ✅ COMPLETE
- [x] Create `apps/api/src/modules/authProvider/` module
- [x] Implement controllers:
  - [x] `authProviderReadMany.ts` - Returns platform + org providers
  - [x] `authProviderUpdate.ts` - Update org provider (with validatePermission)
  - [x] `authProviderDelete.ts` - Delete org provider (with validatePermission)
- [x] Implement `authProviderService.ts`
  - [x] `getPlatformProviders()` - Load from env vars
  - [x] `getAuthProvidersForOrg()` - Merge platform + org
  - [x] `createAuthProvider()` - Create with encryption
  - [x] `updateAuthProvider()` - Update with encryption
  - [x] `deleteAuthProvider()` - Delete provider
- [x] Create routes with validatePermission('own') middleware
- [x] Add superadmin readMany endpoint
- [x] Create organizationCreateAuthProvider (organization submodel pattern)

### Phase 3: Core Auth Functions
- [ ] Create `packages/shared/src/lib/auth/` directory
- [ ] Create `types.ts` with AuthMethod, AuthSession types
- [ ] Create `signin.ts` with signIn() function
  - [ ] Implement email/password signin
  - [ ] Implement OAuth signin (redirect initiation)
  - [ ] Stub SAML signin
- [ ] Create `signup.ts` with signUp() function
  - [ ] Implement email/password signup
  - [ ] Implement OAuth signup
  - [ ] Stub SAML signup

### Phase 4: Zustand Integration
- [ ] Update auth slice to call signIn/signUp functions
- [ ] Add `auth.signIn(method)` - calls signin.ts
- [ ] Add `auth.signUp(method)` - calls signup.ts
- [ ] Implement `fetchAuthMethods()` using readMany endpoint
- [ ] Update session state management
- [ ] Remove `createAuthClient` file
- [ ] Remove per-app `auth.ts` files

### Phase 4: Dynamic UI Components (Week 2)
- [ ] Create `AuthProvider` component
- [ ] Create `EmailPasswordForm` component
  - [ ] Call `auth.signIn({ type: 'email', ... })` for login
  - [ ] Call `auth.signUp({ type: 'email', ... })` for signup
- [ ] Create `OAuthButton` component
  - [ ] Call `auth.signIn({ type: 'oauth', ... })`
- [ ] Create `SSOButton` component (stub)
- [ ] Update LoginPage to use new components
- [ ] Update SignupPage to use new components
- [ ] Remove authClient prop from all components

### Phase 5: Email-Based Routing (Week 2-3)
- [ ] Add email input with domain detection
- [ ] Auto-route to SSO if domain matches
- [ ] Show password field only if email/password allowed
- [ ] Handle mixed auth scenarios (email + SSO for same domain)

### Phase 6: SSO/SAML Integration (Week 3-4)
- [ ] Evaluate Better Auth SAML plugin vs custom implementation
- [ ] Implement SAML provider configuration UI (admin)
- [ ] Add domain verification flow
- [ ] Implement JIT user provisioning
- [ ] Add SSO audit logging
- [ ] See AUTH-001 for full SSO requirements

## Files to Modify

### Database
- `packages/db/prisma/schema.prisma` - Add AuthProvider model (NEW)
- Run migration

### Backend - Encryption
- `packages/shared/src/lib/encryption/encryptionService.ts` (NEW)

### Backend - AuthProvider Module
- `apps/api/src/modules/authProvider/routes/authProvider.ts` (NEW)
- `apps/api/src/modules/authProvider/controllers/readMany.ts` (NEW)
- `apps/api/src/modules/authProvider/controllers/create.ts` (NEW)
- `apps/api/src/modules/authProvider/controllers/update.ts` (NEW)
- `apps/api/src/modules/authProvider/controllers/delete.ts` (NEW)
- `apps/api/src/modules/authProvider/services/authProviderService.ts` (NEW)
- `apps/api/src/modules/authProvider/validators/authProvider.ts` (NEW)
- `apps/api/src/modules/modules.ts` - Register authProvider module

### Backend - Auth Config
- `apps/api/src/lib/auth/platformProviders.ts` (NEW) - Load from env vars
- `apps/api/src/lib/auth.ts` - Update to use dynamic providers

### Frontend - Auth Functions
- `packages/shared/src/lib/auth/types.ts` (NEW)
- `packages/shared/src/lib/auth/signin.ts` (NEW)
- `packages/shared/src/lib/auth/signup.ts` (NEW)
- `packages/shared/src/lib/auth/providers/email.ts` (NEW)
- `packages/shared/src/lib/auth/providers/oauth.ts` (NEW)

### Frontend - Zustand
- `packages/shared/src/store/slices/auth.ts` - Add signIn(), signUp(), fetchAuthMethods()
- `packages/shared/src/lib/createAuthClient.ts` (DELETE after migration)

### Frontend - Apps
- `apps/web/app/lib/auth.ts` (DELETE)
- `apps/admin/app/lib/auth.ts` (DELETE)
- `apps/superadmin/app/lib/auth.ts` (DELETE)

## Testing

- [ ] Unit tests for authenticate() with each method type
- [ ] Integration tests for auth methods discovery
- [ ] E2E tests for email/password flow
- [ ] E2E tests for OAuth flow
- [ ] E2E tests for email domain routing
- [ ] Manual testing with different auth method combinations

## Success Criteria

1. ✅ Single `authenticate()` method works for all auth types
2. ✅ UI dynamically renders available auth methods
3. ✅ Email domain auto-routes to SSO when applicable
4. ✅ No auth-related prop drilling (all in Zustand)
5. ✅ Adding new OAuth provider requires only config change
6. ✅ Sign-in/sign-up UX is consistent across all methods
7. ✅ Session handling works the same regardless of auth type

## Reference

- **Finding**: `/tmp/AI_WORKSPACE/pr-review-findings/UNIFIED_AUTH_SYSTEM.md`
- **TODO**: `TODO.md` line 75-82
- **Related**: AUTH-001 (SSO implementation details)

## Notes

- This ticket focuses on the unified interface and OAuth
- Full SAML/SSO implementation is in AUTH-001
- Phase 5 can be deferred if SSO not immediately needed
- Consider Better Auth v2 features for additional providers

---

_Created during PR review - unified auth system is foundational for enterprise features_
