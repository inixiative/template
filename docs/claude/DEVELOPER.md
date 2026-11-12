# Developer Guide

<!-- toc:start -->

## Contents

- [Development](#development)
- [Common Commands](#common-commands)
  - [Database](#database)
  - [Code Quality](#code-quality)
  - [Environment](#environment)
  - [Shared Playwright MCP Server](#shared-playwright-mcp-server)
- [Daily Workflow](#daily-workflow)
- [Architectural Reviews](#architectural-reviews)
- [Debugging](#debugging)
  - [Logs](#logs)
  - [Database](#database)
  - [Redis](#redis)
  - [Network](#network)

<!-- toc:end -->


---

## Development

```bash
# Start everything
bun run local

# Individual services
turbo watch local#api          # API on the registry api port (bunx @inixiative/config ports <project>)
turbo watch local#web          # Web on the registry web port
turbo watch local:worker#api   # Background jobs
```

---

## Common Commands

### Database

```bash
bun run db:studio            # Prisma Studio
bun run db:generate          # Generate client
bun run db:push              # Push schema
bun run db:migrate           # Create migration
bun run db:seed              # Seed production-safe data
bun run db:seed --prime      # Include prime dev data (3 users, org, space, tokens)
bun run db:clone [env]       # Clone remote DB to local (default: prod)
bun run db:truncate:webhooks # Clear webhook subscriptions (local/test only)
bun run reset:db             # Reset and reseed with prime
```

**Prime Development Data:**
- **Users** (password: `asd123!`):
  - `super@inixiative.com` - Platform superadmin
  - `owner@inixiative.com` - Org/space owner
  - `customer@inixiative.com` - Org/space member
- **API Tokens:**
  - `local_user_owner_personal` - Personal
  - `local_orgUser_acme_main` - Organization
  - `local_spaceUser_acme_main` - Space

See [DATABASE.md](DATABASE.md#seeding) for full seed documentation.

### Code Quality

```bash
bun run lint          # Check
bun run lint:fix      # Fix
bun run format        # Format
bun run test          # Run tests
```

### Environment

```bash
bun run sync-env      # Sync .env files
```

### Shared Playwright MCP Server

The Playwright plugin starts its own MCP server in every Claude Code session. On macOS, `bun run setup` ends by replacing it with one server per machine that sessions in every repo share. It installs a login service on `localhost:8931`, registers it at user scope as `playwright`, and turns off the per-session plugin once the server responds.

```bash
bun run setup:playwright-mcp
```

The step is safe to re-run, and you should re-run it after changing your Node version. It replaces the `playwright@claude-plugins-official` plugin, so tool names change to `mcp__playwright__*` and Claude Code asks for permission again. Browser logins do not carry over between runs. Claude Code sessions already open keep their own servers until they restart. Any process on the machine can drive the server: it listens on localhost only and has no auth. On other systems, or without `claude`, `npx` or `node`, the step prints a message and skips. If another repo's setup already runs a Playwright MCP server on port 8931, the step registers that server and installs no service of its own.

To undo it:

```bash
launchctl bootout gui/$(id -u)/com.inixiative.playwright-mcp
rm ~/Library/LaunchAgents/com.inixiative.playwright-mcp.plist
claude mcp remove -s user playwright
claude plugin enable -s user playwright@claude-plugins-official
```

---

## Daily Workflow

1. Pull latest changes
2. Run `bun run setup` if deps changed
3. Start services: `bun run local`
4. Make changes
5. Run tests: `bun test`
6. Commit and push

---

## Architectural Reviews

Periodically stop and review architectural decisions before moving forward. Ask:

- Does this pattern match the rest of the codebase?
- Are we over-engineering or under-engineering?
- Will this be maintainable in 6 months?
- Are there simpler alternatives?

When in doubt, pause and discuss before implementing.

---

## Debugging

### Logs

See [LOGGING.md](LOGGING.md) for log configuration and scopes.

### Database

```bash
bun run db:studio     # Visual database browser
```

### Redis

```bash
docker exec -it ${PROJECT_NAME:-template}_redis redis-cli
> KEYS *              # List all keys
> GET key             # Get value
> FLUSHALL            # Clear all (careful!)
```

### Network

BullBoard UI at `<API_URL>/bullBoard` for job inspection.
