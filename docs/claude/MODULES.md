# Module Structure

Allowlist of folder names a module under `apps/api/src/modules/<moduleName>/` may use. Not every module needs every folder — pick what fits. New folder names not on this list should be added here before the first PR that introduces them, so drift stays visible.

---

## Core (most modules will have these)

- **`routes/`** — route definitions built with the request-template factories (`createRoute`, `readRoute`, `updateRoute`, `deleteRoute`, `actionRoute`).
- **`controllers/`** — request handlers built via `makeController(route, handler)`.
- **`schemas/`** — Zod request/response schemas. Typically derived from `getSchema('<Model>JSON')`; only hand-written for fields that don't exist on the Prisma model.
- **`services/`** — business logic + DB access. Anything not directly returning a response.
- **`tests/`** — integration tests for this module's endpoints.

## Domain logic (richer modules)

- **`handlers/`** — non-HTTP entry points (job handlers, event handlers, queue consumers).
- **`queries/`** — read-side data shaping (joins, aggregations, projections that aren't simple CRUD).
- **`validations/`** — domain-level validation that goes beyond schema-level (cross-field rules, business invariants).
- **`transformers/`** — input/output shape conversions (DB row → API response, external payload → internal model).
- **`mappers/`** — alias for `transformers/` if the team prefers the term. Pick one or the other per module, not both.

## Shared internals (scoped to one module)

- **`constants/`** — module-local enums, magic numbers, lookup tables.
- **`types/`** — module-local TypeScript types not derived from Zod.
- **`utils/`** — pure helpers scoped to this module.
- **`permissions/`** — permission rules / policy code if the module has non-trivial authz beyond the central registry.

## Less common but legitimate

- **`events/`** — module-emitted event definitions or handlers.
- **`jobs/`** — module-owned background job definitions if not centralized in `apps/api/src/jobs/`.
- **`fixtures/`** — test fixtures specific to this module. Prefer factories from `@template/db/test`; reach for fixtures only when factories don't fit.
- **`migrations/`** — only if the module owns a migration pattern. Rare; migrations are usually centralized.

---

## Rules of thumb

1. **Cross-module-shared code does NOT live in a module's `utils/`.** Put it in `apps/api/src/lib/` (or in `packages/shared/` if it crosses the API boundary).
2. **Don't manufacture empty folders.** A module with only `routes/` + `controllers/` is fine. Don't add `schemas/` just because other modules have it — derive types inline if the schema is one-shot.
3. **Cross-importing schemas from a sibling module is a smell.** Either the consuming module should re-export, or the schema should move to `packages/shared` if it's truly shared.
4. **New folder names not on this list need a one-line entry added here before merging.** Keeps the canonical set discoverable and prevents silent drift.
5. **Don't split for the sake of splitting.** A `services/` folder with one file that calls one Prisma method is just noise — keep it inline in the controller. Split when the controller becomes hard to read.
