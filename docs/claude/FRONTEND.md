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

### State Management

**See:** [ZUSTAND.md](./ZUSTAND.md) for complete documentation

Apps compose Zustand slices:
- **Web/Admin:** 6 slices (Auth, Permissions, Tenant, API, UI, Navigation)
- **Superadmin:** 5 slices (Auth, Permissions, API, UI, Navigation - no Tenant)

**Key slices:**
- **AuthSlice** - User + session + orgs + spaces
- **PermissionsSlice** - ReBAC (Permix)
- **TenantSlice** - Context switching (personal/org/space)
- **ApiSlice** - QueryClient + API config
- **UISlice** - Theme + UI state
- **NavigationSlice** - Router navigation + nav config

```typescript
import { useAppStore } from '#/store';

// Read state
const user = useAppStore((state) => state.auth.user);
const theme = useAppStore((state) => state.ui.theme);

// Call actions
const logout = useAppStore((state) => state.auth.logout);
await logout();
```

---

## Routing

### File-Based Routes

**Pattern:** `_authenticated.tsx` layout wraps all protected routes

```
apps/web/app/routes/
├── __root.tsx              # Root layout
├── _public.tsx             # Public layout (no auth)
├── _public/
│   ├── index.tsx           # Landing page
│   ├── login.tsx
│   └── signup.tsx
├── _authenticated.tsx      # Protected layout (guard + AppShell)
├── _authenticated/
│   ├── dashboard.tsx
│   ├── settings.tsx
│   ├── organizations.tsx
│   └── org.$organizationId.users.tsx
├── _fullscreen.tsx         # Protected layout (guard, no AppShell)
└── _fullscreen/
    └── example.tsx         # Fullscreen pages
```

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

The fullscreen layout preserves context (org/space/spoof) when navigating back via the top-left back button.

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

## Authentication

**See:** [AUTHENTICATION.md](./AUTHENTICATION.md) for complete authentication documentation including:
- Login/signup flows
- OAuth providers
- Hooks (useAuthFlow, useAuthProviders)
- Navigation patterns
- Token management
- Guards

**Quick Reference:**

### Auth Hooks

### Login/Signup Pattern

**Use `useAuthFlow` hook for all auth flows:**

```typescript
// packages/ui/src/pages/LoginPage.tsx
import { useAuthFlow, useAuthProviders } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

export const LoginPage = ({ hideSignup }: LoginPageProps) => {
  const signIn = useAppStore((state) => state.auth.signIn);
  const { handleAuth, error, isLoading } = useAuthFlow(signIn);
  const { providers, isLoading: isLoadingProviders, error: providerError } = useAuthProviders();
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  return (
    <LoginForm
      onSubmit={handleAuth}
      onSignupClick={() => {
        const signupUrl = buildPathWithSearch('/signup', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
        navigatePreservingContext(signupUrl);
      }}
      providers={providerError ? [] : providers}
      error={providerError ? 'Unable to load auth providers.' : error}
      isLoading={isLoading || isLoadingProviders}
    />
  );
};
```

**Flow:**
1. `useAuthProviders` fetches context-aware providers (platform or org-specific)
2. User submits credentials via `LoginForm`/`SignupForm`
3. `useAuthFlow` calls store's `signIn`/`signUp` action
4. BetterAuth sets JWT in httpOnly cookie
5. Store hydrates user data
6. Auto-redirect to `redirectTo` param or `/dashboard`

### Auth Hooks

#### useAuthFlow

**Location:** `/packages/ui/src/hooks/useAuthFlow.ts`

Handles auth submission, loading state, error handling, and redirect logic.

```typescript
import { useAuthFlow } from '@template/ui/hooks';

const signIn = useAppStore((state) => state.auth.signIn);
const { handleAuth, error, isLoading } = useAuthFlow(signIn);

// Pass handleAuth to form
<LoginForm onSubmit={handleAuth} error={error} isLoading={isLoading} />
```

**Returns:**
- `handleAuth(credentials)` - Submit handler
- `error` - Error message
- `isLoading` - Loading state

**Features:**
- Preserves `redirectTo` param from URL
- Auto-redirects after success
- Generic - works with any auth function

