# Frontend Architecture

<!-- toc:start -->

## Contents

- [Where to Read](#where-to-read)
- [Stack](#stack)
- [State Management](#state-management)
- [App Differences](#app-differences)
- [Conventions](#conventions)

<!-- toc:end -->

React apps on TanStack Router, one shared Zustand store, and ReBAC checks on the client. This page is the index; each topic has its own doc.

## Where to Read

| Topic | Doc |
|-------|-----|
| File routes, layouts, guards, nav config, page access, navigating | [FRONTEND/ROUTING_NAVIGATION.md](FRONTEND/ROUTING_NAVIGATION.md) |
| Generated SDK, `apiQuery` / `apiMutation`, optimistic mutations, data hooks | [FRONTEND/API_CLIENT.md](FRONTEND/API_CLIENT.md) |
| UI primitives, settings, modals, pages | [FRONTEND/COMPONENTS.md](FRONTEND/COMPONENTS.md) |
| AppShell, ContextSelector, Sidebar, overlays, theme | [FRONTEND/THEME_LAYOUT.md](FRONTEND/THEME_LAYOUT.md) |
| Sign-in, OAuth callback, auth slice | [FRONTEND/AUTH.md](FRONTEND/AUTH.md) |
| Permission checks in components and nav | [PERMISSIONS.md](PERMISSIONS.md#frontend-checks) |
| Store slices | [ZUSTAND.md](ZUSTAND.md) |
| Guided flows | [FLOWS.md](FLOWS.md) |
| Live channels and data streams | [WEBSOCKETS.md](WEBSOCKETS.md) |
| The three apps and tenant contexts | [APPS.md](APPS.md) |

## Stack

```
┌─────────────────────────────────────────────┐
│ Apps: web, admin, superadmin                │
│ ├─ TanStack Router (file routes)            │
│ ├─ Nav config (app/config/nav)              │
│ └─ Thin routes mounting @template/ui pages  │
├─────────────────────────────────────────────┤
│ Shared Packages                             │
│ ├─ @template/sdk (generated client, types)  │
│ └─ @template/ui (components, hooks, store,  │
│    pages, guards)                           │
└─────────────────────────────────────────────┘
```

**All three apps share:**
- TanStack Router (file-based routing)
- One Zustand store, `useAppStore` from `@template/ui/store`
- BetterAuth client with bearer tokens
- ReBAC permission checks (Permix) in the permissions slice
- `@template/ui` components and pages

## State Management

**One shared store, composed once and reused by all apps.** Web, admin, and superadmin all import the same `useAppStore` from `@template/ui/store` — there is no per-app store. The store composes **6 slices**. Superadmin differs not by dropping a slice but by being user-context-first: it never forces tenant behavior.

- **auth** - User, organizations, spaces, spoof, sign-in / sign-up / logout
- **tenant** - Current context (`public` / `user` / `organization` / `space`) and page records
- **permissions** - Permix instance and `check(model, record, action)`
- **navigation** - Router `navigate`, nav config, current route match, `navigatePreserving`, active flow
- **ui** - Theme, loading, app identity (name, logo, description)
- **client** - TanStack Query client and the API websocket

```typescript
import { useAppStore } from '@template/ui/store';

const user = useAppStore((state) => state.auth.user);
const context = useAppStore((state) => state.tenant.context);
const logout = useAppStore((state) => state.auth.logout);
```

Full slice reference: [ZUSTAND.md](ZUSTAND.md).

## App Differences

| Feature | Web | Admin | Superadmin |
|---------|-----|-------|------------|
| **ContextSelector** | ✅ Yes | ✅ Yes | Locked |
| **Multi-tenant** | ✅ Yes | ✅ Yes | ❌ No (user + public contexts only) |
| **Spoof controls** | ✅ Yes | ✅ Yes | ❌ No |
| **Navigation** | Consumer actions | Operator actions | Platform management |
| **Nav Config** | `apps/web/app/config/nav/` | `apps/admin/app/config/nav/` | `apps/superadmin/app/config/nav/` |
| **Store** | shared `useAppStore` | shared `useAppStore` | shared `useAppStore` (user-context first) |

**Web (Consumer):** dashboard, organizations, spaces, users, segments, inquiries, settings.

**Admin (Operator):** the same set without segments, for operators of organizations and spaces.

**Superadmin (Platform):** dashboard, all organizations and users, platform inquiries, settings.

More on the apps: [APPS.md](APPS.md).

## Conventions

- Compose state as store slices; never add a per-app store ([ZUSTAND.md](ZUSTAND.md)).
- Web and admin are tenant-context aware; superadmin is user-context first and never forces a tenant.
- Gate pages through the nav config's `access` and actions through `permissions.check`; don't hand-roll role checks. Platform `superadmin` bypasses checks in the permissions slice.
- Protect layouts with `requireAuth` / `requirePublic` from `@template/ui/guards`.
- Put shared UI and pages in `@template/ui`; app routes stay thin.
