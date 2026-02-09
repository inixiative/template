# AUTH-002: Unified Auth System

**Status**: 🆕 Not Started
**Assignee**: TBD
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

1. **Unified Interface**: Single `authenticate()` method handles all auth types
2. **Dynamic Discovery**: Backend tells frontend what auth methods are available
3. **Standardized UX**: Consistent sign-in/sign-up regardless of auth method
4. **Domain Routing**: Email domain → appropriate SSO provider
5. **Zustand Integration**: Auth methods in store, no prop drilling
6. **Future-Proof**: Easy to add new providers without code changes

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
// packages/shared/src/store/slices/auth.ts

type AuthMethod =
  | { type: 'email'; email: string; password: string }
  | { type: 'oauth'; provider: 'google' | 'github' | 'microsoft' }
  | { type: 'saml'; provider: string; email?: string };

type AuthMethodConfig =
  | { type: 'email'; enabled: boolean }
  | { type: 'oauth'; providers: string[] }
  | { type: 'saml'; providers: Array<{ id: string; name: string; domains: string[] }> };

export type AuthSlice = {
  auth: {
    // ... existing fields
    availableMethods: AuthMethodConfig[];

    // New methods
    fetchAuthMethods: () => Promise<AuthMethodConfig[]>;
    authenticate: (method: AuthMethod) => Promise<void>;

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

### Phase 1: Auth Methods Discovery (Week 1)
- [ ] Create `GET /auth/methods` endpoint
- [ ] Add domain-based SAML provider lookup
- [ ] Update auth slice with `availableMethods` state
- [ ] Implement `fetchAuthMethods()` in Zustand

### Phase 2: Unified Auth Interface (Week 1-2)
- [ ] Create `authenticate(method)` function in auth slice
- [ ] Handle email/password flow
- [ ] Handle OAuth redirect flow
- [ ] Handle SAML redirect flow (stub for now)
- [ ] Move Better Auth client creation into auth slice
- [ ] Remove `createAuthClient` file and per-app auth.ts files

### Phase 3: Dynamic UI Components (Week 2)
- [ ] Create `AuthProvider` component
- [ ] Create `EmailPasswordForm` component
- [ ] Create `OAuthButton` component
- [ ] Create `SSOButton` component (stub)
- [ ] Update LoginPage to use AuthProvider
- [ ] Update SignupPage to use AuthProvider
- [ ] Remove authClient prop from all components

### Phase 4: Email-Based Routing (Week 2-3)
- [ ] Add email input with domain detection
- [ ] Auto-route to SSO if domain matches
- [ ] Show password field only if email/password allowed
- [ ] Handle mixed auth scenarios (email + SSO for same domain)

### Phase 5: SSO/SAML Integration (Week 3-4)
- [ ] Evaluate Better Auth SAML plugin vs custom implementation
- [ ] Implement SAML provider configuration UI (admin)
- [ ] Add domain verification flow
- [ ] Implement JIT user provisioning
- [ ] Add SSO audit logging
- [ ] See AUTH-001 for full SSO requirements

## Files to Modify

### Backend
- `apps/api/src/lib/auth.ts` - Add OAuth providers, prepare for SAML
- `apps/api/src/modules/auth/routes/authMethods.ts` (NEW)
- `apps/api/src/modules/auth/controllers/authMethods.ts` (NEW)

### Frontend - Shared Package
- `packages/shared/src/store/slices/auth.ts` - Add authenticate(), fetchAuthMethods()
- `packages/shared/src/components/AuthProvider.tsx` (NEW)
- `packages/shared/src/components/EmailPasswordForm.tsx` (NEW)
- `packages/shared/src/components/OAuthButton.tsx` (NEW)
- `packages/shared/src/components/SSOButton.tsx` (NEW)
- `packages/shared/src/lib/createAuthClient.ts` (DELETE after migration)

### Frontend - Apps
- `apps/web/app/lib/auth.ts` (DELETE)
- `apps/admin/app/lib/auth.ts` (DELETE)
- `apps/web/app/routes/login.tsx` - Use AuthProvider
- `apps/web/app/routes/signup.tsx` - Use AuthProvider
- `apps/admin/app/routes/login.tsx` - Use AuthProvider

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
