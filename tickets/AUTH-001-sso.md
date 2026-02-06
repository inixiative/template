# AUTH-001: SSO (SAML/OIDC)

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-02-06

---

## Overview

Implement enterprise Single Sign-On with SAML 2.0 and OpenID Connect support for Okta, Azure AD, Google Workspace, and other identity providers.

## Key Components

### SAML 2.0
- **Identity providers**: Okta, Azure AD, OneLogin, Auth0
- **Service provider**: Template app as SP
- **Metadata exchange**: SP metadata, IdP metadata import
- **Assertions**: Parse and validate SAML responses
- **Attributes**: Map IdP attributes to user fields

### OpenID Connect (OIDC)
- **Providers**: Google Workspace, Azure AD, Auth0
- **Authorization code flow**: Secure token exchange
- **UserInfo endpoint**: Fetch user details
- **Token validation**: JWT signature verification

### Just-in-Time (JIT) Provisioning
- **Auto-create users**: On first SSO login
- **Attribute mapping**: Email, name, role from IdP
- **Organization assignment**: Auto-join based on domain
- **Role mapping**: IdP groups → app roles

### SCIM (User Sync)
- **User provisioning**: IdP → app user creation
- **User deprovisioning**: Delete/disable users
- **Group sync**: IdP groups → app teams
- **Attribute updates**: Keep user data in sync

### Enterprise Features
- **Per-organization SSO**: Different IdPs per org
- **SSO enforcement**: Require SSO for organization
- **Domain verification**: Verify org owns domain
- **Fallback auth**: Allow password login override (admin)

## Admin UI

- SSO configuration page (per organization)
- Test SSO connection
- View SSO audit logs
- Manage domain verification
- Configure attribute mapping

## Reference

- TODO.md: Line 96 (Feature flags - SSO mentioned)
- Current: BetterAuth supports some OAuth providers

## Related Tickets

- **Blocked by**: None
- **Blocks**: None

---

_Stub ticket - expand when prioritized_
