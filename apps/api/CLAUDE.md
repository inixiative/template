# Project Instructions for AI Assistant

## Package Manager
- This project uses Bun as the package manager
- Use `bun` instead of `npm` for all commands
- Examples: `bun install`, `bun run dev`, `bun add <package>`

## Code Style
- No comments (the repo-wide rule in `AI/ENTRYPOINT.md` §0): only the `@atlas` block, and rarely one short *why* line
- Keep code clean and self-documenting
- Use single-line if statements without braces for simple conditions
- Imports inside the app use the `#/` alias (`#/modules/...`), never `src/...` or `../`; shared packages use `@template/<pkg>/*`
- Use single quotes for imports and strings
- Use camelCase for variable and function names (not CAPS_CASE)

## Naming Conventions
- Route and controller files share one name: `<admin?><model><Action>.ts` (e.g. `organizationRead.ts`, `adminUserRedact.ts`), one endpoint per file, under `modules/<model>/routes` and `modules/<model>/controllers`
- Middleware folders: singular names (e.g., `auth`, `resources`, `validations`)
- Full naming rules: `docs/claude/NAMING.md`

## Local Services
- Postgres, Redis and MinIO run in Docker Compose (`bun run local:db`); the API and worker run natively with Bun (`bun run local`)
- In a worktree use the repo scripts (`bun run worktree:create`, `bun run db:push:dev`); see `docs/claude/DOCKER.md`

## Prisma Schema Conventions
- One file per model in `packages/db/prisma/schema/`; no `@@map()` (tables keep the model name)
- Place timestamps (createdAt, updatedAt, deletedAt) immediately after id
- Ids: `@id @default(dbgenerated("uuidv7()")) @db.VarChar(36)`

## Testing
- Run tests with `bun run test` (DB-backed, one file at a time; see `docs/claude/TESTING.md`)
- Tests live next to their source or in a module's `tests/` folder
- Use `describe`, `it`, `expect` from `bun:test`; build data with the factories in `@template/db/test`

## API Documentation
- OpenAPI 3.1 spec served as JSON at `/openapi/docs` (via `app.doc31`)
- Build routes with the route templates in `#/lib/routeTemplates`; the spec and SDK are generated from them

---

## CRITICAL: Patterns to Follow (Read Before Writing Code)

### Before writing ANY code:
1. **Read existing files first** - check how similar things are done
2. **One thing at a time** - don't try to do everything at once
3. **Ask if unsure** - don't assume, don't guess

### Imports
- **ALWAYS use `#/` path alias** - never relative imports like `../`
- Example: `import { foo } from '#/modules/bar/baz'`

### Schemas
- **Use generated Prisma schemas** - don't define custom schemas
- Import from `@template/db/zod/objects/<Model>CreateInput.schema` (inputs, one file each) or `@template/db/zod/models` (responses)
- Only extend/customize when truly necessary (e.g., adding non-DB field like `ownerEmail`)

### Routes
- **NEVER use raw `createRoute()` from `@hono/zod-openapi`** - ALWAYS use our templates
- Templates: `readRoute`, `createRoute`, `updateRoute`, `deleteRoute`, `actionRoute`
- Use `Modules.xxx` constant for model/submodel - never raw strings like `'organizations'`
- Use `action` for verbs (sent, received, resolve), `submodel` for nested resources (token, organizationUser)
- One file per endpoint: `adminOrganizationReadMany.ts`, not bundled `organization.route.ts`

### Controllers
- **Pass body directly to Prisma** - don't destructure unless needed
- Use `getResource(c)` for routes with `:id` - don't refetch
- Use `paginate()` utility for list endpoints
- Single-line throws: `if (!x) throw makeError({ status: 404, message: '...' })` (`#/lib/errors`); never `new HTTPException`

### File naming
- Pattern: `<admin?><model><action>` (e.g., `adminOrganizationsCreate`, `inquiriesRead`)
- Route and controller files have matching names

### Common mistakes to avoid
- Creating schemas that already exist in generated code
- Using relative imports instead of `#/`
- Bundling multiple routes in one file
- Refetching resources that are already in context
- Adding complexity that isn't needed