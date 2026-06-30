# Zustand State Management

<!-- toc:start -->

## Contents

- [Architecture](#architecture)
- [1. AuthSlice](#1-authslice)
  - [State](#state)
  - [Actions](#actions)
    - [initialize()](#initialize)
    - [hydrate(data)](#hydratedata)
    - [setUser(user)](#setuseruser)
    - [setSession(session)](#setsessionsession)
    - [setStrategy(strategy)](#setstrategystrategy)
    - [getOrganizationOptions()](#getorganizationoptions)
    - [getUserMenu(fallbackName?)](#getusermenufallbackname)
    - [requireAuth(onSuccess?)](#requireauthonsuccess)
    - [logout()](#logout)
  - [Usage Patterns](#usage-patterns)
- [2. PermissionsSlice](#2-permissionsslice)
  - [State](#state)
  - [Actions](#actions)
    - [hydrate(me)](#hydrateme)
    - [check(model, record, action)](#checkmodel-record-action)
    - [clear()](#clear)
  - [Usage Patterns](#usage-patterns)
- [3. TenantSlice](#3-tenantslice)
  - [State](#state)
  - [Actions](#actions)
    - [setPublic()](#setpublic)
    - [setPersonal(personal?)](#setpersonalpersonal)
    - [selectOrganization(organizationId)](#selectorganizationorganizationid)
    - [selectSpace(spaceId)](#selectspacespaceid)
    - [setOrganization(organization, space?)](#setorganizationorganization-space)
    - [setSpace(organization, space)](#setspaceorganization-space)
    - [setPage(page)](#setpagepage)
  - [Helper Methods](#helper-methods)
    - [getCurrentContext()](#getcurrentcontext)
    - [getNavContext()](#getnavcontext)
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
    - [setTheme(theme)](#setthemetheme)
    - [hydrateSettings(settings)](#hydratesettingssettings)
    - [updateTheme(theme)](#updatethemetheme)
    - [setLoading(loading)](#setloadingloading)
  - [Usage Patterns](#usage-patterns)
- [6. NavigationSlice](#6-navigationslice)
  - [State](#state)
  - [Actions](#actions)
    - [setNavigate(fn)](#setnavigatefn)
    - [setNavConfig(config)](#setnavconfigconfig)
    - [setCurrentPath(path)](#setcurrentpathpath)
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
- [Migration Guide](#migration-guide)
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
// apps/web/app/main.tsx — wire the QueryClient into the store at boot
import { useAppStore } from '@template/ui/store';
useAppStore.getState().setClient(queryClient);

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

**Location:** `packages/ui/src/store/slices/auth.ts`

### State

```typescript
{
  user: AuthUser | null;
  session: AuthSession | null;
  organizationUsers: AuthOrganizationUser[] | null;  // User's org memberships
  organizations: AuthOrganization[] | null;           // Full org objects
  spaceUsers: AuthSpaceUser[] | null;                 // User's space memberships
  spaces: AuthSpace[] | null;                         // Full space objects
  strategy: AuthStrategy;                             // 'login' | 'embed'
  isAuthenticated: boolean;
  isEmbedded: boolean;                                // Embed mode active
  isInitialized: boolean;
}
```

### Actions

#### initialize()

Fetches `/me` endpoint, hydrates auth + permissions:

```typescript
const user = await auth.initialize();

// Internally:
// 1. Calls GET /me
// 2. Hydrates auth state
// 3. Calls permissions.hydrate()
// 4. Sets isInitialized = true
```

**Used in:** `_authenticated.tsx` layouts

#### hydrate(data)

Manually set auth state (used by `initialize()` or after login):

```typescript
auth.hydrate({
  user,
  session,
  organizationUsers,
  organizations,
  spaceUsers,
  spaces,
});

// Side effect: Sets tenant.context to 'personal' or 'public'
```

#### setUser(user)

Update current user:

```typescript
auth.setUser(updatedUser);
```

#### setSession(session)

Update session (rarely used - mainly JWT):

```typescript
auth.setSession(session);
```

#### setStrategy(strategy)

Set auth strategy (login vs embed):

```typescript
auth.setStrategy({ type: 'embed', parentOrigin: 'https://parent.com' });
auth.setStrategy({ type: 'login' });
```

#### getOrganizationOptions()

Transform orgs + spaces into ContextSelector format:

```typescript
const options = auth.getOrganizationOptions();
// Returns: [{ id, name, spaces: [{ id, name }] }]
```

#### getUserMenu(fallbackName?)

Get user data for UserMenu component:

```typescript
const menu = auth.getUserMenu();
// Returns: { name, email, avatarUrl }
```

#### requireAuth(onSuccess?)

Trigger auth flow if not authenticated:

```typescript
auth.requireAuth(() => {
  // Called if already authenticated
});

// If not authenticated:
// - login strategy: Shows login modal (TODO)
// - embed strategy: Posts message to parent
```

#### logout()

Clear auth state and return to public context:

```typescript
await auth.logout();

// Side effect: Calls tenant.setPublic()
```

### Usage Patterns

```typescript
// Access state
const user = useAppStore((state) => state.auth.user);
const isAuth = useAppStore((state) => state.auth.isAuthenticated);

// Call actions
const initialize = useAppStore((state) => state.auth.initialize);
const logout = useAppStore((state) => state.auth.logout);

await initialize();
await logout();
```

---

## 2. PermissionsSlice

**Location:** `packages/ui/src/store/slices/permissions.ts`

### State

```typescript
{
  permissions: Permix & {
    check: (model, record, action) => boolean;
    hydrate: (me) => Promise<void>;
    clear: () => void;
  }
}
```

### Actions

#### hydrate(me)

Set up ReBAC permissions (called by `auth.initialize()`):

```typescript
await permissions.hydrate({
  id: user.id,
  platformRole: user.platformRole,
  organizationUsers: [
    { organizationId: 'org1', role: 'owner', entitlements: {...} }
  ],
  spaceUsers: [
    { spaceId: 'space1', role: 'admin', entitlements: {...} }
  ],
});

// Internally:
// 1. Sets userId in Permix
// 2. Checks if superadmin
// 3. Calls setupOrgContext() for each org
// 4. Calls setupSpaceContext() for each space
```

**Matches backend permission setup** - frontend permissions mirror backend.

#### check(model, record, action)

Check if user can perform action on record:

```typescript
const canEdit = permissions.check('organization', org, 'update');
const canDelete = permissions.check('space', space, 'delete');

if (canEdit) {
  // Show edit button
}
```

**Models:** `'organization'`, `'space'`, `'customer'`, etc.
**Actions:** `'create'`, `'read'`, `'update'`, `'delete'`, `'manage'`, etc.

#### clear()

Reset permissions (called on logout):

```typescript
permissions.clear();
```

### Usage Patterns

```typescript
// Check permissions
const permissions = useAppStore((state) => state.permissions);
const canManage = permissions.check('organization', org, 'manage');

// In components
<Button show={canManage}>Edit Organization</Button>

// usePermission hook (wrapper)
const { can } = usePermission('organization', org);
<Button show={can('update')}>Edit</Button>
```

---

## 3. TenantSlice

**Location:** `packages/ui/src/store/slices/tenant.ts`

### State

```typescript
{
  context: {
    type: 'public' | 'personal' | 'organization' | 'space';
    organization?: Organization;
    space?: Space;
    personal?: any;
  };
  page: {
    organization?: Organization;  // From route params
    space?: Space;
  };
}
```

**Difference:**
- **context**: Global app-level context (shown in ContextSelector dropdown)
- **page**: Route-specific context (from URL params like `/org/:orgId`)

### Actions

#### setPublic()

Switch to public context (only when logged out):

```typescript
tenant.setPublic();
// Sets: { type: 'public' }
```

#### setPersonal(personal?)

Switch to personal context:

```typescript
tenant.setPersonal();
// Sets: { type: 'personal' }
```

#### selectOrganization(organizationId)

Switch to organization by ID (looks up from `auth.organizations`):

```typescript
const success = tenant.selectOrganization('org-123');
// Returns: boolean (false if org not found)
```

#### selectSpace(spaceId)

Switch to space by ID (looks up from `auth.spaces`):

```typescript
const success = tenant.selectSpace('space-456');
// Returns: boolean (false if space not found)
// Also sets parent organization
```

#### setOrganization(organization, space?)

Directly set organization context:

```typescript
tenant.setOrganization(orgObject, spaceObject);
```

#### setSpace(organization, space)

Directly set space context:

```typescript
tenant.setSpace(orgObject, spaceObject);
```

#### setPage(page)

Set page context from route params:

```typescript
tenant.setPage({ organization: org, space: space });
```

### Helper Methods

#### getCurrentContext()

Get formatted context for display:

```typescript
const ctx = tenant.getCurrentContext();
// Returns: { type, label, organizationId?, spaceId? }

// Examples:
// { type: 'personal', label: 'Personal' }
// { type: 'organization', label: 'Acme Inc', organizationId: 'org-123' }
// { type: 'space', label: 'Marketing', spaceId: 'space-456' }
```

#### getNavContext()

Get effective context for navigation (page takes precedence over context):

```typescript
const navCtx = tenant.getNavContext();
// Returns: { organization?, space? }

// Precedence: page.organization > context.organization
```

### Usage Patterns

```typescript
// Read context
const tenant = useAppStore((state) => state.tenant);
const contextType = tenant.context.type;
const currentOrg = tenant.context.organization;

// Switch context
tenant.setPersonal();
tenant.selectOrganization('org-123');
tenant.selectSpace('space-456');

// ContextSelector usage
<ContextSelector
  currentContext={tenant.getCurrentContext()}
  organizations={organizationOptions}
  onSelectPersonal={() => tenant.setPersonal()}
  onSelectOrganization={(id) => tenant.selectOrganization(id)}
  onSelectSpace={(spaceId) => tenant.selectSpace(spaceId)}
/>
```

---

## 4. ClientSlice

**Location:** `packages/ui/src/store/slices/client.ts` (type: `packages/ui/src/store/types/client.ts`)

Holds the TanStack `QueryClient` and the live-query websocket. The store is the
home for the query client so it can be reached outside React (e.g. `auth.initialize()`
fetches `/me` before render).

### State

```typescript
{
  client: QueryClient | null;   // TanStack Query client (set at app boot)
  websocket: ApiWebsocket;      // live-query websocket (channelKey subscriptions)
}
```

### Actions

#### setClient(client)

Wire the app's `QueryClient` into the store (called once in `main.tsx`). Also
subscribes the query cache to live-query channels: when an observer is added for a
registered live query, the websocket subscribes to its `channelKey`; when removed,
it unsubscribes.

```typescript
// apps/web/app/main.tsx
useAppStore.getState().setClient(queryClient);
```

### Live queries

`createClientSlice` derives the `ws(s)://` URL from `VITE_API_URL`, builds the
`ApiWebsocket` (`createApiWebsocket`), and on reconnect refetches any live queries
to recover invalidations missed while disconnected. Live-query registration lives in
`@template/shared/ws` (`LIVE_QUERIES`, `channelKey`); the connect is driven by
`useApiWebsocket` (see [WEBSOCKETS.md](WEBSOCKETS.md)).

### Usage Patterns

```typescript
// Access the query client
const client = useAppStore((state) => state.client);
client?.invalidateQueries({ queryKey: ['organizations'] });

// Or via hook
import { useQueryClient } from '@tanstack/react-query';
const queryClient = useQueryClient();
```

---

## 5. UISlice

**Location:** `packages/ui/src/store/slices/ui.ts`

### State

```typescript
{
  theme: 'light' | 'dark' | 'system';
  isLoading: boolean;
  isInitialized: boolean;
  appName: string;        // From VITE_APP_NAME
  shortName: string;      // From VITE_APP_SHORT_NAME
  description: string;    // From VITE_APP_DESCRIPTION
}
```

### Actions

#### setTheme(theme)

Set theme preference:

```typescript
ui.setTheme('dark');
ui.setTheme('light');
ui.setTheme('system');
```

**Used by:** `ThemeToggle` component in settings

#### hydrateSettings(settings)

Hydrate UI settings (from localStorage):

```typescript
ui.hydrateSettings({ theme: 'dark' });
// Sets isInitialized = true
```

**Used by:** `useThemePersistence` hook in `__root.tsx`

#### updateTheme(theme)

Update theme with API persistence (TODO):

```typescript
await ui.updateTheme('dark');
// Currently just calls setTheme
// TODO: Persist to backend /me/settings
```

#### setLoading(loading)

Set global loading state:

```typescript
ui.setLoading(true);
// ... do work
ui.setLoading(false);
```

### Usage Patterns

```typescript
// Read theme
const theme = useAppStore((state) => state.ui.theme);

// Set theme (in ThemeToggle)
const setTheme = useAppStore((state) => state.ui.setTheme);
<button onClick={() => setTheme('dark')}>Dark Mode</button>

// App metadata
const appName = useAppStore((state) => state.ui.appName);
```

---

## 6. NavigationSlice

**Location:** `packages/ui/src/store/slices/navigation.ts`

### State

```typescript
{
  navigate: ((options: any) => void) | null;
  navConfig: NavConfig | null;
  currentPath: string;
}
```

### Actions

#### setNavigate(fn)

Store TanStack Router navigate function:

```typescript
navigation.setNavigate((options) => navigate(options));
```

#### setNavConfig(config)

Store nav configuration:

```typescript
navigation.setNavConfig(navConfig);
```

#### setCurrentPath(path)

Track current path:

```typescript
navigation.setCurrentPath('/dashboard');
```

**Usage in __root.tsx:**

```typescript
// Store TanStack Router navigate function
const navigate = useNavigate();
const setNavigate = useAppStore((state) => state.navigation.setNavigate);
const setNavConfig = useAppStore((state) => state.navigation.setNavConfig);

useEffect(() => {
  setNavigate((options: any) => navigate(options));
  setNavConfig(navConfig);
}, [navigate, setNavigate, setNavConfig]);
```

**Purpose:** Centralize navigation for programmatic navigation outside React components.

---

## Access Patterns

### Reading State

```typescript
// Single value
const user = useAppStore((state) => state.auth.user);

// Multiple values
const { user, isAuthenticated } = useAppStore((state) => ({
  user: state.auth.user,
  isAuthenticated: state.auth.isAuthenticated,
}));

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
const canEdit = state.permissions.check('organization', org, 'update');

// Call actions
await useAppStore.getState().auth.initialize();
```

---

## Slice Dependencies

```
AuthSlice ──┬──> TenantSlice (sets context on login/logout)
            └──> PermissionsSlice (hydrates permissions)

TenantSlice ───> AuthSlice (reads organizations/spaces)

PermissionsSlice (standalone)

ClientSlice (standalone)

NavigationSlice (standalone)

UISlice (standalone)
```

**Cross-slice access** is safe via `get()` in slice creators:

```typescript
export const createAuthSlice: StateCreator<AuthSlice & TenantSlice> = (set, get) => ({
  auth: {
    logout: () => {
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

### 4. Type Safety

**DO:** Export and use slice types:
```typescript
import type { AuthSlice } from '@template/ui';
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

## Migration Guide

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

apps/{web,admin,superadmin}/app/
└── main.tsx            # Calls useAppStore.getState().setClient(queryClient)
```
