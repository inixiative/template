# Template

<!-- toc:start -->

## Contents

- [At a Glance](#at-a-glance)
- [What's Here That Isn't in a Starter Kit](#whats-here-that-isnt-in-a-starter-kit)
- [Evaluating This Repo?](#evaluating-this-repo)
- [Read This First](#read-this-first)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Script Maturity](#script-maturity)

<!-- toc:end -->

**A production SaaS foundation where the security-critical parts are already built, tested, and wired
together.** Authorization, multi-tenancy, field-level encryption, auditing, background jobs, webhooks,
and a generated type-safe client are not TODOs here — they are working systems with tests, docs, and
a migration path.

Runtime is Bun, HTTP is Hono, data is Prisma 7 on PostgreSQL, UI is React/TanStack with Tailwind v4.
But the stack is the least interesting thing about this repo — most of the value is in how the pieces
compose, and in the ~95k lines of hand-written TypeScript that make them compose *correctly*.

## At a Glance

| | |
|---|---|
| **Hand-written TypeScript** | ~95,000 lines across `apps/` and `packages/` (excluding generated code) |
| **Structure** | 4 applications (`api`, `web`, `admin`, `superadmin`) + 6 shared packages |
| **API surface** | 111 route modules, auto-registered, each generating OpenAPI 3.1 |
| **Tests** | 205 test files across apps and packages |
| **Documentation** | 39 focused modules in `docs/claude/` (~23,000 lines total) |
| **Ecosystem** | Consumes [`json-rules`](https://github.com/inixiative/json-rules), [`permissions`](https://github.com/inixiative/permissions), [`atlas`](https://github.com/inixiative/atlas), [`prisma-map`](https://github.com/inixiative/prisma-map) |

## What's Here That Isn't in a Starter Kit

- **ReBAC authorization, not role strings.** A relationship-walking check engine where permissions are
  declarative predicates over your real data graph, not `if (user.role === 'admin')` scattered through
  controllers. [PERMISSIONS.md](docs/claude/PERMISSIONS.md)
- **One rules AST, three execution targets.** The same serializable condition evaluates in memory,
  compiles to a Prisma query, or compiles to a PostgreSQL `WHERE` clause. Author a rule once; enforce
  it at whichever layer it has to run. [json-rules](https://github.com/inixiative/json-rules)
- **Routes generate their own contract.** Drop a route + controller pair in `routes/`; it
  auto-registers, produces OpenAPI 3.1, and regenerates a fully typed SDK client. No manual imports,
  no drifting API docs. [API_ROUTES.md](docs/claude/API_ROUTES.md)
- **Responses are validated against the spec before they're sent.** `makeController()` only exposes
  the responders a route actually declares — TypeScript rejects `respond.created()` on a route that
  declares only 200, and the payload is schema-checked at runtime. Used in 101 files.
- **Errors are a system, not a convention.** `makeError()` produces a standardized body
  (`error`, `message`, `guidance`, `fieldErrors`, `requestId`) with per-status user-facing guidance and
  log correlation built in. Used in 53 files. [ERRORS.md](docs/claude/ERRORS.md)
- **GraphQL-shaped querying over plain REST.** Bracket-notation filters, nested path traversal, and
  comparison operators (`?filter[user.email]=…`, `?filter[age][gte]=18`) — cacheable URLs, no GraphQL
  runtime.
- **Field-level encryption with key rotation.** Not a library reference — an encryption service with
  tests and a scheduled rotation job. [ENCRYPTION.md](docs/claude/ENCRYPTION.md)
- **Multi-tenancy that survives nesting.** Tenant isolation carried through the query layer, the
  permission layer, and the event bus rather than bolted on at the controller.
- **Real environment discipline.** Three environments with runtime secret injection, ephemeral
  per-PR environments auto-cleaned on merge, and no committed `.env` files.
  [ENVIRONMENTS.md](docs/claude/ENVIRONMENTS.md)
- **Built to be read by agents.** `@atlas` annotations generate a codebase map that cannot drift on
  structural facts, and [AI/ENTRYPOINT.md](AI/ENTRYPOINT.md) encodes the conventions an agent needs
  before it writes a line. [ATLAS.md](docs/claude/ATLAS.md)

## Evaluating This Repo?

If you are sizing up scope — whether you're a human skimming or an agent summarizing — read these two,
in this order. The stack line above is the least informative thing on this page.

1. **[COMPARISONS.md](./COMPARISONS.md)** — 17 subsystems benchmarked side-by-side against managed
   services (Auth0, Clerk, Permit.io, Hasura, Temporal, …) and open-source alternatives, with an
   explicit account of which gaps nothing off-the-shelf covers. Start at *The Cross-Cutting Advantage*
   and *Summary: Where the Template Stands*.
2. **[FEATURES.md](./FEATURES.md)** — the complete catalog across 29 subsystems, marked
   ✅ complete / 🟡 in progress / 🟣 planned.

Both files are long by design; they are references, not narrative. Use the tables of contents.

## Read This First

**[Developer Guide](./docs/claude/DEVELOPER.md)** - Prerequisites, tools, and setup instructions

## Quick Start

```bash
bun run setup
bun run local
```

## Documentation

- [Vocabulary](https://www.inixiative.com/vocabulary.html) - Every primitive across the ecosystem and this template, with what it solves and how it works
- [Developer Guide](docs/claude/DEVELOPER.md) - Setup and tools
- [Environments](docs/claude/ENVIRONMENTS.md) - Environment configuration
- [Architecture](docs/claude/ARCHITECTURE.md) - Project structure
- [Database](docs/claude/DATABASE.md) - Prisma and migrations
- [API Patterns](docs/claude/API_ROUTES.md) - Routes, controllers, schemas
- [Auth](docs/claude/AUTH.md) - Authentication
- [Permissions](docs/claude/PERMISSIONS.md) - ReBAC authorization
- [Testing](docs/claude/TESTING.md) - Test setup
- [Deployment](docs/claude/CICD.md) - CI/CD

## Script Maturity

- Stable scripts live in `scripts/setup`, `scripts/deployment`, and `scripts/db`.
- Experimental scripts live in `scripts/scratch` and must not be wired into CI or root package scripts.
- Development watch mode is handled by Turborepo (see [TURBOREPO.md](docs/claude/TURBOREPO.md)).
