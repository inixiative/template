# Zustand State Management

Composable state slices with Zustand for consistent state management across all frontend apps.

## Architecture

**Apps compose Zustand slices:**

- **Web/Admin:** 6 slices (Auth, Permissions, Tenant, API, UI, Navigation)
- **Superadmin:** 5 slices (Auth, Permissions, API, UI, Navigation - no Tenant)

```typescript
// apps/web/app/store/index.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createApiSlice,         // QueryClient + API config
  createAuthSlice,        // User + session + orgs + spaces
  createNavigationSlice,  // Router navigation + nav config
  createPermissionsSlice, // ReBAC (Permix)
  createTenantSlice,      // Context switching
  createUISlice,          // Theme + UI state
} from '@template/shared';

export type AppStore = ApiSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools((...a) => ({
    ...createApiSlice(...a),
    ...createAuthSlice(...a),
    ...createNavigationSlice(...a),
    ...createPermissionsSlice(...a),
    ...createTenantSlice(...a),
    ...createUISlice(...a),
  }), { name: 'AppStore' }),
);
```

**Why Zustand?**
- Simple, minimal API
- No boilerplate (vs Redux)
- TypeScript-first
- DevTools support
- Slice composition pattern

**Shared slice creators** in `@template/shared/store/slices/*` ensure:
- Consistent state shape across apps
- Reusable logic
- Single source of truth

---

## 1. AuthSlice

**Location:** `/packages/shared/src/store/slices/auth.ts`

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

**Location:** `/packages/shared/src/store/slices/permissions.ts`

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

**Location:** `/packages/shared/src/store/slices/tenant.ts`

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

## 4. ApiSlice

**Location:** `/packages/shared/src/store/slices/api.ts`

### State

```typescript
{
  baseUrl: string;                // API base URL
  client: typeof client;          // OpenAPI client
  queryClient: QueryClient;       // TanStack Query client
  spoofUserEmail: string | null;  // For dev/testing
}
```

### Actions

#### setBaseUrl(url)

Change API base URL:

```typescript
api.setBaseUrl('https://api.example.com');
```

#### setAuthToken(token)

Set JWT bearer token:

```typescript
api.setAuthToken(jwtToken);
// Sets header: Authorization: Bearer {token}
```

#### setSpoofUserEmail(email)

Enable user spoofing (dev/testing):

```typescript
api.setSpoofUserEmail('admin@example.com');
// Sets header: spoof-user-email: admin@example.com
```

### QueryClient Usage

```typescript
// Access QueryClient
const queryClient = useAppStore((state) => state.api.queryClient);

// Or use hook
import { useQueryClient } from '@template/shared';
const queryClient = useQueryClient();

// Invalidate queries
queryClient.invalidateQueries({ queryKey: ['organizations'] });

// Fetch outside React
const result = await queryClient.fetchQuery(meReadOptions());
```

**Why in store?**
- Allows calling `queryClient.fetchQuery()` outside React components
- Used by `auth.initialize()` to fetch `/me` before render

### Usage Patterns

```typescript
// Access client
const client = useAppStore((state) => state.api.client);
const data = await client.GET('/organizations');

// Access QueryClient
const queryClient = useAppStore((state) => state.api.queryClient);
await queryClient.fetchQuery(someOptions());
```

---

## 5. UISlice

**Location:** `/packages/shared/src/store/slices/ui.ts`

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

**Location:** `/packages/shared/src/store/slices/navigation.ts`

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
import { useAppStore } from '#/store';

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

ApiSlice (standalone)

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

**Enabled in all apps:**

```typescript
devtools((...a) => ({ ...slices }), { name: 'AppStore' })
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

**DO:** Compose slices in app stores:
```typescript
export type AppStore = ApiSlice & AuthSlice & PermissionsSlice & TenantSlice & UISlice;
```

**DON'T:** Create app-specific slices in apps - keep them in `@template/shared`

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
import type { AuthSlice } from '@template/shared';
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

1. **Create slice in shared:**
   ```typescript
   // packages/shared/src/store/slices/mySlice.ts
   export type MySlice = {
     mySlice: {
       data: string;
       setData: (data: string) => void;
     };
   };

   export const createMySlice: StateCreator<MySlice> = (set) => ({
     mySlice: {
       data: '',
       setData: (data) => set((state) => ({ mySlice: { ...state.mySlice, data } })),
     },
   });
   ```

2. **Export from shared index:**
   ```typescript
   // packages/shared/src/store/index.ts
   export * from './slices/mySlice';
   ```

3. **Add to app stores:**
   ```typescript
   // apps/{web,admin,superadmin}/app/store/index.ts
   import { createMySlice, type MySlice } from '@template/shared';

   export type AppStore = ApiSlice & AuthSlice & ... & MySlice;

   export const useAppStore = create<AppStore>()(
     devtools((...a) => ({
       ...createApiSlice(...a),
       ...createMySlice(...a),
       // ...
     })),
   );
   ```

### Removing a Slice

1. Remove from app store compositions
2. Remove from `@template/shared` exports
3. Delete slice file
4. Search codebase for usage and remove

---

## File Reference

```
packages/shared/src/store/
├── slices/
│   ├── api.ts          # ApiSlice
│   ├── auth.ts         # AuthSlice
│   ├── permissions.ts  # PermissionsSlice
│   ├── tenant.ts       # TenantSlice
│   ├── ui.ts           # UISlice
│   └── navigation.ts   # NavigationSlice (planned)
└── index.ts            # Re-exports

apps/{web,admin,superadmin}/app/store/
└── index.ts            # App-specific store composition
```
