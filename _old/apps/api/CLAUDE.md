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