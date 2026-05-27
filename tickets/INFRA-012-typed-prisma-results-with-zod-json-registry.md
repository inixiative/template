# INFRA-012: Typed Prisma Results — ID Branding + JSON Registry (zod-backed)

**Status**: 📋 Backlog
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-05-11
**Updated**: 2026-05-11

---

## Overview

End-to-end typing for Prisma query results. Two type-safety holes the framework leaves open today:

1. **ID fields come back as `string`.** `(await db.user.findFirst()).id` and `orgUser.userId` are both plain `string` — no distinction between a `UserId` and a `SessionId`. We have `typedModelIds.ts` with branded types declared but only `UserId` is consumed anywhere, because the Prisma result types don't propagate the brand.
2. **JSON fields come back as `Prisma.JsonValue`.** Effectively `unknown` for any structured shape. Every consumer casts at the call site — duplicative, drift-prone, and easy to forget when the shape changes.

This ticket adds a Prisma `$extends` result extension that brands IDs and types JSON fields end-to-end, sourced from:
- The existing `prismaMap.gen.ts` for ID + FK discovery (auto).
- A new zod-backed registry for JSON shapes and any custom rules the schema can't infer (e.g. `Json[]` arrays of IDs).

The same zod registry doubles as the **write-side validator** in the existing `mutationLifeCycle` extension — one source of truth for "what's the shape of this JSON column," reused for both inbound validation and outbound typing.

---

## Objectives

- [ ] End-to-end typing for ID fields (`id`, `<model>Id` FKs) on Prisma results
- [ ] End-to-end typing for JSON fields on Prisma results
- [ ] Single zod registry as source of truth — `z.infer` for read-side types, `.parse()` for write-side validation
- [ ] Support custom rules ingress for shapes the schema can't infer (`Json[]` of IDs, composite shapes, etc.)
- [ ] Auto-generated result-extension config from `prismaMap.gen.ts` + the registry
- [ ] Correct extension ordering: `mutationLifeCycle` → result typer (last)
- [ ] Cascade triage: fix the type errors that surface in app code once the inferred result types tighten

---

## Tasks

### Registry (the source of truth)

- [ ] Create `packages/db/src/jsonRegistry.ts` (or similar) — a zod schema per `(model, jsonField)`.
- [ ] Pattern:
  ```ts
  export const jsonRegistry = {
    user: {
      preferences: z.object({ /* ... */ }),
    },
    auditLog: {
      changeSet: z.object({ /* ... */ }),       // nested old/new diff
    },
    appEvent: {
      payload: z.discriminatedUnion('type', [/* per-event-type schemas */]),
    },
  } as const;
  ```
- [ ] Export inferred types: `export type UserPreferences = z.infer<typeof jsonRegistry.user.preferences>;`.
- [ ] **Out of scope:** scalar/enum arrays (`CommunicationKind[]`, `TagResource[]`, `String[] @db.VarChar(36)`). Use native postgres array columns — postgres enforces value integrity, Prisma types `enum[]`/`scalar[]` directly, and they're GIN-indexable for free. Reserve the JSON registry for genuinely nested or heterogeneous shapes.
- [ ] Decide convention: registry alongside the model's prisma file, or centralized? (Probably centralized for the generator to consume in one read.)

### Custom rules ingress

- [ ] Separate registry for ID-typing rules that the schema can't infer (or that need to brand a *scalar array* of IDs as `ModelId[]` instead of `string[]`):
  ```ts
  export const customIdRules = {
    contact: {
      // String[] @db.VarChar(36) — postgres-typed correctly, but Prisma returns
      // string[]; this brands each element as a UserId.
      referredUserIds: { kind: 'arrayOf', model: 'User' },
    },
    user: {
      // Json[] of role IDs (schema can't infer; declared explicitly)
      roleIds: { kind: 'arrayOf', model: 'Role' },
    },
  } as const;
  ```
- [ ] **First-class use case: `varchar(36)[] → ModelId[]`.** Even with the right postgres type (`String[] @db.VarChar(36)`), Prisma's element type is plain `string`. The result extension brands each element. The same `kind: 'arrayOf'` rule covers both Json-array and scalar-array storage — the generator inspects the Prisma field type and emits the right compute (cast vs JSON parse + cast).
- [ ] Supported kinds: `'arrayOf'` (array of IDs of a model — works for both `Json[]` and `<scalar>[]` storage), `'composite'` (if needed), future-extensible.

### Write-side validation (existing `mutationLifeCycle`)