#### useAuthProviders

**Location:** `/packages/ui/src/hooks/useAuthProviders.ts`

Fetches context-aware auth providers (platform or organization-specific).

```typescript
import { useAuthProviders } from '@template/ui/hooks';

const { providers, isLoading, error } = useAuthProviders();

// Pass to form
<LoginForm providers={providers} isLoading={isLoading} />
```

**Returns:**
- `providers` - Array of enabled providers (OAuth/SAML)
- `isLoading` - Loading state
- `error` - Error if fetch fails

**Behavior:**
- If `?org=xyz` in URL → fetches org providers + platform providers
- Otherwise → fetches platform providers only
- Filters to enabled providers automatically

### OAuth Redirect

**Location:** `/packages/ui/src/lib/auth/oauthRedirect.ts`

Utility for initiating OAuth flows.

```typescript
import { redirectToOAuthProvider } from '@template/ui/lib';

// Automatically called by LoginForm/SignupForm provider buttons
redirectToOAuthProvider(provider);
```

**Security:**
- Validates callback URL origin
- Only allows current origin + localhost:3000
- Auto-encodes parameters

### Logout Flow

```typescript
// In UserMenu or anywhere
const logout = useAppStore((state) => state.auth.logout);
const navigate = useAppStore((state) => state.navigation.navigate);

await logout();
navigate({ to: '/login' });
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

**Location:** `app/config/nav/`

Navigation is organized by **context** (where it appears) and **feature** (what it contains) for better modularity.

```
nav/
├── contexts/          # Context-specific navigation (what shows in which mode)
│   ├── organizationContext.ts  # Org-level sidebar
│   ├── publicContext.ts        # Logged-out users
│   ├── spaceContext.ts         # Space-level sidebar
│   └── userContext.ts          # Personal/user sidebar
├── features/          # Feature groupings (cross-context)
│   ├── communications.ts
│   ├── dashboard.ts
│   ├── home.ts        # Web only
│   ├── organizations.ts
│   ├── settings.ts
│   ├── spaces.ts
│   └── users.ts
└── index.ts           # Exports combined config
```

**Per-app variations:**
- **Web:** All contexts (personal, organization, space) + home feature
- **Admin:** All contexts except home (admin-focused)
- **Superadmin:** User + public contexts only (no orgs/spaces)

### File Organization

**Context files** define which features appear in each context:

```typescript
// contexts/organizationContext.ts
import { dashboardNavigation } from '../features/dashboard';
import { settingsNavigation } from '../features/settings';
import { usersNavigation } from '../features/users';

export const organizationContext: SidebarSection[] = [
  dashboardNavigation,
  usersNavigation,
  settingsNavigation,
];
```

**Feature files** define navigation items for a logical grouping:

```typescript
// features/settings.ts
import { Settings } from 'lucide-react';

export const settingsNavigation: SidebarSection = {
  items: [
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
    },
  ],
};
```

### Adding Navigation Items

**By Context** (where does it appear?):
1. Edit the appropriate context file (`contexts/organizationContext.ts`)
2. Import and add feature to the context's array

**By Feature** (what logical grouping?):
1. Create or edit feature file (`features/analytics.ts`)
2. Import in relevant context files

**Example:**
```typescript
// 1. Create feature file
// features/analytics.ts
export const analyticsNavigation: SidebarSection = {
  items: [
    { label: 'Analytics', path: '/analytics', icon: BarChart },
  ],
};

// 2. Add to organization context
// contexts/organizationContext.ts
import { analyticsNavigation } from '../features/analytics';

