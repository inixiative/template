# Frontend Architecture

Modern, type-safe, permission-aware React architecture with TanStack Router, Zustand, and ReBAC.

## Quick Start

**All three apps (web, admin, superadmin) share:**
- TanStack Router v2 (file-based routing)
- Zustand (5-slice state management)
- BetterAuth + JWT (stateless auth)
- ReBAC permissions (Permix)
- Shared component libraries

**Key Differences:**
- **Web**: Consumer/participant interface
- **Admin**: Provider/operator interface
- **Superadmin**: Platform management (no multi-tenancy)

---

## Architecture Overview

### Stack

```
┌─────────────────────────────────────────────┐
│ Apps: web, admin, superadmin                │
│ ├─ TanStack Router (routes/_authenticated) │
│ ├─ Zustand Store (5 slices)                │
│ └─ BetterAuth Client                       │
├─────────────────────────────────────────────┤
│ Shared Packages                             │
│ ├─ @template/shared (logic + state)        │
│ └─ @template/ui (presentational)           │
└─────────────────────────────────────────────┘
```

### Zustand Store Composition

Every app composes the same 5 slices:

```typescript
// apps/web/app/store/index.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createApiSlice,         // QueryClient wrapper
  createAuthSlice,        // User + session + orgs + spaces
  createPermissionsSlice, // ReBAC (Permix)
  createTenantSlice,      // Context switching
  createUISlice,          // UI state (modals, etc)
} from '@template/shared';

export type AppStore = ApiSlice & AuthSlice & PermissionsSlice & TenantSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools((...a) => ({
    ...createApiSlice(...a),
    ...createAuthSlice(...a),
    ...createPermissionsSlice(...a),
    ...createTenantSlice(...a),
    ...createUISlice(...a),
  }), { name: 'AppStore' }),
);
```

---

## Routing

### File-Based Routes

**Pattern:** `_authenticated.tsx` layout wraps all protected routes

```
apps/web/app/routes/
├── __root.tsx              # Root layout
├── index.tsx               # Public landing
├── login.tsx               # Public login
├── signup.tsx              # Public signup
├── _authenticated.tsx      # Protected layout (guard + AppShell)
└── _authenticated/
    ├── dashboard.tsx
    ├── settings.tsx
    ├── organizations.tsx
    └── org.$organizationId.users.tsx
```

### Guards

**Location:** `/packages/shared/src/guards/authGuard.ts`

```typescript
export const createAuthGuards = (getStore: () => AuthStore) => ({
  requireAuth: (context?) => {
    const isAuthenticated = getStore().auth.isAuthenticated;
    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirectTo: context?.location.pathname },
      });
    }
  },
  requireGuest: (context?) => {
    const isAuthenticated = getStore().auth.isAuthenticated;
    if (isAuthenticated) {
      throw redirect({
        to: context?.location.search.redirectTo || '/dashboard',
      });
    }
  },
});
```

**Per-App Instantiation:**

```typescript
// apps/web/app/guards/index.ts
import { createAuthGuards } from '@template/shared';
import { useAppStore } from '#/store';

export const { requireAuth, requireGuest } = createAuthGuards(() => useAppStore.getState());
```

**Usage in Routes:**

```typescript
// apps/web/app/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: (ctx) => requireAuth(ctx),  // Guard runs before render
  component: AuthenticatedLayout,
});

// apps/web/app/routes/login.tsx
export const Route = createFileRoute('/login')({
  beforeLoad: (ctx) => requireGuest(ctx), // Redirect if already logged in
  component: LoginPage,
});
```

---

## State Management

### 1. AuthSlice

**Location:** `/packages/shared/src/store/slices/auth.ts`

**State:**

```typescript
{
  user: User | null;
  session: Session | null;
  organizationUsers: OrganizationUser[];  // User's org memberships
  organizations: Organization[];           // Full org objects
  spaceUsers: SpaceUser[];                 // User's space memberships
  spaces: Space[];                         // Full space objects
  isAuthenticated: boolean;
  isInitialized: boolean;
}
```

**Actions:**

```typescript
// Hydrate from /me endpoint
hydrate({ user, session, organizationUsers, organizations, spaceUsers, spaces })

// Set user
setUser(user)

// Logout
logout()
```

### 2. PermissionsSlice

**Location:** `/packages/shared/src/store/slices/permissions.ts`

**Purpose:** ReBAC permission checks on frontend

**State:**

```typescript
{
  permissions: Permix & {
    check: (model: string, record: any, action: string) => boolean;
    hydrate: (me: MeResponse) => Promise<void>;
  }
}
```

**Hydration (matches backend permission setup):**

