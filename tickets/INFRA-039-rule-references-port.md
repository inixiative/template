# INFRA-039: Rule references — port Zealot's declaration table and plain ids, edges that mirror the rule

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-10-23
**Updated**: 2026-10-26
**Related**: ZLT-6030, INFRA-030

---

## Overview

INFRA-030 built the edge table. Zealot (ZLT-5978) has since moved past it: one declaration table
of rule-bearing columns, one generic after-hook, and edges that read on their own. This brings the
template level with it.

## Rulings (Aron, 2026-10-23 / 24)

1. **Plain ids beside the false polymorphism.** `RuleReference` keeps its typed FKs and relations
   on both axes, and also carries plain `sourceId` and `targetId`. Edge identity is one unique,
   `(sourceModel, sourceId, targetModel, targetId)`. The false-polymorphism primitive writes the
   plain ids, not the edge writer. An axis declares `materialized` (the column holding the one id
   its set typed FK points at). The rules hook writes that column on create, createMany and an
   upsert's create arm, and refuses a row where they disagree.
2. **An edge's ends never change.** The typed FKs and materialized ids are immutable after
   create. The immutable-fields hook refuses an update that touches them. The only updatable
   column on an edge is the `targetDeletedAt` stamp. A different target is a different edge.
3. **The sync mirrors the rule; the save path checks.** `syncRuleReferenceEdges` writes exactly
   the edges the rule references, stamped from locked target states, and never refuses. There is
   no admission. The one check runs on the save path: when a rule column changes, the
   `ruleReference` hook calls `deadRuleReferences`. That is a plain read of the referenced rows
   and of each scope's owner-scope id set. Any deleted or missing row refuses the write with a 422
   whose `details` are `[{ model, id, state: 'deleted' | 'missing' }]`. A column resent unchanged
   is not checked, so a subject-only edit or a segment rename passes over a dead reference.
4. **Health reads edges.** A reference is dead when its edge has `targetDeletedAt`, its typed FK
   is NULL (purged), or the rule references a row with no edge. Segment health closes over the
   Segment edges it reaches, not over an owner query through the lens.
5. **No labels on the backend.** Segment responses carry `ruleReferences` as the edge rows'
   `targetModel`, `targetId` and `targetDeletedAt`. The frontend labels them.
6. **One declaration table, one hook.** `RULE_REFERENCE_SURFACES` declares each storing model's
   columns, label, storage wrapper and lens. A single after-hook syncs edges for every model in it,
   and revive regenerates by looping the same table.
7. **Lenses are static.** Nothing narrows, rewrites or re-derives a lens at call time. Email owner
   and sender scopes are static per kind (`EMAIL_OWNER_SCOPES`, `EMAIL_SENDER_SCOPES`, one
   recipient narrowing per sender kind), with every owner id written as a bind token. A row only
   supplies `emailLensBindings(owner, sender)` to `bindLens`. A template's stored lens stays a
   serialized input. `ownedSegments` takes no caller where, and dynamic segments are filtered in
   memory.
8. **Names say what they return.** No exported name carries "admit", "live", "named" or
   "identity". One edge reader, `ruleReferenceTargets`, returns each target's state, and callers
   adapt it. Revive reads the revived rows whole and passes them to `syncRuleReferences(model, rows)`.

9. **Each lens is a static file (2026-10-26).** A lens is a serializable literal in its own file,
   beside the others in one folder, and a variant composes through `LensNarrowing.parent`. No
   builder function takes options, and no lens is assembled or narrowed at call time: a row or a
   request supplies bind values to `bindLens`, nothing else. A first narrowing spells every relation
   it turns on; a relation left out is not there.
10. **One source-values reader (2026-10-26).** Whatever asks which rows a lens's source offers reads
    them through `sourceQueryValues`. The template has no lens source cache, so the save gate calls
    the reader directly; a cache and its clearing are not added here.

## Items

- [x] Schema: `sourceId`, one unique.
- [x] Declaration table + generic hook.
- [x] Target hook: no `create`; `ruleReference.stale` deleted.
- [x] Changed-tree-only refusals.
- [x] Reads carry the edge rows.
- [x] Agreement test (`hooks/ruleReference/registryAgreement.test.ts`), no edge-free list.
- [x] Names; admission deleted; health over edges; labels deleted.
- [x] Materialized ids in the polymorphism registry; immutable edge ends.
- [x] Static email scopes; `ownedSegments` without a caller where.
- [x] One sync entry for save and revive; save-gate helpers in `validations/`; one edge reader.
- [x] Static lens files: `customerRef/lib/lenses/` (`customerRefLens`, `customerRefsByIdLens`),
  `lib/email/lenses/` (one sender row lens per sender model); the email registry's user entity.
- [ ] Email rule lenses (`emailLens`, `scopeEmailLens`, `emailLensFor`): still assembled per call.
  See Notes.

## Exported surface

`packages/db`:
- `syncRuleReferenceEdges(source, references)`: makes a source's edges exactly its references,
  each stamped with its target's `deletedAt`. The one edge writer; it never refuses.
- `ruleReferences(lens, rule)` / `dynamicRuleReferences(lens, rule)`: the ids a stored rule
  references through id sources, and the id sources it reads at evaluation.
