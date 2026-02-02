# Project Instructions for AI Assistant

## Package Manager
- This project uses Bun as the package manager
- Use `bun` instead of `npm` for all commands
- Examples: `bun install`, `bun run dev`, `bun add <package>`

## Code Style
- Do not add comments to code unless specifically requested
- Keep code clean and self-documenting
- Use single-line if statements without braces for simple conditions
- Use absolute path imports starting with `src/` instead of relative imports
- Use single quotes for imports and strings
- Use camelCase for variable and function names (not CAPS_CASE)

## Naming Conventions
- Controllers: `<resource><Action>` (e.g., `usersCurrent`, `productsCreate`)
- Middleware folders: singular names (e.g., `user`, `resource`, not `users`)
- Schema files: `<model>Schema.ts` (e.g., `userSchema.ts`)
- Route files: `<resource>Routes.ts` (e.g., `userRoutes.ts`)

## Docker Commands
- Always use the `scripts` container to execute commands, not `api`
- Use `docker-compose exec scripts` for all command execution
- Use `bun run docker:bun` for package management

## Prisma Schema Conventions
- Put `@@map()` at the top of model definitions
- Place timestamps (createdAt, updatedAt) immediately after id
- Use `@default(uuid())` for id fields

## Testing
- Run tests with `bun run test`
- Watch mode: `bun run test:watch`
- Place test files next to their source files (e.g., `userContext.test.ts` next to `userContext.ts`)
- Use `describe`, `it`, `expect` from `bun:test`

## API Documentation
- OpenAPI docs available at `/docs` using Scalar UI
- Use request schema templates from `src/app/core/requestSchemas`
- Always include proper types and documentation

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
- Import from `@template/db/zod` (inputs) or `@template/db/zod/models` (responses)
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
- Single-line throws: `if (!x) throw new HTTPException(404, { message: '...' })`

### File naming
- Pattern: `<admin?><model><action>` (e.g., `adminOrganizationsCreate`, `inquiriesRead`)
- Route and controller files have matching names

### Common mistakes to avoid
- Creating schemas that already exist in generated code
- Using relative imports instead of `#/`
- Bundling multiple routes in one file
- Refetching resources that are already in context
- Adding complexity that isn't needed