```typescript
await hydratePermissions({
  id: user.id,
  platformRole: user.platformRole,
  organizationUsers: [
    { organizationId: 'org1', role: 'owner', entitlements: {...} }
  ],
  spaceUsers: [
    { spaceId: 'space1', role: 'admin', entitlements: {...} }
  ],
});

// Internally calls:
for (const orgUser of organizationUsers) {
  await setupOrgContext(permix, {
    role: orgUser.role,
    orgId: orgUser.organizationId,
    entitlements: orgUser.entitlements,
  });
}

for (const spaceUser of spaceUsers) {
  await setupSpaceContext(permix, {
    role: spaceUser.role,
    spaceId: spaceUser.spaceId,
    entitlements: spaceUser.entitlements,
  });
}
```

**Usage:**

```typescript
const permissions = useAppStore(state => state.permissions);
const canManage = permissions.check('organization', org, 'manage');

<Button show={canManage}>Edit</Button>
```

### 3. TenantSlice

**Location:** `/packages/shared/src/store/slices/tenant.ts`

**Purpose:** Multi-tenant context switching

**State:**

```typescript
{
  context: {
    type: 'personal' | 'organization' | 'space';
    organization?: Organization;
    space?: Space;
  };
  page: {
    organization?: Organization;  // From route params
    space?: Space;
  };
}
```

**Difference:**
- `context`: Global app-level context (shown in ContextSelector)
- `page`: Route-specific context (from URL params like `/org/:orgId`)

**Actions:**

```typescript
setPersonal()  // Switch to personal context
setOrganization(org, space?)  // Switch to org (optional space)
setSpace(org, space)  // Switch to space
```

**Usage:**

```typescript
const tenant = useAppStore(state => state.tenant);

// Set context
tenant.setOrganization(org);

// Read context for nav selection
const navSections = tenant.context.type === 'personal'
  ? navConfig.personal
  : tenant.context.type === 'organization'
  ? navConfig.organization
  : navConfig.space;
```

### 4. ApiSlice

**Location:** `/packages/shared/src/store/slices/api.ts`

**Purpose:** TanStack Query QueryClient wrapper

```typescript
{
  queryClient: QueryClient;
}
```

**Why?** Allows calling `queryClient.fetchQuery()` outside React components (used by `initializeAuth()`).

### 5. UISlice

**Location:** `/packages/shared/src/store/slices/ui.ts`

**Purpose:** Generic UI state (modals, drawers, etc)

Currently minimal - placeholder for app-specific UI state.

---

## Authentication Flow

### Setup

**1. Create Auth Client:**

```typescript
// apps/web/app/lib/auth.ts
import { createAuthClient } from '@template/shared';

export const authClient = createAuthClient(import.meta.env.VITE_API_URL);
```

**2. Auth Initialization (on mount):**

**Location:** `/packages/shared/src/auth/initializeAuth.ts`

```typescript
export async function initializeAuth() {
  const queryClient = useAppStore.getState().api.queryClient;
  const hydrate = useAppStore.getState().auth.hydrate;
  const hydratePermissions = useAppStore.getState().permissions.hydrate;

  // Fetch /me with all relations
  const result = await queryClient.fetchQuery(meReadOptions());
  const { organizationUsers, organizations, spaceUsers, spaces, ...user } = result.data;

  // Hydrate auth slice
  hydrate({ user, session: null, organizationUsers, organizations, spaceUsers, spaces });

  // Hydrate permissions (setup ReBAC contexts)
  await hydratePermissions({ id: user.id, platformRole: user.platformRole, organizationUsers, spaceUsers });
}
```

**Called from authenticated layout:**

```typescript
// apps/web/app/routes/_authenticated.tsx
function AuthenticatedLayout() {
  const auth = useAppStore(state => state.auth);

  useEffect(() => {
    if (!auth.isInitialized) {
      initializeAuth().catch((error) => {
        console.error('Failed to initialize auth:', error);
        navigate({ to: '/login', search: { redirectTo: location.pathname } });
      });
    }
  }, [auth.isInitialized]);

  // Render AppShell
}
```

### Login Flow

```typescript
// packages/shared/src/pages/LoginPage.tsx
const handleLogin = async (email: string, password: string) => {
  const result = await authClient.signIn.email({ email, password });

  if (result.error) {
    setError(result.error.message);
    return;
  }

  // Hydrate Zustand store
  onSuccess(result.data?.user, result.data?.session);

  // Navigate
  navigate({ to: search.redirectTo || '/dashboard' });
};
```

**Full Flow:**
1. User submits credentials via `LoginForm`
2. `authClient.signIn.email()` → BetterAuth sets JWT in httpOnly cookie
3. Frontend hydrates Zustand store with user + session
4. Redirect to dashboard or `redirectTo` param