- `ruleReferenceTargets(edges)`: each edge's target with its state (`existing`, `deleted`,
  `purged`). The one edge reader.
- `lockedTargetStates(references)`: each referenced row's `deletedAt`, read `FOR UPDATE`.
- `validations/deadRuleReferences(scopes, references?)`: the references whose row is deleted or
  outside its scope's owner scope, as `{ model, id, state }`.
- `validations/assertRuleReferencesExist(scopes, references?)`: throws a `RuleReferenceError` with
  those as `details`, which the API answers with a 422.
- `materializedIdConflicts`, `withMaterializedIds`, `materializedColumns`: the polymorphism
  registry's materialized-id step, applied by the rules hook and the factories.
- `snapshotHookRegistry()`: for tests; restores the hook registry to the snapshot.

`apps/api/src/hooks/ruleReference/` (edge code only):
- `RULE_REFERENCE_SURFACES` / `isRuleReferenceSourceModel`: the declaration table.
- `syncRuleReferences(model, rows)`: makes each source's edges match the rule in its row as
  written, with no re-read. It only mirrors and has no mode. Writes to a declared model return
  full rows: the `ruleReference:fullRows` before-hook refuses `select` or `omit` on them.
- `registerRuleReferenceHook()`: the full-rows guard plus the after-hook. When a write changed
  a rule column (compared with the pre-image), the after-hook runs `assertRuleReferencesExist` on
  that column's references, then `syncRuleReferences`. Revive calls `syncRuleReferences`
  directly.
- `registerRuleReferenceTargetHook()`: copies a target's delete or restore onto its edges.

Segment and email callers:
- `assertSegmentReferencesOwned` (reach).
- `segmentRuleStates` / `segmentRuleIssuesFromEdges`, which build the rule's health from
  `ruleReferenceTargets` in a local adapter.
- `withSegmentsRuleIssues`, whose reads carry the edge rows.
- `dynamicSegmentsOf`.
- `EMAIL_OWNER_SCOPES` / `EMAIL_SENDER_SCOPES` / `emailLensBindings` / `scopeEmailLens`.
- `customerRef/lib/lenses/customerRefLens`, `customerRef/lib/lenses/customerRefsByIdLens`: static;
  `resolvedCustomerRefLens`, `ownedSegments` and `customerRefReachedModels` each in their own file
  beside them.

## Notes

- **The degraded signal is read from edges, not published.** `ruleReference.stale` had no consumer.
  A reader asks the edges (`ruleReferenceTargets`), and an alert or a job counts those rows.
- **Lens use left in health.** Segment health still extracts which ids the stored tree
  references through the static `customerRefLens`. That is a pure walk with no query, and it is
  how a reference with no edge is seen. `ruleIssues` also checks the tree's vocabulary against that
  lens. Removing both would mean health cannot see a missing edge.
- **A save that races a target's delete.** The edge writer still locks the target rows. With no
  gate it no longer refuses: the edge is written stamped with the committed `deletedAt`.
- **Out-of-scope `state`.** A row outside the owner's scope reads as `missing`. A deleted row
  reads as `deleted` whoever owns it, so the state shows that a deleted row exists under that id.
- **Source values are read live.** `deadRuleReferences` reads each scope's owner-scope id set
  through `sourceQueryValues`, which queries on every call. Nothing on the server caches a lens
  source's option set: the rolling-cache registry (`apps/api/src/lib/rollingCaches.ts`) is empty and
  `cacheReference` has no lens source entries. The only cache is the admin client's React Query entry
  for the email rule surface (`useEmailRuleSurface`, `staleTime: Infinity`).
- **The email rule lenses are not static yet.** Each slot's first narrowing is where its relations
  turn on, and the owner and sender scopes read columns that layer hides from later ones (the
  recipient slot shows only `role` on `OrganizationUser`, not `organizationId`). json-rules 3.5.4
  refuses those clamps in any later layer ("a later layer's clamp reads what its parent does not
  show"), which is why `clampLens` writes them into the first layer per call. A narrowing has one
  `parent`, so the static form is one first-layer literal per slot base (recipient, five sender
  models, each registry data lens) times owner kind times sender kind. For the recipient slot, a
  first-layer literal per kind pair projects, sources and selects exactly as `clampLens` does today;
  the number of literals is the open question.
- **No migration file.** The template has no migration history yet: the schema is applied with
  `db push`, and `db:baseline` refuses to run once any migration exists. A fork that has already
  cut its baseline migrates in three steps:

  ```sql
  ALTER TABLE "RuleReference" ADD COLUMN "sourceId" VARCHAR(36);
  UPDATE "RuleReference"
    SET "sourceId" = COALESCE("sourceEmailTemplateId", "sourceEmailComponentId", "sourceSegmentId");
  ALTER TABLE "RuleReference" ALTER COLUMN "sourceId" SET NOT NULL;
  DROP INDEX "RuleReference_sourceEmailTemplate_target_key";
  DROP INDEX "RuleReference_sourceEmailComponent_target_key";
  DROP INDEX "RuleReference_sourceSegment_target_key";
  CREATE UNIQUE INDEX "RuleReference_sourceModel_sourceId_targetModel_targetId_key"
    ON "RuleReference" ("sourceModel", "sourceId", "targetModel", "targetId");
  ```
