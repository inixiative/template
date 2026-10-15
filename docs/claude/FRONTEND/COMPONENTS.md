# Frontend Components

<!-- toc:start -->

## Contents

- [Package Organization](#package-organization)
- [Standard Conditional Props](#standard-conditional-props)
- [UI Primitives](#ui-primitives)
  - [Button](#button)
  - [Input & Label](#input--label)
  - [Card](#card)
  - [Table](#table)
  - [Avatar](#avatar)
  - [EmptyState](#emptystate)
  - [DropdownMenu](#dropdownmenu)
  - [Select and SearchableSelect](#select-and-searchableselect)
  - [Others](#others)
- [Settings](#settings)
- [Modals and Pages](#modals-and-pages)
- [Key Files](#key-files)

<!-- toc:end -->

`@template/ui` components, pages and UI primitives shared by all three apps. Layout components (AppShell, Sidebar, Modal, drawers) are in [THEME_LAYOUT.md](THEME_LAYOUT.md); auth forms in [AUTH.md](AUTH.md). See [FRONTEND.md](../FRONTEND.md) for the index.

## Package Organization

**Location:** `packages/ui/src/`

All frontend code (components, hooks, store, pages, guards) lives in `@template/ui`. `@template/shared` holds isomorphic code only (logger, errors, bracket query, rules); the API client is `@template/sdk`.

Components are organized by **domain** (not technical type):

```
packages/ui/src/components/
├── auth/              # LoginForm, SignupForm, AuthDivider, SocialAuthButton
├── flows/             # FlowBanner (see FLOWS.md)
├── inquiries/         # InquirySourceControls, InquiryTargetControls
├── layout/            # AppShell, Sidebar, ContextSelector, Header, Breadcrumbs, Modal, drawers
├── organizations/     # CreateOrganizationModal
├── primitives/        # Base UI (Button, Input, Card, Table, Select, …)
├── settings/          # Settings modals and cards
├── users/             # InviteUserModal
└── utility/           # ErrorBoundary, NotFound, Unauthorized, Toaster, SecretRevealModal, …
```

**Rule:** Put components where they're used, not by technical type.
- ✅ `components/settings/CreateTokenModal.tsx`
- ❌ `components/modals/CreateTokenModal.tsx`

Whole pages live in `packages/ui/src/pages/` and are mounted by thin app routes (`component: TokensPage`).

## Standard Conditional Props

Most primitives take `show`:

```typescript
show?: boolean | (() => boolean);   // false → the component renders null (default: true)
```

`Button` and `Input` also take `disabledText`. Setting it **disables** the element and replaces the button text / input placeholder with it. `DropdownMenuItem` takes `show`, `disabled` (boolean or function) and `disabledText`.

| Component | `show` | `disabledText` |
|-----------|--------|----------------|
| Button, Input | ✅ | ✅ |
| DropdownMenuItem | ✅ | ✅ (`disabled` may be a function) |
| Card, Table, Avatar, EmptyState | ✅ | — |

```typescript
<Button show={() => permissions.check('organization', org, 'manage')}>Edit Organization</Button>

<Button disabledText={canDelete ? undefined : 'Requires Owner'}>Delete Organization</Button>

<Card show={() => evaluate(displayRules, { user, context })}>…</Card>
```

Permission checks that feed these props: [PERMISSIONS.md](../PERMISSIONS.md#frontend-checks).

## UI Primitives

**Location:** `packages/ui/src/components/primitives/`

### Button

CVA variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; sizes `sm`, `default`, `lg`, `icon`. Accepts all `<button>` props plus `show` and `disabledText`.

```typescript
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Edit</Button>
```

### Input & Label

`Input` accepts `<input>` props plus `show` and `disabledText`. Variants: `PasswordInput` (show/hide toggle), `SlugInput` (`onChange(value)` with slug normalization).

```typescript
<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
</div>
```

### Card

**Components:** Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

```typescript
<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
  <CardFooter>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### Table

```typescript
type Column<T> = {
  key: string;
  label: React.ReactNode;
  render?: (item: T) => React.ReactNode;   // default: item[key]
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  empty?: { title?: string; description?: string; icon?: string; action?: { label; onClick } };
  show?: boolean | (() => boolean);
  pagination?: PaginationProps;
  infiniteScroll?: { onLoadMore; hasMore; isLoading; rootMargin? };
  maxHeight?: number;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  sectionId?: string;
  className?: string;
};
```

A row that opens something is clickable as a whole row through `onRowClick` (`OrganizationsPage`), not through a separate "View" button in a column; only controls with their own action (delete, a menu) sit inside the row. — fb: 2026-02-12

Empty data renders an `EmptyState` (`empty.title` → `emptyMessage` → "Nothing here yet"). Pagination, infinite scroll and section hashes: [API_CLIENT.md](API_CLIENT.md#table-and-pagination).

### Avatar

Composed: `Avatar` (frame, `show`), `AvatarImage` (renders nothing when `src` is missing or fails to load), `AvatarFallback`.

```typescript
<Avatar className="h-8 w-8">
  <AvatarImage src={user.image ?? undefined} alt={user.name} />
  <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
</Avatar>
```

### EmptyState

```typescript
<EmptyState
  icon="lucide:inbox"
  title="No organizations yet"
  description="Create your first organization to get started"
  action={{ label: 'Create Organization', onClick: () => setIsModalOpen(true) }}
/>
```

### DropdownMenu

Ariakit menu: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` (`align: 'start' | 'end'`), `DropdownMenuItem` (`onClick`), `DropdownMenuLabel`, `DropdownMenuSeparator`.

```typescript
<DropdownMenu>
  <DropdownMenuTrigger>
    <Icon icon="lucide:more-vertical" />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
    <DropdownMenuItem show={canDelete} onClick={handleDelete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Select and SearchableSelect

`Select` takes `options`, `value`, `onChange(value)`.

`SearchableSelect` is a `Select` with a search box in its popover (Ariakit select + combobox). Same `options` / `value` / `onChange` contract as `Select`. Without `onSearch` it filters the given options by label in memory. With `onSearch` it skips local filtering and calls `onSearch(query)` debounced, so the caller can query the API and pass the results back as `options`. The selected label stays visible after the results change.

```typescript
const [search, setSearch] = useState('');
const { data, isFetching } = useQuery({
  queryKey: adminContactReadManyQueryKey({ query: { search } }),
  queryFn: apiQuery(adminContactReadMany),
});

<SearchableSelect
  aria-label="Recipient"
  options={(data?.data ?? []).map((contact) => ({ value: contact.id, label: contact.valueKey ?? contact.id }))}
  value={contactId}
  onChange={setContactId}
  onSearch={setSearch}
  isLoading={isFetching}
  placeholder="Choose a person"
/>
```

### Others

`Badge`, `Breadcrumb`, `CopyButton` (`value`, `label?`), `Pagination`, `ThemeToggle` (see [THEME_LAYOUT.md](THEME_LAYOUT.md#themetoggle)).

## Settings

Settings are nested routes, not tabs: `apps/{web,admin}/app/routes/_authenticated/settings/{profile,tokens,webhooks,integrations,authProviders,update,transfer}.tsx` (superadmin: profile, tokens, webhooks, integrations), each mounting a page from `@template/ui/pages`. `settings.tsx` redirects `/settings` to `/settings/profile`. The nav config's settings item decides which entries each context sees (Auth Providers: organization owners; Update / Transfer: spaces).

Pages adapt to the current context. `ProfilePage` switches on `tenant.context.type`:

```typescript
export const ProfilePage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;

  switch (context.type) {
    case 'organization':
      return <OrganizationProfilePage />;
    case 'space':
      return <SpaceProfilePage />;
    case 'user':
      return <UserProfilePage />;
  }
};
```

**Components** (`packages/ui/src/components/settings/`):

- `ProfileFormCard` - Name / slug form shared by the three profile pages; `showThemeToggle` adds the theme picker
- `CreateTokenModal` - Token creation modal (API tokens are managed by `TokensPage`, which shows a new key once in `SecretRevealModal`)
- `CreateWebhookModal` - Webhook subscription creation (managed by `WebhooksPage`)
- `CreateIntegrationModal` - Connect flow for one provider, or a custom integration when `provider` is `null` (`undefined` = closed). Integrations are managed by `IntegrationsPage`: one bucket per provider in `lib/integrationProviders.ts` plus a Custom bucket (provider `null`), each its own `searchFields[provider]` query of 100 that infinite-scrolls on overflow (`useInfiniteDataQuery` + `useInfiniteScrollTrigger`); a provider's status comes from its bucket's total
- `AuthProviderModal` - Auth provider configuration modal (managed by `OrganizationAuthProvidersPage`)
- `SettingsLayout`, `UserProfileTab`, `UserWebhooksTab` - tabbed settings container and tabs; exported, not mounted by any app route

## Modals and Pages

- `CreateOrganizationModal` (`components/organizations/`) - `isOpen`, `onClose`, `onSubmit(name, slug)`. Derives the slug from the name until edited, then validates it with `useValidateUniqueness` (see [API_CLIENT.md](API_CLIENT.md#form-helpers)).
- `InviteUserModal` (`components/users/`) - `isOpen`, `onClose`, `onSubmit(email, role)`, optional `title` and `roles`.
- `SecretRevealModal` (`components/utility/`) - shows a secret once with a copy button.

**Pages** (`packages/ui/src/pages/`): `LoginPage`, `SignupPage`, `AuthCallbackPage`, `HomePage`, `OrganizationsPage`, `OrganizationUsersPage`, `OrganizationSpacesPage`, `OrganizationProfilePage`, `SpaceProfilePage`, `UserProfilePage`, `ProfilePage`, `TokensPage`, `WebhooksPage`, `IntegrationsPage`, `OrganizationAuthProvidersPage`, `SegmentsPage`, inquiry pages (`InquiriesPage`, `AdminInquiriesPage`, `SpaceTransferInquiryPage`, `SpaceUpdateInquiryPage`, invitation / application / transfer list pages).

List pages share one shape: a `Page` with a create action, a `Table`, and `useOptimisticMutation` for create / delete:

```typescript
export const OrganizationsPage = () => {
  const permissions = useAppStore((state) => state.permissions);
  const { data } = useQuery({
    queryKey: meReadManyOrganizationsQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof meReadManyOrganizations>[0]) => meReadManyOrganizations(opts)),
  });

  const deleteMutation = useOptimisticMutation({
    mutationFn: apiMutation((opts: Parameters<typeof organizationDelete>[0]) => organizationDelete(opts)),
    targets: [createOptimisticListTarget({ queryKey: meReadManyOrganizationsQueryKey(), operation: 'delete' })],
  });
  // <Page title actions={<Button>Create</Button>}><Table … /></Page>
};
```

**Utility** (`components/utility/`): `ErrorBoundary`, `NotFound`, `RootNotFound`, `Unauthorized`, `ComingSoon`, `ShareButton`, `Toaster`.

## Key Files

- `packages/ui/src/components/primitives/` — base UI
- `packages/ui/src/components/{settings,organizations,users,utility}/`
- `packages/ui/src/pages/`
