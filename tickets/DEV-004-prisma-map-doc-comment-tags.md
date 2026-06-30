# DEV-004: prisma-map — parse `///` doc-comment tags (self-relation parent direction)

**Status**: 🚧 In Progress (`@tagClass` DSL shipped in `@inixiative/prisma-map`; template consumption + vocab pending)
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-12
**Updated**: 2026-06-12
**Repo**: `@inixiative/prisma-map` (the feature lives in the lib; tracked here because template/Zealot/Tribe all consume it)

---

## Overview

Let the schema author tag a self-relation with which side is the **parent**, and surface that
tag in the generated prisma-map so downstream tooling can traverse trees correctly.

Self-relations are symmetric in the Prisma schema (e.g. `parent` / `children` on the same model),
so no tool can infer which direction is "down the tree" — it has to be **declared**.

## The constraint

Prisma's schema parser rejects genuinely custom attributes (`@parent` won't validate). The
supported escape hatch is **`///` triple-slash doc comments**, which Prisma preserves into the DMMF
as `field.documentation`. So the syntax is a *convention* parsed by prisma-map, not a new attribute.

```prisma
model Category {
  parentId   String?
  /// @tree.parent
  parent     Category?  @relation("tree", fields: [parentId], references: [id])
  children   Category[] @relation("tree")
}
```

## Key implementation note

- The **runtime** DMMF (`Prisma.dmmf`) strips `documentation` for bundle size — so the tag MUST be
  read at **build time**, in prisma-map's generator step, via `@prisma/internals` `getDMMF()`
  (which keeps `documentation`). Template's `packages/db/scripts/generatePrismaMap.ts` is the seam.
- Emit a `parentSide` / `treeParent` flag on the self-relation entry in the map (alongside the
  existing FK-direction metadata — same mandate).

## Powers

- **Factory traversal** — recurse one direction only; no infinite walk up a self-relation when
  auto-building related records.
- **Hydration tree auto-fill** — expand the child side to materialize the tree.

## Open questions (brainstorm tag vocabulary before building)

- Just `@tree.parent` on the parent-pointing field? Or also `@tree.root` / ordering hints
  (`@tree.order`) for sortable trees?
- One tag namespace (`@tree.*`) vs. a flatter convention.
- Does prisma-map already expose a doc-comment passthrough we extend, or is this net-new parsing?

## Related Tickets

- **Consumes:** `@inixiative/prisma-map` (relation-metadata extraction — already does FK direction)
- **Relates to:** the runtime-data-model → prisma-map migration on `#47`

---

_Stub ticket — captures the design from the 2026-06-12 product/architecture session. Expand and finalize tag vocabulary when prioritized._