### Logout Flow

```typescript
// packages/shared/src/hooks/useLogout.ts
export const useLogout = (authClient: AuthClient, onSuccess?: () => void) => {
  const logout = useCallback(async () => {
    await authClient.signOut();
    onSuccess?.();
  }, [authClient, onSuccess]);

  return { logout, isLoading };
};
```

**Usage:**

```typescript
const { logout } = useLogout(authClient, () => {
  auth.logout();  // Clear Zustand state
  navigate({ to: '/login' });
});
```

---

## Permissions (Frontend)

### Pattern

Frontend uses **same ReBAC system** as backend via `PermissionsSlice`.

### Basic Check

```typescript
const permissions = useAppStore(state => state.permissions);
const canManage = permissions.check('organization', org, 'manage');
```

### Button Visibility

```typescript
<Button show={permissions.check('organization', org, 'own')}>
  Delete
</Button>
```

### Navigation Filtering

```typescript
const navConfig = {
  organization: [
    {
      items: [
        {
          label: 'Settings',
          path: '/org/:organizationId/settings',
          can: (p, ctx) => ctx.organization ? p.check('organization', ctx.organization, 'manage') : false,
        },
      ],
    },
  ],
};
```

### usePermission Hook

**Location:** `/packages/shared/src/hooks/usePermission.ts`

```typescript
const editBtn = usePermission({
  permissions,
  model: 'organization',
  record: org,
  action: 'manage',
});

<Button {...editBtn}>Edit</Button>
```

**Returns:**

```typescript
{
  show: boolean;        // Show button?
  disable: boolean;     // Disable button?
  disabledText?: string; // Tooltip text if disabled
}
```

---

## Navigation

### Structure

**Per-app nav configs:**
- `/apps/web/app/config/nav.ts`
- `/apps/admin/app/config/nav.ts`
- Superadmin: Hardcoded in layout

### Format

```typescript
type NavConfig = {
  personal: SidebarSection[];    // Personal context nav
  organization: SidebarSection[]; // Org context nav
  space: SidebarSection[];        // Space context nav
};

type SidebarSection = {
  title?: string;
  items: SidebarItem[];
};

type SidebarItem = {
  label: string;
  path: string;
  icon?: LucideIcon;
  badge?: string;
  can?: (permissions: any, context: NavContext) => boolean;
};
```

### Example: Web App

```typescript
export const navConfig: NavConfig = {
  personal: [
    {
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: Home },
        { label: 'Organizations', path: '/organizations', icon: Building2 },
        { label: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ],

  organization: [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/org/:organizationId',
          icon: Home,
          can: (p, ctx) => ctx.organization ? p.check('organization', ctx.organization, 'read') : false,
        },
        {
          label: 'Settings',
          path: '/org/:organizationId/settings',
          icon: Settings,
          can: (p, ctx) => ctx.organization ? p.check('organization', ctx.organization, 'manage') : false,
        },
      ],
    },
  ],

  space: [
    {
      items: [
        {
          label: 'Dashboard',
          path: '/org/:organizationId/space/:spaceId',
          icon: Home,
          can: (p, ctx) => ctx.space ? p.check('space', ctx.space, 'read') : false,
        },
      ],
    },
  ],
};
```

### Dynamic Selection

```typescript
const tenant = useAppStore(state => state.tenant);

const navSections = tenant.context.type === 'personal'
  ? navConfig.personal
  : tenant.context.type === 'organization'
  ? navConfig.organization
  : navConfig.space;

<Sidebar
  sections={navSections}
  context={tenant.context}
  permissions={permissions}
  currentPath={location.pathname}
  onNavigate={(path) => navigate({ to: path })}
/>
```

---

## Layout System

### AppShell

**Location:** `/packages/ui/src/components/layout/AppShell.tsx`

**Master layout wrapper** for all authenticated pages.

**Structure:**

```
┌───────────────────────────────────────┐
│ Sidebar (250px)    │ Main Content     │
│ ─────────────────  │                  │
│ ContextSelector    │  <Outlet />      │
│ ─────────────────  │                  │
│ Navigation         │                  │
│ ─────────────────  │                  │
│ Support            │                  │
│ UserMenu           │                  │
└───────────────────────────────────────┘
```

**Usage (Web/Admin):**

```typescript
<AppShell
  logo={<Logo />}
  currentContext={currentContext}      // For ContextSelector
  organizations={organizations}         // For ContextSelector
  navSections={navSections}             // Navigation items
  navContext={navContext}               // For permission checks
  currentPath={location.pathname}
  permissions={permissions}
  user={user}
  onSelectPersonal={() => tenant.setPersonal()}
  onSelectOrganization={(id) => tenant.setOrganization(id)}
  onSelectSpace={(orgId, spaceId) => tenant.setSpace(orgId, spaceId)}
  onNavigate={(path) => navigate({ to: path })}
  onLogout={() => navigate({ to: '/login' })}
>
  <Outlet />
</AppShell>
```

