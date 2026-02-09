# Turborepo

This project uses Turborepo for monorepo task orchestration, caching, and smart dependency-aware watching.

## Task Naming Convention

**Turborepo tasks** (in `turbo.json`): Match package.json script names
```json
{
  "tasks": {
    "local": { ... },        // Runs in all packages with "local" script
    "local:worker": { ... }  // Runs in packages with "local:worker" script
  }
}
```

**Package scripts** (in `package.json`): Use `:` as delimiter
```json
{
  "scripts": {
    "local": "bun --hot src/index.ts",
    "local:worker": "bun --hot src/jobs/worker.ts",
    "local:db": "docker-compose up -d --wait"
  }
}
```

### How Task Resolution Works

When you run a Turborepo task:

```bash
turbo watch local          # Runs "local" script in ALL packages (api, web, admin, superadmin)
turbo watch local#api      # Runs "local" script ONLY in the "api" package
turbo watch local:worker   # Runs "local:worker" script in ALL packages that have it
turbo watch local:worker#api  # Runs "local:worker" script ONLY in the "api" package
```

**The `#` syntax filters by package:**
- Task name comes first: `local`, `local:worker`, `build`, etc.
- `#packageName` filters which package to run in
- Package name matches the `"name"` field in that package's `package.json`

**Our local dev command:**
```bash
bun run local
# Expands to: turbo watch local#api local#web local#admin local#superadmin local:worker#api
# - "local#*" runs app-local scripts in selected frontend/API apps
# - "local:worker#api" runs only in api package
```

## Watch Mode

Turborepo watch mode provides:
- **Event-based file watching** (not polling) with instant change detection
- **Dependency-aware cascading** - changes in packages trigger rebuilds in dependent apps
- **Smart caching** - skips tasks if inputs haven't changed
- **Persistent tasks** - keeps dev servers running, restarts on dependency changes

### Usage

**Local Development (with Turborepo watching):**
```bash
# Start all services with hot reloading + workspace dependency watching
bun run local
# Runs: turbo watch local#api local#web local#admin local#superadmin local:worker#api
# - "local#*" runs app-local scripts in selected frontend/API apps
# - "local:worker#api" runs only in api package

# Run specific services
turbo watch local#api          # Just API
turbo watch local#web          # Just web frontend
turbo watch local:worker#api   # Just worker
```

**Production:**
```bash
# Start production services (no hot reload, no watching)
bun run start:api              # Start API server
bun run start:worker           # Start background worker
bun run start:web              # Start web preview server
```

### How it works

1. **Database changes** → triggers `db:generate` → triggers `generate:openapi` → triggers `generate:sdk` → restarts API and frontend apps
2. **API source changes** → restarts API server via `bun --hot`
3. **Frontend changes** → Vite HMR handles updates (no restart needed)
4. **Shared package changes** → restarts apps that depend on it

## Task Dependencies

Tasks use `dependsOn` to define execution order:

```json
{
  "generate:openapi": {
    "dependsOn": ["^db:generate"],  // ^ means workspace dependency
    // ...
  },
  "local": {
    "dependsOn": ["db:generate", "generate:openapi"],  // local dependencies
    "persistent": true,
    "interruptible": true  // restart on dependency changes
  }
}
```

## Loop Prevention

Generated files are excluded from task inputs to prevent infinite regeneration loops:

```json
{
  "local": {
    "inputs": [
      "src/**/*.ts",
      "!openapi.local.json",  // ❌ Don't watch generated OpenAPI spec
      "../../packages/shared/src/**/*.ts",
      "!../../packages/shared/src/apiClient/**"  // ❌ Don't watch generated SDK
    ]
  }
}
```

## Caching

Turborepo caches task outputs based on input file hashes:

```json
{
  "db:generate": {
    "inputs": ["prisma/schema.prisma"],
    "outputs": ["src/generated/**"],
    "cache": true  // Cache this task
  }
}
```

**Benefits:**
- First run: 2-3 min build
- Cached run: ~10 sec
- CI builds: reuse cache across runs

## Task Types

### Generation Tasks (one-shot, cached)
- `db:generate` - Generate Prisma client and Zod schemas
- `generate:openapi` - Generate OpenAPI spec from API routes
- `generate:sdk` - Generate TypeScript SDK from OpenAPI spec
- `generate:routes` - Generate route tree for TanStack Router

### Development Tasks (persistent)
- `local#api` - Run API server with hot reload
- `local:worker#api` - Run BullMQ worker with hot reload
- `local#web` - Run web frontend with Vite HMR
- `local#admin` - Run admin frontend with Vite HMR
- `local#superadmin` - Run superadmin frontend with Vite HMR

### Build Tasks (production, cached)
- `build` - Build all apps for production
- `typecheck` - Run TypeScript type checking
- `test` - Run test suites

## Hot Reloading

### Backend (API/Worker)
Uses Bun's `--hot` flag for native hot reloading:
```bash
bun --hot src/index.ts
```

Changes to source files trigger instant reload without manual restart.

### Frontend (Web/Admin/Superadmin)
Uses Vite's built-in HMR (Hot Module Replacement):
```bash
vite
```

Changes to React components update instantly in the browser without full page reload.

## Migration from Bash Watch Scripts

**Old approach:**
- Bash scripts polling every 1 second
- Manual file watching with `find` and `stat`
- Separate watchers for API restarts and OpenAPI generation

**New approach:**
- Turborepo's event-based watching
- Bun `--hot` for native hot reloading
- Dependency-aware task cascading
- Smart caching to skip unchanged work

### Removed Scripts

The following bash polling scripts have been removed in favor of Turborepo + `--hot`:

- `apps/api/scripts/watch.sh` → replaced by `bun --hot` + turbo watch
- `apps/api/scripts/watchWorker.sh` → replaced by `bun --hot` + turbo watch
- `packages/shared/scripts/watch.sh` → replaced by turbo watch + generation tasks
- `apps/{web,admin,superadmin}/scripts/watch.sh` → replaced by native `vite` command

## Environment Composition with Turbo

You can combine env composition (via `with-env.sh`) with Turborepo watching:

```bash
# Pattern: bun run with <env> <app> turbo watch <tasks>
# Valid envs: local, test, dev, staging, sandbox, prod
# Valid apps: api, web, admin, superadmin

# Examples:
bun run with prod api turbo watch local#api local:worker#api
bun run with staging web turbo watch local#web
bun run with test admin turbo watch local#admin
bun run with local api turbo watch local#api

# This gives you:
# ✅ Environment-specific variables loaded
# ✅ Turborepo dependency-aware watching
# ✅ Hot reloading within the app
# ✅ Automatic restarts on workspace dependency changes
```

**Use cases:**
- Test API against production data locally: `bun run with prod api turbo watch local#api`
- Run web app with staging backend: `bun run with staging web turbo watch local#web`
- Debug with test environment vars: `bun run with test api turbo watch local#api`

## Filtering Tasks

Run specific tasks:
```bash
# Run API only
turbo watch local#api

# Run all frontend apps
turbo watch local#web local#admin local#superadmin

# Run generation tasks
turbo run generate:sdk generate:routes
```

## Debugging

### View task graph
```bash
turbo run build --graph
```

### View task logs
```bash
turbo run build --output-logs=full
```

### Clear cache
```bash
turbo run build --force
```
