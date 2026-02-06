# TODO

## In Progress

- [x] Token permission tests - comprehensive tests for OrganizationUser and SpaceUser tokens
- [x] setupSpacePermissions - space-level permission setup mirroring org pattern

## Type Errors

- [x] Implicit `any` types in webhooks/sendWebhook/redactUser
- [x] Redis `EX` typing in auth.ts
- [x] adminCacheClear route/controller body schema mismatch
- [ ] packages/db circular type refs (pre-existing, low priority)

## Low Priority

- [ ] Inquiry module - needs fake polymorphism refactor (sourceId/targetId → sourceUserId/etc)

## Missing Deps (install when needed)

- [ ] `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` - S3 file uploads
- [ ] `stripe` - payments

## Future Work

### Audit/Activity Logs

Schema design for tracking all mutations:

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("uuidv7()"))
  createdAt   DateTime @default(now())

  // Who
  userId      String?
  tokenId     String?
  ipAddress   String?
  userAgent   String?

  // What
  action      String   // 'create' | 'update' | 'delete'
  model       String   // 'User', 'Organization', etc.
  recordId    String

  // Changes
  before      Json?    // Previous state (for update/delete)
  after       Json?    // New state (for create/update)
  changes     Json?    // Diff of changed fields

  @@index([userId])
  @@index([model, recordId])
  @@index([createdAt])
}
```

Implementation:
- Hook into mutation lifecycle (after hook)
- Filter sensitive fields from logs
- Consider async write to avoid latency
- Retention policy (30/90 days?)

### Mutation Lifecycle

- [ ] Transaction timeout estimation for `updateManyAndReturn`
- [ ] Handle Prisma comparative operators (increment, decrement) in rules validation
- [ ] Batching for large recordsets in hooks

### Features

- [ ] Feature flags system
  - [ ] Backend: Feature flag model with polymorphic ownership
    - Uses `ownerModel` pattern: 'Platform' | 'Organization' | 'Space'
    - Polymorphic fields: `organizationId`, `spaceId` (set based on ownerModel)
    - Evaluation hierarchy: Space → Organization → Platform (most specific wins)
    - JSON rule targeting (evaluate rules against context)
    - Manual segmentation (allowlist/blocklist of IDs)
    - Rollout percentage (gradual rollouts)
    - Permissions: Platform (superadmin) | Organization (org admin) | Space (space admin)
  - [ ] Backend: Feature flag API endpoints (CRUD + evaluation)
  - [ ] Backend: Redis caching for flag evaluation
    - Cache evaluated flags per context (user+org+space)
    - Invalidate on flag changes
    - TTL for gradual rollout consistency
  - [ ] Frontend: Feature flag context/hooks (`useFeatureFlag`, `isEnabled`)
  - [ ] Frontend: Real-time updates via WebSocket
    - Subscribe to flag changes on mount
    - Update flag state when flags change (no page refresh needed)
    - Broadcast flag changes from admin UI to all connected clients
  - [ ] Admin UI: Feature flag management with rule builder
    - Org admins manage organization-scoped flags
    - Space admins manage space-scoped flags
    - A/B testing and pilot group templates
  - [ ] Superadmin UI: Platform-wide feature flags + analytics
  - [ ] Integration with conditional component props
  - [ ] Flag change webhooks/events (external systems)
- [ ] Wire up WebSocket event handlers
- [ ] Optional modules system (opt-in features)
- [ ] I18n package
- [ ] Mermaid diagram support in markdown

### Frontend

- [ ] Component library
  - [ ] Test coverage for conditional props (`show`, `disabled`, `disabledText`)
  - [ ] Storybook or similar component documentation
  - [ ] Additional UI primitives (Badge, Tabs, Select, Checkbox, Radio, Switch, Slider, etc.)
  - [ ] Form components (FormField, FormError, FormLabel with validation)
  - [x] Responsive Drawer component - should become Dialog on small screens
- [ ] Admin app UI
  - [ ] Organization management pages
  - [ ] Space management pages
  - [ ] User management pages
  - [ ] Analytics/metrics dashboards
  - [ ] Feature flag management UI
- [ ] Superadmin app UI
  - [ ] Platform overview dashboard
  - [ ] All organizations view
  - [ ] System metrics and health
  - [ ] Platform-wide feature flags
  - [ ] Support/inquiry queue
- [ ] White-label/theming
  - [ ] Per-space theme configuration (colors, logo, fonts)
  - [ ] Theme preview in admin
  - [ ] CSS variables for dynamic theming
  - [ ] Custom domain mapping
- [ ] E2E testing
  - [ ] Playwright setup (`tests/e2e/`)
  - [ ] Critical user flows (signup, login, org creation, context switching)
  - [ ] Permission-gated UI tests
- [ ] State management
  - [ ] Query params for FE state (pagination, filters, search)
  - [ ] URL state sync for shareable links

### Database

- [ ] Wire constraint helpers into db lifecycle (local setup + CI/CD) if using them

### Developer Experience

- [x] Password seeding script for test users (hash "asd123!" and insert into Account table)
- [ ] Init script for new forks (`bun run init`) - should configure Doppler
- [ ] Localtunnel helper for webhook testing (ref: Carde)
- [ ] Add Artillery for load testing (`tests/load/`)
- [ ] Turborepo (with Bun) - skip unchanged tests
- [ ] Default orderBy in paginate utility
- [ ] Pen testing setup (consider Autonoma)

### Infrastructure

- [ ] Auto-generated admin UI (Django Admin style)
  - Schema → generated CRUD UI
  - Based on Prisma model definitions
  - Auto forms, lists, filters, search

### Modules to Port

- [ ] Inquiry system - needs polymorphism refactor
- [ ] Notes system
- [ ] Properly implement remaining inquiry features

---

## Notes

### Auth Documentation
- Both BetterAuth strategies use JWT tokens
- "Session" auth = JWT in httpOnly cookies
- "Token" auth = JWT in Authorization header
- Update docs to clarify this

### Optimistic Updates
- ✅ Already implemented in `@template/shared`
- Pattern: Update cache before API call, rollback on error
- Used with TanStack Query invalidation

### Feature Flag Design Concept

```typescript
// Schema - uses polymorphic ownership pattern
model FeatureFlag {
  id              String    @id @default(dbgenerated("uuidv7()"))
  key             String    // 'beta-analytics'
  name            String
  enabled         Boolean   @default(false)

  // Polymorphic ownership (determines who manages + where it applies)
  ownerModel      String    // 'Platform' | 'Organization' | 'Space'
  userId          String?   // Not used for flags (reserved)
  organizationId  String?   // Set if ownerModel='Organization'
  spaceId         String?   // Set if ownerModel='Space'

  // Targeting strategies (all must pass if defined)
  rules       Json?    // JSON Rules Engine expression
  allowlist   Json?    // { orgIds: [], spaceIds: [], userIds: [] }
  blocklist   Json?    // Same structure
  rollout     Int?     // 0-100 percentage

  // Metadata
  description String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([key, ownerModel, organizationId, spaceId])
  @@index([organizationId])
  @@index([spaceId])
}

