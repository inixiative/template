# Template, for its Wardens

Template is a SaaS foundation that a product starts from and then owns, like shadcn for the whole
backend. Its security-critical systems are already built, tested and documented. Most work here
extends one of them or composes a few of them; very little work is truly new.

## Shape of the repository

- `apps/api`: the Bun + Hono API. `modules/<model>/` holds a model's routes, controllers and
  services; `routes/` auto-register and generate OpenAPI 3.1 and the typed SDK. Also `jobs/`
  (background jobs), `hooks/` (database hooks), `appEvents/`, `ws/` (WebSockets), `middleware/`.
- `apps/web`, `apps/admin`, `apps/superadmin`: React + TanStack frontends, Tailwind v4.
- `packages/db` (Prisma 7 on PostgreSQL), `packages/permissions`, `packages/sdk` (generated
  client), `packages/shared`, `packages/ui`, `packages/email`.
- `docs/claude/`: one doc per system (permissions, auth, database, jobs, hooks, Redis, inquiries,
  encryption, errors, naming, testing, and more). `FEATURES.md`, at the root, catalogs what exists
  by subsystem.
- `scripts/ci/rules/`: CI rules that enforce the conventions.

## Systems other code depends on

- Permissions: RBAC, ABAC and ReBAC in one check over the real data graph
  (`@inixiative/permissions`), with rules as data (`@inixiative/json-rules`) that run in memory, as
  a Prisma query or as SQL.
- Routes and controllers: `makeController()` exposes only the responses a route declares and
  validates them; `makeError()` is the one error envelope.
- Tenancy: users, organizations and spaces (organizations contain spaces), their memberships, and
  tokens owned by a user, an organization, a space, a membership of either, or an integration.
- Requests between parties are Inquiries. Audit log, soft delete, field-level encryption with key
  rotation, jobs, webhooks and caching each have their own primitive.

## Words used here

Owner (the tenancy a record belongs to), actor (who is acting), token, integration, inquiry,
segment, project, tag. Names follow the schema in full.