**Usage (Superadmin):**

```typescript
<AppShell
  logo={<Logo />}
  // NO currentContext, organizations (no ContextSelector)
  navSections={navSections}
  navContext={{}}
  currentPath={location.pathname}
  permissions={permissions}
  user={user}
  isSuperadmin={true}
  onNavigate={(path) => navigate({ to: path })}
  onLogout={() => navigate({ to: '/login' })}
>
  <Outlet />
</AppShell>
```

### ContextSelector

**Location:** `/packages/ui/src/components/layout/ContextSelector.tsx`

**Purpose:** Dropdown to switch between Personal/Org/Space contexts

**Features:**
- Nested org → spaces structure
- Auto-collapse if org has only 1 space
- "Manage" button per org
- "Your Organizations" link
- **Locked mode** for white-label (shows current context, no dropdown)

**Types:**

```typescript
type CurrentContext = {
  type: 'personal' | 'organization' | 'space';
  label: string;
  organizationId?: string;
  spaceId?: string;
};

type OrganizationOption = {
  id: string;
  name: string;
  spaces?: SpaceOption[];
};
```

**Locked Mode (White-Label):**

```typescript
<AppShell
  currentContext={{ type: 'space', label: 'GameStoreXYZ', spaceId: 'xyz' }}
  lockedContext={true}  // Disables dropdown
  // ...
/>
```

### Sidebar

**Location:** `/packages/ui/src/components/layout/Sidebar.tsx`

**Purpose:** Navigation menu with permission filtering

**Rendering:**

```typescript
const visibleItems = section.items.filter(item => {
  if (!item.can) return true;
  return item.can(permissions, context);
});

return visibleItems.map(item => (
  <button
    onClick={() => onNavigate(replaceParams(item.path, context))}
    className={cn(isActive(item.path, currentPath) && 'bg-accent')}
  >
    {item.icon && <item.icon />}
    {item.label}
  </button>
));
```

**Path Interpolation:**

```typescript
// Replace :organizationId and :spaceId
const replaceParams = (path, context) =>
  path
    .replace(':organizationId', context.organization?.id || '')
    .replace(':spaceId', context.space?.id || '');
```

### UserMenu

**Location:** `/packages/ui/src/components/layout/UserMenu.tsx`

**Features:**
- Avatar with fallback initials
- Superadmin badge
- Spoofing indicator
- Actions: Profile, Settings, Spoof, Unspoof, Logout

---

## Shared Components

### Organization: `@template/ui` vs `@template/shared`

**`@template/ui` - Presentational components:**
- Pure UI (no API calls, no state dependencies)
- Examples: Button, Table, Avatar, LoginForm

**`@template/shared` - Business logic components:**
- Contains API calls, state management
- Examples: OrganizationsPage, CreateOrganizationModal, SettingsLayout

### Settings Components

**Location:** `/packages/shared/src/components/`

- `SettingsLayout` - Tab-based settings container
- `UserProfileTab` - User profile editor
- `UserTokensTab` - API token management
- `UserWebhooksTab` - Webhook subscription management

**Usage:**

```typescript
import { SettingsLayout, UserProfileTab, UserTokensTab } from '@template/shared';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'tokens', label: 'Tokens', icon: Key },
];

<SettingsLayout title="Settings" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
  {activeTab === 'profile' && <UserProfileTab />}
  {activeTab === 'tokens' && <UserTokensTab />}
</SettingsLayout>
```

### Modal Components

**Location:** `/packages/shared/src/components/`

- `CreateOrganizationModal` - Org creation with slug validation
- `InviteUserModal` - User invitation
- `CreateTokenModal` - API token creation

**Example: CreateOrganizationModal**

```typescript
<CreateOrganizationModal
  isOpen={isOpen}
  onClose={onClose}
  onSubmit={(name, slug) => {
    createMutation.mutate({ name, slug });
  }}
/>
```

**Features:**
- Auto-generates slug from name (until manual edit)
- Debounced uniqueness validation
- Visual feedback (spinner → checkmark/error)

### Page Components

**Location:** `/packages/shared/src/pages/`

- `LoginPage` - Login form + logic
- `SignupPage` - Signup form + logic
- `OrganizationsPage` - Organizations list with CRUD
- `OrganizationUsersPage` - Org users management

**Example: OrganizationsPage**