export const organizationContext = [
  dashboardNavigation,
  analyticsNavigation,  // Added
  settingsNavigation,
];
```

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

### Organization: `@template/ui`

**Location:** `packages/ui/`

All frontend code (components, hooks, state, pages) lives in `@template/ui`. Previously scattered across `@template/shared`, everything is now consolidated for better organization and type safety.

#### Why Separate from @template/shared?

`@template/shared` was originally meant for code shared between frontend and backend. As the codebase grew:
- Frontend code is never used by backend
- OpenAPI client generation is frontend-specific
- UI components need different testing strategies
- Package grew too large and unfocused

**Result:** All frontend code moved to `@template/ui`, `@template/shared` now only contains true isomorphic utilities (logger, errors).

#### Component Organization

Components are organized by **domain** (not technical type):

```
packages/ui/src/components/
├── auth/              # Authentication forms, buttons
│   ├── LoginForm.tsx
│   └── SignupForm.tsx
├── layout/            # AppShell, Sidebar, Header, Breadcrumbs
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── Breadcrumbs.tsx
├── organizations/     # Org-specific components
│   └── CreateOrganizationModal.tsx
├── primitives/        # Base UI components (shadcn/ui)
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Card.tsx
├── settings/          # Settings tabs and modals
│   ├── UserProfileTab.tsx
│   ├── CreateTokenModal.tsx
│   └── AuthProviderModal.tsx
├── users/             # User-specific components
│   └── InviteUserModal.tsx
└── utility/           # Generic utilities
    ├── ErrorBoundary.tsx
    ├── NotFound.tsx
    └── Toaster.tsx
```

**Rule:** Put components where they're used, not by technical type.
- ✅ `components/settings/CreateTokenModal.tsx`
- ❌ `components/modals/CreateTokenModal.tsx`

#### OpenAPI Client

API client is auto-generated from OpenAPI spec:

```bash
cd packages/ui
bun run generate:api  # Generates apiClient/ from openapi.json
```

**Location:** `packages/ui/src/apiClient/`

**Usage:**
```typescript
import { organizationReadMany } from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib';

const { data } = useQuery({
  queryKey: ['organizations'],
  queryFn: apiQuery(organizationReadMany),
});
```

See AUTHENTICATION.md for complete API integration patterns.

### Settings Components

**Location:** `packages/ui/src/components/settings/`

Settings use **nested routes** (not tabs) for deep linking, permissions, and URL state preservation.

#### Route Structure

```
app/routes/_authenticated/settings/
├── authProviders.tsx   # /settings/authProviders
├── profile.tsx         # /settings/profile
├── tokens.tsx          # /settings/tokens
└── webhooks.tsx        # /settings/webhooks
```

#### Context-Aware Pattern

Settings pages adapt based on current context (personal/org/space):

```typescript
// app/routes/_authenticated/settings/profile.tsx
import { OrganizationProfileTab, SpaceProfileTab, UserProfileTab } from '@template/ui';

export const ProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context);

  if (context.type === 'organization') return <OrganizationProfileTab />;
  if (context.type === 'space') return <SpaceProfileTab />;
  return <UserProfileTab />;
};
```

#### Available Components

**Location:** `packages/ui/src/components/settings/`

- `SettingsLayout` - Master settings container with sidebar
- `UserProfileTab` - User profile editor
- `OrganizationProfileTab` - Organization profile editor
- `SpaceProfileTab` - Space profile editor
- `UserTokensTab` - User API token management
- `OrganizationTokensTab` - Organization token management
- `SpaceTokensTab` - Space token management
- `UserWebhooksTab` - User webhook subscriptions
- `OrganizationWebhooksTab` - Org webhook subscriptions
- `SpaceWebhooksTab` - Space webhook subscriptions
- `CreateTokenModal` - Token creation modal
- `AuthProviderModal` - Auth provider configuration modal

#### Example: Settings Layout

```typescript
import { SettingsLayout } from '@template/ui';

export const SettingsRoute = () => {
  const context = useAppStore((state) => state.tenant.context);

  // Navigation links adapt to context
  const navItems = [
    { label: 'Profile', to: '/settings/profile' },
    { label: 'Auth Providers', to: '/settings/authProviders' },
    { label: 'API Tokens', to: '/settings/tokens' },
    { label: 'Webhooks', to: '/settings/webhooks' },
  ];

  return (
    <SettingsLayout title={`${context.type} Settings`} navItems={navItems}>
      <Outlet />  {/* Nested routes render here */}
    </SettingsLayout>
  );
};
```

**Benefits:**
- Deep linking (`/settings/tokens` shareable)
- Permission-based route guards
- Browser back/forward works correctly
- Context preserved in URL
- No client-side tab state management

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

**LoginForm:**

```typescript
import type { LoginCredentials } from '@template/ui/types';

