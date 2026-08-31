# INFRA-030: Reference registry — the rows a rule names, as edges

**Status**: 🆕 Not Started — design settled 2026-08-31; code lands with the first template surface (below)
**Assignee**: Aron
**Priority**: Medium (Zealot is the first consumer and carries the shape today; the template gets the primitive so email rules don't grow a second one)
**Created**: 2026-08-31
**Updated**: 2026-08-31

> Zealot hit this as ZLT-4441 / #2116 (write-only edge table + DB hook, reviewed 2026-08-31 with the
> rulings below) after the ZLT-4331 review proved per-surface tree scanning doesn't scale: a delete
> guard covered two referencing surfaces and missed two more, and a `none` rule over a deleted target
> is vacuously true for the whole tenant. This ticket is the template's version — same primitive,
> Postgres-shaped, false-polymorphic on both ends — and the ruling that email's `componentRefs` does
> **not** ride it.

---

## Problem

A stored rule (`Groups.conditions`, `BrandMissions.autoApprovalConditions`, a future
`EmailTemplate.conditions`) can name another row: "members of segment X", "tagged Y". Nothing
records that edge, so three questions are each answered by scanning every rule-bearing column:

- **Delete gate** — "who references X?" before X is soft-deleted. Per-surface scans miss surfaces
  added later, by construction.
- **Ordering** — dependency-ordered reconciliation (topo layers over the reference graph) needs the
  edges per tenant; recomputing them from trees per pass is the cache-invalidation problem.
- **Staleness** — when X is gone anyway (out-of-band write, legacy path), the rule must not be
  evaluated: `any` degrades to false, `none` becomes everyone. Detecting that at evaluation time is
  another tree walk, on the hot path.

Email already solved the first two for one edge type in one domain: `componentRefs String[]` with a
GIN index, derived on save, `degradedComponentRefs` as the broken-refs projection, and the
`emailVersioning` hook walking the reverse edges on every save/soft-delete. That works because the
edge is homogeneous (component → component) and Postgres arrays index. Rules reference rows across
models, and a Json column's contents aren't indexable — so the edges become rows.

## Shape

### The table — false polymorphism on both axes

```prisma
model RuleReference {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  createdAt DateTime @default(now())

  ownerModel            RuleReferenceOwnerModel
  ownerEmailTemplateId  String? @db.VarChar(36)
  ownerEmailTemplate    EmailTemplate? @relation(fields: [ownerEmailTemplateId], references: [id], onDelete: Cascade)

  referencedModel       RuleReferenceReferencedModel
  referencedTagId       String? @db.VarChar(36)
  referencedTag         Tag? @relation(fields: [referencedTagId], references: [id], onDelete: Cascade)

  @@unique([ownerModel, ownerEmailTemplateId, referencedModel, referencedTagId])
  @@index([referencedModel, referencedTagId])
}
```

One discriminator + one typed nullable FK per model on **each** end — `AuditLog.subjectModel`'s
pattern, registered in `PolymorphismRegistry` as two axes so the `rules` hook enforces exactly-one-FK
and the type fields are immutable. The FK columns above are illustrative (the first template
surface names the real ones); adding a surface or a referenceable model = registry entry + column,
the cost AuditLog already pays.

Not a bare `(model, id)` string pair. Typed relations are what the consumers need: `include` on
either end, `where: { referencedTag: { deletedAt: null } }` instead of a hand-joined `deletedAt`, and
`onDelete: Cascade` on the referenced FK so a **hard** delete through any path removes the edges at
the DB — hard-delete orphans become impossible rather than detected.

No `updatedAt` / `deletedAt`. Edges are append/delete: the set-diff hard-deletes edges that left
the tree, a row is never mutated, and an edge has no lifecycle of its own. Tenant scoping is derived
through the owner relation, never denormalized onto the edge (a nullable `organizationId` on the edge
is a fail-open: an owner with none never matches a scoped reverse query).

### Surfaces — a registry, and the lens does the extraction

```ts
export const ruleReferenceSurfaces: Partial<Record<ModelName, { column: string }>> = {
  EmailTemplate: { column: 'conditions' },
};
```

One entry per rule-bearing column. The hook registration reads this table, so a new surface's
writes grow edges with no further wiring — a write path added later can't forget it, the same reason
validation is a hook and not a call in each service.

