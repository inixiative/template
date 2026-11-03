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

> One of the [inixiative](https://www.inixiative.com) building blocks. Stop rediscovering what you need to build. See [all the projects](https://github.com/inixiative).

**Template is like shadcn, but for the whole SaaS app: you start a product from it and own the
code.** It is a decade of lessons from building SaaS products, packaged so a new product starts from
answers instead of rediscovering them. The API, the web, admin and superadmin apps, a shared UI
package, authorization, multi-tenancy, field-level encryption, auditing, background jobs, webhooks and
a generated typed client are already built, tested and documented. When a coding agent writes its own
version of something already here, Foundry points it back: the repo ships its
[Foundry](https://github.com/inixiative/foundry) setup in `.foundry/`.

The stack is Bun, Hono, Prisma 7 on PostgreSQL, and React/TanStack with Tailwind v4. Most of the
work is in how the pieces fit together, in about 139,000 curated lines of TypeScript.

## At a Glance

| | |
|---|---|
| **Curated TypeScript** | About 139,000 lines across `apps/` and `packages/`, tests included (about 72,000 outside tests), excluding generated code |
| **Structure** | 4 applications (`api`, `web`, `admin`, `superadmin`) + 6 shared packages |
| **API surface** | 156 route modules, auto-registered, each generating OpenAPI 3.1 |
| **Tests** | 409 test files across apps and packages |
| **Documentation** | 41 focused docs in `docs/claude/` (about 16,100 lines) |
| **Building blocks** | Uses [`json-rules`](https://github.com/inixiative/json-rules), [`permissions`](https://github.com/inixiative/permissions), [`rules-builder`](https://github.com/inixiative/rules-builder), [`prisma-map`](https://github.com/inixiative/prisma-map), [`atlas`](https://github.com/inixiative/atlas) and [`config`](https://github.com/inixiative/config) |

## What's Here That Isn't in a Starter Kit

- **RBAC, ABAC and ReBAC in one check, over your own records.** Permissions are declarative rules
  over your data and its relations, decided by [`@inixiative/permissions`](https://github.com/inixiative/permissions)
  in one place instead of `if (user.role === 'admin')` scattered through controllers.
  [PERMISSIONS.md](docs/claude/PERMISSIONS.md)
- **One rules AST, three execution targets.** The same serializable condition evaluates in memory,
  compiles to a Prisma query, or compiles to a PostgreSQL `WHERE` clause. Author a rule once and
  enforce it at whichever layer it has to run. Rules are data, so a tenant configures its own behaviour
  instead of you writing code per tenant ([why](docs/claude/ARCHITECTURE.md#why-behaviour-is-rules-not-code)).
  [json-rules](https://github.com/inixiative/json-rules)
- **Routes generate their own contract.** Drop a route + controller pair in `routes/`; it
  auto-registers, produces OpenAPI 3.1, and regenerates the typed SDK client. Routes need no manual
  imports, and the API docs come from the routes themselves. [API_ROUTES.md](docs/claude/API_ROUTES.md)
- **Responses are validated against the spec before they're sent.** `makeController()` only exposes
  the responders a route declares: TypeScript rejects `respond.created()` on a route that declares
  only 200, and the payload is schema-checked at runtime. Used in 159 files.
- **One error envelope.** `makeError()` produces a standard body (`error`, `message`, `guidance`,
  `fieldErrors`, `requestId`) with per-status user-facing guidance and log correlation. Used in 68
  files. [ERRORS.md](docs/claude/ERRORS.md)
- **GraphQL-shaped querying over plain REST.** Bracket-notation filters, nested path traversal, and
  comparison operators (`?filter[user.email]=…`, `?filter[age][gte]=18`) give cacheable URLs with no
  GraphQL runtime.
- **Field-level encryption with key rotation.** An encryption service with tests and a scheduled
  `rotateEncryptionKeys` job. [ENCRYPTION.md](docs/claude/ENCRYPTION.md)
- **Multi-tenancy that survives nesting.** Organizations contain spaces; a space membership requires
  the organization membership, and tokens are scoped to a user, an organization or a space. Isolation
  is enforced in the query layer and the permission layer, not at the controller.
- **Environments.** Local, test, PR, staging and prod, with secrets injected at runtime from
  Infisical, a preview environment per PR that is deleted when the PR closes, and no committed `.env`
  files. [ENVIRONMENTS.md](docs/claude/ENVIRONMENTS.md)
- **Built to be read by agents.** `@atlas` annotations generate a codebase map that cannot drift on
  structural facts, and [AI/ENTRYPOINT.md](AI/ENTRYPOINT.md) holds the conventions an agent needs
  before it writes a line. [ATLAS.md](docs/claude/ATLAS.md)

## Evaluating This Repo?

If you are sizing up scope, as a person skimming or an agent summarizing, read these two, in this
order. The stack line above says the least about this repo.

1. **[COMPARISONS.md](./COMPARISONS.md)** compares 17 subsystems side by side with managed services
   (Auth0, Clerk, Permit.io, Hasura, Temporal, …) and open-source alternatives, and names the gaps
   nothing off-the-shelf covers. Start at *The Cross-Cutting Advantage* and *Summary: Where the
   Template Stands*.
2. **[FEATURES.md](./FEATURES.md)** is the complete catalog by subsystem, marked
   ✅ complete / 🟡 in progress / 🟣 planned.

Both files are long references, not narrative. Use the tables of contents.

## Read This First

**[Developer Guide](./docs/claude/DEVELOPER.md)** - Prerequisites, tools, and setup instructions

## Quick Start

```bash
bun run setup
bun run local
```

## Documentation

- [Vocabulary](https://www.inixiative.com/vocabulary.html) - Every primitive across the inixiative packages and this template, with what it solves and how it works
- [Developer Guide](docs/claude/DEVELOPER.md) - Setup and tools
- [Environments](docs/claude/ENVIRONMENTS.md) - Environment configuration
- [Architecture](docs/claude/ARCHITECTURE.md) - Project structure
- [Database](docs/claude/DATABASE.md) - Prisma and migrations
- [API Patterns](docs/claude/API_ROUTES.md) - Routes, controllers, schemas
- [Auth](docs/claude/AUTH.md) - Authentication
- [Frontend](docs/claude/FRONTEND.md) - Routing, API client, components, theme
- [Permissions](docs/claude/PERMISSIONS.md) - ReBAC authorization
- [Segments](docs/claude/SEGMENTS.md) - Provider audiences, reconciliation and Owned/Memberships navigation
- [Testing](docs/claude/TESTING.md) - Test setup
- [Deployment](docs/claude/CICD.md) - CI/CD

## Script Maturity

- Stable scripts live in `scripts/setup`, `scripts/deployment`, and `scripts/db`.
- Experimental scripts live in `scripts/scratch` and must not be wired into CI or root package scripts.
- Development watch mode is handled by Turborepo (see [TURBOREPO.md](docs/claude/TURBOREPO.md)).
