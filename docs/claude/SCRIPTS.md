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
│   ├── push-dev.sh         # db:push:dev — worktree-aware, refuses non-local DATABASE_URLs
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
    └── lib.sh              # Shared helpers (sourced by the three above)

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
bun run db:migrate           # Create migration
bun run db:deploy            # Run migrations (production)
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
bun run worktree:destroy <name> [--force]                      # --force: destroy despite uncommitted or untracked changes
```

Each worktree owns a slot (1–9), recorded in `.worktrees/.slots/<N>` and as `WORKTREE_SLOT=<N>` on the first line of its `.env.local` / `.env.test`: ports, `${PROJECT_NAME}_wt_<N>` / `${PROJECT_NAME}_test_wt_<N>` Postgres databases, MinIO buckets, a Redis logical DB, slot-specific env files synced against the branch's `.env.*.example` (multi-line quoted values included), its own `node_modules`, and the gitignored artifacts (route trees, Prisma client, SDK). Create fails fast when Docker/Postgres is down, refuses to fork onto a branch that already exists, warns about worktrees whose branch is merged (including branches checked out in a worktree), reclaims a slot lock whose owner is gone (dead pid, or no pid file and older than 60s; `stat -c`/`stat -f` chosen per platform), counts a registry entry as a claim even before its directory exists and prunes it only when the directory is missing, no lock is held, and it is older than 120s, prints the `worktree:destroy <name> --force` cleanup line on any failure or signal after the worktree exists (and releases the slot before it), reclaims a dead-pid lock and its directory-less registry entry with a notice while skipping a live one, aborts when the database inventory query fails, requires `DATABASE_URL` for both sides unless `--skip-db`, and drops a leftover slot database only when no registered worktree references that slot. Destroy requires a worktree whose git common dir is this repository's `.git` (or a half-created directory whose `.git` file points under this repository's `.git/worktrees/` at a gitdir that is gone; a `.git` file whose gitdir still exists, here or elsewhere, gets a `git worktree repair` hint and nothing is deleted), normalises the name to its on-disk spelling, prints whether the branch is merged into the default branch, refuses a dirty worktree unless `--force`, requires a registered worktree (or a half-created one with a `.git` file — never `.locks`/`.slots`), validates the slot, refuses when the worktree's env files name more than one slot, skips the DB/bucket/Redis cleanup when another worktree shares the slot, and kills every listener on the slot's ports (reporting each pid; a survivor is a warning). Green **ready** means every step landed; yellow **WITH GAPS** lists what to rerun. The `bashMainCheckoutGuard` hook (`.claude/hooks/`, PreToolUse on Bash + SessionStart) denies a Bash command when ALL of these hold: this session has been inside a linked worktree of THIS repository that still exists; the session cwd is now the main checkout; the main checkout is on the default branch (`origin/HEAD`, normally `main` — `REQUIRE_MAIN_BRANCH` in the hook); and some segment of the command runs one of `bun add/a/remove/rm/update`, `bun install/i <package>` (a bare `bun install`/`bun i`, with or without options, is allowed), `git commit/push/merge/rebase/cherry-pick/revert/am`, `git worktree add/remove/move/prune`, `prisma migrate dev`, `bun run db:migrate` (also as `bun --cwd <pkg> db:migrate`, `bun run --cwd <pkg> db:migrate`, `bun --cwd <pkg> run db:migrate`) whose effective directory is not lifted. The effective directory follows any earlier `cd`/`pushd` in the command that runs in the same shell — a `cd` inside `( )`, or ending in `|` or a single `&`, does not move it (`{ }` does) — or the segment's own `git -C`, `bun --cwd` (anywhere in the segment), `env -C`/`--chdir`, `--git-dir`/`--work-tree`/`GIT_DIR`/`GIT_WORK_TREE`, with every target resolved through `realpath`. Lifted means: inside a worktree that `git worktree list` registers (named by any path, symlinks included), or this main checkout named by its own absolute path with `cd`, `git -C`, or `bun --cwd` (`env -C /abs/main` does not lift). A relative path into main, a symlink to main, an unregistered checkout or another repository, a non-checkout directory such as `/tmp`, a target containing a substitution or variable, or nesting deeper than six levels is never lifted. A script fed to a shell is walked as commands: a heredoc attached to `sh`/`bash`/`zsh`/`dash` (with or without `-s`), `echo`/`printf`/`cat <<EOF` piped into one (including through `tee` or an argument-less `cat`, any number of times), and `$(cat <<EOF)`/`$(printf …)` inside `-c` or `eval` — `bash f.sh` and `. f.sh` are accepted misses. Word 0 is normalised (`\git`, `"git"`, `gi\t`, `/usr/bin/git`, `$'git'`, and on macOS any letter case), quoted strings and heredoc bodies never count, `#` comments are stripped (but not a `#` glued to `${x}` or `$( )`), `--dry-run` and `--abort/--continue/--quit/--skip` never count, and wrappers (`VAR=x`, `env -u X -C dir`, `command -p`, `exec -a x`, `sudo -u me -E -n -S -k -s -T n`, `timeout -k n -s sig N`, `nice -n N`, `time -p`, `nohup --`, `xargs -n 1 -L 1 -P 4 -I {}`, `caffeinate -t n -w pid`, `rtk proxy`, `bunx`, `sh -o pipefail -c`, `eval`, `$( )`, backticks, `{ }`, `if/then`, `do`) are seen through. `git pull`, `git reset`, `git checkout`, and `bun run db:push*` are outside the set by design (they write no tracked files). Fix: `cd <worktree> && …`. Full guide: `.claude/skills/worktrees/SKILL.md`.

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
