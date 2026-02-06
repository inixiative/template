# Developer Guide

## Contents

- [Development](#development)
- [Common Commands](#common-commands)
- [Daily Workflow](#daily-workflow)
- [Architectural Reviews](#architectural-reviews)
- [Debugging](#debugging)

---

## Development

```bash
# Start everything
bun run local

# Individual services
bun run local:api     # API on :8000
bun run local:web     # Web on :3000
bun run local:worker  # Background jobs
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
docker exec -it template-redis redis-cli
> KEYS *              # List all keys
> GET key             # Get value
> FLUSHALL            # Clear all (careful!)
```

### Network

BullBoard UI at `http://localhost:8000/bullBoard` for job inspection.
