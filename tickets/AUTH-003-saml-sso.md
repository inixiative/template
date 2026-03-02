# AUTH-003: SAML SSO Implementation

**Status:** 🆕 Not Started
**Priority:** Medium
**Assignee:** Unassigned
**Epic:** Authentication & Authorization
**Dependencies:** AUTH-002 (Unified Auth System - Complete)

## Overview

Implement SAML 2.0 Single Sign-On (SSO) support using BetterAuth SSO plugin, enabling enterprise customers to authenticate via their identity providers (Okta, Azure AD, OneLogin, etc.).

## Context

**Current State:**
- ✅ AuthProvider database model with SAML type and encrypted secrets
- ✅ Frontend stubs exist (`signInWithSaml` throws "not implemented")
- ✅ UI components ready (LoginForm/SignupForm with SAML icon)
- ✅ Unified auth system (AUTH-002) complete

**Why This Matters:**
- Enterprise customers require SAML/SSO for security compliance
- Org-scoped providers allow different SSO per organization
- JIT (Just-In-Time) provisioning simplifies user onboarding
- Completes the unified authentication system

**Critical Note:**
- ⚠️ BetterAuth SAML plugin is in beta ("may not be suitable for production use")
- Feature should be labeled as "Beta" in UI
- Monitor BetterAuth changelog for production-ready status
- Fallback option: passport-saml library

## Requirements

### Backend
1. **Install Dependencies**
   - Add `@better-auth/sso` package

2. **Database Schema**
   - Create `ssoProvider` table (BetterAuth requirement)
   - Keep existing `AuthProvider` for UI/encryption layer
   - Dual-table architecture: `ssoProvider` for BetterAuth runtime, `AuthProvider` for admin UI

3. **BetterAuth Configuration**
   - Configure SSO plugin with SAML security settings
   - Implement JIT user provisioning
   - Set up organization provisioning
   - Security: disable IdP-initiated flow, enable response validation

4. **SAML Provider Service**
   - Create registration service with encryption
   - Sync between `AuthProvider` and `ssoProvider` tables
   - Support generic SAML 2.0 providers (not IdP-specific)

5. **Request Context**
   - Add BetterAuth instance to request context for provider registration

### Frontend
1. **Auth Client**
   - Update with SSO client plugin
   - Replace current auth client or extend existing

2. **Sign-In Implementation**
   - Replace `signInWithSaml` stub with BetterAuth SSO client call
   - Replace `signUpWithSaml` stub (same as signin for SAML)
   - Store redirectTo in localStorage before SAML redirect

3. **SAML Callback Routes**
   - Create `/auth/saml/callback` in all 3 apps (web, admin, superadmin)
   - **Critical:** BetterAuth SSO only returns session cookies, not bearer tokens
   - Custom extraction: session → bearer token via `/api/v1/me/tokens` → localStorage
   - Hydrate user and navigate to redirectTo

4. **LoginForm Integration**
   - Detect SAML providers (type === 'SAML')
   - Route to SAML signin instead of OAuth
   - Optional: email hint for IdP

### UI/UX
1. **SAML Provider Modal**
   - Provider ID input (unique identifier)
   - Display Name
   - Issuer / Entity ID
   - SSO Entry Point URL
   - Domain (optional, for auto-detection)
   - X.509 Certificate (textarea)
   - Show Service Provider metadata (read-only: Entity ID, ACS URL)
   - **Beta warning banner**

2. **Settings Pages**
   - Add "Configure SAML SSO" to auth provider settings
   - Support creating/editing SAML providers
   - Certificate expiration warnings (if parseable)

### Security
- Enable SAML response validation
- Disable IdP-initiated flow (SP-initiated only)
- Reject deprecated algorithms (SHA-1, RSA 1.5)
- 10-minute request TTL
- 5-minute clock skew tolerance
- Max response size: 256KB
- Max metadata size: 100KB

## Technical Design

### Dual Table Architecture

**AuthProvider (existing):**
- Purpose: Admin UI, encryption, auditing
- Features: Encrypted secrets, organization scoping, enabled/disabled state
- API: CRUD endpoints for management