- [ ] Extend `packages/db/src/extensions/mutationLifeCycle.ts` to consult `jsonRegistry` on `create`/`createMany*`/`update`/`updateMany*`/`upsert`.
- [ ] If the mutation touches a registered `(model, jsonField)`, parse with the zod schema BEFORE the DB call. Throw loudly on failure.
- [ ] Decision: parse-and-replace (use the parsed value) vs validate-and-pass-through (zod validates but original value is sent)? Default to **parse-and-replace** so the DB row matches what the registry says — no drift between "what zod accepted" and "what landed."
- [ ] Tests in `packages/db/src/test/mutationLifeCycle.test.ts`:
  - valid blob passes, lands in DB
  - invalid blob throws with zod issues attached
  - unregistered JSON fields are unaffected (no validation)
  - works on `update`, `upsert`, `createMany`, `updateMany` variants

### Read-side result extension (the new piece)

- [ ] Create `packages/db/src/extensions/resultTyper.ts`.
- [ ] Generator (run at codegen time or as a build step):
  - Read `prismaMap.gen.ts` — for every model, emit `id` brand entry.
  - For every FK field (`<model>Id` pattern that resolves to a model name in prismaMap), emit branded entry.
  - For every `(model, field)` in `jsonRegistry`, emit cast to `z.infer<schema>`.
  - For every `(model, field)` in `customIdRules`, emit per-`kind` compute.
- [ ] Output shape:
  ```ts
  export const resultTyperExtension = Prisma.defineExtension({
    name: 'resultTyper',
    result: {
      user: {
        id: { needs: { id: true }, compute: (u) => u.id as UserId },
      },
      organizationUser: {
        id:             { needs: { id: true },             compute: (o) => o.id as OrganizationUserId },
        userId:         { needs: { userId: true },         compute: (o) => o.userId as UserId },
        organizationId: { needs: { organizationId: true }, compute: (o) => o.organizationId as OrganizationId },
      },
      user: {
        preferences: { needs: { preferences: true }, compute: (u) => u.preferences as UserPreferences },
      },
      // ...auto-emitted for every model + every JSON-registered field + every custom rule
    },
  });
  ```
- [ ] Trade-off on read-side: cast vs runtime `.parse()`?
  - Default: **cast** (no runtime cost; trusts write-side validation).
  - Optional `kind: 'jsonValidated'` for fields that came from un-validated sources (migrations, manual DB edits, external imports) — parses on read at a per-row cost.

### Wire into the client

- [ ] `packages/db/src/client.ts`:
  ```ts
  return prisma
    .$extends(mutationLifeCycleExtension())
    .$extends(resultTyperExtension) as unknown as Db;
  ```
  Order matters — result extension MUST be last so the branded types compose with the mutation lifecycle's runtime hooks underneath.

### Cascade triage (post-merge)

- [ ] After the extension lands, the inferred result types tighten. Anywhere existing app code passes a plain `string` from a Prisma result onward to a function expecting `UserId` (or similar), you'll get type errors.
- [ ] Expected scope: 30–80 errors. Mostly fix with `as` casts at boundaries or by tightening receiver signatures to use the branded types.
- [ ] Anywhere we currently cast a Prisma JSON field at the call site to the right shape: delete the cast — the result type is now correct.

---

## Implementation Notes

### Extension ordering matters

```ts
prisma
  .$extends(mutationLifeCycleExtension())  // runtime hooks: validation, lifecycle
  .$extends(resultTyperExtension)           // type-level branding (LAST)
```

`mutationLifeCycle` operates on the write path and runs validators. `resultTyper` operates on the read path and brands result types. The result typer must be LAST in the chain so its inferred types are what the rest of the codebase sees through the exported `db` client.

### JSON registry vs native postgres arrays

The JSON registry is for **genuinely nested or heterogeneous shapes** — `User.preferences`, `AuditLog.changeSet`, `AppEvent.payload`. Anything that's "an array of one scalar/enum type" should be a native postgres array column, not Json:

| Shape | Schema | Result type | Registry needed? |
|-------|--------|-------------|------------------|
| `['marketing', 'system']` (enum array) | `CommunicationKind[]` | `CommunicationKind[]` | ❌ no |
| `['tag-1', 'tag-2']` (string array) | `String[]` | `string[]` | ❌ no |
| `['user-uuid-1', 'user-uuid-2']` (ID array) | `String[] @db.VarChar(36)` | `string[]` → brand to `UserId[]` | ✅ custom rule, `kind: 'arrayOf'` |
| `{ theme: 'dark', density: 'compact' }` (nested object) | `Json` | `JsonValue` → cast to shape | ✅ JSON registry, zod schema |
| `{ kind: 'X', payload: {...} } | { kind: 'Y', payload: {...} }` (variant union) | `Json` | `JsonValue` → discriminated union | ✅ JSON registry, `z.discriminatedUnion` |

