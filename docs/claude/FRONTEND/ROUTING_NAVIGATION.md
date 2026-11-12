# Frontend Routing and Navigation

<!-- toc:start -->

## Contents

- [Routing](#routing)
  - [File-Based Routes](#file-based-routes)
  - [Routes With Children](#routes-with-children)
  - [Segments navigation](#segments-navigation)
  - [Guards](#guards)
- [Navigation](#navigation)
  - [Nav Config](#nav-config)
  - [What the Nav Config Drives](#what-the-nav-config-drives)
  - [Navigating](#navigating)
  - [Key Files](#key-files)

<!-- toc:end -->

TanStack Router file routes per app; one nav config per app drives the sidebar, page access, page titles and breadcrumbs. See [FRONTEND.md](../FRONTEND.md) for the index.

## Routing

### File-Based Routes

```
apps/web/app/routes/
├── __root.tsx              # Registers nav config, page meta, theme, websocket, FlowBanner
├── _public.tsx             # Public layout (no auth)
├── _public/
│   ├── index.tsx
│   ├── login.tsx
│   ├── signup.tsx
│   └── auth.callback.tsx   # OAuth callback
├── _authenticated.tsx      # requireAuth + AppShell + nav-based access check
├── _authenticated/
│   ├── dashboard.tsx
│   ├── settings.tsx        # Redirects /settings → /settings/profile
│   ├── settings/           # profile, tokens, webhooks, integrations, authProviders, update, transfer
│   └── …
├── _fullscreen.tsx         # requireAuth + FullscreenLayout (no AppShell)
└── _fullscreen/
    └── example.tsx
```

Admin and superadmin follow the same layout set.

**Layout Types:**

- **`_public`** - Public pages, no authentication
- **`_authenticated`** - Protected pages with AppShell (sidebar + header)
- **`_fullscreen`** - Protected pages without AppShell (back button only)

**Fullscreen Layout Use Cases:**
- Invoice/receipt views
- Document previews
- Print layouts
- Embedded views
- Focused workflows (onboarding, surveys)

`FullscreenLayout`'s back button calls `navigatePreserving('..', 'context')`, so org/space/spoof survive the trip back.

Tenant context is not in the path. It rides in search params (`?org=`, `?space=`, `?spoof=`, `?flow=`); `useAuthenticatedRouting` syncs them into the store and back.

### Routes With Children

A route file with a `component` becomes the **parent layout** of any nested routes (`bots.tsx` is the parent of `bots.$id.tsx`). TanStack mounts the parent and slots children into its `<Outlet/>` — so a list page sitting at `bots.tsx` swallows its own detail route (`/bots/:id` renders the list, never the detail) unless it renders an `<Outlet/>`.

Rule:

- **Leaf route** (no children) → flat file: `bots.tsx`.
- **Route with children** → the page at that path moves to an **index**, and the segment becomes a pure grouping with no component-bearing parent:
  ```
  bots/
    index.tsx   # list   → /bots
    $id.tsx     # detail → /bots/$id
  ```
  Equivalent flat form: `bots.index.tsx` + `bots.$id.tsx` (no `bots.tsx`).

Never leave a `bots.tsx` with a `component` sitting above children. A component-less parent is only for shared layout or redirects (e.g. `settings.tsx` and `segments.tsx` redirect to a default child) and renders children via TanStack's default `<Outlet/>`.

### Segments navigation

Segments uses the existing nested sidebar pattern: **Owned** (`/segments/owned`) and
**Memberships** (`/segments/memberships`) under `/segments`, in user, organization and space
contexts. The parent redirects to Owned through `redirectPreservingContext`; it has no page
component that could swallow the children. Both routes render `SegmentsPage` with an explicit
`view`, and only that view's query is enabled. See [SEGMENTS.md](../SEGMENTS.md#web-navigation).

### Guards

**Location:** `packages/ui/src/guards/`

`createAuthGuards(getStore)` (`authGuard.ts`) returns two `beforeLoad` guards. Both run `auth.initialize()` first.

- `requireAuth` — unauthenticated → redirect to `/login` with `redirectTo` (path + search + hash) and the `org` / `space` / `spoof` params carried over.
- `requirePublic` — authenticated → redirect to `redirectTo` or `/dashboard`.

`appGuards.ts` binds them to the shared store; apps import them directly:

```typescript
import { requireAuth } from '@template/ui/guards';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: AuthenticatedLayout,
});
```

Redirects inside `beforeLoad` use `redirectPreservingContext(ctx, to)` (`@template/ui/lib`), which keeps `org` / `space` / `spoof`.

---

## Navigation

### Nav Config

**Location:** `apps/*/app/config/nav/`

```
apps/web/app/config/nav/
├── index.ts          # navConfig: NavConfig
├── contexts/         # One NavItem[] per context
│   ├── userContext.ts
│   ├── organizationContext.ts
│   ├── spaceContext.ts
│   └── publicContext.ts
└── features/         # One NavItem per feature, shared across contexts
    ├── communications.ts
    ├── dashboard.ts
    ├── home.ts
    ├── organizations.ts
    ├── segments.ts
    ├── settings.ts
    ├── spaces.ts
    └── users.ts
```

**Types** (`packages/ui/src/components/layout/navigationTypes.ts`):

```typescript
type NavConfig = {
  user: NavItem[];
  organization: NavItem[];
  space: NavItem[];
  public?: NavItem[];
};

type NavItem = {
  label: string;
  path?: string;                 // Relative to the parent item
  icon?: string;                 // Iconify slug, e.g. 'lucide:settings'
  title?: string | ((context, pageContext?) => string);
  description?: string | ((context, pageContext?) => string);
  access?: (permissions, context, pageContext?) => boolean;
  alias?: boolean;               // Routable, hidden from the sidebar
  breadcrumbLabel?: (record) => string;
  items?: NavItem[];
};
```

**Feature file:**

```typescript
export const organizationsItem: NavItem = {
  label: 'Organizations',
  path: '/organizations',
  icon: 'lucide:building-2',
  access: (permissions, context) => permissions.check(...getContextParams(context), 'read'),
  items: [
    { label: 'My Organizations', path: '/mine' },
    { label: 'Invitations', path: '/invitations' },
  ],
};
```

**Context file** lists the features shown in that context:

```typescript
export const organizationContext: NavItem[] = [
  dashboardItem,
  spacesItem,
  usersItem,
  segmentsItem,
  communicationsItem,
  settingsItem,
];
```

`getContextParams(context)` returns `[model, record]` for the current context (`organization`, `space`, or `user`), so `access` checks read `permissions.check(...getContextParams(context), action)`.

**Adding an item:** create or edit the feature file, then add it to each context file where it should appear.

### What the Nav Config Drives

`__root.tsx` registers the config once: `useRegisterNavigation(navConfig)` stores it (and the router's `navigate`) in the navigation slice.

- **Sidebar** renders `navConfig[context.type]`, skipping items whose `access` fails and `alias` items.
- **Page access.** `useAuthenticatedRouting` (in `_authenticated.tsx` and `_fullscreen.tsx`) matches the path with `findRoute` and runs the item's `access`. `checkContextPermission` tries the current context, then the space's organization, then `user`, then `public`, and switches to the first context that allows the page. If none does, the layout renders `Unauthorized`. The nav config is the source of truth for "can view".
- **Page meta.** `usePageMeta` sets the document title from the matched item's `title`, else the breadcrumb chain.
- **Breadcrumbs.** `useBreadcrumbs` builds them from the match chain, using `breadcrumbLabel` for record pages.
- Switching context while staying on the same page navigates to `/dashboard`.

**Per-app nav:**

| App | Contexts |
|-----|----------|
| Web | user, organization, space, public |
| Admin | user, organization, space, public |
| Superadmin | user, public (`organization` and `space` are empty) |

### Navigating

The navigation slice exposes one navigation call with a preservation policy:

```typescript
const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);

navigatePreserving('/settings', 'context'); // keep org + space (+ spoof, flow)
navigatePreserving('/users', 'spoof');      // keep spoof (+ flow) only
navigatePreserving('/login?x=1', 'all');    // keep every current search param
```

Search params in `to` merge over the preserved ones; the current hash is kept unless `to` has one. `navigateToLogin(getStore)` / `navigateToSignup(getStore)` (`@template/ui/lib/routeRedirect`) carry `redirectTo`.

Switch context through the tenant slice: `tenant.setOrganization(id)`, `tenant.setSpace(id)`, `tenant.setUser()`, `tenant.setPublic()`. See [ZUSTAND.md](../ZUSTAND.md).

### Key Files

- `apps/{app}/app/config/nav/` — nav config
- `apps/{app}/app/routes/{__root,_authenticated,_fullscreen,_public}.tsx` — layouts
- `packages/ui/src/guards/` — `requireAuth`, `requirePublic`
- `packages/ui/src/hooks/useAuthenticatedRouting.ts` (+ `useAuthenticatedRouting/`) — URL ↔ store sync, access check
- `packages/ui/src/lib/findRoute.ts`, `checkContextPermission.ts`, `getContextParams.ts`, `routeRedirect.ts`
- `packages/ui/src/hooks/{useRegisterNavigation,usePageMeta,useBreadcrumbs}.ts`
- `packages/ui/src/store/slices/navigation.ts`