**ssoProvider (new):**
- Purpose: BetterAuth runtime provider storage
- Features: SAML/OIDC configs, domain verification
- API: Managed by BetterAuth SSO plugin

**Sync Strategy:**
- On create: Write to both tables
- On update: Update both tables
- On delete: Delete from both tables

### Bearer Token Extraction Flow

```
1. User clicks "Continue with SAML"
2. Frontend calls client.signIn.sso({ providerId, callbackURL })
3. BetterAuth redirects to SAML IdP
4. User authenticates with IdP
5. IdP redirects to /auth/saml/callback with SAML assertion
6. BetterAuth validates assertion, creates session cookie
7. Callback route:
   - Fetch /auth/session (with session cookie)
   - POST /api/v1/me/tokens (create bearer token)
   - Store token in localStorage
   - Hydrate user
   - Navigate to redirectTo
```

### JIT Provisioning

```typescript
provisionUser: async ({ userInfo }) => {
  return {
    email: userInfo.email,
    name: userInfo.name || userInfo.email.split('@')[0],
    emailVerified: true,  // Trust SAML provider
  };
}
```

## Testing Strategy

### Manual Testing
1. Set up generic SAML test IdP (e.g., samltest.id or enterprise provider dev account)
2. Register SAML provider via API/UI
3. Test login flow: redirect → authenticate → callback → hydrate
4. Test JIT provisioning with new user email
5. Verify organization membership assignment
6. Test certificate validation and security settings

### Automated Testing
- Provider registration with encryption
- SAML config validation
- Table sync (AuthProvider ↔ ssoProvider)
- Error handling (invalid cert, expired assertion)

## Implementation Phases

### Phase 1: Backend Foundation (2 days)
- Install @better-auth/sso
- Create ssoProvider schema, run migration
- Configure BetterAuth with SSO plugin
- Create SAML provider service
- Add BetterAuth to context

### Phase 2: Frontend Integration (2 days)
- Update auth client with SSO plugin
- Implement signInWithSaml/signUpWithSaml
- Create SAML callback routes (3 apps)
- Wire SAML providers to LoginForm

### Phase 3: UI & Testing (2-3 days)
- Build SAML provider modal
- Add to settings pages
- Manual testing with test IdP
- Automated tests

**Total Estimate:** 6-7 days

## Success Criteria

**Backend:**
- ✅ BetterAuth SSO plugin configured with security settings
- ✅ ssoProvider table created and synced with AuthProvider
- ✅ SAML provider registration service with encryption working
- ✅ BetterAuth instance accessible in request context

**Frontend:**
- ✅ signInWithSaml and signUpWithSaml implemented (stubs replaced)
- ✅ SAML callback routes in all 3 apps
- ✅ Bearer token extraction from SAML session working
- ✅ LoginForm/SignupForm detect and route SAML providers

**UI:**
- ✅ SAML provider configuration modal with all fields
- ✅ Beta warning displayed prominently
- ✅ Service Provider metadata shown for IdP configuration

**Testing:**
- ✅ Manual SAML login flow successful
- ✅ JIT provisioning creates users on first login
- ✅ Organization membership assigned correctly
- ✅ Automated tests pass

## Risks & Mitigations

**Risk 1: BetterAuth SAML Beta Status**
- Mitigation: Label as Beta, extensive error handling, monitor changelog
- Fallback: Migrate to passport-saml if issues arise

**Risk 2: Bearer Token Extraction Complexity**
- Mitigation: Document pattern clearly, consider session-only alternative

**Risk 3: Dual Table Sync**
- Mitigation: Transaction-based sync, clear ownership boundaries

**Risk 4: IdP Compatibility**
- Mitigation: Test with multiple IdPs, support generic SAML 2.0 spec

## Future Enhancements

- Domain-based auto-detection of SAML provider
- SCIM support for user/group sync
- Certificate auto-rotation
- SSO enforcement (require SAML for specific domains)
- OIDC support (OAuth + SAML in single SSO plugin)

## References

- [BetterAuth SSO Plugin](https://www.better-auth.com/docs/plugins/sso)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [AUTH-002 Ticket](./AUTH-002-unified-auth-system.md) (prerequisite)
- Plan file: `/Users/arongreenspan/.claude/plans/sorted-nibbling-bee.md`