<LoginForm
  onSubmit={async (credentials: LoginCredentials) => {
    // credentials = { email, password }
    await handleAuth(credentials);
  }}
  onSignupClick={() => navigatePreservingContext('/signup')}
  providers={providers}  // OAuth/SAML providers
  error={error}
  isLoading={isLoading}
/>
```

**SignupForm:**

```typescript
import type { SignupCredentials } from '@template/ui/types';

<SignupForm
  onSubmit={async (credentials: SignupCredentials) => {
    // credentials = { email, password, name }
    await handleAuth(credentials);
  }}
  onLoginClick={() => navigatePreservingContext('/login')}
  providers={providers}  // OAuth/SAML providers
  error={error}
  isLoading={isLoading}
/>
```

**Features:**
- Email/password form with validation
- OAuth/SAML provider buttons (Google, GitHub, custom)
- Provider icons from lucide-react
- Auto-divider when providers present
- Error display with styling
- Loading states
- Click handlers for form switching

**Credential Types:**

**Location:** `/packages/ui/src/types/auth.ts`

```typescript
export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignupCredentials = {
  email: string;
  password: string;
  name: string;
};
```

### Layout Utilities

**Additional layout components in `/packages/ui/src/components/layout/`:**

- **ResponsiveDrawer** - Drawer (desktop) / Modal (mobile) - **Recommended for detail views**
- **Modal** - Base modal with overlay
- **DetailPanel** - Slide-out detail panel
- **Header** - Page header with breadcrumbs
- **MasterDetailLayout** - Split-view layout for list/detail

**Example: ResponsiveDrawer (Recommended)**

```typescript
// Automatically switches between drawer (desktop) and modal (mobile)
<ResponsiveDrawer
  open={isOpen}
  onClose={onClose}
  title="User Details"
  breakpoint="md" // Default: switches at 768px
>
  <div className="space-y-4">
    <div>
      <h3 className="font-semibold">Name</h3>
      <p>{user.name}</p>
    </div>
    <div>
      <h3 className="font-semibold">Email</h3>
      <p>{user.email}</p>
    </div>
  </div>
</ResponsiveDrawer>
```

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

**When to Use:**

| Component | Desktop | Mobile | Best For |
|-----------|---------|--------|----------|
| **ResponsiveDrawer** | Side drawer | Modal | Detail views, user profiles, settings panels |
| **Modal** | Centered modal | Centered modal | Forms, confirmations, focused actions |

---

## Hooks

### Auth Hooks

#### useAuthFlow

**Location:** `/packages/ui/src/hooks/useAuthFlow.ts`

Handles auth flow with loading state, errors, and redirect.

```typescript
const signIn = useAppStore((state) => state.auth.signIn);
const { handleAuth, error, isLoading } = useAuthFlow(signIn);

<LoginForm onSubmit={handleAuth} error={error} isLoading={isLoading} />
```

#### useAuthProviders

**Location:** `/packages/ui/src/hooks/useAuthProviders.ts`

Fetches context-aware auth providers (platform or organization).

```typescript
const { providers, isLoading, error } = useAuthProviders();

<LoginForm providers={providers} />
```

### Navigation Hooks

#### Navigation Store Methods

**Location:** `/packages/ui/src/store/slices/navigation.ts`

```typescript
const navigate = useAppStore((state) => state.navigation.navigate);
const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);

// Basic navigation
navigate({ to: '/dashboard' });

// Preserve org/space context params
navigatePreservingContext('/settings');

// Preserve spoof param only
navigatePreservingSpoof('/users?org=xyz');
```

**When to use:**
- `navigate` - Basic navigation, explicit search params
- `navigatePreservingContext` - Preserve org/space/spoof params
- `navigatePreservingSpoof` - Preserve spoof param only (for org switching)

**redirectTo Preservation:**

```typescript
import { buildPathWithSearch } from '@template/ui/lib/searchParams';

