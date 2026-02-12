# Claude Development Guide

**Template** - Monorepo with Bun, Hono, Prisma 7, React, Tailwind.

## Before Starting Any Task

**Identify what you're touching and read the relevant docs.** Most tasks touch multiple areas - read all that apply.

Examples:
- Adding an endpoint → API_ROUTES + DATABASE + possibly HOOKS, PERMISSIONS
- Batch operations → BATCH + API_ROUTES + CONTEXT
- Schema change → DATABASE + HOOKS + TESTING
- Background job → JOBS + possibly REDIS, LOGGING
- Building a data table → FRONTEND (DataTables) + API_ROUTES

## MANDATORY: Pattern Discovery Before Implementation

**YOU MUST COMPLETE THIS CHECKLIST BEFORE WRITING ANY NEW CODE:**

1. **Find 2-3 Similar Existing Modules**
   - Adding authProvider? Read: token, webhookSubscription, organizationUser modules
   - Adding a controller? Read: 3 existing controllers in similar modules
   - Adding middleware? Read: existing middleware in `/middleware/validations/`

2. **Extract and Document Patterns** - Create a list:
   ```
   Patterns observed:
   - Functions: export const fn = () => {} (arrow functions)
   - Types: OrganizationId not string (typed IDs from @template/db)
   - DB access: const db = c.get('db') (from context, not imported)
   - Permissions: validatePermission('own') middleware (not manual checks)
   - Error handling: getResource() handles 404 (no manual null checks)
   - Organization context: getActor(c).organization (not c.get('organization'))
   ```

3. **Ask User to Confirm**
   - List patterns you found
   - Ask: "Are these the correct patterns to follow?"
   - **WAIT for confirmation**

4. **ONLY THEN Start Implementation**

**Why this matters:**
- Saves hours of rework
- Maintains codebase consistency
- Respects existing architecture decisions
- Prevents code review rejection

**If you skip this checklist, your code WILL be rejected.**

### Pattern Discovery for Tests

**Before Writing Tests:**

1. **Check for Existing Factory**
   - Look in `/packages/db/src/test/factories/`
   - If factory exists, use it with minimal overrides
   - If not, create factory first following existing patterns

2. **Factory Usage Patterns**
   ```
   ✅ Use: createModel({ field: value })
   ❌ Avoid: db.model.create({ data: { ...allFields } })

   ✅ Auto-inferred dependencies (no explicit dependencies object)
   ❌ Manually specifying organizationId, userId, etc.

   ✅ Override only what's needed for the test
   ❌ Specifying all required fields manually
   ```

3. **Creating New Factories**
   - Follow pattern from existing factories (tokenFactory, organizationFactory)
   - Use faker for realistic test data
   - Only add `dependencies` object for composite FKs or custom behavior
   - Export both `buildModel` and `createModel`
   - Add to `/packages/db/src/test/factories/index.ts`

## Categories

### Implementation

| Category | Doc | When to Read |
|----------|-----|--------------|
| **API Routes** | [API_ROUTES.md](docs/claude/API_ROUTES.md) | Adding endpoints, controllers, route templates |
| **Authentication** | [AUTHENTICATION.md](docs/claude/AUTHENTICATION.md) | Frontend auth: hooks, login/signup, OAuth, navigation |
| **Auth (Backend)** | [AUTH.md](docs/claude/AUTH.md) | BetterAuth, tokens, session vs token auth |
| **Batch API** | [BATCH.md](docs/claude/BATCH.md) | Multi-request operations, transactions, interpolation |
| **Communications** | [COMMUNICATIONS.md](docs/claude/COMMUNICATIONS.md) | Email, notifications (stub) |
| **Context** | [CONTEXT.md](docs/claude/CONTEXT.md) | Request context, AppEnv, getters, scopes |
| **Database** | [DATABASE.md](docs/claude/DATABASE.md) | Schema changes, Prisma patterns, model utilities |
| **Encryption** | [ENCRYPTION.md](docs/claude/ENCRYPTION.md) | Field encryption, key rotation, registry pattern |
| **Hooks** | [HOOKS.md](docs/claude/HOOKS.md) | Mutation lifecycle, validation, webhooks, cache |
| **Jobs** | [JOBS.md](docs/claude/JOBS.md) | Background jobs, crons, BullMQ |
| **Logging** | [LOGGING.md](docs/claude/LOGGING.md) | Consola, scopes, OpenTelemetry, Sentry |
| **Permissions** | [PERMISSIONS.md](docs/claude/PERMISSIONS.md) | Roles, permix, entitlements, validation |
| **Redis** | [REDIS.md](docs/claude/REDIS.md) | Connections, namespaces, caching, testing |
| **Testing** | [TESTING.md](docs/claude/TESTING.md) | Writing tests, factories, test utilities |

### Project Structure