```typescript
export const OrganizationsPage = () => {
  const permissions = useAppStore(state => state.permissions);
  const { data: response } = useQuery(meReadManyOrganizationsOptions());
  const organizations = response?.data || [];

  const deleteMutation = useOptimisticListMutation({
    mutationFn: (vars) => organizationsDeleteMutation({ path: { id: vars.id } }),
    queryKey: meReadManyOrganizationsQueryKey(),
    operation: 'delete',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Organizations</CardTitle>
        <Button onClick={() => setIsCreateModalOpen(true)}>Create</Button>
      </CardHeader>
      <CardContent>
        <Table
          columns={columns}
          data={organizations}
          actions={(org) => (
            <Button
              onClick={() => deleteMutation.mutate(org)}
              show={permissions.check('organization', org, 'own')}
            >
              Delete
            </Button>
          )}
        />
      </CardContent>
    </Card>
  );
};
```

---

## UI Primitives (@template/ui)

### Component Organization

**`@template/ui`** contains pure presentational components with no business logic or API dependencies.

**Categories:**
- **Base Components**: Button, Input, Label, Card
- **Data Display**: Table, Avatar, EmptyState
- **Interactive**: DropdownMenu, ErrorBoundary
- **Auth Components**: LoginForm, SignupForm, AuthDivider, SocialAuthButton
- **Layout Components**: AppShell, Sidebar, ContextSelector, Modal, etc.

### Standard Conditional Props

**All UI components support standardized conditional rendering props:**

```typescript
interface ConditionalProps {
  show?: boolean | (() => boolean);        // Conditionally render (default: true)
  disabled?: boolean | (() => boolean);    // Disable interactive elements
  disabledText?: string;                   // Replace text/placeholder when disabled
}
```

**Pattern:**
- `show={false}` or `show={() => false}` → Component returns `null` (not rendered)
- `disabled={true}` or `disabled={() => true}` → Disables interactive elements
- `disabledText="text"` → Replaces button text/input placeholder when disabled

**Works with:**
- Permission checks: `show={() => permissions.check('organization', org, 'manage')}`
- JSON Rules Engine: `show={() => evaluate(rules, context)}`
- Any conditional logic: `show={() => user.role === 'admin'}`

**Applies to:** Button, Input, Card, Table, Avatar, EmptyState, DropdownMenuItem

**Examples:**

```typescript
// Permission-based visibility
<Button show={() => permissions.check('organization', org, 'manage')}>
  Edit Organization
</Button>

// Permission-based disable with text replacement
<Button
  disabled={() => !permissions.check('organization', org, 'own')}
  disabledText="Requires Owner"
>
  Delete Organization
</Button>

// JSON Rules Engine
<Card show={() => evaluate(displayRules, { user, context })}>
  <CardContent>{/* ... */}</CardContent>
</Card>

// Simple boolean
<Table
  columns={columns}
  data={data}
  show={hasAccess}
/>

// Dropdown with permission check
<DropdownMenuItem
  show={() => permissions.check('organization', org, 'own')}
  onClick={handleDelete}
>
  Delete
</DropdownMenuItem>

// Input with disabled state and text
<Input
  disabled={() => !isEditing}
  disabledText="Enable edit mode to change"
  placeholder="Enter name"
/>
```

### Button

**Location:** `/packages/ui/src/components/Button.tsx`

**Features:**
- Class Variance Authority (CVA) for type-safe variants
- Six variants: default, destructive, outline, secondary, ghost, link
- Four sizes: sm, default, lg, icon
- Standard conditional props (`show`, `disabled`, `disabledText`)

**Props:**

```typescript
interface ButtonProps extends ConditionalProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}
```

**Usage:**

```typescript
// Basic
<Button>Click me</Button>

// Variants
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Edit</Button>

// Permission-aware
<Button show={permissions.check('organization', org, 'manage')}>
  Edit Organization
</Button>

// With tooltip
<Button disabledText="You need admin role to perform this action">
  Restricted Action
</Button>
```

### Input & Label

**Locations:**
- `/packages/ui/src/components/Input.tsx`
- `/packages/ui/src/components/Label.tsx`

**Usage:**

```typescript
<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>
```

### Card

**Location:** `/packages/ui/src/components/Card.tsx`

**Components:** Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

**Usage:**

```typescript
<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### Table

**Location:** `/packages/ui/src/components/Table.tsx`

**Features:**
- Generic type support `Table<T>`
- Custom column rendering
- Empty state handling
- Built-in pagination
- Hover states

**Props:**

```typescript
type Column<T> = {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
};
```

**Usage:**

```typescript
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  {
    key: 'role',
    label: 'Role',
    render: (user) => <Badge>{user.role}</Badge>,
  },
];

<Table
  columns={columns}
  data={users}
  keyExtractor={(user) => user.id}
  emptyMessage="No users found"
  pagination={{
    currentPage: 1,
    totalPages: 5,
    onPageChange: (page) => setPage(page),
  }}