// Preserve redirectTo when navigating between login/signup
const signupUrl = buildPathWithSearch('/signup', search.redirectTo ? { redirectTo: search.redirectTo } : undefined);
navigatePreservingContext(signupUrl);
```

### Permission Hooks

#### usePermission

**Location:** `/packages/ui/src/hooks/usePermission.ts`

```typescript
const editBtn = usePermission({
  permissions,
  model: 'organization',
  record: org,
  action: 'manage',
});

<Button {...editBtn}>Edit</Button>
```

### Data Hooks

#### useOptimisticMutation

**Location:** `/packages/ui/src/hooks/useOptimisticMutation.ts`

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

### Utility Hooks

#### useDebounce

**Location:** `/packages/ui/src/hooks/useDebounce.ts`

```typescript
const [slug, setSlug] = useState('');
const debouncedSlug = useDebounce(slug, 300);

// debouncedSlug updates 300ms after slug stops changing
```

#### useValidateUniqueness

**Location:** `/packages/ui/src/hooks/useValidateUniqueness.ts`

```typescript
const { isAvailable, isChecking } = useValidateUniqueness('organization', 'slug', slug);

// UI feedback
{isChecking && <Loader2 className="animate-spin" />}
{isAvailable && <CheckCircle2 />}
{!isAvailable && <AlertCircle />}

// Disable submit
<Button disabled={!isAvailable || isChecking}>Create</Button>
```

---

## Theme System

Multi-tier theming with automatic shade generation, dark mode support, and tenant white-labeling.

### Architecture

**Three-tier CSS variable system:**

```
App Theme (--app-*)     → Platform baseline colors
  ↓
Space Theme (--space-*) → Tenant overrides (set dynamically)
  ↓
Active Theme (--primary) → What components reference
```

**Automatic shade generation** via CSS `color-mix()`:

```css
/* Light mode: mix with white */
:root {
  --primary: var(--space-primary, var(--app-primary));
  --primary-1: var(--space-primary-1, color-mix(in hsl, hsl(var(--primary)), white 60%));
  --primary-2: var(--space-primary-2, color-mix(in hsl, hsl(var(--primary)), white 40%));
  --primary-3: var(--space-primary-3, color-mix(in hsl, hsl(var(--primary)), white 20%));
  --primary-4: var(--space-primary-4, color-mix(in hsl, hsl(var(--primary)), white 10%));
}

/* Dark mode: mix with black */
.dark {
  --primary-1: var(--space-primary-1, color-mix(in hsl, hsl(var(--primary)), black 60%));
  /* ... */
}
```

**Browser support:** 97% (Chrome 111+, Firefox 113+, Safari 16.2+)

### Hooks

#### useThemePersistence

**Location:** `/packages/ui/src/hooks/useThemePersistence.ts`

Hydrates theme from localStorage on mount, persists changes automatically.

```typescript
// In __root.tsx
useThemePersistence(); // Reads from Zustand, no props needed
```

**Behavior:**
- On mount: Load theme from `localStorage.getItem('theme')`
- On change: Save to `localStorage.setItem('theme', value)`
- Works across public and authenticated routes

#### useDarkMode

**Location:** `/packages/ui/src/hooks/useDarkMode.ts`

Toggles `.dark` class on `<html>` based on theme preference.

```typescript
const theme = useAppStore((state) => state.ui.theme);
useDarkMode(theme); // 'light' | 'dark' | 'system'
```

**Behavior:**
- `'light'` → Remove `.dark` class
- `'dark'` → Add `.dark` class
- `'system'` → Match `prefers-color-scheme: dark`

#### useSpaceTheme

**Location:** `/packages/ui/src/hooks/useSpaceTheme.ts`

Sets CSS custom properties for tenant white-labeling.

```typescript
const pageSpace = useAppStore((state) => state.tenant.page.space);

const mockSpaceTheme = {
  primary: "262 80% 46%",
  secondary: "142 76% 46%",
  logo: "https://example.com/logo.png",
};