Postgres enum arrays give value integrity + Prisma typing + GIN-indexable for free. Scalar arrays of IDs need the result extension only to brand elements (postgres types them correctly already).

### Why one registry instead of two

Splitting "what's the JSON shape for validation" from "what's the JSON shape for typing" would invite drift. With one zod registry:
- Write path: `.parse()` for validation.
- Read path: `z.infer<typeof schema>` for the type.

A single source of truth. Schema change in one place propagates to both.

### Cast vs validated read

Casting on read (`as Type`) trusts that the data on disk matches what the registry says. That's true if:
1. The data was written via this client (mutation lifecycle validated it).
2. Migrations preserved shape.
3. No one hand-edited rows in the DB.

For boundary data that bypassed validation (legacy imports, manual edits, JSON columns populated before the registry existed), opt-in to `kind: 'jsonValidated'` to parse on every read. Trade ergonomics for safety on a per-field basis.

### Why the generator instead of hand-written

Hand-writing entries for ~25 models × (own ID + ~3 FK fields each) = ~100 entries. Plus 10+ JSON-typed columns. Plus keeping it synced with schema changes. Mechanical and error-prone. The generator reads `prismaMap.gen.ts` once, walks the schema, and emits the right config — auto-stays-in-sync with Prisma's source of truth.

### Performance note

Each `compute` runs once per row per requested field. Branding is a pointer-equal cast (zero work). Cast-on-read for JSON is also free. `kind: 'jsonValidated'` does real parsing work — use sparingly on hot paths.

---

## Open Questions

- Where does `jsonRegistry` live? Centralized (one file in `packages/db/src/`) or distributed (per-model registry files imported and merged)?
- Do we generate the result extension to a `.gen.ts` file or compute it at module load from `prismaMap.gen.ts`? Generated file is friendlier to inspect/grep; runtime computation has less ceremony.
- How do we handle JSON fields where the shape genuinely varies (e.g. `AppEvent.payload` — different per event type)? Discriminated union schema in the registry, or punt with `JsonValue` and have consumers narrow?
- Read-side `kind: 'jsonValidated'` opt-in: per field, per call, or per-query at runtime? (Probably per field in the registry config, with an override at call site if needed.)

---

## Definition of Done

- [ ] `jsonRegistry` and `customIdRules` defined and consumed by both extensions
- [ ] `mutationLifeCycle` validates registered JSON fields on write
- [ ] Result extension brands all IDs (`id` + `<model>Id` FKs) and casts JSON fields to their registered types
- [ ] Extension order in `client.ts` is `mutationLifeCycle → resultTyper`
- [ ] Generator script produces the result config from `prismaMap.gen.ts` + registries
- [ ] Cascade type errors resolved across `apps/api`, `apps/web`, `apps/superadmin`, `apps/admin`, packages
- [ ] All tests still green (`bun run check` passes)
- [ ] `docs/claude/DATABASE.md` and `docs/claude/HOOKS.md` updated with the registry pattern
- [ ] At least one JSON column (e.g. `user.preferences` or `auditLog.changeSet`) demonstrated end-to-end
- [ ] At least one scalar-array ID column (`String[] @db.VarChar(36)`) demonstrated branded as `ModelId[]`

---

## Resources

- Current `typedModelIds.ts` — already declares branded ID types (User, Org, Space, Contact, Inquiry, Email*, Webhook*, Audit, AppEvent, Tag*, and in tribe: Bot*, Chat*). Result extension will consume these.
- `packages/db/src/extensions/mutationLifeCycle.ts` — write-side hook host.
- `packages/permissions/src/rebac/prismaMap.gen.ts` — generated schema map; result generator's input.
- Prisma `$extends({ result })` docs: https://www.prisma.io/docs/orm/prisma-client/client-extensions/result

---

## Related Tickets

- [FEAT-005: Audit Logs](./FEAT-005-audit-logs.md) — `AuditLog.changeSet` is a prime candidate for the JSON registry.
- [INFRA-009: Adapter Primitives](./INFRA-009-adapter-primitives.md) — shape of typed primitives across the stack.

---

## Comments

_Spawned from a session conversation about typed-IDs on FKs. Two big insights:_
1. _Phantom-typed IDs in TS are valuable only at signatures that demand them; without a result-mapper extension, the protection stops at hand-written boundaries._
2. _The same machinery that brands IDs can type JSON fields — and the registry should be zod so that write-side validation and read-side typing share a single source of truth._