| Category | Doc | When to Read |
|----------|-----|--------------|
| **Architecture** | [ARCHITECTURE.md](docs/claude/ARCHITECTURE.md) | High-level overview, request/data flow |
| **Apps** | [APPS.md](docs/claude/APPS.md) | Web vs Admin vs Superadmin - when to use each |
| **Frontend** | [FRONTEND.md](docs/claude/FRONTEND.md) | React apps, routing, state, DataTables, components, hooks |
| **Monorepo** | [MONOREPO.md](docs/claude/MONOREPO.md) | Workspaces, where to find things |
| **Naming** | [NAMING.md](docs/claude/NAMING.md) | File/function naming, FE/BE conventions |
| **Style** | [STYLE.md](docs/claude/STYLE.md) | Code conventions, imports |
| **Dependencies** | [DEPENDENCIES.md](docs/claude/DEPENDENCIES.md) | Packages, optional integrations |

### Operations

| Category | Doc | When to Read |
|----------|-----|--------------|
| **Setup** | [SETUP.md](docs/claude/SETUP.md) | Prerequisites, initial setup, forking |
| **Init Script** | [INIT_SCRIPT.md](docs/claude/INIT_SCRIPT.md) | Automated initialization, rename, secrets, cloud setup |
| **Developer** | [DEVELOPER.md](docs/claude/DEVELOPER.md) | Daily workflow, commands, debugging |
| **Turborepo** | [TURBOREPO.md](docs/claude/TURBOREPO.md) | Task orchestration, watch mode, caching, naming conventions |
| **Docker** | [DOCKER.md](docs/claude/DOCKER.md) | Local Postgres/Redis, docker-compose |
| **Scripts** | [SCRIPTS.md](docs/claude/SCRIPTS.md) | Commands, script locations |
| **Environments** | [ENVIRONMENTS.md](docs/claude/ENVIRONMENTS.md) | Env vars, Doppler, with-env composition |
| **CI/CD** | [CICD.md](docs/claude/CICD.md) | Pipelines, deployment (stub) |
| **Documentation** | [DOCUMENTATION.md](docs/claude/DOCUMENTATION.md) | Doc workflow, RAW_NOTES → sorted docs |

### Incomplete Features

| Category | Doc | Status |
|----------|-----|--------|
| **App Events** | [APP_EVENTS.md](docs/claude/APP_EVENTS.md) | Feature incomplete |

## Quick Reference

**Development:**
```bash
bun run local                                # All services with Turborepo watching
turbo watch local#api                        # Just API with hot reload
turbo watch local:worker#api                 # Just worker with hot reload
bun run with prod api turbo watch local#api  # API with prod env + turbo watching
```

**Production:**
```bash
bun run start:api                            # Start API server
bun run start:worker                         # Start background worker
```

**Database:**
```bash
cd packages/db && bun run db:generate        # Generate Prisma client + Zod schemas
bun run db:push                              # Push schema to database
bun run db:seed                              # Seed database
```

**Testing:**
```bash
cd apps/api && bun test                      # Run API tests
bun run test                                 # Run all tests
```

**Turborepo Conventions:**
- Tasks in `turbo.json`: Match script names → `local`, `local:worker`, `build`
- Package scripts: Use `:` delimiter → `local`, `local:worker`, `start:worker`
- Filtering: `turbo watch <task>#<package>` → `turbo watch local#api`
- Env composition: `bun run with <env> <app> turbo watch <task>` → `bun run with prod api turbo watch local#api`

## Path Aliases & Import Rules

**Path Aliases:**
- `#/` - Internal imports (same app/package)
- `@template/*` - Cross-package imports

**Import Rules:**
- ✅ **Always use absolute imports** - Never use relative imports (`../`, `./`) except in barrel files (`index.ts`)
- ✅ Use `@template/package` for cross-package imports
- ✅ Use `#/module/file` for same-package imports
- ❌ Never use `./sibling.ts` or `../parent/file.ts`

**Example:**
```typescript
// ❌ Wrong - relative imports
import { helper } from './utils/helper';
import { types } from '../types';

// ✅ Correct - absolute imports
import { helper } from '@template/db/utils/helper';
import { types } from '@template/db/types';

// ✅ Exception - barrel files only
// In packages/db/src/index.ts:
export * from './lib/encryption/types';
export * from './lib/encryption/helpers';
```

## Tickets

Task tracking with Mermaid kanban boards and markdown tickets. See [tickets/README.md](tickets/README.md) for:
- Creating and managing tickets
- Kanban board workflow
- Ticket templates and categories
- Individual assignee boards

## AI Workspace

Write detailed investigation outputs, reports, and analysis to `/tmp/AI_WORKSPACE/`. This keeps verbose outputs out of the conversation while preserving them for review.

Structure:
- Single report → `/tmp/AI_WORKSPACE/REPORT_NAME.md`
- Multiple related reports → `/tmp/AI_WORKSPACE/task-name/REPORT_1.md`

Examples:
- Doc alignment → `/tmp/AI_WORKSPACE/doc-review/CONTEXT.md`, `/tmp/AI_WORKSPACE/doc-review/HOOKS.md`
- Codebase analysis → `/tmp/AI_WORKSPACE/AUTH_FLOW_ANALYSIS.md`
- Migration plans → `/tmp/AI_WORKSPACE/MIGRATION_PLAN.md`

## Reference Repos

- `~/UserEvidenceZealot/repositories/Zealot-Monorepo`
- `~/Carde.io/organized-play-api`