const spaceTheme = pageSpace ? mockSpaceTheme : null;
useSpaceTheme(spaceTheme);
```

**Color format:** HSL without wrapper: `"H S% L%"`

**URL handling:** Automatically wraps `logo`, `logoDark`, `favicon` in `url()`

**Clears variables** when leaving space context (theme = null)

#### useLanguage

**Location:** `/packages/ui/src/hooks/useLanguage.ts`

Sets `document.documentElement.lang` from navigator.

```typescript
useLanguage(); // Sets lang="en" (or user's browser language)
```

### Components

#### ThemeToggle

**Location:** `/packages/ui/src/components/ThemeToggle.tsx`

Button group for selecting light/dark/system preference.

```typescript
import { ThemeToggle } from '@template/ui';
import { useAppStore } from '#/store';

const theme = useAppStore((state) => state.ui.theme);
const setTheme = useAppStore((state) => state.ui.setTheme);

<ThemeToggle value={theme} onChange={setTheme} />
```

**Usage:** Added to `UserProfileTab` in personal settings

**Variants:**
- Selected: `variant="default"` (filled)
- Unselected: `variant="outline"` (border only)

### Types

#### SpaceTheme

**Location:** `/packages/ui/src/types/SpaceTheme.ts`

All properties optional for tenant override:

```typescript
type SpaceTheme = {
  // Brand colors
  primary?: string;
  primary1?: string;    // Lightest shade
  primary2?: string;
  primary3?: string;
  primary4?: string;    // Darkest shade
  primaryForeground?: string;

  // Same pattern for: secondary, tertiary, quaternary, accent

  // Assets
  logo?: string;
  logoDark?: string;
  favicon?: string;
} | null;
```

#### AppTheme

**Location:** `/packages/ui/src/types/AppTheme.ts`

Complete theme definition (all properties required):

```typescript
type AppTheme = {
  primary: string;
  primary1: string;
  // ... all shades
  // ... all status colors (success, error, warning, info)
  // ... all UI colors (background, foreground, card, etc.)
};
```

### Usage in Root Component

**Pattern (all apps):**

```typescript
// apps/{web,admin,superadmin}/app/routes/__root.tsx
import { useDarkMode, useLanguage, useSpaceTheme, useThemePersistence } from '@template/ui';

const RootComponent = () => {
  const theme = useAppStore((state) => state.ui.theme);
  const pageSpace = useAppStore((state) => state.tenant.page.space);

  useLanguage();
  useThemePersistence();

  // Mock theme (TODO: load from database)
  const mockSpaceTheme = pageSpace ? {
    primary: "262 80% 46%",
    secondary: "142 76% 46%",
    logo: "https://example.com/logo.png",
  } : null;

  useDarkMode(theme);
  useSpaceTheme(mockSpaceTheme); // Web/Admin only, not Superadmin

  return <QueryClientProvider><Outlet /></QueryClientProvider>;
};
```

### Testing

**Location:** `/packages/ui/src/hooks/*.test.ts`

```bash
cd packages/ui && bun test
```

**Coverage:**
- `useDarkMode.test.ts` - Dark class toggling for light/dark/system
- `useSpaceTheme.test.ts` - CSS variable setting, URL wrapping, clearing
- `ThemeToggle.test.tsx` - Theme option rendering and selection

### White-Labeling Flow

**For tenants to customize their space:**

1. **Database** (future): Add theme fields to Space model
   ```prisma
   model Space {
     primaryColor   String?  // "262 80% 46%"
     secondaryColor String?
     logoUrl        String?
   }
   ```

2. **Backend**: Return theme in space data
   ```typescript
   const space = await db.space.findUnique({
     select: { primaryColor, secondaryColor, logoUrl }
   });
   ```

3. **Frontend**: Pass to `useSpaceTheme`
   ```typescript
   const spaceTheme = pageSpace ? {
     primary: space.primaryColor,
     secondary: space.secondaryColor,
     logo: space.logoUrl,
   } : null;

   useSpaceTheme(spaceTheme);
   ```

4. **Automatic**: Shades (1-4) generated via `color-mix()`

### Key Benefits

- **One color = full palette** - Set primary, get 4 shades automatically
- **Dark mode adaptive** - Shades adjust (mix with black vs white)
- **Type-safe** - SpaceTheme type prevents invalid properties
- **Persistent** - Theme preference saved to localStorage
- **Context-aware** - Space theme only applies in space context
- **Graceful degradation** - Older browsers get app theme (no space overrides)

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
