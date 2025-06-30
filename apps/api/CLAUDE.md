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

## Docker Commands
- Always use the `scripts` container to execute commands, not `api`
- Use `docker-compose exec scripts` for all command execution

## Prisma Schema Conventions
- Put `@@map()` at the top of model definitions
- Place timestamps (createdAt, updatedAt) immediately after id
- Use `@default(uuid())` for id fields