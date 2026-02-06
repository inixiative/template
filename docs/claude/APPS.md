# App Structure

This template provides three frontend applications that work together as a multi-tenant SaaS platform.

## The Three Apps

### Web - Consumer/End-User Interface
- **Who**: End users, consumers, participants
- **Purpose**: Browse, participate, consume content
- **Context**: Personal/Organization/Space (as a participant)
- **Context Locking**: Can be locked to specific space (white-label subdomains)
- **Examples**:
  - TCG: Players browsing events at gamestorexyz.tcg.com (locked to store)
  - Inixiative: Investors browsing deals across marketplaces
  - Livestock: Buyers browsing cattle listings

### Admin - Provider/Operator Interface
- **Who**: Space operators, marketplace managers, content providers
- **Purpose**: Manage spaces, content, and operations
- **Context**: Personal/Organization/Space (as an operator)
- **Examples**:
  - TCG: Game store owners managing their events and store
  - Inixiative: Marketplace operators managing deals and listings
  - Livestock: Ranchers managing their cattle inventory

### Superadmin - Platform Operations
- **Who**: Platform team (you)
- **Purpose**: Manage entire platform, system health, all customers
- **Context**: None (platform-level view, no context switching)
- **Examples**:
  - View all customers across platform
  - System metrics and health monitoring
  - Platform-level configuration

## Key Insight

**All three apps share the same multi-tenant architecture:**
- Web and Admin both use ContextSelector (Personal/Organization/Space)
- Same permission system (Permix/ReBAC)
- Different navigation configs and features based on role

**The difference is perspective, not structure:**
- Web = consuming/participating in spaces
- Admin = operating/managing spaces
- Superadmin = managing the platform itself

## Frontend Architecture Overview

All three apps share common frontend infrastructure. See [FRONTEND.md](FRONTEND.md) for comprehensive details.

**Shared Stack:**
- **Router**: TanStack Router v2 with file-based routing and guards
- **State**: Zustand with 5 slices (Auth, Permissions, Tenant, Api, UI)
- **Auth**: BetterAuth + JWT with stateless token validation
- **Permissions**: Permix/ReBAC integrated into frontend state
- **UI**: Shared component library (@template/ui) + app-specific components (@template/shared)
- **API**: OpenAPI-generated client with optimistic mutations

**App-Specific Differences:**
- Navigation configs (different routes/menus per app)
- Context selector behavior (available vs locked)
- Permission-gated features
- Layout variations (Superadmin has simplified shell)

## Context Switching

Web and Admin apps support **dynamic context switching** via the ContextSelector component.

**Three Context Types:**

1. **Personal** - User acting as themselves
   - Access: Personal tokens, profile, organizations they belong to
   - Use case: Individual user actions

2. **Organization** - User acting on behalf of an organization
   - Access: Organization tokens, settings, spaces, members
   - Use case: Managing organization-level resources

3. **Space** - User acting within a specific space
   - Access: Space tokens, customers, content, settings
   - Use case: Managing space-specific operations

**Context Hierarchy:**
```
User (always present)
└── Organizations (via organizationUsers)
    └── Spaces (via organization.spaces)
```

**State Management:**
- Stored in Zustand tenant slice: `selectedOrg`, `selectedSpace`
- Automatically updates permission context when changed
- API client includes context in request headers
- Permission checks use current context to evaluate access

**Navigation Behavior:**
- Routes can interpolate context: `/organizations/:orgSlug/settings`
- Permission-gated nav items hide/show based on current context
- Guards prevent access to routes requiring unavailable context

## White-Label Mode

The **Web** app supports context locking for white-label subdomains.

**How It Works:**

1. **Subdomain Detection**: App detects subdomain on load (e.g., `gamestorexyz.tcg.com`)
2. **Space Lookup**: Fetches space by subdomain slug via API
3. **Context Lock**: Sets `selectedSpace` and marks it as locked
4. **UI Changes**:
   - ContextSelector shows current space but is disabled
   - No ability to switch contexts
   - Branding can be customized per-space
   - Navigation reflects space-specific content only

**Use Cases:**
- TCG stores with custom domains: `storename.platform.com`
- Marketplace vendor pages: `vendor.marketplace.com`
- Event-specific landing pages: `event2024.platform.com`

**Implementation:**
```typescript
// On app load, check for subdomain
const subdomain = extractSubdomain(window.location.hostname);
if (subdomain) {
  const space = await api.getSpaceBySubdomain(subdomain);
  tenantStore.setSelectedSpace(space, { locked: true });
}
```

**Admin App Note:**
Admin does NOT support context locking - operators need full context switching to manage multiple spaces.

## Real-World Example: TCG Platform

**GameStoreXYZ** is an organization with a space.

**Admin Flow:**
- Store owner logs into **Admin**
- Switches context to "GameStoreXYZ Space"
- Manages events, inventory, registrations
- Nav: Manage Events, Manage Store, View Analytics

**Web Flow (White-label):**
- Player visits gamestorexyz.tcg.com (**Web**)
- Context is **locked** to "GameStoreXYZ Space" (white label subdomain)
- ContextSelector shows current space but can't switch
- Browses events, registers for tournament
- Nav: Browse Events, My Registrations, Leaderboard

**Web Flow (Platform):**
- User visits tcg.com (**Web**)
- Full ContextSelector available (if they own stores)
- Can switch between stores they participate in/own
- Browses all events across platform

**Superadmin Flow:**
- Platform team logs into **Superadmin**
- No context switching (platform-level)
- Views all stores, all events, system health
- Nav: All Organizations, System Metrics, Support Queue

## Implementation Notes

**Shared Infrastructure:**
- Web and Admin share AppShell component (with ContextSelector)
- Superadmin uses simplified AppShell (no ContextSelector, minimal nav)
- Auth guards and public pages are shared across all three apps
- Nav configs differ based on app purpose (see navigation section in [FRONTEND.md](FRONTEND.md))

**State & Routing:**
- All apps use same Zustand store structure (5 slices)
- TanStack Router with guards (`requireAuth`, `requireGuest`)
- Permission checks integrated at route and component level
- Context switching logic shared between Web/Admin

**Component Organization:**
- `@template/shared` - Shared app-level components (modals, layouts, guards)
- `@template/ui` - Base UI primitives (Button, Input, Table, etc.)
- App-specific components in `apps/{web,admin,superadmin}/app/components/`

**For comprehensive frontend details**, see [FRONTEND.md](FRONTEND.md):
- Complete routing guide with guards and navigation
- Zustand store architecture and slice details
- Authentication and permission integration
- Layout system and component hierarchy
- Hooks and patterns
- Context switching implementation