// ==========================================
// Backend: Redis Caching Strategy
// ==========================================

// Cache key pattern: flag:{ownerModel}:{ownerId}:{key} -> evaluated result
// Examples:
//   flag:Platform:null:beta-analytics -> true/false
//   flag:Organization:org_123:new-dashboard -> true/false
//   flag:Space:space_456:new-leaderboard -> true/false

// On flag evaluation (checks hierarchy: Space -> Org -> Platform):
async function isEnabled(key: string, context: Context): Promise<boolean> {
  const cacheKey = buildCacheKey(key, context);

  // Check Redis first
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === 'true';

  // Evaluate flag hierarchy (most specific first)
  let flag: FeatureFlag | null = null;

  // 1. Check space-scoped flag
  if (context.spaceId) {
    flag = await db.featureFlag.findUnique({
      where: {
        key_ownerModel_organizationId_spaceId: {
          key,
          ownerModel: 'Space',
          organizationId: null,
          spaceId: context.spaceId,
        }
      }
    });
  }

  // 2. Check org-scoped flag
  if (!flag && context.organizationId) {
    flag = await db.featureFlag.findUnique({
      where: {
        key_ownerModel_organizationId_spaceId: {
          key,
          ownerModel: 'Organization',
          organizationId: context.organizationId,
          spaceId: null,
        }
      }
    });
  }

  // 3. Check platform-scoped flag
  if (!flag) {
    flag = await db.featureFlag.findUnique({
      where: {
        key_ownerModel_organizationId_spaceId: {
          key,
          ownerModel: 'Platform',
          organizationId: null,
          spaceId: null,
        }
      }
    });
  }

  if (!flag) return false;

  // Evaluate targeting rules
  const result = evaluateFlagTargeting(flag, context);

  // Cache result (TTL based on rollout % for consistency)
  const ttl = flag.rollout ? 300 : 3600; // 5min if rollout, 1hr if static
  await redis.setex(cacheKey, ttl, result.toString());

  return result;
}

// On flag change (create/update/delete):
async function onFlagChange(flag: FeatureFlag) {
  // Invalidate all cached evaluations for this flag
  await redis.del(`flag:*:*:${flag.key}`);

  // Broadcast to frontend via WebSocket
  io.emit('feature-flag:changed', {
    key: flag.key,
    ownerModel: flag.ownerModel,
    organizationId: flag.organizationId,
    spaceId: flag.spaceId,
  });
}

// ==========================================
// Frontend: Real-time Updates via WebSocket
// ==========================================

// 1. Initial load: Fetch flags from API
const { data: flags } = useQuery({
  queryKey: ['feature-flags', context],
  queryFn: () => api.getFeatureFlags({ organizationId, spaceId }),
});

// 2. Subscribe to real-time updates
useEffect(() => {
  socket.on('feature-flag:changed', (event) => {
    // Refetch flags for this context
    if (matchesContext(event, context)) {
      queryClient.invalidateQueries(['feature-flags']);

      // Optional: Show toast notification
      toast.info(`Feature "${event.key}" has been updated`);
    }
  });

  return () => socket.off('feature-flag:changed');
}, [context]);

// 3. Usage in components (reactively updates on flag change)
<Button show={() => featureFlags.isEnabled('beta-analytics')}>
  View Beta Analytics
</Button>

// When admin toggles flag in UI:
// 1. API updates DB
// 2. API invalidates Redis cache
// 3. API broadcasts WebSocket event
// 4. All connected clients refetch flags
// 5. Components re-render with new flag values (no page refresh!)
```


consider adding a permissions builder to the front end
