# Zustand State Management

<!-- toc:start -->

## Contents

- [Architecture](#architecture)
- [1. AuthSlice](#1-authslice)
  - [State](#state)
  - [Actions](#actions)
    - [initialize()](#initialize)
    - [refreshMe()](#refreshme)
    - [signIn(method) / signUp(method)](#signinmethod--signupmethod)
    - [setStrategy(strategy)](#setstrategystrategy)
    - [setSpoof(email)](#setspoofemail)
    - [logout()](#logout)
  - [Usage Patterns](#usage-patterns)
- [2. PermissionsSlice](#2-permissionsslice)
  - [State](#state)
  - [Actions](#actions)
    - [setup(me)](#setupme)
    - [check(model, record, action)](#checkmodel-record-action)
    - [clear()](#clear)
  - [Usage Patterns](#usage-patterns)
- [3. TenantSlice](#3-tenantslice)
  - [State](#state)
  - [Actions](#actions)
  - [Usage Patterns](#usage-patterns)
- [4. ClientSlice](#4-clientslice)
  - [State](#state)
  - [Actions](#actions)
    - [setClient(client)](#setclientclient)
  - [Live queries](#live-queries)
  - [Usage Patterns](#usage-patterns)
- [5. UISlice](#5-uislice)
  - [State](#state)
  - [Actions](#actions)
- [6. NavigationSlice](#6-navigationslice)
  - [State](#state)
  - [Actions](#actions)
- [Access Patterns](#access-patterns)
  - [Reading State](#reading-state)
  - [Calling Actions](#calling-actions)
  - [Selecting Data](#selecting-data)
  - [Outside React Components](#outside-react-components)
- [Slice Dependencies](#slice-dependencies)
- [DevTools](#devtools)
- [Best Practices](#best-practices)
  - [1. Slice Composition](#1-slice-composition)
  - [2. Selectors](#2-selectors)
  - [3. Actions](#3-actions)
  - [4. Type Safety](#4-type-safety)
  - [5. Side Effects](#5-side-effects)
- [Adding or Removing a Slice](#adding-or-removing-a-slice)
  - [Adding a New Slice](#adding-a-new-slice)
  - [Removing a Slice](#removing-a-slice)
- [File Reference](#file-reference)

<!-- toc:end -->

Composable state slices with Zustand for consistent state management across all frontend apps.

## Architecture

**One shared store, composed once and reused by all apps.** The store is built in
`packages/ui/src/store/index.ts` and consumed via `@template/ui/store`. Web,
admin, and superadmin all import the same `useAppStore` — there is no per-app
store composition.

The store composes **6 slices**: Client, Auth, Navigation, Permissions, Tenant,
UI.

```typescript
// packages/ui/src/store/index.ts
import { createAuthSlice } from '@template/ui/store/slices/auth';
import { createClientSlice } from '@template/ui/store/slices/client';
import { createNavigationSlice } from '@template/ui/store/slices/navigation';
import { createPermissionsSlice } from '@template/ui/store/slices/permissions';
import { createTenantSlice } from '@template/ui/store/slices/tenant';
import { createUISlice } from '@template/ui/store/slices/ui';
import type { AppStore } from '@template/ui/store/types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useAppStore = create<AppStore>()(
  devtools((...a) => ({
    ...createClientSlice(...a),
    ...createAuthSlice(...a),
    ...createNavigationSlice(...a),
    ...createPermissionsSlice(...a),
    ...createTenantSlice(...a),
    ...createUISlice(...a),
  }), { name: 'SharedAppStore' }),
);
```

`AppStore` is the intersection of all slice types
(`packages/ui/src/store/types/index.ts`):

```typescript
export type AppStore = ClientSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;
```

Apps consume it directly:

```typescript
// apps/web/app/main.tsx — createAppQueryClient wires the QueryClient into the store
import { createAppQueryClient } from '@template/ui/lib/createAppQueryClient';
const queryClient = createAppQueryClient();

// any app component
const theme = useAppStore((state) => state.ui.theme);
```

**Why Zustand?**
- Simple, minimal API
- No boilerplate (vs Redux)
- TypeScript-first
- DevTools support
- Slice composition pattern

**Shared slice creators** in `packages/ui/src/store/slices/*` (`@template/ui/store/slices/*`) ensure:
- Consistent state shape across apps
- Reusable logic
- Single source of truth

---

## 1. AuthSlice

**Location:** `packages/ui/src/store/slices/auth.ts` (type: `packages/ui/src/store/types/auth.ts`)

### State

```typescript
{
  client: BetterAuthClient;                         // createAuthClient({ baseURL: VITE_API_URL })
  user: User | null;                                // /me minus memberships
  organizations: Record<string, Organization> | null; // keyed by id
  spaces: Record<string, Space> | null;             // keyed by id
  spaceUsers: Record<string, SpaceUser> | null;     // keyed by spaceId
  strategy: AuthStrategy;                           // { type: 'login' } | { type: 'embed'; parentOrigin? }
  spoofUserEmail: string | null;                    // who we are spoofing (sent as a header)
  spoofingUserEmail: string | null;                 // the real superadmin, from x-spoofing-user-email
  isAuthenticated: boolean;
  isEmbedded: boolean;
  isInitialized: boolean;
}
```

Memberships are dictionaries, not arrays. `/me` is fetched and hydrated by
`fetchAndHydrateMe` (`packages/ui/src/lib/auth/fetchAndHydrateMe.ts`), which also calls
`permissions.setup(me)`.

### Actions

#### initialize()

Runs once (no-op when `isInitialized`). If a bearer token is stored, fetches `/me`,
hydrates auth + permissions and authenticates the websocket. On failure it logs out and
rethrows. Always sets `isInitialized`. Called by the `requireAuth` / `requirePublic`
route guards.

#### refreshMe()

Re-fetches `/me` and re-hydrates (after a membership or profile change).

#### signIn(method) / signUp(method)

Unified auth entry points (`AuthMethod`: email, oauth, saml; see
[AUTH.md](AUTH.md)). Email sign-in hydrates `/me` immediately; OAuth hydrates on the
callback route. `signUp` returns a `SignUpResult` and hydrates only when it is
`'authenticated'`.

#### setStrategy(strategy)

```typescript
auth.setStrategy({ type: 'embed', parentOrigin: 'https://parent.com' });
auth.setStrategy({ type: 'login' });
```

Sets `isEmbedded` from the strategy type.

#### setSpoof(email)

Sets `spoofUserEmail` (or `null` to exit), re-hydrates `/me` as the spoofed user and
re-identifies the websocket.

#### logout()

Revokes the server session, then (always) clears the token, auth state and permissions,
calls `tenant.setPublic()` and navigates to `/login`. Throws if the server revoke failed.

### Usage Patterns

```typescript
const user = useAppStore((state) => state.auth.user);
const isAuth = useAppStore((state) => state.auth.isAuthenticated);
const logout = useAppStore((state) => state.auth.logout);
await logout();
```

---

## 2. PermissionsSlice

**Location:** `packages/ui/src/store/slices/permissions.ts`

### State

```typescript
{
  permissions: {
    permix: Permix;
    check: (model: AccessorName, record: HydratedRecord, action: ActionRule) => boolean;
    setup: (me: UserWithRelations) => Promise<void>;
    clear: () => void;
  }
}
```

### Actions

#### setup(me)

Called by `fetchAndHydrateMe`. Sets the Permix user id; a superadmin gets
`setSuperadmin(true)` and stops there. Otherwise it applies `getUserPermissions`, then
`getOrgPermissions` per `organizationUsers` row and `getSpacePermissions` per
`spaceUsers` row (role + entitlements), mirroring the backend setup.

#### check(model, record, action)

ReBAC check (`rebac/check` over `rebacSchema`) against the hydrated record:

```typescript
const canManage = permissions.check('organization', org, 'manage');
```

#### clear()

Replaces `permix` with a fresh instance (called on logout).

### Usage Patterns

```typescript
const permissions = useAppStore((state) => state.permissions);
<Button show={permissions.check('organization', org, 'manage')}>Edit</Button>

// usePermission returns { show, disable, disabledText }; Button takes show / disabled / disabledText
const editBtn = usePermission({ permissions, model: 'organization', record: org, action: 'manage' });
<Button show={editBtn.show} disabled={editBtn.disable}>Edit</Button>
```

---

## 3. TenantSlice

**Location:** `packages/ui/src/store/slices/tenant.ts`

### State

```typescript
{
  context: {
    type: 'public' | 'user' | 'organization' | 'space';
    organization?: Organization;
    space?: Space;
  };
  page: {
    organization?: Organization;
    space?: Space;
  };
}
```

- **context**: the app-level context shown in the ContextSelector.
- **page**: the record a page is about, passed to nav `access` checks.

### Actions

| Action | Effect |
|---|---|
| `setPublic()` | `{ type: 'public' }` |
| `setUser()` | `{ type: 'user' }` (personal) |
| `setOrganization(organizationId)` | Looks up `auth.organizations`; returns `false` if missing |
| `setSpace(spaceId)` | Looks up `auth.spaces` and its organization; returns `false` if either is missing |
| `setPage(page)` / `clearPage()` | Set or reset `page` |

`useAuthenticatedRouting` keeps context and the `?org=` / `?space=` URL params in sync
and falls back to a context the nav config authorizes.

### Usage Patterns

```typescript
const tenant = useAppStore((state) => state.tenant);
tenant.setUser();
tenant.setOrganization('org-123');
tenant.setSpace('space-456');
```

`ContextSelector` reads `tenant` and `auth` from the store itself; it takes only
`locked`, `onManageOrganizations` and `className`.

---

## 4. ClientSlice

**Location:** `packages/ui/src/store/slices/client.ts` (type: `packages/ui/src/store/types/client.ts`)

Holds the TanStack `QueryClient` and the API websocket. The store is the home for the
query client so it can be reached outside React.

### State

```typescript
{
  client: QueryClient | null;   // set at app boot
  websocket: ApiWebsocket;      // live-query channels and data streams
  setClient: (client: QueryClient) => void;
}
```

### Actions

#### setClient(client)

Called by `createAppQueryClient()` (`packages/ui/src/lib/createAppQueryClient.ts`), which
each app's `main.tsx` uses. It subscribes the query cache: an observer added to a data-stream
query opens the stream, one added to a registered live query subscribes its `channelKey`;
removing the observer closes or unsubscribes.

### Live queries

`createClientSlice` derives the `ws(s)://` URL from `VITE_API_URL`, builds the
`ApiWebsocket` (`createApiWebsocket`), and on reconnect invalidates live queries to recover
invalidations missed while disconnected. Live-query registration lives in
`@template/shared/ws` (`LIVE_QUERIES`, `channelKey`); the connect is driven by
`useApiWebsocket` (see [WEBSOCKETS.md](WEBSOCKETS.md)).

### Usage Patterns

```typescript
const client = useAppStore((state) => state.client);
client?.invalidateQueries({ queryKey: ['organizations'] });
```

---

## 5. UISlice

**Location:** `packages/ui/src/store/slices/ui.ts`

### State

```typescript
{
  theme: 'light' | 'dark' | 'system';  // default 'system'
  isLoading: boolean;
  projectName: string;   // VITE_PROJECT_NAME
  appName: string;       // VITE_APP_NAME
  shortName: string;     // VITE_APP_SHORT_NAME
  logo: string;          // VITE_APP_LOGO_URL (optional)
  description: string;   // VITE_APP_DESCRIPTION
}
```

### Actions

| Action | Effect |
|---|---|
| `setTheme(theme)` | Sets the preference (used by `ThemeToggle`) |
| `setLoading(loading)` | Global loading flag |
| `updateTheme(theme)` | Sets the theme; server persistence is not built |

`useThemePersistence` (in each `__root.tsx`) loads `theme` from `localStorage` on mount and
writes it back on change.

---

## 6. NavigationSlice

**Location:** `packages/ui/src/store/slices/navigation.ts`

### State

```typescript
{
  navigate: ((options: { to: string; search?: Record<string, string>; hash?: string }) => void) | null;
  navConfig: NavConfig | null;
  currentRouteMatch: RouteMatch | null;
  flowId: string | null;
}
```

### Actions

| Action | Effect |
|---|---|
| `setNavigate(fn)` | Stores the TanStack Router `navigate` |
| `setNavConfig(config)` | Stores the app's nav config |
| `setCurrentRouteMatch(match)` | Set by `useAuthenticatedRouting` |
| `navigatePreserving(to, policy)` | Navigate, carrying search params by policy |
| `setFlowId(id)` | The active flow, carried as `?flow=` (see [FLOWS.md](FLOWS.md)) |

`navigatePreserving` policies:
- `'context'`: keep `org` / `space`, plus `spoof` and `flow`;
- `'spoof'`: keep only `spoof` and `flow`;
- `'all'`: keep every current search param.

The target's own query wins on conflicts; the current hash is kept unless the target sets one.

`useRegisterNavigation(navConfig)` in each app's `__root.tsx` wires `setNavigate` and
`setNavConfig`, so code outside components can navigate.

---

## Access Patterns

### Reading State

```typescript
// Single value
const user = useAppStore((state) => state.auth.user);

// Multiple values — an object selector needs useShallow (zustand v5), or it re-renders forever
import { useShallow } from 'zustand/react/shallow';
const { user, isAuthenticated } = useAppStore(
  useShallow((state) => ({ user: state.auth.user, isAuthenticated: state.auth.isAuthenticated })),
);

// Entire slice
const auth = useAppStore((state) => state.auth);
```

### Calling Actions

```typescript
// Get action
const logout = useAppStore((state) => state.auth.logout);
await logout();

// Direct call
useAppStore.getState().auth.logout();

// In event handler
<button onClick={() => useAppStore.getState().auth.logout()}>
  Logout
</button>
```

### Selecting Data

**Prefer selectors** for derived state to avoid unnecessary re-renders:

```typescript
// ❌ Bad - rerenders on any auth change
const auth = useAppStore((state) => state.auth);
const userName = auth.user?.name;

// ✅ Good - only rerenders when user.name changes
const userName = useAppStore((state) => state.auth.user?.name);
```

### Outside React Components

```typescript
// Access store outside React
import { useAppStore } from '@template/ui/store';

const state = useAppStore.getState();
const user = state.auth.user;
const canEdit = state.permissions.check('organization', org, 'manage');

// Call actions
await useAppStore.getState().auth.initialize();
```

---

## Slice Dependencies

```
AuthSlice ──┬──> PermissionsSlice (setup on /me, clear on logout)
            ├──> TenantSlice (setPublic on logout)
            ├──> ClientSlice (websocket identity)
            └──> NavigationSlice (navigate to /login on logout)

TenantSlice ───> AuthSlice (reads organizations/spaces)

NavigationSlice ───> AuthSlice (reads spoofUserEmail)

PermissionsSlice, ClientSlice, UISlice (standalone)
```

**Cross-slice access** is safe via `get()` in slice creators:

```typescript
export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
  auth: {
    logout: async () => {
      set(/* clear auth */);
      get().tenant.setPublic(); // Access other slice
    },
  },
});
```

---

## DevTools

**Enabled once in the shared store (all apps share it):**

```typescript
devtools((...a) => ({ ...slices }), { name: 'SharedAppStore' })
```

**Access:** Redux DevTools extension in browser

**Features:**
- Inspect state
- Time-travel debugging
- Action tracking
- State diff visualization

---

## Best Practices

### 1. Slice Composition

**DO:** Compose slices in the shared store type:
```typescript
export type AppStore = ClientSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;
```

**DON'T:** Create app-specific slices or per-app stores — the store is composed once in `@template/ui/store` and shared by all apps

### 2. Selectors

**DO:** Use narrow selectors:
```typescript
const userName = useAppStore((state) => state.auth.user?.name);
```

**DON'T:** Select entire slices unless needed:
```typescript
const auth = useAppStore((state) => state.auth); // Rerenders on any auth change
```

### 3. Actions

**DO:** Keep actions in slices:
```typescript
setTheme: (theme) => set((state) => ({ ui: { ...state.ui, theme } }))
```

**DON'T:** Mutate state outside slices:
```typescript
// ❌ Never do this
useAppStore.getState().auth.user = newUser;
```

**DON'T:** Add a second action that writes what an existing setter already writes. Loading saved
or fetched values calls the setter (`setTheme(saved.theme)`); there is no `hydrateTheme` /
`hydrateSettings` beside it. One writer per field keeps side effects (persistence, derived state)
in one place. — fb: 2026-02-09

### 4. Type Safety

**DO:** Export and use slice types:
```typescript
import type { AuthSlice } from '@template/ui/store/types';
```

**DON'T:** Use `any`:
```typescript
const auth: any = useAppStore((state) => state.auth); // ❌
```

### 5. Side Effects

**DO:** Handle side effects in actions:
```typescript
logout: () => {
  set(/* clear state */);
  get().tenant.setPublic(); // Side effect in action
}
```

**DON'T:** Handle side effects in components:
```typescript
// ❌ Component handles side effect
const logout = () => {
  auth.logout();
  tenant.setPublic(); // Should be in logout action
};
```

---

## Adding or Removing a Slice

### Adding a New Slice

1. **Create the slice type:**
   ```typescript
   // packages/ui/src/store/types/mySlice.ts
   export type MySlice = {
     mySlice: {
       data: string;
       setData: (data: string) => void;
     };
   };
   ```

2. **Create the slice creator:**
   ```typescript
   // packages/ui/src/store/slices/mySlice.ts
   import type { AppStore } from '@template/ui/store/types';
   import type { MySlice } from '@template/ui/store/types/mySlice';
   import type { StateCreator } from 'zustand';

   export const createMySlice: StateCreator<AppStore, [], [], MySlice> = (set) => ({
     mySlice: {
       data: '',
       setData: (data) => set((state) => ({ mySlice: { ...state.mySlice, data } })),
     },
   });
   ```

3. **Add to the shared store + AppStore type:**
   ```typescript
   // packages/ui/src/store/types/index.ts — add MySlice to the intersection
   export type AppStore = ClientSlice & ... & MySlice;

   // packages/ui/src/store/index.ts — spread the creator
   ...createMySlice(...a),
   ```

   All apps pick it up automatically through `@template/ui/store`.

### Removing a Slice

1. Remove the creator spread from `packages/ui/src/store/index.ts`
2. Remove from the `AppStore` intersection in `packages/ui/src/store/types/index.ts`
3. Delete the slice + type files
4. Search codebase for usage and remove

---

## File Reference

```
packages/ui/src/store/
├── slices/
│   ├── client.ts       # ClientSlice (QueryClient + websocket)
│   ├── auth.ts         # AuthSlice
│   ├── navigation.ts   # NavigationSlice
│   ├── permissions.ts  # PermissionsSlice
│   ├── tenant.ts       # TenantSlice
│   └── ui.ts           # UISlice
├── types/
│   ├── client.ts, auth.ts, navigation.ts, permissions.ts, tenant.ts, ui.ts
│   └── index.ts        # AppStore intersection + re-exports
└── index.ts            # Composes useAppStore (shared by all apps)

packages/ui/src/lib/createAppQueryClient.ts  # Builds the QueryClient and calls setClient

apps/{web,admin,superadmin}/app/
└── main.tsx            # const queryClient = createAppQueryClient()
```
