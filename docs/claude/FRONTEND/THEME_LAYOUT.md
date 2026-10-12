# Frontend Layout and Theme

<!-- toc:start -->

## Contents

- [Layout System](#layout-system)
  - [AppShell](#appshell)
  - [ContextSelector](#contextselector)
  - [Sidebar](#sidebar)
  - [UserMenu](#usermenu)
  - [Header and Page](#header-and-page)
  - [Overlays and Panels](#overlays-and-panels)
- [Theme System](#theme-system)
  - [Architecture](#architecture)
  - [Hooks](#hooks)
  - [ThemeToggle](#themetoggle)
  - [Types](#types)
  - [Usage in Root Component](#usage-in-root-component)
  - [White-Labeling](#white-labeling)
  - [Testing](#testing)
- [Key Files](#key-files)

<!-- toc:end -->

The authenticated shell (AppShell, ContextSelector, Sidebar, UserMenu, Header), the overlay components, and the theme system. See [FRONTEND.md](../FRONTEND.md) for the index.

## Layout System

**Location:** `packages/ui/src/components/layout/`

Layout components read the shared store themselves; apps pass almost nothing.

### AppShell

**Master layout wrapper** for all authenticated pages.

```
┌───────────────────────────────────────────┐
│ Sidebar (w-64)     │ Header (breadcrumbs) │
│ ─────────────────  │──────────────────────│
│ AppIdentity        │                      │
│ ContextSelector    │  children            │
│ ─────────────────  │                      │
│ Sidebar nav        │                      │
│ ─────────────────  │                      │
│ Support (optional) │                      │
│ UserMenu           │                      │
└───────────────────────────────────────────┘
```

```typescript
type AppShellProps = {
  onSupport?: () => void;        // Shows a Support button
  lockedContext?: boolean;       // ContextSelector without the dropdown
  showSpoofControls?: boolean;   // Default true
  children: React.ReactNode;
};
```

```typescript
// Web / admin
<AppShell>
  <ErrorBoundary>{isAuthorized ? <Outlet /> : <Unauthorized />}</ErrorBoundary>
</AppShell>

// Superadmin
<AppShell lockedContext={true} showSpoofControls={false}>…</AppShell>
```

Below `lg` the sidebar is an off-canvas drawer opened from the Header's menu button.

### ContextSelector

Dropdown to switch between Personal and the user's organizations and spaces (from `auth.organizations` / `auth.spaces`).

- Organization with 0 spaces → one item, switches to the organization.
- Organization with 1 space → one item, switches to that space.
- Organization with 2+ spaces → accordion listing its spaces plus the organization itself.
- Each multi-space organization's accordion has a Manage item; `onManageOrganizations` adds a "Your Organizations" item.
- `locked` → shows the current context label with no dropdown (superadmin).

Switching calls `tenant.setOrganization(id)` / `tenant.setSpace(id)`; the URL `?org=` / `?space=` follow.

### Sidebar

Renders `navigation.navConfig[tenant.context.type]`. Items whose `access` fails and `alias` items are skipped; children nest three levels below the top and auto-expand along the active route. Clicking navigates with `navigatePreserving(fullPath, 'context')`. Nav config format: [ROUTING_NAVIGATION.md](ROUTING_NAVIGATION.md#navigation).

### UserMenu

Avatar with initials fallback, name, and email (or "Spoofing"). Actions: Settings, Log out, and — for superadmins or while spoofing, when `showSpoofControls` — a spoof email field with Spoof / Exit.

### Header and Page

`Header` shows the mobile menu button, `Breadcrumbs` (from the matched nav chain), and `ShareButton` outside the public context.

`Page` is the standard page body: `title`, `description?`, `actions?`, `children`.

```typescript
<Page title="Tokens" description="API keys for this context" actions={<Button>Create</Button>}>
  <Table … />
</Page>
```

### Overlays and Panels

- **Modal** - `open` (or `isOpen`), `onClose`, `title?`, `size: 'small' | 'large'`, `dismissOnBackdrop` (default true). Closes on Escape. During an active flow the close button becomes the flow's next-step label (see [FLOWS.md](../FLOWS.md)).
- **ResponsiveDrawer** - `open`, `onClose`, `title?`, `breakpoint` (default `md`). Right-side drawer at or above the breakpoint, `Modal` below it. **Recommended for detail views.**
- **DetailPanel** - `header?`, `children`, `split?`.
- **MasterDetailLayout** - `master?`, `detail`.
- **FullscreenLayout** - Used by the `_fullscreen` route layout; a back button over full-width content.

| Component | Desktop | Mobile | Best For |
|-----------|---------|--------|----------|
| **ResponsiveDrawer** | Side drawer | Modal | Detail views, user profiles, settings panels |
| **Modal** | Centered modal | Centered modal | Forms, confirmations, focused actions |

---

## Theme System

Multi-tier theming with automatic shade generation and dark mode. Space white-labeling has the CSS and hook in place but is not wired to data yet.

### Architecture

**Three-tier CSS variable system** (`packages/shared/styles/theme.css`):

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

Same pattern for secondary, tertiary, quaternary and accent. **Browser support:** Chrome 111+, Firefox 113+, Safari 16.2+.

### Hooks

**Location:** `packages/ui/src/hooks/`

- **`useThemePersistence()`** - Loads `localStorage.theme` into `ui.theme` on mount and saves changes back.
- **`useDarkMode(theme)`** - `'light'` removes `.dark` from `<html>`, `'dark'` adds it, `'system'` reads `prefers-color-scheme` when the theme changes.
- **`useSpaceTheme(spaceTheme)`** - Sets `--space-{key}` CSS properties for each non-empty key; wraps `logo`, `logoDark`, `favicon` in `url()`; clears the previous keys on change or `null`.
- **`useLanguage()`** - Sets `document.documentElement.lang` from the browser language.

### ThemeToggle

**Location:** `packages/ui/src/components/primitives/ThemeToggle.tsx`

Light / dark / system button group bound to `ui.theme`. Shown by `ProfileFormCard` when `showThemeToggle` is set.

### Types

**Location:** `packages/ui/src/types/`

- `SpaceTheme` - the whole object may be `null`; every property is optional: `primary`, `primary1`–`primary4`, `primaryForeground`, the same for `secondary`, `tertiary`, `quaternary`, `accent`, plus `logo`, `logoDark`, `favicon`. Colors are HSL without the wrapper: `"262 80% 46%"`.
- `AppTheme` - the complete platform theme (all properties required).

### Usage in Root Component

```typescript
// apps/{web,admin,superadmin}/app/routes/__root.tsx
const RootComponent = () => {
  const theme = useAppStore((state) => state.ui.theme);

  useRegisterNavigation(navConfig);
  usePageMeta();
  useLanguage();
  useThemePersistence();
  useApiWebsocket();
  useDarkMode(theme);

  return (
    <>
      <Toaster />
      <FlowBanner />
      <Outlet />
    </>
  );
};
```

### White-Labeling

`Space` has `primaryColor` and `logoUrl` columns, and `useSpaceTheme` applies a `SpaceTheme`, but no app calls `useSpaceTheme` yet. Wiring it means passing the page space's theme in `__root.tsx`; shades 1–4 then come from `color-mix()`. Tracked in `tickets/FEAT-007-white-labeling.md`.

### Testing

```bash
cd packages/ui && bun test
```

- `useDarkMode.test.ts` - Dark class toggling for light/dark/system
- `useSpaceTheme.test.ts` - CSS variable setting, URL wrapping, clearing
- `ThemeToggle.test.tsx` - Theme option rendering and selection

## Key Files

- `packages/ui/src/components/layout/` — AppShell, AppIdentity, ContextSelector, Sidebar, UserMenu, Header, Breadcrumbs, Page, Modal, ResponsiveDrawer, DetailPanel, MasterDetailLayout, FullscreenLayout
- `packages/shared/styles/theme.css`
- `packages/ui/src/hooks/{useThemePersistence,useDarkMode,useSpaceTheme,useLanguage}.ts`
- `packages/ui/src/types/{SpaceTheme,AppTheme}.ts`
