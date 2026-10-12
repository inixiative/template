# App Structure

<!-- toc:start -->

## Contents

- [The Three Apps](#the-three-apps)
  - [Web - Consumer/End-User Interface](#web---consumerend-user-interface)
  - [Admin - Provider/Operator Interface](#admin---provideroperator-interface)
  - [Superadmin - Platform Operations](#superadmin---platform-operations)
- [Key Insight](#key-insight)
- [Frontend Architecture Overview](#frontend-architecture-overview)
- [Context Switching](#context-switching)
- [White-Label Mode](#white-label-mode)
- [Example](#example)
- [Implementation Notes](#implementation-notes)

<!-- toc:end -->

This template provides three frontend applications that work together as a multi-tenant SaaS platform.

## The Three Apps

### Web - Consumer/End-User Interface
- **Who**: End users, consumers, participants
- **Purpose**: Browse, participate, consume content
- **Context**: Personal/Organization/Space (as a participant)

### Admin - Provider/Operator Interface
- **Who**: Space operators, marketplace managers, content providers
- **Purpose**: Manage spaces, content, and operations
- **Context**: Personal/Organization/Space (as an operator)

### Superadmin - Platform Operations
- **Who**: Platform team (you)
- **Purpose**: Manage entire platform, system health, all customers
- **Context**: User context only; the ContextSelector is rendered locked (`<AppShell lockedContext showSpoofControls={false}>`)
- Non-superadmins get `<Unauthorized />` from its `_authenticated.tsx` layout

## Key Insight

**All three apps share the same multi-tenant architecture:**
- One shared store, AppShell, guards and permission system (Permix/ReBAC)
- Web and Admin let the user switch Personal/Organization/Space in the ContextSelector
- Each app has its own nav config (`apps/{app}/app/config/nav/`)

**The difference is perspective, not structure:**
- Web = consuming/participating in spaces
- Admin = operating/managing spaces
- Superadmin = managing the platform itself

## Frontend Architecture Overview

All three apps share common frontend infrastructure. See [FRONTEND.md](FRONTEND.md) for comprehensive details.

**Shared Stack:**
- **Router**: TanStack Router with file-based routing and guards
- **State**: Zustand with 6 slices (Client, Auth, Navigation, Permissions, Tenant, UI); see [ZUSTAND.md](ZUSTAND.md)
- **Auth**: BetterAuth with bearer tokens
- **Permissions**: Permix/ReBAC integrated into frontend state
- **UI**: Shared component library, hooks, pages and store in `@template/ui`
- **API**: Generated client `@template/sdk` (hey-api, OpenAPI) with optimistic mutations

**App-Specific Differences:**
- Navigation configs (different routes/menus per app)
- Context selector behavior (switchable vs locked)
- Permission-gated features

## Context Switching

Web and Admin apps support **dynamic context switching** via the ContextSelector component.

**Context types** (`tenant.context.type`):

1. **user** (shown as "Personal") - User acting as themselves
2. **organization** - User acting on behalf of an organization
3. **space** - User acting within a specific space
4. **public** - logged out

**Context Hierarchy:**
```
User (always present)
└── Organizations (via organizationUsers)
    └── Spaces (space.organizationId)
```

**State Management:**
- Stored in the Zustand tenant slice: `tenant.context` (`type`, `organization`, `space`)
- Carried in the URL as `?org=` / `?space=` search params, synced by `useAuthenticatedRouting`
- Permission checks evaluate nav `access` rules against the current context; an unauthorized
  route falls back to a context that authorizes it (space → its org → user → public)
- The API is not told the context by header; routes name the org/space in their path

**Navigation Behavior:**
- Paths stay context-free (`/settings`); `navigatePreserving(path, 'context')` keeps `org`/`space`
- Permission-gated nav items hide/show based on current context
- Switching context on the same page redirects to `/dashboard`

## White-Label Mode

**Not built.** The pieces that exist: `AppShell`'s `lockedContext` prop renders the
ContextSelector read-only (superadmin uses it), and `useSpaceTheme` sets per-space CSS
variables. There is no subdomain detection, space-by-subdomain lookup, or per-space
branding data; see `tickets/FEAT-007-white-labeling.md`.

## Example

**Acme** is an organization with a space, **Acme Events**.

**Admin Flow:**
- An Acme operator logs into **Admin**
- Switches context to "Acme Events"
- Manages the space's members, settings and content

**Web Flow:**
- A member logs into **Web**
- Switches between the organizations and spaces they belong to
- Participates in Acme Events as a member

**Superadmin Flow:**
- Platform team logs into **Superadmin**
- No context switching (platform-level)
- Views all organizations and users

## Implementation Notes

**Shared Infrastructure:**
- All three apps render the shared `AppShell` (ContextSelector, Sidebar, UserMenu); superadmin locks the selector and hides spoof controls
- Auth guards (`requireAuth`, `requirePublic` from `@template/ui/guards`) and public pages are shared
- Nav configs differ based on app purpose (see [Navigation](FRONTEND/ROUTING_NAVIGATION.md#navigation))

**State & Routing:**
- All apps use the same shared Zustand store (6 slices)
- TanStack Router with guards (`requireAuth`, `requirePublic`)
- Permission checks integrated at route (nav `access`) and component level
- Context switching logic (`useAuthenticatedRouting`) shared by all apps

**Component Organization:**
- `@template/ui` - components, hooks, pages, store and guards shared by all apps
- `@template/sdk` - generated API client
- Apps hold routes, nav config and `main.tsx`; they have no component folders of their own

**For comprehensive frontend details**, see [FRONTEND.md](FRONTEND.md).