/>
```

### Avatar

**Location:** `/packages/ui/src/components/Avatar.tsx`

**Features:**
- Image with fallback to initials
- Multiple sizes
- Placeholder support

**Usage:**

```typescript
<Avatar
  src={user.avatarUrl}
  alt={user.name}
  fallback={user.name.substring(0, 2).toUpperCase()}
  size="md"
/>
```

### EmptyState

**Location:** `/packages/ui/src/components/EmptyState.tsx`

**Usage:**

```typescript
<EmptyState
  icon={Inbox}
  title="No organizations yet"
  description="Create your first organization to get started"
  action={
    <Button onClick={() => setIsModalOpen(true)}>
      Create Organization
    </Button>
  }
/>
```

### DropdownMenu

**Location:** `/packages/ui/src/components/DropdownMenu.tsx`

**Usage:**

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => handleEdit()}>Edit</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleDelete()}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Auth Components

**Locations:**
- `/packages/ui/src/components/auth/LoginForm.tsx`
- `/packages/ui/src/components/auth/SignupForm.tsx`
- `/packages/ui/src/components/auth/AuthDivider.tsx`
- `/packages/ui/src/components/auth/SocialAuthButton.tsx`

**LoginForm:**

```typescript
<LoginForm
  onSubmit={async (email, password) => {
    await authClient.signIn.email({ email, password });
  }}
  onSignupClick={() => navigate({ to: '/signup' })}
  error={error}
  isLoading={isLoading}
/>
```

**SignupForm:**

```typescript
<SignupForm
  onSubmit={async (email, password, name) => {
    await authClient.signUp.email({ email, password, name });
  }}
  onLoginClick={() => navigate({ to: '/login' })}
  error={error}
  isLoading={isLoading}
/>
```

**Social Auth:**

```typescript
<SocialAuthButton provider="google" onClick={() => signInWithGoogle()} />
<SocialAuthButton provider="github" onClick={() => signInWithGithub()} />
<AuthDivider /> {/* "Or continue with" divider */}
```

### Layout Utilities

**Additional layout components in `/packages/ui/src/components/layout/`:**

- **Modal** - Base modal with overlay
- **DetailPanel** - Slide-out detail panel
- **DrawerOverlay** - Mobile drawer overlay
- **Header** - Page header with breadcrumbs
- **MasterDetailLayout** - Split-view layout for list/detail

**Example: Modal**

```typescript
<Modal isOpen={isOpen} onClose={onClose} title="Create Organization">
  <form onSubmit={handleSubmit}>
    {/* Form fields */}
    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button type="submit">Create</Button>
    </div>
  </form>
</Modal>
```

---

## Hooks

### usePermission

**Location:** `/packages/shared/src/hooks/usePermission.ts`

```typescript
const editBtn = usePermission({
  permissions,
  model: 'organization',
  record: org,
  action: 'manage',
});

<Button {...editBtn}>Edit</Button>
```

### useOptimisticMutation

**Location:** `/packages/shared/src/hooks/useOptimisticMutation.ts`

**For Lists:**

```typescript
const deleteMutation = useOptimisticListMutation({
  mutationFn: (vars) => api.delete(vars.id),
  queryKey: ['organizations'],
  operation: 'delete', // 'create' | 'update' | 'delete'
});

deleteMutation.mutate(org);
```

**Custom Updates:**

```typescript
const updateMutation = useOptimisticMutation({
  mutationFn: (vars) => api.update(vars),
  queryKey: ['organizations'],
  optimisticUpdate: (old, vars) => old.map(item =>
    item.id === vars.id ? { ...item, ...vars } : item
  ),
});
```

### useDebounce

**Location:** `/packages/shared/src/utils/debounce.ts`

```typescript
const [slug, setSlug] = useState('');
const debouncedSlug = useDebounce(slug, 300);

// debouncedSlug updates 300ms after slug stops changing
```

### useValidateUniqueness

**Location:** `/packages/shared/src/utils/validateUniqueness.ts`

```typescript
const { isAvailable, isChecking } = useValidateUniqueness('organization', 'slug', slug);

// UI feedback
{isChecking && <Loader2 className="animate-spin" />}
{isAvailable && <CheckCircle2 />}
{!isAvailable && <AlertCircle />}