Which rows a rule names is a **lens** fact, not a per-surface extractor: a leaf that compares a
relation target's primary key against a literal (`equals` / `in`), reached through the owner's
declared relations, names that row — `{ field: 'tags.id', operator: 'in', value: [a, b] }` on an
`EmailTemplate` rule is two `Tag` edges. `path` / `bind` leaves are dynamic and yield no edge; gates
treat "dynamic" as unknown and fail closed. This is `ruleReferences(lens, rule) → { model, id }[]`
in json-rules' lens module — introspection lives in the lens, the core stays an evaluator
(inixiative/json-rules#9), and this registry is the named first consumer that API was waiting for.
The template's `lensFor(ownerModel)` (prismaMap) is the lens; no path is spelled anywhere. Until the
lens API ships, Zealot carries the projection caller-side over `foldConditionTree` behind a one-line
seam (`packages/shared/src/rules/segments/referencedFieldValues.ts`) — port that seam, not a walker.

### The hook — edges in the same transaction as the save

After-timing on `create` / `update` / `upsert` / `createManyAndReturn` / `updateManyAndReturn`,
registered on the surface models (never `'*'`). After, because the edges need the created row's id
and the *stored* tree — before-hooks normalize the payload, `result` is the truthful source.

- Skip by key presence: a write whose payload lacks the rule column returns before any query. A
  `DbNull` clear has the key, so it recomputes to empty and the edges go.
- Set-diff per owner: load existing edges for the written owners in one query, keep the survivors,
  `deleteMany` the removed, `createManyAndReturn` the added.
- The per-owner recompute is a callable, `syncRuleReferences(model, rows)`, so a backfill is a loop
  over it — not a re-save of every row to trip the hook.

Owner soft-delete does not touch edges: a revived owner still holds the references, and every reader
joins the owner's `deletedAt` (the softDeleteScoper's `liveWhere` does this for free through the
relation).

### Staleness — on the referenced side, re-resolved, deletedAt-aware

The backstop behind the delete gate, for the row that is gone anyway. Hard delete is the FK cascade;
nothing to detect. Soft-delete and restore are the `softDeleteCascade` hook's shape: after-timing on
every referenceable model, fire when `deletedAt` flips in either direction, find edges by that
model's FK, **re-resolve every owner** — recompute "which of my edges point at a live row" and write
the owner's projection (`degradedComponentRefs` is the email precedent; segments in Zealot already
carry `reconcilePausedAt` / `Reason` / `Detail`). Re-resolve rather than set-once so an undelete
un-flags. Propagation is transitive over the reverse edges (a rule over a frozen segment is frozen),
skipping soft-deleted owners.

A stale rule is never evaluated. Each consumer defines its fail-closed behavior (Zealot ZLT-4444:
segment freezes membership as-is and flags; auto-approve falls through to manual review; match
filters stop matching). Frozen-and-visible beats recomputed-and-wrong.

### The save gate reads the registry

Exists, live, same-tenant, no self-reference, and **cycle = graph reachability** over persisted
edges plus the in-flight tree, inside the transaction — `validateNoCycle`'s DFS with the edge table
in place of `lookupCascade`. Never a depth cap. Once this reads the registry, every per-surface
`xReferencing(id)` scanner is deleted, not kept beside it.

## Rulings (Aron, 2026-08-31, on Zealot #2116)

1. False polymorphism, not a bare pair — typed FKs on both ends, cascade on the referenced side.
2. `referencedModel` is per edge, from the extraction; a constant is the column being decorative.
3. Edges hard-delete and have no lifecycle. deletedAt-awareness is on the joins and on the
   staleness trigger, never on the edge.
4. Legacy rows outside the id'd rule system (Zealot's ~10.8k `workflowJSON.autoApproveConfig`)
   are not backfilled; the one scanner protecting them survives with a KNOWN-BROKEN block on it.
   Things built on the rule system with real ids are what this protects.
5. Email `componentRefs` stays as it is. A component reference is resolved by **slug through the
   owner cascade** at read time — an org adding an override `header` changes what every template in
   that org resolves without touching either row. An id edge persisted at save would be wrong the
   moment the cascade changes; the slug-keyed reverse lookup (`componentRefs: { has: slug }`) is the
   correct index for that reference. Only id-addressed references ride this table.

## First consumers

- **Zealot** — segments (`Groups.conditions`), mission auto-approval, reference-request match
  filters, signup rules, smart folders. #2116 reshapes to the rulings above; ZLT-4444 is the
  staleness half.
- **Template** — the first rule-bearing column that names rows. Today there is none:
  `Contact.permissionRules` is a rebac override that names relations, not rows, and email has no
  conditions column until the lens builder lands (INFRA-017 / INFRA-018). The table, registry
  entries, hook and staleness hook land in the same commit as that surface; nothing here is built
  ahead of it because the typed FK columns are the surface.
- **json-rules** — `ruleReferences(lens, rule)` in the lens module, built against Zealot's
  registry as the named consumer.

## Not in scope

Tree composition (a rule evaluating another rule's tree — rejected on ZLT-4331; membership stays
row-based and ordering is topo layers). Depth caps. A `referencesX` boolean on the owner. Migrating
email component references onto the table (ruling 5).

## Related

- **INFRA-016** / **INFRA-017** / **INFRA-018** — serialized lenses, builder surface, lens builder;
  the email conditions column that becomes the first template surface arrives with them.
- **DB-001** — `db.txn` identity; the hook relies on running inside the caller's transaction.
- `apps/api/src/hooks/emailVersioning/hook.ts`, `packages/email/src/render/validateNoCycle.ts` —
  the reverse-walk and cycle-check precedents this generalizes.
- Zealot **ZLT-4441** / #2116 (table + hook, write-only), **ZLT-4444** (staleness), **ZLT-4331**
  (the review that produced this), `apps/api/src/hooks/ruleReference/` there.
- inixiative/json-rules#9 — the ruling that extraction is a lens concern with a named consumer.
