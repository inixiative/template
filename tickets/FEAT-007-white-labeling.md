# FEAT-007: White Labeling

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-04-23

---

## Overview

Enable white-labeling capabilities with custom domains, branding, and dynamic CORS configuration. Includes DNS management hooks and per-space theming.

## Key Components

### DNS Hooks
- **Custom domain mapping**: Space/Org → custom domain
- **DNS verification**: TXT record validation
- **SSL provisioning**: Automatic certificate generation
- **Domain validation**: Prevent conflicts and typos

#### Self-Service DNS Configuration
**Requirement**: Users should be able to configure custom domains through the UI without admin intervention.

Key capabilities needed:
- Add/remove custom domains per space/organization
- Step-by-step verification instructions (what DNS records to create)
- Real-time verification status checks
- Auto-provisioning of SSL certificates after verification
- Domain management dashboard (list, status, remove)

**Technical Requirements**:
- **Vercel Integration**: Management client access to Vercel API from backend
  - Add/remove domains via API
  - Check verification status
  - Trigger SSL certificate provisioning
  - Handle domain configuration errors
- **Environment Variables**: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`

### CORS Hooks
- **Dynamic CORS**: Allow origins based on custom domains
- **Database-driven**: Store allowed origins per space/org
- **Wildcard support**: `*.customdomain.com`
- **Security**: Prevent CORS bypass attempts

### Theming
- **Per-space themes**: Logo, colors, fonts (TODO.md line 122)
- **CSS variables**: Dynamic theme injection
- **Preview**: Live theme preview in admin
- **Fallback**: Default theme if none configured

#### Component-Level Semantic Tokens (Proposed)

Our current three-tier CSS variable system (`--app-*` → `--space-*` → `--primary`) handles color indirection and tenant overrides well. The next step is adding **component-level semantic tokens** following the pattern described in CloudProduce's design system writeup (Philipp Hertel, 2026-04-14).

**What we have today:**
Components reference generic tokens (`--primary`, `--card`, `--muted`) and decide their own state styling via Tailwind classes and CVA variants. Hover, disabled, and active states are scattered across component code.

**What the proposal adds:**
A semantic token layer where skins declare per-component, per-state mappings:

```css
/* Inside a skin class or :root */
--primaryButtonFillDefault:  var(--primary);
--primaryButtonFillHover:    var(--primary-3);
--primaryButtonFillDisabled: var(--muted);
--primaryButtonLabelDefault: var(--primary-foreground);
--inputStrokeActive:         var(--ring);
--inputStrokeError:          var(--error);
--cardBackgroundLight:       var(--card);
```

Components then reference only these semantic tokens — they never pick their own state colors. The naming convention is `--<component><Property><State>` (e.g., `--primaryButtonFillHover`).

**Why this matters for white-labeling:**
- Tenant skins can control not just "what's primary" but "what does a disabled button look like in my brand"
- Every new component is automatically themeable — authors don't think about it
- Changing how dark mode treats a specific state is one line in the skin, not a grep across components

**What's already in place:**
- Three-tier variable indirection (works as-is)
- `color-mix()` shade generation (works as-is)
- `.dark` class toggle with mode-specific values (works as-is)
- `useSpaceTheme` hook for dynamic tenant overrides (works as-is)

**What needs to be built:**
- [ ] Define the semantic token vocabulary (inventory all component states: Default, Hover, Pressed, Disabled, Active, Error)
- [ ] Add semantic token declarations to `theme.css` (light + dark)
- [ ] Update `useSpaceTheme` to support space-level semantic token overrides
- [ ] Migrate core components (Button, Input, Card) to reference semantic tokens instead of generic tokens
- [ ] Enforce "no generic tokens in component code" via lint or review convention

### Branding
- **Logo upload**: Space/Org logos
- **Favicon**: Custom favicons per domain
- **Email branding**: Custom email templates
- **Legal pages**: Custom ToS, Privacy Policy

## Reference

- User note: "Hooks into DNS and CORS systems"
- TODO.md: Lines 122-126 (White-label/theming)

## Related Tickets

- **Blocked by**: INFRA-001 (DNS setup in init script)
- **Blocks**: None

---

## Comments

### 2026-04-23 — Design System Writeup Review (Aron)

Reviewed Philipp Hertel's CloudProduce engineering writeup on their two-level CSS variable design system. Compared it against our existing `theme.css` implementation.

**Finding:** Our three-tier system (`--app-*` → `--space-*` → active tokens) already follows the core pattern — CSS variable indirection, class-based dark mode toggle, no React re-renders, `color-mix()` shade generation. The architecture is sound.

**Gap:** We stop at generic design tokens (`--primary`, `--card`, `--muted`). The writeup advocates an additional component-level semantic token layer (`--primaryButtonFillHover`, `--inputStrokeError`, etc.) where skins own the mapping from meaning to value, and components are completely ignorant of the palette.

**Recommendation:** When this ticket is prioritized, start by inventorying component states and defining the semantic token naming convention (`--<component><Property><State>`), then migrate Button/Input/Card as a proof of concept before rolling out to the full component library.

Reference: `design-system-writeup.pdf` (CloudProduce, 2026-04-14)