// Disable submit
<Button disabled={!isAvailable || isChecking}>Create</Button>
```

### useLogout

**Location:** `/packages/shared/src/hooks/useLogout.ts`

```typescript
const { logout, isLoading } = useLogout(authClient, () => {
  auth.logout();
  navigate({ to: '/login' });
});
```

---

## Patterns

### 1. Route Guards

**Always use guards in `beforeLoad`:**

```typescript
export const Route = createFileRoute('/protected')({
  beforeLoad: (ctx) => requireAuth(ctx),
  component: ProtectedPage,
});
```

### 2. Store Access

**In Components:**

```typescript
const user = useAppStore(state => state.auth.user);
const permissions = useAppStore(state => state.permissions);
```

**Outside Components:**

```typescript
const state = useAppStore.getState();
state.auth.hydrate({ user, session });
```

### 3. Permission Checks

**Visibility:**

```typescript
<Button show={permissions.check('organization', org, 'manage')}>
  Edit
</Button>
```

**Disabling:**

```typescript
const editBtn = usePermission({ permissions, model: 'organization', record: org, action: 'manage' });
<Button {...editBtn}>Edit</Button>
```

**Navigation:**

```typescript
{
  label: 'Settings',
  path: '/settings',
  can: (p, ctx) => ctx.organization ? p.check('organization', ctx.organization, 'manage') : false,
}
```

### 4. Optimistic Mutations

```typescript
const deleteMutation = useOptimisticListMutation({
  mutationFn: (vars) => api.delete(vars.id),
  queryKey: ['organizations'],
  operation: 'delete',
});

deleteMutation.mutate(org);  // Optimistically updates UI, rolls back on error
```

### 5. Context Switching

```typescript
const tenant = useAppStore(state => state.tenant);

// Switch context
tenant.setPersonal();
tenant.setOrganization(org);
tenant.setSpace(org, space);

// Read context
const navSections = tenant.context.type === 'personal' ? navConfig.personal : navConfig.organization;
```

### 6. Debounced Validation

```typescript
const [slug, setSlug] = useState('');
const debouncedSlug = useDebounce(slug, 300);
const { isAvailable, isChecking } = useValidateUniqueness('organization', 'slug', debouncedSlug);

<Button disabled={!isAvailable || isChecking}>Create</Button>
```

---

## Data Tables

### makeDataTableConfig

Auto-generates DataTable configuration from OpenAPI spec metadata.

**Features:**
- Searchable fields from `x-searchable-fields`
- Orderable fields (auto-detected recursively, no arrays)
- Enum filters (auto-detected with `in`/`notin` operators)
- Permission toggles (`canSearch`, `canOrder`)
- Search modes: `combined` (all fields) or `field` (dropdown)

**Location:** `@template/shared/lib/makeDataTableConfig`

### Basic Usage

```typescript
import { makeDataTableConfig } from '@template/shared';

function OrganizationsTable() {
  const config = makeDataTableConfig('adminOrganizationReadMany');

  return (
    <DataTable
      searchable={config.canSearch}
      searchableFields={config.searchableFields}
      orderable={config.canOrder}
      orderableFields={config.orderableFields}
      enumFilters={config.enumFilters}
      searchMode={config.searchMode}
    />
  );
}
```

### With Permissions

```typescript
const hasSearchPermission = usePermission({
  permissions,
  model: 'Organization',
  record: sampleOrg,
  action: 'search',
});

const config = makeDataTableConfig('adminOrganizationReadMany', {
  canSearch: hasSearchPermission.show,
  canOrder: hasSearchPermission.show,
  searchMode: 'field',
  defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
});
```

### Configuration Options

```typescript
type DataTableOptions = {
  searchMode?: 'combined' | 'field';  // Default: 'combined'
  defaultOrderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  canSearch?: boolean;  // Default: true
  canOrder?: boolean;   // Default: true
};
```

### Return Type

```typescript
type DataTableConfig = {
  // From x-searchable-fields in OpenAPI
  searchableFields: string[];

  // Auto-detected from response schema (recursive, no arrays)
  orderableFields: string[];

  // Auto-detected enum fields with values
  enumFilters: Array<{
    field: string;
    values: string[];
    operators: ['in', 'notin'];
  }>;

  // Configuration
  searchMode: 'combined' | 'field';
  defaultOrderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;

  // Permissions
  canSearch: boolean;
  canOrder: boolean;
};
```

### Auto-Detection

**Orderable Fields:**
- Recursively walks response schema
- Includes nested paths (`organizationUser.role`)
- Excludes array fields
- Supports all scalar types

**Enum Filters:**
- Detects `enum: [...]` in schema
- Extracts values for multiselect
- Provides `in` and `notin` operators
- Supports nested enums

**Example Schema → Config:**

```typescript
// OpenAPI schema has:
// - x-searchable-fields: ['name', 'slug']
// - status: enum ['draft', 'active', 'archived']
// - type: enum ['foo', 'bar']

