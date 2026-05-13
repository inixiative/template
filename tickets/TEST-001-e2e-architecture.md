# TEST-001: E2E Test Architecture

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-05-05
**Updated**: 2026-05-05

---

## Overview

Define the E2E testing architecture. Based on a review of an E2E infrastructure PR in a production monorepo (Zealot PR #587 — Playwright, 77 tests, 19 files, 3-stage CI pipeline), this captures what worked, what didn't, and the target design.

The core lesson: **use what already exists** (factories, lodash, framework assertions) and avoid abstraction layers that reimplement them with weaker types.

## What Worked

These patterns are proven and should be adopted:

- **Playwright fixtures** — compose seed data + auth injection + authenticated Page per scenario. Tests declare what they need, fixtures handle setup/teardown.
- **Auth injection** — generate JWT in test process, inject into localStorage before navigation. Avoids real IdP dependency.
- **Browser-level network stubs** — `page.route()` to block/mock third-party scripts (analytics, Auth0, Google Places). Correct layer for browser-originated requests. Not replaceable by server-side VCR.
- **CI sharding** — build once, run N parallel shards, merge report. Scales by adding shards to the matrix.
- **Preset lookup tables** — static `Record<string, PresetConfig>` mapping scenario types to their seed config.

## What Didn't Work

These patterns added maintenance burden without solving real problems:

| Pattern | Problem | Replace with |
|---|---|---|
| Fluent seed builder (337 lines) | Reimplements factory dependency resolution that already exists. Loses type safety (`Record<string, unknown>` everywhere). Can't create multiple entities of same type. | Direct factory calls — factories auto-resolve dependencies recursively |
| Custom `deepEqual` (44 lines) | Reimplements lodash's `isEqual`, which is already installed | `lodash/isEqual` or framework `expect().toEqual()` |
| Custom `expectRecord` / `expectChange` wrappers | Uses `(db as any)[model]` — throws away all ORM type safety for a marginal syntax improvement | Inline ORM query + `expect()` (2-4 lines) |
| Fluent scenario builder (488 lines) | 20 chainable methods to construct a plain config object | Object literals or a `Record<string, ScenarioConfig>` lookup |
| Per-file navigation helpers | One file per `page.goto()` call | Single route registry (see below) |
| Re-exported `expect` from fixture factories | `expect` is always the same Playwright `expect` — never customized per fixture | Import `expect` directly from Playwright |

## Target Architecture

### File Structure

```
packages/e2e/
├── src/
│   ├── config.ts              # Playwright config (timeouts, reporters, servers)
│   ├── auth/                  # JWT generation + localStorage injection
│   ├── fixtures/              # Playwright fixtures (one per scenario type)
│   ├── pages.ts               # Single route registry
│   ├── stubs/                 # Browser-level third-party stubs
│   └── helpers/               # UI interaction helpers (file upload, date picker, select, toast)
└── tests/
    ├── admin/
    └── advocate/
```

No `seed/` directory. The ORM factory layer IS the seed layer.

### Route Registry

One file, all routes, autocomplete-friendly:

```ts
// pages.ts
export const pages = {
  admin: {
    dashboard: '/',
    login: '/login',
    missionEdit: (uuid: string) => `/missions/${uuid}/edit`,
    community: '/community/members',
    rewards: '/rewards',
  },
  portal: {
    home: '/',
    missions: '/missions',
    mission: (id: string) => `/missions/${id}`,
    profile: '/profile',
    rewards: '/rewards',
  },
} as const;
```

One place to update when routes change. Replaces N helper files.

### Data Seeding

Use factories directly. No wrapper layer.

```ts
// Factories auto-resolve the dependency chain:
const { entity: mission } = await createMission({ preset: 'live' });
// ^ org, config, missionType all created automatically

// Only call multiple factories when you need handles to intermediate entities:
const { entity: org, context } = await createOrg();
const { entity: user } = await createUser({ email }, context);
const { entity: mission } = await createMission({ preset: 'live' }, context);
```

### Assertions

Use framework built-ins. No custom wrappers.

```ts
// DB verification after user action
const record = await db.submission.findFirst({
  where: { missionId: mission.id, userId: user.id },
});
expect(record).toBeTruthy();
expect(record!.status).toBe('pending');
```

## Tasks

### Phase 1: Foundation

- [ ] Set up Playwright config (projects for each app, web server commands, reporter config)
- [ ] Build base fixture (seed org + users, inject auth, expose authenticated pages)
- [ ] Build route registry (`pages.ts`)
- [ ] Build third-party stubs (analytics, IdP, external APIs)
- [ ] Build scenario-specific fixtures extending base (compose factories + auth per scenario)

### Phase 2: DB Isolation

- [ ] One database per Playwright worker (map `workerInfo.workerIndex` → `DATABASE_URL`)
- [ ] CI: each shard gets its own database
- [ ] Local: template DB cloned per worker on startup
- [ ] Enable `workers: 4+` (blocked until isolation is in place)

### Phase 3: CI Pipeline

- [ ] Build stage: compile apps + generate ORM client once, upload artifact
- [ ] Test stage: N parallel shards download artifact, run `--shard=K/N`
- [ ] Report stage: merge results, deploy HTML report, comment on PR

### Phase 4: Test Coverage

- [ ] Auth flows (login, signup, SSO, token expiry)
- [ ] Core CRUD flows per domain
- [ ] Negative cases (validation errors, permission denials, expired/draft states)
- [ ] Edge cases (budget exhaustion, concurrent submissions)

## Anti-Patterns to Enforce

- **No builder wrappers around factories** — factories auto-resolve dependencies
- **No custom assertion helpers** — use framework `expect()` + inline ORM queries
- **No reimplementing stdlib** — `deepEqual`, `isEqual`, `debounce` etc. already exist in lodash or the framework
- **No per-file navigation helpers** — use the route registry
- **No aliased `expect` imports** — one `expect`, imported from the test framework
- **No `(db as any)[model]`** — always use typed ORM access

## Definition of Done

- [ ] E2E suite runs locally with `workers: 4+` and isolated DBs
- [ ] CI pipeline: build → shard → report, with per-shard DB isolation
- [ ] Core user flows covered (auth, primary CRUD, negative cases)
- [ ] Zero custom wrappers around existing framework/library functionality
- [ ] Route registry is single source of truth for all test navigation

## Related Tickets

- INFRA-003 (CI/CD Pipeline)
- INFRA-006 (Tenant Isolation Test Matrix)
- AUTH-002 (Unified Auth System)

---

_Architecture-first ticket. Lessons extracted from Zealot Monorepo PR #587 review._
