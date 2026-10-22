# Scripts & Commands

<!-- toc:start -->

## Contents

- [Script Locations](#script-locations)
  - [scripts/ Structure](#scripts-structure)
- [Development](#development)
- [Database](#database)
- [Testing](#testing)
- [Linting](#linting)
  - [Lint Check Scripts](#lint-check-scripts)
  - [CI Rule Scripts](#ci-rule-scripts)
- [Setup Scripts](#setup-scripts)
- [Deployment Scripts](#deployment-scripts)
- [Docker](#docker)
- [Worktrees](#worktrees)
- [Writing New Scripts](#writing-new-scripts)
- [AI Workspace](#ai-workspace)
  - [Workflow](#workflow)

<!-- toc:end -->


---

## Script Locations

| Directory | Purpose | Committed |
|-----------|---------|-----------|
| `scripts/` | Shared shell scripts, deployment, db ops | Yes |
| `init/` | Interactive infrastructure provisioning TUI (Bun + Ink) | Yes |
| `scripts/setup/` | Project initialization, env sync | Yes |
| `scripts/db/` | Postgres/Redis operations | Yes |
| `scripts/deployment/` | Deploy, env injection | Yes |
| `tmp/` | Temporary files, AI workspace, local experiments | No (.gitignore) |

### scripts/ Structure

```
scripts/
├── setup/
│   ├── check-prereqs.sh    # Verify bun, docker, etc.
│   ├── setup.sh            # Full project setup
│   ├── sync-env.sh         # Sync .env from examples
│   └── init.sh             # Legacy shell bootstrap notes
├── db/
│   ├── dump.sh             # Export database
│   ├── restore.sh          # Import database
│   ├── clone.sh            # Clone remote → local (with webhook cleanup)
│   ├── push-dev.sh         # db:push:dev — worktree-aware, refuses non-local DATABASE_URLs, regenerates the Prisma client after the push
│   ├── release.sh          # Release-time database step
│   ├── pg-init.sh          # Postgres initialization
│   ├── minio-init.sh       # MinIO container entrypoint (creates the four base buckets)
│   ├── minio-provision.sh  # Ensure buckets exist (setup + worktree:create)
│   ├── minio-remove.sh     # Remove buckets, reporting each (worktree:destroy)
│   ├── wait-postgres.sh    # Wait for postgres ready
│   └── wait-redis.sh       # Wait for redis ready
├── deployment/
│   ├── deploy.sh           # Deploy to environment
│   ├── with-env.sh         # Run command with env vars
│   └── wait-for-api.sh     # Health check wait
└── worktree/
    ├── create.sh           # Provision an isolated worktree on a slot (DBs, buckets, env, deps, artifacts)
    ├── destroy.sh          # Tear a worktree down and free its slot
    ├── list.sh             # Worktrees with slot, branch, ports
    ├── ports.sh            # Re-apply this checkout's registry ports to its env files (setup runs it)
    └── lib.sh              # Shared helpers (sourced by the scripts above)

init/
├── index.tsx                    # bun run init entrypoint
├── app.tsx                      # Ink app shell
├── tasks/                       # Provider setup logic
├── views/                       # Task/launch views
└── tests/                       # Fixtures and mocks

Database utilities (packages/db/prisma/):
├── seed.ts                       # Seed script with UUID validation
└── truncateWebhookSubscriptions.ts  # Clear webhooks (local/test only)
```

---

## Development

From root `package.json`:

```bash
# Run all local services (api, web, worker, db)
bun run local

# Run specific services with Turborepo filtering
turbo watch local#api
turbo watch local#web
turbo watch local#admin
turbo watch local#superadmin
turbo watch local:worker#api

# Start database containers
bun run local:db        # docker-compose up -d --wait
```

**Development (from root):**
```bash
bun run local                              # All services with Turborepo watching
turbo watch local#api                      # Just API with hot reload
turbo watch local:worker#api               # Just worker with hot reload
bun run with prod api turbo watch local#api # API with prod env
```

**Production (from root):**
```bash
bun run start:api                          # Start API server
bun run start:worker                       # Start background worker
bun run start:web                          # Start web preview
```

**Direct execution (from apps/api):**
```bash
cd apps/api
bun run local           # bun --hot src/index.ts (API with hot reload)
bun run local:worker    # bun --hot src/jobs/worker.ts (worker with hot reload)
bun run start           # Production API
bun run start:worker    # Production worker
bun run build           # Build to dist/
```

**Note:** Direct execution only watches files within that app. For workspace dependency watching, use Turborepo commands from root.

---

## Database

```bash
# Schema operations (proxied to @template/db)
bun run db:generate          # Generate Prisma client
bun run db:push              # Push schema (dev only)
bun run db:migrate           # Create migration (after launch)
bun run db:deploy            # Apply migrations (after launch; pre-launch prod uses db push, see DATABASE.md)
bun run db:studio            # Open Prisma Studio
bun run db:seed              # Seed database
bun run db:seed --prime      # Include prime dev data

# Database operations (scripts/db/)
bun run db:dump              # Export to file
bun run db:restore           # Import from file
bun run db:clone [env]       # Clone remote → local (auto-truncates webhooks)
bun run db:truncate:webhooks # Clear webhook subscriptions (local/test only)

# Reset (down + up + push + seed)
bun run reset:db
```

---

## Testing

```bash
# Run all workspace tests
bun test                # → bun run '--filter=*' test

# Run specific workspace
bun run --filter=api test
bun run --filter=@template/db test
```

From `apps/api`:

```bash
cd apps/api
bun test                # Uses with-env.sh to inject .env.test
bun test src/modules/user  # Run specific tests
```

---

## Linting

```bash
# Check all (biome)
bun run lint

# Fix all
bun run lint:fix

# Format only
bun run format
```

From `apps/api`:

```bash
cd apps/api
bun run lint            # Check src/ only
bun run lint:fix
```

### Lint Check Scripts

Additional checks run after Biome (used in CI, optional pre-commit):

```bash
# Check import aliases (enforces #/ not ../)
./scripts/lint/check-import-aliases.sh

# Check generated files are up-to-date
./scripts/lint/check-generated-files.sh

# Run all post-Biome checks
./scripts/lint/run-post-biome-checks.sh
```

**check-import-aliases.sh:**
- Scans TypeScript files for relative imports (`../`)
- Fails if any internal imports don't use `#/` alias
- Enforces consistent import style across codebase

**check-generated-files.sh:**
- Verifies Prisma client is up-to-date
- Verifies OpenAPI SDK is up-to-date
- Fails if `db:generate` or `openapi:generate` need to be run

**run-post-biome-checks.sh:**
- Orchestrates all custom checks
- Used in CI pipeline after Biome
- Can be added to pre-commit hooks

### CI Rule Scripts

Additional CI rules live under `scripts/ci/rules` and run alphabetically by filename:

```bash
# Run all CI rules
./scripts/ci/run-ci-rules.sh

# Run CI rule self-tests against rule-violations fixtures
./scripts/ci/run-ci-rules.sh --test

# Individual rules
./scripts/ci/rules/no-jest.sh
./scripts/ci/rules/no-vitest.sh
./scripts/ci/rules/ui-serialized-factories.sh
```

Rule self-test fixtures live at:
- `scripts/ci/rule-violations/<rule>/pass`
- `scripts/ci/rule-violations/<rule>/fail`

Each `pass`/`fail` folder can contain one or more case subfolders (run alphabetically), e.g.:
- `scripts/ci/rule-violations/no-jest/fail/dependency`
- `scripts/ci/rule-violations/no-jest/fail/import`
- `scripts/ci/rule-violations/no-jest/fail/global`

**no-jest.sh:**
- Fails on Jest dependencies in `package.json`
- Fails on Jest imports/global usage in source and tests

**no-vitest.sh:**
- Fails on Vitest dependencies in `package.json`
- Fails on Vitest imports in source and tests

**no-bare-test-app.sh:**
- Fails on `new OpenAPIHono` / `new Hono` in any `*.test.ts(x)`; tests mount routes and middleware through `createTestApp`, so a response carries the production validation hook, error envelope and request context

**doc-freshness.sh:**
- Fails when `docs/claude/**`, `AI/ENTRYPOINT.md`, `FEATURES.md` or `apps/*/CLAUDE.md` names a repo path that doesn't exist, a `path:line` / `path#La-Lb` past the end of the file, a `<doc>.md#<heading>` with no such heading, or a backticked camelCase/PascalCase name that appears nowhere in the code (comments don't count)
- Skips fenced code and sections headed "Under construction" or "Migrations in progress"
- External or illustrative names: `scripts/ci/doc-freshness/allow.txt` (`<doc>\t<value>` scopes one to a doc). References that were stale before the rule: `scripts/ci/doc-freshness/baseline.txt`, reported but not failed; an entry that stops occurring fails until its line is deleted
- Warns, never fails, when the branch changes code whose `@atlas` `@partOf` concept lists docs in `.atlas/concepts.ts` and touches none of them

**Fence rules** (`uuidv7-ids`, `one-middleware-chain`, `no-raw-locks`, `no-db-params`, `bearer-only-auth`) scan the whole tree through `scripts/ci/rules/lib/fence.ts`. Each keeps its data in `scripts/ci/<rule>/`:
- `exempt.txt`: `<key>\t<reason>`, a named, deliberate exception. The reason is required, and an entry that no longer matches fails.
- `baseline.txt`: the violations that predate the rule, written by `bun scripts/ci/rules/lib/<detector>.ts --write-baseline`. Listed violations are reported, not failed, so the rule fences new code at once while the old is burned down. Keys name a violation by content (model, mount path, function and parameter, SQL text), not by line, so a new violation in a listed file fails; an identical repeat is `<key>#2`. An entry that stops occurring fails until its line is deleted, and in a git checkout a line the merge base's baseline lacks fails, so the baseline only shrinks. A rule that takes no exemptions fails on an `exempt.txt`. Template has no baselines; downstream repos start with one.

**uuidv7-ids.sh:**
- Fails on a Prisma model whose primary key is not exactly `id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)` (attribute order free), including a composite `@@id`
- Why: ids are time-ordered, and `paginate()`'s `{ id: desc }` tiebreaker and cursors depend on it

**one-middleware-chain.sh:**
- Fails unless `apps/api/src/routes/api.ts` runs `corsMiddleware → prepareRequest → jwtAuthMiddleware → tokenAuthMiddleware → spoofMiddleware → auditActorMiddleware → apiRateLimit` in order, and every router is mounted after it
- A mount (`.route`, `.get`, `.all`, `.doc31`, …, chained or across lines, or a `.use` on a path with an inline handler) before the chain completes, on `routes` other than `/api`, on `app` other than `/`, or on `app`/`routes`/`apiRouter` from any other file fails unless its full path is in `scripts/ci/one-middleware-chain/exempt.txt` with a reason (template: `/health`, `/bullBoard`, `/test`, `/openapi/docs`, `/api/telemetry/browser`, `/api/internal`, `/api/auth/*`, `/api/unsubscribe`)

**no-raw-locks.sh:**
- Fails on `FOR UPDATE` / `FOR NO KEY UPDATE` in non-test source outside `packages/db/src/client.ts` (`db.findForUpdate`), and on `FOR SHARE` / `FOR KEY SHARE` / `LOCK IN SHARE MODE` anywhere: there is no shared mode ([CONCURRENCY.md § Row Locks](./CONCURRENCY.md#row-locks-dbfindforupdate))
- Reads string and template-literal text only (comments never count); lower-case keywords count only in a string that also says `select`

**no-db-params.sh:**
- Fails on a function or method parameter (signatures in types included) named or destructuring `db`/`txn`/`tx`/`prisma` (or `_db`, …), or whose type mentions `Db`, `PrismaClient`, `TransactionClient` or `typeof db`, outside tests and `packages/db`
- Use the scoped client, `import { db } from '@template/db'`, which resolves to the open `db.txn()` through AsyncLocalStorage. The only code that takes a client is the client itself and json-rules' Prisma planner, which lives outside the app

**bearer-only-auth.sh:**
- Fails, in non-test source under `apps/` and `packages/`, on `cookieCache`, `credentials` set to `'include'`, `withCredentials`, `document.cookie`, any session lookup (a `getSession(...)` or `findSession(...)` call, or a read of the `session` table: `<x>.session.findUnique`, `findUniqueOrThrow`, `findFirst`, `findFirstOrThrow`, `findMany` or `count`), and importing BetterAuth's `bearer` plugin. Takes no exemptions
- Why: API auth is bearer-only and session-free ([AUTH.md](./AUTH.md#overview)). A person presents a JWT; a session exists only inside BetterAuth's `/api/auth/*` handler for the sign-in handshake, and `jwtHandoff` swaps it for a JWT. A cookie path was a second way in, a session lookup is a second way to resolve a person, and the `bearer` plugin turns a session token into a credential

**ui-serialized-factories.sh:**
- For UI tests importing `@template/db/test`, requires `__serialize()` usage
- Fails on `__serialize() as any` casts

---

## Setup Scripts

```bash
# Full project setup
bun run setup           # → scripts/setup/setup.sh

# Sync env files from examples
bun run sync-env        # → scripts/setup/sync-env.sh

# Initialize project (includes Infisical setup)
bun run init            # → init/index.tsx
```

---

## Deployment Scripts

```bash
# Deploy to environment
bun run deploy          # → scripts/deployment/deploy.sh

# Run command with specific environment
bun run with <env> <app> <command>

# Examples:
bun run with local api bun run local
bun run with test api bun test
bun run with prod api bun run start
```

The `with-env.sh` script:
1. For cloud envs (dev/staging/prod): Uses Infisical if configured, else .env files
2. For local/test envs: Loads from .env files
3. Executes the command with those vars

---

## Docker

```bash
# Start Postgres + Redis
bun run local:db        # docker-compose up -d --wait
bun run start:db        # Same as local:db

# Stop containers
bun run stop:db         # docker-compose down

# Full reset
bun run reset:db        # down + up + push + seed
```

---

## Worktrees

```bash
bun run worktree:create <base-branch> <new-branch>             # Fork a new branch (fails fast if Docker/Postgres is down)
bun run worktree:create <existing-branch>                      # Attach an existing branch
bun run worktree:create <base-branch> <new-branch> --skip-db   # Docs/skills only: no databases, buckets, or schema push; Docker not required
bun run worktree:list
bun run worktree:ports [<name>]                                # Re-apply registry ports to this checkout's (or .worktrees/<name>'s) env files
bun run worktree:destroy <name> [--force]                      # --force: destroy despite uncommitted or untracked changes
```

Each worktree owns a slot (1–9), recorded in `.worktrees/.slots/<N>` and as `WORKTREE_SLOT=<N>` on the first line of its `.env.local` / `.env.test`: ports from the `@inixiative/config` port registry: the project's base (`bunx @inixiative/config ports <project>`; the main checkout runs on it) plus 10 × the slot (the `PORT`s, `*_URL`s and `VITE_*_URL`s in the root and `apps/*` env files; each app's `PORT` is the registry service named after it, or `http`; each Vite dev server takes its port from its own `VITE_<APP>_URL`), `${PROJECT_NAME}_wt_<N>` / `${PROJECT_NAME}_test_wt_<N>` Postgres databases, MinIO buckets, a Redis logical DB, slot-specific env files synced against the branch's `.env.*.example` (multi-line quoted values included), its own `node_modules`, and the gitignored artifacts (route trees, Prisma client, SDK). Create fails fast when Docker/Postgres is down, refuses to fork onto a branch that already exists, warns about worktrees whose branch is merged (including branches checked out in a worktree), reclaims a slot lock whose owner is gone (dead pid, or no pid file and older than 60s; `stat -c`/`stat -f` chosen per platform), counts a registry entry as a claim even before its directory exists and prunes it only when the directory is missing, no lock is held, and it is older than 120s, prints the `worktree:destroy <name> --force` cleanup line on any failure or signal after the worktree exists (and releases the slot before it), reclaims a dead-pid lock and its directory-less registry entry with a notice while skipping a live one, aborts when the database inventory query fails, requires `DATABASE_URL` for both sides unless `--skip-db`, and drops a leftover slot database only when no registered worktree references that slot. Destroy requires a worktree whose git common dir is this repository's `.git` (or a half-created directory whose `.git` file points under this repository's `.git/worktrees/` at a gitdir that is gone; a `.git` file whose gitdir still exists, here or elsewhere, gets a `git worktree repair` hint and nothing is deleted), normalises the name to its on-disk spelling, prints whether the branch is merged into the default branch, refuses a dirty worktree unless `--force`, requires a registered worktree (or a half-created one with a `.git` file — never `.locks`/`.slots`), validates the slot, refuses when the worktree's env files name more than one slot, skips the DB/bucket/Redis cleanup when another worktree shares the slot, and kills every listener on the slot's ports (reporting each pid; a survivor is a warning). Green **ready** means every step landed; yellow **WITH GAPS** lists what to rerun. The `bashMainCheckoutGuard` hook (`.claude/hooks/`, PreToolUse on Bash + SessionStart) enforces two rules. (1) `git worktree add/remove/move/prune` is denied in every session — use the scripts. (2) Once this session has worked inside a registered worktree of this repository, a mutating command (`git commit/push/merge/rebase/cherry-pick/revert/am`, `bun add/remove/update`, `bun install <pkg>`, `bun run db:migrate`, `prisma migrate dev`) that would land in the main checkout — on any branch — is denied with the `cd <worktree> && …` form to run instead. A leading `cd`, `git -C`, or `bun --cwd` moves where a command lands; naming the main checkout by its absolute path is an explicit choice and is allowed. Full guide: `.claude/skills/worktrees/SKILL.md`.

---

## Writing New Scripts

**Shell scripts**: Place in `scripts/<category>/`, make executable (`chmod +x`).

**TypeScript scripts**: Can use `bun run scripts/path/to/script.ts` directly.

**Temporary/experimental**: Use `tmp/` directory (gitignored).

---

## AI Workspace

`tmp/AI_WORKSPACE/` is a gitignored staging area for async/overnight AI work.

```
AI_WORKSPACE/
├── {task-name}/
│   ├── TASK.md          # Task description, status, notes
│   ├── files/           # Files mirroring repo structure
│   └── notes/           # Research, drafts, experiments
```

### Workflow

1. Create task folder with TASK.md describing the work
2. AI works on files in `files/` directory (mirrors repo structure)
3. User reviews and copies approved files to repo
4. Delete task folder when done

Use this for larger changes, experiments, or work that needs review before committing.