const config = makeDataTableConfig('inquiryReadMany');
// {
//   searchableFields: ['name', 'slug'],
//   orderableFields: ['id', 'name', 'slug', 'status', 'type', 'createdAt', ...],
//   enumFilters: [
//     { field: 'status', values: ['draft', 'active', 'archived'], operators: ['in', 'notin'] },
//     { field: 'type', values: ['foo', 'bar'], operators: ['in', 'notin'] }
//   ],
//   canSearch: true,
//   canOrder: true,
//   searchMode: 'combined'
// }
```

### React Hook

```typescript
import { useDataTableConfig } from '@template/shared';

function OrganizationsTable() {
  const hasPermission = usePermission(...);

  const config = useDataTableConfig('adminOrganizationReadMany', {
    canSearch: hasPermission.show,
    searchMode: 'field',
  });

  return <DataTable {...config} />;
}
```

### Testing

**Location:** `packages/shared/src/lib/makeDataTableConfig.test.ts`

**Coverage:** 14 tests covering:
- Metadata extraction from OpenAPI
- Recursive orderable field detection
- Nested path handling
- Array exclusion
- Enum filter detection
- Permission toggles
- Defaults and customization

```bash
cd packages/shared && bun test src/lib/makeDataTableConfig.test.ts
```

---

## App Differences

| Feature | Web | Admin | Superadmin |
|---------|-----|-------|------------|
| **ContextSelector** | ✅ Yes (can lock) | ✅ Yes | ❌ No |
| **Multi-tenant** | ✅ Yes | ✅ Yes | ❌ No |
| **Navigation** | Consumer actions | Operator actions | Platform mgmt |
| **Nav Config** | `apps/web/app/config/nav.ts` | `apps/admin/app/config/nav.ts` | Hardcoded |
| **Store Name** | `AppStore` | `AdminStore` | `SuperadminStore` |

**Web (Consumer):**
- Browse organizations
- Participate in spaces
- Settings

**Admin (Operator):**
- Manage spaces
- Org analytics
- Space users management

**Superadmin (Platform):**
- All users
- System metrics
- Platform config

---

## Key Files Reference

### Store & State
- `/packages/shared/src/store/slices/auth.ts`
- `/packages/shared/src/store/slices/permissions.ts`
- `/packages/shared/src/store/slices/tenant.ts`
- `/apps/{app}/app/store/index.ts`

### Auth
- `/packages/shared/src/lib/createAuthClient.ts`
- `/packages/shared/src/auth/initializeAuth.ts`
- `/packages/shared/src/guards/authGuard.ts`
- `/apps/{app}/app/guards/index.ts`

### Routing
- `/apps/{app}/app/routes/_authenticated.tsx`
- `/apps/{app}/app/routes/login.tsx`
- `/apps/{app}/app/routes/_authenticated/*.tsx`

### Navigation
- `/apps/web/app/config/nav.ts`
- `/apps/admin/app/config/nav.ts`

### Shared Components
- `/packages/shared/src/components/SettingsLayout.tsx`
- `/packages/shared/src/components/CreateOrganizationModal.tsx`
- `/packages/shared/src/pages/OrganizationsPage.tsx`

### UI Components

**Base Components:**
- `/packages/ui/src/components/Button.tsx`
- `/packages/ui/src/components/Input.tsx`
- `/packages/ui/src/components/Label.tsx`
- `/packages/ui/src/components/Card.tsx`
- `/packages/ui/src/components/Table.tsx`
- `/packages/ui/src/components/Avatar.tsx`
- `/packages/ui/src/components/EmptyState.tsx`
- `/packages/ui/src/components/DropdownMenu.tsx`

**Auth Components:**
- `/packages/ui/src/components/auth/LoginForm.tsx`
- `/packages/ui/src/components/auth/SignupForm.tsx`
- `/packages/ui/src/components/auth/AuthDivider.tsx`
- `/packages/ui/src/components/auth/SocialAuthButton.tsx`

**Layout Components:**
- `/packages/ui/src/components/layout/AppShell.tsx`
- `/packages/ui/src/components/layout/ContextSelector.tsx`
- `/packages/ui/src/components/layout/Sidebar.tsx`
- `/packages/ui/src/components/layout/UserMenu.tsx`
- `/packages/ui/src/components/layout/Modal.tsx`
- `/packages/ui/src/components/layout/DetailPanel.tsx`
- `/packages/ui/src/components/layout/MasterDetailLayout.tsx`

### Hooks
- `/packages/shared/src/hooks/usePermission.ts`
- `/packages/shared/src/hooks/useOptimisticMutation.ts`
- `/packages/shared/src/hooks/useLogout.ts`
- `/packages/shared/src/utils/debounce.ts`
- `/packages/shared/src/utils/validateUniqueness.ts`
