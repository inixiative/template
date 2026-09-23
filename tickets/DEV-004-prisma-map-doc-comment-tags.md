# DEV-004: prisma-map — parse `///` doc-comment tags (self-relation parent direction)

**Status**: 🚧 In Progress (`@tagClass` DSL shipped in `@inixiative/prisma-map` 0.2.0; template consumes it as of FEAT-003 PR #115 — first vocab `@permissions(hydrate: false)`; `@tree.parent` and `@permissions(side: …)` pending)
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-12
**Updated**: 2026-09-22
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

## How it landed (prisma-map 0.2.0)

- Prisma v7 preserves `///` comments in the generated client's `inlineSchema`; prisma-map's v7
  builder parses `@<tagClass>(<key>: <value>, …)` out of them and records the bag under
  `annotations` on the model, field, or index it sits above. Multiple tag classes per line, multiple
  keys per class. Template's `generatePrismaMap.ts` needed no change.
- The map records; the consumer decides what a tag means. Template surfaces `annotations` on
  `RelationInfo` (`packages/db/src/utils/prismaMapRelations.ts`).

## Vocabulary in use

### `@permissions(hydrate: false)` — shipped (FEAT-003)

"This relation is not part of the permissions tree." `shouldHydrate` filters it out of
`hydrate()`. Tagged: `FeatureFlag.segment`, `FeatureFlagVariant.segment`,
`Segment.internalToVariant`, `SegmentMember.customerRef`. It replaced a runtime cycle guard: the
variant ↔ internal-segment pair is the schema's first mutual-FK cycle, and `hydrate()` now throws on
a cycle instead of walking it — the fix is to tag an edge, not to truncate at runtime.

### `@permissions(side: …)` — decided in principle, not built

A model that sits between two parties has two chains of ancestry, and an action belongs to one of
them. CustomerRef is the case that surfaced it: the **provider** (`providerOrganization` /
`providerSpace` / `providerUser`, or platform) grants and manages the relationship; the **customer**
(`customerUser` / `customerOrganization` / `customerSpace`) owns their own communication settings
on the same row. Both parties edit the model; their permissions must traverse separate sides of the
tree and never meet.

- Declare the side on the edge: `/// @permissions(side: provider)` on the three provider relations,
  `side: customer` on the three customer relations. Composes with `hydrate: false` in one tag class.
- The side is an input to hydration and to the check: "which side am I acting on" → hydrate that
  side only, and the action's `rel:` fan-out (today's `ownerActions()` shape) is derived from the
  edges carrying that side rather than hand-listed. Rebac then asks the row exactly one question per
  action: are you the parent, or are you the child?
- Platform as provider has no FK; that side resolves to superadmin.
- **Open:** where the side → action mapping lives (the rebac schema entry, or the tag itself).
  CustomerRef has no rebac entry and no routes yet, so nothing forces the call.

### `@tree.parent` — original motivation, not built

Self-relation parent direction for factory traversal and tree auto-fill (below). `Inquiry.parent`
is the current self-relation; today `hydrate()` walks it upward because only the parent side carries
the FK.

## Powers

- **Factory traversal** — recurse one direction only; no infinite walk up a self-relation when
  auto-building related records.
- **Hydration tree auto-fill** — expand the child side to materialize the tree.

## Open questions

- `@tree.parent` alone, or also `@tree.root` / ordering hints (`@tree.order`) for sortable trees?
- Where `@permissions(side: …)` is consumed (see above).

## Related Tickets

- **Consumes:** `@inixiative/prisma-map` (relation-metadata extraction — already does FK direction)
- **Relates to:** the runtime-data-model → prisma-map migration on `#47`

---

_Captures the 2026-06-12 design session and the 2026-09-22 FEAT-003 ruling (annotation over runtime guard; sides). Expand the vocabulary when prioritized._
